import math
import random

def weighted_choice(choices):
    """Random selects a key from a dictionary,
    where each key's value is its probability weight."""
    # Randomly select a value between 0 and
    # the sum of all the weights.
    rand = random.uniform(0, sum(choices.values()))

    # Seek through the dict until a key is found
    # resulting in the random value.
    summ = 0.0
    for key, value in choices.items():
        summ += value
        if rand < summ: return key

    # If this returns False,
    # it's likely because the knowledge is empty.
    return False


def force_vote(force, choices, resistance=1):
    """where higher values of force
    make later choices more likely
    and earlier choices less likely.
    higher resistance means more force is required."""
    wts = [
        math.pow(force/((i+1)*resistance), i+1)
    for i in range(len(choices))]

    total = sum(wts)
    dist = {r: wt/total for r, wt in zip(choices, wts)}
    return weighted_choice(dist)
