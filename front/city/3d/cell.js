import config from '../config';
import * as THREE from 'three';
import {shadeColor} from './color';

const colorCache = {};
const matConf = { vertexColors: THREE.VertexColors };
const material = config.enableShadows ? new THREE.MeshLambertMaterial(matConf) : new THREE.MeshBasicMaterial(matConf);


class Cell {
  constructor(x, y, size, color, data) {
    this.x = x;
    this.y = y;
    this.data = data || {};
    this.color = color;

    this.geometry = makeHexagon(size);
    if (config.enableShadows) {
      this.geometry.computeVertexNormals();
    }
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.position.x = x;
    this.mesh.position.y = y;
    this.setColor(color);

    // to recover this object from raycasting intersection
    this.mesh.obj = this;

    if (config.enableShadows) {
      this.mesh.receiveShadow = true;
    }
  }

  // color order:
  // top right, top center, top left, bottom left, bottom center, bottom right
  setColor(color) {
    let colors = [
      color,
      color,
      shadeColor(color, 0.3),
      color,
      color,
      shadeColor(color, -0.2),
    ];

    colors = colors.map((c) => {
      if (!(c in colorCache)) {
        colorCache[c] = new THREE.Color(c);
      }
      return colorCache[c];
    });

    let triangles = THREE.ShapeUtils.triangulateShape(this.geometry.vertices, []);
    this.geometry.faces.forEach((face, i) => {
      face.vertexColors[0] = colors[triangles[i][0]];
      face.vertexColors[1] = colors[triangles[i][1]];
      face.vertexColors[2] = colors[triangles[i][2]];
    });
    this.geometry.elementsNeedUpdate = true;
  }

  focus() {
    this.setColor(0xf99090);
  }

  unfocus() {
    this.setColor(this.color);
  }
}

function makeHexagon(size) {
  let vertices = [];
  let geometry = new THREE.Geometry();
  for (let i=0; i<6; i++) {
    let angle_deg = 60 * i + 30;
    let angle_rad = Math.PI / 180 * angle_deg;
    let vx = size * Math.cos(angle_rad);
    let vy = size * Math.sin(angle_rad);
    vertices.push(new THREE.Vector3(vx, vy, 0));
  }
  geometry.vertices = vertices;
  let triangles = THREE.ShapeUtils.triangulateShape(vertices, []);
  for(let i=0; i<triangles.length; i++) {
    let face = new THREE.Face3(triangles[i][0], triangles[i][1], triangles[i][2]);
    geometry.faces.push(face);
  }
  return geometry;
}



export default Cell;
