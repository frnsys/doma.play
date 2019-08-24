import math
import json
import yaml
import redis
import random
import config
from datetime import datetime
from collections import defaultdict

names = json.load(open('static/names.json'))['frequency']
script = yaml.load(open('static/script.yaml'))


class Manager:
    def __init__(self):
        self.scenes = script['scenes']
        for id, scene in self.scenes.items():
            scene['id'] = id

        self.checkpoints = script['checkpoints']
        self.r = redis.Redis(**config.REDIS)
        self.reset()

    def start_scene(self):
        return self.scenes['START']

    def send_command(self, cmd, data):
        self.r.lpush('cmds', json.dumps({
            cmd: data
        }))

    def set_player_val(self, id, key, val):
        if isinstance(val, dict):
            val = json.dumps(val)
        self.r.set('player:{}:{}'.format(id, key), val)

    def get_player_val(self, id, key):
        val = self.r.get('player:{}:{}'.format(id, key))
        if val is not None:
            return val.decode('utf8')
        return val

    def get_player_vals(self, key):
        return {
            id: self.get_player_val(id, key)
            for id in self.active_players()
        }

    def check_checkpoint(self):
        s = self.play_state()
        state_key = self.r.get('state_key').decode('utf8')
        ckpt_id = s['curr_ckpt']
        # print('CHECKING CHECKPOINT')
        # print(s['last_ckpt'], ckpt_id)
        if s['last_ckpt'] != ckpt_id and self.all_players_at_ckpt(ckpt_id):
            # print('All at ckpt')
            # print(s)
            s['started'] = True
            if not s['run_cmd_sent']:
                # print('===================')
                # print('===================')
                # print('===================')
                # print('SENDING RUN COMMAND')
                # print('===================')
                # print('===================')
                # print('===================')
                ckpt = self.checkpoints[ckpt_id]

                if ckpt_id == 'doma_param_vote':
                    votes = self.get_player_vals('ckpt:vote')
                    defaults = ckpt['defaults']
                    params = {
                        'p_dividend': [],
                        'p_rent_share': [],
                        'rent_income_limit': []
                    }
                    for k in params.keys():
                        params[k].append(defaults[k])

                    for v in votes.values():
                        v = json.loads(v)
                        for k in params.keys():
                            if k in v:
                                params[k].append(v[k])

                    # Tally votes as means
                    results = {}
                    for k in params.keys():
                        results[k] = sum(params[k])/len(params[k])

                    self.send_command('DOMAConfigure', [
                        results['p_dividend'],
                        results['p_rent_share'],
                        results['rent_income_limit']
                    ])
                    self.r.set('play:vote_outcomes', json.dumps(results))

                elif ckpt_id == 'policy_vote':
                    votes = self.get_player_vals('ckpt:policy')
                    results = defaultdict(int)
                    for v in votes.values():
                        results[v] += 1

                    months = [6, 12, 24, 48]
                    all_outcomes = {}
                    for p in ['RentFreeze', 'MarketTax']:
                        votes = results.get(p, 0)
                        if not votes: continue
                        wts = [
                            math.pow(votes, 1),
                            math.pow(votes/3, 2),
                            math.pow(votes/4, 3),
                            math.pow(votes/5, 4),
                        ]

                        choices = {}
                        total = sum(wts)
                        for r, wt in zip(months, wts):
                            choices[r] = wt/total
                        outcome = weighted_choice(choices)
                        print('POLICY VOTE:', p, outcome)
                        all_outcomes[p] = outcome
                        self.send_command(p, outcome)
                    self.r.set('play:policy_outcomes', json.dumps(all_outcomes))

                self.send_command('Run', ckpt['n_steps'])
                s['state_key'] = state_key
                s['run_cmd_sent'] = True
                print(self.queued_commands())

            # Check if sim done running
            elif s['state_key'] != state_key:
                # print('DONE RUNNING')
                s['last_ckpt'] = s['curr_ckpt']
                s['run_cmd_sent'] = False
                self.r.set('play:next_step', 1)
        self.r.set('play', json.dumps(s))

    def all_players_at_ckpt(self, ckpt):
        for id in self.active_players():
            print(id, self.get_player_val(id, 'ckpt'))
        return all(self.get_player_val(id, 'ckpt') == ckpt for id in self.active_players())

    def new_checkpoint(self, ckpt):
        s = self.play_state()
        return s['curr_ckpt'] != ckpt

    def next_step(self):
        return int(self.r.get('play:next_step')) == 1

    def game_ready(self):
        state = self.r.get('game_state')
        if state: state = state.decode('utf8')
        s = self.play_state()
        return state == 'ready' and not s['started']

    def play_state(self):
        return json.loads(self.r.get('play').decode('utf8'))

    def reset(self):
        default = {
            'last_ckpt': None,
            'curr_ckpt': None,
            'state_key': None,
            'started': False,
            'run_cmd_sent': False
        }
        self.r.set('play', json.dumps(default))
        self.r.set('play:next_step', 1)

        self.r.delete('active_players')
        self.r.delete('ready_players')
        self.r.delete('active_tenants')
        self.send_command('Reset', None)

    def active_players(self):
        return [r.decode('utf8') for r
                in self.r.lrange('active_players', 0, -1)]

    def queued_commands(self):
        return [r.decode('utf8') for r
                in self.r.lrange('cmds', 0, -1)]

    def remove_player(self, id):
        self.r.lrem('active_players', 0, id)
        self.send_command('ReleaseTenant', id)
        active_tenants = json.loads(self.r.get('active_tenants') or '{}')
        if id in active_tenants:
            del active_tenants[id]
        self.r.set('active_tenants', json.dumps(active_tenants))

    def prune_players(self):
        now = round(datetime.utcnow().timestamp())
        for id in self.active_players():
            last_ping = self.get_player_val(id, 'ping')

            if last_ping is None:
                self.remove_player(id)
                continue

            last_ping = int(last_ping)
            if now - last_ping > config.PLAYER_TIMEOUT:
                self.remove_player(id)
                continue

        if not self.active_players():
            s = json.loads(self.r.get('play').decode('utf8'))
            if s['started']: self.reset()

    def sim_state(self):
        return json.loads(self.r.get('state'))

    def get_tenant(self, id):
        res = self.get_player_val(id, 'tenant')
        if res is None:
            return None
        else:
            tenant = json.loads(res)
            res = self.get_player_val(id, 'tenant_meta')
            if res is not None:
                for k, v in json.loads(res).items():
                    tenant[k] = v
            return tenant

    def get_tenants(self):
        player_ids = self.active_players()
        players = {}
        for id in player_ids:
            tenant = self.get_tenant(id)
            if tenant is None:
                tenant = {}
            players[id] = tenant
        return players

    def add_player(self, id):
        self.r.lpush('active_players', id)
        self.set_player_val(id, 'ping', round(datetime.utcnow().timestamp()))

    def get_unclaimed_tenant(self, id):
        # Get tenants
        tenants = [json.loads(r.decode('utf8')) for r
                   in self.r.lrange('tenants', 0, -1)]

        # Get tenants not claimed by players
        active_tenants = json.loads(self.r.get('active_tenants') or '{}')
        available_tenants = [t for t in tenants if t['id'] not in active_tenants.values() and t['unit'] is not None]

        tenant = random.choice(available_tenants)
        tenant_id = tenant['id']
        active_tenants[id] = tenant_id
        self.r.set('active_tenants', json.dumps(active_tenants))
        self.send_command('SelectTenant', [id, tenant_id])
        tenant['name'] = weighted_choice(names)

        # This is totally arbitrary atm
        tenant['savings'] = random.random() * 0.25 * tenant['income'] * 12 * 5;

        self.set_player_val(id, 'tenant_meta', {
            'savings': tenant['savings'],
            'name': tenant['name']
        })

        return tenant

    def next_scene(self, player_id, scene_id, action_id):
        # Otherwise, get what the next
        # scene is for the specified action
        scene = self.scenes[scene_id]
        outcome = scene['actions'][action_id]
        next_scene_id = outcome.get('next')
        if not next_scene_id:
            self.reset()
            return None
        next_scene = self.scenes[next_scene_id]

        # Check if the next scene has a checkpoint id
        ckpt = next_scene.get('checkpoint')
        if ckpt:
            self.set_player_val(player_id, 'ckpt', ckpt)
            if self.new_checkpoint(ckpt):
                s = json.loads(self.r.get('play').decode('utf8'))
                s['curr_ckpt'] = ckpt
                self.r.set('play:next_step', 0)
                self.r.set('play', json.dumps(s))
                return None
            elif self.next_step():
                return next_scene
            else:
                return None
        return next_scene


def weighted_choice(choices):
    """Random selects a key from a dictionary,
    where each key's value is its probability weight."""
    # Randomly select a value between 0 and
    # the sum of all the weights.
    rand = random.uniform(0, sum(choices.values()))

    # Seek through the dict until a key is found
    # resulting in the random value.
    summ = 0.0
    for key, value in choices.items():
        summ += value
        if rand < summ: return key

    # If this returns False,
    # it's likely because the knowledge is empty.
    return False
