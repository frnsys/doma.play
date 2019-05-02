import json
import uuid
import redis
import config
from flask import Flask, jsonify, request, redirect, url_for, abort, render_template

app = Flask(__name__)
redis = redis.Redis(**config.REDIS)


@app.route('/')
def city():
    """City view"""
    return render_template('city.html')


@app.route('/play')
def play():
    """Player view"""
    return render_template('play.html')


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
        data = json.dumps(data)
        redis.set('design:{}'.format(id), data)
    else:
        data = redis.get('design:{}'.format(id))
        if data is None: abort(404)
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
    app.run(host='0.0.0.0', port=8000, debug=True)
