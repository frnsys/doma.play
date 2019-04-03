import config from '../../config';
import * as THREE from 'three';

const materials = {
  vacant: new THREE.MeshLambertMaterial({color: 0xffffff}),
  focus: new THREE.MeshLambertMaterial({color: config.focusColor})
}

Object.keys(config.colors).forEach((k) => {
  materials[k] = new THREE.MeshLambertMaterial({color: config.colors[k]});
});

export default {
  materials: materials
};
