import api from '../api';
import util from './util';
import uuid from 'uuid/v4';
import Script from './script';
import Stage from './view/stage';
import displayListings from './view/listings';

function populateEl(name, data) {
  Object.keys(data).forEach((k) => {
    let el = document.getElementById(`${name}--${k}`);
    el.innerText = data[k];
  });
}

class Engine {
  constructor() {
    this.id = uuid();
    this.player = {};
    this.stateKey = null;
    this.act = 0;
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
    sceneBodyEl.style.color = location.textColor || '#000000';

    let desc = scene.description;
    populateEl('scene', {
      'desc': typeof desc === 'function' ? desc(this.player) : desc,
      'title': scene.title
    });

    this.setActions(scene.actions, location);
    this.stage.loadModel(scene.model);
    this.stage.render();
  }

  setActions(actions, location) {
    let actionsEl = document.getElementById('scene--actions');
    actionsEl.innerHTML = '';
    actions.forEach((a) => {
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
          if (choice.cb) choice.cb();
          if (choice.id === 'END_TURN') {
            this.endTurn(choice.nextSceneId);
          } else if (choice.id === 'SEARCH_APARTMENTS') {
            this.searchApartments(choice.nextSceneId);
          } else {
            this.loadScene(choice.id);
          }
        }
      });
      actionsEl.appendChild(actionEl);
    });
  }

  endTurn(nextSceneId) {
    api.post(`/play/ready/${this.id}`);

    this.setActions([]);
    populateEl('scene', {
      'desc': 'Waiting for other players...',
      'title': 'Nighttime'
    });

    // Wait for next turn
    let update = setInterval(() => {
      api.get('/state/key', (data) => {
        if (data.key !== this.stateKey) {
          this.stateKey = data.key;
          clearInterval(update);

          api.get('/state/game', ({state}) => {
            if (state == 'fastforward') {
              let latestStep;
              let interval = setInterval(() => {
                api.get('/state/game', ({state}) => {
                  if (state == 'finished') {
                    clearInterval(interval);
                    alert('fast forward done TODO');
                  } else if (state == 'inprogress') {
                    clearInterval(interval);
                    this.loadScene(nextSceneId);
                  } else {
                    api.get('/state/progress', ({step, progress}) => {
                      populateEl('scene', {
                        'desc': `${util.dateFromTime(step)}...`,
                        'title': 'Time passes...'
                      });
                      latestStep = step;
                    });
                  }
                });
              }, 500);

            } else if (state == 'inprogress') {
              api.get(`/play/tenant/${this.id}`, (data) => {
                // this.player.turnTimer = data.timer.split('-').map((t) => parseFloat(t));
                this.loadScene(nextSceneId);
              });
            }
          });
        }
      });
    }, 200);
  }

  ping() {
    api.post(`/play/ping/${this.id}`, {}, (data) => {
      if (!data.success) {
        alert('Your game session has expired. Starting a new one.');
        window.location.reload();
      }
    });
  }

  start() {
    // Joining/leaving
    api.post('/play/join', {id: this.id}, (data) => {
      this.player.tenant = data.tenant;
      this.stage = new Stage('scene--stage');
      this.loadAct(this.act);
    });
    window.addEventListener('unload', () => {
      api.post('/play/leave', {id: this.id});
    }, false);

    // Keep alive
    setInterval(() => {
      this.ping();
    }, 5000)


    // Get initial state key
    api.get('/state/key', (data) => {
      this.stateKey = data.key;
    });

    // Turn timer
    setInterval(() => {
      if (this.player.turnTimer) {
        let time = Date.now() / 1000;
        let [start, end] = this.player.turnTimer;
        end -= start;
        let width = Math.min(100, (time - start)/end * 100);
        // timerEl.style.width = `${width}%`; // TODO
      }
    }, 100);
  }

  searchApartments(nextSceneId) {
    let sceneEl = document.getElementById('scene--stage');
    sceneEl.querySelector('canvas:first-child').style.display = 'none';

    this.setActions([]);
    populateEl('scene', {
      'title': 'Listings',
      'desc': 'Loading listings...'
    });

    let remove = () => {
      let el = sceneEl.querySelector('canvas:last-child');
      el.parentElement.removeChild(el);
      sceneEl.querySelector('canvas:first-child').style.display = 'block';
    }

    let detailsEl = document.getElementById('scene--desc');
    displayListings(sceneEl, detailsEl, this.player.tenant, (unit) => {
      api.post(`/play/move/${this.id}`, {id: unit.id}, (data) => {
        sceneEl.querySelector('canvas:first-child').style.display = 'block';
        remove();
        this.loadScene(nextSceneId(true));
      });
    }, () => {
      this.setActions([{
        name: "Crash on a friend's couch",
        outcomes: [{
          id: 'couch',
          cb: () => {
            this.player.couch = true;
            remove();
          }
        }]
      }], Script.locations['home']);
    });
  }
}

export default Engine;
