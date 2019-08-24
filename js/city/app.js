import api from '../api';
import config from './config';
import HUD from './hud';
import City from './3d/city';
import Scene from './3d/scene';
import {shadeColor} from './3d/color';
import InteractionLayer from './3d/interact';

import * as THREE from 'three';

const scene = new Scene({});
const main = document.getElementById('main');
const players = document.getElementById('n_players');
main.appendChild(scene.renderer.domElement);

// NOTE: this doesn't work unless user explicitly
// allows autoplay
// document.getElementById('audio').play();

const playerPositions = {};
const loader = new THREE.FontLoader();
const textMat = new THREE.MeshLambertMaterial({
  color: 0x222222
});
const arrowGeo = new THREE.ConeBufferGeometry(4, 8, 4);
const arrowMat = new THREE.MeshBasicMaterial({
  color: 0xf1f442
});

function labelCell(cell, label, font) {
  let labelGroup = new THREE.Group();
  let buildingHeight = 0;
  if (cell.building) {
    let box = new THREE.Box3().setFromObject(cell.building.group);
    buildingHeight = box.getSize().y;
  }

  let arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
  arrowMesh.rotation.x = -Math.PI/2;
  labelGroup.add(arrowMesh);

  let textGeo = new THREE.TextGeometry(label, {
    font: font,
    size: 10,
    height: 2,
    curveSegments: 6,
    bevelEnabled: false,
  });
  let textMesh = new THREE.Mesh(textGeo, textMat);

  // Center text
  let bbox = new THREE.Box3().setFromObject(textMesh);
  bbox.center(textMesh.position);
  textMesh.rotation.x = Math.PI/2;
  textMesh.position.multiplyScalar(-1);
  textMesh.position.z = 8;
  textMesh.position.y = 0;
  labelGroup.add(textMesh);

  cell.mesh.add(labelGroup);
  labelGroup.position.z = buildingHeight + 15;

  return labelGroup;
}


let lastState;
function update() {
  api.get('/play/players', (data) => {
    players.innerHTML = Object.keys(data.players).length;
    loader.load('/static/helvetiker_bold.typeface.json', (font) => {
      Object.keys(data.players).forEach((id) => {
        let tenant = data.players[id];
        if (!tenant.unit) {
          if (id in playerPositions) {
            playerPositions[id].parent.remove(playerPositions[id]);
            delete playerPositions[id];
          }
        } else {
          let cell = city.grid.cellAt(tenant.unit.pos[1], tenant.unit.pos[0]);
          if (id in playerPositions) {
            if (playerPositions[id].parent !== cell.mesh) {
              playerPositions[id].parent.remove(playerPositions[id]);
              playerPositions[id] = labelCell(cell, `Player ${id.slice(0, 4)}`, font);
            }
          } else {
            playerPositions[id] = labelCell(cell, `Player ${id.slice(0, 4)}`, font);
          }
        }
      });
      Object.keys(playerPositions).forEach((id) => {
        if (!(id in data.players)) {
          playerPositions[id].parent.remove(playerPositions[id]);
          delete playerPositions[id];
        }
      });
    });
  });

  api.get('/state/key', (data) => {
    // Compare state keys to
    // see if state changed
    if (data.key !== stateKey) {
      api.get('/status', ({state}) => {
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

    // if (p < 0.2) {
    //   city.lights.forEach((l) => l.visible = true);
    // }
  } else if (progress >= 0 && progress < endSunrise){
    let p = progress/endSunrise;
    document.body.style.background = `#${shadeColor(0xffc2c2, p-1).toString(16).substr(1)}`;
    scene.sun.intensity = scene.sun.baseIntensity * p;
    scene.hemiLight.intensity = scene.hemiLight.baseIntensity * p;
    scene.ambiLight.intensity = scene.ambiLight.baseIntensity * p;
    city.clouds.forEach((c) => c.material.emissiveIntensity = p);
    // if (p > 0.2) {
    //   city.lights.forEach((l) => l.visible = false);
    // }
  }
  // if (isNight) {
  //   scene.sun.visible = false;
  // } else {
  //   scene.sun.visible = true;
  // }
  scene.sun.position.y = sunRadius*Math.sin(angle);
  scene.sun.position.x = sunRadius*Math.cos(angle);
  scene.render();

  requestAnimationFrame(render);
}

// Initial setup
let city;
const statusEl = document.getElementById('city-status');

let loadWait = setInterval(() => {
  api.get('/status', ({state}) => {
    // TODO update
    if (state == 'ready' || state == 'fastforward' || state == 'inprogress') {
      if (state == 'ready' || state == 'inprogress') {
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
