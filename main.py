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
STEPS = os.environ.get('STEPS', None)
SEED = os.environ.get('SEED', random.randrange(sys.maxsize))
redis = redis.Redis(**config.REDIS)
logging.basicConfig(level=logging.INFO)

# Load design
design = redis.get('design:{}'.format(config.SIM['design_id']))
if design is None:
    raise Exception('Design with ID "{}" not found.'.format(config.SIM['design_id']))
design = json.loads(design.decode('utf8'))
config.SIM.update(design)

if __name__ == '__main__':
    random.seed(int(SEED))
    logger.info('Seed:{}'.format(SEED))

    sim = Simulation(**config.SIM)
    sim.sync()
    print('City of {} tenants, {} units, and {} capacity'.format(
        len(sim.tenants),
        len(sim.city.units),
        sum(u.occupancy for u in sim.city.units)))

    if DEBUG:
        history = [sim.stats()]

    def step():
        global sim
        cmds = get_commands()
        for typ, data in cmds:
            logger.info('CMD:{}'.format(typ.name))
            if typ is Command.RESTART:
                sim = Simulation(**data)
                sim.sync()

        sim.step()
        sim.sync()
        if DEBUG: history.append(sim.stats())


    try:
        if STEPS is not None:
            for _ in range(int(STEPS)):
                step()
        else:
            while True:
                step()
    except KeyboardInterrupt:
        if DEBUG:
            with open('history.json', 'w') as f:
                json.dump(history, f)
