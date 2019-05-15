import Grid from './grid';
import Building from './building';
import {shadeColor} from './color';
import * as THREE from 'three';
import config from '../config';

const commericalMat = new THREE.MeshLambertMaterial({color: 0xfcec99});

const treeHeight = 8;
const treeRadius = 2;
const treeGeo = new THREE.ConeBufferGeometry(treeRadius, treeHeight, 6);
const treeMat = new THREE.MeshLambertMaterial({color: 0x116b33});
const parkColor = 0x189a4a;

const boatGeo = new THREE.BoxBufferGeometry(6, 1.5, 1);
const boatMats = [
  new THREE.MeshLambertMaterial({color: 0xdddddd}),
  new THREE.MeshLambertMaterial({color: 0x990000})
];

function boat() {
  let boat = new THREE.Group();
  let mat = boatMats[Math.floor(Math.random() * boatMats.length)];
  let hull = new THREE.Mesh(boatGeo, mat);
  let top = new THREE.Mesh(boatGeo, mat);
  if (config.enableShadows) {
    top.castShadow = true;
    top.receiveShadow = true;
    hull.castShadow = true;
    hull.receiveShadow = true;
  }

  top.scale.set(0.7, 0.7, 0.7);
  top.position.z += 0.5;
  boat.add(hull);
  boat.add(top);
  boat.rotation.z = Math.random() * Math.PI * 2;
  boat.position.x = (Math.random() - 0.5) * 8;
  boat.position.y = (Math.random() - 0.5) * 8;
  return boat;
}

function forest() {
  let forest = new THREE.Group();
  let positions = [{
    x: -1,
    y: 0,
  }, {
    x: -4,
    y: 2,
  }, {
    x: 5,
    y: -4,
  }, {
    x: 7,
    y: -2,
  }, {
    x: -7,
    y: -2,
  }, {
    x: 8,
    y: 2,
  }];
  positions.forEach((p) => {
    let tree = new THREE.Mesh(treeGeo, treeMat);
    if (config.enableShadows) {
      tree.castShadow = true;
      tree.receiveShadow = true;
    }
    tree.rotation.x = Math.PI/2;
    tree.position.x = p.x;
    tree.position.y = p.y;
    tree.position.z += treeHeight/2;
    forest.add(tree);
  });
  forest.rotation.z = Math.random() * Math.PI * 2;
  return forest;
}

class City {
  constructor(state) {
    this.units = {};

    let {map, buildings, units, neighborhoods} = state;
    this.grid = new Grid(map.cols, map.rows, config.cellSize);

    Object.keys(map.parcels).forEach((row) => {
      Object.keys(map.parcels[row]).forEach((col) => {
        let parcel = map.parcels[row][col];

        if (parcel.neighb !== null) {
          let neighb = neighborhoods[parcel.neighb];
          parcel.tooltip = `
            <div>Type ${parcel.type}</div>
            <div>Neighborhood ${parcel.neighb}</div>
            <div>Desirability: ${parcel.desirability.toFixed(2)}</div>
          `;
          let color = parseInt(neighb.color.substr(1), 16);
          if (parcel.type == 'Commercial') {
            color = shadeColor(color, 0.8);
          }
          let cell = this.grid.setCellAt(col, row, color, parcel);

          if (parcel.type == 'Residential') {
            let b = buildings[`${row}_${col}`];
            let building = new Building(b.units.map(u => units[u]), b.nCommercial);
            cell.building = building;
            cell.mesh.add(building.group);

            // Make units easily accessible by id
            // so we can update them
            Object.keys(building.units).forEach((id) => {
              this.units[id] = building.units[id];
            });
          } else if (parcel.type == 'Commercial') {
            // TODO temporary commercial buildings
            let geo = new THREE.BoxGeometry(8, 8, 16);
            let mesh = new THREE.Mesh(geo, commericalMat);
            if (config.enableShadows) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
            mesh.position.z = 16/2;
            cell.mesh.add(mesh);
          } else {
            // parks
            if (Math.random() < 0.4) {
              cell.mesh.add(forest());
            }
            cell.setColor(parkColor);
            cell.color = parkColor;
          }

        } else {
          parcel.tooltip = `
            <div>Type ${parcel.type}</div>
          `;

          let color = parcel.type == 'Park' ? parkColor : 0x2146b7;
          let cell = this.grid.setCellAt(col, row, color, parcel);
          if (parcel.type == 'Park') {
            if (Math.random() < 0.4) {
              cell.mesh.add(forest());
            }
          } else if (parcel.type == 'River') {
            if (Math.random() < 0.4) {
              cell.mesh.add(boat());
            }
          }
        }

      });
    });

    // Rotate, so we view the grid isometrically
    this.grid.group.rotation.x = -Math.PI/2;
  }
}

export default City;
