import json
import matplotlib.pyplot as plt
from collections import defaultdict
from datetime import datetime

plt.style.use('ggplot')

output = json.load(open('output.json'))
history = output['history']
stats = defaultdict(list)

# Get neighborhood-specific stats
by_neighb = [h.pop('neighborhoods') for h in history]
neighborhoods = defaultdict(lambda: defaultdict(list))
for h in by_neighb:
    for neighb, sts in h.items():
        for k, v in sts.items():
            neighborhoods[k][neighb].append(v)

# Landlord ownerships
by_landlord = [h.pop('landlords') for h in history]
landlord_ownership = defaultdict(list)
for h in by_landlord:
    for landlord, n_units in h.items():
        landlord_ownership[landlord].append(n_units)
stats['landlord_ownership'] = landlord_ownership

for month in history:
    for k, v in month.items():
        stats[k].append(v)

for k, vals in stats.items():
    plt.title(k)

    if k == 'landlord_ownership':
        for landlord, h in vals.items():
            plt.plot(range(len(h)), h, label='Landlord {}'.format(landlord))
        plt.legend()

    else:
        plt.plot(range(len(vals)), vals)

    # Show per neighborhood, if available
    if k in neighborhoods:
        for neighb, vs in neighborhoods[k].items():
            plt.plot(range(len(vals)), vs, label='Neighborhood {}'.format(neighb))
        plt.legend()

    plt.savefig('plots/{}.png'.format(k))
    plt.close()

with open('plots/index.html', 'w') as f:
    html = '''
        <html>
        <body style="font-family:monospace;">
            <h3>Generated on {dt}</h3>
            <div>
                {meta}
            </div>
            <div>
                {imgs}
            </div>
        </body>
        </html>
    '''.format(
        dt=datetime.now().isoformat(),
        meta=', '.join('{}: {}'.format(k, v) for k, v in output['meta'].items()),
        imgs='\n'.join(['<img style="width:400px;" src="{}.png">'.format(k) for k in stats.keys()]))
    f.write(html)