import Grid from './grid';
import Building from './building';
import {shadeColor} from './color';
import * as THREE from 'three';
import config from '../config';

const commericalMat = new THREE.MeshLambertMaterial({color: 0xfcec99});

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
            // TODO parks
            cell.setColor(0x00ff00);
            cell.color = 0x00ff00;
          }

        } else {
          parcel.tooltip = `
            <div>Type ${parcel.type}</div>
          `;

          let color = parcel.type == 'Park' ? 0x00ff00 : 0x0000ff;
          let cell = this.grid.setCellAt(col, row, color, parcel);
        }

      });
    });

    // Rotate, so we view the grid isometrically
    this.grid.group.rotation.x = -Math.PI/2;
  }
}

export default City;
