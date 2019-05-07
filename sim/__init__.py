import random
import logging
import numpy as np
from .util import sync
from .city import City
from .agent import Landlord, Tenant

logger = logging.getLogger('DOMA-SIM')



class Simulation:
    def __init__(self, map, neighborhoods, n_tenants, n_landlords, **conf):
        self.conf = conf

        # Each tick is a month
        self.time = 0

        # Initialize city
        self.city = City.from_map(map, neighborhoods)

        # Initialize landlords
        self.landlords = [Landlord(self.city) for _ in range(n_landlords)]

        # Initialize tenants
        self.tenants = []
        for _ in range(n_tenants):
            income = max(0, np.random.normal(conf['income']['mean'], conf['income']['std']))
            tenant = Tenant(income/12)
            self.tenants.append(tenant)

        # Distribute units to tenants
        random.shuffle(self.tenants)
        for t in self.tenants:
            month = random.randint(0, 11)
            vacancies = self.city.units_with_vacancies()

            if vacancies:
                vacancies = sorted(vacancies, key=lambda u: t.desirability(u, self.conf['tenants']), reverse=True)

                # Desirability of 0 means that tenant can't afford it
                if t.desirability(vacancies[0], self.conf['tenants']) > 0:
                    vacancies[0].move_in(t, month)

        # Distribute ownership of units
        for b in self.city.buildings:
            for u in b.units:
                u.setOwner(self.random_owner(u))

    def random_owner(self, unit):
        roll = random.random()
        if unit.tenants:
            if roll < 0.33:
                owner = random.choice(self.landlords)
            elif roll < 0.66:
                owner = random.choice(self.tenants)
            else:
                owner = random.choice(list(unit.tenants))
        else:
            if roll < 0.5:
                owner = random.choice(self.landlords)
            else:
                owner = random.choice(self.tenants)
        return owner

    def sync(self):
        sync(self.city, self.stats(), self.time)

    def step(self):
        logger.info('Step {}'.format(self.time))
        random.shuffle(self.landlords)
        for d in self.landlords:
            d.step(self)

        random.shuffle(self.tenants)
        for t in self.tenants:
            t.step(self)

        self.time += 1

        # TODO/note: currently non-developer landlords
        # don't adjust rent

    def stats(self):
        units = self.city.units
        return {
            'percent_homeless': sum(1 for t in self.tenants if t.unit is None)/len(self.tenants),
            'percent_vacant': sum(1 for u in units if u.vacant)/len(units),
            'mean_rent_per_area': sum(u.rent_per_area for u in units)/len(units),
            'mean_months_vacant': sum(u.monthsVacant for u in units)/len(units)
        }
