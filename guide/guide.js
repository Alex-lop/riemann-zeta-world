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
  return opening ??= import('./scene.js?v=3').then(m => {
    scene = m;
    world = m.startWorld($('world'), { panel: $('panel'), count: $('count'), wash: true, quiet: still });
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

// ---- figures -----------------------------------------------------------------------------------
const C = { ink: '#ecebe6', muted: '#9aa0aa', hair: '#222937', strong: '#364052', red: '#e6392d', gold: '#f5c542', blue: '#6ea8ff' };
const MONO = '11px ui-monospace, "SF Mono", Menlo, monospace';
const isPrime = n => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return n > 1; };

// A canvas figure drawn in CSS pixels. paint() calls draw(ctx, w, h) on a cleared canvas, and runs again when the canvas is resized.
function plot(stage, height, draw) {
  const canvas = el(`<canvas class="plot" style="height:${height}"></canvas>`), ctx = canvas.getContext('2d');
  stage.append(canvas);
  const paint = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight, d = Math.min(devicePixelRatio, 2);
    if (!w) return;
    if (canvas.width !== Math.round(w * d)) canvas.width = Math.round(w * d);
    if (canvas.height !== Math.round(h * d)) canvas.height = Math.round(h * d);
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.font = MONO; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    draw(ctx, w, h);
  };
  new ResizeObserver(paint).observe(canvas);
  return { canvas, paint };
}
const line = (ctx, x0, y0, x1, y1, colour) => { ctx.strokeStyle = colour; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };

// Prime spikes, from PLAN.md's appendix, where it was tested against mpmath. T is where the ride is: the zeros south of it are
// in the sum, each fading in as it is passed. As T grows a prime tends to 1, a prime power p^m to 1/m and everything else to 0.
// No prime is given to this sum.
function spikes(x, T, zeros) {
  if (!(T > 0)) return 0;
  let s = 0;
  for (const g of zeros) { if (g >= T) break; s -= (1 - g / T) * Math.cos(g * Math.log(x)); }
  return s * (4 * Math.PI / T) * Math.sqrt(x) / Math.log(x);
}

// ---- the second half: one hypothetical zero ----------------------------------------------------
// The view for it: low over the line just south of the zero, looking straight north so the two sides are seen to mirror each other.
// A moment after the view settles the land becomes the completed function's, which is its own mirror image. Then every frame
// the view follows the zero north or south, except while it is being dragged, and the two red tags follow it and its twin.
let mirrored = false, morph = 0, aim = 2;           // aim: how far north of the zero the view looks. Less lifts the zero clear of a tall chart
function lab(w, ahead = 2) {
  aim = ahead;
  w.camera.position.set(0, 6.5, scene.zOf(ghost.gamma - 11)); w.controls.target.set(0, 0, scene.zOf(ghost.gamma + aim));
  if (!mirrored) morph = setTimeout(() => w.mirror(true), still() ? 0 : 900);
  mirrored = true;
}
function tags(w) {
  if (!w.holding()) { const dz = (scene.zOf(ghost.gamma + aim) - w.controls.target.z) * (still() ? 1 : 0.08); w.camera.position.z += dz; w.controls.target.z += dz; }
  const [ax, ay] = w.project(ghost.beta, ghost.gamma, 1.5), [bx, by] = w.project(1 - ghost.beta, ghost.gamma, 1.5);
  $('tag-a').style.transform = `translate(${ax + 16}px, ${ay - 8}px)`;
  $('tag-b').style.transform = `translate(calc(${bx - 16}px - 100%), ${by - 8}px)`; $('tag-b').hidden = ghost.beta <= 0.5;
}

// r(x) = (G(x) - ln 2 pi) / sqrt(x) for the real primes up to 10^6, where G(x) = sum over n <= x of Lambda(n) (x / n - 1) - x (ln x - 1 - gamma)
// is the centred count of prime powers the announced proof works with. If every zero is on the line, |r| stays within BAND.
// G, BAND and wave() are restated from the teammate's proofMath.js (PR #6), which follows the riemann-rev guide. Keep them in agreement.
// ponytail: primes to 10^6, which a phone sieves at once; his page goes to 10^7.
const EULER = 0.5772156649015329, BAND = 2 + EULER - Math.log(4 * Math.PI), DATA = 1e6;
let curve = null;
function primeCurve() {
  if (curve) return curve;
  const lam = new Float32Array(DATA + 1), sieve = new Uint8Array(DATA + 1);      // lam[n] is ln p if n is a power of the prime p, else 0
  for (let p = 2; p <= DATA; p++) {
    if (sieve[p]) continue;
    for (let m = 2 * p; m <= DATA; m += p) sieve[m] = 1;
    for (let q = p, L = Math.log(p); q <= DATA; q *= p) lam[q] = L;
  }
  const N = 6000, lx = new Float32Array(N), r = new Float32Array(N);
  for (let k = 0, n = 1, s0 = 0, s1 = 0; k < N; k++) {
    const x = 10 ** (1 + 5 * k / (N - 1));
    while (n + 1 <= x) { n++; if (lam[n]) { s0 += lam[n]; s1 += lam[n] / n; } }
    lx[k] = Math.log10(x); r[k] = (x * s1 - s0 - x * Math.log(x) + (1 + EULER) * x - Math.log(2 * Math.PI)) / Math.sqrt(x);
  }
  console.assert(r.every(v => Math.abs(v) <= BAND), 'prime curve self-check failed: the real primes left the band');
  return curve = { lx, r };
}
// What a zero pair at beta ± i gamma adds to r(x): -2 Re(x^rho / (rho (rho - 1))) / sqrt(x). Its swings grow like x^(beta - 1/2).
const rho2 = (beta, gamma) => Math.hypot(beta * (beta - 1) - gamma * gamma, gamma * (2 * beta - 1));   // |rho (rho - 1)|
function wave(x, beta, gamma) {
  const L = Math.log(x), dr = beta * (beta - 1) - gamma * gamma, di = gamma * (2 * beta - 1);
  return -2 * Math.exp((beta - 0.5) * L) * (Math.cos(gamma * L) * dr + Math.sin(gamma * L) * di) / (dr * dr + di * di);
}
// Where those swings first reach the band, as a power of ten. Finite for every beta above 1/2, however close to the line.
const breakExp = (beta, gamma) => Math.log(BAND * rho2(beta, gamma) / 2) / ((beta - 0.5) * Math.LN10);
const FULL = '<p><a href="./proof.html">the full pictures, on the proof page</a></p>';
const sup = n => String(n).replace(/./g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d] ?? '⁻');
const pow10 = e => { if (e >= 15) return `10${sup(Math.round(e))}`; let k = Math.floor(e), m = Math.round(10 ** (e - k)); if (m === 10) { m = 1; k++; } return `${m} × 10${sup(k)}`; };

// ---- the ten steps -----------------------------------------------------------------------------
// id: the name in the URL hash. learn: the anchor of the long version in learn.html. world: the step runs over the 3D world.
// lab: the step keeps the mirror land and the hypothetical zero up.
// mount(stage, ui) builds the interaction and may return a cleanup. ui.done() shows the payoff, ui.say(html) replaces the instruction.
// A step with no mount yet shows fig, a static figure, and no instruction.
const STEPS = [
  { id: 'primes', learn: 'primes', title: 'Primes are the atoms',
    idea: 'Every whole number above 1 breaks into primes, and it does so in exactly one way.',
    todo: 'Type a number.',
    payoff: 'Start 360 another way, as 8 × 45, and you get the same primes: three 2s, two 3s and one 5.',
    legend: [['blue', 'open', 'a prime']],
    mount(stage, ui) {
      const MAX = 999999999;
      const box = el(`<div><label class="slide" style="grid-template-columns:auto 1fr">a whole number<input class="num" type="number" min="2" max="${MAX}" value="360" inputmode="numeric"></label><p class="atoms"></p><p class="readout"></p></div>`);
      const input = box.querySelector('input'), [atoms, read] = box.querySelectorAll('p');
      const split = () => {
        const n = +input.value, parts = [];
        if (!Number.isInteger(n) || n < 2 || n > MAX) { atoms.innerHTML = ''; read.textContent = 'a whole number from 2 to 999,999,999'; return; }
        let m = n;
        for (let d = 2; d * d <= m; d++) while (m % d === 0) { parts.push(d); m /= d; }
        if (m > 1) parts.push(m);
        atoms.innerHTML = parts.map(p => `<span>${p}</span>`).join('<i>×</i>');
        const powers = [...new Set(parts)].map(p => { const k = parts.filter(q => q === p).length; return k > 1 ? `${p}<sup>${k}</sup>` : p; });
        read.innerHTML = parts.length === 1 ? `${n.toLocaleString('en')} is a prime: one atom` : `${n.toLocaleString('en')} = ${powers.join(' × ')}`;
      };
      input.addEventListener('input', () => { split(); ui.done(); });
      stage.append(box); split();
    } },

  { id: 'counting', learn: 'counting', title: 'Random up close, smooth from afar',
    idea: 'Primes get rarer as numbers grow, but unevenly. Still, the number of primes up to x is roughly x / ln x.',
    todo: 'Drag along the number line.',
    payoff: 'Up to 100 there are 25 primes, and x / ln x says about 21.7. The central question is how far a sharpened estimate misses.',
    legend: [['blue', '', 'the count of primes, one step at each'], ['inked', '', 'the smooth guess, x / ln x']],
    mount(stage, ui) {
      const X0 = 2, X1 = 200, TOP = 50, PRIMES = Array.from({ length: X1 - 1 }, (_, k) => k + 2).filter(isPrime);   // the axis starts at 2: ln 1 is 0
      const box = el(`<label class="slide">2<input type="range" min="${X0}" max="${X1}" step="1" value="100" aria-label="x, how far along the number line">200</label>`);
      const input = box.querySelector('input'), read = el('<p class="readout"></p>');
      let px = v => v;
      const fig = plot(stage, 'clamp(200px, 42vh, 330px)', (ctx, w, h) => {
        const x = +input.value, L = 30, base = h - 26, py = v => base - (base - 12) * v / TOP;
        px = v => L + (w - L - 12) * (v - X0) / (X1 - X0);
        ctx.fillStyle = C.muted; ctx.textAlign = 'right';
        for (let v = 10; v < TOP; v += 10) { line(ctx, L, py(v) + 0.5, w - 12, py(v) + 0.5, C.hair); ctx.fillText(v, L - 6, py(v) + 4); }
        ctx.textAlign = 'center';
        for (const v of [2, 50, 100, 150, 200]) ctx.fillText(v, px(v), h - 6);
        line(ctx, L, base + 0.5, w - 12, base + 0.5, C.strong);
        for (const p of PRIMES) line(ctx, Math.round(px(p)) + 0.5, base - (p <= x ? 9 : 4), Math.round(px(p)) + 0.5, base, p <= x ? C.blue : C.strong);   // a tick on each prime
        ctx.strokeStyle = C.ink; ctx.beginPath();
        for (let v = X0; v <= X1; v += 0.5) ctx.lineTo(px(v), py(v / Math.log(v)));
        ctx.stroke();
        ctx.strokeStyle = C.blue; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px(X0), py(0));
        let count = 0;
        for (const p of PRIMES) { if (p > x) break; ctx.lineTo(px(p), py(count)); ctx.lineTo(px(p), py(++count)); }
        ctx.lineTo(px(x), py(count)); ctx.stroke(); ctx.lineWidth = 1;
        line(ctx, px(x) + 0.5, 12, px(x) + 0.5, base, C.strong);
        ctx.textAlign = x > 150 ? 'right' : 'left'; const dx = x > 150 ? -8 : 8;
        ctx.fillStyle = C.blue; ctx.fillText(`${count} primes up to ${x}`, px(x) + dx, py(count) - 8);
        read.textContent = `up to ${x}: ${count} primes, and x / ln x ≈ ${(x / Math.log(x)).toFixed(1)}`;
      });
      const move = () => { fig.paint(); ui.done(); };
      input.addEventListener('input', move);
      // Dragging on the picture moves x too.
      fig.canvas.addEventListener('pointermove', e => { if (!e.buttons) return; const r = fig.canvas.getBoundingClientRect(), a = px(X0), b = px(X1); input.value = Math.round(X0 + (X1 - X0) * clamp((e.clientX - r.left - a) / (b - a), 0, 1)); move(); });
      stage.append(box, read);
    } },

  { id: 'zeta', learn: 'complex', title: 'One function knows every prime',
    idea: 'ζ(s) adds 1/n<sup>s</sup> over every whole number n. Each term is an arrow, and ζ adds arrows that turn at different speeds.',
    todo: 'Drag the height t.',
    payoff: 'At t = 0 nothing has turned, and the total is π<sup>2</sup>/6 ≈ 1.6449. Euler showed the same total is a product with one factor for each prime.',
    mount(stage, ui) {
      // The real part stays at 2. On the critical line this sum does not settle, so it is not drawn there.
      const box = el('<label class="slide" style="text-transform:none">t = 0<input type="range" min="0" max="40" step="0.05" value="0" aria-label="t, the height of s">40</label>');
      const input = box.querySelector('input'), read = el('<p class="readout"></p>');
      const fig = plot(stage, 'clamp(230px, 56vh, 460px)', (ctx, w, h) => {
        const t = +input.value, unit = Math.min((w - 40) / 2, (h - 36) / 1.5), ox = (w - 1.75 * unit) / 2, oy = h / 2, N = 300;
        line(ctx, 8, oy + 0.5, w - 8, oy + 0.5, C.hair); line(ctx, ox + 0.5, 8, ox + 0.5, h - 8, C.hair);
        ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.fillText('0', ox - 8, oy + 14); ctx.fillText('1', ox + unit, oy + 14); line(ctx, ox + unit + 0.5, oy - 3, ox + unit + 0.5, oy + 4, C.strong);
        ctx.textAlign = 'left'; ctx.fillText('s = 2 + it: the real part stays at 2', 12, 18);
        let re = 0, im = 0;
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ox, oy);
        for (let n = 1; n < N; n++) { const a = t * Math.log(n); re += Math.cos(a) / (n * n); im -= Math.sin(a) / (n * n); ctx.lineTo(ox + re * unit, oy - im * unit); }   // arrow n: length 1/n², turned by −t ln n
        ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = C.ink;
        for (let n = 1, x = 0, y = 0; n <= 8; n++) { const a = t * Math.log(n); x += Math.cos(a) / (n * n); y -= Math.sin(a) / (n * n); ctx.fillRect(ox + x * unit - 2.5, oy - y * unit - 2.5, 5, 5); }   // where the first eight arrows end
        // What is left of the sum after N terms: N^(1-s) / (s - 1) + N^(-s) / 2. With it, this is zeta(2 + it) to about 1e-7.
        const a = t * Math.log(N), d = 1 + t * t;
        re += (Math.cos(a) - t * Math.sin(a)) / (N * d) + Math.cos(a) / (2 * N * N); im += (-Math.sin(a) - t * Math.cos(a)) / (N * d) - Math.sin(a) / (2 * N * N);
        ctx.strokeStyle = C.ink; ctx.strokeRect(Math.round(ox + re * unit) - 6.5, Math.round(oy - im * unit) - 6.5, 13, 13);
        ctx.textAlign = 'left'; ctx.fillText('ζ(s)', ox + re * unit + 12, oy - im * unit - 8);
        read.textContent = `s = 2 + ${t.toFixed(2)}i: the arrows add up to ζ(s) ≈ ${re.toFixed(4)} ${im < 0 ? '−' : '+'} ${Math.abs(im).toFixed(4)}i`;
      });
      input.addEventListener('input', () => { fig.paint(); ui.done(); });
      stage.append(box, read);
    } },

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
    legend: [['blue', '', 'the sum of the waves, over the numbers 1.5 to 50 (log scale)']],
    mount(stage, ui) {
      // The axis starts at 1.5: at x = 1, ln x is 0 and the sum is infinite. It is spaced evenly in ln x, so every spike is as wide as the next.
      const X0 = 1.5, X1 = 50, SPAN = Math.log(X1 / X0), PRIMES = Array.from({ length: X1 - 1 }, (_, k) => k + 2).filter(isPrime);
      let T = 0, named = false;                              // named: far enough north that every prime up to 50 has its spike
      const fig = plot(stage, 'clamp(104px, 22vh, 190px)', (ctx, w, h) => {
        const px = x => 8 + (w - 16) * Math.log(x / X0) / SPAN, base = h - 22, unit = (base - 20) / 1.4, zero = base - 0.3 * unit, py = v => zero - v * unit;   // room for dips below zero
        line(ctx, 0, zero + 0.5, w, zero + 0.5, C.hair);
        line(ctx, 0, base + 0.5, w, base + 0.5, C.strong);
        ctx.fillStyle = C.muted; ctx.textAlign = 'center';
        for (let n = 2, last = -99; n <= X1; n++) {            // every whole number has a tick, and its numeral wherever there is room
          const x = px(n);
          line(ctx, x, base, x, base + 4, C.strong);
          if (x - last >= 17) { ctx.fillText(n, x, h - 6); last = x; }
        }
        ctx.strokeStyle = C.blue; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0, n = Math.round(w * 1.5); i <= n; i++) { const x = X0 * Math.exp(SPAN * i / n); ctx.lineTo(px(x), py(spikes(x, T, ZEROS))); }
        ctx.stroke();
        // The names come from a sieve, separately from the sum, and only once the spikes are standing.
        if (named) { ctx.fillStyle = C.blue; let last = -99; for (const p of PRIMES) { const x = px(p); if (x - last >= 15) { ctx.fillText(p, x, py(spikes(p, T, ZEROS)) - 5); last = x; } } }
        ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText(`${ZEROS.filter(g => g < T).length} waves added`, w - 8, 14);
      });
      return ride(stage, ui, (t, passed) => {
        $('passed').textContent = `${passed} of 100 zeros passed`;
        if (Math.abs(t - T) < 0.02) return;
        T = t; named ||= T >= 150; fig.paint();
      });
    } },

  { id: 'suppose', learn: 'strip', world: true, lab: true, title: 'Suppose one zero were off the line',
    idea: 'Completed with its gamma factor, ζ’s land mirrors itself across the line. So a nontrivial zero off the line needs a twin.',
    todo: 'Drag the red zero off the line.',
    payoff: 'A nontrivial zero left of the line forces one to its right. So it is enough to show that no zero lies to the right.',
    legend: [['red', 'open', HYPOTHETICAL]],
    more: `<details><summary>What the land, the walls and the stripes are</summary>
      The land here is the size of ξ(s) = ½ s(s − 1) π<sup>−s/2</sup> Γ(s/2) ζ(s), divided at each height by its size on the line. It has the same nontrivial zeros as ζ.
      The walls: proved 1896, every nontrivial zero lies between these walls.
      The stripes: a machine-written paper released on 6 Oct 2026 states that no zero lies in here. Its repository says this is formalized in Lean. Not peer reviewed.
      The red zero stops at the stripes. That is this guide’s rule for the fiction, not a theorem.</details>` + FULL,
    mount(stage, ui) {
      const box = el('<label class="slide">on the line<input type="range" min="0.5" max="0.875" step="0.005" aria-label="Real part of the hypothetical zero">7/8</label>');
      const input = box.querySelector('input'), read = el('<p class="readout"></p>');
      stage.append(box, read);
      ghost.beta = 0.5;                                      // it starts on the line: taking it off is the visitor's act
      let own = false, stop = () => {};
      const sync = w => {
        input.value = ghost.beta; w?.ghost(ghost.beta, ghost.gamma);
        const g = ghost.gamma.toFixed(1);
        read.innerHTML = ghost.beta > 0.5 ? `<span class="red">hypothetical zero at ${ghost.beta.toFixed(3)} + ${g}i</span> · its twin at ${(1 - ghost.beta).toFixed(3)} + ${g}i` : `on the line at 0.500 + ${g}i: no twin needed`;
      };
      sync();
      withWorld(w => {
        lab(w); sync(w);
        input.addEventListener('input', () => { own = true; ghost.beta = +input.value; sync(w); ui.done(); });
        w.onGhost = (beta, gamma) => { own = true; ghost.beta = beta; ghost.gamma = gamma; sync(); ui.done(); };
        const t0 = performance.now();
        w.tick = now => {                                    // nobody has moved it: it leaves the line by itself
          if (!own && now - t0 > 3000 && ghost.beta < 0.72) { ghost.beta = still() ? 0.72 : Math.min(0.72, ghost.beta + 0.002); sync(w); ui.done(); }
          tags(w);
        };
        stop = () => { w.tick = w.onGhost = null; };
      });
      return () => stop();
    } },

  { id: 'band', learn: 'y2026-shape', world: true, lab: true, title: 'The primes would show it',
    idea: 'If every nontrivial zero is on the line, a weighted, centred count of prime powers, over √x, stays in the gold band.',
    todo: 'Add the hypothetical zero’s wave.',
    payoff: 'Its wave outgrows √x, so it always breaks out, only later nearer the line. The announced proof needs less than the band: a ceiling from above only, on some windows.',
    legend: [['gold', 'band', 'the band, if every nontrivial zero is on the line'], ['blue', '', 'the real primes'], ['red', 'dash', HYPOTHETICAL]],
    more: FULL,
    mount(stage, ui) {
      const LX0 = 1, LX1 = 12, TOP = 0.14, { lx, r } = primeCurve();   // the chart: x from 10 to 10^12, heights within ±0.14
      ghost.beta = 0.85;                                     // far enough off the line that the break falls inside the real data
      let on = false, own = false, stop = () => {};
      const fig = plot(stage, 'clamp(150px, 27vh, 240px)', (ctx, w, h) => {
        const L = 62, R = 10, T = 8, B = 22, px = e => L + (w - L - R) * (e - LX0) / (LX1 - LX0), mid = (T + h - B) / 2, py = v => mid - v / TOP * (mid - T);
        ctx.fillStyle = C.muted;
        for (let e = LX0; e <= LX1; e++) {
          line(ctx, px(e) + 0.5, T, px(e) + 0.5, h - B, C.hair);
          if (w > 600 || e % 2 === 0) { ctx.textAlign = e === LX1 ? 'right' : 'center'; ctx.fillText(`10${sup(e)}`, px(e), h - 7); }
        }
        ctx.textAlign = 'right';
        for (const v of [BAND, 0, -BAND]) ctx.fillText(v ? (v > 0 ? '+' : '−') + BAND.toFixed(4) : '0', L - 6, py(v) + 4);
        ctx.fillStyle = 'rgb(245 197 66 / .13)'; ctx.fillRect(L, py(BAND), w - L - R, py(-BAND) - py(BAND));   // the band: a pale fill and two solid edges
        ctx.lineWidth = 1.5; line(ctx, L, py(BAND), w - R, py(BAND), C.gold); line(ctx, L, py(-BAND), w - R, py(-BAND), C.gold); ctx.lineWidth = 1;
        line(ctx, L, mid + 0.5, w - R, mid + 0.5, C.strong);
        line(ctx, px(6) + 0.5, T, px(6) + 0.5, h - B, C.strong);
        ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText(w > 600 ? 'real primes, every one up to 10⁶' : 'real primes to 10⁶', px(6) - 6, h - B - 6);
        ctx.save(); ctx.beginPath(); ctx.rect(L, T, w - L - R, h - T - B); ctx.clip();
        if (on) {
          const { beta, gamma } = ghost, amp = e => 2 * 10 ** ((beta - 0.5) * e) / rho2(beta, gamma);
          ctx.strokeStyle = C.red; ctx.globalAlpha = 0.45; ctx.beginPath();                // the curve with the wave added; past the data, the wave alone
          for (let k = 0; k < lx.length; k++) ctx.lineTo(px(lx[k]), py(r[k] + wave(10 ** lx[k], beta, gamma)));
          for (let k = 1, n = 5000; k <= n; k++) { const e = 6 + (LX1 - 6) * k / n; ctx.lineTo(px(e), py(wave(10 ** e, beta, gamma))); }
          ctx.stroke(); ctx.globalAlpha = 1;
          ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;                                    // how far it swings: dashed, like its stalk
          for (const side of [1, -1]) { ctx.beginPath(); for (let e = LX0; e <= LX1; e += 0.05) ctx.lineTo(px(e), py(side * amp(e))); ctx.stroke(); }
          ctx.setLineDash([]); ctx.lineWidth = 1;
          const e = beta > 0.5 ? breakExp(beta, gamma) : Infinity;
          if (e < LX1) { ctx.strokeRect(px(e) - 5, py(BAND) - 5, 10, 10); ctx.fillStyle = C.red; ctx.textAlign = e > 9 ? 'right' : 'left'; ctx.fillText('leaves the band', px(e) + (e > 9 ? -10 : 10), py(BAND) - 9); }
          ctx.fillStyle = C.muted; ctx.textAlign = 'left'; ctx.fillText(w > 600 ? 'past 10⁶: the hypothetical wave alone' : 'the wave alone', px(6) + 6, h - B - 6);
        }
        ctx.strokeStyle = C.blue; ctx.beginPath();
        for (let k = 0; k < lx.length; k++) ctx.lineTo(px(lx[k]), py(r[k]));
        ctx.stroke(); ctx.restore();
      });
      const bar = el('<div class="bar"><button type="button" class="btn" aria-pressed="false">Add its wave</button><label class="slide" hidden>on the line<input type="range" min="0.5" max="0.875" step="0.005" aria-label="Real part of the hypothetical zero">7/8</label></div>');
      const button = bar.querySelector('button'), slide = bar.querySelector('label'), input = bar.querySelector('input'), read = el('<p class="readout"></p>');
      stage.append(bar, read);
      const sync = w => {
        input.value = ghost.beta; w?.ghost(ghost.beta, ghost.gamma); fig.paint();
        const at = `${ghost.beta.toFixed(3)} + ${ghost.gamma.toFixed(1)}i`;
        read.innerHTML = !on ? 'the real primes alone: inside the band all the way to 10⁶'
          : ghost.beta <= 0.5 ? `hypothetical zero back on the line at ${at}: its wave never grows`
          : `<span class="red">hypothetical zero at ${at}: its swings reach the band near ${pow10(breakExp(ghost.beta, ghost.gamma))}</span>${breakExp(ghost.beta, ghost.gamma) >= LX1 ? ', far off this chart' : ''}`;
      };
      const turnOn = w => { on = true; button.setAttribute('aria-pressed', 'true'); button.hidden = true; slide.hidden = false; ui.say('Slide the zero back toward the line.'); ui.done(); sync(w); };
      sync();
      withWorld(w => {
        lab(w, innerWidth >= 900 ? -3 : 2); sync(w);
        button.addEventListener('click', () => { own = true; turnOn(w); });
        input.addEventListener('input', () => { own = true; ghost.beta = +input.value; sync(w); });
        w.onGhost = (beta, gamma) => { own = true; ghost.beta = beta; ghost.gamma = gamma; sync(); };
        const t0 = performance.now();
        w.tick = now => { if (!own && !on && now - t0 > 4000) turnOn(w); tags(w); };   // nobody pressed: show the break anyway
        stop = () => { w.tick = w.onGhost = null; };
      });
      return () => stop();
    } },

  { id: 'ceiling', learn: 'y2026-size', title: 'Where the ceiling comes from',
    idea: 'A nonzero whole number divisible by many primes is at least their product.',
    todo: 'Toggle primes into the number.',
    payoff: 'As the guides describe the announced proof: arithmetic caps the upward swings; an off-line zero would break the cap; so no zero lies to the right of the line, and by the mirror no nontrivial zero lies to the left.',
    more: `<details><summary>Where groups come in</summary>As the guides describe it, one step of the argument averages over the characters of a finite abelian group. <a href="./learn.html#characters">The long version teaches them in six steps.</a></details>
      <details><summary>What nobody has explained yet</summary>Both published guides take the central inequality from the Lean code without proving it.</details>` + FULL,
    mount(stage, ui) {
      // Both pictures are schematic, as on proof.html: seven of these primes fit under the bound and the eighth does not.
      const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19], CAP = 1e6, TOP = 8, X = 10000, on = new Set();
      const one = el(`<div><p class="chips">${PRIMES.map(p => `<button type="button" class="btn chip" aria-pressed="false">${p}</button>`).join('')}</p>
        <div class="meter"><i></i><b></b><span>a bound on its size</span></div><p class="readout"></p>
        <p class="small">A metaphor: the shape of the argument, not its real objects. Those are theta lifts between unitary groups, named here and not taught.</p></div>`);
      const two = el(`<div hidden><p class="small">The construction is repeated m times. One cost grows like x/m and the other like m. Their sum is least at m = √x, and that is where the ½ comes from.</p>
        <label class="slide" style="text-transform:none">m = 10<input type="range" min="1" max="3" step="0.01" value="1" aria-label="The number of repeats, m">1,000</label><p class="readout"></p></div>`);
      stage.append(one, two);
      one.querySelector('b').style.left = one.querySelector('span').style.left = `${Math.log10(CAP) / TOP * 100}%`;
      const squeeze = () => {
        const list = PRIMES.filter(p => on.has(p)), least = list.reduce((a, p) => a * p, 1);
        one.querySelector('i').style.width = `${Math.min(100, Math.log10(least) / TOP * 100)}%`;
        one.querySelector('.readout').innerHTML = !list.length ? 'divisible by nothing in particular: it can be as small as 1'
          : `divisible by ${list.join(', ')}: at least <span class="blue">${list.join(' × ')}${list.length > 1 ? ' = ' + least.toLocaleString('en') : ''}</span>` + (least > CAP ? '. Over the bound: only so many primes fit.' : '');
      };
      const input = two.querySelector('input');
      const fig = plot(two, '150px', (ctx, w, h) => {      // x/m, m and their sum against m, both axes logarithmic
        const px = e => 12 + (w - 24) * (e - 1) / 2, py = v => h - 16 - (h - 34) * (Math.log10(v) - 1) / 2.1, m = 10 ** +input.value;
        for (const [cost, colour, width] of [[e => X / 10 ** e, C.muted, 1], [e => 10 ** e, C.muted, 1], [e => X / 10 ** e + 10 ** e, C.ink, 1.5]]) {
          ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.beginPath();
          for (let e = 1; e <= 3.001; e += 0.02) ctx.lineTo(px(e), py(cost(e)));
          ctx.stroke();
        }
        ctx.lineWidth = 1; line(ctx, px(2) + 0.5, py(200), px(2) + 0.5, h - 16, C.strong);
        ctx.fillStyle = C.muted; ctx.fillText('x/m', px(1) + 4, py(1000) + 16); ctx.textAlign = 'right'; ctx.fillText('m', px(3) - 4, py(1000) + 16);
        ctx.textAlign = 'center'; ctx.fillText('m = √x = 100', px(2), h - 4); ctx.fillStyle = C.ink; ctx.fillText('x/m + m', px(2), py(200) - 10);
        ctx.fillRect(px(+input.value) - 4.5, py(X / m + m) - 4.5, 9, 9);
      });
      const balance = () => { const m = Math.round(10 ** +input.value); two.querySelector('.readout').textContent = `x = 10,000 and m = ${m.toLocaleString('en')}: x/m + m = ${Math.round(X / m).toLocaleString('en')} + ${m.toLocaleString('en')} = ${Math.round(X / m + m).toLocaleString('en')}`; fig.paint(); };
      one.addEventListener('click', e => {
        const chip = e.target.closest('.chip'); if (!chip) return;
        const p = +chip.textContent; on.has(p) ? on.delete(p) : on.add(p);
        chip.setAttribute('aria-pressed', on.has(p)); squeeze();
        if (two.hidden) { two.hidden = false; ui.say('Now slide m.'); ui.done(); balance(); }   // the second thing to do, in place of the first
      });
      input.addEventListener('input', balance);
      squeeze();
    } },

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
  if (!step?.lab) { clearTimeout(morph); mirrored = false; if (world) { world.ghost(); world.mirror(false); } }   // the fiction never leaves its two steps
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
