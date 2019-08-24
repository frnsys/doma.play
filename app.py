import json
import uuid
import redis
import config
from app.player import bp
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


@app.route('/status')
def status():
    """Query current sim status"""
    status = redis.get('status')
    if status: status = status.decode('utf8')
    return jsonify(status=status)


@app.route('/state')
def state():
    """Query current state"""
    state = json.loads(redis.get('state'))
    state['key'] = redis.get('state_key').decode('utf8')
    return jsonify(state)


@app.route('/state/key')
def state_key():
    """Query current state key"""
    return jsonify(key=redis.get('state:key').decode('utf8'))



if __name__ == '__main__':
    import atexit
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.manager import Manager

    mgr = Manager()

    # Prune inactive players regularly
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=mgr.prune_players, trigger='interval', seconds=10)
    scheduler.add_job(func=mgr.check_checkpoint, trigger='interval', seconds=1)
    scheduler.start()
    atexit.register(lambda: scheduler.shutdown())

    app.run(host='0.0.0.0', port=8000, debug=True)
