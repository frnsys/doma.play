import config from '../../config';
import common from './common';
import * as THREE from 'three';

const s = 8;
const SLAB_GAP = 0.2;
const HOUSE_DEPTH = 12;
const SLAB_SHAPE = new THREE.Shape();
SLAB_SHAPE.moveTo(s/2, 0);
SLAB_SHAPE.lineTo(s, -s/2);
SLAB_SHAPE.lineTo(s, -s);
SLAB_SHAPE.lineTo(0, -s);
SLAB_SHAPE.lineTo(0, -s/2);


function makeHouse(nUnits) {
  let slabDepth = HOUSE_DEPTH/nUnits;

  // For centering group origin
  let shift = -slabDepth + (nUnits/2 * slabDepth);

  let group = new THREE.Group();
  let units = [];
  for (let i=0; i<nUnits; i++) {
    let slab = makeSlab(slabDepth);
    slab.position.z = (-slabDepth-SLAB_GAP)*i + shift;
    slab.position.x = -s/2;
    group.add(slab);
    units.push(slab);
  }
  group.rotation.x = Math.PI/2;
  group.rotation.y = Math.PI/6 * Math.random();
  return {group, units};
}

function makeSlab(depth) {
  let extrudeSettings = {
    depth: depth,
    bevelEnabled: false,
  };

  // TODO reuse same geometry
  let geometry = new THREE.ExtrudeGeometry(SLAB_SHAPE, extrudeSettings);
  var mesh = new THREE.Mesh(geometry, common.materials.vacant) ;

  mesh.position.y = s;

  if (config.enableShadows) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  return mesh;
}

export default makeHouse;
