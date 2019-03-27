import math
import random
import logging
from .util import sync
from scipy.stats import truncnorm
from .city import City, Building, Unit, ParcelType
from .agent import Landlord, Tenant

logger = logging.getLogger('DOMA-SIM')


def get_truncated_normal(mean=0, sd=1, low=0, upp=10):
    return truncnorm(
        (low - mean) / sd, (upp - mean) / sd, loc=mean, scale=sd)


class Simulation:
    def __init__(self, size, neighborhoods, n_tenants, n_landlords, percent_filled=0.7):
        # Each tick is a month
        self._step = 0

        # Initialize city buildings
        self.city = City(size, neighborhoods, percent_filled)

        for p in self.city:
            if p is None or p.type != ParcelType.Residential: continue
            neighb = self.city.neighborhoods[p.neighborhood]
            n_units = random.randint(*neighb['units'])
            units = [
                Unit(
                    rent=random.randint(500, 6000) * math.sqrt(neighb['desirability']),
                    occupancy=random.randint(1, 5),
                    area=random.randint(150, 800)
                ) for _ in range(n_units)
            ]
            p.build(Building(units))

        # Initialize landlords
        self.landlords = [Landlord(self.city) for _ in range(n_landlords)]

        # Initialize tenants
        self.tenants = []
        for _ in range(n_tenants):
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
        sync(self.city, self.stats(), self._step)

    def step(self):
        logger.info('Step {}'.format(self._step))
        random.shuffle(self.landlords)
        for d in self.landlords:
            d.step(self._step, self.city)

        random.shuffle(self.tenants)
        for t in self.tenants:
            t.step(self._step, self.city)

        self._step += 1

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
