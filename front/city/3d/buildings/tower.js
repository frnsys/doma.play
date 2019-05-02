import config from '../../config';
import common from './common';
import * as THREE from 'three';

const s = 4;
const b = 0.5;
const h = 4;

const FLOOR_GAP = 0.2;
const CHUNK_SHAPE = new THREE.Shape();
CHUNK_SHAPE.moveTo(0, 0);
CHUNK_SHAPE.lineTo(s-b, 0);
CHUNK_SHAPE.lineTo(s-b, -b);
CHUNK_SHAPE.lineTo(s, -b);
CHUNK_SHAPE.lineTo(s, -s);
CHUNK_SHAPE.lineTo(b, -s);
CHUNK_SHAPE.lineTo(b, -s+b);
CHUNK_SHAPE.lineTo(0, -s+b);
CHUNK_SHAPE.lineTo(0, -s+b);

const CHUNK_GEO = new THREE.BufferGeometry().fromGeometry(new THREE.ExtrudeGeometry(CHUNK_SHAPE, {
  depth: h,
  bevelEnabled: false,
}));

function makeChunk(mat) {
  var mesh = new THREE.Mesh(CHUNK_GEO, mat) ;
  mesh.rotation.x = -Math.PI/2;

  if (config.enableShadows) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  return mesh;
}

function makeFloor(mat) {
  let group = new THREE.Group();

  // 0
  let mesh = makeChunk(mat);
  mesh.position.x = -s;
  mesh.position.z = -s;
  group.add(mesh);

  // 1
  mesh = makeChunk(mat);
  mesh.position.z = -s;
  mesh.position.x = s;
  mesh.rotation.z = -Math.PI/2
  group.add(mesh);

  // 2
  mesh = makeChunk(mat);
  group.add(mesh);

  // 3
  mesh = makeChunk(mat);
  mesh.rotation.z = -Math.PI/2
  group.add(mesh);

  return group;
}

function makeTower(unitFloors, nCommercial) {
  let group = new THREE.Group();
  let units = [];
  let commercial = [];
  for (let i=0; i < nCommercial; i++) {
    let floor = makeFloor(common.materials.commercial);
    commercial = commercial.concat(floor.children);
    floor.children.forEach((f) => {
      f.obj = {
        data: {
          tooltip: 'Commercial'
        }
      };
    });
    floor.position.y = (h+FLOOR_GAP)*i;
    group.add(floor);
  }

  for (let i=0; i < unitFloors; i++) {
    let floor = makeFloor(common.materials.vacant);
    units = units.concat(floor.children);
    floor.position.y = (h+FLOOR_GAP)*(i+nCommercial);
    group.add(floor);
  }
  group.rotation.x = Math.PI/2;
  return {group, units, commercial};
}

export default makeTower;
