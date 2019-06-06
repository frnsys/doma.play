import api from '../api';
import util from './util';
import config from '../city/config';
import uuid from 'uuid/v4';
import displayListings from './listings';

const id = uuid();
const logEl = document.getElementById('log');
const hudEl = document.getElementById('hud-info');
const timerEl = document.getElementById('hud-timer-fill');


function workActions() {
  if (player.energy >= 1) {
    return [{
      'id': 'work',
      'name': 'Another day of work (-1⚡)',
      'cost': {
        'energy': 1
      }
    }, {
      'id': 'work',
      'name': 'Work hard (-2⚡)',
      'cost': {
        'energy': 2
      }
    }];
  } else {
    return [{
      'id': 'work',
      'name': 'Too exhausted...just scrape by'
    }];
  }
}

const unitFailures = [{
  'name': 'No water',
  'desc': 'Your water isn\'t working. (-1⚡)',
  'effect': {
    'energy': -1
  }
}, {
  'name': 'No gas',
  'desc': 'Your gas isn\'t working. (-1⚡)',
  'effect': {
    'energy': -1
  }
}];

function updateHUD() {
  if (!player.tenant) return;
  console.log(player);
  let date = util.dateFromTime(player.time);
  let tenant = player.tenant;
  let energy = [...Array(player.energy)].map(() => {
    return '<span>⚡</span>';
  }).join('');
  energy += [...Array(config.maxEnergy - player.energy)].map(() => {
    return '<span style="opacity:0.25;">⚡</span>';
  }).join('');;

  let fundTens = Math.floor(player.funds/10);
  let fundOnes = player.funds % 10;
  let funds = '';
  if (fundTens > 0) {
    funds += `${fundTens}💰`;
  }
  funds += `${fundOnes}🔶`;

  hudEl.innerHTML = `
    ${date}; Income: $${Math.round(tenant.income/12).toLocaleString()}/month
    Energy: ${energy} Money: ${funds}
  `;
}

// Joining/leaving
api.post('/play/join', {id}, (data) => {
  publish({
    message: 'Welcome to doma.play. Choose a tenant to play as.',
    actions: data.tenants.map((t) => {
      return {
        id: 'chooseTenant',
        name: `Tenant ${t.id}, Income $${Math.round(t.income/12).toLocaleString()}/month`,
        args: [t]
      }
    })
  });
});
window.addEventListener('unload', () => {
  api.post('/play/leave', {id});
}, false);

// Keep alive
function ping() {
  api.post(`/play/ping/${id}`);
}
setInterval(() => {
  ping();
}, 5000)


let stateKey = null;
api.get('/state/key', (data) => {
  stateKey = data.key;
});

const player = {
  time: null,
  energy: 0,
  funds: 0,
  tenant: null,
  turnTimer: null,
  doma: false
};

// Turn timer
setInterval(() => {
  if (player.turnTimer) {
    let time = Date.now() / 1000;
    let [start, end] = player.turnTimer;
    end -= start;
    let width = Math.min(100, (time - start)/end * 100);
    timerEl.style.width = `${width}%`;
  }
}, 100)

const actions = {
  'chooseTenant': (chosenTenant) => {
    api.post(`/play/select/${id}`, {id: chosenTenant.id}, (data) => {
      console.log(`Player chose tenant ${chosenTenant.id}`);
      hudEl.style.display = 'block';
      player.turnTimer = data.timer.split('-').map((t) => parseFloat(t));
      player.tenant = chosenTenant;
      player.time = data.time;
      updateHUD();
      publish({
        message: 'I\'ve  been evicted. I need to find a new apartment.',
        actions: [{
          id: 'searchApartments',
          name: 'Look for an apartment',
        }]
      });
    });
  },
  'searchApartments': () => {
    let el = document.createElement('div');
    logEl.appendChild(el);
    displayListings(el, player.tenant, (unit) => {
      api.post(`/play/move/${id}`, {id: unit.id}, (data) => {
        logEl.removeChild(el);
        document.querySelector('.tooltip').style.display = 'none';
        publish({
          message: 'Ok, I\'ll move in there.',
          actions: [{
            id: 'searchApartments',
            name: 'I change my mind...look again',
          }, {
            id: 'endTurn',
            name: 'End Turn',
          }]
        });
      });
    }, (msg) => {
      logEl.removeChild(el);
      publish({
        message: msg,
        actions: [{
          id: 'endTurn',
          name: 'End Turn',
        }]
      });
    });
  },
  'endTurn': () => {
    api.post(`/play/ready/${id}`);
    publish({
      message: 'Waiting for other players...',
      actions: []
    });

    let update = setInterval(() => {
      api.get('/state/key', (data) => {
        if (data.key !== stateKey) {
          stateKey = data.key;
          clearInterval(update);

          api.get(`/play/tenant/${id}`, (data) => {
            player.funds = Math.floor(data.tenant.monthlyDisposableIncome/100);
            player.turnTimer = data.timer.split('-').map((t) => parseFloat(t));
            player.tenant = data.tenant;
            player.time = data.time;
            player.energy = config.maxEnergy;
            updateHUD();
            document.querySelector('.event:last-child').style.opacity = 0.5;

            // Morning
            let roll = Math.random();
            console.log(`Rolling ${roll} against condition ${data.tenant.unit.condition}`);
            if (roll > data.tenant.unit.condition) {
              let failure = util.randomChoice(unitFailures);
              Object.keys(failure.effect).forEach((k) => player[k] += failure.effect[k]);
              updateHUD();
              publish({
                message: `You wake up. ${failure.desc}`,
                actions: [{
                  id: 'commute',
                  name: 'Go to work',
                }]
              });
            } else {
              publish({
                message: 'You wake up.',
                actions: [{
                  id: 'commute',
                  name: 'Go to work',
                }]
              });
            }
          });
        }
      });
    }, 200);
  },
  'commuteRun': () => {
    publish({
      message: 'You arrive at work breathless and sweating, but on time.',
      actions: workActions()
    });
  },
  'commuteTaxi': () => {
    publish({
      message: 'You arrive at work on time.',
      actions: workActions()
    });
  },
  'commuteWait': () => {
    publish({
      message: 'After some time the subway finally starts again. You arrive to work late. Your boss gives you a disapproving glance.',
      actions: workActions()
    });
  },
  'commute': () => {
    let commuteDistance = util.distance(player.tenant.unit.pos, player.tenant.work);
    let transitFailure = false;
    [...Array(Math.floor(commuteDistance))].forEach(() => {
      if (Math.random() > config.transitReliability) {
        transitFailure = true;
      }
    });
    if (transitFailure) {
      publish({
        message: 'The subway breaks down.',
        actions: [{
          'id': 'commuteRun',
          'name': 'Run to work (-1⚡)',
          'cost': {
            'energy': 1
          }
        }, {
          'id': 'commuteTaxi',
          'name': 'Get a cab (-5🔶)',
          'cost': {
            'funds': 5
          }
        }, {
          'id': 'commuteWait',
          'name': 'Wait for the subway'
        }]
      });
    } else {
      publish({
        message: 'You arrive at work.',
        actions: [{
          'id': 'work',
          'name': 'Another day of work'
        }]
      });
    }
  },
  'doma': () => {
    let actions = [1, 5, 10, 20, 50, 100].filter((amount) => amount <= player.funds).map((amount) => {
      let f = amount < 10 ? amount : amount/10;
      return {
        'id': 'domaContribute',
        'name': `Give ${f}${amount < 10 ? '🔶' : '💰'}`,
        'args': [amount]
      };
    });
    publish({
      message: 'You look at the DOMA website. It\'s described as a way of collectively owning a city\'s housing. You can join by contributing to the platform\'s funds, which entitles you to a share of dividends.',
      actions: actions.concat([{
        'id': 'work',
        'name': 'Nah, I\'m good'
      }])
    })
  },
  'domaContribute': (amount) => {
    api.post(`/play/doma/${id}`, {amount: amount * 100}, (data) => {
      publish({
        message: 'You\'re a member of DOMA!',
        actions: [{
          'id': 'work',
          'name': 'Back to work!'
        }]
      });
    });
  },
  'work': () => {
    if (!player.doma && Math.random() < 0.5) {
      player.doma = true;
      publish({
        message: 'A co-worker mentions this platform called DOMA. They said it\'s saved them some money on their rent.',
        actions: [{
          'id': 'doma',
          'name': 'Sounds interesting...what\'s this about?'
        }, {
          'id': 'work',
          'name': 'Sounds like a scam. Back to work!'
        }]
      })
    } else {
      publish({
        message: 'The work day is finished. Where to now?',
        actions: [{
          'id': 'endTurn',
          'name': 'Have an early night (end turn)'
        }, {
          'id': 'bar',
          'name': 'Go out with some friends (-1⚡, -5🔶)',
          'cost': {
            'energy': 1,
            'funds': 5
          }
        }, {
          'id': 'movie',
          'name': 'Go see a movie (-5🔶)',
          'cost': {
            'funds': 5
          }
        }]
      })
    }
  },
  'bar': () => {
    publish({
      message: 'It was good seeing your friends',
      actions: [{
        'id': 'endTurn',
        'name': 'Call it a night(end turn)'
      }]
    });
  },
  'movie': () => {
    publish({
      message: 'That movie was pretty good',
      actions: [{
        'id': 'endTurn',
        'name': 'Call it a night(end turn)'
      }]
    });
  }
};

function publish(ev) {
  let eventEl = document.createElement('div');
  eventEl.className = 'event';

  let msgEl = document.createElement('div');
  msgEl.innerText = ev.message;
  eventEl.appendChild(msgEl);

  if (ev.actions) {
    let actsEl = document.createElement('div');
    actsEl.className = 'actions';
    ev.actions.forEach((a) => {
      let actEl = document.createElement('div');
      actEl.innerText = a.name;

      // Get cost, if any
      let cost = a.cost || {};
      let afford = Object.keys(cost).every((k) => player[k] > cost[k]);
      if (afford) {
        actEl.resolve = () => {
          [...actsEl.querySelectorAll('div')].forEach((el) => {
            eventEl.style.opacity = 0.5;
            el.removeEventListener('click', el.resolve);
          });
          let args = a.args || [];
          Object.keys(cost).forEach((k) => player[k] -= cost[k]);
          actions[a.id](...args);
          updateHUD();
        }
        actEl.addEventListener('click', actEl.resolve);

      } else {
        actEl.style.opacity = 0.25;
      }
      actsEl.appendChild(actEl);
    });
    eventEl.appendChild(actsEl);
  }

  logEl.appendChild(eventEl);
  window.scrollTo(0, document.body.scrollHeight);
}
