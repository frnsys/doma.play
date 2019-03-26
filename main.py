import logging
from time import sleep
from sim import Simulation

logging.basicConfig(level=logging.INFO)


if __name__ == '__main__':
    sim = Simulation((20, 20), 4)
    sim.sync()

    while True:
        sim.step()
        sim.sync()
        sleep(1)
