import api from '../api';
import util from './util';
import uuid from 'uuid/v4';
import Views from './components';
import showApartments from './view/listings';

let params = location.search.slice(1);
let DEBUG = params.includes('debug');

const MAX_ENERGY = 10;
const sceneEl = document.getElementById('scene');
const statusEl = document.getElementById('status');

function computeSavings(income) {
  let x = income/25000;
  let p = x/(x+1);
  return p * income;
}

class Engine {
  constructor() {
    this.id = uuid();
    this.player = {};
    this.time = 0;
    this.player.energy = 8;
    this.setEnergy(this.player.energy);

    const equity_purchase = (scene) => {
      api.get('/state', (state) => {
        this.state = state;
        Views.EquityPurchase(sceneEl, {
          scene,
          city: state.namme,
          p_dividend: state.stats.doma_p_dividend,
          tenant: this.player.tenant,
          next: (shares) => {
            let influence = (shares/this.player.tenant.savings)/5;
            api.post(`/play/doma/${this.id}`, {amount: shares, influence: influence}, () => {
              this.player.tenant.equity = shares;
              this.waitForNextScene(scene, 0);
            });
          }
        });
      });
    };
    const policy_results = (scene) => {
      api.get('/play/policy/results', ({results}) => {
        // No results, just go to next scene
        if (Object.entries(results).length === 0) {
            this.waitForNextScene(scene, 0);
        } else {
          Views.PolicyResults(sceneEl, {
            scene,
            results,
            next: () => {
              this.waitForNextScene(scene, 0);
            }
          });
        }
      });
    };

    this.scenes = {
      'apartment_search': (scene) => this.searchApartments(scene, false),
      'apartment_search_post': (scene) => this.searchApartments(scene, true),
      'equity_purchase': equity_purchase,
      'equity_purchase_later': equity_purchase,
      'equity_results': (scene) => {
        api.get('/state', (state) => {
          let stats = state.stats;
          let prevStats = this.state.stats;
          let results = {
            members: stats.doma_members,
            raised: stats.doma_raised - prevStats.doma_raised,
            units: stats.landlords[-1].n_units,
            delta: {
              members: {
                amount: stats.doma_members - prevStats.doma_members,
                percent: util.percentChange(stats.doma_members, prevStats.doma_members)
              },
              raised: {
                amount: Math.round(stats.doma_raised - prevStats.doma_raised),
                percent: util.percentChange(stats.doma_raised, prevStats.doma_raised)
              },
              units: {
                amount: stats.landlords[-1].n_units - prevStats.landlords[-1].n_units,
                percent: util.percentChange(stats.landlords[-1].n_units, prevStats.landlords[-1].n_units)
              }
            }
          };
          // console.log('Neighborhoods');
          // console.log(this.neighborhoods);
          results.delta.neighbs = Object.keys(prevStats.neighborhoods).reduce((acc, id) => {
            let prev = prevStats.neighborhoods[id].doma_units;
            let curr = stats.neighborhoods[id].doma_units;
            let delta = curr - prev;
            if (delta > 0) {
              // console.log(`Neighborhood: ${id}`);
              let neighb = this.neighborhoods[id].name;
              acc[neighb] = delta;
            }
            return acc;
          }, {});
          this.state = state;
          this.crowdfundingResults = results;

          Views.EquityResults(sceneEl, {
            scene,
            results,
            next: () => {
              this.waitForNextScene(scene, 0);
            }
          });
        });
      },
      'equity_results_explained': (scene) => {
        let results = this.crowdfundingResults;
        api.get('/state', (state) => {
          api.get(`/play/tenant/${this.id}`, (player) => {
            this.state = state;
            Views.EquityResultsExplained(sceneEl, {
              scene,
              state,
              player,
              results,
              next: () => {
                this.waitForNextScene(scene, 0);
              }
            });
          });
        });
      },
      'strike': (scene) => {
        Views.BasicScene(sceneEl, {
          scene, player: this.player,
          onAction: () => {
            api.post(`/play/policy/${this.id}`, {policy: 'RentFreeze'}, () => {
              this.waitForNextScene(scene, 0);
            });
          }
        });
      },
      'petition': (scene) => {
        Views.BasicScene(sceneEl, {
          scene, player: this.player,
          onAction: () => {
            api.post(`/play/policy/${this.id}`, {policy: 'MarketTax'}, () => {
              this.waitForNextScene(scene, 0);
            });
          }
        });
      },
      'policy_results': policy_results,
      'policy_results_strike': policy_results,
      'policy_results_petition': policy_results,
      'doma_spread_the_word': (scene) => {
        Views.BasicScene(sceneEl, {
          scene, player: this.player,
          onAction: (scene, action_id) => {
            let amount = action_id * 0.1;
            api.post(`/play/preach/${this.id}`, {amount}, () => {
              this.waitForNextScene(scene, action_id);
            });
          }
        });
      },
      'doma_param_vote_equity': (scene) => {
        Views.EquityVote(sceneEl, {
          scene,
          next: (params) => {
            api.post(`/play/vote/${this.id}`, params, () => {
              this.waitForNextScene(scene, 0);
            });
          }
        });
      },
      'doma_param_vote_rent': (scene) => {
        Views.RentVote(sceneEl, {
          scene,
          next: (params) => {
            api.post(`/play/vote/${this.id}`, params, () => {
              this.waitForNextScene(scene, 0);
            });
          }
        });
      },
      'vote_results': (scene) => {
        api.get('/play/vote/results', ({results}) => {
          Views.VoteResults(sceneEl, {
            scene,
            results,
            next: () => {
              this.waitForNextScene(scene, 0);
            }
          });
        });
      },
      'bar_friends': (scene) => {
        api.get('/play/players', (data) => {
          let n = Object.keys(data.players).length;
          if (n <= 1) {
            scene.description = 'The bar is pretty empty, but a couple bodies linger about. ' + scene.description;
          } else {
            scene.description = 'There are quite a few patrons tonight. ' + scene.description;
          }
          Views.BasicScene(sceneEl, {
            scene, player: this.player,
            onAction: (scene, actionId) => {
              if (actionId == 0) {
                // Improve social parameter
                api.post(`/play/social/${this.id}`, {}, () => {});
              }
              this.waitForNextScene(scene, actionId);
            }
          });
        });
      },
      'bar_friends_2': (scene) => {
        api.get('/play/players', (data) => {
          let others = Object.keys(data.players).filter((id) => id !== this.id).map((id) => data.players[id]);
          if (others.length == 0) {
            scene.description = scene.description;
          } else if (others.length == 1) {
            scene.description = `They introduce themselves as ${others[0].name}. ` + scene.description;
          } else if (others.length == 2) {
            scene.description = `The pair introduces themselves as ${others[0].name} and ${others[1].name}. ` + scene.description;
          } else {
            let names = others.slice(0, others.length-1).map((o) => o.name).join(', ');
            names = `${names}, and ${others[others.length-1].name}`;
            scene.description = `The group introduces themselves as ${names}. ` + scene.description;
          }
          Views.BasicScene(sceneEl, {
            scene, player: this.player,
            onAction: this.waitForNextScene.bind(this)
          });
        });
      }
    };
  }

  changeEnergy(amt) {
    let notice = document.getElementById('toast');
    let msg, bg;
    if (amt < 0) {
      bg = '#f25858';
    } else {
      bg = '#32ae51';
    }
    if (amt <= -3) {
      msg = 'That was exhausting.';
    } else if (amt <= -2) {
      msg = 'That was tiring.';
    } else if (amt < 0) {
      msg = 'That was a bit tiring.';
    } else if (amt < 2) {
      msg = 'You feel a bit more energized.';
    } else if (amt < 5) {
      msg = 'You feel more energized.';
    } else {
      msg = 'You feel rejuvinated.';
    }

    notice.innerText = msg;
    notice.style.display = 'block';
    notice.style.background = bg;
    setTimeout(() => {
      notice.style.display = 'none';
    }, 2000);
    this.setEnergy(this.energy+amt);
  }

  setEnergy(energy) {
    this.energy = Math.min(Math.max(0, energy), MAX_ENERGY);
    document.getElementById('energy').innerText = [...Array(this.energy).keys()].map(() => '⚡').join('');
  }

  loadAct(act) {
    let actEl = document.getElementById('act');
    actEl.style.opacity = 1;
    actEl.style.display = 'flex';
    actEl.style.background = `linear-gradient(to bottom, ${act.colors[0]} 0%, ${act.colors[1]} 100%)`;
    Views.Act(actEl, {act});

    // Fade out act interstitial
    setTimeout(() => {
      let fadeOut = setInterval(() => {
        actEl.style.opacity -= 0.05;
        if (actEl.style.opacity <= 0) {
          actEl.style.display = 'none';
          clearInterval(fadeOut);
        }
      }, 80);
    }, 4000);
  }

  loadScene(scene, time) {
    if (time && this.time !== time) {
      let elapsed = time - this.time;
      this.time = time;
      let nonRent = this.player.tenant.income - this.player.tenant.rent;
      let savings = computeSavings(nonRent);
      this.player.tenant.savings += elapsed * savings;
    }

    if (scene.act && !DEBUG) {
      this.loadAct(scene.act);
    }

    if (scene.energy) {
      this.changeEnergy(scene.energy);
    }

    if (scene.id.startsWith('act_summary')) {
      this.summarizeAct(scene);

    } else if (scene.id in this.scenes) {
      this.scenes[scene.id](scene);

    } else {
      document.getElementById('hud').style.display = 'block';
      Views.BasicScene(sceneEl, {
        scene, player: this.player,
        onAction: this.waitForNextScene.bind(this)
      });
    }
  }

  waitForNextScene(scene, action_id) {
    let action = scene.actions[action_id];
    if (action.cost) {
      this.changeEnergy(-action.cost.energy);
    }

    api.post(`/play/next_scene`, {
      id: this.id,
      scene_id: scene.id,
      action_id: action_id
    }, (data) => {
      if (data.ok) {
        statusEl.style.display = 'none';
        this.loadScene(data.scene, data.time);
      } else {
        statusEl.style.display = 'block';
        statusEl.innerText = 'Waiting for other players...';
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
        me.delta = {
          savings: Math.round(util.percentChange(this.player.tenant.savings, me.savings)),
          rent: Math.round(util.percentChange(this.player.tenant.rent, me.rent)),
          income: Math.round(util.percentChange(this.player.tenant.income, me.income)),
        }
        me.savings = this.player.tenant.savings;
        me.equity = this.player.tenant.equity;
        this.player.tenant = me;
        Views.ActSummary(sceneEl, {
          summary, me, players,
          showDomaShare: scene.showDomaShare,
          next: () => {
            this.waitForNextScene(scene, 0);
          }
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
      p: {
        doma: summary.p.doma - prevSummary.p.doma,
        landlords: summary.p.landlords - prevSummary.p.landlords,
        commons: summary.p.commons - prevSummary.p.commons,
        affordable: summary.p.affordable - prevSummary.p.affordable,
        unaffordable: summary.p.unaffordable - prevSummary.p.unaffordable
      },
      avg: {
        rent: Math.round(util.percentChange(summary.avg.rent, prevSummary.avg.rent)),
        value: Math.round(util.percentChange(summary.avg.value, prevSummary.avg.value)),
        income: Math.round(util.percentChange(summary.avg.income, prevSummary.avg.income))
      }
    }
  }

  summarize(state) {
    // Excluding DOMA
    let p_doma = 0;
    let p_landlords = Object.keys(state.stats.landlords).reduce((acc, id) => {
      if (id == -1) {
        p_doma += state.stats.landlords[id].p_units;
        return acc;
      } else {
        return acc + state.stats.landlords[id].p_units;
      }
    }, 0);
    return {
      city: state.name,
      p: {
        doma: p_doma,
        landlords: p_landlords,
        commons: 1 - p_landlords,
        affordable: state.stats.percent_affordable,
        unaffordable: 1 - state.stats.percent_affordable,
      },
      avg: {
        rent: Math.round(state.stats.mean_rent_per_tenant),
        value: Math.round(state.stats.mean_value),
        income: Math.round(state.stats.mean_income)
      },
      population: state.stats.population * 1000 // Simulate larger populations
    }
  }

  start() {
    // Joining/leaving
    api.post('/play/join', {id: this.id}, (data) => {
      this.neighborhoods = data.state.neighborhoods;
      this.player.tenant = data.tenant;
      this.time = data.state.time;
      this.summary = this.summarize(data.state);
      Views.CitySummary(sceneEl, {
        summary: this.summary,
        next: () => {
          Views.PlayerIntro(sceneEl, {
            tenant: this.player.tenant,
            summary: this.summary,
            next: () => {
              this.loadScene(data.scene);
            }
          });
        }
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

  searchApartments(scene, freeDOMA) {
    api.get(`/play/tenant/${this.id}`, (player) => {
      this.player.tenant.dividend = player.tenant.dividend;
      console.log(player);
      api.get('/state', (state) => {
        let {parcels, vacancies, affordable, maxSpaciousness, allVacantUnits} = this.parseParcels(state, player.tenant, freeDOMA);
        let el = Views.ApartmentSearch(sceneEl, {
          vacancies, affordable, allVacantUnits,
          onHidePopup: () => {
            // this.changeEnergy(-1);
          },
          onSkip: () => {
            this.player.couch = {
              neighborhood: util.randomChoice(Object.values(this.neighborhoods))
            };
            this.waitForNextScene(scene, 1);
          }
        });

        let attempts = 0;
        let stageEl = el.querySelector('#stage');
        let listingsEl = el.querySelector('#listings');
        Views.ApartmentListings(listingsEl, {});
        showApartments(stageEl, state.map, parcels, (p) => {
          Views.ApartmentListings(listingsEl, {
            parcel: p,
            tenant: this.player.tenant,
            maxSpaciousness: maxSpaciousness,
            units: p.units,
            onSelect: (u, ev) => {
              attempts += 1;

              // DOMA units always accept players
              if (u.owner.type == 'DOMA') {
                // TODO disable interactions?
                this.player.tenant.rent = u.adjustedRentPerTenant;
                api.post(`/play/move/${this.id}`, {id: u.id}, (data) => {
                  this.waitForNextScene(scene, 2);
                });
              } else {
                if ((DEBUG || Math.random() <= 0.2 && attempts > 2) || attempts >= 4) {
                  this.player.tenant.rent = u.adjustedRentPerTenant;
                  api.post(`/play/move/${this.id}`, {id: u.id}, (data) => {
                    this.waitForNextScene(scene, 0);
                  });
                } else {
                  u.taken = true;
                  let button = ev.target;
                  button.classList.add('disabled');
                  button.innerText = 'No longer available';
                  let popup = document.getElementById('apartment-search--popup');
                  popup.querySelector('p').innerText = util.randomChoice([
                    'You call the landlord, who informs you that the place has already been taken.',
                    'You apply—the landlord ended up going with another applicant.'
                  ]);
                  popup.style.display = 'flex';
                }
              }
            }
          });
        });
      });
    });
  }

  parseParcels(state, player, freeDOMA) {
    let allVacantUnits = [];
    let tenant = this.player.tenant;
    let parcels = state.map.parcels;
    let maxSpaciousness = 0;
    Object.keys(parcels).forEach((r) => {
      Object.keys(parcels[r]).forEach((c) => {
        let p = parcels[r][c];
        if (p.type == 'Residential' && p.neighb !== null) {
          p.hasUnits = true;
          p.neighb = state.neighborhoods[parseInt(p.neighb)];
          if (p.neighb) {
            state.buildings[`${r}_${c}`].units.forEach((uId) => {
              maxSpaciousness = Math.max(maxSpaciousness, state.units[uId].spaciousness);
            });
            p.vacancies = state.buildings[`${r}_${c}`].units
              .filter((uId) => {
                let u = state.units[uId];
                return u.occupancy > u.tenants || freeDOMA && u.owner.type == 'DOMA';
              });
            let vacantUnits = p.vacancies.map((id) => state.units[id]);
            allVacantUnits = allVacantUnits.concat(vacantUnits);
            p.affordable = vacantUnits.filter((u) => {
              u.rentPerTenant = Math.round(u.rent/u.occupancy);
              u.adjustedRentPerTenant = player.dividend ? Math.max(u.rentPerTenant - player.dividend, 0) : u.rentPerTenant;
              u.affordable = u.adjustedRentPerTenant <= tenant.income;
              u.neighbDesirability = p.desirability;
              u.doma = u.owner.type == 'DOMA';
              return u.affordable;
            });
            p.anyDOMA = vacantUnits.some((u) => u.doma);
            p.units = vacantUnits;
            p.units.sort((a, b) => {
              return a.rentPerTenant - b.rentPerTenant;
            });
          }
        }
        p.tenantWork = tenant.work.pos[0] == parseInt(r) && tenant.work.pos[1] == parseInt(c);
      });
    });

    let affordableUnits = allVacantUnits.filter((u) => Math.round(u.rent/(u.tenants + 1)) <= (tenant.income))
    let vacancies = allVacantUnits.length > 0;
    let affordable = affordableUnits.length > 0;
    return {parcels, vacancies, affordable, maxSpaciousness, allVacantUnits};
  }
}

export default Engine;
