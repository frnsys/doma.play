import config from '../config';
import * as THREE from 'three';

// To reduce redundancy/improve performance
const unitGeo = new THREE.BoxGeometry(
  config.unitSize, config.unitSize, config.unitHeight);
const materials = Object.keys(config.colors).reduce((acc, k) => {
  acc[k] = new THREE.MeshLambertMaterial({
    color: config.colors[k]
  });
  return acc;
}, {});
const focusMaterial = new THREE.MeshLambertMaterial({
  color: config.focusColor
});


class Unit {
  constructor(unit) {
    this.owner = unit.owner;

    let mat = materials[unit.owner.type];
    this.mesh = new THREE.Mesh(unitGeo, mat);
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
    this.mesh.material = materials[owner.type];
  }

  focus(c) {
    this.mesh.material = focusMaterial;
  }

  unfocus() {
    this.mesh.material = materials[this.owner.type];
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
