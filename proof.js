// The four pictures of proof.html. One hypothetical zero (beta + i gamma) is shared by steps 1-3.
import { criticalZeros } from './zeta.js';
import { normalizedPrimeSum, logSpace, rogueWave, breachPoint, RH_BAND } from './proofMath.js';
import { C, $, setup, sup, sci } from './viz.js';

const Y_DATA = 1e7;              // primes are computed up to here
const LX_MIN = 1, LX_MAX = 14;    // chart range: x from 10 to 10^14
const R_MAX = 0.14;               // vertical range of the chart: +-R_MAX
const WINDOWS = [[2, 3], [4, 6], [8, 12]]; // [log10 Y, log10 Y^(3/2)]

const state = { sigma: 0.65, gamma: 40, on: true, mode: 'band' };
const beta = () => Math.max(state.sigma, 1 - state.sigma);

// ---- data -------------------------------------------------------------------------
const ys = logSpace(10, Y_DATA, 120000);
const r = normalizedPrimeSum(ys, Y_DATA);
let iMin = 0, iMax = 0;
for (let i = 1; i < r.length; i++) { if (r[i] < r[iMin]) iMin = i; if (r[i] > r[iMax]) iMax = i; }
const zeros = criticalZeros(62);

// ---- helpers -----------------------------------------------------------------------


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
const S_MIN = -0.15, S_MAX = 1.15, T_MAX = 62;
let stripGeom = null;
function drawStrip() {
  const canvas = $('strip');
  const { g, w, h } = setup(canvas, 1.2);
  const L = 30, R = w - 10, T = 10, B = h - 24;
  const px = (s) => L + ((s - S_MIN) / (S_MAX - S_MIN)) * (R - L);
  const py = (t) => B - (t / T_MAX) * (B - T);
  stripGeom = { L, R, T, B, px, py };

  g.fillStyle = 'rgba(245,197,66,0.09)';
  g.fillRect(px(0.5), T, px(1) - px(0.5), B - T);
  g.fillStyle = C.gold;
  g.fillText('the proof:', px(0.5) + 6, T + 14);
  g.fillText('no zeros here', px(0.5) + 6, T + 28);

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
    : `Zero ${state.sigma.toFixed(3)} + ${state.gamma.toFixed(2)}i, twin ${(1 - state.sigma).toFixed(3)} + ${state.gamma.toFixed(2)}i.<br>` +
      `The one right of the line (β = ${beta().toFixed(3)}) drives the chart.`;
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
// ---- wiring ----------------------------------------------------------------------------
function syncSliders() {
  $('beta').value = beta(); $('gamma').value = state.gamma;
  $('betaVal').textContent = beta().toFixed(3); $('gammaVal').textContent = state.gamma.toFixed(1);
}

function drawAll() {
  drawStrip();
  if (state.mode === 'step4') return;
  const windows = state.mode === 'windows';
  const br = drawChart($('chart'), { windows });
  const actual = `Actual primes: between ${r[iMin].toFixed(4)} (x ≈ ${sci(ys[iMin])}) and +${r[iMax].toFixed(4)} (x ≈ ${sci(ys[iMax])}), inside ±${RH_BAND.toFixed(4)}.`;
  let msg;
  if (!state.on) msg = `${actual}<br>Turn on the hypothetical zero to see what an off-line zero would do.`;
  else if (beta() <= 0.5) msg = `${actual}<br><span class="ok">β = ½: the zero is on the line, its wave grows like √x, and nothing breaks out.</span>`;
  else if (!windows) {
    msg = `${actual}<br>The zero's wave grows like x<sup>${(beta() - 0.5).toFixed(3)}</sup>. ` +
      (br ? `<span class="bad">It leaves the band near x ≈ ${sci(br.x)}.</span>`
          : `Its swings reach the band only around x ≈ ${sci(breachPoint(beta(), state.gamma))}, beyond this chart, but they get there.`);
  } else {
    msg = br
      ? `<span class="bad">The hypothetical zero pushes above the ceiling inside a window, at x ≈ ${sci(br.x)}.</span><br>` +
        'If the ceiling is proved, this zero cannot exist.'
      : `Within these three windows it stays below the ceiling.<br>Its growth still forces a breach in a later window (its swings reach the ceiling around x ≈ ${sci(breachPoint(beta(), state.gamma))}).`;
  }
  $('chartReadout').innerHTML = msg;
}


$('beta').addEventListener('input', () => {
  const b = Number($('beta').value);
  state.sigma = state.sigma >= 0.5 ? b : 1 - b;
  syncSliders(); drawAll();
});
$('gamma').addEventListener('input', () => { state.gamma = Number($('gamma').value); syncSliders(); drawAll(); });
for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    state.mode = tab.dataset.tab;
    for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t === tab));
    for (const p of document.querySelectorAll('[data-mode]')) p.hidden = p.dataset.mode !== state.mode;
    $('chart').closest('[data-panel]').hidden = state.mode === 'step4';
    $('flow4').closest('[data-panel]').hidden = state.mode !== 'step4';
    $('bandLabel').textContent = state.mode === 'windows' ? 'ceiling +0.0462, walls over the windows' : 'band ±0.0462 forced by RH';
    drawAll();
  });
}
$('rogueOn').addEventListener('change', () => { state.on = $('rogueOn').checked; drawAll(); });
let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawAll, 100); });

syncSliders();
drawAll();
