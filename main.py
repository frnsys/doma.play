import logging
from time import sleep
from sim import Simulation

logging.basicConfig(level=logging.INFO)


if __name__ == '__main__':
    sim = Simulation(size=(20, 20), neighborhoods=4, n_tenants=4000, n_developers=10, max_units=10)
    sim.sync()

    while True:
        sim.step()
        sim.sync()
        # sleep(1)
