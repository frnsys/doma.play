import json
from .manager import Manager
from datetime import datetime
from flask import Blueprint, render_template, request, jsonify

mgr = Manager()
bp = Blueprint('player', __name__, url_prefix='/play')


@bp.route('/')
def play():
    """Player view"""
    return render_template('play.html')

@bp.route('/ready')
def session_ready():
    return jsonify(success=mgr.is_ready())


@bp.route('/join', methods=['POST'])
def player_join():
    """Player joined"""
    id = request.get_json()['id']
    tenant = mgr.add_player(id)

    # Get current state
    state = mgr.sim_state()
    scene = mgr.start_scene()
    return jsonify(success=True, time=state['time'],
                   tenant=tenant, state=state, scene=scene)


@bp.route('/leave', methods=['POST'])
def player_leave():
    """Player left"""
    id = request.get_json()['id']
    mgr.remove_player(id)
    return jsonify(success=True)


@bp.route('/ping/<id>', methods=['POST'])
def player_ping(id):
    """Player check-ins, for timeouts"""
    # Stale player
    if not mgr.players.is_active(id):
        return jsonify(success=False)

    mgr.players[id, 'ping'] = round(datetime.utcnow().timestamp())
    return jsonify(success=True)


@bp.route('/move/<id>', methods=['POST'])
def player_move(id):
    """Player move apartment"""
    unit_id = request.get_json()['id']

    # TODO what if two players choose the same unit?
    # May need to stagger turns
    mgr.send_command('MoveTenant', [id, unit_id])
    return jsonify(success=True)


@bp.route('/doma/<id>', methods=['POST'])
def player_doma(id):
    """Player contribute to DOMA"""
    data = request.get_json()
    mgr.send_command('DOMAAdd', [id, data['amount']])
    mgr.send_command('DOMAPreach', [id, data['influence']])
    return jsonify(success=True)


@bp.route('/vote/<id>', methods=['POST'])
def player_vote(id):
    """Player DOMA parameter vote"""
    data = request.get_json()
    mgr.players[id, 'ckpt:vote'] = data
    return jsonify(success=True)


@bp.route('/vote/results')
def player_vote_results():
    """Player DOMA parameter vote results"""
    res = mgr.session['vote:results'] or '{}'
    res = json.loads(res)
    return jsonify(success=True, results=res)


@bp.route('/policy/<id>', methods=['POST'])
def player_policy(id):
    """Player DOMA policy vote"""
    data = request.get_json()
    mgr.players[id, 'ckpt:policy'] = data['policy']
    return jsonify(success=True)


@bp.route('/policy/results')
def player_policy_results():
    """Player DOMA policy vote results"""
    res = mgr.session['policy:results'] or '{}'
    res = json.loads(res)
    return jsonify(success=True, results=res)


@bp.route('/tenant/<id>')
def player_tenant(id):
    """Player tenant data"""
    tenant = mgr.tenant(id)
    if tenant is None:
        return jsonify(success=False)
    return jsonify(success=True, tenant=tenant)


@bp.route('/players')
def players():
    players = mgr.tenants()
    return jsonify(players=players)


@bp.route('/next_scene', methods=['POST'])
def next_scene():
    data = request.get_json()
    player_id = data['id']
    scene_id = data['scene_id']
    action_id = data['action_id']
    next_scene = mgr.next_scene(player_id, scene_id, action_id)
    ok = next_scene is not None
    return jsonify(scene=next_scene, ok=ok)
