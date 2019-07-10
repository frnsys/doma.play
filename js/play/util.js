import config from '../city/config';

function distance(a, b) {
  let [x1, y1] = a;
  let [x2, y2] = b;
  return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
}

function dateFromTime(time) {
  return `${(time % 12) + 1}/${config.startYear + Math.floor(time/12)}`;
}

function randomChoice(choices) {
  return choices[Math.floor(Math.random() * choices.length)];
}

function randomWeightedChoice(choices, weights) {
  let total = weights.reduce((acc, w) => acc + w, 0);
  let roll = Math.random() * total;
  let sum = 0;
  for (let i=0; i<weights.length; i++) {
    sum += weights[i];
    if (roll <= sum) {
      return choices[i];
    }
  }
}

export default { distance, dateFromTime, randomChoice, randomWeightedChoice };
