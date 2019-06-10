# All in seconds
MIN_STEP_DELAY = 10
PLAYER_TIMEOUT = 60
PLAYER_READY_TIMEOUT = 30
TURN_LIMIT = 2
N_STEPS = 120
PAUSE_BETWEEN_RUNS = 20

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
    },
    'base_appreciation': 1.02,
    'rent_increase_rate': 1.05,

    # Contagion/word-of-mouth model
    'sociality': 0.01, # Probability a tenant sees a friend,

    # Percent of rent paid to DOMA
    # that converts to shares
    'doma_rent_share': 0.1,
    'doma_initial_fund': 10000000,

    # How long DOMA waits before
    # considering selling a unit
    'doma_min_hold_time':  5 * 12,

    # Desirability dynamics (simplex noise walk)
    # Higher this is, the wider the curves (i.e. slower changes)
    'desirability_stretch_factor': 72,
}
