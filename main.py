import config
import logging
from sim import Simulation

logging.basicConfig(level=logging.INFO)

if __name__ == '__main__':
    sim = Simulation(**config.SIM)
    sim.sync()
    while True:
        sim.step()
        sim.sync()
