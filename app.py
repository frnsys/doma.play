import json
import redis
from flask import Flask, jsonify, render_template

app = Flask(__name__)
redis = redis.Redis(host='localhost', port=6379, db=1)

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
    return jsonify(json.loads(redis.get('state')))

if __name__ == '__main__':
    app.run(port=5000, debug=True)