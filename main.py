import os
import sys
import json
import redis
import random
import config
import logging
from sim import Simulation, logger
from sim.util import Command, get_commands

DEBUG = os.environ.get('DEBUG', False)
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

    if DEBUG:
        history = [sim.stats()]

    try:
        while True:
            cmds = get_commands()
            for typ, data in cmds:
                logger.info('CMD:{}'.format(typ.name))
                if typ is Command.RESTART:
                    sim = Simulation(**data)
                    sim.sync()

            sim.step()
            sim.sync()
            if DEBUG: history.append(sim.stats())
    except KeyboardInterrupt:
        if DEBUG:
            with open('history.json', 'w') as f:
                json.dump(history, f)
