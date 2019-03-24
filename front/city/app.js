import api from '../api';
import Grid from './3d/grid';
import Scene from './3d/scene';
import InteractionLayer from './3d/interact';

const cellSize = 28;
let color = 0x23ce61;
const scene = new Scene({});
const main = document.getElementById('main');
main.appendChild(scene.renderer.domElement);

function makeGrid(map) {
  let grid = new Grid(map.cols, map.rows, cellSize);
  Object.keys(map.parcels).forEach((row) => {
    Object.keys(map.parcels[row]).forEach((col) => {
      let parcel = map.parcels[row][col];
      parcel.tooltip = 'testing';
      grid.setCellAt(col, row, color, parcel);
    });
  });
  return grid;
}

function render(time) {
  scene.render();
  requestAnimationFrame(render);
}

api.get('/state', (state) => {
  let grid = makeGrid(state.map);
  // rotate, so we view the grid isometrically
  grid.group.rotation.x = -Math.PI / 2;
  scene.add(grid.group);
  let ixn = new InteractionLayer(scene, grid.cells.map((c) => c.mesh));
  render();
});
