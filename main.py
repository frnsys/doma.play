import sys
import json
import redis
import random
import config
import logging
from sim import Simulation, logger
from sim.util import Command, get_commands

redis = redis.Redis(**config.REDIS)
logging.basicConfig(level=logging.INFO)

# Load design
design = redis.get('design:{}'.format(config.SIM['design_id']))
if design is None:
    raise Exception('Design with ID "{}" not found.'.format(config.SIM['design_id']))
design = json.loads(design.decode('utf8'))
config.SIM.update(design)

if __name__ == '__main__':
    seed = random.randrange(sys.maxsize)
    random.seed(seed)
    logger.info('Seed:{}'.format(seed))

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
