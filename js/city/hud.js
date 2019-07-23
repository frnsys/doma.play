import Chart from 'chart.js';
import config from './config';

const stage = document.getElementById('chart');
const bar = document.getElementById('sparks');
const time = document.getElementById('time');
const chartCycleSec = 10;

Chart.defaults.scale.ticks.fontSize = 9;
Chart.defaults.scale.ticks.fontFamily = 'monospace';
const statHistoryLength = 50;
const chartStats = [
  'mean_adjusted_rent_per_area',
  'mean_value_per_area',
  'mean_price_to_rent_ratio',
  'percent_homeless',
  'doma_property_fund',
];
const shortNames = [
  'rent',
  'value',
  'ptr',
  'hl',
  'fund',
];
const charts = {};

function createCharts(state) {
  let focusIdx = 0;
  let chartEls = [];

  chartStats.forEach((k, i) => {
    let spark = createChart(k, state.stats[k], true);
    let parentEl = document.createElement('div');
    parentEl.className = 'chart';
    parentEl.dataset.key = k;
    parentEl.appendChild(spark.chartEl);

    let groupEl = document.createElement('div');
    let titleEl = document.createElement('span');
    titleEl.className = 'chart-title';
    groupEl.className = 'chart-group';
    titleEl.innerText = shortNames[i];

    groupEl.appendChild(titleEl);
    groupEl.appendChild(parentEl);
    bar.appendChild(groupEl);

    let {chart, chartEl} = createChart(k, state.stats[k], false);
    parentEl = document.createElement('div');
    parentEl.className = 'chart';
    parentEl.appendChild(chartEl);
    stage.appendChild(parentEl);
    charts[k] = {
      spark: spark.chart,
      focus: chart
    };
    chartEls.push({
      spark: groupEl,
      focus: parentEl
    });
  });

  chartEls[focusIdx].focus.style.display = 'block';
  chartEls[focusIdx].spark.classList.add('focused-chart');
  setInterval(() => {
    chartEls[focusIdx].focus.style.display = 'none';
    chartEls[focusIdx].spark.classList.remove('focused-chart');
    focusIdx++;
    if (focusIdx > chartEls.length-1) {
      focusIdx = 0;
    }
    chartEls[focusIdx].focus.style.display = 'block';
    chartEls[focusIdx].spark.classList.add('focused-chart');
  }, chartCycleSec * 1000);
}

function createChart(name, stats, spark) {
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
        display: !spark,
        labels: {
          boxWidth: 2,
          fontSize: 13,
          fontFamily: 'monospace'
        }
      },
      scales: {
        yAxes: [{
          ticks: {
            min: 0
          },
          display: !spark
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
    let chs = charts[k];
    ['spark', 'focus'].forEach((t) => {
      let chart = chs[t];
      chart.data.datasets.forEach((dataset) => {
        dataset.data.push(state.stats[dataset.label]);
        dataset.data = dataset.data.splice(Math.max(0, dataset.data.length - statHistoryLength))
      });
      chart.update();
    });
  });
}

function updateStats(state) {
  time.innerHTML = `${(state.time % 12) + 1}/${config.startYear + Math.floor(state.time/12)}`;
}

export default {updateStats, updateCharts, createCharts};
