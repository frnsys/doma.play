import config
import logging
from sim import Simulation, logger
from sim.util import get_commands

logging.basicConfig(level=logging.INFO)

if __name__ == '__main__':
    sim = Simulation(**config.SIM)
    sim.sync()

    while True:
        cmds = get_commands()
        for cmd in cmds:
            logger.info('CMD:{}'.format(cmd['cmd']))
            if cmd['cmd'] == 'RESTART':
                config = cmd['data']
                sim = Simulation(**config)
                sim.sync()

        sim.step()
        sim.sync()
