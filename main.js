import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { zeta, xiScaled, termsFor, borweinWeights, criticalZeros } from './zeta.js';

// ---- Layout: how math units map to world units --------------------------------
const SIGMA_MIN = -1, SIGMA_MAX = 2; // real part of s shown
const WINDOW = 40;                    // length of the visible t range
const T_START_MAX = 70;               // so t stays <= 110 (shader term budget)
const MAX_TERMS = 128;                // size of the weight array in the shader
const SX = 4;                         // world units per unit of sigma
const SZ = 0.6;                       // world units per unit of t
const H = 1.6;                        // world units per unit of log(1 + |zeta|)
const LOG_CAP = 3.0;                  // clip the pole at s = 1

let tStart = 10;
let mode = location.hash === '#xi' ? 'xi' : 'zeta'; // which function the terrain shows
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
  uniform int uMode;     // 0: zeta(s), 1: xi(s) scaled by a positive function of t (see zeta.js)
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

  void main() {
    float sigma = mix(uSigma.x, uSigma.y, uv.x);
    float t = mix(uT.x, uT.y, uv.y);
    vZ = uMode == 1 ? xiScaled(sigma, t) : zeta(sigma, t);
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

  zeros.forEach((t, i) => {
    if (t < tStart || t > tStart + WINDOW) return;
    const m = new THREE.Mesh(zeroGeom, zeroMat);
    m.position.set(xOf(0.5), 0.02, zOf(t));
    overlay.add(m);
    overlay.add(label(`#${i + 1}  ${t.toFixed(3)}`, 'zero', new THREE.Vector3(xOf(SIGMA_MAX) + 1.6, 0, zOf(t))));
  });
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
const f = () => (mode === 'xi' ? xiScaled : zeta);
const fmt = (x) => (x >= 0 ? ' ' : '') + x.toFixed(4);

let curve = []; // samples of the current function at 1/2 + it across the window

function setWindow(start) {
  tStart = Math.min(Math.max(start, 0), T_START_MAX);
  tStartInput.value = tStart;
  document.getElementById('tStartVal').textContent = tStart.toFixed(1);

  const n = Math.min(termsFor(tStart + WINDOW), MAX_TERMS);
  uniforms.uW.value.fill(0);
  uniforms.uW.value.set(borweinWeights(n));
  uniforms.uN.value = n;
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

  let nearest = -1;
  zeros.forEach((zt, i) => { if (nearest < 0 || Math.abs(zt - t) < Math.abs(zeros[nearest] - t)) nearest = i; });
  const dist = Math.abs(zeros[nearest] - t);
  const sym = mode === 'xi' ? 'ξ̃' : 'ζ';
  readout.innerHTML =
    (mode === 'xi'
      ? `ξ̃(½ + ${t.toFixed(3)}i) =${fmt(z.re)} &nbsp;(real)<br>`
      : `ζ(½ + ${t.toFixed(3)}i) =${fmt(z.re)} ${z.im < 0 ? '−' : '+'} ${Math.abs(z.im).toFixed(4)}i<br>`) +
    `|${sym}| = ${mag.toFixed(4)}<br>` +
    (dist < 0.02
      ? `<span class="zero">at zero #${nearest + 1} (t = ${zeros[nearest].toFixed(6)})</span>`
      : `nearest zero: #${nearest + 1} at t = ${zeros[nearest].toFixed(3)}`);
  if (mode === 'xi') drawGraph(t, z.re); else drawCurve(z);
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
  for (const zt of zeros) {
    if (zt < tStart || zt > tStart + WINDOW) continue;
    ctx.beginPath(); ctx.arc(px(zt), Hc / 2, 6, 0, 2 * Math.PI); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px(tNow), py(current), 9, 0, 2 * Math.PI); ctx.fill();
}

// ---- Tabs: zeta or xi -------------------------------------------------------------
function setMode(m) {
  mode = m;
  uniforms.uMode.value = m === 'xi' ? 1 : 0;
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.mode === m));
  for (const el of document.querySelectorAll('[data-for]')) el.hidden = el.dataset.for !== m;
  history.replaceState(null, '', m === 'xi' ? '#xi' : location.pathname + location.search);
  setWindow(tStart);
}
for (const b of document.querySelectorAll('.tab')) b.addEventListener('click', () => setMode(b.dataset.mode));

tStartInput.addEventListener('input', () => setWindow(Number(tStartInput.value)));
probeInput.addEventListener('input', updateProbe);
addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'W') setWindow(tStart + 0.5);
  if (e.key === 's' || e.key === 'S') setWindow(tStart - 0.5);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});

setMode(mode);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});
