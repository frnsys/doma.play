import logging
from time import sleep
from sim import Simulation

logging.basicConfig(level=logging.INFO)


if __name__ == '__main__':
    neighborhoods = [{
        'desirability': 5,
        'units': (4,10),
        'commercial': 0.1,
        'park': 0.1
    }, {
        'desirability': 8,
        'units': (1,2),
        'commercial': 0.2,
        'park': 0.2
    }, {
        'desirability': 1,
        'units': (1,2),
        'commercial': 0.1,
        'park': 0
    }, {
        'desirability': 2,
        'units': (2,5),
        'commercial': 0,
        'park': 0
    }]
    sim = Simulation(size=(20, 20), neighborhoods=neighborhoods, n_tenants=4000, n_developers=10, max_units=10)
    sim.sync()

    while True:
        sim.step()
        sim.sync()
        # sleep(1)
