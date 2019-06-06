import os
import sys
import json
import redis
import shutil
import random
import config
import logging
from plot import make_plots
from time import sleep, time
from datetime import datetime
from sim import Simulation, logger
from sim.util import Command, get_commands
from collections import defaultdict

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
    # start = time()
    logger.info('Waiting for players...')
    while not all_players_ready:# and time() - start < config.PLAYER_READY_TIMEOUT:
        ready_players = [r.decode('utf8') for r
                         in redis.lrange('ready_players', 0, -1)]
        active_players = [r.decode('utf8') for r
                          in redis.lrange('active_players', 0, -1)]
        print('Ready', len(ready_players), 'Active', len(active_players))
        all_players_ready = all(id in ready_players for id in active_players)
    return True

def reset_ready_players():
    redis.delete('ready_players')

def reset():
    redis.delete('cmds')
    redis.delete('active_players')
    reset_ready_players()


if __name__ == '__main__':
    dt = datetime.utcnow()
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
        output['market'] = []

    # Reset players and commands
    reset()

    # Pool of tenants for players
    tenants = random.sample(sim.tenants, 100)
    redis.delete('tenants')
    redis.lpush('tenants', *[json.dumps({
        'id': t.id,
        'income': t.income,
        'work': t.work_building.parcel.pos,
        'unit': t.unit.id if t.unit else None
    }) for t in tenants])

    def step():
        global sim
        if DEBUG or all_players_ready():
            cmds = get_commands()
            player_actions = defaultdict(lambda: defaultdict(list))
            for typ, data in cmds:
                logger.info('CMD:{}'.format(typ.name))
                if typ is Command.RESTART:
                    sim = Simulation(**data)
                    sim.sync()
                elif typ is Command.SELECT_TENANT:
                    pid, tid = data['player_id'], data['tenant_id']
                    sim.players[pid] = tid
                    tenant = sim.tenants_idx[tid]
                    tenant.player = pid
                    # Evicted
                    if tenant.unit:
                        tenant.unit.move_out(tenant)
                elif typ is Command.RELEASE_TENANT:
                    pid = data['player_id']
                    tid = sim.players.get(pid)
                    if tid is not None:
                        sim.tenants_idx[tid].player = None
                        del sim.players[pid]
                else:
                    pid = data['player_id']
                    player_actions[pid][typ].append(data)

            # Process player actions
            for pid, cmds in player_actions.items():
                tid = sim.players[pid]
                tenant = sim.tenants_idx[tid]
                for cmd, datas in cmds.items():
                    if cmd is Command.MOVE_TENANT:
                        # Last move is actual move
                        unit_id = datas[-1]['unit_id']
                        sim.units_idx[unit_id].move_in(tenant, sim.time+1)
                    elif cmd is Command.DOMA_ADD:
                        amount = sum(d['amount'] for d in datas)
                        sim.doma.add_funds(tenant, amount)

            market_history = sim.step()
            sim.sync()

            # Synchronize player tenants
            for pid, tid in sim.players.items():
                t = sim.tenants_idx[tid]
                redis.set('player:{}:tenant'.format(pid), json.dumps({
                    'id': t.id,
                    'income': t.income,
                    'monthlyDisposableIncome': (t.income/12) - (t.unit.rent_per_tenant if t.unit else 0),
                    'work': t.work_building.parcel.pos,
                    'unit': {
                        'id': t.unit.id,
                        'condition': t.unit.condition,
                        'pos': t.unit.building.parcel.pos
                    } if t.unit else None
                }))

        reset_ready_players()
        if DEBUG:
            output['history'].append(sim.stats())
            output['market'].append(market_history)

        if not DEBUG:
            start = time()
            end = start + config.MIN_STEP_DELAY
            redis.set('turn_timer', '{}-{}'.format(start, end))
            sleep(config.MIN_STEP_DELAY)

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
        output_id = '{}_{}'.format(dt.strftime('%d.%m.%Y.%H.%M'), SEED)
        output_dir = 'runs/{}'.format(output_id)
        os.mkdir(output_dir)

        with open(os.path.join(output_dir, 'config.json'), 'w') as f:
            json.dump(config.SIM, f)
        with open(os.path.join(output_dir, 'output.json'), 'w') as f:
            json.dump(output, f)

        # Copy code for this run too
        shutil.copytree('sim', os.path.join(output_dir, 'code'))

        make_plots(output_dir)

        os.remove('runs/latest')
        os.symlink(output_id, 'runs/latest')
        print(output_dir)
