import * as THREE from 'three';
import OrbitControls from './orbit';

const NEAR = 0;
const FAR = 10000;
const D = 1;

class Scene {
  constructor(opts) {
    opts.width = window.innerWidth;
    opts.height = window.innerHeight;
    this.opts = opts;

    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({antialias: false, alpha: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(opts.width, opts.height);
    this.renderer.setClearColor(0xeeeeee, 0);

    var hemiLight = new THREE.HemisphereLight( 0xffffff, 0x000000, 0.6 );
    this.scene.add(hemiLight);

    let aspect = opts.width/opts.height;
    this.camera = new THREE.OrthographicCamera(-D*aspect, D*aspect, D, -D, NEAR, FAR);
    this.camera.zoom = 0.005;
    this.camera.position.z = 400;
    this.camera.position.y = 400;
    this.camera.position.x = 400;
    this.camera.lookAt(this.scene.position);
    this.camera.updateProjectionMatrix();

    window.addEventListener('resize', () => {
      opts.width = window.innerWidth;
      opts.height = window.innerHeight;
      let aspect = opts.width/opts.height;
      this.camera.left = -D * aspect;
      this.camera.right = D * aspect;
      this.camera.top = D;
      this.camera.bottom = -D;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(opts.width, opts.height);
    }, false);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = true;
    this.controls.maxZoom = 0.4;
    this.controls.minZoom = 0.001;
  }

  add(mesh) {
    this.scene.add(mesh);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

export default Scene;
