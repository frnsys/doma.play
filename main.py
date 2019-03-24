import random
from time import sleep
from sim import City, Building, Unit, Developer, Tenant
from sim.util import sync


if __name__ == '__main__':
    neighborhoods = list(range(4))

    # Initialize city buildings
    city = City((20, 20), neighborhoods)
    for p in city:
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
    developers = [Developer(city) for _ in range(10)]

    # Initialize tenants
    tenants = []
    for _ in range(100):
        # TODO better income distribution
        income = random.randint(500, 5000)
        tenant = Tenant(income)
        tenants.append(tenant)

    # Distribute units to tenants
    random.shuffle(tenants)
    for t in tenants:
        month = random.randint(0, 11)
        vacancies = city.vacant_units()
        vacancies = sorted(vacancies, key=lambda u: t.desirability(u), reverse=True)

        # Desirability of 0 means that tenant can't afford it
        if t.desirability(vacancies[0]) > 0:
            vacancies[0].move_in(t, month)

    # Distribute ownership of units
    def random_owner(unit):
        roll = random.random()
        if unit.tenants:
            if roll < 0.33:
                owner = random.choice(developers)
            elif roll < 0.66:
                owner = random.choice(tenants)
            else:
                owner = random.choice(list(unit.tenants))
        else:
            if roll < 0.5:
                owner = random.choice(developers)
            else:
                owner = random.choice(tenants)
        return owner
    for p in city:
        for u in p.building.units:
            u.setOwner(random_owner(u))


    sync(city, 0)

    # Each tick is a month
    i = 0
    while True:
        print('Step', i)
        random.shuffle(developers)
        for d in developers:
            d.step(i, city)

        random.shuffle(tenants)
        for t in tenants:
            t.step(i, city)

        sync(city, i)
        i += 1
        sleep(1)

    # TODO/note: currently non-developer landlords
    # don't adjust rent
