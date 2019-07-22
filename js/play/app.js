import api from '../api';
import Engine from './engine';

const engine = new Engine();
const statusEl = document.getElementById('status');

api.get('/state/game', ({state}) => {
  if (state == 'ready') {
    engine.start();
  } else {
    statusEl.innerHTML = 'Waiting for simulation to load...';
    let interval = setInterval(() => {
      api.get('/state/game', ({state}) => {
        if (state == 'ready') {
          statusEl.innerHTML = '';
          clearInterval(interval);
          engine.start();
        }
      });
    }, 1000);
  }
});
