import Stage from './stage';
import Script from './script';
import util from './util';

function populateEl(name, data) {
  Object.keys(data).forEach((k) => {
    let el = document.getElementById(`${name}--${k}`);
    el.innerText = data[k];
  });
}

class Engine {
  constructor() {
    this.stage = new Stage('scene');
    this.act = 0;
    this.loadAct(this.act);
  }

  loadAct(actNumber) {
    let act = Script.acts[actNumber];
    this.loadScene(act.startScene);

    let actEl = document.getElementById('act');
    actEl.style.opacity = 1;
    actEl.style.display = 'flex';
    actEl.style.background = `linear-gradient(to bottom, ${act.colors[0]} 0%, ${act.colors[1]} 100%)`;
    populateEl('act', {
      'desc': act.description,
      'title': `"${act.title}"`,
      'number': `ACT ${actNumber+1}`
    });

    // Fade out act interstitial
    setTimeout(() => {
      let fadeOut = setInterval(() => {
        actEl.style.opacity -= 0.05;
        if (actEl.style.opacity <= 0) {
          actEl.style.display = 'none';
          clearInterval(fadeOut);
          this.loadScene(act.startScene);
        }
      }, 100);
    }, 4000);
  }

  loadScene(sceneId) {
    let scene = Script.scenes[sceneId];
    let sceneEl = document.getElementById('scene');
    let sceneBodyEl = document.getElementById('scene--body');
    let location = Script.locations[scene.location];
    sceneEl.style.background = location.stageColor;
    sceneBodyEl.style.background = location.bodyColor;

    populateEl('scene', {
      'desc': scene.description,
      'title': scene.title
    });

    let actionsEl = document.getElementById('scene--actions');
    actionsEl.innerHTML = '';
    scene.actions.forEach((a) => {
      let actionEl = document.createElement('div');
      actionEl.innerText = a.name;
      actionEl.className = 'scene--action';
      actionEl.style.background = location.stageColor;
      actionEl.addEventListener('click', () => {
        // If no outcomes, end of act
        if (a.outcomes.length === 0) {
          this.act++;
          this.loadAct(this.act);

        } else {
          // Outcome probabilities can be:
          // - a function
          // - a fixed value
          // - unspecified, defaulting to 1.
          let pWeights = a.outcomes.map((o) => typeof o.p === 'function' ? o.p() : (o.p || 1.));
          let choice = util.randomWeightedChoice(a.outcomes, pWeights);
          this.loadScene(choice.id);
        }
      });
      actionsEl.appendChild(actionEl);
    });

    this.stage.loadModel(scene.model);
    this.stage.render();
  }
}

export default Engine;
