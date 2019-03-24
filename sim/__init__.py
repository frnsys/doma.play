import math
import random
import itertools
import numpy as np
import statsmodels.api as sm
from .grid import HexGrid
from collections import defaultdict

minArea = 50
movingPenalty = 10


class City:
    def __init__(self, size, neighborhoods):
        rows, cols = size
        self.grid = HexGrid(rows, cols)

        self.neighborhoods = neighborhoods;
        n_parcels = math.floor(rows*cols*0.7) # TEMP
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


class Developer:
    _id = itertools.count()

    def __init__(self, city):
        self.city = city
        self.id = next(self._id)

        self.units = set()
        self.rent_estimates = {neighb: [] for neighb in city.neighborhoods}
        self.trend_estimates = {neighb: 0 for neighb in city.neighborhoods}
        self.invest_estimates = {neighb: 0 for neighb in city.neighborhoods}

    def estimate_rents(self, city, sample_size=10):
        """Estimate market rent per neighborhood,
        based on occupied owned units"""
        neighborhoods = defaultdict(list)
        for u in self.units:
            if not u.occupants: continue
            neighborhoods[u.building.parcel.neighborhood].append(u.rent_per_area)

        for neighb, rent_history in self.rent_estimates.items():
            rents = neighborhoods.get(neighb, [])
            rents += [u.rent_per_area for u in random.sample(city.neighborhood_units(neighb), sample_size)]
            # TODO should also look at radii around buildings, or margins of
            # neigborhoods, so neighborhoods can bleed over? or, if
            # the desirability of units have a geospatial component, that will
            # be captured automatically (units on the border will be spatially
            # close and share that geospatial desirability)
            rent_history.append(np.mean(rents))

    def rent_estimate(self, neighb, months=10):
        return np.mean(self.rent_estimates[neighb][-months:])

    def estimate_trends(self, months=6, horizon=12):
        # for neighb, rent_history in self.rent_estimates.items():
        #     changes = []
        #     for rent_prev, rent_next in zip(rent_history[-months:], rent_history[-months+1:]):
        #         changes.append(rent_next - rent_prev)
        #     self.trend_estimates[neighb] = np.mean(changes)
        for neighb, rent_history in self.rent_estimates.items():
            if len(rent_history) < months: continue
            y = rent_history[-months:]
            X = list(range(len(y)))
            m = sm.OLS(y, X).fit()
            est_future_rent = m.predict([horizon])[0]
            self.trend_estimates[neighb] = est_future_rent
            self.invest_estimates[neighb] = est_future_rent - rent_history[-1]

    def make_purchase_offers(self, sample_size=20):
        best_invest = max(self.invest_estimates.keys(), key=lambda n: self.invest_estimates[n])

        est_future_rent = self.trend_estimates[best_invest]
        for u in random.sample(self.city.neighborhood_units(best_invest), sample_size):
            if u.owner == self: continue
            five_year_income = u.rent_per_area * 5 * 12
            five_year_income_estimate = est_future_rent * 5 * 12
            if five_year_income_estimate > five_year_income:
                u.offers.add((self, five_year_income))

    def check_purchase_offers(self):
        transfers = []
        for u in self.units:
            if not u.offers: continue

            neighb = u.building.parcel.neighborhood
            est_future_rent = self.trend_estimates[neighb] * 5 * 12
            considered_offers = [(d, o) for d, o in u.offers if o > est_future_rent]
            if considered_offers:
                # Transfer ownership to the highest bidder
                dev, offer = max(considered_offers, key=lambda off: off[-1])
                transfers.append((u, dev))

        # Have to do this here
        # so we don't modify self.units
        # as we iterate
        for u, dev in transfers:
            u.setOwner(dev)

    def step(self, time, city):
        # Update market estimates
        self.estimate_rents(city)
        self.estimate_trends()

        # Update rents
        self.manage_vacant_units()
        self.manage_occupied_units(time)

        # Buy/sells
        self.make_purchase_offers()
        self.check_purchase_offers()

    @property
    def vacant_units(self):
        return [u for u in self.units if u.occupants == 0]

    def manage_vacant_units(self):
        for u in self.vacant_units:
            # Lower rents on vacant units
            u.monthsVacant += 1
            # TODO this can be smarter
            u.rent *= 0.98

    @property
    def occupied_units(self):
        return [u for u in self.units if u.occupants > 0]

    def manage_occupied_units(self, month):
        # year-long leases
        for u in self.occupied_units:
            elapsed = month - u.leaseMonth
            if elapsed > 0 and elapsed % 12 == 0:
                # TODO this can be smarter
                # i.e. depend on gap b/w
                # current rent and rent estimate/projection
                u.rent *= 1.05

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


class Tenant:
    _id = itertools.count()

    def __init__(self, income):
        self.id = next(self._id)

        # Monthly income
        self.income = income

        # Current residence
        self.unit = None

        # Tenants may own units too
        self.units = set()

    def desirability(self, unit):
        """Compute desirability of a housing unit
        for this tenant"""
        rent_per_tenant = unit.rent/(unit.occupants+1)
        if self.income < rent_per_tenant:
            return 0

        # very rough sketch
        ratio = rent_per_tenant/self.income
        # TODO add this in niceness = unit.building.parcel.value
        # commute = distance(self.work.pos, unit.building.parcel.pos)
        spaciousness = (unit.area/(unit.occupants+1)) - minArea

        # TODO tweak
        #return 1/commute + niceness - ratio + spaciousness
        # return niceness - ratio + spaciousness
        return ratio + spaciousness

    def step(self, time, city):
        sample_size = 20
        if self.unit is None:
            reconsider = True
            current_desirability = -1
            localMovingPenalty = 0
        else:
            localMovingPenalty = movingPenalty
            elapsed = time - self.unit.leaseMonth
            reconsider = elapsed > 0 and elapsed % 12 == 0
            current_desirability = self.desirability(self.unit)
        if reconsider:
            units = random.sample(city.vacant_units(), sample_size)
            vacancies = sorted(units, key=lambda u: self.desirability(u), reverse=True)

            # Desirability of 0 means that tenant can't afford it
            des = self.desirability(vacancies[0])
            if des - localMovingPenalty > current_desirability:
                vacancies[0].move_in(self, time)

        transfers = []
        for u in self.units:
            if not u.offers: continue
            est_future_rent = u.rent * 5 * 12
            considered_offers = [(d, o) for d, o in u.offers if o > est_future_rent]
            if considered_offers:
                # Transfer ownership to the highest bidder
                dev, offer = max(considered_offers, key=lambda off: off[-1])
                transfers.append((u, dev))

        # Have to do this here
        # so we don't modify self.units
        # as we iterate
        for u, dev in transfers:
            u.setOwner(dev)
