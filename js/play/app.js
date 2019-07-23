import api from '../api';
import Engine from './engine';

const engine = new Engine();
const statusEl = document.getElementById('status');

api.get('/state/game', ({state}) => {
  if (state == 'ready') {
    engine.start();
  } else {
    statusEl.style.display = 'block';
    statusEl.innerHTML = 'Waiting for next session...';
    let interval = setInterval(() => {
      api.get('/state/game', ({state}) => {
        if (state == 'ready') {
          statusEl.innerHTML = '';
          statusEl.style.display = 'none';
          clearInterval(interval);
          engine.start();
        }
      });
    }, 1000);
  }
});
