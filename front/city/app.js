import api from '../api';
import config from './config';
import Grid from './3d/grid';
import Scene from './3d/scene';
import Building from './3d/building';
import InteractionLayer from './3d/interact';
import Chart from 'chart.js';

const scene = new Scene({});
const main = document.getElementById('main');
main.appendChild(scene.renderer.domElement);

const hud = document.getElementById('hud');
const stats = document.getElementById('stats');

Chart.defaults.scale.ticks.display = false;
const statHistoryLength = 10;
const chartStats = ['mean_rent_per_area'];

function createChart(state) {
  let chart = document.createElement('canvas');
  hud.appendChild(chart);

  return new Chart(chart, {
    type: 'line',
    data: {
      labels: [...Array(statHistoryLength)].map((_, i) => -i).reverse(),
      datasets: chartStats.map((k) => {
        return {
          label: k,
          fill: false,
          borderWidth: 1,
          pointRadius: 0,
          backgroundColor: 'rgb(255,0,0)',
          borderColor: 'rgb(255,0,0)',
          data: [state.stats[k]]
        };
      })
    },
    options: {
      legend: {
        labels: {
          boxWidth: 2,
          fontSize: 9,
          fontFamily: 'monospace'
        }
      }
    }
  });
}

function updateChart(chart, state) {
  chart.data.datasets.forEach((dataset) => {
    dataset.data.push(state.stats[dataset.label]);
    dataset.data = dataset.data.splice(Math.max(0, dataset.data.length - statHistoryLength))
  });
  chart.update();
}

let stateKey = null;
const unitsLookup = {};

function makeGrid(state) {
  let {map, buildings, units, neighborhoods} = state;
  let grid = new Grid(map.cols, map.rows, config.cellSize);
  Object.keys(map.parcels).forEach((row) => {
    Object.keys(map.parcels[row]).forEach((col) => {
      let parcel = map.parcels[row][col];
      let neighb = neighborhoods[parcel.neighb];
      parcel.tooltip = `
        <div>Neighborhood ${parcel.neighb}</div>
        <div>Desirability: ${neighb.desirability}</div>
      `;
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
    <li>Num units ${Object.keys(unitsLookup).length}</li>
    <li>Vacant ${(state.stats.percent_vacant*100).toFixed(2)}%</li>
    <li>Homeless ${(state.stats.percent_homeless*100).toFixed(2)}%</li>
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
        updateChart(statsChart, state);

        // Update units
        Object.values(state.units).forEach((u) => {
          let unit = unitsLookup[u.id];
          unit.update(u);
        });
      });
    }
  });
}

let statsChart;

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
  statsChart = createChart(state);
  render();
});
