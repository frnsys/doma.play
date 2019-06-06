import Chart from 'chart.js';
import config from './config';

const hud = document.getElementById('charts');
const time = document.getElementById('time');

Chart.defaults.scale.ticks.fontSize = 9;
Chart.defaults.scale.ticks.fontFamily = 'monospace';
const statHistoryLength = 50;
const chartStats = [
  'mean_adjusted_rent_per_area',
  'percent_homeless',
  'mean_value_per_area',
  'mean_price_to_rent_ratio',
  'doma_property_fund',
  'doma_units'
];
const charts = {};

function createCharts(state) {
  chartStats.forEach((k) => {
    let {chart, chartEl} = createChart(k, state.stats[k]);
    let parentEl = document.createElement('div');
    parentEl.className = 'chart';
    parentEl.dataset.key = k;
    parentEl.appendChild(chartEl);
    hud.appendChild(parentEl);
    charts[k] = chart;
  });
}

function createChart(name, stats) {
  let chartEl = document.createElement('canvas');
  let chart = new Chart(chartEl, {
    type: 'line',
    data: {
      labels: [...Array(statHistoryLength)].map((_, i) => -i).reverse(),
      datasets: [{
        label: name,
        fill: false,
        borderWidth: 1,
        pointRadius: 0,
        backgroundColor: 'rgb(255,255,255)',
        borderColor: 'rgb(255,255,255)',
        data: [stats]
      }]
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
      },
      scales: {
        yAxes: [{
          ticks: {
            min: 0
          }
        }],
        xAxes: [{
          display: false
        }]
      }
    }
  });
  return {chart, chartEl};
}

function updateCharts(state) {
  Object.keys(charts).forEach((k) => {
    let chart = charts[k];
    chart.data.datasets.forEach((dataset) => {
      dataset.data.push(state.stats[dataset.label]);
      dataset.data = dataset.data.splice(Math.max(0, dataset.data.length - statHistoryLength))
    });
    chart.update();
  });
}

function updateStats(state) {
  time.innerHTML = `${(state.time % 12) + 1}/${config.startYear + Math.floor(state.time/12)}`;
}

export default {updateStats, updateCharts, createCharts};
