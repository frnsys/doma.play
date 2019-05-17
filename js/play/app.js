import displayListings from './listings';

let logEl = document.getElementById('log');

const actions = {
  'searchApartments': () => {
    displayListings(logEl);
  },
  'eat': () => {
    publish({
      message: 'Yum',
      actions: [{
        id: 'searchApartments',
        name: 'Look for an apartment',
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
      let actEl = document.createElement('span');
      actEl.innerText = a.name;
      actEl.resolve = () => {
        [...actsEl.querySelectorAll('span')].forEach((el) => {
          eventEl.style.opacity = 0.5;
          el.removeEventListener('click', el.resolve);
        });
        actions[a.id]();
      }
      actEl.addEventListener('click', actEl.resolve);
      actsEl.appendChild(actEl);
    });
    eventEl.appendChild(actsEl);
  }

  logEl.appendChild(eventEl);
}

publish({
  message: 'I\'ve  been evicted. I need to find a new apartment.',
  actions: [{
    id: 'searchApartments',
    name: 'Look for an apartment',
  }, {
    id: 'eat',
    name: 'Eat',
  }]
});
