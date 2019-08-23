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

const PlayerSummary = View((state, summary, tenant, onClick) => {
  state.onClick = onClick;
  return `<div class="summary">
    <div class="scene--body">
      <p>You are</p>
      <h1>${tenant.name}</h1>
      <ul>
        <li>
          ${tenant.unit.neighborhood ?
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
      <div class="listing ${u.affordable ? 'listing-unaffordable' : ''}">
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

export default {BasicScene, Act, Splash, CitySummary, PlayerSummary, ApartmentSearch, ApartmentListings};
