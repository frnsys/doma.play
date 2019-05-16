import Grid from './grid';
import Building from './building';
import {shadeColor} from './color';
import * as THREE from 'three';
import config from '../config';

const commericalMat = new THREE.MeshLambertMaterial({color: 0xfcec99});

const treeHeight = 8;
const treeRadius = 2;
const treeGeo = new THREE.ConeBufferGeometry(treeRadius, treeHeight, 5);
const treeMat = new THREE.MeshLambertMaterial({color: 0x116b33});
const parkColor = 0x189a4a;

const birdGeo = new THREE.BoxBufferGeometry(0.5, 1, 0.5);
const birdMat = new THREE.MeshLambertMaterial({color: 0xdddddd});

const boatGeo = new THREE.BoxBufferGeometry(6, 1.5, 1);
const boatMats = [
  new THREE.MeshLambertMaterial({color: 0xdddddd}),
  new THREE.MeshLambertMaterial({color: 0x990000})
];

const cloudGeo = new THREE.DodecahedronBufferGeometry(5);

const boats = [];
const birds = [];

function streetlight() {
  let d = 10;
  let light = new THREE.PointLight( 0xf4c358, 1, 150, 2);
  light.castShadow = true;
  light.shadow.mapSize.width = 72;
  light.shadow.mapSize.height = 72;
  light.shadow.camera.left = -d;
  light.shadow.camera.right = d;
  light.shadow.camera.top = d;
  light.shadow.camera.bottom = -d;
  light.position.set(0, 0, 100);
  light.visible = false;
  return light;
}


function cloud() {
  let group = new THREE.Group();

  let cloudMat = new THREE.MeshLambertMaterial({color: 0xdddddd, transparent: true, opacity: 0.8, emissive: 0x888888});
  [...Array(5)].forEach(() => {
    let cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.x = (Math.random() - 0.5) * 10;
    cloud.position.y = (Math.random() - 0.5) * 10;
    cloud.position.z = (Math.random() - 0.5) * 10;
    if (config.enableShadows) {
      cloud.castShadow = true;
      cloud.receiveShadow = true;
    }
    group.add(cloud);
  });
  group.material = cloudMat;
  group.position.z = 40;
  return group;
}

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
  boats.push(boat);
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

  let bird = new THREE.Mesh(birdGeo, birdMat);
  bird.position.z += treeHeight;
  forest.add(bird);
  birds.push(bird);
  return forest;
}

let availableLights = [...Array(5)].map(() => streetlight());

class City {
  constructor(state) {
    this.units = {};
    this.lights = [];
    this.clouds = [];

    let {map, buildings, units, neighborhoods} = state;
    this.grid = new Grid(map.cols, map.rows, config.cellSize);
    this.width = map.cols * this.grid.cellWidth;
    this.height = map.rows * this.grid.cellHeight;

    Object.keys(map.parcels).forEach((row) => {
      Object.keys(map.parcels[row]).forEach((col) => {
        let cell;
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
          cell = this.grid.setCellAt(col, row, color, parcel);

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
          cell = this.grid.setCellAt(col, row, color, parcel);
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
        if (cell && Math.random() < 0.1) {
          if (availableLights.length > 0) {
            let light = availableLights.pop();
            this.lights.push(light);
            cell.mesh.add(light);
          }
        }

      });
    });

    // Rotate, so we view the grid isometrically
    this.grid.group.rotation.x = -Math.PI/2;

    [...Array(10)].forEach(() => {
      let c = cloud();
      c.position.x = (Math.random() - 0.5) * this.height;
      c.position.y = (Math.random() - 0.5) * this.width;
      c.position.z += (Math.random() - 0.5) * 3;
      this.clouds.push(c);
      this.grid.group.add(c);
    });
  }

  animate() {
    boats.forEach((b) => {
      b.position.x += (Math.random() - 0.5) * 0.03;
      b.position.y += (Math.random() - 0.5) * 0.03;
    });

    let r = 5;
    birds.forEach((b) => {
      let theta = b.theta || Math.PI;
      b.theta = theta;
      b.theta += 0.02;
      let y = r*Math.sin(b.theta);
      let x = r*Math.cos(b.theta);
      b.position.x = x;
      b.position.y = y;
    });

    this.clouds.forEach((c) => {
      c.position.y += 0.1;

      // Recycle
      if (c.position.y > this.width/2) {
        c.material.opacity -= 0.1;
        if (c.material.opacity <= 0) {
          c.position.y = -this.width/2;
          c.position.x = (Math.random() - 0.5) * this.height;
        }
      } else if (c.material.opacity < 0.8) {
        c.material.opacity += 0.05;
      }
    });
  }
}

export default City;
