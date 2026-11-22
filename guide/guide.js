// The guide of Zeta World: an intro in the manner of Alex's Nemisis site, then a climb of ten short steps.
// Every sentence of mathematics or news below is cut from docs/guide-content.json, PLAN.md or the teammate's proof.html
// (see GUIDE_BRIEF.md, section 6). Do not write new ones from memory. Each step is at most 60 words: sentence, instruction, payoff.

import { ZEROS } from './zeros.js';

const $ = id => document.getElementById(id), root = document.documentElement;
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const still = () => reduce.matches || root.dataset.motion === 'off';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// The one hypothetical zero the second half of the climb is about, at BETA + i GAMMA. It is fiction and is always labelled so.
// It stays right of the line and left of 7/8, between heights 10 and 60, as on the teammate's proof.html.
const ghost = { beta: 0.72, gamma: 35 };
const HYPOTHETICAL = 'hypothetical: no nontrivial zero off the line has ever been found';

// ---- the intro's picture: the strip from Re(s) = 0 to 1, the line, the first zeros, one open red square and its twin ----
{
  const strip = $('strip'), TOP = 64, at = (sigma, t) => `left:${sigma * 100}%;top:${100 - t / TOP * 100}%`;
  const draw = () => {
    strip.innerHTML = `<i class="wall" style="left:0"></i><i class="wall" style="left:100%"></i><i class="line"></i>
      <span class="gold" style="left:calc(50% + 9px);top:10px">Re(s) = ½</span><span style="left:6px;bottom:8px">0</span><span style="right:6px;bottom:8px">1</span>`
      + ZEROS.filter(t => t < TOP - 2).map(t => `<i class="zero" style="${at(0.5, t)}"></i><span style="right:calc(50% + 14px);${at(0.5, t).split(';')[1]};margin-top:-5px">${t.toFixed(2)}</span>`).join('')
      + `<i class="ghost" style="${at(ghost.beta, ghost.gamma)}"></i><i class="ghost" style="${at(1 - ghost.beta, ghost.gamma)}"></i>
      <span class="red" id="strip-note" style="left:12px;right:12px;bottom:34px;white-space:normal;text-align:center;line-height:1.5">${HYPOTHETICAL}</span>`;
  };
  draw();
  // Move the pointer over the hero and the open square follows, with its twin. Real zeros never move.
  strip.parentElement.addEventListener('pointermove', e => {
    const r = strip.getBoundingClientRect(), sigma = (e.clientX - r.left) / r.width, [a, b] = strip.querySelectorAll('.ghost');
    if (!a || r.width === 0) return;
    ghost.beta = clamp(Math.abs(sigma - 0.5) + 0.5, 0.5, 0.875); ghost.gamma = clamp((1 - (e.clientY - r.top) / r.height) * TOP, 10, 60);
    a.style.cssText = at(ghost.beta, ghost.gamma); b.style.cssText = at(1 - ghost.beta, ghost.gamma);
  }, { passive: true });
}

// ---- the 3D world, loaded the first time a step needs it ---------------------------------------
let world = null, scene = null, opening = null, turn = 0;
const NO_WEBGL = 'This browser could not start WebGL, so the 3D view is off.';

function openWorld() {
  return opening ??= import('./scene.js?v=2').then(m => {
    scene = m;
    world = m.startWorld($('world'), { panel: $('panel'), count: $('count'), wash: true });
    new ResizeObserver(() => world.resize()).observe($('panel'));   // portrait frames the scene above the card, whose height changes with the step
    return world;
  }).catch(() => null);
}
// Runs fn(world) once the world is up, unless the visitor has moved on to another screen by then.
function withWorld(fn) {
  const mine = turn;
  openWorld().then(w => {
    if (mine !== turn) return;
    if (w) { w.run(true); fn(w); } else { $('fly-status').textContent = NO_WEBGL; $('s-stage').prepend(el(`<p class="small">${NO_WEBGL}</p>`)); }
  });
}

// The ride, shared by two steps: one slider moves the point the camera looks at along the line, and the camera keeps its offset.
// T is where the middle of the view meets the line, and the zeros south of it count as passed. each(T, passed) runs every frame.
function ride(stage, ui, each) {
  const box = el('<label class="slide">south<input type="range" min="12" max="237" step="0.1" value="12" aria-label="Ride north along the line">north</label>');
  const input = box.querySelector('input'), canvas = $('world');
  stage.append(box);
  let own = false, stop = () => {};                          // own: the visitor has taken the slider, so the ride stops driving itself
  input.addEventListener('input', () => { own = true; ui.done(); });
  withWorld(w => {
    const tOf = z => (scene.zOf(0) - z) / (scene.zOf(0) - scene.zOf(1)), t0 = performance.now();
    let last = t0;
    w.camera.position.set(-3.5, 6.5, scene.zOf(-3)); w.controls.target.set(0, 0, scene.zOf(12));   // the start view's offset, 10 further south
    w.controls.enableZoom = false;                           // in a ride the wheel moves you along the line
    const wheel = e => { input.value = +input.value + e.deltaY * 0.04; own = true; ui.done(); };
    canvas.addEventListener('wheel', wheel, { passive: true });
    w.tick = now => {
      if (!own && !still() && now - t0 > 3000) { input.value = +input.value + (now - last) * 0.011; ui.done(); }   // nobody is driving: ride anyway, 11 a second
      last = now;
      const dz = (scene.zOf(+input.value) - w.controls.target.z) * (still() ? 1 : 0.1);   // ponytail: eased per frame, not per second; fine at 60 or 120 Hz
      w.camera.position.z += dz; w.controls.target.z += dz;
      const T = tOf(w.controls.target.z);
      each(T, w.zeros.filter(g => g < T).length);
    };
    stop = () => { w.tick = null; w.controls.enableZoom = true; canvas.removeEventListener('wheel', wheel); };
  });
  return () => stop();
}

// ---- the ten steps -----------------------------------------------------------------------------
// id: the name in the URL hash. learn: the anchor of the long version in learn.html. world: the step runs over the 3D world.
// mount(stage, ui) builds the interaction and may return a cleanup. ui.done() shows the payoff, ui.say(html) replaces the instruction.
// A step with no mount yet shows fig, a static figure, and no instruction.
const STEPS = [
  { id: 'primes', learn: 'primes', title: 'Primes are the atoms',
    idea: 'Every whole number above 1 breaks into primes, and it does so in exactly one way.',
    todo: 'Type a number.',
    payoff: 'Start 360 another way, as 8 × 45, and you get the same primes: three 2s, two 3s and one 5.',
    fig: '360 = 2<sup>3</sup> × 3<sup>2</sup> × 5' },

  { id: 'counting', learn: 'counting', title: 'Random up close, smooth from afar',
    idea: 'Primes get rarer as numbers grow, but unevenly. Still, the number of primes up to x is roughly x / ln x.',
    todo: 'Drag along the number line.',
    payoff: 'Up to 100 there are 25 primes, and x / ln x says about 21.7. The central question is how far a sharpened estimate misses.',
    fig: 'π(100) = 25 &nbsp;·&nbsp; 100 / ln 100 ≈ 21.7' },

  { id: 'zeta', learn: 'complex', title: 'One function knows every prime',
    idea: 'ζ(s) adds 1/n<sup>s</sup> over every whole number n. Each term is an arrow, and ζ adds arrows that turn at different speeds.',
    todo: 'Drag the height t.',
    payoff: 'At t = 0 nothing has turned, and the total is π<sup>2</sup>/6 ≈ 1.6449. Euler showed the same total is a product with one factor for each prime.',
    fig: 'ζ(2) = 1 + 1/4 + 1/9 + ⋯ = π<sup>2</sup>/6' },

  { id: 'landscape', learn: 'landscape', world: true, title: 'A landscape with wells',
    idea: 'Draw the size of ζ(s) as the height of land. A zero is a point where the land touches the floor.',
    todo: 'Drag to look around.',
    payoff: 'Each pin stands on a nontrivial zero, at the bottom of a dark well. Height is squashed so the pole at s = 1 fits.',
    legend: [['gold', '', 'the critical line, Re(s) = ½'], ['inked', 'dot', 'a zero']],
    mount(stage, ui) {
      let stop = () => {};
      withWorld(w => { w.controls.addEventListener('start', ui.done); stop = () => w.controls.removeEventListener('start', ui.done); });
      return () => stop();
    } },

  { id: 'road', learn: 'statement', world: true, title: 'Every well on one line',
    idea: 'Here are the first 100 zeros in this strip, and every one is on the same straight line.',
    todo: 'Drag the slider to ride north.',
    payoff: 'The gold line is Re(s) = ½. These are the first 100 of infinitely many, and the land here stops just past the 100th.',
    mount: (stage, ui) => ride(stage, ui, (T, passed) => { $('passed').textContent = `${passed} of 100 zeros passed`; }) },

  { id: 'waves', learn: 'waves', world: true, title: 'Each zero is a wave',
    idea: 'Add the waves of the zeros you have passed, and spikes rise at 2, 3, 5, 7, 11.',
    todo: 'Ride north again.',
    payoff: 'No prime was given to the sum. The small bumps at 4, 8 and 9 are prime powers. Zeros and primes encode each other.',
    fig: '2, 3, 5, 7, 11, …' },

  { id: 'suppose', learn: 'strip', title: 'Suppose one zero were off the line',
    idea: 'A nontrivial zero at β + iγ has a twin at 1 − β + iγ, mirrored across the line.',
    todo: 'Drag the red zero off the line.',
    payoff: 'A zero left of the line forces one to its right. So it is enough to show that no zero lies to the right.',
    legend: [['red', 'open', 'hypothetical: no nontrivial zero off the line has ever been found']],
    fig: '<span class="red">0.7 + 20i &nbsp;⟷&nbsp; 0.3 + 20i</span>' },

  { id: 'band', learn: 'y2026-shape', title: 'The primes would show it',
    idea: 'If every zero is on the line, a centred count of prime powers, divided by √x, stays inside the gold band.',
    todo: 'Switch on the hypothetical zero’s wave.',
    payoff: 'Its wave grows faster than √x, so it always breaks out, only later nearer the line. The announced proof needs less than the band: a ceiling from above only, on some windows.',
    legend: [['gold', 'band', 'the band, if every zero is on the line'], ['red', 'dash', 'hypothetical: no nontrivial zero off the line has ever been found']],
    fig: '<span class="gold">±0.0462 · √x</span>' },

  { id: 'ceiling', learn: 'y2026-size', title: 'Where the ceiling comes from',
    idea: 'A nonzero whole number divisible by many primes is at least their product.',
    todo: 'Toggle primes into the number.',
    payoff: 'As the guides describe the announced proof: arithmetic caps the upward swings; an off-line zero would break the cap; so no zero lies to the right of the line, and by the mirror no nontrivial zero lies to the left.',
    more: `<details><summary>Where groups come in</summary>One step of the argument averages over the characters of a finite abelian group. <a href="./learn.html#characters">The long version teaches them in six steps.</a></details>
      <details><summary>What nobody has explained yet</summary>Both published guides take the central inequality from the Lean code without proving it.</details>`,
    fig: '4 · 9 · 25 = 900' },

  { id: 'checked', learn: 'y2026-checks', title: 'Released, checked, still needed',
    idea: 'On 20 November 2026, Levent Alpöge announced a proof of the hypothesis, found with the AI model Claude, and released it as Lean code only.',
    todo: 'Open each check.',
    payoff: 'Still to come: the author’s written proof, review by independent experts, a human account of the central inequality, and the end of two long checks.',
    mount(stage, ui) {
      // A passed check is a tick and the word. The texts are content y2026-checks and y2026-needed.
      let n = 0;
      const check = (name, text) => `<details name="check"><summary><b>${++n}</b>${name}<span>✓ passed</span></summary><p>${text}</p></details>`;
      stage.append(el(`<div class="checks">
        ${check('The statement is the right one', 'The target is Mathlib’s own definition of the hypothesis. The generalized hypothesis is covered for Dirichlet L-functions only. This says nothing about the proof.')}
        ${check('The code compiles', 'Dozens of people reported compiling the code without errors. Alone, that would not catch a redefined symbol or an added axiom.')}
        ${check('The code proves that statement', 'Two independent tools matched the proved theorem against a file that imports only Mathlib, with only Lean’s three standard axioms. An end-to-end comparison run was still running on 22 Nov.')}
        ${check('Independent checkers accept it', 'Several independently written checkers accepted the full proof. A pass relies on them, and on Mathlib’s definitions meaning what is intended. Lean’s own kernel on the full export was still running on 22 Nov.')}
      </div>`));
      const status = $('proof-status').cloneNode(true);       // the site's status sentence, word for word, from the one place it is written
      status.removeAttribute('id'); status.className = 'status';
      stage.append(status);
      stage.addEventListener('toggle', ui.done, { capture: true, once: true });
    } },
];

// ---- the shell: one step on screen, named by the URL hash --------------------------------------
let leave = null, timer = 0;
const TITLE = document.title;

function show() {
  const id = location.hash.slice(1), i = STEPS.findIndex(s => s.id === id), step = STEPS[i];
  leave?.(); leave = null; clearTimeout(timer); turn++;
  const mode = step ? (step.world ? 'world' : 'paper') : id === 'fly' ? 'fly' : 'intro';
  root.dataset.mode = mode; root.dataset.step = step ? id : '';
  document.title = step ? `${step.title} · Zeta World` : TITLE;
  world?.run(mode === 'world' || mode === 'fly');             // no drawing while the land is off screen
  if (mode === 'fly') withWorld(() => { $('fly-status').textContent = 'Drag to orbit, scroll or pinch to zoom.'; });
  if (!step) return;

  const stage = $('s-stage'), payoff = $('s-payoff');
  $('s-count').textContent = `${i + 1} / ${STEPS.length}`;
  $('s-ticks').innerHTML = STEPS.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('');
  $('s-title').innerHTML = step.title; $('s-idea').innerHTML = step.idea;
  $('s-do').innerHTML = step.todo; $('s-do').hidden = !step.mount;
  $('s-legend').innerHTML = (step.legend || []).map(([colour, kind, text]) => `<span><i class="sw ${kind} ${colour}"></i>${text}</span>`).join('');
  $('s-more').innerHTML = (step.more || '') + `<p><a href="./learn.html#${step.learn}">the long version of this step</a></p>`;
  payoff.innerHTML = step.payoff; payoff.classList.remove('on'); $('s-live').textContent = '';
  $('s-back').href = '#' + (STEPS[i - 1]?.id || '');
  $('s-next').href = '#' + (STEPS[i + 1]?.id || 'fly'); $('s-next').textContent = STEPS[i + 1] ? 'Next ›' : 'Fly the world ›';

  // The payoff shows once the visitor has acted, or after a few seconds if they have not.
  const ui = { done() { if (payoff.classList.contains('on')) return; payoff.classList.add('on'); $('s-live').textContent = payoff.textContent; }, say(html) { $('s-do').innerHTML = html; } };
  timer = setTimeout(ui.done, step.mount ? 6000 : 600);
  stage.replaceChildren();
  if (step.mount) leave = step.mount(stage, ui) || null; else stage.append(el(`<p class="fig">${step.fig}</p>`));
  scrollTo(0, 0); $('s-title').focus({ preventScroll: true });
}
addEventListener('hashchange', show);
show();

// Arrow keys and Space move between steps, unless a slider, field, button or summary has the focus: then the key is theirs.
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, button, select, textarea, summary')) return;
  const mode = root.dataset.mode, forward = e.key === 'ArrowRight' || e.key === ' ';
  const to = mode === 'intro' ? (e.key === 'ArrowRight' ? '#' + STEPS[0].id : null) : mode === 'fly' ? null : forward ? $('s-next').hash : e.key === 'ArrowLeft' ? $('s-back').hash || '#' : null;
  if (to === null) return;
  e.preventDefault(); location.hash = to;
});

// Pause motion: the same switch as the personal site. The ticks listen for motion:change, and still() covers the rest.
const motion = $('motion');
function motionLabel() { motion.textContent = still() ? 'Resume motion' : 'Pause motion'; motion.disabled = reduce.matches; }
motion.addEventListener('click', () => {
  if (root.dataset.motion === 'off') delete root.dataset.motion; else root.dataset.motion = 'off';
  document.dispatchEvent(new CustomEvent('motion:change')); motionLabel();
});
reduce.addEventListener('change', motionLabel);
motionLabel();
