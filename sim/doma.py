import random
import numpy as np
from .agent import Offer
from collections import defaultdict, deque
from sklearn.linear_model import LinearRegression

class DOMA:
    def __init__(self, sim):
        self.id = 'DOMA'
        self.sim = sim
        self.funds = 0
        self.units = set()
        self._shares = defaultdict(int)
        self._shares_denom = 0

        self.last_payout = 0
        self.last_revenue = 0
        self.property_fund = sim.conf['doma_initial_fund']
        self.p_reserves = 0.05
        self.p_expenses = 0.05

        self.price_trends = {neighb_id: deque([], maxlen=24) for neighb_id in sim.city.neighborhoods.keys()}
        self.last_trends = None

    def add_funds(self, tenant, amount, p=1.0):
        self.funds += amount
        if p > 0:
            self._shares[tenant.id] += amount * p
            self._shares_denom = sum(self._shares.values())

    def add_contribution(self, tenant, amount):
        """Direct contribution, all goes to property fund"""
        self.add_funds(tenant, amount)
        self.property_fund += amount

    def collect_rent(self, tenants):
        """Collect rent"""
        # Collect rent and distribute maintenance
        rent = 0
        if self.units:
            if self.last_revenue == 0:
                maintenance_per_rent = 0.1 # default
            else:
                maintenance_per_rent = (self.last_revenue*self.p_expenses)/self.last_revenue
            for u in self.units:
                u.maintenance = maintenance_per_rent * u.rent_per_area
                if u.vacant: continue
                rent += u.rent
                rent_per_tenant = rent/len(u.tenants)
                for t in u.tenants:
                    # Distribute rent shares equally
                    self.add_funds(t, rent_per_tenant, p=self.sim.conf['doma_rent_share'])

        self.last_revenue = rent
        return rent

    def pay_dividends(self, rent, tenants):
        # Pay out dividends
        p_dividend = 1.0 - self.p_reserves - self.p_expenses
        dividends = rent * p_dividend
        self.last_payout = dividends
        for t in tenants:
            share = self.shares(t)
            if not share: continue
            t.doma_dividends += dividends * share
        self.property_fund += rent * self.p_reserves

    def make_offers(self, sim, neighb_trends):
        # Purchase properties
        # Get non-DOMA properties of DOMA tenants
        candidates = set(sim.tenants_idx[t_id].unit for t_id in self.members)
        candidates = [u for u in candidates if u is not None and u.owner != self]

        # Otherwise, consider all properties
        if not candidates:
            candidates = [u for u in sim.city.units if u.owner != self]

        # Filter to affordable
        candidates = [u for u in candidates if u.value <= self.property_fund]

        # Try to buy dips
        # if self.last_trends is not None:
        #     trend_changes = {}
        #     for neighb_id, trend in self.last_trends.items():
        #         # Bottoming out
        #         trend_changes[neighb_id] = trend < 0 and neighb_trends[neighb_id] > 0
        #     candidates = [u for u in candidates if trend_changes[u.building.parcel.neighborhood]]

        # Prioritize cheap properties with high rent-to-price ratios
        candidates = sorted(candidates, key=lambda u: u.value * (u.value/u.rent) if u.rent else 0)
        # candidates = sorted(candidates, key=lambda u: u.rent/u.value, reverse=True)
        # candidates = sorted(candidates, key=lambda u: u.value)
        committed = 0
        offers = []
        for u in candidates:
            if committed + u.value >= self.property_fund: break
            committed += u.value
            offer = Offer(self, u, u.value)
            u.offers.add(offer)
            offers.append(offers)
        return offers


    def shares(self, tenant):
        if self._shares_denom is 0:
            return 0
        return self._shares[tenant.id]/self._shares_denom

    def revenue(self):
        return sum(u.rent for u in self.units if not u.vacant)

    @property
    def value(self):
        return self.funds + sum(u.value for u in self.units)

    @property
    def members(self):
        return [k for k, v in self._shares.items() if v > 0]

    def step(self, sim):
        rent = self.collect_rent(sim.tenants)
        self.pay_dividends(rent, sim.tenants)

        # Maintain properties
        for u in self.units:
            u.condition -= random.random() * 0.1 # TODO deterioration rate based on build year?
            u.condition += u.maintenance
            u.condition = min(max(u.condition, 0), 1)

        # Update trends
        neighb_trends = {}
        for neighb_id, units in sim.city.neighborhoods_with_units().items():
            mean_value_per_area = sum(u.value/u.area for u in units if u.value)/len(units)
            self.price_trends[neighb_id].append(mean_value_per_area)
            m = LinearRegression()

            if len(self.price_trends[neighb_id]) > 5:
                X = list(range(len(self.price_trends[neighb_id])))
                m.fit(np.array(X).reshape(-1, 1), self.price_trends[neighb_id])
                neighb_trends[neighb_id] = m.coef_[0]
            else:
                neighb_trends[neighb_id] = 0


        # Check offers
        transfers = []
        # mean_value = sum(u.value for u in sim.city.units)/len(sim.city.units)
        for u in self.units:
            # Only consider after 5 years of ownership
            if not u.offers or (sim.time - u.sold_on) < sim.conf['doma_min_hold_time']: continue
            best_offer = max(u.offers, key=lambda o: o.amount)
            if best_offer.amount > u.value:
                percent_of_value = best_offer.amount/u.value
                percent_of_purchase = best_offer.amount/u.sold_for
                trend = neighb_trends[u.building.parcel.neighborhood]

                # Sell if above last appraised value, at least 200% return, and
                # the price trend of that neighborhood is downward
                if percent_of_value > 1 and percent_of_purchase > 2 and trend < 0:
                    # TODO does all the money go to the property fund,
                    # or is it split up like other income?
                    self.property_fund += best_offer.amount
                    u.recently_sold = True
                    u.value = best_offer.amount
                    u.sold_on = sim.time
                    u.sold_for = best_offer.amount
                    transfers.append((u, best_offer.landlord))
                # print('OFFER', best_offer.amount, 'VALUE', u.value, 'PERCENT', best_offer.amount/u.value, 'PERCENTGROW', best_offer.amount/u.sold_for, 'TOMEAN', best_offer.amount/mean_value)

        for u, dev in transfers:
            u.setOwner(dev)

        self.make_offers(sim, neighb_trends)
        self.last_trends = neighb_trends
