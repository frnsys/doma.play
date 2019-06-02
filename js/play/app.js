import api from '../api';
import config from '../city/config';
import uuid from 'uuid/v4';
import displayListings from './listings';

const id = uuid();
const logEl = document.getElementById('log');
const hudEl = document.getElementById('hud');

function dateFromTime(time) {
  return `${(time % 12) + 1}/${config.startYear + Math.floor(time/12)}`;
}

let date;

// Joining/leaving
api.post('/play/join', {id}, (data) => {
  date = dateFromTime(data.time);
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
    hudEl.style.display = 'block';
    hudEl.innerHTML = `${date}; Tenant ${chosenTenant.id}, Income $${Math.round(chosenTenant.income/12).toLocaleString()}/month, Unit ${chosenTenant.unit}`;
    tenant = chosenTenant;

    api.post(`/play/select/${id}`, {id: chosenTenant.id}, (data) => {
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
    displayListings(el, tenant, (unit) => {
      api.post(`/play/move/${id}`, {id: unit.id}, (data) => {
        logEl.removeChild(el);
        document.querySelector('.tooltip').style.display = 'none';
        publish({
          message: 'Ok, I\'ll move in there.',
          actions: [{
            id: 'searchApartments',
            name: 'Look for a different apartment',
          }, {
            id: 'endTurn',
            name: 'End Turn',
          }]
        });
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
            date = dateFromTime(data.time);
            let tenant = data.tenant;
            hudEl.innerHTML = `${date}; Tenant ${tenant.id}, Income $${Math.round(tenant.income/12).toLocaleString()}/month, Unit ${tenant.unit}`;
            document.querySelector('.event:last-child').style.opacity = 0.5;
            publish({
              message: 'What should I do?',
              actions: [{
                id: 'searchApartments',
                name: 'Look for a new apartment',
              }, {
                id: 'endTurn',
                name: 'End Turn',
              }]
            });
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
