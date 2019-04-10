import math
import random
from enum import Enum
from .grid import HexGrid


class ParcelType(Enum):
    Residential = 0
    Park = 2
    River = 3


class City:
    @classmethod
    def generate(cls, size, n_parcels, neighborhoods):
        city = cls(size, neighborhoods)
        city.generate_map(n_parcels)
        return city

    @classmethod
    def from_map(cls, map, neighborhoods):
        # This is specifically for maps created
        # with the designer.
        # Assume map has already been "minimized"
        # and that the map rows are not ragged
        # Note that the designer outputs cols/rows flipped
        rows = len(map)
        cols = len(map[0])
        city = cls((cols, rows), neighborhoods)

        for r, row in enumerate(map):
            for c, cell in enumerate(row):
                if cell is None: continue
                neighb_id, parcel_type = cell.split('|')

                parcel = Parcel((c, r))
                parcel.type = ParcelType[parcel_type]
                if neighb_id != '-1':
                    parcel.neighborhood = neighb_id
                city.grid[c, r] = parcel

        city.build_residences()
        city.update_parcel_desirabilities()
        return city

    def __init__(self, size, neighborhoods):
        rows, cols = size
        self.grid = HexGrid(rows, cols)
        self.neighborhoods = neighborhoods

    def generate_map(self, n_parcels):
        if n_parcels > self.grid.rows * self.grid.cols:
            raise Exception('Too many parcels for grid dimensions')

        # Generate map parcels
        # Start from roughly center
        r_c, c_c = self.grid.rows//2, self.grid.cols//2
        parcel = Parcel((r_c, c_c))
        self.grid[r_c, c_c] = parcel
        parcels = [parcel]

        # Track empty spots as candidates for new parcels
        empty_pos = self.grid.adjacent((r_c, c_c))
        while len(parcels) < n_parcels:
            pos = random.choice(empty_pos)
            parcel = Parcel(pos)
            parcels.append(parcel)
            self.grid[pos] = parcel

            # Update empty spots
            empty_pos = [p for p in empty_pos + self.grid.adjacent(pos)
                         if self[p] is None and p != pos]

        # Generate rivers
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

        needs_neighb = lambda pos: self[pos].neighborhood is None\
            and self[pos].type is not ParcelType.River

        # Assign initial neighborhoods
        assigned = []
        cands = filter(needs_neighb, [p.pos for p in parcels])
        cands = random.sample(list(cands), len(self.neighborhoods))
        for pos, neighb_id in zip(cands, self.neighborhoods.keys()):
            self[pos].neighborhood = neighb_id
            assigned.append(pos)

        # Track adjacent unassigned parcel positions
        unassigned = []
        for pos in assigned:
            unassigned += filter(needs_neighb, self.adjacent(pos))

        # Assign neighborhoods to rest of parcels
        while unassigned:
            pos = random.choice(unassigned)

            # Get assigned neighbors' neighborhoods
            # and randomly choose one
            neighbs = [self[p].neighborhood for p in self.adjacent(pos)
                       if self[p].neighborhood is not None]
            self.grid[pos].neighborhood = random.choice(neighbs)

            unassigned = list(filter(needs_neighb, unassigned + self.adjacent(pos)))
            assigned.append(pos)

        # Assign zones in each neighborhood
        zones = [ParcelType.Park]
        for zone in zones:
            for neighb_id, data in self.neighborhoods.items():
                prop = data[zone.name.lower()]
                needs_zone = lambda p: self[p].neighborhood == neighb_id \
                    and self[p].type not in zones

                if prop > 0:
                    parcels = [p for p in self if p.neighborhood == neighb_id]
                    n_to_assign = math.floor(prop * len(parcels))
                    parcel = random.choice(parcels)
                    parcel.type = zone
                    n_assigned = 1

                    unassigned = list(filter(needs_zone, self.adjacent(parcel.pos)))
                    while n_assigned < n_to_assign:
                        pos = random.choice(unassigned)
                        self[pos].type = zone
                        unassigned = list(filter(needs_zone, unassigned + self.adjacent(pos)))
                        n_assigned += 1

        self.build_residences()
        self.update_parcel_desirabilities()

    def update_parcel_desirabilities(self):
        """Compute desireability of parcels"""
        parks = self.parcels_of_type(ParcelType.Park)
        for p in self:
            if p.type == ParcelType.Residential:
                # Closest park
                if parks:
                    park_dist = min(self.grid.distance(p.pos, o.pos) for o in parks)
                else:
                    park_dist = 1

                # Nearby commercial density
                n_commercial = sum(n.building.n_commercial
                                   for n in [self[pos] for pos in self.grid.radius(p.pos, 2)]
                                   if n and n.building)

                # TODO calibrate this
                p.desirability = (1/park_dist * 10) + self.neighborhoods[p.neighborhood]['desirability'] + n_commercial/10

    def build_residences(self):
        """Build residences"""
        for p in self.parcels_of_type(ParcelType.Residential):
            neighb = self.neighborhoods[p.neighborhood]
            n_units = random.randint(neighb['minUnits'], neighb['maxUnits'])

            # TODO need to keep these divisible by 4 for towers
            if n_units > 3:
                while n_units % 4 != 0:
                    n_units += 1

                n_commercial = 0
                while random.random() < neighb['pCommercial']:
                    n_commercial += 1
            else:
                # Houses have no commercial floors
                n_commercial = 0

            units = []
            for _ in range(n_units):
                area = random.randint(neighb['minArea'], neighb['maxArea'])
                units.append(Unit(
                    area=area,
                    rent=round(neighb['pricePerSqm']/area),
                    occupancy=max(1, round(area/neighb['sqmPerOccupant'])),
                ))
            p.build(Building('{}_{}'.format(*p.pos), units, n_commercial))

    def adjacent(self, pos):
        """Get adjacent parcels to position"""
        return [p for p in self.grid.adjacent(pos) if self[p] is not None]

    def __getitem__(self, pos):
        """Get parcel at position"""
        return self.grid[pos]

    def __iter__(self):
        """Iterate over parcels"""
        for p in self.grid.cells:
            if p is not None: yield p

    def units_with_vacancies(self):
        return sum((b.units_with_vacancies for b in self.buildings), [])

    def neighborhood_units(self, neighb):
        ps = [p for p in self if p.neighborhood == neighb and p.building is not None]
        return sum((p.building.units for p in ps), [])

    @property
    def buildings(self):
        return [p.building for p in self if p.building is not None]

    @property
    def units(self):
        return sum([b.units for b in self.buildings], [])

    def parcels_of_type(self, type):
        return [p for p in self if p.type == type]


class Parcel:
    def __init__(self, pos):
        self.pos = pos
        self.type = ParcelType.Residential
        self.desirability = -1
        self.building = None
        self.neighborhood = None

    def build(self, building):
        self.building = building
        building.parcel = self


class Building:
    def __init__(self, id, units, n_commercial):
        self.id = id
        self.units = units

        # Floors of commercial
        self.n_commercial = n_commercial

        for i, u in enumerate(self.units):
            u.id = '{}__{}'.format(self.id, i)
            u.building = self

    @property
    def units_with_vacancies(self):
        return [u for u in self.units if u.vacancies > 0]

    @property
    def revenue(self):
        return sum(u.rent for u in self.units)


class Unit:
    def __init__(self, rent, occupancy, area, owner=None):
        self.rent = rent
        self.occupancy = occupancy
        self.area = area
        self.tenants = set()
        self.owner = None
        self.setOwner(owner)
        self.monthsVacant = 0

        # Purchase offers
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
            self.monthsVacant = 0

        self.tenants.add(tenant)
        tenant.unit = self

    def move_out(self, tenant):
        self.tenants.remove(tenant)
        tenant.unit = None
