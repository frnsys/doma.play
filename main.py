import config
import logging
from sim import Simulation, logger
from sim.util import Command, get_commands

logging.basicConfig(level=logging.INFO)

if __name__ == '__main__':
    sim = Simulation(**config.SIM)
    sim.sync()

    while True:
        cmds = get_commands()
        for typ, data in cmds:
            logger.info('CMD:{}'.format(typ.name))
            if typ is Command.RESTART:
                sim = Simulation(**data)
                sim.sync()

        sim.step()
        sim.sync()
