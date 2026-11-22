// The sub-steps 4a-4f of step4.html: where the ceiling of step 3 comes from.
import { C, $, setup, sup, sci } from './viz.js';
import { FIELDS, kroneckerPrime, quadraticChiValues, askMain, logSpace, EULER_GAMMA } from './proofMath.js';
import { lChi } from './dirichlet.js';

// The field Q(sqrt(-d)), its character chi, L'/L(1, chi), and ASK/MAIN up to 10^6 (cached per field).
const fieldCache = new Map();
function fieldData(D) {
  if (!fieldCache.has(D)) {
    const vals = quadraticChiValues(D);
    const h = 1e-4;
    const logDeriv = (lChi(vals, 1 + h, 0).re - lChi(vals, 1 - h, 0).re) / (2 * h) / lChi(vals, 1, 0).re;
    const as = logSpace(100, 1e6, 1500);
    const { ask, main } = askMain(D, as, 1e6, logDeriv);
    let worst = 0;
    for (let i = 0; i < as.length; i++) worst = Math.max(worst, Math.abs(ask[i] - main[i]) / Math.sqrt(as[i]));
    fieldCache.set(D, { logDeriv, as, ask, main, worst });
  }
  return fieldCache.get(D);
}
const isPrime = (n) => { if (n < 2) return false; for (let p = 2; p * p <= n; p++) if (n % p === 0) return false; return true; };
// n = p^k -> [p, k], else null
const primePower = (n) => { for (let p = 2; p <= n; p++) if (n % p === 0) { let k = 0; while (n % p === 0) { n /= p; k++; } return n === 1 ? [p, k] : null; } return null; };

// A: primes colored by split / inert / ramified, with each prime power's contribution to ASK(a)
function drawInert(D, a) {
  const { g, w, h } = setup($('inert'), 0.42);
  const L = 34, R = w - 8, T = 18, B = h - 30;
  const px = (n) => L + ((n - 1) / (a - 0.5)) * (R - L);
  const terms = [];
  for (let n = 2; n <= a; n++) {
    const pp = primePower(n);
    if (!pp) continue;
    const [p, k] = pp;
    const c = kroneckerPrime(D, p) ** k;
    terms.push({ n, p, k, c, v: Math.log(p) * (1 - c) * (a / n - 1) });
  }
  const vmax = Math.max(1, ...terms.map((t) => t.v));
  const py = (v) => B - (v / vmax) * (B - T);
  g.fillStyle = C.text;
  g.fillText('each inert prime adds Λ(n)(1 − χ(n))(a/n − 1) to ASK', L, T - 6);
  g.strokeStyle = C.axis; g.beginPath(); g.moveTo(L, B); g.lineTo(R, B); g.stroke();
  const bw = Math.max(2, Math.min(10, ((R - L) / a) * 0.7));
  let ask = 0;
  for (const t of terms) {
    ask += t.v;
    if (t.v > 0) {
      g.fillStyle = t.c === 0 ? 'rgba(154,161,178,0.8)' : C.gold;
      g.fillRect(px(t.n) - bw / 2, py(t.v), bw, B - py(t.v));
    }
    if (t.k === 1) { // a dot for every prime, colored by its type
      g.beginPath(); g.arc(px(t.n), B + 7, 3, 0, 2 * Math.PI);
      if (t.c === 0) { g.strokeStyle = C.text; g.lineWidth = 1; g.stroke(); }
      else { g.fillStyle = t.c < 0 ? C.gold : '#6fd6ff'; g.fill(); }
    }
  }
  g.fillStyle = C.text;
  for (const n of [2, 10, 20, 50, 100, 150, 200]) if (n <= a) g.fillText(String(n), px(n) - 4, B + 22);
  g.fillStyle = C.gold; g.fillText('● inert', R - 150, T - 6);
  g.fillStyle = '#6fd6ff'; g.fillText('● split', R - 96, T - 6);
  g.fillStyle = C.text; g.fillText('○ ramified', R - 46 - 18, T + 8);
  return { ask, inert: terms.filter((t) => t.k === 1 && t.c < 0).map((t) => t.n) };
}

// B: ASK and MAIN from the primes up to 10^6, and their difference / sqrt(a)
function drawAskMain(D) {
  const F = fieldData(D);
  const { g, w, h } = setup($('askmain'), 0.62);
  const L = 40, R = w - 8, T = 16, B = h - 22, M = T + (B - T) * 0.42;
  const lx0 = 2, lx1 = 6;
  const px = (a) => L + ((Math.log10(a) - lx0) / (lx1 - lx0)) * (R - L);
  // top: both curves on a log-log scale
  const ly0 = Math.log10(F.main[0]), ly1 = Math.log10(F.ask.at(-1));
  const pyTop = (v) => M - 6 - ((Math.log10(v) - ly0) / (ly1 - ly0)) * (M - 6 - T);
  g.fillStyle = C.text; g.fillText('ASK and MAIN (log scales)', L, T - 4);
  const line = (arr, color, dash, width) => {
    g.strokeStyle = color; g.setLineDash(dash); g.lineWidth = width; g.beginPath();
    F.as.forEach((a, i) => (i ? g.lineTo : g.moveTo).call(g, px(a), pyTop(Math.max(arr[i], 1e-9))));
    g.stroke(); g.setLineDash([]);
  };
  line(F.ask, C.gold, [], 3);
  line(F.main, C.white, [5, 4], 1.4);
  g.fillStyle = C.gold; g.fillRect(L + 4, T + 8, 16, 3); g.fillText('ASK', L + 24, T + 13);
  g.strokeStyle = C.white; g.setLineDash([4, 3]); g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(L + 64, T + 10); g.lineTo(L + 80, T + 10); g.stroke(); g.setLineDash([]);
  g.fillStyle = C.white; g.fillText('MAIN (on top of each other)', L + 84, T + 13);
  // bottom: the difference, which is G - g_chi
  const lim = 0.5;
  const pyB = (v) => (M + 14 + B) / 2 - (Math.max(-lim, Math.min(lim, v)) / lim) * ((B - M - 14) / 2);
  g.fillStyle = C.text; g.fillText('(ASK − MAIN)/√a  =  (G − g_χ)/√a', L, M + 10);
  g.strokeStyle = C.grid;
  for (const v of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(L, pyB(v)); g.lineTo(R, pyB(v)); g.stroke(); g.fillStyle = C.text; g.fillText(v.toFixed(1), 6, pyB(v) + 4); }
  g.strokeStyle = C.data; g.lineWidth = 1.2; g.beginPath();
  F.as.forEach((a, i) => (i ? g.lineTo : g.moveTo).call(g, px(a), pyB((F.ask[i] - F.main[i]) / Math.sqrt(a))));
  g.stroke();
  g.fillStyle = C.text;
  for (let k = lx0; k <= lx1; k++) g.fillText(`10${sup(k)}`, Math.min(px(10 ** k) - 9, R - 26), B + 16);
  return F;
}

// C: the costs x/m and m, with the source's chain length and the window the comparison allows
function drawBalance(lx, eps) {
  const { g, w, h } = setup($('balance'), 0.62);
  const L = 40, R = w - 8, T = 16, B = h - 22;
  const yLo = lx / 2 - 0.5, yHi = lx + 0.3;
  const px = (lm) => L + (lm / lx) * (R - L);
  const py = (l) => B - ((l - yLo) / (yHi - yLo)) * (B - T);
  const x = 10 ** lx;
  const lmSrc = lx / 2 - (eps * lx) / 16;           // m = sqrt(x delta), delta = x^(-eps/8)
  const wLo = lx * (0.5 - eps), wHi = lx * (0.5 + eps / 2);
  g.fillStyle = 'rgba(245,197,66,0.12)';
  g.fillRect(px(wLo), T, Math.max(2, px(wHi) - px(wLo)), B - T);
  g.fillStyle = C.text;
  g.fillText('cost (log scale)', L, T - 4);
  g.fillText('chain length m (log scale) →', L + 4, B + 16);
  const curve = (f, col, width) => {
    g.strokeStyle = col; g.lineWidth = width; g.beginPath();
    for (let i = 0; i <= 200; i++) {
      const lm = (lx * i) / 200;
      const y = py(Math.log10(f(10 ** lm)));
      i ? g.lineTo(px(lm), y) : g.moveTo(px(lm), y);
    }
    g.stroke();
  };
  g.save(); g.beginPath(); g.rect(L, T, R - L, B - T); g.clip();
  curve((m) => x / m, C.data, 1.3);
  curve((m) => m, C.data, 1.3);
  curve((m) => x / m + m, C.gold, 2.4);
  g.restore();
  const mx = px(lmSrc), my = py(Math.log10(x / 10 ** lmSrc + 10 ** lmSrc));
  g.strokeStyle = C.white; g.lineWidth = 2;
  g.beginPath(); g.arc(mx, my, 6, 0, 2 * Math.PI); g.stroke();
  g.fillStyle = C.white; g.fillText('m ≈ √x', mx + 9, my + 14);
  g.fillStyle = C.text;
  g.fillText('x/m', L + 6, py(lx - 0.2));
  g.fillText('m', R - 14, py(lx - 0.2));
  g.fillStyle = C.gold; g.fillText('allowed window', Math.min(px(wHi) + 4, R - 96), T + 12);
  return { x, m: 10 ** lmSrc, lo: 10 ** wLo, hi: 10 ** wHi };
}


// ---- 4a: divisibility caps size ---------------------------------------------------------
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
const UPPER = 13; // log10 of the size limit in the example

function draw4a() {
  const { g, w, h } = setup($('squeeze'), 0.62);
  const k = Number($('k').value);
  $('kVal').textContent = k;
  const L = 40, R = w - 10, T = 18, B = h - 22;
  const top = 17;
  const py = (l) => B - (l / top) * (B - T);
  g.fillStyle = C.text;
  for (let l = 0; l <= top; l += 4) {
    g.strokeStyle = C.grid; g.beginPath(); g.moveTo(L, py(l)); g.lineTo(R, py(l)); g.stroke();
    g.fillText(`10${sup(l)}`, 4, py(l) + 4);
  }
  g.fillText('size of the number (log scale)', L + 4, T - 6);
  const bx = L + (R - L) * 0.3, bw = (R - L) * 0.22;
  let acc = 0;
  for (let i = 0; i < k; i++) {
    const lp = Math.log10(PRIMES[i]);
    g.fillStyle = `hsl(${(i * 37) % 360} 60% 55%)`;
    g.fillRect(bx, py(acc + lp), bw, py(acc) - py(acc + lp) - 1);
    if (py(acc) - py(acc + lp) > 11) { g.fillStyle = '#0b0d12'; g.fillText(String(PRIMES[i]), bx + 4, py(acc + lp / 2) + 4); }
    acc += lp;
  }
  const over = acc > UPPER;
  g.strokeStyle = over ? C.red : C.gold; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(L, py(UPPER)); g.lineTo(R, py(UPPER)); g.stroke();
  g.fillStyle = over ? C.red : C.gold;
  g.fillText('upper limit on its size', bx + bw + 10, py(UPPER) - 6);
  g.fillStyle = C.text;
  g.fillText(`at least ${PRIMES.slice(0, k).join('·')}`, bx + bw + 10, py(acc) + 14);
  const prod = PRIMES.slice(0, k).reduce((x, p) => x * p, 1);
  let maxK = 0;
  for (let p = 1; maxK < PRIMES.length && p * PRIMES[maxK] <= 10 ** UPPER; ) p *= PRIMES[maxK++];
  $('r4a').innerHTML = over
    ? `<span class="bad">Divisible by the first ${k} primes means at least ${sci(prod)}, above the limit 10${sup(UPPER)}. Impossible: at most ${maxK} of them can divide it.</span>`
    : `Divisible by the first ${k} primes means at least ${sci(prod)}, which still fits under the limit 10${sup(UPPER)}.`;
}

// ---- 4b, 4c, 4d ------------------------------------------------------------------------
function draw4b() {
  const D = state.D, a = Number($('a').value);
  $('aVal').textContent = a;
  const A = drawInert(D, a);
  const F = fieldData(D);
  const main = a * (Math.log(a) - 1 - EULER_GAMMA + F.logDeriv);
  const name = FIELDS.find((f) => f.D === D).name;
  const list = A.inert.length > 14 ? `${A.inert.slice(0, 14).join(', ')}, …` : A.inert.join(', ') || 'none';
  $('r4b').innerHTML = `${name}: inert primes up to ${a}: ${list}.<br>ASK(${a}) = ${A.ask.toFixed(1)}; its expected size MAIN(${a}) = ${main.toFixed(1)}.`;
}

function draw4c() {
  const F = drawAskMain(state.D);
  const name = FIELDS.find((f) => f.D === state.D).name;
  $('r4c').innerHTML = `${name}: L′/L(1, χ) = ${F.logDeriv.toFixed(6)}. Up to a = 10⁶, ASK reaches ${sci(F.ask.at(-1))},<br>` +
    `yet |ASK − MAIN| stays below ${F.worst.toFixed(2)}·√a: the main terms cancel and only a √a-sized prime sum is left.`;
}

function draw4d() {
  const lx = Number($('lx').value), eps = Number($('eps').value);
  $('lxVal').textContent = lx.toFixed(1); $('epsVal').textContent = eps.toFixed(3);
  const Bl = drawBalance(lx, eps);
  $('r4d').innerHTML = `x = 10<sup>${lx.toFixed(1)}</sup>, ε = ${eps.toFixed(3)}: the source's chain length m ≈ ${sci(Bl.m)} (√x ≈ ${sci(Math.sqrt(Bl.x))}),<br>` +
    `inside the allowed window ${sci(Bl.lo)} to ${sci(Bl.hi)}. The worst cost term is then about x<sup>½ + 13ε/8</sup>.`;
}

// ---- 4e: averaging over a subgroup keeps only some characters ------------------------
const GROUP = 12;
function draw4e() {
  const r = Number($('sub').value); // order of the subgroup A0 of Z/12
  const { g, w, h } = setup($('average'), 0.7);
  const L = 70, T = 22, rowH = (h - T - 10) / GROUP;
  const colW = Math.min(46, (w - L - 170) / r);
  g.fillStyle = C.text;
  const head = 'χ_k(z) on the subgroup';
  g.fillText(head, L, T - 8);
  g.fillText('average', Math.max(L + r * colW + 20, L + g.measureText(head).width + 16), T - 8);
  const kept = [];
  for (let k = 0; k < GROUP; k++) {
    const y = T + (k + 0.5) * rowH, rad = Math.min(rowH * 0.36, 11);
    const survives = (k * (GROUP / r)) % GROUP === 0; // chi_k trivial on the subgroup
    if (survives) kept.push(k);
    g.fillStyle = survives ? C.gold : C.text;
    g.fillText(`χ${String(k).replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[c])}`, 14, y + 4);
    let sr = 0, si = 0;
    for (let j = 0; j < r; j++) {
      const z = j * (GROUP / r), ang = (2 * Math.PI * k * z) / GROUP;
      sr += Math.cos(ang); si += Math.sin(ang);
      const cx = L + (j + 0.5) * colW;
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
      g.beginPath(); g.arc(cx, y, rad, 0, 2 * Math.PI); g.stroke();
      g.strokeStyle = survives ? C.gold : C.data; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + rad * Math.cos(ang), y - rad * Math.sin(ang)); g.stroke();
    }
    const mag = Math.hypot(sr, si) / r; // 1 or 0
    const bx = L + r * colW + 20, bwMax = w - bx - 70;
    g.fillStyle = survives ? C.gold : 'rgba(154,161,178,0.35)';
    g.fillRect(bx, y - rowH * 0.25, Math.max(2, bwMax * mag), rowH * 0.5);
    g.fillStyle = survives ? C.gold : C.text;
    g.fillText(survives ? 'kept' : '0', bx + Math.max(2, bwMax * mag) + 6, y + 4);
  }
  $('r4e').innerHTML = `Averaging over a subgroup of ${r} element${r === 1 ? '' : 's'} keeps ${kept.length} of ${GROUP} characters (k = ${kept.join(', ')}): exactly those equal to 1 on the subgroup.<br>` +
    'The others cancel out completely. In the proof, the kept characters that belong to the target get positive weights; the rest are bounded separately by 4o·x<sup>½+ε</sup>.';
}

// ---- 4f: the budget of losses --------------------------------------------------------
const STAIRS = [
  { what: 'the √x balance (worst cost term)', eps: 13 / 8, lab: '13/8' },
  { what: 'geometric error, C* = e_D + e_L + 3', eps: 5, lab: '5' },
  { what: 'density of the averaging set', eps: 1, lab: '1' },
  { what: 'absorbing the constant 26', eps: 3 / 8, lab: '3/8' },
  { what: 'restoring the discarded characters', eps: 1, lab: '1' },
];
function draw4f() {
  const beta = Number($('beta4').value);
  $('beta4Val').textContent = beta.toFixed(3);
  const theta = 0.5 + 0.5 * Math.min(beta - 0.5, 0.5);
  const epsMax = (theta - 0.5) / 9;
  const { g, w, h } = setup($('budget'), 0.44);
  const L = 16, R = w - 16;
  // top: the staircase in units of eps
  const T1 = 26, H1 = 34;
  const px = (u) => L + (u / 9) * (R - L);
  g.fillStyle = C.text; g.fillText('losses, in units of ε  (total 9)', L, T1 - 8);
  let acc = 0;
  STAIRS.forEach((s, i) => {
    g.fillStyle = `hsl(${40 + i * 48} 65% 55%)`;
    g.fillRect(px(acc), T1, px(acc + s.eps) - px(acc) - 2, H1);
    g.fillStyle = '#0b0d12';
    if (px(acc + s.eps) - px(acc) > 26) g.fillText(s.lab, px(acc) + 5, T1 + 21);
    acc += s.eps;
  });
  STAIRS.forEach((s, i) => {
    const y = T1 + H1 + 18 + i * 15;
    g.fillStyle = `hsl(${40 + i * 48} 65% 55%)`; g.fillRect(L, y - 8, 10, 10);
    g.fillStyle = C.text; g.fillText(`${s.lab.padEnd(4)} ${s.what}`, L + 16, y + 1);
  });
  // bottom: exponents on a number line
  const T2 = T1 + H1 + 18 + STAIRS.length * 15 + 26, Y = T2 + 30;
  const ex = (e) => L + 20 + ((e - 0.45) / (1.0 - 0.45)) * (R - L - 40);
  g.fillStyle = C.text; g.fillText('growth exponents: x to the power …', L, T2);
  g.strokeStyle = C.axis; g.lineWidth = 1; g.beginPath(); g.moveTo(ex(0.45), Y); g.lineTo(ex(1.0), Y); g.stroke();
  for (const e of [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) { g.fillStyle = C.text; g.fillText(e.toFixed(1), ex(e) - 8, Y + 18); g.beginPath(); g.moveTo(ex(e), Y - 3); g.lineTo(ex(e), Y + 3); g.stroke(); }
  const mark = (e, col, text, up) => {
    g.fillStyle = col; g.beginPath(); g.arc(ex(e), Y, 6, 0, 2 * Math.PI); g.fill();
    g.fillText(text, Math.min(ex(e) - 10, R - 170), up ? Y - 12 : Y + 34);
  };
  mark(0.5, C.white, '½', true);
  mark(theta, C.gold, `ceiling ½ + 9ε = ${theta.toFixed(3)}`, false);
  mark(beta, C.red, `zero β = ${beta.toFixed(3)}`, true);
  $('r4f').innerHTML = `For a zero with β = ${beta.toFixed(3)}, the proof picks θ = ${theta.toFixed(3)} and ε ≤ (θ − ½)/9 = ${epsMax.toFixed(5)}.<br>` +
    `The ceiling x<sup>½ + 9ε</sup> = x<sup>${theta.toFixed(3)}</sup> then sits strictly below the zero's growth x<sup>${beta.toFixed(3)}</sup>, so the zero's wave must eventually break it.`;
}

// ---- wiring ----------------------------------------------------------------------------
const state = { D: -7 };
for (const sel of [$('field4b'), $('field4c')]) {
  for (const f of FIELDS) sel.add(new Option(`${f.name}  (D = ${f.D})`, f.D));
  sel.value = state.D;
  sel.addEventListener('input', () => {
    state.D = Number(sel.value);
    $('field4b').value = state.D; $('field4c').value = state.D;
    draw4b(); draw4c();
  });
}
$('k').addEventListener('input', draw4a);
$('a').addEventListener('input', draw4b);
for (const id of ['lx', 'eps']) $(id).addEventListener('input', draw4d);
$('sub').addEventListener('input', draw4e);
$('beta4').addEventListener('input', draw4f);

function drawAll() { draw4a(); draw4b(); draw4c(); draw4d(); draw4e(); draw4f(); }
let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawAll, 100); });
drawAll();
