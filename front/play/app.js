import Scene from './scene';
import GLTFLoader from './gltf';
import * as THREE from 'three';

function commute() {
  let ellipseEl = document.getElementById('js-animated-ellipse');
  setInterval(() => {
    let n = ellipseEl.innerText.length;
    n++;
    if (n > 3) n = 0;
    ellipseEl.innerText = '.'.repeat(n);
  }, 600)


  setTimeout(() => {
    document.getElementById('event').style.opacity = 1;
  }, 6000);

  const main = document.getElementById('main');
  const scene = new Scene({maxHeight: 200, maxWidth: main.clientWidth, camera: 'perspective'});
  main.insertBefore(scene.renderer.domElement, main.firstChild);

  function addModel(gltf) {
    let child = gltf.scene.children[0];
    let mixer = new THREE.AnimationMixer(child);
    child.scale.set(60,60,60);
    child.rotation.z = Math.PI/2;
    mixer.clipAction(gltf.animations[0]).play();
    scene.add(child);
    scene.mixer = mixer;
  }

  let loader = new GLTFLoader();
  loader.load('/static/models/subway.gltf', addModel);

  function render(time) {
    var delta = scene.clock.getDelta();
    if (scene.mixer) {
      scene.mixer.update(delta);
    }
    scene.render();
    requestAnimationFrame(render);
  }
  render();
}


function apartment() {
  document.getElementById('play').style.background = '#cabdd8';

  setTimeout(() => {
    document.getElementById('event').style.opacity = 1;
  }, 6000);

  const main = document.getElementById('main');
  const scene = new Scene({maxHeight: 320, maxWidth: main.clientWidth, camera: 'orthographic'});
  main.insertBefore(scene.renderer.domElement, main.firstChild);

  function addModel(gltf) {
    let child = gltf.scene.children[0];
    child.scale.set(36,36,36);
    child.rotation.y = -Math.PI/2;
    scene.add(child);
  }

  let loader = new GLTFLoader();
  loader.load('/static/models/apartment.gltf', addModel);

  function render(time) {
    scene.render();
    requestAnimationFrame(render);
  }
  render();
}

apartment();
