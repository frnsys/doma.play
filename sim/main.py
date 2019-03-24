import math
import numpy as np
import statsmodels.api as sm
from collections import defaultdict

minArea = 50
movingPenalty = 10
neighborhoods = list(range(3))

def distance(a, b):
    return math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)

def radius_pos(pos, radius):
    if radius == 0: return pos

    r, c = pos
    diameter = radius*2
    r_s, c_s = r-radius, c-radius
    for r_i in range(r_s, r_s+diameter+1):
        for c_i in range(c_s, c_s+diameter+1):
            yield r_i, c_i


class City:
    def __init__(self, rows, cols):
        self.rows = rows
        self.cols = cols

        # Initialize grid structure
        self.grid = []
        for r in range(self.rows):
            row = [Parcel((r, c), random.choice(neighborhoods)) for c in range(self.cols)]
            self.grid.append(row)

    def __getitem__(self, pos):
        r, c = pos
        return self.grid[r][c]

    def __setitem__(self, pos, val):
        r, c = pos
        self.grid[r][c] = val

    def __iter__(self):
        for r in range(self.rows):
            for c in range(self.cols):
                yield self.grid[r][c]

    def vacant_units(self):
        return sum((b.vacant_units for b in self.buildings), [])

    def neighborhood_units(self, neighb):
        ps = [p for p in self if p.neighborhood == neighb]
        return sum((p.building.units for p in ps), [])

    @property
    def buildings(self):
        return [p.building for p in self]

class Developer:
    def __init__(self):
        self.units = set()
        self.rent_estimates = {neighb: [] for neighb in neighborhoods}
        self.trend_estimates = {neighb: 0 for neighb in neighborhoods}
        self.invest_estimates = {neighb: 0 for neighb in neighborhoods}

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
        for u in random.sample(city.neighborhood_units(best_invest), sample_size):
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
    def __init__(self, pos, neighborhood, building=None):
        self.pos = pos
        self.neighborhood = neighborhood
        self.build(building)

    def build(self, building):
        self.building = building
        if building is not None:
            building.parcel = self

class Building:
    def __init__(self, units):
        self.tenants = {}
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
    def __init__(self, rent, occupancy, area, owner=None):
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
    def __init__(self, income):
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
            elapsed = month - self.unit.leaseMonth
            reconsider = elapsed > 0 and elapsed % 12 == 0
            current_desirability = t.desirability(self.unit)
        if reconsider:
            units = random.sample(city.vacant_units, sample_size)
            vacancies = sorted(units, key=lambda u: t.desirability(u), reverse=True)

            # Desirability of 0 means that tenant can't afford it
            des = t.desirability(vacancies[0])
            if des - localMovingPenalty > current_desirability:
                vacancies[0].move_in(t, time)


if __name__ == '__main__':
    import random

    # Initialize developers
    developers = [Developer() for _ in range(10)]

    # Initialize tenants
    tenants = []
    for _ in range(100):
        # TODO better income distribution
        income = random.randint(500, 5000)
        tenant = Tenant(income)
        tenants.append(tenant)

    # Initialize city buildings
    city = City(20, 20)
    for p in city:
        n_units = random.randint(1, 5)
        units = [
            Unit(
                rent=random.randint(500, 6000),
                occupancy=random.randint(1, 5),
                area=random.randint(150, 800)
            ) for _ in range(n_units)
        ]
        p.build(Building(units))

    # Distribute units to tenants
    random.shuffle(tenants)
    for t in tenants:
        month = random.randint(0, 11)
        vacancies = city.vacant_units()
        vacancies = sorted(vacancies, key=lambda u: t.desirability(u), reverse=True)

        # Desirability of 0 means that tenant can't afford it
        if t.desirability(vacancies[0]) > 0:
            vacancies[0].move_in(t, month)

    # Distribute ownership of units
    def random_owner(unit):
        roll = random.random()
        if unit.tenants:
            if roll < 0.33:
                owner = random.choice(developers)
            elif roll < 0.66:
                owner = random.choice(tenants)
            else:
                owner = random.choice(list(unit.tenants))
        else:
            if roll < 0.5:
                owner = random.choice(developers)
            else:
                owner = random.choice(tenants)
        return owner
    for p in city:
        for u in p.building.units:
            u.setOwner(random_owner(u))

    # Each tick is a month
    steps = 100
    estimate_radius = 2
    for i in range(steps):
        random.shuffle(developers)
        for d in developers:
            d.step(i, city)

        random.shuffle(tenants)
        for t in tenants:
            t.step(i, city)

    # TODO/note: currently non-developer landlords
    # don't adjust rent
