import random
import logging
import numpy as np
import networkx as nx
from .util import sync
from .city import City
from .doma import DOMA
from .agent import Landlord, Tenant

logger = logging.getLogger('DOMA-SIM')



class Simulation:
    def __init__(self, map, neighborhoods, city, **conf):
        self.conf = conf

        self.players = {}

        # Each tick is a month
        self.time = 0

        # Initialize city
        self.city = City.from_map(map, neighborhoods, city)

        # Initialize DOMA
        self.doma = DOMA(self)

        # Initialize landlords
        self.landlords = [Landlord(self.city) for _ in range(city['landlords'])]

        # Initialize tenants
        self.tenants = []
        self.tenants_idx = {}
        n_tenants = city['population']
        incomes = city['incomes']
        income_weights = np.array([i['p'] for i in incomes])/sum(i['p'] for i in incomes)
        for _ in range(n_tenants):
            income_range = np.random.choice(incomes, p=income_weights)
            income = random.randint(income_range['low'], income_range['high'])
            tenant = Tenant(income)
            self.tenants.append(tenant)
            self.tenants_idx[tenant.id] = tenant

        # Distribute units to tenants
        # Set work locations
        random.shuffle(self.tenants)
        commercial = self.city.commercial_buildings
        commercial, commercial_weights = zip(*commercial)
        commercial_weights /= np.sum(commercial_weights)
        for t in self.tenants:
            month = random.randint(0, 11)

            work_building = np.random.choice(commercial, p=commercial_weights)
            t.work_building = work_building

            vacancies = self.city.units_with_vacancies()

            if vacancies:
                vacancies = sorted(vacancies, key=lambda u: t.desirability(u, self.conf['tenants']), reverse=True)

                # Desirability of 0 means that tenant can't afford it
                if t.desirability(vacancies[0], self.conf['tenants']) > 0:
                    vacancies[0].move_in(t, month)

        # Distribute ownership of units
        self.units_idx = {}
        for b in self.city.buildings:
            for u in b.units:
                u.setOwner(self.random_owner(u))
                self.units_idx[u.id] = u

        # Social network
        self.social_network = nx.Graph()
        for t in self.tenants:
            friends = random.sample(self.tenants, random.randint(2, 16))
            for f in friends:
                if t == f: continue
                self.social_network.add_edge(t, f)

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
            if t.player is not None:
                continue
            t.step(self, vacants)

        if self.time % 12 == 0:
            # Appraise
            for neighb, units in self.city.units_by_neighborhood().items():
                sold = [u for u in units if u.recently_sold]
                if not sold:
                    evaluated = [u for u in units if u.value is not None]
                    if not evaluated:
                        mean_value_per_area = None
                    else:
                        mean_value_per_area = sum((u.value/u.area) * self.conf['base_appreciation']
                                                for u in evaluated)/len(evaluated)
                else:
                    mean_value_per_area = sum(u.value/u.area for u in sold)/len(sold)

                # If nothing has sold, we have no sense of the value
                # likely just need more burn-in time
                if mean_value_per_area is None: continue

                for u in units:
                    if not u.recently_sold:
                        u.value = mean_value_per_area * u.area
                    u.recently_sold = False

        # DOMA step
        self.doma.step(self)

        # Check purchase offers
        market_history = []
        for e in self.landlords + self.tenants:
            market_history.extend(e.check_purchase_offers(self))

        self.time += 1
        return market_history

    def stats(self):
        units = self.city.units
        housed = [t for t in self.tenants if t.unit is not None]
        landlord_units = sum((list(l.units) for l in self.landlords), [])

        return {
            'percent_homeless': (len(self.tenants) - len(housed))/len(self.tenants),
            'percent_vacant': sum(1 for u in units if u.vacant)/len(units),
            'mean_rent_per_area': sum(u.rent_per_area for u in units)/len(units),
            'mean_adjusted_rent_per_area': sum(u.adjusted_rent_per_area for u in units)/len(units),
            'mean_months_vacant': sum(u.monthsVacant for u in units)/len(units),
            'mean_maintenance_costs': sum(u.maintenance/u.rent for u in units)/len(units),
            'mean_value_per_area': sum(u.value/u.area for u in units)/len(units),
            'mean_condition': sum(u.condition for u in units)/len(units),
            'unique_landlords': len(set(u.owner for u in units)),
            'mean_price_to_rent_ratio': sum(u.value/(u.rent*12) for u in units)/len(units),
            'doma_members': len(self.doma.members),
            'mean_value': sum(u.value for u in units)/len(units),
            'min_value': min(u.value for u in units),
            'mean_doma_rent_vs_market_rent': 0 if not landlord_units else np.mean([u.adjusted_rent_per_area for u in self.doma.units])/np.mean([u.adjusted_rent_per_area for u in landlord_units]),
            'doma_units': len(self.doma.units),
            'doma_property_fund': self.doma.property_fund,
            'doma_total_dividend_payout': self.doma.last_payout,
            'mean_offers': sum(len(u.offers) for u in units)/len(units),
            'n_units': len(units),
            'n_sales': sum(t.sales for t in self.landlords + self.tenants),
            'n_moved': sum(1 for t in self.tenants if t.moved),
            'mean_stay_length': 0 if not housed else sum(t.months_stayed for t in housed)/len(housed),
            'mean_rent_income_ratio': 0 if not housed else sum(t.unit.rent_per_tenant/t.income for t in housed)/len(housed),
            'incomes': {
                'min': min(t.income for t in self.tenants),
                'max': max(t.income for t in self.tenants),
                'mean': np.mean([t.income for t in self.tenants]),
                'median': np.median([t.income for t in self.tenants])
            },
            'landlords': {
                landlord.id: {
                    'n_units': len(landlord.units),
                    'mean_adjusted_rent_per_area': 0 if not landlord.units else sum(u.adjusted_rent_per_area for u in landlord.units)/len(landlord.units),
                    'mean_condition': 0 if not landlord.units else sum(u.condition for u in landlord.units)/len(landlord.units)
                } for landlord in self.landlords + [self.doma]
            },
            'neighborhoods': {
                neighb: {
                    'percent_vacant': sum(1 for u in units if u.vacant)/len(units),
                    'mean_rent_per_area': sum(u.rent_per_area for u in units)/len(units),
                    'mean_adjusted_rent_per_area': sum(u.adjusted_rent_per_area for u in units)/len(units),
                    'mean_months_vacant': sum(u.monthsVacant for u in units)/len(units),
                    'mean_maintenance_costs': sum(u.maintenance/u.rent for u in units)/len(units),
                    'mean_value_per_area': sum(u.value/u.area for u in units if u.value)/len(units),
                    'mean_condition': sum(u.condition for u in units)/len(units),
                    'mean_rent_income_ratio': sum(sum(u.rent_per_tenant/t.income for t in u.tenants) for u in units)/(sum(len(u.tenants) for u in units) or 1),
                } for neighb, units in self.city.units_by_neighborhood().items()
            }
        }
