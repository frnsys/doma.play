import * as THREE from 'three';
import Scene from '../../city/3d/scene';
import Grid from '../../city/3d/grid';
import InteractionLayer from '../../city/3d/interact';
import {shadeColor} from '../../city/3d/color';

// Config
const cellSize = 32;
const parcelColors = {
  'Empty': 0xffc2c200,
  'Residential': 0xffffff,
  'Park': 0x21b75f,
  'River': 0x2146b7
}

const textMat = new THREE.MeshLambertMaterial({
  color: 0x383838
});
const altTextMat = new THREE.MeshLambertMaterial({
  color: 0xffffff
});
const mutedTextMat = new THREE.MeshLambertMaterial({
  color: 0x383838,
  opacity: 0.2,
  transparent: true
});

function showApartments(el, map, parcels, onCellSelect) {
  const grid = new Grid(map.cols, map.rows, cellSize);
  const loader = new THREE.FontLoader();

  loader.load('/static/helvetiker_bold.typeface.json', (font) => {
    Object.keys(parcels).forEach((r) => {
      Object.keys(parcels[r]).forEach((c) => {
        let text;
        let p = parcels[r][c];
        let color = parcelColors[p.type];
        if (p.hasUnits && p.neighb) {
          color = parseInt(p.neighb.color.substr(1), 16);
          if (p.vacancies.length > 0) {
            let geometry = new THREE.TextGeometry(`${p.vacancies.length.toString()}${p.anyDOMA ? '*': ''}`, {
              font: font,
              size: 10,
              height: 5,
              curveSegments: 6,
              bevelEnabled: false,
            });
            text = new THREE.Mesh(geometry, p.affordable.length > 0 ? textMat : mutedTextMat);

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

        if (p.tenantWork) {
          let workGeo = new THREE.ConeBufferGeometry(4, 8, 4);
          let workMat = new THREE.MeshBasicMaterial({
            color: 0xf1f442
          });
          let workMesh = new THREE.Mesh(workGeo, workMat);
          workMesh.rotation.z = Math.PI;
          workMesh.position.y = 12;
          cell.mesh.add(workMesh);

          let geometry = new THREE.TextGeometry('Work', {
            font: font,
            size: 6,
            height: 5,
            curveSegments: 6,
            bevelEnabled: false,
          });
          text = new THREE.Mesh(geometry, altTextMat);

          // Center text
          let bbox = new THREE.Box3().setFromObject(text);
          bbox.center(text.position);
          text.position.multiplyScalar(-1);
          text.position.y = 18;
          cell.mesh.add(text);
        }

        cell.mesh.obj = {
          data: {
            onClick: (ev) => {
              onCellSelect(p);
            }
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

    // Setup interactable objects
    let {scene, render} = createScene(el);
    let selectables = grid.cells.filter(c => c !== null).map(c => c.mesh);
    let ixn = new InteractionLayer(scene, selectables);
    scene.add(grid.group);
    render();
  });
}

function createScene(el) {
  // Setup scene
  const scene = new Scene({
    width: el.clientWidth,
    height: 200,
    brightness: 0.9
  });
  el.appendChild(scene.renderer.domElement);
  scene.camera.position.z = 10;
  scene.camera.position.y = 0;
  scene.camera.position.x = 0;
  scene.camera.zoom = 0.005;
  scene.camera.lookAt(scene.scene.position);
  scene.camera.updateProjectionMatrix();
  scene.controls.enableRotate = false;

  let render = () => {
    scene.render();
    requestAnimationFrame(render);
  };
  return {scene, render};
}

export default showApartments;
