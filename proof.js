// The four pictures of proof.html. One hypothetical zero (beta + i gamma) is shared by steps 1-3.
import { criticalZeros } from './zeta.js';
import { normalizedPrimeSum, logSpace, rogueWave, breachPoint, RH_BAND } from './proofMath.js';

const C = {
  bg: '#12151d', grid: 'rgba(255,255,255,0.07)', axis: 'rgba(255,255,255,0.22)', text: 'rgba(154,161,178,0.95)',
  data: 'rgba(201,206,216,0.85)', red: '#ff6b6b', gold: '#f5c542', green: '#7dffb2', white: '#ffffff',
};
const Y_DATA = 1e7;              // primes are computed up to here
const LX_MIN = 1, LX_MAX = 14;    // chart range: x from 10 to 10^14
const R_MAX = 0.14;               // vertical range of the chart: +-R_MAX
const WINDOWS = [[2, 3], [4, 6], [8, 12]]; // [log10 Y, log10 Y^(3/2)]

const state = { sigma: 0.65, gamma: 40, on: true };
const beta = () => Math.max(state.sigma, 1 - state.sigma);
const $ = (id) => document.getElementById(id);

// ---- data -------------------------------------------------------------------------
const ys = logSpace(10, Y_DATA, 120000);
const r = normalizedPrimeSum(ys, Y_DATA);
let iMin = 0, iMax = 0;
for (let i = 1; i < r.length; i++) { if (r[i] < r[iMin]) iMin = i; if (r[i] > r[iMax]) iMax = i; }
const zeros = criticalZeros(62);

// ---- helpers -----------------------------------------------------------------------
function setup(canvas, aspect) {
  const dpr = Math.min(devicePixelRatio, 2);
  const w = canvas.clientWidth || 600, h = Math.round(w * aspect);
  canvas.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.font = '11px ui-monospace, Menlo, monospace';
  return { g, w, h };
}

const sup = (n) => String(n).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
const sci = (x) => {
  if (!Number.isFinite(x)) return '∞';
  if (x < 1e5) return Math.round(x).toLocaleString('en-US');
  const e = Math.floor(Math.log10(x));
  return `${(x / 10 ** e).toFixed(1)}×10${sup(e)}`;
};

// Column envelopes of the plotted curves over the log-x chart.
function envelopes(cols) {
  const b = beta(), gm = state.gamma;
  const data = Array.from({ length: cols }, () => [Infinity, -Infinity]);
  const withZero = Array.from({ length: cols }, () => [Infinity, -Infinity]);
  const col = (y) => Math.floor(((Math.log10(y) - LX_MIN) / (LX_MAX - LX_MIN)) * cols);
  for (let i = 0; i < ys.length; i++) {
    const c = col(ys[i]);
    if (c < 0 || c >= cols) continue;
    const v = r[i], u = v + rogueWave(ys[i], b, gm);
    if (v < data[c][0]) data[c][0] = v;
    if (v > data[c][1]) data[c][1] = v;
    if (u < withZero[c][0]) withZero[c][0] = u;
    if (u > withZero[c][1]) withZero[c][1] = u;
  }
  // beyond the computed primes: the hypothetical wave alone, sampled finely
  const cData = col(Y_DATA);
  for (let c = Math.max(cData, 0); c < cols; c++) {
    for (let k = 0; k < 24; k++) {
      const lx = LX_MIN + ((c + k / 24) / cols) * (LX_MAX - LX_MIN);
      const y = 10 ** lx;
      if (y <= Y_DATA) continue;
      const u = rogueWave(y, b, gm);
      if (u < withZero[c][0]) withZero[c][0] = u;
      if (u > withZero[c][1]) withZero[c][1] = u;
    }
  }
  return { data, withZero, cData };
}

// First x (scanning upward) where the curve leaves the band; upOnly/inWindows restrict the test.
function firstBreach({ upOnly = false, inWindows = false } = {}) {
  const b = beta(), gm = state.gamma;
  const ok = (y) => !inWindows || WINDOWS.some(([a, c]) => Math.log10(y) >= a && Math.log10(y) <= c);
  const bad = (u) => (upOnly ? u > RH_BAND : Math.abs(u) > RH_BAND);
  for (let i = 0; i < ys.length; i += 2) {
    if (!ok(ys[i])) continue;
    const u = r[i] + rogueWave(ys[i], b, gm);
    if (bad(u)) return { x: ys[i], v: u };
  }
  for (let lx = Math.log10(Y_DATA); lx <= LX_MAX; lx += 0.0005) {
    const y = 10 ** lx;
    if (!ok(y)) continue;
    const u = rogueWave(y, b, gm);
    if (bad(u)) return { x: y, v: u };
  }
  return null;
}

// ---- steps 2 and 3: the chart ------------------------------------------------------
function drawChart(canvas, { windows = false } = {}) {
  const { g, w, h } = setup(canvas, 0.62);
  const L = 44, R = w - 10, T = 12, B = h - 26;
  const px = (lx) => L + ((lx - LX_MIN) / (LX_MAX - LX_MIN)) * (R - L);
  const py = (v) => (T + B) / 2 - (Math.max(-R_MAX * 1.05, Math.min(R_MAX * 1.05, v)) / R_MAX) * ((B - T) / 2);

  // grid and axes
  g.strokeStyle = C.grid; g.fillStyle = C.text; g.lineWidth = 1;
  for (let lx = LX_MIN; lx <= LX_MAX; lx++) {
    g.beginPath(); g.moveTo(px(lx), T); g.lineTo(px(lx), B); g.stroke();
    if (lx % 2 === 0 || lx === 1) g.fillText(`10${sup(lx)}`, Math.min(px(lx) - 9, R - 26), B + 16);
  }
  for (const v of [-0.1, -0.05, 0, 0.05, 0.1]) {
    g.beginPath(); g.moveTo(L, py(v)); g.lineTo(R, py(v)); g.stroke();
    g.fillText(v.toFixed(2), 4, py(v) + 4);
  }
  // the region beyond the computed primes
  g.fillStyle = 'rgba(255,255,255,0.035)';
  g.fillRect(px(Math.log10(Y_DATA)), T, R - px(Math.log10(Y_DATA)), B - T);

  // windows
  if (windows) {
    for (const [a, c] of WINDOWS) {
      g.fillStyle = 'rgba(245,197,66,0.07)';
      g.fillRect(px(a), T, px(c) - px(a), B - T);
    }
  }

  // band (or ceiling)
  g.strokeStyle = C.gold; g.lineWidth = 1.2; g.setLineDash([5, 4]);
  for (const v of windows ? [RH_BAND] : [RH_BAND, -RH_BAND]) {
    g.globalAlpha = windows ? 0.45 : 1;
    g.beginPath(); g.moveTo(L, py(v)); g.lineTo(R, py(v)); g.stroke();
  }
  g.setLineDash([]); g.globalAlpha = 1;
  if (windows) {
    g.lineWidth = 4;
    for (const [a, c] of WINDOWS) { g.beginPath(); g.moveTo(px(a), py(RH_BAND)); g.lineTo(px(c), py(RH_BAND)); g.stroke(); }
  }

  // curves, as per-column envelopes
  const cols = Math.max(50, Math.round(R - L));
  const E = envelopes(cols);
  const colX = (c) => L + ((c + 0.5) / cols) * (R - L);
  const drawEnv = (env, color, upTo = cols) => {
    g.strokeStyle = color; g.lineWidth = 1.4;
    g.beginPath();
    for (let c = 0; c < upTo; c++) {
      const [lo, hi] = env[c];
      if (!Number.isFinite(lo)) continue;
      g.moveTo(colX(c), py(lo)); g.lineTo(colX(c), py(hi) - 0.5);
    }
    g.stroke();
  };
  g.save(); g.beginPath(); g.rect(L, T, R - L, B - T); g.clip();
  if (state.on) drawEnv(E.withZero, C.red);
  drawEnv(E.data, C.data, E.cData);
  g.restore();

  if (windows) { // gray out the lower half: only upward swings matter
    g.fillStyle = 'rgba(18,21,29,0.72)';
    g.fillRect(L, py(0), R - L, B - py(0));
    g.fillStyle = C.text;
    g.fillText('downward swings: not needed', L + 6, B - 22);
  }

  // labels on top of the curves
  const tag = (text, x, y, color) => {
    const tw = g.measureText(text).width;
    g.fillStyle = 'rgba(18,21,29,0.85)'; g.fillRect(x - 3, y - 11, tw + 6, 15);
    g.fillStyle = color; g.fillText(text, x, y);
  };
  tag('primes not computed here →', px(Math.log10(Y_DATA)) + 6, T + 14, C.text);
  if (windows) for (const [a, c] of WINDOWS) tag(`[10${sup(a)}, 10${sup(c)}]`, px(a) + 3, B - 6, C.gold);

  // first breach
  if (state.on) {
    const br = firstBreach(windows ? { upOnly: true, inWindows: true } : {});
    if (br) {
      const x = px(Math.log10(br.x)), y = py(br.v);
      g.strokeStyle = C.white; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 6, 0, 2 * Math.PI); g.stroke();
      g.fillStyle = C.white;
      g.fillText(windows ? 'breaks the ceiling' : 'leaves the band', Math.min(x + 9, R - 120), y - 8);
    }
    return br;
  }
  return null;
}

// ---- step 1: the strip ---------------------------------------------------------------
const S_MIN = -0.3, S_MAX = 1.3, T_MAX = 62;
let stripGeom = null;
function drawStrip() {
  const canvas = $('strip');
  const { g, w, h } = setup(canvas, 0.78);
  const L = 30, R = w - 10, T = 10, B = h - 24;
  const px = (s) => L + ((s - S_MIN) / (S_MAX - S_MIN)) * (R - L);
  const py = (t) => B - (t / T_MAX) * (B - T);
  stripGeom = { L, R, T, B, px, py };

  g.fillStyle = 'rgba(245,197,66,0.09)';
  g.fillRect(px(0.5), T, px(1) - px(0.5), B - T);
  g.fillStyle = C.gold;
  g.fillText('the proof: no zeros here', px(0.5) + 6, T + 14);

  g.fillStyle = C.text;
  for (let t = 0; t <= 60; t += 10) {
    g.strokeStyle = C.grid; g.beginPath(); g.moveTo(L, py(t)); g.lineTo(R, py(t)); g.stroke();
    g.fillText(String(t), 4, py(t) + 4);
  }
  for (const [s, col, lab] of [[0, C.axis, 'σ = 0'], [1, C.axis, 'σ = 1'], [0.5, C.white, 'σ = ½']]) {
    g.strokeStyle = col; g.lineWidth = s === 0.5 ? 1.6 : 1;
    g.beginPath(); g.moveTo(px(s), T); g.lineTo(px(s), B); g.stroke();
    g.fillStyle = s === 0.5 ? C.white : C.text;
    g.fillText(lab, px(s) - 14, B + 16);
  }
  g.fillStyle = C.green;
  for (const t of zeros) { g.beginPath(); g.arc(px(0.5), py(t), 3.5, 0, 2 * Math.PI); g.fill(); }

  // the hypothetical zero and its twin
  const s1 = state.sigma, s2 = 1 - state.sigma, y = py(state.gamma);
  g.strokeStyle = 'rgba(255,107,107,0.7)'; g.setLineDash([4, 4]); g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(px(s1), y); g.lineTo(px(s2), y); g.stroke(); g.setLineDash([]);
  g.fillStyle = C.red;
  g.beginPath(); g.arc(px(s1), y, 7, 0, 2 * Math.PI); g.fill();
  g.strokeStyle = C.red; g.lineWidth = 2;
  g.beginPath(); g.arc(px(s2), y, 6, 0, 2 * Math.PI); g.stroke();
  g.fillStyle = C.red;
  g.fillText('drag me', px(s1) + 10, y - 9);
  g.fillText('twin', px(s2) + (s2 < s1 ? -36 : 10), y - 9);

  const on = Math.abs(state.sigma - 0.5) < 0.003;
  $('stripReadout').innerHTML = on
    ? `Hypothetical zero at ½ + ${state.gamma.toFixed(2)}i: <span class="ok">on the line, it is its own twin</span>.`
    : `Hypothetical zero at ${state.sigma.toFixed(3)} + ${state.gamma.toFixed(2)}i, twin at ${(1 - state.sigma).toFixed(3)} + ${state.gamma.toFixed(2)}i.<br>` +
      `One of the pair is always right of the line (β = ${beta().toFixed(3)}); steps 2 and 3 follow that one.`;
}

function stripPointer(e) {
  const { L, R, T, B } = stripGeom;
  const rect = $('strip').getBoundingClientRect();
  const s = S_MIN + ((e.clientX - rect.left - L) / (R - L)) * (S_MAX - S_MIN);
  const t = ((B - (e.clientY - rect.top)) / (B - T)) * T_MAX;
  return { s, t };
}
let dragging = false;
$('strip').addEventListener('pointerdown', (e) => {
  const { s, t } = stripPointer(e);
  const near = (sx) => Math.abs(sx - s) < 0.12 && Math.abs(state.gamma - t) < 5;
  if (near(state.sigma)) dragging = 'main';
  else if (near(1 - state.sigma)) dragging = 'twin';
  if (dragging) { $('strip').setPointerCapture(e.pointerId); e.preventDefault(); }
});
$('strip').addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const { s, t } = stripPointer(e);
  const sc = Math.min(0.98, Math.max(0.02, s));
  state.sigma = dragging === 'main' ? sc : 1 - sc;
  if (Math.abs(state.sigma - 0.5) < 0.01) state.sigma = 0.5; // snap onto the line
  state.gamma = Math.min(60, Math.max(10, t));
  syncSliders(); drawAll();
});
for (const ev of ['pointerup', 'pointercancel']) $('strip').addEventListener(ev, () => { dragging = false; });
$('strip').style.touchAction = 'none';

// ---- step 4 --------------------------------------------------------------------------
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
const UPPER = 13; // log10 of the schematic upper estimate on the size

function drawSqueeze() {
  const { g, w, h } = setup($('squeeze'), 1.05);
  const k = Number($('k').value);
  $('kVal').textContent = k;
  const L = 34, R = w - 8, T = 16, B = h - 22;
  const top = 17; // log10 scale shown
  const py = (l) => B - (l / top) * (B - T);
  g.fillStyle = C.text;
  for (let l = 0; l <= top; l += 4) {
    g.strokeStyle = C.grid; g.beginPath(); g.moveTo(L, py(l)); g.lineTo(R, py(l)); g.stroke();
    g.fillText(`10${sup(l)}`, 2, py(l) + 4);
  }
  // stacked log p segments: the size divisibility forces
  const bx = L + (R - L) * 0.22, bw = (R - L) * 0.32;
  let acc = 0;
  for (let i = 0; i < k; i++) {
    const lp = Math.log10(PRIMES[i]);
    g.fillStyle = `hsl(${(i * 37) % 360} 60% 55%)`;
    g.fillRect(bx, py(acc + lp), bw, py(acc) - py(acc + lp) - 1);
    acc += lp;
  }
  const over = acc > UPPER;
  // the upper estimate
  g.strokeStyle = over ? C.red : C.gold; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(L, py(UPPER)); g.lineTo(R, py(UPPER)); g.stroke();
  g.fillStyle = over ? C.red : C.gold;
  g.fillText('upper estimate of its size', L + 4, py(UPPER) - 6);
  g.fillStyle = C.text;
  g.fillText('at least p₁⋯p_k', bx + bw + 6, py(acc) + 4);
  g.fillText('size (log scale)', L + 4, T - 4);
  return { k, acc, over };
}

function drawBalance() {
  const { g, w, h } = setup($('balance'), 1.05);
  const lx = Number($('lx').value);
  $('lxVal').textContent = lx.toFixed(1);
  const L = 34, R = w - 8, T = 16, B = h - 22;
  const yLo = lx / 2 - 0.5, yHi = lx + 0.3;
  const px = (lm) => L + (lm / lx) * (R - L);
  const py = (l) => B - ((l - yLo) / (yHi - yLo)) * (B - T);
  g.fillStyle = C.text;
  g.fillText('cost (log scale)', L + 4, T - 4);
  g.fillText('number of lifts m (log scale) →', L + 4, B + 16);
  const curve = (f, col, width) => {
    g.strokeStyle = col; g.lineWidth = width; g.beginPath();
    for (let i = 0; i <= 200; i++) {
      const lm = (lx * i) / 200;
      const y = py(Math.log10(f(10 ** lm)));
      i ? g.lineTo(px(lm), y) : g.moveTo(px(lm), y);
    }
    g.stroke();
  };
  const x = 10 ** lx;
  g.save(); g.beginPath(); g.rect(L, T, R - L, B - T); g.clip();
  curve((m) => x / m, C.data, 1.3);
  curve((m) => m, C.data, 1.3);
  curve((m) => x / m + m, C.gold, 2.4);
  g.restore();
  const mx = px(lx / 2), my = py(Math.log10(2 * Math.sqrt(x)));
  g.strokeStyle = C.white; g.lineWidth = 2;
  g.beginPath(); g.arc(mx, my, 6, 0, 2 * Math.PI); g.stroke();
  g.fillStyle = C.white; g.fillText('m = √x', mx + 9, my + 14);
  g.fillStyle = C.text;
  g.fillText('x/m', L + 6, py(lx - 0.2));
  g.fillText('m', R - 14, py(lx - 0.2));
  g.fillStyle = C.gold; g.fillText('x/m + m', px(lx * 0.72), py(Math.log10(x / 10 ** (lx * 0.72) + 10 ** (lx * 0.72))) - 8);
  return { x };
}

// ---- wiring ----------------------------------------------------------------------------
function syncSliders() {
  $('beta').value = beta(); $('gamma').value = state.gamma;
  $('betaVal').textContent = beta().toFixed(3); $('gammaVal').textContent = state.gamma.toFixed(1);
}

function drawAll() {
  drawStrip();
  const br = drawChart($('ceiling'));
  const actual = `Actual primes: between ${r[iMin].toFixed(4)} (x ≈ ${sci(ys[iMin])}) and +${r[iMax].toFixed(4)} (x ≈ ${sci(ys[iMax])}), inside ±${RH_BAND.toFixed(4)}.`;
  let msg;
  if (!state.on) msg = `${actual}<br>Turn on the hypothetical zero to see what an off-line zero would do.`;
  else if (beta() <= 0.5) msg = `${actual}<br><span class="ok">β = ½: the zero is on the line, its wave grows like √x, and nothing breaks out.</span>`;
  else {
    const est = breachPoint(beta(), state.gamma);
    msg = `${actual}<br>The zero's wave grows like x<sup>${(beta() - 0.5).toFixed(3)}</sup>. ` +
      (br ? `<span class="bad">It leaves the band near x ≈ ${sci(br.x)}.</span>`
          : `Its swings reach the band only around x ≈ ${sci(est)}, beyond this chart, but they get there.`);
  }
  $('ceilingReadout').innerHTML = msg;

  const bw = drawChart($('windows'), { windows: true });
  $('windowsReadout').innerHTML = !state.on || beta() <= 0.5
    ? '<span class="ok">The actual primes stay below the ceiling in every window: no contradiction.</span>'
    : bw
      ? `<span class="bad">The hypothetical zero pushes above the ceiling inside a window, at x ≈ ${sci(bw.x)}.</span> ` +
        'If the ceiling is proved, this zero cannot exist.'
      : `Within these three windows it stays below the ceiling. Its growth still forces a breach in a later window (its swings reach the ceiling around x ≈ ${sci(breachPoint(beta(), state.gamma))}).`;

  const sq = drawSqueeze(), bl = drawBalance();
  const prod = PRIMES.slice(0, sq.k).reduce((a, p) => a * p, 1);
  let maxK = 0;
  for (let p = 1; maxK < PRIMES.length && p * PRIMES[maxK] <= 10 ** UPPER; ) p *= PRIMES[maxK++];
  $('step4Readout').innerHTML =
    (sq.over
      ? `<span class="bad">k = ${sq.k}: the product ${sci(prod)} exceeds the size estimate 10${sup(UPPER)}. Impossible, so at most ${maxK} such primes.</span>`
      : `k = ${sq.k}: the product ${sci(prod)} fits under the size estimate 10${sup(UPPER)}.`) +
    `<br>x = 10<sup>${Number($('lx').value).toFixed(1)}</sup>: the best m is √x ≈ ${sci(Math.sqrt(bl.x))}, total cost ≈ 2√x ≈ ${sci(2 * Math.sqrt(bl.x))}.`;
}

$('beta').addEventListener('input', () => {
  const b = Number($('beta').value);
  state.sigma = state.sigma >= 0.5 ? b : 1 - b;
  syncSliders(); drawAll();
});
$('gamma').addEventListener('input', () => { state.gamma = Number($('gamma').value); syncSliders(); drawAll(); });
$('rogueOn').addEventListener('change', () => { state.on = $('rogueOn').checked; drawAll(); });
$('k').addEventListener('input', drawAll);
$('lx').addEventListener('input', drawAll);
let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawAll, 100); });

syncSliders();
drawAll();
