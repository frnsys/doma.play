import config from '../config';
import * as THREE from 'three';
import {shadeColor} from './color';

const colorCache = {};
const mat = new THREE.MeshBasicMaterial({ vertexColors: THREE.VertexColors });

function setColor(geo, color) {
  let colors = [
    0xffb5d0,
    color,
    shadeColor(color, -0.25),
    color,
    color,
    shadeColor(color, 0.4),
    0xffb5d0,
    color,
  ];
  colors = colors.map((c) => {
    if (!(c in colorCache)) {
      colorCache[c] = new THREE.Color(c);
    }
    return colorCache[c];
  });
  geo.faces.forEach(function(face) {
    face.vertexColors[0] = colors[face['a']];
    face.vertexColors[1] = colors[face['b']];
    face.vertexColors[2] = colors[face['c']];
  });
  geo.elementsNeedUpdate = true;
}

class Unit {
  constructor(unit) {
    this.owner = unit.owner;

    let color = config.colors[unit.owner.type];
    let geo = new THREE.BoxGeometry(config.unitSize, config.unitSize, config.unitHeight);
    this.mesh = new THREE.Mesh(geo, mat);
    setColor(geo, color);

    this.mesh.obj = this;
    this.data = {};
    this.updateTooltip(unit);
  }

  updateTooltip(unit) {
    this.data.tooltip = `
      <div>Owner: ${unit.owner.type} ${unit.owner.id}</div>
      <div>Rent: $${unit.rent.toFixed(2)}</div>
      <div>Months vacant: ${unit.monthsVacant}</div>
    `;
  }

  updateOwner(owner) {
    this.owner = owner;
  }

  focus(c) {
    setColor(this.mesh.geometry, 0xff0000);
  }

  unfocus() {
    let color = config.colors[this.owner.type];
    setColor(this.mesh.geometry, color);
  }
}

class Building {
  constructor(units) {
    let nUnits = units.length;
    this.units = {};
    let height = config.unitHeight * nUnits;

    // Create units as layers/floors in the building
    this.group = new THREE.Group();
    units.forEach((unit, i) => {
      let u = new Unit(unit);
      u.mesh.position.z = i * config.unitHeight;
      this.group.add(u.mesh);
      this.units[unit.id] = u;
    });

    // So bottom of building
    // is flush with floor
    this.group.position.z = config.unitHeight/2;
  }
}

export default Building;
