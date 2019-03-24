import json
import redis
from flask import Flask, jsonify

app = Flask(__name__)
redis = redis.Redis(host='localhost', port=6379, db=1)

@app.route('/state')
def state():
    """Query current state"""
    return jsonify(json.loads(redis.get('state')))

@app.route('/tick')
def tick():
    """Tick simulation forward one step"""

if __name__ == '__main__':
    app.run(port=5000, debug=True)
