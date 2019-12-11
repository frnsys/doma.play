import api from '../api';
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
const defaultCity = {
  name: 'New City',
  maxBedrooms: 4,
  pricePerSqm: 100,
  priceToRentRatio: 10,
  landlords: 10,
  incomeMu: 9,
  incomeSigma: 1
};

// Prepare new design
if (Object.keys(design).length === 0) {
  design.map = [];
  design.neighborhoods = [{...defaultNeighborhood}];
  design.city = defaultCity;
}

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
      let neighborhood = design.neighborhoods.filter(n => n.name == cell.data.neighborhood)[0];
      cell.color = parseInt(neighborhood.color.substring(1), 16);
    }
  } else {
    cell.color = parcelColors[t];
  }
}

function loadMap(map) {
  let layout = map.layout;
  let nRows = layout.length;
  let nCols = layout[0].length;
  let rShift = Math.round(rows/2) - Math.round(nRows/2);
  let cShift = Math.round(cols/2) - Math.round(nCols/2);
  if (cShift % 2 != map.offset.col) cShift++;

  // Set grid cell data
  layout.forEach((row, r) => {
    row.forEach((d, c) => {
      if (d === null) return;
      let [neighborhoodId, type] = d.split('|');
      let cell = grid.cellAt(r+rShift, c+cShift);
      let neighborhoodName;
      let neighb;
      if (neighborhoodId == -1) {
        neighborhoodName = 'None';
      } else {
        neighb = design.neighborhoods.filter((n) => n.id == neighborhoodId)[0];
        neighborhoodName = neighb ? neighb.name : 'UNDEFINED';
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

// Serialize design to JSON
function serialize() {
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
  let minRow = null, minCol = null;
  let layout = map.map((row) => row.slice(colStart, colEnd).map(c => {
    if (minRow == null || c.row < minRow) minRow = c.row;
    if (minCol == null || c.col < minCol) minCol = c.col;
    if (c.data.type == 'Empty') return null;
    return `${c.data.neighborhoodId}|${c.data.type}`;
  }));
  let data = {
    map: {
      offset: {
        row: minRow % 2 != 0,
        col: minCol % 2 != 0
      },
      layout: layout
    },
    neighborhoods: design.neighborhoods.reduce((acc, n) => {
      acc[n.id] = n;
      return acc;
    }, {}),
    city: design.city
  };
  return JSON.stringify(data, null, 2);
}

// Importing map data
const formEl = document.getElementById('form');
const formInputEl = document.getElementById('form-input');
formEl.onclick = function(ev) {
  if (ev.target == this) {
    formEl.style.display = 'none';
    let source = JSON.parse(formInputEl.value);
    loadDesign(source);
  }
};

// Prep GUI
const gui = new dat.GUI();
const control = {
  addNeighborhood: () => {
    let id = Math.max.apply(Math, design.neighborhoods.map((n) => n.id)) + 1;
    let n = {...defaultNeighborhood};
    n.id = id;
    n.name = `Neighborhood ${id}`;
    design.neighborhoods.push(n);
    makeNeighborhoodGUI(n);
  },

  save: () => {
    let data = serialize();
    api.post(window.location.pathname, data, () => {
      toast('Saved.');
    });
  },

  // View map source
  source: () => {
    // Show export data
    formInputEl.value = serialize();
    formEl.style.display = 'block';
  }
};
gui.add(control, 'save');
gui.add(control, 'source');


const citygui = gui.addFolder('City');
citygui.add(design.city, 'name');
citygui.add(design.city, 'maxBedrooms').min(1).step(1);
citygui.add(design.city, 'pricePerSqm').min(0).step(1);
citygui.add(design.city, 'priceToRentRatio').min(1).step(1);
citygui.add(design.city, 'landlords').min(0).step(1);
citygui.add(design.city, 'incomeMu').min(0);
citygui.add(design.city, 'incomeSigma').min(0);
citygui.open();

// Selected cell GUI
const cgui = gui.addFolder('Selected Cell');
const dummyCell = {...defaultCellData};
cgui.add(dummyCell, 'type').options(parcelTypes).listen().onChange((t) => {
  selectedCells.forEach(c => {
    c.data.type = t;
    updateCellColor(c);
  });
  updateCityLimits();
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
  ngui.add(n, 'minUnits').min(0).step(1).onChange(updateCityLimits);
  ngui.add(n, 'maxUnits').step(1).onChange(updateCityLimits);
  ngui.add(n, 'minArea').min(0).step(1).onChange(updateCityLimits);
  ngui.add(n, 'maxArea').min(0).step(1).onChange(updateCityLimits);
  ngui.add(n, 'sqmPerOccupant').min(1).step(1).onChange(updateCityLimits);
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
      design.neighborhoods.splice(design.neighborhoods.findIndex((n_) => n_.id == n.id), 1);
      updateNeighbOpts();
    }
  }, 'delete');
  nguis[n.id] = ngui;
  updateNeighbOpts();
}

gui.add(control, 'addNeighborhood').name('+Neighborhood');

function loadDesign(source) {
  // Reset grid
  grid.cells.forEach((c) => {
    c.color = parcelColors['Empty'];
    c.setColor(c.color);
    c.data = {...defaultCellData};
  });

  // Set neighborhoods & their UIs
  design.neighborhoods = Object.values(source.neighborhoods);
  Object.keys(nguis).forEach((k) => {
    gui.removeFolder(nguis[k]);
    delete nguis[k];
  });
  design.neighborhoods.forEach((n) => {
    makeNeighborhoodGUI(n);
  });

  design.city = source.city || defaultCity;

  // Try to center map
  if (source.map.layout && source.map.layout.length > 0) loadMap(source.map);

  updateCityLimits();
}
loadDesign(design);

// Compute unit and occupancy ranges
function updateCityLimits() {
  let el = document.getElementById('meta');
  let unitsMin = 0;
  let unitsMax = 0;
  let occupancyMin = 0;
  let occupancyMax = 0;
  grid.cells.map(c => {
    if (c.data.neighborhoodId in design.neighborhoods && c.data.type == 'Residential') {
      let neighb = design.neighborhoods[c.data.neighborhoodId];
      unitsMin += neighb.minUnits;
      unitsMax += neighb.maxUnits;
      occupancyMin += Math.floor(neighb.minUnits);
      occupancyMax += Math.floor(neighb.maxUnits * design.city.maxBedrooms);
    }
  });
  el.innerHTML = `Units: ${unitsMin}-${unitsMax}<br />Occupancy: ${occupancyMin}-${occupancyMax}`;
}


// For updating neighborhood selection dropdown
let nOpts;
function updateNeighbOpts() {
  if (nOpts) cgui.remove(nOpts);
  let opts = ['None'].concat(design.neighborhoods.map(n => n.name));
  nOpts = cgui.add(dummyCell, 'neighborhood').options(opts).onChange((name) => {
    selectedCells.forEach((c) => {
      c.data.neighborhood = name;
      updateCellColor(c);

      if (name == 'None') {
        c.data.neighborhoodId = -1;
      } else {
        let neighborhood = design.neighborhoods.filter(n => n.name == name)[0];
        c.data.neighborhoodId = neighborhood.id;
      }
    });
    updateCityLimits();
  });
}

// Setup scene
const scene = new Scene({
  brightness: 0.9
});
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

// Simple toast
function toast(msg) {
  const toastEl = document.createElement('div');
  toastEl.style.position = 'fixed';
  toastEl.style.top = '10px';
  toastEl.style.left = '10px';
  toastEl.innerText = msg;
  toastEl.style.opacity = 2;
  document.body.appendChild(toastEl);
  const fadeOut = setInterval(() => {
    toastEl.style.opacity = parseFloat(toastEl.style.opacity) - 0.025;
    if (toastEl.style.opacity <= 0) {
      document.body.removeChild(toastEl);
      clearInterval(fadeOut);
    }
  }, 10);
}

function render() {
  scene.render();
  requestAnimationFrame(render);
}
render();
