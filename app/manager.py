import json
import yaml
import redis
import random
import config
from datetime import datetime
from collections import defaultdict
from .util import weighted_choice, force_vote

names = json.load(open('static/names.json'))['frequency']
script = yaml.load(open('static/script.yaml'))
policies = ['RentFreeze', 'MarketTax']
policy_months = [6, 12, 24, 48]

TRUE = '1'
FALSE = '0'

class Session:
    def __init__(self, redis):
        self.r = redis

    def __getitem__(self, key):
        val = self.r.get('session:{}'.format(key))
        if val is not None:
            return val.decode('utf8')
        return val

    def __setitem__(self, key, val):
        if isinstance(val, dict):
            val = json.dumps(val)
        self.r.set('session:{}'.format(key), val)

    def reset(self):
        default = {
            'last_ckpt': '',
            'curr_ckpt': '',
            'state_key': '',
            'started': FALSE,
            'run_cmd_sent': FALSE,
            'next_step': FALSE,
            'tenants:active': {}
        }
        for k, v in default.items():
            self[k] = v


class PlayerManager:
    def __init__(self, redis):
        self.r = redis

    def __getitem__(self, key):
        id, key = key
        val = self.r.get('player:{}:{}'.format(id, key))
        if val is not None:
            return val.decode('utf8')
        return val

    def __setitem__(self, key, val):
        id, key = key
        if isinstance(val, dict):
            val = json.dumps(val)
        self.r.set('player:{}:{}'.format(id, key), val)

    def vals(self, key):
        return {id: self[id, key] for id in self.active()}

    def reset(self):
        self.r.delete('players:active')

    def add(self, id):
        self.r.lpush('players:active', id)
        self[id, 'ping'] = round(datetime.utcnow().timestamp())

    def remove(self, id):
        self.r.lrem('players:active', 0, id)

    def active(self):
        return [r.decode('utf8') for r
                in self.r.lrange('players:active', 0, -1)]

    def is_active(self, id):
        return id in self.active()

    def prune(self):
        now = round(datetime.utcnow().timestamp())
        for id in self.active():
            last_ping = self[id, 'ping']

            if last_ping is None:
                self.remove_player(id)
                continue

            last_ping = int(last_ping)
            if now - last_ping > config.PLAYER_TIMEOUT:
                self.remove_player(id)
                continue

    def all_at_ckpt(self, ckpt):
        # for id in self.active():
        #     print(id, self[id, 'ckpt'])
        return all(self[id, 'ckpt'] == ckpt for id in self.active())



class Manager:
    def __init__(self):
        self.scenes = script['scenes']
        for id, scene in self.scenes.items():
            scene['id'] = id
        self.checkpoints = script['checkpoints']

        self.r = redis.Redis(**config.REDIS)
        self.players = PlayerManager(self.r)
        self.session = Session(self.r)
        self.reset()

    def start_scene(self):
        return self.scenes['START']

    def sim_state(self):
        return json.loads(self.r.get('state'))

    def send_command(self, cmd, data):
        self.r.lpush('cmds', json.dumps({
            cmd: data
        }))

    def queued_commands(self):
        return [r.decode('utf8') for r
                in self.r.lrange('cmds', 0, -1)]

    def check_checkpoint(self):
        state_key = self.r.get('state:key').decode('utf8')

        # Check that current checkpoint now differs from the last one,
        # and wait for all players to reach it
        ckpt_id = self.session['curr_ckpt']
        if self.session['last_ckpt'] != ckpt_id and self.players.all_at_ckpt(ckpt_id):
            # First checkpoint indicates that the session is
            # now closed to new players
            self.session['started'] = TRUE

            # Ensure we haven't already submitted the run command
            # to the simulation
            if self.session['run_cmd_sent'] == FALSE:
                ckpt = self.checkpoints[ckpt_id]

                # TODO clean this up
                if ckpt_id == 'doma_param_vote':
                    # Tally votes as means
                    votes = [json.loads(v) for v in self.players.vals('ckpt:vote').values()]
                    tally = {k: [v] for k, v in ckpt['defaults'].items()}
                    for v in votes:
                        for k, val in v.items():
                            if k in tally: tally[k].append(val)
                    results = {k: sum(v)/len(v) for k, v in tally.items()}

                    self.send_command('DOMAConfigure', [
                        results['p_dividend'],
                        results['p_rent_share'],
                        results['rent_income_limit']
                    ])
                    self.session['vote:results'] = results

                elif ckpt_id == 'policy_vote':
                    votes = self.players.vals('ckpt:policy')
                    tally = defaultdict(int)
                    for v in votes.values():
                        tally[v] += 1

                    results = {}
                    for p in policies:
                        votes = tally.get(p, 0)
                        if not votes: continue
                        result = force_vote(votes, policy_months)
                        self.send_command(p, result)
                        results[p] = result
                    self.session['policy:results'] = results

                # Send the run command to the simulation
                self.send_command('Run', ckpt['n_steps'])

                # Track the state key so we can see when it changes,
                # letting us know that the run command has been executed
                self.session['state_key'] = state_key

                # Avoid sending multiple run commands at once
                self.session['run_cmd_sent'] = TRUE

                print(self.queued_commands())

            # Check if sim done running
            elif self.session['state_key'] != state_key:
                # print('DONE RUNNING')
                self.session['last_ckpt'] = self.session['curr_ckpt']
                self.session['run_cmd_sent'] = FALSE
                self.session['next_step'] = TRUE

    def is_new_checkpoint(self, ckpt):
        return self.session['curr_ckpt'] != ckpt

    def is_ready(self):
        status = self.r.get('status')
        return status == b'ready' and self.session['started'] == FALSE

    def reset(self):
        self.session.reset()
        self.players.reset()
        self.send_command('Reset', None)

    def add_player(self, id):
        self.players.add(id)
        return self.assign_tenant(id)

    def remove_player(self, id):
        self.players.remove(id)
        self.mgr.send_command('ReleaseTenant', id)
        active_tenants = json.loads(self.session['tenants:active'] or '{}')
        if id in active_tenants:
            del active_tenants[id]
        self.session['tenants:active'] = active_tenants

        if not self.players.active():
            self.reset()

    def prune_players(self):
        print('Pruning players...')
        self.players.prune()
        if not self.players.active():
            if self.session['started'] == TRUE: self.reset()

    def tenant(self, id):
        res = self.players[id, 'tenant']
        if res is None:
            return None
        else:
            tenant = json.loads(res)
            res = self.players[id, 'tenant:meta']
            if res is not None:
                meta = json.loads(res)
                tenant.update(meta)
            return tenant

    def tenants(self):
        return {
            id: self.tenant(id) or {}
            for id in self.players.active()
        }

    def assign_tenant(self, id):
        # Get tenants
        tenants = [json.loads(r.decode('utf8')) for r
                   in self.r.lrange('tenants', 0, -1)]

        # Get tenants not claimed by players
        active_tenants = json.loads(self.session['tenants:active'] or '{}')
        available_tenants = [t for t in tenants
                             if t['id'] not in active_tenants.values()
                             and t['unit']['id'] is not None]

        tenant = random.choice(available_tenants)
        active_tenants[id] = tenant['id']
        self.session['tenants:active'] = active_tenants

        self.send_command('SelectTenant', [id, tenant['id']])

        # This is totally arbitrary atm
        tenant.update({
            'name': weighted_choice(names),
            'savings': random.random() * 0.25 * tenant['income'] * 12 * 5
        })

        self.players[id, 'tenant:meta'] = {
            'savings': tenant['savings'],
            'name': tenant['name']
        }
        return tenant

    def next_scene(self, player_id, scene_id, action_id):
        # Otherwise, get what the next
        # scene is for the specified action
        scene = self.scenes[scene_id]
        outcome = scene['actions'][action_id]
        next_scene_id = outcome.get('next')

        # Ending
        if not next_scene_id:
            self.reset()
            return None

        # Check if the next scene has a checkpoint id
        next_scene = self.scenes[next_scene_id]
        ckpt = next_scene.get('checkpoint')
        if ckpt:
            self.players[player_id, 'ckpt'] = ckpt

            # Reached new checkpoint
            if self.is_new_checkpoint(ckpt):
                self.session['curr_ckpt'] = ckpt
                self.session['next_step'] = FALSE
                return None

            elif self.session['next_step'] == TRUE:
                return next_scene
            else:
                return None
        return next_scene
