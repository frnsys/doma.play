import api from '../api';
import Grid from './3d/grid';
import Scene from './3d/scene';

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
  scene.add(grid.group);

  render();
});
