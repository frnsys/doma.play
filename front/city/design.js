import Scene from './3d/scene';
import Grid from './3d/grid';
import InteractionLayer from './3d/interact';
import dat from 'dat.gui';

const parcelColors = {
  'Empty': 0xffc2c2,
  'Residential': 0xffffff,
  'Park': 0x21b75f,
  'River': 0x2146b7
}

const scene = new Scene({});
const main = document.getElementById('main');
main.appendChild(scene.renderer.domElement);

// Initialize grid
const cellSize = 32;
const cols = 50, rows = 50;
const grid = new Grid(cols, rows, cellSize);
let selectedCell = null;
let neighborhoods = [{
  id: 0,
  name: 'Neighborhood 0',
  color: '#ff0000',
  desirability: 1
}];

const parcelTypes = ['Empty', 'Residential', 'Park', 'River'];

for (let col=0; col<cols; col++) {
  for (let row=0; row<rows; row++) {
    let data = {
      neighborhood: neighborhoods[0].name,
      neighborhoodId: 0,
      type: parcelTypes[0]
    };
    let cell = grid.setCellAt(col, row, parcelColors['Empty'], data);
    cell.mesh.obj = {
      data: {
        onClick: () => {
          if (selectedCell) selectedCell.unfocus();
          selectedCell = cell;
          Object.keys(cell.data).forEach((k) => {
            dummyCell[k] = cell.data[k];
          });

          // hack b/c dat.gui won't update
          // focused inputs
          document.activeElement.blur()
          cgui.updateDisplay();
        },
        tooltip: () => cell.data.type
      },
      focus: cell.focus.bind(cell),
      unfocus: () => {
        if (selectedCell !== cell) {
          cell.unfocus();
        }
      }
    }
  }
}

const guis = {};
const control = {
  addNeighborhood: () => {
    let id = Math.max.apply(Math, neighborhoods.map((n) => n.id)) + 1;
    let n = {
      id: id,
      name: `Neighborhood ${id}`,
      color: '#ff0000',
      desirability: 1
    };
    neighborhoods.push(n);
    makeNeighborhoodGUI(n);
  }
};

function makeNeighborhoodGUI(n) {
  let ngui = gui.addFolder(n.name);
  let name = ngui.add(n, 'name');
  name.onFinishChange((val) => {
    ngui.domElement.getElementsByClassName('title')[0].innerHTML = val;
    updateNeighbOpts();

    // Rename in UI as necessary
    grid.cells.map(c => {
      if (c.data.neighborhoodId == n.id) {
        c.data.neighborhood = val;
      }
    });
    if (selectedCell.neighborhoodId = n.id) {
      selectedCell.neighborhood = val;
    }
  });
  ngui.addColor(n, 'color');
  ngui.add(n, 'desirability').min(0).step(1);
  ngui.add({
    delete: () => {
      gui.removeFolder(guis[n.id]);
      delete guis[n.id];
      neighborhoods.splice(neighborhoods.findIndex((n_) => n_.id == n.id), 1);
      updateNeighbOpts();
    }
  }, 'delete');
  guis[n.id] = ngui;
  updateNeighbOpts();
}

let nOpts;
function updateNeighbOpts() {
  if (nOpts) {
    cgui.remove(nOpts);
  }
  let opts = ['None'].concat(neighborhoods.map(n => n.name));
  nOpts = cgui.add(dummyCell, 'neighborhood').options(opts)
}

let gui = new dat.GUI();

let cgui = gui.addFolder('Selected Cell');
let dummyCell = {
  neighborhood: 'None',
  type: parcelTypes[0]
};
cgui.add(dummyCell, 'type').options(parcelTypes).listen().onChange((t) => {
  selectedCell.color = parcelColors[t];
  selectedCell.data.type = t;
});
cgui.open();

gui.add(control, 'addNeighborhood').name('+Neighborhood');
neighborhoods.forEach(makeNeighborhoodGUI);


// Setup interactable objects
let selectables = grid.cells.map(c => c.mesh);
let ixn = new InteractionLayer(scene, selectables);
scene.add(grid.group);

scene.camera.position.z = 0;
scene.camera.position.y = 0;
scene.camera.position.x = 0;
scene.camera.zoom = 0.002;
scene.camera.lookAt(scene.scene.position);
scene.camera.updateProjectionMatrix();
scene.controls.enableRotate = false;

function render() {
  scene.render();
  requestAnimationFrame(render);
}
render();
