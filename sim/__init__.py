import random
from .util import sync
from .city import City, Building, Unit
from .agent import Developer, Tenant


class Simulation:
    def __init__(self, size, neighborhoods):
        # Each tick is a month
        self._step = 0

        self.neighborhoods = list(range(neighborhoods))

        # Initialize city buildings
        self.city = City(size, self.neighborhoods)

        for p in self.city:
            if p is None: continue
            n_units = random.randint(1, 5)
            units = [
                Unit(
                    rent=random.randint(500, 6000),
                    occupancy=random.randint(1, 5),
                    area=random.randint(150, 800)
                ) for _ in range(n_units)
            ]
            p.build(Building(units))

        # Initialize developers
        self.developers = [Developer(self.city) for _ in range(10)]

        # Initialize tenants
        self.tenants = []
        for _ in range(100):
            # TODO better income distribution
            income = random.randint(500, 5000)
            tenant = Tenant(income)
            self.tenants.append(tenant)

        # Distribute units to tenants
        random.shuffle(self.tenants)
        for t in self.tenants:
            month = random.randint(0, 11)
            vacancies = self.city.vacant_units()
            vacancies = sorted(vacancies, key=lambda u: t.desirability(u), reverse=True)

            # Desirability of 0 means that tenant can't afford it
            if t.desirability(vacancies[0]) > 0:
                vacancies[0].move_in(t, month)

        # Distribute ownership of units
        for p in self.city:
            for u in p.building.units:
                u.setOwner(self.random_owner(u))

    def random_owner(self, unit):
        roll = random.random()
        if unit.tenants:
            if roll < 0.33:
                owner = random.choice(self.developers)
            elif roll < 0.66:
                owner = random.choice(self.tenants)
            else:
                owner = random.choice(list(unit.tenants))
        else:
            if roll < 0.5:
                owner = random.choice(self.developers)
            else:
                owner = random.choice(self.tenants)
        return owner

    def sync(self):
        sync(self.city, self._step)

    def step(self):
        random.shuffle(self.developers)
        for d in self.developers:
            d.step(self._step, self.city)

        random.shuffle(self.tenants)
        for t in self.tenants:
            t.step(self._step, self.city)

        self._step += 1

        # TODO/note: currently non-developer landlords
        # don't adjust rent
