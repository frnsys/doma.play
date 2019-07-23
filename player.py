import json
import redis
import config
import random
from datetime import datetime
from flask import Blueprint, render_template, request, jsonify

bp = Blueprint('player', __name__, url_prefix='/play')
redis = redis.Redis(**config.REDIS)

def send_command(cmd, data):
    redis.lpush('cmds', json.dumps({
        cmd: data
    }))


def active_players():
    return [r.decode('utf8') for r
            in redis.lrange('active_players', 0, -1)]

def remove_player(id):
    redis.lrem('active_players', 0, id)
    send_command('ReleaseTenant', id)
    active_tenants = json.loads(redis.get('active_tenants') or '{}')
    del active_tenants[id]
    redis.set('active_tenants', json.dumps(active_tenants))


def prune_players():
    now = round(datetime.utcnow().timestamp())
    for id in active_players():
        last_ping = redis.get('player:{}:ping'.format(id))

        if last_ping is None:
            remove_player(id)
            continue

        last_ping = int(last_ping)
        if now - last_ping > config.PLAYER_TIMEOUT:
            remove_player(id)
            continue


@bp.route('/')
def play():
    """Player view"""
    return render_template('play.html')


@bp.route('/join', methods=['POST'])
def player_join():
    """Player joined"""
    id = request.get_json()['id']
    redis.lpush('active_players', id)
    redis.set('player:{}:ping'.format(id), round(datetime.utcnow().timestamp()))

    # Get tenants
    tenants = [json.loads(r.decode('utf8')) for r
               in redis.lrange('tenants', 0, -1)]

    # Get tenants not claimed by players
    active_tenants = json.loads(redis.get('active_tenants') or '{}')
    available_tenants = [t for t in tenants if t['id'] not in active_tenants.values() and t['unit'] is not None]

    # Choose random tenant
    tenant = random.choice(available_tenants)
    tenant_id = tenant['id']
    active_tenants[id] = tenant_id
    redis.set('active_tenants', json.dumps(active_tenants))
    send_command('SelectTenant', [id, tenant_id])

    # Get current state
    state = json.loads(redis.get('state'))
    timer = redis.get('turn_timer').decode('utf8')
    return jsonify(success=True, time=state['time'], timer=timer, tenant=tenant)


@bp.route('/leave', methods=['POST'])
def player_leave():
    """Player left"""
    id = request.get_json()['id']
    remove_player(id)
    return jsonify(success=True)


@bp.route('/ping/<id>', methods=['POST'])
def player_ping(id):
    """Player check-ins, for timeouts"""
    player_ids = active_players()

    # Stale player
    if id not in player_ids:
        return jsonify(success=False)

    redis.set('player:{}:ping'.format(id), round(datetime.utcnow().timestamp()))
    return jsonify(success=True)


@bp.route('/ready/<id>', methods=['POST'])
def player_ready(id):
    """Player ready for next turn"""
    redis.lpush('ready_players', id)
    return jsonify(success=True)


@bp.route('/move/<id>', methods=['POST'])
def player_move(id):
    """Player move apartment"""
    unit_id = request.get_json()['id']

    # TODO what if two players choose the same unit?
    # May need to stagger turns
    send_command('MoveTenant', [id, unit_id])
    return jsonify(success=True)


@bp.route('/doma/<id>', methods=['POST'])
def player_doma(id):
    """Player contribute to DOMA"""
    amount = request.get_json()['amount']
    send_command('DOMAAdd', [id, amount])
    return jsonify(success=True)


@bp.route('/tenant/<id>')
def player_tenant(id):
    """Player tenant data"""
    res = redis.get('player:{}:tenant'.format(id))
    if res is None:
        return jsonify(success=False)

    # Get current state
    state = json.loads(redis.get('state'))

    # Get turn timer
    timer = redis.get('turn_timer').decode('utf8')
    return jsonify(success=True, tenant=json.loads(res.decode('utf8')), time=state['time'], timer=timer)


@bp.route('/players')
def players():
    player_ids = active_players()
    players = {}
    for id in player_ids:
        res = redis.get('player:{}:tenant'.format(id))
        if res is not None:
            res = json.loads(res.decode('utf8'))
        else:
            res = {}
        players[id] = res
    return jsonify(players=players)
