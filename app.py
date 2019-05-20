import json
import uuid
import redis
import config
from datetime import datetime
from flask import Flask, jsonify, request, redirect, url_for, render_template

app = Flask(__name__)
redis = redis.Redis(**config.REDIS)


def active_players():
    return [r.decode('utf8') for r
            in redis.lrange('active_players', 0, -1)]

def prune_players():
    now = round(datetime.utcnow().timestamp())
    for id in active_players():
        last_ping = redis.get('player:{}'.format(id))

        if last_ping is None:
            redis.lrem('active_players', 0, id)
            continue

        last_ping = int(last_ping)
        if now - last_ping > config.PLAYER_TIMEOUT:
            redis.lrem('active_players', 0, id)
            continue


@app.route('/')
def city():
    """City view"""
    return render_template('city.html')


@app.route('/play')
def play():
    """Player view"""
    return render_template('play.html')


@app.route('/play/join', methods=['POST'])
def player_join():
    """Player joined"""
    id = request.get_json()['id']
    redis.lpush('active_players', id)
    redis.set('player:{}'.format(id), round(datetime.utcnow().timestamp()))
    return jsonify(success=True)


@app.route('/play/leave', methods=['POST'])
def player_leave():
    """Player left"""
    id = request.get_json()['id']
    redis.lrem('active_players', 0, id)
    return jsonify(success=True)


@app.route('/play/ping/<id>', methods=['POST'])
def player_ping(id):
    """Player check-ins, for timeouts"""
    redis.set('player:{}'.format(id), round(datetime.utcnow().timestamp()))
    return jsonify(success=True)


@app.route('/play/ready/<id>', methods=['POST'])
def player_ready(id):
    """Player ready for next turn"""
    redis.lpush('ready_players', id)
    return jsonify(success=True)


@app.route('/design', defaults={'id': None})
@app.route('/design/<id>', methods=['GET', 'POST'])
def design(id):
    """City designer view"""
    # Generate new design and id
    if id is None:
        id = uuid.uuid4().hex
        data = json.dumps({})
        redis.set('design:{}'.format(id), data)
        return redirect(url_for('design', id=id))

    # Save data
    if request.method == 'POST':
        data = request.get_json()
        redis.set('design:{}'.format(id), data)
        return jsonify(success=True)
    else:
        data = redis.get('design:{}'.format(id))
        if data is None:
            data = '{}'
        else:
            data = data.decode('utf8')

    return render_template('design.html', data=json.loads(data))


@app.route('/state')
def state():
    """Query current state"""
    state = json.loads(redis.get('state'))
    state['key'] = redis.get('state_key').decode('utf8')
    return jsonify(state)


@app.route('/state/key')
def state_key():
    """Query current state key"""
    return jsonify(key=redis.get('state_key').decode('utf8'))



if __name__ == '__main__':
    import atexit
    from apscheduler.schedulers.background import BackgroundScheduler

    # Prune inactive players regularly
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=prune_players, trigger='interval', seconds=60)
    scheduler.start()
    atexit.register(lambda: scheduler.shutdown())

    app.run(host='0.0.0.0', port=8000, debug=True)
