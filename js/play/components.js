import util from './util';

const LANDLORDS = [
  'Brookminster Asset Management',
  'Harbor Realty Corporation',
  'Mercer Property Group',
  'Hansen Capital Management',
  'Milhauser Trust',
  'Eastfield Property Management',
  'Orion Equities',
  'Blackwater Group',
  'AXI Realty',
  'Havelstein Properties',
  'Silwood Management',
  'Vonsoon Realty Trust'
];

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

function hiSignP(number, good) {
  let s = signed(number);
  if (!isFinite(number)) {
    return `<span class="signed">N/A</span>`
  } else if (number < 0) {
    if (good) {
      return `<span class="signed signed-bad">${s}%</span>`
    } else {
      return `<span class="signed signed-good">${s}%</span>`
    }
  } else if (number > 0) {
    if (good) {
      return `<span class="signed signed-good">${s}%</span>`
    } else {
      return `<span class="signed signed-bad">${s}%</span>`
    }
  } else {
      return `<span class="signed">${s}%</span>`
  }
}

const Bar = ({p}) => `
  <div class="bar">
    <div class="bar--fill" style="width:${Math.min(1, p)*100}%"></div>
  </div>
`

const BarBar = ({p, subP, subLabel}) => `
  <div class="bar">
    <div class="bar--fill" style="width:${Math.min(1, p)*100}%">
      <div class="bar--subfill" style="width:${Math.min(1, subP)*100}%">${subLabel}</div>
    </div>
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

const AnnotatedBarBar = ({p, subP, subLabel, left, right}) => `
  <div class="bar-annotated">
    <div class="bar-annotated--labels">
      <div class="bar--label bar--label-left">
        ${left.map((t) => `<div>${t}</div>`).join('')}
      </div>
      <div class="bar--label bar--label-right">
        ${right.map((t) => `<div>${t}</div>`).join('')}
      </div>
    </div>
    ${BarBar({p, subP, subLabel})}
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
    <h1 class="act--title">${act.title}</h1>
    <div class="act--desc">${act.description}</div>
  </div>
`);

const BasicScene = View(({scene, player}) => {
  let desc = scene.description;
  desc = desc.replace('{neighborhood}', player.tenant.unit ? player.tenant.unit.neighborhood : 'town');
  return `
    <div>
      <div class="scene--stage">
        <img src="/static/scenes/${scene.image}">
      </div>
      <div class="scene--body">
        <h3 class="scene--title">${scene.title}</h3>
        <p class="scene--desc">${desc}</p>
        <div class="scene--actions">
          ${scene.actions.map((a, i) => {
            return `<div class="button ${a.cost && a.cost.energy > player.energy ? 'scene--action-disabled' : 'scene--action'}" data-id="${i}">${a.name}${a.cost ? `<span class="scene--action-cost">-${a.cost.energy}⚡</span>` : ''}</div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
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

const Splash = View(({ready}) => `
  <div class="splash">
    <div class="splash--image">
      <img src="/static/splash.png">
    </div>
    <div class="scene--body">
      <h1>doma.play</h1>
      <h2>A game to beat the housing market</h2>
      <p>In this online multiplayer game, your goal will be to join forces with other city dwellers to make your city more affordable, inclusive, and sustainable. Can you make it against the forces of the market?</p>
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

const PlayerSummary = ({tenant, summary, showDomaShare}) => `
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
    left: [`💸Rent/month${tenant.delta ? ` ${hiSignP(tenant.delta.rent, false)}` : ''}`, `${tenant.unit ? Math.round(tenant.rent).toLocaleString() : 'N/A'}`],
    right: [`${tenant.delta ? `${hiSignP(tenant.delta.income, true)} ` : ''}Income/month💵`, `${Math.round(tenant.income).toLocaleString()}`]
  })}
  ${showDomaShare ? AnnotatedBarBar({
    p: tenant.savings/summary.avg.value,
    subP: tenant.equity/tenant.savings,
    subLabel: `🧱${tenant.equity} DOMA equity`,
    left: [`💰Savings${tenant.delta ? ` ${hiSignP(tenant.delta.savings, true)}` : ''}`, `${Math.round(tenant.savings).toLocaleString()}`],
    right: [`Avg home value🏠`, `${Math.round(summary.avg.value).toLocaleString()}`]
  }) : AnnotatedBar({
    p: tenant.savings/summary.avg.value,
    left: [`💰Savings${tenant.delta ? ` ${hiSignP(tenant.delta.savings, true)}` : ''}`, `${Math.round(tenant.savings).toLocaleString()}`],
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
    <div id="apartment-search--popup" class="popup">
      <div class="popup--content">
        <img src="/static/scenes/phone.png">
        <p></p>
        <div class="hide-popup button">Ok</div>
      </div>
    </div>
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
  },
  '.hide-popup': {
    'click': ({state}) => {
      state.onHidePopup();
      document.getElementById('apartment-search--popup').style.display = 'none';
      // Check if any apartments available
      let vacantUnits = state.allVacantUnits.filter((u) => {
        return !u.taken && u.affordable;
      });
      if (vacantUnits.length == 0) {
        state.onSkip();
      }
    }
  }
});

const ApartmentListings = View(({parcel, tenant, units, maxSpaciousness}) => {
  if (units && units.length > 0) {
    return `<div>
      <h2 class="listings--neighborhood">${parcel.neighb.name}</h2>
      ${units.map((u, i) => {
        let spac = u.spaciousness/maxSpaciousness;
        let desc = '';
        if (spac <= 0.3) {
          desc += util.randomChoice([
            'A cozy spot.',
            'A little compact.',
            'Spatially charming.',
            'A space-efficient apartment.']);
        } else if (spac < 0.7) {
          desc += util.randomChoice([
            'The apartment is quite spacious.',
            'There\'s plenty of room.',
            'The space is wide-open.',
            'Very roomy.']);
        } else {
          desc += util.randomChoice([
            'Absolutely cavernous space.',
            'Extraordinarly vast rooms.',
            'A tremendously expansive unit.',
            'Unapologetically huge.',
            'A chasmal apartment.']);
        }
        desc += ' ';
        if (u.condition <= 0.3) {
          desc += util.randomChoice([
            'A fixer-upper.',
            'Has old-school charm.',
          ]);
        } else if (u.condition <= 0.7) {
          desc += util.randomChoice([
            'Well-maintained.',
            'Owner is responsive to tenant.',
            'Repairs are timely.',
            'In good condition.',
          ]);
        } else {
          desc += util.randomChoice([
            'Like new condition.',
            'Absolutely pristine.',
            'Recently renovated, with several upgrades.',
            'Practically untouched, totally spotless.'
          ]);
        }
        desc += ' ';
        if (u.owner.type == 'Landlord') {
          desc += `A ${util.randomChoice(LANDLORDS)} property.`
        } else if (u.owner.type == 'DOMA') {
          desc += `A DOMA property.`
        } else {
          desc += `Owned by a ${util.randomChoice(['small family', 'young couple', 'elderly couple', 'local resident'])}.`
        }
        return `
          <div class="listing ${u.affordable ? '' : 'listing-unaffordable'}">
            <div class="listing--title">1 bedroom in a ${u.occupancy}BR</div>
            ${u.doma ? '<div class="listing--doma">📌 DOMA-owned apartment</div>': ''}
            <div class="listing--elapsed">${u.monthsVacant > 0 ?
              `Listed ${u.monthsVacant} month${u.monthsVacant == 1 ? '' : 's'} ago`
              : `Just listed`
            }</div>
            <p>${desc}</p>
            ${tenant.dividend ? AnnotatedBarBar({
              p: u.rentPerTenant/tenant.income,
              left: [`💸Rent/month`, `${Math.round(u.rentPerTenant).toLocaleString()}`],
              subP: u.adjustedRentPerTenant/u.rentPerTenant,
              subLabel: `${Math.round(u.adjustedRentPerTenant)} (-${Math.round((1 - u.adjustedRentPerTenant/u.rentPerTenant)*100)}%) after DOMA dividend`,
              right: [`Income/month💵`, `${Math.round(tenant.income).toLocaleString()}`]
            }): AnnotatedBar({
              p: u.rentPerTenant/tenant.income,
              left: [`💸Rent/month`, `${Math.round(u.rentPerTenant).toLocaleString()}`],
              right: [`Income/month💵`, `${Math.round(tenant.income).toLocaleString()}`]
            })}
            ${u.rentPerTenant/tenant.income >= 0.3 ? '<div class="listing--warning">⚠️ Spending over 30% of your income on rent</div>' : ''}
            <div data-id="${i}" class="listing--select button ${u.affordable && !u.taken ? '' : 'disabled'}">
              ${u.affordable ? (u.taken ? 'No longer available' : 'Apply') : 'Too Expensive'}
            </div>
          </div>`;
      }).join('')}
    </div>`;
  } else {
    return `<div class="listings--help">
      Use the map to navigate the city. Click on a tile to view listings there.
    </div>`;
  }
}, {
  '.listing--select': {
    'click': ({ev, state, props}) => {
      if (state.onSelect) {
        let unit = state.units[parseInt(props.id)];
        if (unit.affordable && !unit.taken) state.onSelect(unit, ev);
      };
    }
  }
});

const ActSummary = View(({summary, me, players, showDomaShare}) => `
  <div class="summary act-summary">
    <div class="scene--body">
      <h1>${summary.city}</h1>
      <table>
        <tr>
          <td>💸Avg Rent</td>
          <td>${summary.avg.rent.toLocaleString()} ${hiSignP(summary.delta.avg.rent, false)}</td>
        </tr>
        <tr>
          <td>🏠Avg Home Value</td>
          <td>${summary.avg.value.toLocaleString()} ${hiSignP(summary.delta.avg.value, false)}</td>
        </tr>
        <tr>
          <td>💵Avg Monthly Income</td>
          <td>${summary.avg.income.toLocaleString()} ${hiSignP(summary.delta.avg.income, true)}</td>
        </tr>
        <tr>
          <td>👥Population</td>
          <td>${summary.population.toLocaleString()}</td>
        </tr>
      </table>
      ${AnnotatedBar({
        p: summary.p.affordable,
        left: [`${(summary.p.affordable*100).toFixed(1)}% ${hiSignP(Math.round(summary.delta.p.affordable*100), true)}`, 'Affordable'],
        right: [`${hiSignP(Math.round(summary.delta.p.unaffordable*100), false)} ${(summary.p.unaffordable*100).toFixed(1)}%`, 'Unaffordable']
      })}
      <div class="player-summary">
        <h1>${me.name} (you)</h1>
        ${PlayerSummary({tenant: me, summary, showDomaShare})}
      </div>
      ${players.map((p) => {
        return `
          <div class="player-summary">
            <h1>${p.name}</h1>
            ${PlayerSummary({tenant: p, summary, showDomaShare: false})}
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

const EquityPurchase = View(({scene, city, tenant, p_dividend, shares}) => `
  <div>
    <div class="scene--stage">
      <img src="/static/scenes/${scene.image}">
    </div>
    <div class="scene--body">
      <h3 class="scene--title">${scene.title}</h3>
      <p class="scene--desc">The equity tokens you can buy here are like shares of housing properties. These unique tokens will make you the legal owner of a fraction of the properties that Doma will buy in ${city}.
      <br /><br />
      With this investment, you're looking at a 5% return per year – which means your tokens are expected to be worth 5% or more in a year time.
      <br /><br />
      In addition, you'll receive some direct cash back every month – about 1 cent for every U invested. This cashback corresponds to your share of the rental income generated by every Doma property, which are rented at a fair price and with many benefits for their tenants.
      <br /><br />
      You have U${Math.round(tenant.savings).toLocaleString()} in savings, how many equity tokens do you want to buy?</p>
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
        <li>💵${results.delta.raised.amount.toLocaleString()} raised ${hiSignP(results.delta.raised.percent, true)}</li>
        <li>${results.delta.units.amount} unit${results.delta.units.amount == 1 ? '' : 's'} purchased ${hiSignP(results.delta.units.percent, true)}</li>
        <li>${results.delta.members.amount} new member${results.delta.members.amount == 1 ? '' : 's'} ${hiSignP(results.delta.members.percent, true)}</li>
      </ul>
      ${results.delta.units.amount > 0 ? `
        <h4>Purchased units</h4>
        <ul class="equity-results--units">
          ${Object.keys(results.delta.neighbs).map((n) => {
            return `<li class="equity--results--neighb">
              <div class="equity--results--neighb--units">${results.delta.neighbs[n]}</div>
              <div class="equity-results--neighb--name">${n}</div>
            </li>`;
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

const EquityResultsExplained = View(({scene, state, player, results}) => `
  <div class="equity-results">
    <div class="scene--stage">
      <img src="/static/scenes/${scene.image}">
    </div>
    <div class="scene--body">
      <h3 class="scene--title">${player.tenant.shares > 0 ? scene.title : 'Parting Ways'}</h3>
      <p class="scene--desc">
        ${player.tenant.shares > 0 ? `
          Now that you have ${Math.round(player.tenant.shares)} equity tokens, you will receive $${Math.round(Math.round(player.tenant.shares)/100)} cash back every month as your share of the rental income generated by the new Doma properties. It isn't much, but it pays better than the savings accounts offered by banks!
          <br /><br />
          In those ${results.delta.units.amount} new Doma homes rents are frozen for five years. What's more, their residents are also receiving some Doma tokens in return for the rent they pay, which makes their rent go down over time!
          <br /><br />
          It feels nice to have invested into something that actually helps people like you.` : `
          You didn't purchase any shares, but if you had you would start receiving cash back every month from the rental income generated by Doma properties.<br /><br />Maybe you can participate in the next round of crowdfunding.<br /><br /><b style="text-align:center;display:block;">GAME OVER</b>`}
      </p>
      <div class="scene--actions">
        <div class="button">${player.tenant.shares > 0 ? "Next" : "Play Again?"}</div>
      </div>
    </div>
  </div>
`, {
  '.button': {
    'click': ({state}) => {
      if (state.player.tenant.shares > 0) {
        state.next();
      } else {
        window.location.href = '/play';
      }
    }
  }
});

const GameOver = View(({city}) => `
  <div class="game-over">
    <div class="scene--stage">
      <img src="/static/scenes/sunset.png">
    </div>
    <div class="scene--body">
      <h3 class="scene--title">Oh No</h3>
      <p class="scene--desc">
        Bummer... Although a lot of people joined in, the first Doma crowdfunding campaign did not raise enough funds to buy a single property.
        <br /><br />
        In these conditions, Doma will not be viable. Each member gets their investment fully reimbursed.
        <br /><br />
        Looks like ${city} was not ready for Doma yet...The market forces will keep making housing increasingly unaffordable. For how long more will you be able to afford living here?
        <br /><br />
        <b style="text-align:center;display:block;">GAME OVER</b>
      </p>
      <div class="scene--actions">
        <div class="button">Play Again?</div>
      </div>
    </div>
  </div>
`, {
  '.button': {
    'click': () => {
      window.location.href = '/play';
    }
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
  EquityVote, RentVote, VoteResults, EquityResultsExplained, GameOver};
