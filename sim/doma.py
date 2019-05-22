from collections import defaultdict

class DOMA:
    def __init__(self):
        self.funds = 0
        self.units = set()
        self.shares = defaultdict(int)

        self.p_reserves = 0.05
        self.p_expenses = 0.05

    def add_funds(self, tenant, amount):
        self.funds += amount
        self.shares[self.tenant.id] += amount

    def shares(self, tenant):
        return self.shares[tenant]/self.funds

    def revenue(self):
        return sum(u.rent for u in self.units if not u.vacant)

    @property
    def value(self):
        return self.funds + sum(u.value for u in self.units)
