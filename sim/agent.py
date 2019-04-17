import sys
import random
import itertools
import numpy as np
import statsmodels.api as sm
from collections import defaultdict


class Offer:
    def __init__(self, landlord, unit, amount):
        self.landlord = landlord
        self.unit = unit
        self.amount = amount
        self.accepted = None


class Landlord:
    _id = itertools.count()

    def __init__(self, city):
        self.city = city
        self.id = next(self._id)

        self.units = set()
        self.out_offers = set()

        # Keep track of estimates
        # for making decisions
        self.rent_ests = {}
        self.trend_ests = {}
        self.invest_ests = {}
        for neighb_id in city.neighborhoods.keys():
            self.rent_ests[neighb_id] = []
            self.trend_ests[neighb_id] = 0
            self.invest_ests[neighb_id] = 0

    def estimate_rents(self, city, sample_size=10):
        """Estimate market rent per neighborhood,
        based on occupied owned units"""
        neighborhoods = defaultdict(list)
        # Consider own units
        for u in self.units:
            if not u.tenants: continue
            neighborhoods[u.building.parcel.neighborhood].append(u.rent_per_area)

        # Also consider a random sample of
        # other units in the neighborhood
        for neighb, rent_history in self.rent_ests.items():
            rents = neighborhoods.get(neighb, [])
            units = city.neighborhood_units(neighb)
            samp_size = min(len(units), sample_size)
            rents += [u.rent_per_area for u in random.sample(units, samp_size)]
            rent_history.append(np.mean(rents))

    def estimate_trends(self, months=12, horizon=36):
        """Estimate rent trends for each neighborhood,
        looking ate past `months` of data, projecting
        out to `horizon` months"""
        # TODO should these months/horizon be landlord parameters?
        for neighb, rent_history in self.rent_ests.items():
            if len(rent_history) < months: continue
            y = rent_history[-months:]
            X = list(range(len(y)))
            m = sm.OLS(y, X).fit()
            est_future_rent = m.predict([horizon])[0]
            self.trend_ests[neighb] = est_future_rent
            self.invest_ests[neighb] = est_future_rent - rent_history[-1]

    def make_purchase_offers(self, sim, sample_size=20):
        """Make purchase offers for units
        based on investment value estimates"""
        # Check offer responses
        new_offers = set()
        offered_units = set()
        for offer in self.out_offers:
            if offer.accepted: continue
            new_offer = offer.amount * 0.98 # TODO what to set this at?
            est_future_rent = self.trend_ests[offer.unit.building.parcel.neighborhood]
            if est_future_rent > new_offer:
                offer.amount = new_offer
                new_offers.add(offer)
                offered_units.add(offer.unit)

        best_invest = max(self.invest_ests.keys(), key=lambda n: self.invest_ests[n])
        est_future_rent = self.trend_ests[best_invest]
        units = self.city.neighborhood_units(best_invest)
        for u in random.sample(units, min(len(units), sample_size)):
            if u.owner == self or u in offered_units: continue
            income = u.rent_per_area * sim.conf['pricing_horizon']
            income_est = est_future_rent * sim.conf['pricing_horizon']
            if income_est > income:
                offer = Offer(self, u, income)
                u.offers.add(offer)
                new_offers.add(offer)
        self.out_offers = new_offers


    def check_purchase_offers(self, sim):
        """Check purchase offers on units"""
        transfers = []
        for u in self.units:
            if not u.offers: continue

            neighb = u.building.parcel.neighborhood
            est_future_rent = self.trend_ests[neighb] * sim.conf['pricing_horizon']

            # Find best offer, if any
            # and mark offers as rejected or accepted
            best_offer = None
            for o in u.offers:
                if o.amount <= est_future_rent:
                    o.accepted = False
                else:
                    if best_offer is None:
                        best_offer = o
                        best_offer.accepted = True
                    else:
                        if o.amount > best_offer.amonut:
                            best_offer.accepted = False

                            best_offer = o
                            best_offer.accepted = True
            if best_offer is not None:
                transfers.append((u, best_offer.landlord))

        # Have to do this here
        # so we don't modify self.units
        # as we iterate
        for u, dev in transfers:
            u.setOwner(dev)

    def step(self, sim):
        # Update market estimates
        self.estimate_rents(sim.city)
        self.estimate_trends()

        # Update rents
        self.manage_vacant_units()
        self.manage_occupied_units(sim.time)

        # Buy/sells
        self.make_purchase_offers(sim)
        self.check_purchase_offers(sim)

    @property
    def vacant_units(self):
        return [u for u in self.units if u.vacant]

    @property
    def occupied_units(self):
        return [u for u in self.units if not u.vacant]

    def manage_vacant_units(self):
        """Lower rents on vacant units"""
        for u in self.vacant_units:
            u.monthsVacant += 1
            # TODO this can be smarter
            if u.monthsVacant % 2 == 0:
                u.rent *= 0.98

    def manage_occupied_units(self, month):
        # year-long leases
        for u in self.occupied_units:
            elapsed = month - u.leaseMonth
            if elapsed > 0 and elapsed % 12 == 0:
                # TODO this can be smarter
                # i.e. depend on gap b/w
                # current rent and rent estimate/projection
                u.rent *= 1.02

                # TODO cap rents so they don't go to infinity
                u.rent = min(u.rent, sys.maxsize)


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

    def desirability(self, unit, prefs):
        """Compute desirability of a housing unit
        for this tenant"""

        # Numer of tenants, were they to move in
        n_tenants = len(unit.tenants) + 1

        # Is this place affordable?
        rent_per_tenant = unit.rent/n_tenants
        if self.income < rent_per_tenant:
            return 0

        # Ratio of income to rent they'd pay
        ratio = self.income/rent_per_tenant

        # Space per tenant
        spaciousness = unit.area/n_tenants - prefs['min_area']

        return ratio * (spaciousness + unit.building.parcel.desirability)

    def step(self, sim):
        sample_size = 20

        # If currently w/o home,
        # will always look for a place to move into,
        # with no moving penalty
        if self.unit is None:
            reconsider = True
            current_desirability = -1
            moving_penalty = 0

        # Otherwise, only consider moving
        # between leases or if their current
        # place is no longer affordable
        # TODO the latter doesn't happen b/c
        # tenant income doesn't change, and
        # rents only change b/w leases
        else:
            # TODO should this be different for each tenant?
            moving_penalty = sim.conf['tenants']['moving_penalty']
            elapsed = sim.time - self.unit.leaseMonth
            reconsider = elapsed > 0 and elapsed % 12 == 0
            current_desirability = self.desirability(self.unit, sim.conf['tenants'])

        if reconsider:
            vacants = sim.city.units_with_vacancies()
            if vacants:
                samp_size = min(len(vacants), sample_size)
                units = random.sample(vacants, samp_size)
                vacancies = sorted(units, key=lambda u: self.desirability(u, sim.conf['tenants']), reverse=True)

                # Desirability of 0 means that tenant can't afford it
                des = self.desirability(vacancies[0], sim.conf['tenants'])
                if des - moving_penalty > current_desirability:
                    vacancies[0].move_in(self, sim.time)

        # If they own units,
        # check purchase offers
        transfers = []
        for u in self.units:
            if not u.offers: continue
            est_future_rent = u.rent * sim.conf['pricing_horizon']

            # Find best offer, if any
            # and mark offers as rejected or accepted
            best_offer = None
            for o in u.offers:
                if o.amount <= est_future_rent:
                    o.accepted = False
                else:
                    if best_offer is None:
                        best_offer = o
                        best_offer.accepted = True
                    else:
                        if o.amount > best_offer.amonut:
                            best_offer.accepted = False

                            best_offer = o
                            best_offer.accepted = True
            if best_offer is not None:
                transfers.append((u, best_offer.landlord))

        # Have to do this here
        # so we don't modify self.units
        # as we iterate
        for u, dev in transfers:
            u.setOwner(dev)
