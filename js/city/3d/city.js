import Grid from './grid';
import Building from './building';
import {shadeColor} from './color';
import frills from './frills';
import * as THREE from 'three';
import config from '../config';

const parkColor = 0x189a4a;
const riverColor = 0x2146b7;
const commericalMat = new THREE.MeshLambertMaterial({color: 0xfcec99});

const maxBubbles = 2000;
const bubbleGeo = new THREE.SphereBufferGeometry(1, 8, 8);
const bubbleMat = new THREE.MeshLambertMaterial({
  color: 0x9842f4,
  transparent: true,
  opacity: 0.8
});

class City {
  constructor(state) {
    this.units = {};
    this.lights = [];
    this.clouds = [];
    this.boats = [];
    this.birds = [];
    this.bubbles = [];

    let {map, buildings, units, neighborhoods} = state;
    let colShift = map.offset.col ? 1 : 0;
    let rowShift = map.offset.row ? 1 : 0;
    this.grid = new Grid(map.cols+colShift, map.rows+rowShift, config.cellSize);
    this.width = (map.cols+colShift) * this.grid.cellWidth;
    this.height = (map.rows+rowShift) * this.grid.cellHeight;

    Object.keys(map.parcels).forEach((row) => {
      Object.keys(map.parcels[row]).forEach((col) => {
        let parcel = map.parcels[row][col];

        if (parcel.neighb !== -1) {
          let neighb = neighborhoods[parcel.neighb];
          if (neighb) {
            parcel.color = parseInt(neighb.color.substr(1), 16);
            parcel.tooltip = `
              <div>Type ${parcel.type}</div>
              <div>${neighb.name}</div>
              <div>Desirability: ${parcel.desirability.toFixed(2)}</div>
            `;
          }
        } else {
          parcel.tooltip = `
            <div>Type ${parcel.type}</div>
          `;
          parcel.color = parcel.type == 'Park' ? parkColor : riverColor;
        }

        let cell = this.grid.setCellAt(parseInt(row) + rowShift, parseInt(col) + colShift, parcel.color, parcel);

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
          if (parcel.type == 'Park') {
            if (Math.random() < config.forestProb) {
              let f = frills.forest();
              this.birds.push(f.bird);
              cell.mesh.add(f);
            }
          } else if (parcel.type == 'River') {
            if (Math.random() < config.boatProb) {
              let b = frills.boat();
              this.boats.push(b);
              cell.mesh.add(b);
            }
          }
        }
      });
    });

    // Rotate, so we view the grid isometrically
    this.grid.group.rotation.x = -Math.PI/2;

    // Generate clouds
    [...Array(config.nClouds)].forEach(() => {
      let c = frills.cloud();
      c.position.x = (Math.random() - 0.5) * this.height;
      c.position.y = (Math.random() - 0.5) * this.width;
      c.position.z += (Math.random() - 0.5) * 3;
      this.clouds.push(c);
      this.grid.group.add(c);
    });

    // Distribute streetlights
    // Limit number of extra lights,
    // can be a big performance hit
    let cells = this.grid.cells.filter((c) => c !== null);
    [...Array(config.nStreetLights)].forEach(() => {
      let light = frills.streetlight();
      let cell = cells[Math.floor(Math.random() * cells.length)];
      this.lights.push(light);
      cell.mesh.add(light);
    });

    // this.bubble();
  }

  bubble() {
    Object.values(this.units).forEach((u) => {
      if (u.owner.type == 'Landlord') {
        let bubble;
        if (this.bubbles.length < maxBubbles) {
          bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
          u.mesh.add(bubble);
        } else {
          bubble = this.bubbles.shift();
        }
        bubble.position.set(Math.random(), Math.random(), Math.random());
        this.bubbles.push(bubble);
      }
    });
    setTimeout(() => this.bubble(), 5000);
  }

  animate() {
    this.bubbles.forEach((b) => {
      b.position.z += 0.1;
    });

    // Boat jittering
    this.boats.forEach((b) => {
      b.position.x += (Math.random() - 0.5) * 0.03;
      b.position.y += (Math.random() - 0.5) * 0.03;
    });

    // Birds circling
    const r = 5;
    this.birds.forEach((b) => {
      let theta = b.theta || Math.PI;
      b.theta = theta;
      b.theta += 0.02;
      let y = r*Math.sin(b.theta);
      let x = r*Math.cos(b.theta);
      b.position.x = x;
      b.position.y = y;
    });

    // Clouds floating
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
