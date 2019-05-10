import json
import matplotlib.pyplot as plt
from collections import defaultdict

plt.style.use('ggplot')

history = json.load(open('history.json'))
stats = defaultdict(list)

for month in history:
    for k, v in month.items():
        stats[k].append(v)

for k, vals in stats.items():
    plt.title(k)
    plt.plot(range(len(vals)), vals)
    plt.show()