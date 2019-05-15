import api from '../api';
import config from './config';
import HUD from './hud';
import City from './3d/city';
import Scene from './3d/scene';
import InteractionLayer from './3d/interact';

const scene = new Scene({});
const main = document.getElementById('main');
main.appendChild(scene.renderer.domElement);

// NOTE: this doesn't work unless user explicitly
// allows autoplay
// document.getElementById('audio').play();

function update() {
  api.get('/state/key', (data) => {
    // Compare state keys to
    // see if state changed
    if (data.key !== stateKey) {
      api.get('/state', (state) => {
        stateKey = state.key;
        HUD.updateStats(state);
        HUD.updateChart(statsChart, state);

        // Update units
        Object.values(state.units).forEach((u) => {
          let unit = city.units[u.id];
          unit.update(u);
        });
      });
    }
  });
}

let stateKey = null;
let lastTime = null;
function render(time) {
  // update every 2000ms
  if (!lastTime) {
    lastTime = time;
  } else if (time - lastTime > 2000) {
    lastTime = time;
    update();
  }
  city.animate();
  scene.render();
  requestAnimationFrame(render);
}

// Initial setup
let city;
let statsChart;
api.get('/state', (state) => {
  stateKey = state.key;
  city = new City(state);
  scene.add(city.grid.group);

  // Setup interactable objects
  let selectables = [];
  city.grid.cells.filter((c) => c).forEach((c) => {
    selectables.push(c.mesh);
    if (c.building) {
      selectables = selectables.concat(Object.values(c.building.units).map((u) => u.mesh));
      selectables = selectables.concat(Object.values(c.building.commercial));
    }
  });
  let ixn = new InteractionLayer(scene, selectables);

  // Init HUD/stats
  HUD.updateStats(state);
  statsChart = HUD.createChart(state);

  render();
});
