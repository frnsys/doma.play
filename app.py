import json
import uuid
import redis
import config
from player import bp, prune_players
from flask import Flask, jsonify, request, redirect, url_for, render_template

app = Flask(__name__)
app.register_blueprint(bp)
redis = redis.Redis(**config.REDIS)

@app.route('/')
def city():
    """City view"""
    return render_template('city.html')

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


@app.route('/state/game')
def game_state():
    """Query current game state"""
    state = redis.get('game_state')
    if state: state = state.decode('utf8')
    return jsonify(state=state)


@app.route('/state/progress')
def game_progress():
    """Query current game state"""
    step = redis.get('game_step')
    if step:
        step = int(step.decode('utf8'))
    else:
        step = 0
    return jsonify(progress=step/config.N_STEPS, step=step)


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
