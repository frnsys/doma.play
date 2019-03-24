import * as THREE from 'three';

const unitHeight = 5;
const unitSize = 10;

const colors = {
  'Tenant': 0xfced1b,
  'Developer': 0x1b84fc
}

class Building {
  constructor(units) {
    let nUnits = units.length;
    this.units = units;
    this.unitMeshes = [];
    let height = unitHeight * nUnits;

    this.group = new THREE.Group();
    units.forEach((unit, i) => {
      let color = colors[unit.owner.type];
      let mat = new THREE.MeshLambertMaterial({color: color});
      let geo = new THREE.BoxGeometry(unitSize, unitSize, unitHeight);
      let mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = i * unitHeight;
      mesh.obj = {
        color: color,
        setColor: (c) => {
          mesh.material.color.setHex(c);
        },
        data: {
          tooltip: `Owner: ${unit.owner.type} ${unit.owner.id}`
        }
      };
      this.unitMeshes.push(mesh);
      this.group.add(mesh);
    });

    this.group.position.z = unitHeight/2;
  }
}

export default Building;
