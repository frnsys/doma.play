import os
import sys
import json
import redis
import random
import config
import logging
from time import time
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


def all_players_ready():
    all_players_ready = False
    start = time()
    logger.info('Waiting for players...')
    while not all_players_ready and time() - start < config.PLAYER_READY_TIMEOUT:
        ready_players = [r.decode('utf8') for r
                         in redis.lrange('ready_players', 0, -1)]
        active_players = [r.decode('utf8') for r
                          in redis.lrange('active_players', 0, -1)]
        all_players_ready = all(id in ready_players for id in active_players)
    return True

def reset_ready_players():
    redis.delete('ready_players')


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
        output = {
            'meta': {
                'seed': SEED,
                'design': config.SIM['design_id'],
                'tenants': len(sim.tenants),
                'units': len(sim.city.units),
                'occupancy': sum(u.occupancy for u in sim.city.units)
            }
        }
        output['history'] = [sim.stats()]

    # Pool of tenants for players
    tenants = random.sample(sim.tenants, 100)
    redis.delete('tenants')
    redis.lpush('tenants', *[json.dumps({
        'id': t.id,
        'income': t.income,
        'work': t.work_building.parcel.pos
    }) for t in tenants])

    def step():
        global sim
        cmds = get_commands()
        for typ, data in cmds:
            logger.info('CMD:{}'.format(typ.name))
            if typ is Command.RESTART:
                sim = Simulation(**data)
                sim.sync()
            elif typ is Command.SELECT_TENANT:
                pid, tid = data['player_id'], data['tenant_id']
                sim.players[pid] = tid
                sim.tenants_idx[tid].player = pid
            elif typ is Command.RELEASE_TENANT:
                pid = data['player_id']
                tid = sim.players.get(pid)
                if tid is not None:
                    sim.tenants_idx[tid].player = None
                    del sim.players[pid]

        if DEBUG or all_players_ready():
            sim.step()
            sim.sync()
        if DEBUG: output['history'].append(sim.stats())
        reset_ready_players()


    try:
        if STEPS is not None:
            for _ in range(int(STEPS)):
                step()
        else:
            while True:
                step()
    except KeyboardInterrupt:
        pass

    if DEBUG:
        with open('output.json', 'w') as f:
            json.dump(output, f)
