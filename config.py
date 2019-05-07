import json

REDIS = {
    'host': 'localhost',
    'port': 6379,
    'db': 1
}

# Load map exported from designer
city = json.load(open('city.json'))

SIM = {
    'map': city['map'],
    'neighborhoods': city['neighborhoods'],
    'n_tenants': 4000,
    'n_landlords': 10,
    'pricing_horizon': 5 * 12,
    'tenants': {
        'moving_penalty': 10,
        'min_area': 50
    },
    'income': {
        'mean': 35947,
        'std': 44038
    }
}
