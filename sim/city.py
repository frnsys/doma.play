import math
import random
import itertools
from .grid import HexGrid


class City:
    def __init__(self, size, neighborhoods, percent_filled=0.7):
        rows, cols = size
        self.grid = HexGrid(rows, cols)

        self.neighborhoods = neighborhoods;
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

        # Assign initial neighborhoods
        assigned = []
        for neighb in self.neighborhoods:
            parcel = random.choice(parcels)
            parcel.neighborhood = neighb
            assigned.append(parcel.pos)

        # Track adjacent unassigned parcel positions
        unassigned = []
        for pos in assigned:
            unassigned += [p for p in self.grid.adjacent(pos)
                           if self[p] is not None and self[p].neighborhood is None]

        # Assign neighborhoods to rest of parcels
        while len(assigned) < len(parcels):
            next_pos = random.choice(unassigned)

            # Get assigned neighbors' neighborhoods
            # and randomly choose one
            neighbs = [self[p].neighborhood for p in self.grid.adjacent(next_pos)
                       if self[p] is not None and self[p].neighborhood is not None]
            self.grid[next_pos].neighborhood = random.choice(neighbs)

            unassigned = [p for p in unassigned + self.grid.adjacent(next_pos)
                          if self[p] is not None and self[p].neighborhood is None]
            assigned.append(next_pos)

    def __getitem__(self, pos):
        return self.grid[pos]

    def __iter__(self):
        for p in self.grid:
            if p is not None: yield p

    def vacant_units(self):
        return sum((b.vacant_units for b in self.buildings), [])

    def neighborhood_units(self, neighb):
        ps = [p for p in self if p.neighborhood == neighb]
        return sum((p.building.units for p in ps), [])

    @property
    def buildings(self):
        return [p.building for p in self]

    @property
    def units(self):
        return sum([p.building.units for p in self], [])


class Parcel:
    def __init__(self, pos, neighborhood=None, building=None):
        self.pos = pos
        self.neighborhood = neighborhood
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
