import random
from .agent import Offer
from collections import defaultdict

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

    def make_offers(self, sim):
        # Purchase properties
        # Get non-DOMA properties of DOMA tenants
        candidates = set(sim.tenants_idx[t_id].unit for t_id in self.members)
        candidates = [u for u in candidates if u is not None and u.owner != self]

        # Otherwise, consider all properties
        if not candidates:
            candidates = [u for u in sim.city.units if u.owner != self]

        # Filter to affordable
        candidates = [u for u in candidates if u.value <= self.property_fund]

        # Prioritize cheap properties with high rent-to-price ratios
        candidates = sorted(candidates, key=lambda u: u.value * (u.value/u.rent))
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
        self.make_offers(sim)

        # Maintain properties
        for u in self.units:
            u.condition -= random.random() * 0.1 # TODO deterioration rate based on build year?
            u.condition += u.maintenance
            u.condition = min(max(u.condition, 0), 1)
