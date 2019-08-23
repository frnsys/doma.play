import api from '../api';
import util from './util';
import uuid from 'uuid/v4';
import Views from './components';
import showApartments from './view/listings';

const sceneEl = document.getElementById('scene');

class Engine {
  constructor() {
    this.id = uuid();
    this.player = {};
  }

  loadAct(act) {
    let actEl = document.getElementById('act');
    actEl.style.opacity = 1;
    actEl.style.display = 'flex';
    actEl.style.background = `linear-gradient(to bottom, ${act.colors[0]} 0%, ${act.colors[1]} 100%)`;
    Views.Act(actEl, act);

    // Fade out act interstitial
    setTimeout(() => {
      let fadeOut = setInterval(() => {
        actEl.style.opacity -= 0.05;
        if (actEl.style.opacity <= 0) {
          actEl.style.display = 'none';
          clearInterval(fadeOut);
        }
      }, 100);
    }, 4000);
  }

  loadScene(scene) {
    if (scene.act) {
      this.loadAct(scene.act);
    }
    Views.BasicScene(sceneEl, this.waitForNextScene.bind(this), scene);
  }

  waitForNextScene(scene, action_id) {
    api.post(`/play/next_scene`, {
      id: this.id,
      scene_id: scene.id,
      action_id: action_id
    }, (data) => {
      console.log(data);
      if (data.ok) {
        if (data.scene.id == 'apartment_search') {
          this.searchApartments(data.scene);
        } else if (data.scene.id.startsWith('act_summary')) {
          this.summarizeAct(data.scene);
        } else {
          this.loadScene(data.scene);
        }
      } else {
        // TODO waiting message
        setTimeout(() => {
          this.waitForNextScene(scene, action_id);
        }, 2000);
      }
    });
  }

  summarizeAct(scene) {
    api.get('/state', (state) => {
      let summary = this.summarize(state);
      summary.delta = this.deltaize(summary, this.summary);
      this.summary = summary;
      api.get('/play/players', (data) => {
        let me = data.players[this.id];
        delete data.players[this.id];
        let players = Object.values(data.players);
        console.log(data);
        Views.ActSummary(sceneEl, summary, me, players, () => {
          this.waitForNextScene(scene.id, 0);
        });
      });
    });
  }

  ping() {
    api.post(`/play/ping/${this.id}`, {}, (data) => {
      if (!data.success) {
        alert('Your game session has expired. Starting a new one.');
        window.location.reload();
      }
    });
  }

  deltaize(summary, prevSummary) {
    return {
      avg: {
        rent: Math.round(util.percentChange(summary.avg.rent, prevSummary.avg.rent)),
        value: Math.round(util.percentChange(summary.avg.value, prevSummary.avg.value)),
        income: Math.round(util.percentChange(summary.avg.income, prevSummary.avg.income))
      }
    }
  }

  summarize(state) {
    let p_landlords = Object.values(state.stats.landlords).reduce((acc, ll) => acc + ll.p_units, 0);
    return {
      city: state.name,
      p: {
        landlords: p_landlords,
        commons: 1 - p_landlords,
        affordable: state.stats.percent_affordable,
        unaffordable: 1 -state.stats.percent_affordable,
      },
      avg: {
        rent: Math.round(state.stats.mean_rent_per_tenant),
        value: Math.round(state.stats.mean_value),
        income: Math.round(state.stats.mean_income)
      },
      population: state.stats.population
    }
  }

  start() {
    // Joining/leaving
    api.post('/play/join', {id: this.id}, (data) => {
      this.neighborhoods = data.state.neighborhoods;
      this.player.tenant = data.tenant;
      console.log(data.state);
      console.log(this.player);
      this.summary = this.summarize(data.state);
      Views.CitySummary(sceneEl, this.summary, () => {
        Views.PlayerIntro(sceneEl, this.player.tenant, this.summary, () => {
          this.loadScene(data.scene);
        });
      });
    });
    window.addEventListener('unload', () => {
      api.post('/play/leave', {id: this.id});
    }, false);

    // Keep alive
    setInterval(() => {
      this.ping();
    }, 5000)
  }

  searchApartments(scene) {
    api.get('/state', (state) => {
      let {parcels, vacancies, affordable} = this.parseParcels(state);
      let el = Views.ApartmentSearch(sceneEl, vacancies, affordable, () => {
        console.log('SKIPPING');
        this.player.couch = {
          neighborhood: util.randomChoice(Object.values(this.neighborhoods))
        };
        this.waitForNextScene(scene, 1);
      });
      let stageEl = el.querySelector('#stage');
      let listingsEl = el.querySelector('#listings');
      showApartments(stageEl, state.map, parcels, (p) => {
        Views.ApartmentListings(listingsEl, p.units, (u) => {
          // TODO disable interactions?
          api.post(`/play/move/${this.id}`, {id: u.id}, (data) => {
            this.waitForNextScene(scene, 0);
          });
        });
      });
    });
  }

  parseParcels(state) {
    let allVacantUnits = [];
    let tenant = this.player.tenant;
    let parcels = state.map.parcels;
    Object.keys(parcels).forEach((r) => {
      Object.keys(parcels[r]).forEach((c) => {
        let p = parcels[r][c];
        if (p.type == 'Residential' && p.neighb !== null) {
          p.hasUnits = true;
          p.neighb = state.neighborhoods[parseInt(p.neighb)];
          if (p.neighb) {
            p.vacancies = state.buildings[`${r}_${c}`].units
              .filter((uId) => state.units[uId].occupancy > state.units[uId].tenants);
            let vacantUnits = p.vacancies.map((id) => state.units[id]);
            allVacantUnits = allVacantUnits.concat(vacantUnits);
            p.affordable = vacantUnits.filter((u) => {
              u.rentPerTenant = Math.round(u.rent/(u.tenants + 1));
              u.affordable = u.rentPerTenant <= tenant.income/12;
              return u.affordable;
            });
            p.anyDOMA = vacantUnits.some((u) => u.doma);
            p.units = vacantUnits;
          }
        }
        p.tenantWork = tenant.work[0] == parseInt(r) && tenant.work[1] == parseInt(c);
      });
    });

    let affordableUnits = allVacantUnits.filter((u) => Math.round(u.rent/(u.tenants + 1)) <= (tenant.income/12))
    let vacancies = allVacantUnits.length > 0;
    let affordable = affordableUnits.length > 0;
    return {parcels, vacancies, affordable};
  }
}

export default Engine;
