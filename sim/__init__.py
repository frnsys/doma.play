import random
import logging
import numpy as np
from .util import sync
from .city import City
from .agent import Landlord, Tenant

logger = logging.getLogger('DOMA-SIM')



class Simulation:
    def __init__(self, map, neighborhoods, city, **conf):
        self.conf = conf

        # Each tick is a month
        self.time = 0

        # Initialize city
        self.city = City.from_map(map, neighborhoods, city)

        # Initialize landlords
        self.landlords = [Landlord(self.city) for _ in range(city['landlords'])]

        # Initialize tenants
        self.tenants = []
        n_tenants = city['population']
        incomes = city['incomes']
        income_weights = np.array([i['p'] for i in incomes])/sum(i['p'] for i in incomes)
        for _ in range(n_tenants):
            income_range = np.random.choice(incomes, p=income_weights)
            income = random.randint(income_range['low'], income_range['high'])
            tenant = Tenant(income)
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
        for b in self.city.buildings:
            for u in b.units:
                u.collect_rent()

        random.shuffle(self.landlords)
        for d in self.landlords:
            d.step(self)

        vacants = set(self.city.units_with_vacancies())
        random.shuffle(self.tenants)
        for t in self.tenants:
            t.step(self, vacants)

        self.time += 1

        # TODO/note: currently non-developer landlords
        # don't adjust rent

    def stats(self):
        units = self.city.units
        housed = [t for t in self.tenants if t.unit is not None]

        return {
            'percent_homeless': (len(self.tenants) - len(housed))/len(self.tenants),
            'percent_vacant': sum(1 for u in units if u.vacant)/len(units),
            'mean_rent_per_area': sum(u.rent_per_area for u in units)/len(units),
            'mean_months_vacant': sum(u.monthsVacant for u in units)/len(units),
            'mean_maintenance_costs': sum(u.maintenance/u.rent for u in units)/len(units),
            'mean_condition': sum(u.condition for u in units)/len(units),
            'unique_landlords': len(set(u.owner for u in units)),
            'mean_offers': sum(len(u.offers) for u in units)/len(units),
            'n_sales': sum(t.sales for t in self.landlords + self.tenants),
            'n_moved': sum(1 for t in self.tenants if t.moved),
            'mean_stay_length': 0 if not housed else sum(t.months_stayed for t in housed)/len(housed),
            'neighborhoods': {
                neighb: {
                    'percent_vacant': sum(1 for u in units if u.vacant)/len(units),
                    'mean_rent_per_area': sum(u.rent_per_area for u in units)/len(units),
                    'mean_months_vacant': sum(u.monthsVacant for u in units)/len(units),
                    'mean_maintenance_costs': sum(u.maintenance/u.rent for u in units)/len(units),
                    'mean_condition': sum(u.condition for u in units)/len(units),
                } for neighb, units in self.city.units_by_neighborhood().items()
            }
        }
