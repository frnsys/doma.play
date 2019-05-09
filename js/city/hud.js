import Chart from 'chart.js';

const hud = document.getElementById('hud');
const stats = document.getElementById('stats');

Chart.defaults.scale.ticks.display = false;
const statHistoryLength = 50;
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
      animation: {
        duration: 0
      },
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

function updateStats(state) {
  stats.innerHTML = `<ul>
    <li>Step ${state.time}</li>
    <li>Vacant ${(state.stats.percent_vacant*100).toFixed(2)}%</li>
    <li>Homeless ${(state.stats.percent_homeless*100).toFixed(2)}%</li>
    <li>Mean rent/sqft $${state.stats.mean_rent_per_area.toLocaleString()}</li>
    <li>Mean months vacant ${Math.round(state.stats.mean_months_vacant)}</li>
  </ul>`;
}

export default {updateStats, updateChart, createChart};
