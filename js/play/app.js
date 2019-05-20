import api from '../api';
import uuid from 'uuid/v4';
import displayListings from './listings';

const id = uuid();
const logEl = document.getElementById('log');

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

let tenant;

const actions = {
  'chooseTenant': (chosenTenant) => {
    let hudEl = document.getElementById('hud');
    hudEl.style.display = 'block';
    hudEl.innerHTML = `Tenant ${chosenTenant.id}, Income $${Math.round(chosenTenant.income/12).toLocaleString()}/month`;
    tenant = chosenTenant;

    api.post(`/play/select/${id}`, {id: chosenTenant.id}, (data) => {
      publish({
        message: 'I\'ve  been evicted. I need to find a new apartment.',
        actions: [{
          id: 'searchApartments',
          name: 'Look for an apartment',
        }, {
          id: 'eat',
          name: 'Eat',
        }, {
          id: 'endTurn',
          name: 'End Turn',
        }]
      });
    });
  },
  'searchApartments': () => {
    displayListings(logEl, tenant);
  },
  'eat': () => {
    publish({
      message: 'Yum',
      actions: [{
        id: 'searchApartments',
        name: 'Look for an apartment',
      }]
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

          document.querySelector('.event:last-child').style.opacity = 0.5;
          publish({
            message: '(new turn) I\'ve  been evicted. I need to find a new apartment.',
            actions: [{
              id: 'searchApartments',
              name: 'Look for an apartment',
            }, {
              id: 'eat',
              name: 'Eat',
            }, {
              id: 'endTurn',
              name: 'End Turn',
            }]
          });
        }
      });
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
      let actEl = document.createElement('span');
      actEl.innerText = a.name;
      actEl.resolve = () => {
        [...actsEl.querySelectorAll('span')].forEach((el) => {
          eventEl.style.opacity = 0.5;
          el.removeEventListener('click', el.resolve);
        });
        let args = a.args || [];
        actions[a.id](...args);
      }
      actEl.addEventListener('click', actEl.resolve);
      actsEl.appendChild(actEl);
    });
    eventEl.appendChild(actsEl);
  }

  logEl.appendChild(eventEl);
}
