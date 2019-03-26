import random
import itertools
import numpy as np
import statsmodels.api as sm
from collections import defaultdict

minArea = 50
movingPenalty = 10



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
            units = city.neighborhood_units(neighb)
            rents += [u.rent_per_area for u in random.sample(units, min(len(units), sample_size))]
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
        units = self.city.neighborhood_units(best_invest)
        for u in random.sample(units, min(len(units), sample_size)):
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
            vacants = city.vacant_units()
            if vacants:
                units = random.sample(vacants, min(len(vacants), sample_size))
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
