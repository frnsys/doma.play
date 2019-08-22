from datetime import datetime
from manager import Manager
from flask import Blueprint, render_template, request, jsonify

mgr = Manager()
bp = Blueprint('player', __name__, url_prefix='/play')


@bp.route('/')
def play():
    """Player view"""
    return render_template('play.html')

@bp.route('/ready')
def game_ready():
    return jsonify(success=mgr.game_ready())

@bp.route('/join', methods=['POST'])
def player_join():
    """Player joined"""
    id = request.get_json()['id']
    mgr.add_player(id)
    tenant = mgr.get_unclaimed_tenant(id)

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
    if not mgr.active_players():
        mgr.reset()
    return jsonify(success=True)


@bp.route('/ping/<id>', methods=['POST'])
def player_ping(id):
    """Player check-ins, for timeouts"""
    player_ids = mgr.active_players()

    # Stale player
    if id not in player_ids:
        return jsonify(success=False)

    mgr.set_player_val(id, 'ping', round(datetime.utcnow().timestamp()))
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
    amount = request.get_json()['amount']
    mgr.send_command('DOMAAdd', [id, amount])
    return jsonify(success=True)


@bp.route('/tenant/<id>')
def player_tenant(id):
    """Player tenant data"""
    tenant = mgr.get_tenant(id)
    if tenant is None:
        return jsonify(success=False)

    # Get current state
    state = mgr.sim_state()
    return jsonify(success=True, tenant=tenant,
                   time=state['time'])


@bp.route('/players')
def players():
    players = mgr.get_tenants()
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
