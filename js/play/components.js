// Wrapper/decorator to process HTML templates
// into HTML elements
const View = (tmpl, handlers, defaultState) => {
  return (parent, state) => {
    // Clear parent
    while (parent.hasChildNodes()) {
      parent.removeChild(parent.lastChild);
    }

    state = Object.assign(Object.assign({}, defaultState), state);

    // Render template as HTML nodes
    let t_el = document.createElement('template');
    let html = tmpl(state);
    t_el.innerHTML = html.trim();
    let el = t_el.content.firstChild;

    // Bind handlers, if any
    // Specified in the format:
    // {
    //    "selector": {
    //      "event": fn
    //      // or
    //      "event": [fnA, fnB]
    //    }
    // }
    handlers = handlers || {};
    Object.keys(handlers).forEach((sel) => {
      // For each child matching the selector...
      let chs = Array.from(el.querySelectorAll(sel));

      // For each event...
      Object.keys(handlers[sel]).forEach((ev) => {

        // For each function...
        let fns = handlers[sel][ev];
        fns = Array.isArray(fns) ? fns : [fns];
        chs.forEach((ch) => {
          fns.forEach((fn) => {
            ch.addEventListener(ev, (ev) => {
              let props = ch.dataset;
              fn({state, el, ch, ev, props});
            });
          });
        });
      });
    });

    parent.appendChild(el);
    return el;
  }
}

function signed(number) {
  return `${number < 0 ? '' : '+'}${number}`;
}

const Bar = ({p}) => `
  <div class="bar">
    <div class="bar--fill" style="width:${Math.min(1, p)*100}%"></div>
  </div>
`

const AnnotatedBar = ({p, left, right}) => `
  <div class="bar-annotated">
    <div class="bar-annotated--labels">
      <div class="bar--label bar--label-left">
        ${left.map((t) => `<div>${t}</div>`).join('')}
      </div>
      <div class="bar--label bar--label-right">
        ${right.map((t) => `<div>${t}</div>`).join('')}
      </div>
    </div>
    ${Bar({p})}
  </div>
`

const LabeledBar = ({p, labels}) => `
  <div class="bar-labeled">
    <div class="bar--label">
        ${labels.map((t) => `<div>${t}</div>`).join('')}
    </div>
    ${Bar({p})}
  </div>
`

const Act = View(({act}) => `
  <div>
    <h2 class="act--number">Act ${act.number}</h2>
    <h1 class="act--title">"${act.title}"</h1>
    <div class="act--desc">${act.description}</div>
  </div>
`);

const BasicScene = View(({scene}) => `
  <div>
    <div class="scene--stage">
      <img src="/static/scenes/${scene.image}">
    </div>
    <div class="scene--body">
      <h3 class="scene--title">${scene.title}</h3>
      <p class="scene--desc">${scene.description}</p>
      <div class="scene--actions">
        ${scene.actions.map((a, i) => {
          return `<div class="button scene--action" data-id="${i}">${a.name}</div>`;
        }).join('')}
      </div>
    </div>
  </div>
`, {
  '.scene--action': {
    'click': ({state, props, el}) => {
      if (!state.disabled) {
          // Prevent multiple clicking
          state.disabled = true;
          el.querySelector('.scene--actions').classList.add('disabled');
          state.onAction(state.scene, parseInt(props.id));
      }
    }
  }
}, {
  disabled: false
});

const Splash = View(({ready}) => `
  <div class="splash">
    <div class="splash--image">
      <img src="/static/splash.png">
    </div>
    <div class="scene--body">
      <h1>doma.play</h1>
      <h2>A game to beat the housing market</h2>
      <div class="button ${ready ? "" : "waiting"}">
        ${ready ? "Get started" : "Waiting for next session..."}
      </div>
    </div>
  </div>
`, {
  '.button': {
    'click': ({state}) => state.next()
  }
});

const CitySummary = View(({summary}) => `
  <div class="summary">
    <div class="scene--body">
      <p>Wealth is concentrating in the city of</p>
      <h1>${summary.city}</h1>
      <p>A small group of landlords are expanding their ownership of the city. More and more people are facing a lifetime of rent as the city becomes increasingly unaffordable.</p>
      ${AnnotatedBar({
        p: summary.p.commons,
        left: [`👥${(summary.p.commons*100).toFixed(1)}%`, 'Commons'],
        right: [`${(summary.p.landlords*100).toFixed(1)}%🎩`, 'Landlords']
      })}
      ${AnnotatedBar({
        p: summary.p.affordable,
        left: [`${(summary.p.affordable*100).toFixed(1)}%`, 'Affordable'],
        right: [`${(summary.p.unaffordable*100).toFixed(1)}%`, 'Unaffordable']
      })}
      <table>
        <tr>
          <td>💸Avg Rent</td>
          <td>${summary.avg.rent.toLocaleString()}</td>
        </tr>
        <tr>
          <td>🏠Avg Home Value</td>
          <td>${summary.avg.value.toLocaleString()}</td>
        </tr>
        <tr>
          <td>💵Avg Monthly Income</td>
          <td>${summary.avg.income.toLocaleString()}</td>
        </tr>
        <tr>
          <td>👥Population</td>
          <td>${summary.population.toLocaleString()}</td>
        </tr>
      </table>
      <div class="button">Next</div>
    </div>
  </div>
`, {
  '.button': {
    'click': ({state}) => state.next()
  }
});

const PlayerSummary = ({tenant, summary}) => `
  <ul>
    <li>
      ${tenant.unit && tenant.unit.neighborhood ?
          `🏠 Lives in ${tenant.unit.neighborhood}` : '🏠 Without home'}
    </li>
    <li>${tenant.work ?
        `⚒️ Works in ${tenant.work.neighborhood ? tenant.work.neighborhood : "None"}` : "⚒️ Not working"}</li>
  </ul>
  ${AnnotatedBar({
    p: tenant.rent/tenant.income,
    left: [`💸Rent/month`, `${Math.round(tenant.rent).toLocaleString()}`],
    right: [`Income/month💵`, `${Math.round(tenant.income).toLocaleString()}`]
  })}
  ${AnnotatedBar({
    p: tenant.savings/summary.avg.value,
    left: [`💰Savings`, `${Math.round(tenant.savings).toLocaleString()}`],
    right: [`Avg home value🏠`, `${Math.round(summary.avg.value).toLocaleString()}`]
  })}
`;

const PlayerIntro = View(({tenant, summary}) => {
  return `<div class="summary">
    <div class="scene--body">
      <p>You are</p>
      <h1>${tenant.name}</h1>
      ${PlayerSummary({tenant, summary})}
      <p>Together we will try to change the city of ${summary.city} for the better.</p>
      <div class="button">Next</div>
    </div>
  </div>`;
}, {
  '.button': {
    'click': ({state}) => state.next()
  }
})

const ApartmentSearch = View(({vacancies, affordable}) => {
  let msg = '';
  if (!vacancies) {
    msg = '<p>There are no vacancies right now.</p>';
  } else if (!affordable) {
    msg = '<p>There are no vacancies that you can afford right now.</p>';
  }
  return `<div class="apartment-search">
    <div id="stage" class="scene--stage"></div>
    <div id="details">
      ${msg}
      <div id="listings"></div>
      ${!vacancies || !affordable ? `<div class="listings--skip button">Stay with friend</div>`: ''}
    </div>
  </div>
`}, {
  '.listings--skip': {
    'click': ({state}) => state.onSkip()
  }
});

const ApartmentListings = View(({units}) => {
  if (units && units.length > 0) {
    return `<div>${units.map((u, i) => `
      <div class="listing ${u.affordable ? '' : 'listing-unaffordable'}">
        <div class="listing--title">${u.occupancy} bedroom, looking for ${u.occupancy - u.tenants} tenant${u.occupancy - u.tenants == 1 ? '' : 's'}</div>
        ${u.doma ? '<div class="listing--doma">📌 DOMA-owned apartment</div>': ''}
        <div class="listing--rent">💵${u.rentPerTenant.toLocaleString()}/month</div>
        <div class="listing--elapsed">Listed ${u.monthsVacant} month${u.monthsVacant == 1 ? '' : 's'} ago</div>
        <div data-id="${i}" class="listing--select button ${u.affordable ? '' : 'disabled'}">
          ${u.affordable ? 'Select' : 'Too Expensive'}
        </div>
      </div>
    `).join('')}</div>`;
  } else {
    return `<div class="listings--help">
      Use the map to navigate the city. Click on a tile to view listings there.
    </div>`;
  }
}, {
  '.listing--select': {
    'click': ({state, props}) => {
      if (state.onSelect) {
        let unit = state.units[parseInt(props.id)];
        if (unit.affordable) state.onSelect(unit);
      };
    }
  }
});

const ActSummary = View(({summary, me, players}) => `
  <div class="summary act-summary">
    <div class="scene--body">
      <h1>${summary.city}</h1>
      <table>
        <tr>
          <td>💸Avg Rent</td>
          <td>${summary.avg.rent.toLocaleString()} (${signed(summary.delta.avg.rent)}%)</td>
        </tr>
        <tr>
          <td>🏠Avg Home Value</td>
          <td>${summary.avg.value.toLocaleString()} (${signed(summary.delta.avg.value)}%)</td>
        </tr>
        <tr>
          <td>💵Avg Monthly Income</td>
          <td>${summary.avg.income.toLocaleString()} (${signed(summary.delta.avg.income)}%)</td>
        </tr>
        <tr>
          <td>👥Population</td>
          <td>${summary.population.toLocaleString()}</td>
        </tr>
      </table>
      ${AnnotatedBar({
        p: summary.p.commons,
        left: [`👥${(summary.p.commons*100).toFixed(1)}% (${signed(Math.round(summary.delta.p.commons*100))}%)`, 'Commons'],
        right: [`(${signed(Math.round(summary.delta.p.landlords*100))}%) ${(summary.p.landlords*100).toFixed(1)}%🎩`, 'Landlords']
      })}
      ${AnnotatedBar({
        p: summary.p.affordable,
        left: [`${(summary.p.affordable*100).toFixed(1)}% (${signed(Math.round(summary.delta.p.affordable*100))}%)`, 'Affordable'],
        right: [`(${signed(Math.round(summary.delta.p.unaffordable*100))}%) ${(summary.p.unaffordable*100).toFixed(1)}%`, 'Unaffordable']
      })}
      <div class="player-summary">
        <h1>${me.name} (you)</h1>
        ${PlayerSummary({tenant: me, summary})}
      </div>
      ${players.map((p) => {
        return `
          <div class="player-summary">
            <h1>${p.name}</h1>
            ${PlayerSummary({tenant: p, summary})}
          </div>
        `
      }).join('')}
      <div class="button">Next</div>
    </div>
  </div>
`, {
  '.button': {
    'click': ({state}) => state.next()
  }
});

const EquityPurchase = View(({scene, tenant, shares}) => `
  <div>
    <div class="scene--stage">
      <img src="/static/scenes/${scene.image}">
    </div>
    <div class="scene--body">
      <h3 class="scene--title">${scene.title}</h3>
      <p class="scene--desc">The collective is raising funds by selling 🧱equity in the collective's properties. Each 🧱equity share entitles you to 5% of rental 💵dividends. You have 💵${Math.round(tenant.savings).toLocaleString()} in savings, how many 🧱equity shares do you want to buy?</p>
      <div class="bar-annotated--labels">
        <div class="bar--label bar--label-left">
          <div>💵0</div>
        </div>
        <div class="bar--label bar--label-right">
          <div>💵${Math.round(tenant.savings).toLocaleString()}</div>
        </div>
      </div>
      <input type="range" min="0" max="${Math.round(tenant.savings)}" value="${shares}" class="slider">
      <div class="scene--actions">
        <div class="button scene--action">Buy 🧱${shares.toLocaleString()} shares</div>
      </div>
    </div>
  </div>
`, {
  '.slider': {
    'input': ({state, el, ev}) => {
      state.shares = ev.target.value;
      el.querySelector('.button').innerText = `Buy 🧱${state.shares.toLocaleString()} shares`;
    }
  },
  '.button': {
    'click': ({state}) => state.next(parseInt(state.shares))
  }
}, {
  shares: 0
});


const EquityResults = View(({scene, results}) => `
  <div class="equity-results">
    <div class="scene--stage">
      <img src="/static/scenes/${scene.image}">
    </div>
    <div class="scene--body">
      <h3 class="scene--title">${scene.title}</h3>
      <ul class="equity-results--stats">
        <li>💵${results.delta.raised.amount.toLocaleString()} raised</li>
        <li>${results.delta.units.amount} unit${results.delta.units.amount == 1 ? '' : 's'} purchased</li>
        <li>${results.delta.members.amount} new member${results.delta.members.amount == 1 ? '' : 's'}</li>
      </ul>
      ${results.delta.units.amount > 0 ? `
        <h4>Purchased units</h4>
        <ul class="equity-results--units">
          ${Object.keys(results.delta.neighbs).map((n) => {
            return `<li>${results.delta.neighbs[n]} units in ${n}</li>`;
          }).join('')}
        </ul>
      ` : ''}
      <div class="scene--actions">
        <div class="button">Next</div>
      </div>
    </div>
  </div>
`, {
  '.button': {
    'click': ({state}) => state.next()
  }
});

const PolicyResults = View(({scene, results}) => `
  <div>
    <div class="scene--stage">
      <img src="/static/scenes/${scene.image}">
    </div>
    <div class="scene--body">
      <h3 class="scene--title">${scene.title}</h3>
      <div class="scene--desc">
        ${scene.news ? '<p>While you were preparing the housing collective, other housing action took place.</p>' : ''}
        <p>${results['RentFreeze'] ? `<p>${scene.strike ? 'You and the other rent strikers' : 'Rent strikes across the city' } were successful in pushing landlords into effecting a ${results['RentFreeze']}-month rent freeze. Hopefully this will relieve some pressure.</p>` : ''}</p>
        <p>${results['MarketTax'] ? `<p>${scene.petition ? 'You and other petitioners' : 'A coalition of housing activists'} managed to push through a housing market tax, in effect for ${results['MarketTax']} months, which is expected to slow down rising prices.</p>` : ''}</p>
      </div>
      <div class="scene--actions">
        <div class="button">Next</div>
      </div>
    </div>
  </div>
`, {
  '.button': {
    'click': ({state}) => state.next()
  }
});

const EquityVote = View(({scene}) => `
  <div class="param-vote">
    <div class="scene--stage">
      <img src="/static/scenes/${scene.image}">
    </div>
    <div class="scene--body">
      <h3 class="scene--title">${scene.title}</h3>
      <div class="scene--desc">
        <p>Your focus is on where rent goes when it is collected. Focusing on 🧱equity generation favors renters becoming owners over time. Increasing 💵dividends focuses on lowering rent in the short term, but lowers the amount of funds for purchasing new properties to add to the community pool.</p>
      </div>
      <div class="param-vote--param">
        <h4>Rent to Equity</h4>
        <div class="bar-annotated--labels">
          <div class="bar--label bar--label-left">
            <div>0%</div>
          </div>
          <div class="bar--label bar--label-right">
            <div>30%</div>
          </div>
        </div>
        <input type="range" min="0" max="30" value="5" class="equity-slider">
      </div>
      <div class="param-vote--param">
        <h4>Rent to Dividends</h4>
        <div class="bar-annotated--labels">
          <div class="bar--label bar--label-left">
            <div>0%</div>
          </div>
          <div class="bar--label bar--label-right">
            <div>90%</div>
          </div>
        </div>
        <input type="range" min="0" max="90" value="5" class="dividend-slider">
      </div>
      <div class="scene--actions">
        <div class="button scene--action">Vote</div>
      </div>
    </div>
  </div>
`, {
  '.button': {
    'click': ({state}) => state.next(state.params)
  },
  '.equity-slider': {
    'input': ({state, el, ev}) => {
      state.params.p_rent_share = parseFloat(ev.target.value)/100;
    }
  },
  '.dividend-slider': {
    'input': ({state, el, ev}) => {
      state.params.p_dividend = parseFloat(ev.target.value)/100;
    }
  },
}, {
  params: {
    p_dividend: 0.05,
    p_rent_share: 0.05
  }
});

const RentVote = View(({scene}) => `
  <div class="param-vote">
    <div class="scene--stage">
      <img src="/static/scenes/${scene.image}">
    </div>
    <div class="scene--body">
      <h3 class="scene--title">${scene.title}</h3>
      <div class="scene--desc">
        <p>Your focus is on how much rent is collected. Setting strong limits to rent helps housing affordability in the short term, but reduces the size of the property purchasing fund. Increasing 💵dividends also lowers rent in the short term, but also reduces the size of the property purchasing fund.</p>
      </div>
      <div class="param-vote--param">
        <h4>Rent Limit</h4>
        <div class="bar-annotated--labels">
          <div class="bar--label bar--label-left">
            <div>0%</div>
          </div>
          <div class="bar--label bar--label-right">
            <div>100% avg income</div>
          </div>
        </div>
        <input type="range" min="0" max="100" value="35" class="rent-slider">
      </div>

      <div class="param-vote--param">
        <h4>Rent to Dividends</h4>
        <div class="bar-annotated--labels">
          <div class="bar--label bar--label-left">
            <div>0%</div>
          </div>
          <div class="bar--label bar--label-right">
            <div>90%</div>
          </div>
        </div>
        <input type="range" min="0" max="90" value="5" class="dividend-slider">
      </div>
      <div class="scene--actions">
        <div class="button scene--action">Vote</div>
      </div>
    </div>
  </div>
`, {
  '.button': {
    'click': ({state}) => state.next(state.params)
  },
  '.rent-slider': {
    'input': ({state, el, ev}) => {
      state.params.rent_income_limit = parseFloat(ev.target.value)/100;
    }
  },
  '.dividend-slider': {
    'input': ({state, el, ev}) => {
      state.params.p_dividend = parseFloat(ev.target.value)/100;
    }
  },
}, {
  params: {
    p_dividend: 0.05,
    rent_income_limit: 0.35
  }
});


const VoteResults = View(({scene, results}) => `
  <div class="param-vote">
    <div class="scene--stage">
      <img src="/static/scenes/${scene.image}">
    </div>
    <div class="scene--body">
      <h3 class="scene--title">${scene.title}</h3>
      <table>
        <tr>
          <td>Rent to Equity</td>
          <td>${Math.round(results.p_rent_share*100)}%</td>
        </tr>
        <tr>
          <td>Rent to Dividend</td>
          <td>${Math.round(results.p_dividend*100)}%</td>
        </tr>
        <tr>
          <td>Rent Limit</td>
          <td>${Math.round(results.rent_income_limit*100)}% of avg income</td>
        </tr>
      </table>
      <div class="scene--actions">
        <div class="button scene--action">Next</div>
      </div>
    </div>
  </div>
`, {
  '.button': {
    'click': ({state}) => state.next()
  }
});


export default {BasicScene, Act, Splash, CitySummary, ActSummary, PlayerIntro,
  ApartmentSearch, ApartmentListings, EquityPurchase, EquityResults, PolicyResults,
  EquityVote, RentVote, VoteResults};
