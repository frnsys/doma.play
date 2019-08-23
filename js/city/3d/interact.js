import * as THREE from 'three';

// Hover tooltip
const tooltip = document.createElement('div');
tooltip.classList.add('tooltip');
tooltip.style.position = 'absolute';
tooltip.style.display = 'none';
tooltip.style.zIndex = '10';
tooltip.style.pointerEvents = 'none';
document.body.appendChild(tooltip);


class InteractionLayer {
  constructor(scene, selectables) {
    this.scene = scene;
    this.selectables = selectables;
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.focused = null;

    this.scene.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    this.scene.renderer.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), false);
    this.scene.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false);
  }

  updateMouse(ev) {
    // adjust browser mouse position for three.js scene
    let rect = this.scene.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((ev.clientX-rect.left)/this.scene.renderer.domElement.clientWidth) * 2 - 1;
    this.mouse.y = -((ev.clientY-this.scene.renderer.domElement.offsetTop+window.pageYOffset)/this.scene.renderer.domElement.clientHeight) * 2 + 1;
  }

  onTouchStart(ev) {
    ev.preventDefault();
    ev.clientX = ev.touches[0].clientX;
    ev.clientY = ev.touches[0].clientY;
    this.onMouseDown(ev);
  }

  onMouseDown(ev) {
    ev.preventDefault();
    this.updateMouse(ev);
    this.raycaster.setFromCamera(this.mouse, this.scene.camera);

    let intersects = this.raycaster.intersectObjects(this.selectables.filter(s => s.visible));
    if (intersects.length > 0) {
      let mesh = intersects[0].object,
          pos = intersects[0].point,
          node = mesh.obj;
      if (node.data.onClick) {
        node.data.onClick(ev);
      }
    }
  }

  onMouseMove(ev) {
    ev.preventDefault();
    this.updateMouse(ev);
    this.raycaster.setFromCamera(this.mouse, this.scene.camera);

    if (this.focused) {
      if (this.focused.obj.unfocus) {
        this.focused.obj.unfocus(ev);
      }
      this.focused = null;
    }

    let intersects = this.raycaster.intersectObjects(this.selectables);
    if (intersects.length > 0) {
      let mesh = intersects[0].object,
          pos = intersects[0].point,
          obj = mesh.obj;

      if (obj.data.tooltip) {
        this.focused = mesh;
        if (this.focused.obj.focus) {
          this.focused.obj.focus(ev);
        }

        tooltip.style.display = 'block';
        tooltip.style.left = `${ev.pageX + 5}px`;
        let top = ev.pageY + 5;
        if (tooltip.clientHeight + top > window.innerHeight) {
          top -= tooltip.clientHeight;
        }
        tooltip.style.top = `${top}px`;
        if (typeof obj.data.tooltip === 'function') {
          tooltip.innerHTML = obj.data.tooltip();
        } else {
          tooltip.innerHTML = obj.data.tooltip;
        }
      }
    } else {
      tooltip.style.display = 'none';
    }
  }
}

export default InteractionLayer;
