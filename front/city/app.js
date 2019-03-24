import api from '../api';
import Grid from './3d/grid';
import Scene from './3d/scene';
import Building from './3d/building';
import InteractionLayer from './3d/interact';

const cellSize = 28;
const scene = new Scene({});
const main = document.getElementById('main');
let neighbColors = [
  0x26a842,
  0x1aef48,
  0x176828
];
main.appendChild(scene.renderer.domElement);

let stateKey = null;
const unitsLookup = {};

function makeGrid(map, buildings, units) {
  let grid = new Grid(map.cols, map.rows, cellSize);
  Object.keys(map.parcels).forEach((row) => {
    Object.keys(map.parcels[row]).forEach((col) => {
      let parcel = map.parcels[row][col];
      parcel.tooltip = `Neighborhood ${parcel.neighb}`;
      let color = neighbColors[parcel.neighb];
      let cell = grid.setCellAt(col, row, color, parcel);
      let b = buildings[`${row}_${col}`];
      let building = new Building(b.units.map(u => units[u]));
      Object.keys(building.units).forEach((id) => {
        unitsLookup[id] = building.units[id];
      });
      cell.building = building;
      cell.mesh.add(building.group);
    });
  });
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

function update() {
  api.get('/state/key', (data) => {
    if (data.key !== stateKey) {
      api.get('/state', (state) => {
        stateKey = state.key;
        Object.values(state.units).forEach((u) => {
          let unit = unitsLookup[u.id];
          unit.data.tooltip = `<div>Owner: ${u.owner.type} ${u.owner.id}</div><div>Rent: $${u.rent.toFixed(2)}</div><div>Months vacant: ${u.monthsVacant}</div>`;
          unit.updateColor(u.owner);
        });
      });
    }
  });
}

// Initial setup
api.get('/state', (state) => {
  stateKey = state.key;
  let grid = makeGrid(state.map, state.buildings, state.units);
  // rotate, so we view the grid isometrically
  grid.group.rotation.x = -Math.PI / 2;
  scene.add(grid.group);
  let selectables = grid.cells.filter((c) => c).map((c) => c.mesh);
  let buildings = grid.cells.filter((c) => c && c.building).map((c) => c.building);
  let units = buildings.reduce((acc, b) => {
    return acc.concat(b.unitMeshes);
  }, []);
  selectables = selectables.concat(units);
  let ixn = new InteractionLayer(scene, selectables);
  render();
});
