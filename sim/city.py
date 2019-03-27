import math
import random
import itertools
from enum import Enum
from .grid import HexGrid

class ParcelType(Enum):
    Residential = 0
    Commercial = 1
    Park = 2
    River = 3

class City:
    def __init__(self, size, neighborhoods, percent_filled=0.7):
        rows, cols = size
        self.grid = HexGrid(rows, cols)

        self.neighborhoods = {i: neighb for i, neighb in enumerate(neighborhoods)}
        n_parcels = math.floor(rows*cols*percent_filled)
        self.generate_map(n_parcels)

    def generate_map(self, n_parcels):
        # Generate map parcels
        # Start from roughly center
        r_c, c_c = self.grid.rows//2, self.grid.cols//2
        parcel = Parcel((r_c, c_c))
        self.grid[r_c, c_c] = parcel
        parcels = [parcel]

        # Track empty spots as candidates for new parcels
        empty_pos = self.grid.adjacent((r_c, c_c))
        while len(parcels) < n_parcels:
            next_pos = random.choice(empty_pos)
            parcel = Parcel(next_pos)
            parcels.append(parcel)
            self.grid[next_pos] = parcel

            # Update empty spots
            empty_pos = [p for p in empty_pos + self.grid.adjacent(next_pos) if self[p] is None and p != next_pos]

        # Assign parks and rivers
        # TODO river algorithm needs work;
        # also it bisects the map which leads to
        # some places not being assigned neighborhoods
        edges = []
        top_edge = [None for _ in range(self.grid.cols)]
        bot_edge = [None for _ in range(self.grid.cols)]
        for row in self.grid:
            # Get edge cells
            not_empty = [p for p in row if p is not None]
            if not not_empty: continue
            for i, c in enumerate(row):
                if top_edge[i] is None:
                    top_edge[i] = c
                if c is not None:
                    bot_edge[i] = c
            edges.append(not_empty[0])
            edges.append(not_empty[-1])
        edges = edges + top_edge + bot_edge
        # TODO not using til I can implement a better algorithm for it
        # river_start = random.choice(top_edge)
        # river_end = random.choice(edges)
        # river_path = self.grid.path(river_start.pos, river_end.pos, lambda pos: self[pos] is not None)
        # for pos in river_path:
        #     self[pos].type = ParcelType.River

        # Assign initial neighborhoods
        assigned = []
        pppp = [p for p in parcels if p.type not in [ParcelType.River]]
        for neighb_id in self.neighborhoods.keys():
            parcel = random.choice(pppp)
            parcel.neighborhood = neighb_id
            assigned.append(parcel.pos)

        # Track adjacent unassigned parcel positions
        unassigned = []
        for pos in assigned:
            unassigned += [p for p in self.grid.adjacent(pos)
                           if self[p] is not None and self[p].neighborhood is None and self[p].type not in [ParcelType.River]]

        # Assign neighborhoods to rest of parcels
        while unassigned:
            next_pos = random.choice(unassigned)

            # Get assigned neighbors' neighborhoods
            # and randomly choose one
            neighbs = [self[p].neighborhood for p in self.grid.adjacent(next_pos)
                       if self[p] is not None and self[p].neighborhood is not None]
            self.grid[next_pos].neighborhood = random.choice(neighbs)

            unassigned = [p for p in unassigned + self.grid.adjacent(next_pos)
                          if self[p] is not None and self[p].neighborhood is None and self[p].type not in [ParcelType.River]]
            assigned.append(next_pos)

        # Assign commercial areas
        for neighb, data in self.neighborhoods.items():
            if data['commercial'] > 0:
                ps = [p for p in self if p.neighborhood == neighb]
                n_commercial = math.floor(data['commercial'] * len(ps))
                p = random.choice(ps)
                p.type = ParcelType.Commercial
                n_assigned = 1
                unassigned = [pt for pt in self.grid.adjacent(p.pos)
                              if self[pt] is not None and self[pt].neighborhood == neighb
                              and self[pt].type != ParcelType.Commercial]
                while n_assigned < n_commercial:
                    p = random.choice(unassigned)
                    self[p].type = ParcelType.Commercial
                    n_assigned += 1
                    unassigned = [pt for pt in unassigned + self.grid.adjacent(p)
                                if self[pt] is not None and self[pt].neighborhood == neighb
                                and self[pt].type != ParcelType.Commercial]


        # Assign parks
        for neighb, data in self.neighborhoods.items():
            if data['park'] > 0:
                ps = [p for p in self if p.neighborhood == neighb]
                n_park = math.floor(data['park'] * len(ps))
                p = random.choice([p for p in ps if p.type != ParcelType.Commercial])
                p.type = ParcelType.Park
                n_assigned = 1
                unassigned = [pt for pt in self.grid.adjacent(p.pos)
                              if self[pt] is not None and self[pt].neighborhood == neighb
                              and self[pt].type not in [ParcelType.Commercial, ParcelType.Park]]
                while n_assigned < n_park:
                    p = random.choice(unassigned)
                    self[p].type = ParcelType.Park
                    n_assigned += 1
                    unassigned = [pt for pt in unassigned + self.grid.adjacent(p)
                                if self[pt] is not None and self[pt].neighborhood == neighb
                                and self[pt].type not in [ParcelType.Commercial, ParcelType.Park]]

        # Compute desireability of parcels
        parks = [p for p in self if p.type == ParcelType.Park]
        comms = [p for p in self if p.type == ParcelType.Commercial]
        for p in self:
            if p.type == ParcelType.Residential:
                # Closest park
                park_dist = min(self.grid.distance(p.pos, o.pos) for o in parks)
                # Closest commercial area
                comm_dist = min(self.grid.distance(p.pos, o.pos) for o in comms)
                p.desirability = (1/(comm_dist+park_dist) * 10) + self.neighborhoods[p.neighborhood]['desirability']


    def __getitem__(self, pos):
        return self.grid[pos]

    def __iter__(self):
        for p in self.grid.cells:
            if p is not None: yield p

    def vacant_units(self):
        return sum((b.vacant_units for b in self.buildings), [])

    def neighborhood_units(self, neighb):
        ps = [p for p in self if p.neighborhood == neighb and p.building is not None]
        return sum((p.building.units for p in ps), [])

    @property
    def buildings(self):
        return [p.building for p in self if p.building is not None]

    @property
    def units(self):
        return sum([p.building.units for p in self if p.building is not None], [])


class Parcel:
    def __init__(self, pos, neighborhood=None, building=None):
        self.pos = pos
        self.type = ParcelType.Residential
        self.neighborhood = neighborhood
        self.desirability = -1
        self.build(building)

    def build(self, building):
        self.building = building
        if building is not None:
            building.parcel = self
            building.id = '{}_{}'.format(*self.pos)


class Building:
    def __init__(self, units):
        self.units = units
        for u in self.units:
            u.building = self

    @property
    def vacant_units(self):
        # TODO prob shouldn't call this "vacant_units"
        # but "units_with_vacancies"
        return [u for u in self.units if u.vacancies > 0]

    @property
    def revenue(self):
        return sum(u.rent for u in self.units)


class Unit:
    _id = itertools.count()

    def __init__(self, rent, occupancy, area, owner=None):
        self.id = next(self._id)
        self.rent = rent
        self.occupancy = occupancy
        self.area = area
        self.tenants = set()
        self.owner = None
        self.setOwner(owner)
        self.monthsVacant = 0

        self.offers = set()

    def setOwner(self, owner):
        # Remove from old owner
        if self.owner is not None:
            self.owner.units.remove(self)

        self.owner = owner
        if self.owner is not None:
            self.owner.units.add(self)

    @property
    def vacant(self):
        return not self.tenants

    @property
    def vacancies(self):
        return self.occupancy - len(self.tenants)

    @property
    def occupants(self):
        return len(self.tenants)

    @property
    def rent_per_area(self):
        return self.rent/self.area

    def move_in(self, tenant, month):
        if tenant.unit is not None:
            tenant.unit.move_out(tenant)

        # Lease month is set to
        # when the first tenant moves in
        # after a vacancy
        if not self.tenants:
            self.leaseMonth = month

        self.tenants.add(tenant)
        tenant.unit = self

    def move_out(self, tenant):
        self.tenants.remove(tenant)
        tenant.unit = None
