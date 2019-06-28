import config from '../config';
import * as THREE from 'three';
import common from './buildings/common';
import makeTower from './buildings/tower';
import makeHouse from './buildings/house';

class Unit {
  constructor(unit, mesh) {
    this.mesh = mesh;
    this.mesh.obj = this;
    this.data = {};
    this.update(unit);
  }

  update(unit) {
    this.owner = unit.owner;

    let material = common.materials[this.owner.type];
    this.data.tooltip = `
      <div>Owner: ${unit.owner.type} ${unit.owner.id}</div>
      <div>Rent: $${unit.rent.toFixed(2)}</div>
      <div>Tenants: ${unit.tenants}</div>
      <div>Months vacant: ${unit.monthsVacant}</div>
    `;
    if (material !== this.material) {
      this.mesh.material = material;
    }
    this.material = material;
  }

  focus(c) {
    this.mesh.material = common.materials.focus;
  }

  unfocus() {
    this.mesh.material = this.material;
  }
}

class Building {
  constructor(units, nCommercial) {
    let nUnits = units.length;

    // Note: this assumes towers have units in multiples of 4
    let building = nUnits <= 3 ? makeHouse(nUnits) : makeTower(nUnits/4, nCommercial);
    this.group = building.group;

    this.units = {};
    this.commercial = building.commercial;
    building.units.forEach((mesh, i) => {
      let unit = units[i];
      let u = new Unit(unit, mesh);
      this.units[unit.id] = u;
    });
  }
}

export default Building;
