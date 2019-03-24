import json
import redis
import config
import hashlib
from collections import defaultdict

redis = redis.Redis(**config.REDIS)


def jsonify(city, time):
    buildings = {}
    units = {}
    parcels = defaultdict(dict)
    for p in city:
        b = p.building
        parcels[p.pos[0]][p.pos[1]] = {
            'neighb': p.neighborhood
        }
        buildings[b.id] = {
            'units': [u.id for u in b.units]
        }
        for u in b.units:
            units[u.id] = {
                'id': u.id,
                'rent': u.rent,
                'area': u.area,
                'tenants': [t.id for t in u.tenants],
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
        'units': units
    }


def sync(city, time):
    """Synchronize city's state to redis"""
    # TODO look into more compact serializations?
    state = jsonify(city, time)
    state_serialized = json.dumps(state)
    state_key = hashlib.md5(state_serialized.encode('utf8')).hexdigest()
    redis.set('state', state_serialized)
    redis.set('state_key', state_key)
