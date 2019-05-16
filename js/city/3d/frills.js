import * as THREE from 'three';
import config from '../config';

const d = 10;

const treeHeight = 8;
const treeRadius = 2;
const treeGeo = new THREE.ConeBufferGeometry(treeRadius, treeHeight, 5);
const treeMat = new THREE.MeshLambertMaterial({color: 0x116b33});

const birdGeo = new THREE.BoxBufferGeometry(0.5, 1, 0.5);
const birdMat = new THREE.MeshLambertMaterial({color: 0xdddddd});

const boatGeo = new THREE.BoxBufferGeometry(6, 1.5, 1);
const boatMats = [
  new THREE.MeshLambertMaterial({color: 0xdddddd}),
  new THREE.MeshLambertMaterial({color: 0x990000})
];

const cloudChunks = 5;
const cloudGeo = new THREE.DodecahedronBufferGeometry(5);

export default {
  streetlight: () => {
    let light = new THREE.PointLight(0xf4c358, 1, 150, 2);
    if (config.enableShadows) {
      light.castShadow = true;
      light.shadow.mapSize.width = 72;
      light.shadow.mapSize.height = 72;
      light.shadow.camera.left = -d;
      light.shadow.camera.right = d;
      light.shadow.camera.top = d;
      light.shadow.camera.bottom = -d;
    }
    light.position.set(0, 0, 100);

    // Off by default
    light.visible = false;
    return light;
  },

  cloud: () => {
    let cloud = new THREE.Group();

    // Clouds have separate materials
    // so we can control opacity individually
    let cloudMat = new THREE.MeshLambertMaterial({
      color: 0xdddddd,
      transparent: true,
      opacity: 0.8,
      emissive: 0x888888
    });

    [...Array(cloudChunks)].forEach(() => {
      let chunk = new THREE.Mesh(cloudGeo, cloudMat);
      chunk.position.x = (Math.random() - 0.5) * 10;
      chunk.position.y = (Math.random() - 0.5) * 10;
      chunk.position.z = (Math.random() - 0.5) * 10;
      if (config.enableShadows) {
        chunk.castShadow = true;
        chunk.receiveShadow = true;
      }
      cloud.add(chunk);
    });
    cloud.position.z = 40;

    // So we can modify it easily later
    cloud.material = cloudMat;
    return cloud;
  },

  boat: () => {
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
  },

  forest: () => {
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
    forest.bird = bird;
    forest.add(bird);
    return forest;
  }
};
