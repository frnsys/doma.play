import api from '../api';
import Grid from './3d/grid';
import Scene from './3d/scene';
import Building from './3d/building';
import InteractionLayer from './3d/interact';

const cellSize = 28;
let color = 0x23ce61;
const scene = new Scene({});
const main = document.getElementById('main');
main.appendChild(scene.renderer.domElement);

function makeGrid(map, buildings, units) {
  let grid = new Grid(map.cols, map.rows, cellSize);
  Object.keys(map.parcels).forEach((row) => {
    Object.keys(map.parcels[row]).forEach((col) => {
      let parcel = map.parcels[row][col];
      parcel.tooltip = `Neighborhood ${parcel.neighb}`;
      let cell = grid.setCellAt(col, row, color, parcel);
      let b = buildings[`${row}_${col}`];
      let building = new Building(b.units.map(u => units[u]));
      cell.building = building;
      cell.mesh.add(building.group);
    });
  });
  return grid;
}

function render(time) {
  scene.render();
  requestAnimationFrame(render);
}

api.get('/state', (state) => {
  let grid = makeGrid(state.map, state.buildings, state.units);
  // rotate, so we view the grid isometrically
  grid.group.rotation.x = -Math.PI / 2;
  scene.add(grid.group);
  let selectables = grid.cells.map((c) => c.mesh);
  let buildings = grid.cells.map((c) => c.building);
  let units = buildings.reduce((acc, b) => {
    return acc.concat(b.unitMeshes);
  }, []);
  selectables = selectables.concat(units);
  let ixn = new InteractionLayer(scene, selectables);
  render();
});
