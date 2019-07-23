import config from '../config';
import * as THREE from 'three';
import OrbitControls from './orbit';

const NEAR = 0;
const FAR = 10000;
const D = 1;

class Scene {
  constructor(opts) {
    opts.width = opts.width || window.innerWidth;
    opts.height = opts.height || window.innerHeight;
    opts.brightness = opts.brightness || 0.5;
    this.opts = opts;

    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({antialias: false, alpha: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(opts.width, opts.height);
    this.renderer.setClearColor(0xeeeeee, 0);

    let hemiLight = new THREE.HemisphereLight(0xeeeeee, 0x000000, opts.brightness);
    this.scene.add(hemiLight);
    this.hemiLight = hemiLight;
    hemiLight.baseIntensity = hemiLight.intensity;

    // soft white light, to fill shadows
    let ambiLight = new THREE.AmbientLight( 0x999999, 1 );
    this.scene.add(ambiLight);
    this.ambiLight = ambiLight;
    ambiLight.baseIntensity = ambiLight.intensity;

    let light = new THREE.DirectionalLight( 0xffffff, 0.1 );
    light.position.y = 200;
    light.baseIntensity = light.intensity;
    this.scene.add(light);
    this.sun = light;

    let moon = new THREE.DirectionalLight( 0x97b7ef, 0.2 );
    moon.position.y = 200;
    moon.baseIntensity = moon.intensity;
    this.scene.add(moon);
    this.moon = moon;

    if (config.enableShadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.soft = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      let d = 220;
      light.castShadow = true;
      // light.shadow.mapSize.width = 72;
      // light.shadow.mapSize.height = 72;
      light.shadow.mapSize.width = 256;
      light.shadow.mapSize.height = 256;
      light.shadow.camera.left = -d;
      light.shadow.camera.right = d;
      light.shadow.camera.top = d;
      light.shadow.camera.bottom = -d;
    }

    if (config.debugLight) {
      // For debugging light position
      let mat = new THREE.MeshBasicMaterial({ color: 0xf2e310 });
      let geo = new THREE.BoxGeometry(8,8,8);
      let mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = light.position.x;
      mesh.position.y = light.position.y;
      mesh.position.z = light.position.z;
      this.scene.add(mesh);

      if (config.enableShadows) {
        this.scene.add(new THREE.CameraHelper( light.shadow.camera ));
      }
    }

    let aspect = opts.width/opts.height;
    this.camera = new THREE.OrthographicCamera(-D*aspect, D*aspect, D, -D, NEAR, FAR);
    this.camera.zoom = 0.005;
    this.camera.position.z = 400;
    this.camera.position.y = 400;
    this.camera.position.x = 400;
    this.camera.lookAt(this.scene.position);
    this.camera.updateProjectionMatrix();

    window.addEventListener('resize', () => {
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
    this.controls.maxPolarAngle = Math.PI/2;
  }

  add(mesh) {
    this.scene.add(mesh);
  }

  remove(mesh) {
    this.scene.remove(mesh);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

export default Scene;
