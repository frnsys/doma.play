import api from '../api';
import config from './config';
import HUD from './hud';
import City from './3d/city';
import Scene from './3d/scene';
import {shadeColor} from './3d/color';
import InteractionLayer from './3d/interact';

const scene = new Scene({});
const main = document.getElementById('main');
const players = document.getElementById('n_players');
main.appendChild(scene.renderer.domElement);

// NOTE: this doesn't work unless user explicitly
// allows autoplay
// document.getElementById('audio').play();

let lastState;
function update() {
  api.get('/play/players', (data) => {
    players.innerHTML = data.players.length;
  });

  api.get('/state/key', (data) => {
    // Compare state keys to
    // see if state changed
    if (data.key !== stateKey) {
      api.get('/state/game', ({state}) => {
        if (state == 'fastforward') {
          statusEl.style.display = 'inline-block';
          statusEl.innerHTML = 'Going to the future...';
          cycleSpeed = 0.25;
        } else {
          cycleSpeed = 0.02;
          if (state == 'finished') {
            statusEl.innerHTML = 'Waiting for the next session to start...';
          } else if (state == 'ready') {
            statusEl.style.display = 'none';
            // Just reload to reset graphs
            if (lastState == 'finished') {
              window.location.reload();
            }
          }
        }
        lastState = state;
      });
      api.get('/state', (state) => {
        stateKey = state.key;
        HUD.updateStats(state);
        HUD.updateCharts(state);

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
let angle = Math.PI/2;
let cycleSpeed = 0.02;
const sunRadius = 200;
function render(time) {
  // update every 2000ms
  if (!lastTime) {
    lastTime = time;
  } else if (time - lastTime > 2000) {
    lastTime = time;
    update();
  }
  city.animate();

  // Day-Night cycle
  let progress = (angle % (2*Math.PI))/Math.PI;
  let isNight = progress > 1;

  angle += isNight ? cycleSpeed : cycleSpeed/10;

  let startSunset = 0.75;
  let endSunrise = 0.25;
  if (progress >= startSunset && progress < 1) {
    let p = 1 - (progress - startSunset)/(1-startSunset);
    document.body.style.background = `#${shadeColor(0xffc2c2, p-1).toString(16).substr(1)}`;
    p = Math.max(0.1, p);
    city.clouds.forEach((c) => c.material.emissiveIntensity = p);
    scene.sun.intensity = scene.sun.baseIntensity * p;
    scene.hemiLight.intensity = scene.hemiLight.baseIntensity * p;
    scene.ambiLight.intensity = scene.ambiLight.baseIntensity * p;

    if (p < 0.2) {
      city.lights.forEach((l) => l.visible = true);
    }
  } else if (progress >= 0 && progress < endSunrise){
    let p = progress/endSunrise;
    document.body.style.background = `#${shadeColor(0xffc2c2, p-1).toString(16).substr(1)}`;
    scene.sun.intensity = scene.sun.baseIntensity * p;
    scene.hemiLight.intensity = scene.hemiLight.baseIntensity * p;
    scene.ambiLight.intensity = scene.ambiLight.baseIntensity * p;
    city.clouds.forEach((c) => c.material.emissiveIntensity = p);
    if (p > 0.2) {
      city.lights.forEach((l) => l.visible = false);
    }
  }
  if (isNight) {
    scene.sun.visible = false;
  } else {
    scene.sun.visible = true;
  }
  scene.sun.position.y = sunRadius*Math.sin(angle);
  scene.sun.position.x = sunRadius*Math.cos(angle);
  scene.render();

  requestAnimationFrame(render);
}

// Initial setup
let city;
const statusEl = document.getElementById('city-status');

let loadWait = setInterval(() => {
  api.get('/state/game', ({state}) => {
    if (state == 'ready' || state == 'fastforward') {

      if (state == 'ready') {
        statusEl.style.display = 'none';
      } else {
        statusEl.innerHTML = 'Going to the future...';
      }
      clearInterval(loadWait);
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
        HUD.createCharts(state);

        render();
      });
    } else if (state == 'finished') {
      statusEl.innerHTML = 'Waiting for the next session to start...';
    }
  });
}, 500);
