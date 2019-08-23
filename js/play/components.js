// Wrapper/decorator to process HTML templates
// into HTML elements
const View = (tmpl, handlers, defaultState) => {
  return (parent, ...args) => {
    // Clear parent
    while (parent.hasChildNodes()) {
      parent.removeChild(parent.lastChild);
    }

    let state = Object.assign({}, defaultState);
    let t_el = document.createElement('template');
    let html = tmpl(state, ...args);
    t_el.innerHTML = html.trim();
    let el = t_el.content.firstChild;

    // Bind handlers, if any
    // Specified in the format:
    // {
    //    "selector": {
    //      "event": fn
    //      // or
    //      "event": [fnA, fnB]
    //    }
    // }
    handlers = handlers || {};
    Object.keys(handlers).forEach((sel) => {
      let chs = Array.from(el.querySelectorAll(sel));
      Object.keys(handlers[sel]).forEach((ev) => {
        let fns = handlers[sel][ev];
        fns = Array.isArray(fns) ? fns : [fns];
        chs.forEach((ch) => {
          fns.forEach((fn) => {
            ch.addEventListener(ev, (ev) => {
              let props = ch.dataset;
              fn({state, el, ch, ev, props});
            });
          });
        });
      });
    });

    parent.appendChild(el);
  }
}

const viewize = (...templates) => {
  return Object.entries({ ...templates })
    .reduce((acc, [k, v]) => {
      acc[k] = View(v);
      return acc;
    }, {});
}

// Template functions
const Bar = (p) => `
  <div class="bar">
    <div class="bar--fill" style="width:${p*100}%"></div>
  </div>
`

const AnnotatedBar = (p, left, right) => `
  <div class="bar-annotated">
    <div class="bar-annotated--labels">
      <div class="bar--label bar--label-left">
        ${left.map((t) => `<div>${t}</div>`).join('')}
      </div>
      <div class="bar--label bar--label-right">
        ${right.map((t) => `<div>${t}</div>`).join('')}
      </div>
    </div>
    ${Bar(p)}
  </div>
`

const LabeledBar = (p, labels) => `
  <div class="bar-labeled">
    <div class="bar--label">
        ${labels.map((t) => `<div>${t}</div>`).join('')}
    </div>
    ${Bar(p)}
  </div>
`

const Act = View((state, act) => `
  <div>
    <h2 class="act--number">Act ${act.number}</h2>
    <h1 class="act--title">"${act.title}"</h1>
    <div class="act--desc">${act.description}</div>
  </div>
`);

const BasicScene = View((state, onAction, scene) => {
  state.scene = scene;
  state.onAction = onAction;
  return `<div>
      <div class="scene--stage"></div>
      <div class="scene--body">
        <h3 class="scene--title">${scene.title}</h3>
        <p class="scene--desc">${scene.description}</p>
        <div class="scene--actions">
          ${scene.actions.map((a, i) => {
            return `<div class="scene--action" data-id="${i}">${a.name}</div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `
}, {
  '.scene--action': {
    'click': ({state, props, el}) => {
      if (!state.disabled) {
          // Prevent multiple clicking
          state.disabled = true;
          el.querySelector('.scene--actions').classList.add('disabled');
          state.onAction(state.scene, parseInt(props.id));
      }
    }
  }
}, {
  disabled: false
})

export default {BasicScene, Act};
