import Scene from './3d/scene';
import Grid from './3d/grid';
import InteractionLayer from './3d/interact';
import dat from 'dat.gui';
import {shadeColor} from './3d/color';

// Config
const parcelColors = {
  'Empty': 0xffc2c2,
  'Residential': 0xffffff,
  'Park': 0x21b75f,
  'River': 0x2146b7
}
const noneNeighbColor = 0xffd4c1;
const parcelTypes = ['Empty', 'Residential', 'Park', 'River'];

// Prepare grid
const cellSize = 32;
const cols = 50, rows = 50;
const grid = new Grid(cols, rows, cellSize);
const defaultNeighborhood = {
  id: 0,
  name: 'Neighborhood 0',
  color: '#ff0000',
  desirability: 1,
  minUnits: 8,
  maxUnits: 12,
  pricePerSqm: 10000,
  minArea: 200,
  maxArea: 500,
  sqmPerOccupant: 100,
  pCommercial: 0.1,
}
const defaultCellData = {
  neighborhood: 'None',
  neighborhoodId: -1,
  type: parcelTypes[0]
}
let neighborhoods = [{...defaultNeighborhood}];
let selectedCells = [];

// Initialize grid cells
for (let col=0; col<cols; col++) {
  for (let row=0; row<rows; row++) {
    let cell = grid.setCellAt(col, row, parcelColors['Empty'], {...defaultCellData});
    cell.mesh.obj = {
      data: {
        onClick: (ev) => {
          if (!ev.shiftKey) {
            // Reset selection
            if (selectedCells) selectedCells.forEach(c => c.unfocus());
            selectedCells = [cell];
          } else {
            if (selectedCells.includes(cell)) {
              selectedCells = selectedCells.filter(c => c !== cell);
            } else {
              selectedCells.push(cell);
            }
          }

          Object.keys(selectedCells[0].data).forEach((k) => {
            dummyCell[k] = cell.data[k];
          });

          // hack b/c dat.gui won't update
          // focused inputs
          document.activeElement.blur()
          cgui.updateDisplay();
        },
        tooltip: () => `${cell.data.type} (${cell.data.neighborhood})`
      },
      focus: (ev) => {
        if (cell.data.type == 'Empty') {
          cell.focus();
        } else {
          cell.setColor(shadeColor(cell.color, 0.4));
        }
        if (ev.shiftKey && ev.ctrlKey) {
          selectedCells.push(cell);
        }
      },
      unfocus: () => {
        if (!selectedCells.includes(cell)) {
          cell.unfocus();
        }
      }
    }
  }
}


// Update cell color
function updateCellColor(cell) {
  let t = cell.data.type;
  if (t == 'Residential' || t == 'Commercial') {
    if (cell.data.neighborhood == 'None') {
      cell.color = noneNeighbColor;
    } else {
      let neighborhood = neighborhoods.filter(n => n.name == cell.data.neighborhood)[0];
      cell.color = parseInt(neighborhood.color.substring(1), 16);
    }
  } else {
    cell.color = parcelColors[t];
  }
}

// Importing map data
const formEl = document.getElementById('form');
const formInputEl = document.getElementById('form-input');
formEl.onclick = function(ev) {
  if (ev.target == this) {
    formEl.style.display = 'none';
    let source = JSON.parse(formInputEl.value);

    // Reset grid
    grid.cells.forEach((c) => {
      c.color = parcelColors['Empty'];
      c.setColor(c.color);
      c.data = {...defaultCellData};
    });

    // Set neighborhoods & their UIs
    neighborhoods = Object.values(source.neighborhoods);
    Object.keys(nguis).forEach((k) => {
      gui.removeFolder(nguis[k]);
      delete nguis[k];
    });
    neighborhoods.forEach((n) => {
      makeNeighborhoodGUI(n);
    });

    // Try to center map
    if (source.map) {
      let nRows = source.map.length;
      let nCols = source.map[0].length;
      let rShift = Math.round(rows/2) - Math.round(nRows/2);
      let cShift = Math.round(cols/2) - Math.round(nCols/2);

      // Set grid cell data
      source.map.forEach((row, r) => {
        row.forEach((d, c) => {
          if (d === null) return;
          let [neighborhoodId, type] = d.split('|');
          let cell = grid.cellAt(r+rShift, c+cShift);
          let neighborhoodName;
          let neighb;
          if (neighborhoodId == -1) {
            neighborhoodName = 'None';
          } else {
            neighb = neighborhoods.filter((n) => n.id == neighborhoodId)[0];
            neighborhoodName = neighb.name;
          }
          cell.data = {
            neighborhood: neighborhoodName,
            neighborhoodId: neighborhoodId,
            type: type
          }

          updateCellColor(cell);
          cell.setColor(cell.color);
        });
      });
    }
  }
};

// Prep GUI
const gui = new dat.GUI();
const control = {
  addNeighborhood: () => {
    let id = Math.max.apply(Math, neighborhoods.map((n) => n.id)) + 1;
    let n = {...defaultNeighborhood};
    n.id = id;
    n.name = `Neighborhood ${id}`;
    neighborhoods.push(n);
    makeNeighborhoodGUI(n);
  },

  // View map source
  source: () => {
    let map = [];

    // Figure out rows
    let rowStart = -1, rowEnd = -1;
    grid.grid.forEach((row, i) => {
      let cells = row.filter((c) => c.data.type != 'Empty');
      // Start row index
      if (cells.length > 0 && rowStart < 0) {
        rowStart = i;
      }

      // End row index
      if (rowStart >= 0) {
        if (rowEnd < 0) {
          if (cells.length == 0) {
            rowEnd = i;
          } else {
            map.push(row);
          }
        }
      }
    });
    rowStart = rowStart == -1 ? 0 : rowStart;
    rowEnd = rowEnd == -1 ? grid.grid.length : rowEnd;

    // Figure out columns
    let colStart = -1, colEnd = -1;
    map.forEach((row) => {
      row.forEach((c, i) => {
        if (c.data.type == 'Empty') return;
        if (colStart < 0 || i < colStart) {
          colStart = i;
        }
      });

      row.slice().reverse().forEach((c, i) => {
        if (c.data.type == 'Empty') return;
        if (colEnd < 0 || i < colEnd) {
          colEnd = i;
        }
      })
    });
    colStart = colStart == -1 ? 0 : colStart;
    colEnd = colEnd == -1 ? grid.grid[0].length : grid.grid[0].length - colEnd;

    // Prepare export data
    let data = {
      map: map.map((row) => row.slice(colStart, colEnd).map(c => {
        if (c.data.type == 'Empty') return null;
        return `${c.data.neighborhoodId}|${c.data.type}`;
      })),
      neighborhoods: neighborhoods.reduce((acc, n) => {
        acc[n.id] = n;
        return acc;
      }, {})
    };
    let exported = JSON.stringify(data, null, 2);

    // Show export data
    formInputEl.value = exported;
    formEl.style.display = 'block';
  }
};
gui.add(control, 'source');

// Selected cell GUI
const cgui = gui.addFolder('Selected Cell');
const dummyCell = {...defaultCellData};
cgui.add(dummyCell, 'type').options(parcelTypes).listen().onChange((t) => {
  selectedCells.forEach(c => {
    c.data.type = t;
    updateCellColor(c);
  });
});
cgui.open();

// Neighborhood GUI
const nguis = {};
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
    if (dummyCell.neighborhoodId == n.id) {
      dummyCell.neighborhood = val;
    }
  });
  ngui.add(n, 'minUnits').min(0).step(1);
  ngui.add(n, 'maxUnits').step(1);
  ngui.add(n, 'pricePerSqm').min(0).step(1);
  ngui.add(n, 'minArea').min(0).step(1);
  ngui.add(n, 'maxArea').min(0).step(1);
  ngui.add(n, 'sqmPerOccupant').min(1).step(1);
  ngui.add(n, 'pCommercial').min(0).max(1).step(0.05);
  ngui.add(n, 'desirability').min(0).step(1);

  ngui.addColor(n, 'color').onFinishChange((val) => {
    grid.cells.map(c => {
      if (c.data.neighborhoodId == n.id) {
        c.color = parseInt(n.color.substring(1), 16);
        c.setColor(c.color);
      }
    });
  });
  ngui.add({
    delete: () => {
      gui.removeFolder(nguis[n.id]);
      delete nguis[n.id];
      neighborhoods.splice(neighborhoods.findIndex((n_) => n_.id == n.id), 1);
      updateNeighbOpts();
    }
  }, 'delete');
  nguis[n.id] = ngui;
  updateNeighbOpts();
}

gui.add(control, 'addNeighborhood').name('+Neighborhood');
neighborhoods.forEach(makeNeighborhoodGUI);

// For updating neighborhood selection dropdown
let nOpts;
function updateNeighbOpts() {
  if (nOpts) cgui.remove(nOpts);
  let opts = ['None'].concat(neighborhoods.map(n => n.name));
  nOpts = cgui.add(dummyCell, 'neighborhood').options(opts).onChange((name) => {
    selectedCells.forEach((c) => {
      c.data.neighborhood = name;
      updateCellColor(c);

      if (name == 'None') {
        c.data.neighborhoodId = -1;
      } else {
        let neighborhood = neighborhoods.filter(n => n.name == name)[0];
        c.data.neighborhoodId = neighborhood.id;
      }
    });
  });
}

// Setup scene
const scene = new Scene({});
const main = document.getElementById('main');
main.appendChild(scene.renderer.domElement);
scene.add(grid.group);
scene.camera.position.z = 0;
scene.camera.position.y = 0;
scene.camera.position.x = 0;
scene.camera.zoom = 0.002;
scene.camera.lookAt(scene.scene.position);
scene.camera.updateProjectionMatrix();
scene.controls.enableRotate = false;

// Setup interactable objects
let selectables = grid.cells.map(c => c.mesh);
let ixn = new InteractionLayer(scene, selectables);

function render() {
  scene.render();
  requestAnimationFrame(render);
}
render();
