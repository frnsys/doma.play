import json

REDIS = {
    'host': 'localhost',
    'port': 6379,
    'db': 1
}

SIM = {
    'design_id': 'chicago',
    'n_tenants': 4000,
    'n_landlords': 10,
    'pricing_horizon': 5 * 12,
    'tenants': {
        'moving_penalty': 10,
        'min_area': 50
    }
}
