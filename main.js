import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { zeta, xiScaled, termsFor, borweinWeights, criticalZeros } from './zeta.js';
import { createPrimesView } from './primesView.js';
import { primitiveCharacters, moduliWithPrimitive, lChi, lambdaScaled, lZeros, EM_COEF } from './dirichlet.js';

// ---- Layout: how math units map to world units --------------------------------
const SIGMA_MIN = -1, SIGMA_MAX = 2; // real part of s shown
const WINDOW = 40;                    // length of the visible t range
const T_START_MAX = 70;               // so t stays <= 110 (shader term budget)
const MAX_TERMS = 128;                // size of the weight array in the shader
const SX = 4;                         // world units per unit of sigma
const SZ = 0.6;                       // world units per unit of t
const H = 1.6;                        // world units per unit of log(1 + |zeta|)
const LOG_CAP = 3.0;                  // clip the pole at s = 1
const L_T_MAX = 60;                   // the L(s, chi) tab covers -60 <= t <= 60
const L_Q_MAX = 13;                   // largest modulus offered (shader term budget)
const MAX_CHI = 16;                   // size of the character array in the shader
const MAX_D = L_Q_MAX * (Math.ceil(L_T_MAX / Math.PI) + 4); // direct terms of the L sum

let tStart = 10;
const MODES = ['zeta', 'xi', 'dirichlet', 'primes'];
const tStarts = { zeta: 10, dirichlet: -20 }; // each 3D family keeps its own window
const group = (m) => (m === 'dirichlet' ? 'dirichlet' : 'zeta');
let mode = MODES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'zeta'; // the open tab
const tCenter = () => tStart + WINDOW / 2;
const xOf = (sigma) => (sigma - 0.5) * SX;
const zOf = (t) => -(t - tCenter()) * SZ;
const yOf = (mag) => H * Math.min(Math.log1p(mag), LOG_CAP);

// ---- Renderer, scene, camera ---------------------------------------------------
const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
container.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
container.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d12);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
camera.position.set(15, 11, 17);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.5, 0);

// ---- The terrain: zeta is evaluated per vertex on the GPU ----------------------
const vertexShader = /* glsl */ `
  uniform float uW[${MAX_TERMS}];
  uniform int uN;
  uniform vec2 uSigma;   // (min, max)
  uniform vec2 uT;       // (min, max)
  uniform float uTc, uSX, uSZ, uH, uCap;
  uniform int uMode;     // 0: zeta, 1: xi (scaled), 2: L(s, chi), 3: Lambda(s, chi) (scaled; see dirichlet.js)
  uniform vec2 uChi[${MAX_CHI}];  // chi(0), ..., chi(q-1)
  uniform int uQ, uNd;   // modulus, direct terms per residue class
  uniform float uParity, uLogQPi, uEpsHalf; // a, log(q/pi), arg(eps)/2
  uniform float uEM[6];  // Euler–Maclaurin coefficients B_2k/(2k)!
  varying vec2 vZ;       // the plotted value
  varying vec3 vPos;

  const float LN2 = 0.6931471805599453;
  const float LN_PI = 1.1447298858494002;
  const float HALF_LN_2PI = 0.9189385332046727;

  vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
  vec2 cdiv(vec2 a, vec2 b) { return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / max(dot(b, b), 1e-12); }
  vec2 clog(vec2 z) { return vec2(0.5 * log(dot(z, z)), atan(z.y, z.x)); }

  // eta(s) summed with Borwein weights (see zeta.js)
  vec2 eta(float s, float t) {
    vec2 e = vec2(0.0);
    for (int k = 0; k < ${MAX_TERMS}; k++) {
      if (k >= uN) break;
      float L = log(float(k + 1));
      float m = uW[k] * exp(-s * L);
      float a = t * L;
      e += m * vec2(cos(a), -sin(a));
    }
    return e;
  }

  // 1 - 2^(1-s)
  vec2 etaDen(float s, float t) {
    float m2 = exp((1.0 - s) * LN2);
    float a2 = t * LN2;
    return vec2(1.0 - m2 * cos(a2), m2 * sin(a2));
  }

  // zeta(s) = eta(s) / (1 - 2^(1-s)); cdiv clamps the pole at s = 1
  vec2 zeta(float s, float t) { return cdiv(eta(s, t), etaDen(s, t)); }

  // log Gamma(z), Re z > 0: shift by 8, then Stirling (same as logGamma in zeta.js)
  vec2 logGamma(vec2 z) {
    vec2 sh = vec2(0.0);
    for (int k = 0; k < 8; k++) sh += clog(z + vec2(float(k), 0.0));
    vec2 w = z + vec2(8.0, 0.0);
    vec2 g = cmul(w - vec2(0.5, 0.0), clog(w)) - w + vec2(HALF_LN_2PI, 0.0);
    vec2 iw = cdiv(vec2(1.0, 0.0), w);
    vec2 u = cmul(iw, iw);
    vec2 p = cmul(vec2(-1.0 / 360.0, 0.0) + u / 1260.0, u) + vec2(1.0 / 12.0, 0.0);
    return g + cmul(p, iw) - sh;
  }

  // G(s) = log(pi^(-s/2) Gamma(s/2 + 1)), so xi(s) = (s-1) zeta(s) e^G(s)
  vec2 xiLogFactor(float s, float t) {
    return logGamma(vec2(s / 2.0 + 1.0, t / 2.0)) - vec2(s, t) * (0.5 * LN_PI);
  }

  // xi(s) / N(t), with N(t) = |(s-1) e^G(s)| at s = 1/2 + it (xiScaled in zeta.js)
  vec2 xiScaled(float s, float t) {
    vec2 sm1 = vec2(s - 1.0, t);
    vec2 r = dot(sm1, sm1) < 1e-8 ? vec2(1.0 / LN2, 0.0) : cdiv(sm1, etaDen(s, t)); // (s-1)/(1-2^(1-s))
    vec2 p = cmul(eta(s, t), r);   // (s-1) zeta(s), finite at s = 1
    vec2 g = xiLogFactor(s, t);
    float g0 = xiLogFactor(0.5, t).x;
    float m = exp(g.x - g0) / length(vec2(0.5, t));
    return cmul(p, m * vec2(cos(g.y), sin(g.y)));
  }

  vec2 npow(float x, float s, float t) { float L = log(x); return exp(-s * L) * vec2(cos(t * L), -sin(t * L)); }

  // L(s, chi): q*N direct terms plus the Hurwitz tails zeta(s, N + a/q) by Euler–Maclaurin (lChi in dirichlet.js)
  vec2 dirL(float s, float t) {
    vec2 acc = vec2(0.0);
    int total = uQ * uNd;
    for (int n = 1; n <= ${MAX_D}; n++) {
      if (n > total) break;
      vec2 c = uChi[n - (n / uQ) * uQ];
      if (c.x == 0.0 && c.y == 0.0) continue;
      acc += cmul(c, npow(float(n), s, t));
    }
    vec2 tail = vec2(0.0);
    for (int a = 1; a < ${MAX_CHI}; a++) {
      if (a >= uQ) break;
      vec2 c = uChi[a];
      if (c.x == 0.0 && c.y == 0.0) continue;
      float x = float(uNd) + float(a) / float(uQ);
      float L = log(x);
      vec2 xs = npow(x, s, t);
      vec2 r = 0.5 * xs;
      vec2 p = vec2(s, t);             // Pochhammer (s)_{2k+1}
      float xp = 1.0 / x;
      for (int k = 0; k < 6; k++) {
        r += uEM[k] * xp * cmul(p, xs);
        p = cmul(p, cmul(vec2(s + float(2 * k + 1), t), vec2(s + float(2 * k + 2), t)));
        xp /= x * x;
      }
      // pole part, using sum chi(a) = 0: (x^(1-s) - 1)/(s-1) = -L (e^w - 1)/w, w = (1-s) L
      vec2 w = vec2((1.0 - s) * L, -t * L);
      vec2 fw = dot(w, w) < 1e-6
        ? vec2(1.0, 0.0) + w / 2.0 + cmul(w, w) / 6.0
        : cdiv(exp(w.x) * vec2(cos(w.y), sin(w.y)) - vec2(1.0, 0.0), w);
      r -= L * fw;
      tail += cmul(c, r);
    }
    return acc + cmul(npow(float(uQ), s, t), tail);
  }

  // Lambda(s, chi) / N(t), rotated by eps^(-1/2) so it is real on the critical line (lambdaScaled in dirichlet.js)
  vec2 lambdaScaled(float s, float t) {
    if (abs(s + uParity) < 1e-4 && abs(t) < 1e-4) s += 1e-3; // Gamma pole meets the trivial zero
    vec2 l = dirL(s, t);
    vec2 z = vec2(s + uParity, t) * 0.5;
    vec2 g = logGamma(z) + z * uLogQPi;
    vec2 z0 = vec2(0.5 + uParity, t) * 0.5;
    float g0 = logGamma(z0).x + z0.x * uLogQPi;
    float ph = g.y - uEpsHalf;
    return cmul(l, exp(g.x - g0) * vec2(cos(ph), sin(ph)));
  }

  void main() {
    float sigma = mix(uSigma.x, uSigma.y, uv.x);
    float t = mix(uT.x, uT.y, uv.y);
    vZ = uMode == 1 ? xiScaled(sigma, t)
       : uMode == 2 ? dirL(sigma, t)
       : uMode == 3 ? lambdaScaled(sigma, t)
       : zeta(sigma, t);
    float y = uH * min(log(1.0 + length(vZ)), uCap);
    vPos = vec3((sigma - 0.5) * uSX, y, -(t - uTc) * uSZ);
    gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vZ;
  varying vec3 vPos;

  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }

  void main() {
    float hue = atan(vZ.y, vZ.x) / 6.283185307 + 0.5;  // phase -> hue
    vec3 col = hsv2rgb(vec3(hue, 0.72, 0.95));
    // faint bands where |zeta| doubles, so you can read the magnitude off the color too
    float band = fract(log2(length(vZ) + 1e-9));
    col *= 0.82 + 0.18 * band;
    // per-pixel normal from screen-space derivatives (the surface is displaced in the vertex shader)
    vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
    float light = abs(dot(n, normalize(vec3(0.35, 1.0, 0.25))));
    col *= 0.35 + 0.75 * light;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const uniforms = {
  uW: { value: new Float32Array(MAX_TERMS) },
  uN: { value: 0 },
  uSigma: { value: new THREE.Vector2(SIGMA_MIN, SIGMA_MAX) },
  uT: { value: new THREE.Vector2() },
  uTc: { value: 0 },
  uSX: { value: SX },
  uSZ: { value: SZ },
  uH: { value: H },
  uCap: { value: LOG_CAP },
  uMode: { value: 0 },
  uChi: { value: Array.from({ length: MAX_CHI }, () => new THREE.Vector2()) },
  uQ: { value: 4 },
  uNd: { value: 4 },
  uParity: { value: 0 },
  uLogQPi: { value: 0 },
  uEpsHalf: { value: 0 },
  uEM: { value: new Float32Array(EM_COEF.slice(0, 6)) },
};

const terrain = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1, 150, 600), // only the uv grid is used
  new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.DoubleSide }),
);
terrain.frustumCulled = false; // real positions are computed in the shader
scene.add(terrain);

// ---- Overlays: critical line, strip edges, labels, zeros -----------------------
const zeros = criticalZeros(T_START_MAX + WINDOW + 2);
const overlay = new THREE.Group();
scene.add(overlay);

function label(text, cls, pos) {
  const el = document.createElement('div');
  el.className = `label ${cls}`;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.position.copy(pos);
  return obj;
}

function lineAlongT(sigma, color, opacity, y = 0.01) {
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(xOf(sigma), y, zOf(tStart)),
    new THREE.Vector3(xOf(sigma), y, zOf(tStart + WINDOW)),
  ]);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

const zeroGeom = new THREE.SphereGeometry(0.09, 16, 12);
const zeroMat = new THREE.MeshBasicMaterial({ color: 0x7dffb2 });
const trivialMat = new THREE.MeshBasicMaterial({ color: 0x9aa1b2 });

// ---- The L(s, chi) tab state -------------------------------------------------------
const L = { q: 4, index: 1, fn: 'L', ch: null, zeros: [] };
const charCache = new Map();
const charsOf = (q) => { if (!charCache.has(q)) charCache.set(q, primitiveCharacters(q)); return charCache.get(q); };
const currentZeros = () => (mode === 'dirichlet' ? L.zeros : zeros);

function rebuildOverlay() {
  overlay.clear();
  overlay.add(lineAlongT(0.5, 0xffffff, 0.95));
  overlay.add(lineAlongT(0, 0x9aa1b2, 0.5));
  overlay.add(lineAlongT(1, 0x9aa1b2, 0.5));

  const near = zOf(tStart) + 0.6;
  overlay.add(label('σ = 0', '', new THREE.Vector3(xOf(0), 0, near)));
  overlay.add(label('σ = ½', 'crit', new THREE.Vector3(xOf(0.5), 0, near)));
  overlay.add(label('σ = 1', '', new THREE.Vector3(xOf(1), 0, near)));

  for (let t = Math.ceil(tStart / 5) * 5; t <= tStart + WINDOW; t += 5) {
    overlay.add(label(`t = ${t}`, '', new THREE.Vector3(xOf(SIGMA_MIN) - 0.9, 0, zOf(t))));
  }

  const dir = mode === 'dirichlet';
  currentZeros().forEach((t, i) => {
    if (t < tStart || t > tStart + WINDOW) return;
    const m = new THREE.Mesh(zeroGeom, zeroMat);
    m.position.set(xOf(0.5), 0.02, zOf(t));
    overlay.add(m);
    overlay.add(label(dir ? t.toFixed(3) : `#${i + 1}  ${t.toFixed(3)}`, 'zero', new THREE.Vector3(xOf(SIGMA_MAX) + 1.6, 0, zOf(t))));
  });

  // the real axis, and the trivial zero of L (Lambda has none: the Gamma factor cancels it)
  if (dir && tStart <= 0 && tStart + WINDOW >= 0) {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xOf(SIGMA_MIN), 0.01, zOf(0)), new THREE.Vector3(xOf(SIGMA_MAX), 0.01, zOf(0)),
    ]);
    overlay.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x9aa1b2, transparent: true, opacity: 0.6 })));
    overlay.add(label('t = 0  (real axis)', '', new THREE.Vector3(xOf(SIGMA_MAX) + 1.6, 0, zOf(0) + 0.5)));
    if (L.fn === 'L') {
      const s0 = -L.ch.parity;
      const m = new THREE.Mesh(zeroGeom, trivialMat);
      m.position.set(xOf(s0), 0.02, zOf(0));
      overlay.add(m);
      overlay.add(label(`trivial zero s = ${s0 === 0 ? '0' : '−1'}`, '', new THREE.Vector3(xOf(s0), 0, zOf(0) - 0.6)));
    }
  }
}

// ---- Probe: a marker that rides the critical line -------------------------------
const probe = new THREE.Group();
const probeBall = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
const probeStem = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]),
  new THREE.LineBasicMaterial({ color: 0xffffff }),
);
probe.add(probeBall, probeStem);
scene.add(probe);

// ---- UI wiring ----------------------------------------------------------------
const tStartInput = document.getElementById('tStart');
const probeInput = document.getElementById('probe');
const readout = document.getElementById('readout');
const curveCanvas = document.getElementById('curve');
const ctx = curveCanvas.getContext('2d');

const probeT = () => tStart + Number(probeInput.value) * WINDOW;
const f = () => {
  if (mode === 'xi') return xiScaled;
  if (mode === 'dirichlet') return L.fn === 'L' ? (s, t) => lChi(L.ch.values, s, t) : (s, t) => lambdaScaled(L.ch, s, t);
  return zeta;
};
const realOnLine = () => mode === 'xi' || (mode === 'dirichlet' && L.fn === 'Lambda');
const fmt = (x) => (x >= 0 ? ' ' : '') + x.toFixed(4);

let curve = []; // samples of the current function at 1/2 + it across the window

function setWindow(start) {
  const [lo, hi] = mode === 'dirichlet' ? [-L_T_MAX, L_T_MAX - WINDOW] : [0, T_START_MAX];
  tStart = Math.min(Math.max(start, lo), hi);
  tStarts[group(mode)] = tStart;
  tStartInput.min = lo;
  tStartInput.max = hi;
  tStartInput.value = tStart;
  document.getElementById('tStartVal').textContent = tStart.toFixed(1);

  if (mode === 'dirichlet') {
    const tAbs = Math.max(Math.abs(tStart), Math.abs(tStart + WINDOW));
    uniforms.uNd.value = Math.ceil(tAbs / Math.PI) + 4;
  } else {
    const n = Math.min(termsFor(tStart + WINDOW), MAX_TERMS);
    uniforms.uW.value.fill(0);
    uniforms.uW.value.set(borweinWeights(n));
    uniforms.uN.value = n;
  }
  uniforms.uT.value.set(tStart, tStart + WINDOW);
  uniforms.uTc.value = tCenter();

  curve = [];
  for (let i = 0; i <= 1500; i++) {
    const t = tStart + (i / 1500) * WINDOW;
    curve.push({ t, ...f()(0.5, t) });
  }
  rebuildOverlay();
  updateProbe();
}

function updateProbe() {
  const t = probeT();
  document.getElementById('probeVal').textContent = t.toFixed(3);
  const z = f()(0.5, t);
  const mag = Math.hypot(z.re, z.im);
  const y = yOf(mag);
  probe.position.set(xOf(0.5), 0, zOf(t));
  probeBall.position.y = y;
  probeStem.scale.y = Math.max(y, 1e-3);

  const zs = currentZeros();
  let nearest = -1;
  zs.forEach((zt, i) => { if (nearest < 0 || Math.abs(zt - t) < Math.abs(zs[nearest] - t)) nearest = i; });
  const dist = nearest < 0 ? Infinity : Math.abs(zs[nearest] - t);
  const sym = { xi: 'ξ̃', zeta: 'ζ', dirichlet: L.fn === 'L' ? 'L' : 'Λ̃' }[mode];
  const sArg = t < 0 ? `½ − ${(-t).toFixed(3)}i` : `½ + ${t.toFixed(3)}i`;
  const arg = mode === 'dirichlet' ? `(${sArg}, χ)` : `(${sArg})`;
  const tag = mode === 'dirichlet' ? '' : `#${nearest + 1} `;
  readout.innerHTML =
    (realOnLine()
      ? `${sym}${arg} =${fmt(z.re)} &nbsp;(real)<br>`
      : `${sym}${arg} =${fmt(z.re)} ${z.im < 0 ? '−' : '+'} ${Math.abs(z.im).toFixed(4)}i<br>`) +
    `|${sym}| = ${mag.toFixed(4)}<br>` +
    (nearest < 0
      ? 'no zeros in range'
      : dist < 0.02
        ? `<span class="zero">at zero ${tag}(t = ${zs[nearest].toFixed(6)})</span>`
        : `nearest zero: ${tag}at t = ${zs[nearest].toFixed(3)}`);
  if (realOnLine()) drawGraph(t, z.re); else drawCurve(z);
}

function drawCurve(current) {
  const W = curveCanvas.width, Hc = curveCanvas.height;
  let r = 1;
  for (const p of curve) r = Math.max(r, Math.abs(p.re), Math.abs(p.im));
  r *= 1.1;
  const px = (re) => W / 2 + (re / r) * (W / 2);
  const py = (im) => Hc / 2 - (im / r) * (Hc / 2);

  ctx.clearRect(0, 0, W, Hc);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, Hc / 2); ctx.lineTo(W, Hc / 2);
  ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, Hc);
  ctx.stroke();

  ctx.fillStyle = 'rgba(154,161,178,0.9)';
  ctx.font = '20px ui-monospace, Menlo, monospace';
  ctx.fillText('Re', W - 40, Hc / 2 - 8);
  ctx.fillText('Im', W / 2 + 8, 22);
  ctx.fillText(`±${r.toFixed(1)}`, 8, 22);

  // colour the curve by phase, matching the terrain
  ctx.lineWidth = 2.5;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1], b = curve[i];
    const hue = (Math.atan2(b.im, b.re) / (2 * Math.PI) + 0.5) * 360;
    ctx.strokeStyle = `hsl(${hue} 80% 62%)`;
    ctx.beginPath();
    ctx.moveTo(px(a.re), py(a.im));
    ctx.lineTo(px(b.re), py(b.im));
    ctx.stroke();
  }

  ctx.fillStyle = '#7dffb2';
  ctx.beginPath(); ctx.arc(W / 2, Hc / 2, 6, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px(current.re), py(current.im), 9, 0, 2 * Math.PI); ctx.fill();
}

// xi on the critical line is real, so instead of a curve in the plane we plot its value against t.
function drawGraph(tNow, current) {
  const W = curveCanvas.width, Hc = curveCanvas.height;
  let r = 1;
  for (const p of curve) r = Math.max(r, Math.abs(p.re));
  r *= 1.1;
  const px = (t) => ((t - tStart) / WINDOW) * W;
  const py = (v) => Hc / 2 - (v / r) * (Hc / 2);

  ctx.clearRect(0, 0, W, Hc);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, Hc / 2); ctx.lineTo(W, Hc / 2); ctx.stroke();

  ctx.fillStyle = 'rgba(154,161,178,0.9)';
  ctx.font = '20px ui-monospace, Menlo, monospace';
  ctx.fillText(`±${r.toFixed(1)}`, 8, 22);
  ctx.fillText(`t = ${tStart.toFixed(0)}`, 8, Hc - 10);
  const right = `t = ${(tStart + WINDOW).toFixed(0)}`;
  ctx.fillText(right, W - 8 - ctx.measureText(right).width, Hc - 10);

  // same colors as the terrain: positive real is cyan (phase 0), negative real is red (phase pi)
  ctx.lineWidth = 2.5;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1], b = curve[i];
    ctx.strokeStyle = b.re >= 0 ? 'hsl(180 80% 62%)' : 'hsl(0 80% 62%)';
    ctx.beginPath(); ctx.moveTo(px(a.t), py(a.re)); ctx.lineTo(px(b.t), py(b.re)); ctx.stroke();
  }

  ctx.fillStyle = '#7dffb2';
  for (const zt of currentZeros()) {
    if (zt < tStart || zt > tStart + WINDOW) continue;
    ctx.beginPath(); ctx.arc(px(zt), Hc / 2, 6, 0, 2 * Math.PI); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px(tNow), py(current), 9, 0, 2 * Math.PI); ctx.fill();
}

// ---- Tabs: zeta (with the xi view), L(s, chi) or primes ----------------------------
const primesView = createPrimesView({
  canvas: document.getElementById('primesView'),
  nInput: document.getElementById('nZeros'),
  nVal: document.getElementById('nZerosVal'),
  playBtn: document.getElementById('play'),
  xMaxInput: document.getElementById('xMax'),
  errInput: document.getElementById('errView'),
  readout: document.getElementById('primesReadout'),
});

// ---- The L(s, chi) controls ---------------------------------------------------------
const lqSelect = document.getElementById('lq');
const lcharSelect = document.getElementById('lchar');
const chiStrip = document.getElementById('chiStrip');
const chiInfo = document.getElementById('chiInfo');

for (const q of moduliWithPrimitive(L_Q_MAX)) lqSelect.add(new Option(`q = ${q}`, q));

function fillCharSelect() {
  lcharSelect.length = 0;
  for (const c of charsOf(L.q)) lcharSelect.add(new Option(c.label, c.index));
}

function drawChiStrip() {
  const g = chiStrip.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 2);
  const w = chiStrip.clientWidth || 300, h = 44;
  chiStrip.width = w * dpr; chiStrip.height = h * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const q = L.q, step = w / q, r = Math.min(9, step * 0.36);
  g.font = '10px ui-monospace, Menlo, monospace';
  g.textAlign = 'center';
  for (let a = 1; a <= q; a++) {
    const z = L.ch.values[a % q], x = (a - 0.5) * step, y = 14;
    g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI);
    if (!z.re && !z.im) {
      g.strokeStyle = 'rgba(154,161,178,0.6)'; g.lineWidth = 1; g.stroke();
    } else {
      const hue = (Math.atan2(z.im, z.re) / (2 * Math.PI) + 0.5) * 360;
      g.fillStyle = `hsl(${hue} 75% 58%)`; g.fill();
      g.strokeStyle = 'rgba(11,13,18,0.9)'; g.lineWidth = 1.5;   // a hand showing the angle
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + r * z.re, y - r * z.im); g.stroke();
    }
    g.fillStyle = 'rgba(154,161,178,0.95)';
    g.fillText(String(a), x, 38);
  }
}

const cfmt = (z) => `${z.re.toFixed(3)} ${z.im < 0 ? '−' : '+'} ${Math.abs(z.im).toFixed(3)}i`;

let filledQ = 0;
function setCharacter(q, index) {
  L.q = q;
  if (filledQ !== q) { lqSelect.value = q; fillCharSelect(); filledQ = q; }
  L.index = Math.min(index, charsOf(q).length);
  lcharSelect.value = L.index;
  L.ch = charsOf(q)[L.index - 1];
  L.zeros = lZeros(L.ch, -L_T_MAX, L_T_MAX);

  const vals = L.ch.values;
  uniforms.uChi.value.forEach((v, a) => v.set(a < q ? vals[a].re : 0, a < q ? vals[a].im : 0));
  uniforms.uQ.value = q;
  uniforms.uParity.value = L.ch.parity;
  uniforms.uLogQPi.value = Math.log(q / Math.PI);
  uniforms.uEpsHalf.value = Math.atan2(L.ch.eps.im, L.ch.eps.re) / 2;

  const pos = L.zeros.filter((t) => t > 0).length, neg = L.zeros.filter((t) => t < 0).length;
  chiInfo.innerHTML =
    `order ${L.ch.order} · ${L.ch.odd ? 'odd, 𝔞 = 1' : 'even, 𝔞 = 0'} · ${L.ch.real ? 'real' : 'complex'}<br>` +
    `root number ε = ${cfmt(L.ch.eps)}<br>` +
    `conjugate χ̄: ${L.ch.real ? 'χ itself' : `#${L.ch.conjIndex}`}<br>` +
    `zeros with |t| ≤ ${L_T_MAX}: ${pos} above the axis, ${neg} below`;
  drawChiStrip();
  if (mode === 'dirichlet') setWindow(tStart);
}

function setLFunction(fn) {
  L.fn = fn;
  uniforms.uMode.value = fn === 'L' ? 2 : 3;
  for (const r of document.querySelectorAll('input[name=lfn]')) r.checked = r.value === fn;
  document.getElementById('lCurveTitle').textContent = fn === 'L' ? 'L(½ + it, χ) in the output plane' : 'Λ̃(½ + it, χ) against t';
  document.getElementById('lCurveText').textContent = fn === 'L'
    ? 'This curve passes through the origin at every zero on the critical line. For a complex χ it is not symmetric under t → −t.'
    : 'Rotated by ε^(−1/2), Λ is real on the critical line, so it is plotted against t. It crosses zero at every zero on the line.';
  if (mode === 'dirichlet') setWindow(tStart);
}

lqSelect.addEventListener('change', () => setCharacter(Number(lqSelect.value), 1));
lcharSelect.addEventListener('change', () => setCharacter(L.q, Number(lcharSelect.value)));
for (const r of document.querySelectorAll('input[name=lfn]')) r.addEventListener('change', () => setLFunction(r.value));
for (const b of document.querySelectorAll('[data-preset]')) {
  b.addEventListener('click', () => { const [q, i] = b.dataset.preset.split(':').map(Number); setCharacter(q, i); });
}
addEventListener('resize', () => { if (L.ch) drawChiStrip(); });

// ζ and ξ share one tab; the radio buttons switch between the two modes
let zetaFn = mode === 'xi' ? 'xi' : 'zeta';
const tabOf = (m) => (m === 'xi' ? 'zeta' : m);
for (const r of document.querySelectorAll('input[name=zfn]')) r.addEventListener('change', () => setMode(r.value));

function setMode(m) {
  const prev = mode;
  mode = m;
  if (m === 'zeta' || m === 'xi') zetaFn = m;
  for (const r of document.querySelectorAll('input[name=zfn]')) r.checked = r.value === zetaFn;
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.mode === tabOf(m)));
  // data-for lists the tabs (space-separated) an element belongs to
  for (const el of document.querySelectorAll('[data-for]')) el.hidden = !el.dataset.for.split(' ').includes(m);
  history.replaceState(null, '', m === 'zeta' ? location.pathname + location.search : `#${m}`);
  if (m === 'primes') {
    primesView.show();
    return;
  }
  primesView.hide();
  if (m === 'dirichlet') {
    drawChiStrip(); // the canvas had no width while hidden
    uniforms.uMode.value = L.fn === 'L' ? 2 : 3;
  } else {
    uniforms.uMode.value = m === 'xi' ? 1 : 0;
  }
  if (group(prev) !== group(m) || prev === 'primes') tStart = tStarts[group(m)];
  setWindow(tStart);
}
for (const b of document.querySelectorAll('.tab')) {
  b.addEventListener('click', () => setMode(b.dataset.mode === 'zeta' ? zetaFn : b.dataset.mode));
}

tStartInput.addEventListener('input', () => setWindow(Number(tStartInput.value)));
probeInput.addEventListener('input', updateProbe);
addEventListener('keydown', (e) => {
  if (mode === 'primes') return;
  if (e.key === 'w' || e.key === 'W') setWindow(tStart + 0.5);
  if (e.key === 's' || e.key === 'S') setWindow(tStart - 0.5);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});

tStart = tStarts[group(mode)];
setCharacter(4, 1);
setLFunction('L');
setMode(mode);
renderer.setAnimationLoop(() => {
  if (mode === 'primes') return; // the 3D scene is hidden
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});
