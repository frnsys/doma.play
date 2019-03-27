REDIS = {
    'host': 'localhost',
    'port': 6379,
    'db': 1
}

SIM = {
    'size': (20, 20),
    'neighborhoods': [{
        'desirability': 5,
        'units': (4,10),
        'commercial': 0.1,
        'park': 0.1
    }, {
        'desirability': 8,
        'units': (1,2),
        'commercial': 0.2,
        'park': 0.2
    }, {
        'desirability': 1,
        'units': (1,2),
        'commercial': 0.1,
        'park': 0
    }, {
        'desirability': 2,
        'units': (2,5),
        'commercial': 0,
        'park': 0
    }],
    'n_tenants': 4000,
    'n_landlords': 10,
    'n_parcels': 20*20*0.8,
    'pricing_horizon': 5 * 12,
    'tenants': {
        'moving_penalty': 10,
        'min_area': 50
    }
}
