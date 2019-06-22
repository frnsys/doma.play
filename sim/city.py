import math
import random
from enum import Enum
from .doma import DOMA
from .grid import HexGrid
from collections import deque


class ParcelType(Enum):
    Residential = 0
    Park = 2
    River = 3


class City:
    @classmethod
    def from_map(cls, map, neighborhoods, config):
        # This is specifically for maps created
        # with the designer.
        # Assume map has already been "minimized"
        # and that the map rows are not ragged
        # Note that the designer outputs cols/rows flipped
        layout = map['layout']
        rows = len(layout)
        cols = len(layout[0])
        city = cls((cols, rows), neighborhoods, config)

        for r, row in enumerate(layout):
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

    def __init__(self, size, neighborhoods, config):
        rows, cols = size
        self.grid = HexGrid(rows, cols)
        self.neighborhoods = neighborhoods
        self.config = config

    def update_parcel_desirabilities(self):
        """Compute desireability of parcels"""
        total = 0
        count = 0
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
                total += p.desirability
                count += 1

        mean_desirability = total/count

        # Update weighted parcel desirabilities
        for p in self:
            if p.type == ParcelType.Residential:
                p.weighted_desirability = p.desirability/mean_desirability

        # Update unit values
        for u in self.units:
            u.value = round(self.config['priceToRentRatio']*(u.rent*12)*u.building.parcel.weighted_desirability)

    def build_residences(self):
        """Build residences"""
        for p in self.parcels_of_type(ParcelType.Residential):
            neighb = self.neighborhoods[p.neighborhood]
            n_units = random.randint(neighb['minUnits'], neighb['maxUnits'])

            # Need to keep these divisible by 4 for towers
            if n_units > 3:
                while n_units % 4 != 0:
                    n_units += 1

                n_floors = n_units/4
                total_floors = math.ceil(n_floors/(1-neighb['pCommercial']))
                n_commercial = total_floors - n_floors
            else:
                # Houses have no commercial floors
                n_commercial = 0

            units = []
            for _ in range(n_units):
                area = random.randint(neighb['minArea'], neighb['maxArea'])
                rent = round(self.config['pricePerSqm']*area*neighb['desirability'])
                value = round(self.config['priceToRentRatio']*(rent*12)*neighb['desirability'])
                units.append(Unit(
                    area=area,
                    rent=rent,
                    value=value,
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

    def units_by_neighborhood(self):
        return {neighb: self.neighborhood_units(neighb) for neighb in self.neighborhoods.keys()}

    def neighborhoods_with_units(self):
        return {neighb: units for neighb, units in self.units_by_neighborhood().items() if units}

    @property
    def commercial_buildings(self):
        return [(b, b.n_commercial) for b in self.buildings if b.n_commercial > 0]

    @property
    def buildings(self):
        return [p.building for p in self if p.building is not None]

    @property
    def units(self):
        return sum([b.units for b in self.buildings], [])

    def parcels_of_type(self, type):
        return [p for p in self if p.type == type]

    def residential_parcels(self):
        return self.parcels_of_type(ParcelType.Residential)

    def residential_parcels_by_neighborhood(self):
        return {neighb: [p for p in self if p.neighborhood == neighb and p.type == ParcelType.Residential] for neighb in self.neighborhoods.keys()}

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
    def __init__(self, area, rent, value, occupancy, owner=None):
        self.rent = rent
        self.occupancy = occupancy
        self.area = area
        self.tenants = set()
        self.owner = None
        self.setOwner(owner)
        self.monthsVacant = 0

        self.maintenance = 0.1 # TODO what to set as the starting value?
        self.condition = 1

        # Purchase offers
        self.offers = set()
        self.recently_sold = False
        self.value = value

        # Keep track of YTD income and maintenance
        self.income_history = deque([], maxlen=12)
        self.maintenance_history = deque([], maxlen=12)

    def setOwner(self, owner):
        # Remove from old owner
        if self.owner is not None:
            self.owner.units.remove(self)

        self.owner = owner
        if self.owner is not None:
            self.owner.units.add(self)

    def adjusted_rent(self, tenants=None):
        """Compute adjusted rent,
        which takes into account DOMA ownership"""
        if not isinstance(self.owner, DOMA):
            return self.rent
        tenants = tenants or self.tenants
        total_share = sum(self.owner.shares(t) for t in tenants)
        reduction = self.owner.last_revenue * total_share
        return max(0, self.rent - reduction)

    @property
    def vacant(self):
        return not self.tenants

    @property
    def vacancies(self):
        return self.occupancy - len(self.tenants)

    @property
    def rent_per_area(self):
        return self.rent/self.area

    @property
    def adjusted_rent_per_area(self):
        return self.adjusted_rent()/self.area

    @property
    def rent_per_tenant(self):
        return self.rent/len(self.tenants)

    @property
    def adjusted_rent_per_tenant(self):
        return self.adjusted_rent()/len(self.tenants)

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

    def collect_rent(self):
        if self.vacant:
            self.income_history.append(0)
        else:
            self.income_history.append(self.rent)
        self.maintenance_history.append(self.maintenance)

        self.mean_ytd_income = self.weighted_mean_ytd_income()
        self.mean_ytd_maintenance = self.weighted_mean_ytd_maintenance()

    def weighted_mean_ytd_income(self):
        # Decay linearly over past year/available data
        n_hist = len(self.income_history)
        weights = [(i+1)*(1/n_hist) for i in range(n_hist)]
        return sum(w*inc for w, inc in zip(weights, self.income_history))/sum(weights)

    def weighted_mean_ytd_maintenance(self):
        # Decay linearly over past year/available data
        n_hist = len(self.maintenance_history)
        weights = [(i+1)*(1/n_hist) for i in range(n_hist)]
        return sum(w*inc for w, inc in zip(weights, self.maintenance_history))/sum(weights)
