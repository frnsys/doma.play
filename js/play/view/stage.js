import Scene from './scene';
import GLTFLoader from './gltf';
import * as THREE from 'three';

const loader = new GLTFLoader();

class Stage {
  constructor(stageId) {
    const el = document.getElementById(stageId);
    this.scene = new Scene({
      maxHeight: 200,
      maxWidth: el.clientWidth,
      camera: 'perspective'
    });

    // Insert as first element
    el.insertBefore(this.scene.renderer.domElement,
      el.firstChild);

    this.models = [];
  }

  loadModel(modelName) {
    while (this.models.length > 0) {
      this.scene.remove(this.models.pop());
    }
    loader.load(`/static/models/${modelName}.gltf`, (gltf) => {
        let child = gltf.scene.children[0];
        let mixer = new THREE.AnimationMixer(child);
        child.scale.set(60,60,60);
        child.rotation.z = Math.PI/2;
        if (gltf.animations.length > 0) {
          mixer.clipAction(gltf.animations[0]).play();
        }
        this.scene.add(child);
        this.scene.mixer = mixer;
        this.models.push(child);
    });
  }

  render() {
    let delta = this.scene.clock.getDelta();
    if (this.scene.mixer) {
      this.scene.mixer.update(delta);
    }
    this.scene.render();
    requestAnimationFrame(this.render.bind(this));
  }
}

export default Stage;
