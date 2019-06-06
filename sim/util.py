import json
import redis
import config
import hashlib
from enum import Enum
from collections import defaultdict

redis = redis.Redis(**config.REDIS)

class Command(Enum):
    RESTART = 0
    SELECT_TENANT = 1
    RELEASE_TENANT = 2
    MOVE_TENANT = 3
    DOMA_ADD = 4


def jsonify(city, time):
    buildings = {}
    units = {}
    parcels = defaultdict(dict)
    for p in city:
        parcels[p.pos[0]][p.pos[1]] = {
            'neighb': p.neighborhood,
            'type': p.type.name,
            'desirability': p.desirability
        }
        if p.building is not None:
            b = p.building
            buildings[b.id] = {
                'units': [u.id for u in b.units],
                'nCommercial': b.n_commercial
            }
            for u in b.units:
                units[u.id] = {
                    'id': u.id,
                    'rent': u.rent,
                    'tenants': [t.id for t in u.tenants],
                    'occupancy': u.occupancy,
                    'owner': {
                        'id': u.owner.id,
                        'type': type(u.owner).__name__
                    },
                    'monthsVacant': u.monthsVacant
                }
    return {
        'time': time,
        'map': {
            'rows': city.grid.rows,
            'cols': city.grid.cols,
            'parcels': parcels
        },
        'buildings': buildings,
        'units': units,
        'neighborhoods': city.neighborhoods
    }


def sync(city, stats, time):
    """Synchronize city's state to redis"""
    state = jsonify(city, time)
    state['stats'] = stats
    state_serialized = json.dumps(state)
    state_key = hashlib.md5(state_serialized.encode('utf8')).hexdigest()
    redis.set('state', state_serialized)
    redis.set('state_key', state_key)


def get_commands():
    cmds = [json.loads(r.decode('utf8')) for r
            in redis.lrange('cmds', 0, -1)]
    redis.delete('cmds')
    return [(Command(t), d) for t, d in cmds]


def send_command(type, data=None):
    data = (type.value, data)
    data = json.dumps(data)
    redis.lpush('cmds', data)
