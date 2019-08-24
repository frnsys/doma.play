import api from '../api';
import Engine from './engine';
import Views from './components';

const engine = new Engine();
const statusEl = document.getElementById('status');
const sceneEl = document.getElementById('scene');

let _success;
function checkReady() {
  api.get('/play/ready', ({success}) => {
    if (success !== _success) {
      _success = success;
      if (success) {
        clearInterval(interval);
        Views.Splash(sceneEl, {
          ready: success,
          next: () => engine.start()
        });
      } else {
        Views.Splash(sceneEl, {
          ready: success,
          next: () => {}
        });
      }
    }
  });
}

checkReady();
let interval = setInterval(() => {
  checkReady();
}, 200);
