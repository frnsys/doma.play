import * as THREE from 'three';

const unitHeight = 5;
const unitSize = 10;

const colors = {
  'Tenant': 0xfced1b,
  'Developer': 0x1b84fc
}

class Unit {
  constructor(unit) {
    this.color = colors[unit.owner.type];
    let mat = new THREE.MeshLambertMaterial({color: this.color});
    let geo = new THREE.BoxGeometry(unitSize, unitSize, unitHeight);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.obj = this;
    this.data = {
      tooltip: `<div>Owner: ${unit.owner.type} ${unit.owner.id}</div><div>Rent: $${unit.rent.toFixed(2)}</div>`
    };
  }

  updateColor(owner) {
    this.color = colors[owner.type];
    this.setColor(this.color);
  }

  setColor(c) {
    this.mesh.material.color.setHex(c);
  }
}

class Building {
  constructor(units) {
    let nUnits = units.length;
    this.units = {};
    this.unitMeshes = [];
    let height = unitHeight * nUnits;

    this.group = new THREE.Group();
    units.forEach((unit, i) => {
      let u = new Unit(unit);
      u.mesh.position.z = i * unitHeight;
      this.unitMeshes.push(u.mesh);
      this.group.add(u.mesh);
      this.units[unit.id] = u;
    });

    this.group.position.z = unitHeight/2;
  }
}

export default Building;
