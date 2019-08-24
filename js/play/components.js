// Wrapper/decorator to process HTML templates
// into HTML elements
const View = (tmpl, handlers, defaultState) => {
  return (parent, ...args) => {
    // Clear parent
    while (parent.hasChildNodes()) {
      parent.removeChild(parent.lastChild);
    }

    // Setup initial state
    let state = Object.assign({}, defaultState || {});

    // Render template as HTML nodes
    let t_el = document.createElement('template');
    let html = tmpl(state, ...args);
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

const Bar = (p) => `
  <div class="bar">
    <div class="bar--fill" style="width:${Math.min(1, p)*100}%"></div>
  </div>
`

const AnnotatedBar = (p, left, right) => `
  <div class="bar-annotated">
    <div class="bar-annotated--labels">
      <div class="bar--label bar--label-left">
        ${left.map((t) => `<div>${t}</div>`).join('')}
      </div>
      <div class="bar--label bar--label-right">
        ${right.map((t) => `<div>${t}</div>`).join('')}
      </div>
    </div>
    ${Bar(p)}
  </div>
`

const LabeledBar = (p, labels) => `
  <div class="bar-labeled">
    <div class="bar--label">
        ${labels.map((t) => `<div>${t}</div>`).join('')}
    </div>
    ${Bar(p)}
  </div>
`

const Act = View((state, act) => `
  <div>
    <h2 class="act--number">Act ${act.number}</h2>
    <h1 class="act--title">"${act.title}"</h1>
    <div class="act--desc">${act.description}</div>
  </div>
`);

const BasicScene = View((state, onAction, scene) => {
  state.scene = scene;
  state.onAction = onAction;
  return `<div>
      <div class="scene--stage"></div>
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
  `
}, {
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

const Splash = View((state, ready, onClick) => {
  state.onClick = onClick;
  return `<div class="splash">
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
  </div>`
}, {
  '.button': {
    'click': ({state}) => {
      if (state.onClick) state.onClick();
    }
  }
});

const CitySummary = View((state, summary, onClick) => {
  state.onClick = onClick;
  return `<div class="summary">
    <div class="scene--body">
      <p>Wealth is concentrating in the city of</p>
      <h1>${summary.city}</h1>
      <p>A small group of landlords are expanding their ownership of the city. More and more people are facing a lifetime of rent as the city becomes increasingly unaffordable.</p>
      ${AnnotatedBar(summary.p.commons,
        [`  ${(summary.p.commons*100).toFixed(1)}%`, 'Common'],
        [`🎩${(summary.p.landlords*100).toFixed(1)}%`, 'Landlords']
      )}
      ${AnnotatedBar(summary.p.affordable,
        [`${(summary.p.affordable*100).toFixed(1)}%`, 'Affordable'],
        [`${(summary.p.unaffordable*100).toFixed(1)}%`, 'Unaffordable']
      )}
      <ul>
        <li>Average Rent = ${summary.avg.rent.toLocaleString()}</li>
        <li>Average Home Value = ${summary.avg.value.toLocaleString()}</li>
        <li>Average Monthly Income = ${summary.avg.income.toLocaleString()}</li>
        <li>Population = ${summary.population.toLocaleString()}</li>
      </ul>
      <div class="button">Next</div>
    </div>
  </div>`
}, {
  '.button': {
    'click': ({state}) => {
      if (state.onClick) state.onClick();
    }
  }
});

const PlayerSummary = (tenant, summary) => `
  <ul>
    <li>
      ${tenant.unit && tenant.unit.neighborhood ?
          `Lives in ${tenant.unit.neighborhood}` : 'Without home'}
    </li>
    <li>Works in ${tenant.work.neighborhood ? tenant.work.neighborhood : "None"}</li>
  </ul>
  ${AnnotatedBar(tenant.rent/tenant.income,
    [`Rent/month`, `${Math.round(tenant.rent).toLocaleString()}`],
    [`Income/month`, `${Math.round(tenant.income).toLocaleString()}`]
  )}
  ${AnnotatedBar(tenant.savings/summary.avg.value,
    [`Savings`, `${Math.round(tenant.savings).toLocaleString()}`],
    [`Avg home value`, `${Math.round(summary.avg.value).toLocaleString()}`]
  )}
`

const PlayerIntro = View((state, tenant, summary, onClick) => {
  state.onClick = onClick;
  return `<div class="summary">
    <div class="scene--body">
      <p>You are</p>
      <h1>${tenant.name}</h1>
      ${PlayerSummary(tenant, summary)}
      <p>Together we will try to change the city of ${summary.city} for the better.</p>
      <div class="button">Next</div>
    </div>
  </div>`;
}, {
  '.button': {
    'click': ({state}) => {
      if (state.onClick) state.onClick();
    }
  }
})

const ApartmentSearch = View((state, vacancies, affordable, onSkip) => {
  state.onSkip = onSkip;
  let msg = '';
  if (!vacancies) {
    msg = 'There are no vacancies right now.';
  } else if (!affordable) {
    msg = 'There are no vacancies that you can afford right now.';
  }
  return `<div>
    <div id="stage" class="scene--stage"></div>
    <div id="details" class="scene--body">
      ${msg}
      <div id="listings"></div>
      ${!vacancies || !affordable ? `<div class="listings--skip button">Stay with friend</div>`: ''}
    </div>
  </div>
`}, {
  '.listings--skip': {
    'click': ({state}) => {
      state.onSkip();
    }
  }
});

const ApartmentListings = View((state, units, onSelect) => {
  state.units = units;
  state.onSelect = onSelect;
  if (units && units.length > 0) {
    return `<div>${units.map((u, i) => `
      <div class="listing ${u.affordable ? '' : 'listing-unaffordable'}">
        <div class="listing--title">${u.occupancy} bedroom, looking for ${u.occupancy - u.tenants} tenants</div>
        ${u.doma ? '<div class="listing--doma">📌 DOMA-owned apartment</div>': ''}
        <div class="listing--rent">Rent: $${u.rentPerTenant.toLocaleString()}/month per tenant</div>
        <div class="listing--elapsed">Listed ${u.monthsVacant} months ago</div>
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

const ActSummary = View((state, summary, me, players, onClick) => {
  state.onClick = onClick;
  return `<div class="summary act-summary">
    <div class="scene--body">
      <h1>${summary.city}</h1>
      <ul>
        <li>Average Rent = ${summary.avg.rent.toLocaleString()} (${signed(summary.delta.avg.rent)}%)</li>
        <li>Average Home Value = ${summary.avg.value.toLocaleString()} (${signed(summary.delta.avg.value)}%)</li>
        <li>Average Monthly Income = ${summary.avg.income.toLocaleString()} (${signed(summary.delta.avg.income)}%)</li>
        <li>Population = ${summary.population.toLocaleString()}</li>
      </ul>
      ${AnnotatedBar(summary.p.commons,
        [`  ${(summary.p.commons*100).toFixed(1)}%`, 'Common'],
        [`🎩${(summary.p.landlords*100).toFixed(1)}%`, 'Landlords']
      )}
      ${AnnotatedBar(summary.p.affordable,
        [`${(summary.p.affordable*100).toFixed(1)}%`, 'Affordable'],
        [`${(summary.p.unaffordable*100).toFixed(1)}%`, 'Unaffordable']
      )}

      <div class="player-summary">
        <h1>${me.name} (you)</h1>
        ${PlayerSummary(me, summary)}
      </div>

      ${players.map((p) => {
        return `
          <div class="player-summary">
            <h1>${p.name}</h1>
            ${PlayerSummary(p, summary)}
          </div>
        `
      }).join('')}
      <div class="button">Next</div>
    </div>
  </div>`
}, {
  '.button': {
    'click': ({state}) => {
      if (state.onClick) state.onClick();
    }
  }
});

const EquityPurchase = View((state, scene, tenant, onClick) => {
  state.shares = 0;
  state.onClick = onClick;
  return `<div>
      <div class="scene--stage"></div>
      <div class="scene--body">
        <h3 class="scene--title">${scene.title}</h3>
        <p class="scene--desc">${scene.description}</p>
        <div class="bar-annotated--labels">
          <div class="bar--label bar--label-left">
            <div>💵0</div>
          </div>
          <div class="bar--label bar--label-right">
            <div>💵${Math.round(tenant.savings).toLocaleString()}</div>
          </div>
        </div>
        <input type="range" min="0" max="${Math.round(tenant.savings)}" value="${state.shares}" class="slider">
        <div class="scene--actions">
          <div class="button scene--action">Buy 🧱${state.shares.toLocaleString()} shares</div>
        </div>
      </div>
    </div>`
}, {
  '.slider': {
    'input': ({state, el, ev}) => {
      state.shares = ev.target.value;
      el.querySelector('.button').innerText = `Buy 🧱${state.shares.toLocaleString()} shares`;
    }
  },
  '.button': {
    'click': ({state}) => {
      state.onClick(parseInt(state.shares));
    }
  }
});


const EquityResults = View((state, results, onClick) => {
  state.onClick = onClick;
  return `
    <div class="equity-results">
      <h1>DOMA Crowdbuying Results</h1>
      <h2>💵${results.delta.raised.amount.toLocaleString()} raised</h2>
      <h2>${results.delta.units.amount} unit${results.delta.units.amount == 1 ? '' : 's'} purchased</h2>
      <h2>${results.delta.members.amount} new member${results.delta.members.amount == 1 ? '' : 's'}</h2>
      ${results.delta.units.amount > 0 ? `
        <ul>
          ${Object.keys(results.delta.neighbs).map((n) => {
            return `<li>${results.delta.neighbs[n]} units in ${n}</li>`;
          }).join('')}
        </ul>
      ` : ''}
      <div class="button">Next</div>
    </div>
  `
}, {
  '.button': {
    'click': ({state}) => {
      state.onClick();
    }
  }
});

const PolicyResults = View((state, results, onClick) => {
  state.onClick = onClick;
  return `<div>
    ${results['RentFreeze'] ? `<p>Protesters were successful in pressuring policymakers into implementing a ${results['RentFreeze']}-month rent freeze. Hopefully this will relieve some pressure.</p>` : ''}
    ${results['MarketTax'] ? `<p>Petitioners managed to push through a housing market tax, in effect for ${results['MarketTax']} months, which is expected to slow down rising prices.</p>` : ''}
  </div>`;
}, {
  '.button': {
    'click': ({state}) => {
      state.onClick();
    }
  }
});

const EquityVote = View((state, onClick) => {
  state.onClick = onClick;
  state.params = {
    p_dividend: 0.05,
    p_rent_share: 0.05
  };
  return `<div>
    <div>
      <div>Rent to Equity</div>
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

    <div>
      <div>Rent to Dividends</div>
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
  </div>`;
}, {
  '.button': {
    'click': ({state}) => {
      state.onClick(state.params);
    }
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
});

const RentVote = View((state, onClick) => {
  state.onClick = onClick;
  state.params = {
    p_dividend: 0.05,
    rent_income_limit: 0.35
  };
  return `<div>
    <div>
      <div>Rent Limit</div>
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

    <div>
      <div>Rent to Dividends</div>
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
  </div>`;
}, {
  '.button': {
    'click': ({state}) => {
      state.onClick(state.params);
    }
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
});


const VoteResults = View((state, results, onClick) => {
  state.onClick = onClick;
  return `<div>
    <h1>DOMA parameters</h1>
    <ul>
      <li>Rent to Equity: ${Math.round(results.p_rent_share*100)}%</li>
      <li>Rent to Dividend: ${Math.round(results.p_dividend*100)}%</li>
      <li>Rent Limit: ${Math.round(results.rent_income_limit*100)}% of average income</li>
    </ul>
    <div class="scene--actions">
      <div class="button scene--action">Vote</div>
    </div>
  </div>`;
}, {
  '.button': {
    'click': ({state}) => {
      state.onClick();
    }
  }
});


export default {BasicScene, Act, Splash, CitySummary, ActSummary, PlayerIntro,
  ApartmentSearch, ApartmentListings, EquityPurchase, EquityResults, PolicyResults,
  EquityVote, RentVote, VoteResults};
