import api from '../api';
import config from './config';
import Grid from './3d/grid';
import Scene from './3d/scene';
import Building from './3d/building';
import InteractionLayer from './3d/interact';

const scene = new Scene({});
const main = document.getElementById('main');
main.appendChild(scene.renderer.domElement);

const stats = document.getElementById('stats');

let stateKey = null;
const unitsLookup = {};

function makeGrid(state) {
  let {map, buildings, units} = state;
  let grid = new Grid(map.cols, map.rows, config.cellSize);
  Object.keys(map.parcels).forEach((row) => {
    Object.keys(map.parcels[row]).forEach((col) => {
      let parcel = map.parcels[row][col];
      parcel.tooltip = `Neighborhood ${parcel.neighb}`;
      let color = config.neighbColors[parcel.neighb];
      let cell = grid.setCellAt(col, row, color, parcel);

      let b = buildings[`${row}_${col}`];
      let building = new Building(b.units.map(u => units[u]));
      cell.building = building;
      cell.mesh.add(building.group);

      // Make units easily accessible by id
      // so we can update them
      Object.keys(building.units).forEach((id) => {
        unitsLookup[id] = building.units[id];
      });
    });
  });

  // Rotate, so we view the grid isometrically
  grid.group.rotation.x = -Math.PI/2;
  return grid;
}

let lastTime = null;
function render(time) {
  // update every 2000ms
  if (!lastTime) {
    lastTime = time;
  } else if (time - lastTime > 2000) {
    lastTime = time;
    update();
  }
  scene.render();
  requestAnimationFrame(render);
}

function updateStats(state) {
  stats.innerHTML = `<ul>
    <li>Step ${state.time}</li>
    <li>Mean rent/sqft $${state.stats.mean_rent_per_area.toLocaleString()}</li>
    <li>Mean months vacant ${Math.round(state.stats.mean_months_vacant)}</li>
  </ul>`;
}

function update() {
  api.get('/state/key', (data) => {
    // Compare state keys to
    // see if state changed
    if (data.key !== stateKey) {
      api.get('/state', (state) => {
        stateKey = state.key;
        updateStats(state);

        // Update units
        Object.values(state.units).forEach((u) => {
          let unit = unitsLookup[u.id];
          unit.updateOwner(u.owner);
          unit.updateTooltip(u);
        });
      });
    }
  });
}

// Initial setup
api.get('/state', (state) => {
  stateKey = state.key;
  let grid = makeGrid(state);
  scene.add(grid.group);

  let selectables = [];
  grid.cells.filter((c) => c).forEach((c) => {
    selectables.push(c.mesh);
    if (c.building) {
      selectables = selectables.concat(Object.values(c.building.units).map((u) => u.mesh));
    }
  });
  let ixn = new InteractionLayer(scene, selectables);

  updateStats(state);
  render();
});
