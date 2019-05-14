import json
import matplotlib.pyplot as plt
from collections import defaultdict
from datetime import datetime

plt.style.use('ggplot')

history = json.load(open('history.json'))
stats = defaultdict(list)

for month in history:
    for k, v in month.items():
        stats[k].append(v)

for k, vals in stats.items():
    plt.title(k)
    plt.plot(range(len(vals)), vals)
    plt.savefig('plots/{}.png'.format(k))
    plt.close()

with open('plots/index.html', 'w') as f:
    html = '''
        <h3>Generated on {dt}</h3>
        <div>
            {imgs}
        </div>
    '''.format(
        dt=datetime.now().isoformat(),
        imgs='\n'.join(['<img style="width:400px;" src="{}.png">'.format(k) for k in stats.keys()]))
    f.write(html)