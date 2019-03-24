import json
import redis
import config
from flask import Flask, jsonify, render_template

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
    app.run(port=5000, debug=True)
