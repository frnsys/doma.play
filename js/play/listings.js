import api from '../api';
import * as THREE from 'three';
import Scene from '../city/3d/scene';
import Grid from '../city/3d/grid';
import InteractionLayer from '../city/3d/interact';
import {shadeColor} from '../city/3d/color';

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Config
const parcelColors = {
  'Empty': 0xffc2c200,
  'Residential': 0xffffff,
  'Park': 0x21b75f,
  'River': 0x2146b7
}

const textMat = new THREE.MeshLambertMaterial({
  color: 0x383838
});

const cellSize = 32;
function createMap(state, detailsEl, cb) {
  let {cols, rows, parcels} = state.map;
  const grid = new Grid(cols, rows, cellSize);

  let loader = new THREE.FontLoader();
  loader.load('/static/helvetiker_bold.typeface.json', function (font) {
    Object.keys(parcels).forEach((r) => {
      Object.keys(parcels[r]).forEach((c) => {
        let p = parcels[r][c];
        let color = parcelColors[p.type];
        let text, vacancies;
        if (p.type == 'Residential' && p.neighb !== null) {
          color = state.neighborhoods[parseInt(p.neighb)].color;
          vacancies = state.buildings[`${r}_${c}`].units
            .filter((uId) => state.units[uId].occupancy > state.units[uId].tenants.length);
          color = parseInt(color.substr(1), 16);
          if (vacancies.length > 0) {
            let geometry = new THREE.TextGeometry(vacancies.length.toString(), {
              font: font,
              size: 10,
              height: 5,
              curveSegments: 6,
              bevelEnabled: false,
            });
            text = new THREE.Mesh(geometry, textMat);

            // Center text
            let bbox = new THREE.Box3().setFromObject(text);
            bbox.center(text.position);
            text.position.multiplyScalar(-1);
          }
        }
        let cell = grid.setCellAt(c, r, color);
        if (text) {
          cell.mesh.add(text);
        }

        cell.mesh.obj = {
          data: {
            onClick: (ev) => {
              if (vacancies) {
                detailsEl.innerHTML = `
                  ${vacancies.map((id) => {
                    let u = state.units[id];
                    return `<li class='listing'>
                      ${u.occupancy} bedroom (${u.occupancy - u.tenants.length} available)<br />
                      Rent: $${numberWithCommas(Math.round(u.rent/(u.tenants.length + 1)))}/month<br />
                      Total Rent: $${numberWithCommas(Math.round(u.rent))}/month<br />
                      On the market for ${u.monthsVacant} months<br />
                    </li>`;
                  }).join('')}
                `;
              }
            },
            tooltip: 'testing'
          },
          focus: (ev) => {
            cell.focus();
          },
          unfocus: () => {
            cell.unfocus();
          }
        }
      });
    });
    cb(grid);
  });
}

function displayListings(el) {
  // Setup scene
  const scene = new Scene({
    width: el.clientWidth,
    height: 400,
    brightness: 0.9
  });
  scene.renderer.domElement.style.border = '1px solid #00000022';
  el.appendChild(scene.renderer.domElement);
  scene.camera.position.z = 10;
  scene.camera.position.y = 0;
  scene.camera.position.x = 0;
  scene.camera.zoom = 0.002;
  scene.camera.lookAt(scene.scene.position);
  scene.camera.updateProjectionMatrix();
  scene.controls.enableRotate = false;

  let listingDetailsEl = document.createElement('div');
  el.appendChild(listingDetailsEl);

  function render() {
    scene.render();
    requestAnimationFrame(render);
  }

  api.get('/state', (state) => {
    createMap(state, listingDetailsEl, (grid) => {
      // Setup interactable objects
      let selectables = grid.cells.filter(c => c !== null).map(c => c.mesh);
      let ixn = new InteractionLayer(scene, selectables);
      scene.add(grid.group);
    });

    render();
  });
}

export default displayListings;
