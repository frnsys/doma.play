function distance(a, b) {
  let [x1, y1] = a;
  let [x2, y2] = b;
  return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
}

function dateFromTime(time) {
  return `${(time % 12) + 1}/${config.startYear + Math.floor(time/12)}`;
}

function randomChoice(choices) {
  return choices[Math.floor(Math.random() * choices.length - 1)];
}

export default { distance, dateFromTime, randomChoice };
