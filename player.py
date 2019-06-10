import json
import redis
import config
import random
from datetime import datetime
from sim.util import Command, send_command
from flask import Blueprint, render_template, request, jsonify

bp = Blueprint('player', __name__, url_prefix='/play')
redis = redis.Redis(**config.REDIS)


def active_players():
    return [r.decode('utf8') for r
            in redis.lrange('active_players', 0, -1)]

def remove_player(id):
    redis.lrem('active_players', 0, id)
    send_command(Command.RELEASE_TENANT, {
        'player_id': id
    })

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

    tenants = random.sample(tenants, 5)
    return jsonify(success=True, tenants=tenants)


@bp.route('/select/<id>', methods=['POST'])
def player_select(id):
    """Player select tenant"""
    tenant_id = request.get_json()['id']
    send_command(Command.SELECT_TENANT, {
        'tenant_id': tenant_id,
        'player_id': id
    })

    # Get current state
    state = json.loads(redis.get('state'))

    # Get turn timer
    timer = redis.get('turn_timer').decode('utf8')
    return jsonify(success=True, time=state['time'], timer=timer)


@bp.route('/leave', methods=['POST'])
def player_leave():
    """Player left"""
    id = request.get_json()['id']
    remove_player(id)
    return jsonify(success=True)


@bp.route('/ping/<id>', methods=['POST'])
def player_ping(id):
    """Player check-ins, for timeouts"""
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
    send_command(Command.MOVE_TENANT, {
        'player_id': id,
        'unit_id': unit_id
    })
    return jsonify(success=True)


@bp.route('/doma/<id>', methods=['POST'])
def player_doma(id):
    """Player contribute to DOMA"""
    amount = request.get_json()['amount']
    send_command(Command.DOMA_ADD, {
        'player_id': id,
        'amount': amount
    })
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
    return jsonify(players=active_players())
