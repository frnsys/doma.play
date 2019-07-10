import * as THREE from 'three';

const VIEW_ANGLE = 45;
const NEAR = 0.1;
const FAR = 10000;
const D = 1;

class Scene {
  constructor(opts) {
    opts = opts || {};
    opts.camera = opts.camera || 'perspective';
    opts.width = opts.maxWidth ? Math.min(opts.maxWidth, window.innerWidth) : window.innerWidth;
    opts.height = opts.maxHeight ? Math.min(opts.maxHeight, window.innerHeight) : window.innerHeight;
    this.opts = opts;

    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({antialias: false, alpha: true});
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(opts.width, opts.height);
    this.renderer.setClearColor(0xeeeeee, 0);

    // fix for dark gltf objects
    this.renderer.gammaFactor = 3;
    this.renderer.gammaOutput = true;

    var hemiLight = new THREE.HemisphereLight( 0xffffff, 0x000000, 0.9 );
    this.scene.add(hemiLight);

    var amli = new THREE.AmbientLight( 0x404040 ); // soft white light
    this.scene.add( amli );

    let light = new THREE.DirectionalLight( 0xffffff, 0.2 );
    light.position.y = 200;
    light.position.x = 200;
    this.scene.add(light);

    let aspect = opts.width/opts.height;
    if (opts.camera == 'perspective') {
      this.camera = new THREE.PerspectiveCamera(
          VIEW_ANGLE,
          aspect,
          NEAR, FAR);
    } else {
      this.camera = new THREE.OrthographicCamera(-D*aspect, D*aspect, D, -D, NEAR, FAR);
      this.camera.zoom = 2;
      this.camera.zoom = 0.005;
    }

    this.camera.position.z = 400;
    this.camera.position.y = 400;
    this.camera.position.x = 400;
    this.camera.lookAt(0,0,0);
    this.camera.updateProjectionMatrix();

    window.addEventListener('resize', () => {
      opts.width = opts.maxWidth ? Math.min(opts.maxWidth, window.innerWidth) : window.innerWidth;
      opts.height = opts.maxHeight ? Math.min(opts.maxHeight, window.innerHeight) : window.innerHeight;
      let aspect = opts.width/opts.height;
      if (opts.camera == 'perspective') {
        this.camera.aspect = aspect;
      } else {
        this.camera.left = -D * aspect;
        this.camera.right = D * aspect;
        this.camera.top = D;
        this.camera.bottom = -D;
      }
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(opts.width, opts.height);
    }, false);
  }

  add(mesh) {
    this.scene.add(mesh);
  }

  remove(mesh) {
    this.scene.remove(mesh);
  }

  clear() {
    this.scene.children.forEach((obj) => {
      this.scene.remove(obj);
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

export default Scene;

