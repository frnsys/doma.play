# All in seconds
MIN_STEP_DELAY = 60
PLAYER_TIMEOUT = 60
PLAYER_READY_TIMEOUT = 30

REDIS = {
    'host': 'localhost',
    'port': 6379,
    'db': 1
}

SIM = {
    'design_id': 'chicago',
    'pricing_horizon': 5 * 12,
    'tenants': {
        'moving_penalty': 10,
        'min_area': 50
    }
}
