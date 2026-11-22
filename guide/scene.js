import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ZEROS } from './zeros.js';

export { ZEROS };

// The 3D world of Zeta World, shared by every page that shows it. ZEROS and zetaGrid live here and nowhere else.

// ---- layout: tuned by eye in headless Chrome, 22 Nov -------------------------
const WIDTH = 4, LEN = 1, RISE = 1;                // world units per unit of Re(s), per unit of Im(s), and the height of the pole.
                                                   // RISE / LEN must stay near 1: a zero is a cone, and at 6 its walls hide every pit from a low camera
const SIG0 = -0.5, SIG1 = 1.5, NS = 64, NT = 4096;
export const T_MAX = 237;                          // the road ends between zero 100 (236.52) and zero 101 (237.77), so every well has a pin
const FOG0 = 45, FOG1 = 130, FOG_H = 6.5;          // fog from 45 to 130 up to the start pose's height. Above that it scales with height
const PIN = 1.5 * RISE, HEAD = 0.1;                // pin height and head radius
const LUM0 = 0.06, LUM1 = 0.5;                     // lightness at the floor and how much full height adds: pits must read as dark
const SUN = [0.68, 0.57, 0.46], SHADE0 = 0.8;      // wash look: slopes facing away from this direction darken to 0.8, baked into the colours
const ROLL_MS = 40;                                // roll call: one pin every 40 ms, 4 s for all 100

// ---- the math --------------------------------------------------------------

// zeta(sigma + i t) on a (ns+1) x (nt+1) vertex grid by Euler-Maclaurin summation: N terms plus 3 Bernoulli corrections.
// Returns { re, im } as Float32Arrays, index j * (ns + 1) + i, with i along sigma and j along t.
// cos and sin depend only on (t, n) and n^-sigma only on (sigma, n), so the inner loop is two multiply-adds.
// N = 128 is good to t of about 400. Keep t below about 3 N.
function zetaGrid(sig0, sig1, ns, t0, t1, nt, N = 128) {
  const W = ns + 1, H = nt + 1, re = new Float32Array(W * H), im = new Float32Array(W * H);
  const ln = new Float64Array(N + 1), pw = new Float64Array(N * W), sr = new Float64Array(W), si = new Float64Array(W);
  for (let n = 1; n <= N; n++) {
    ln[n] = Math.log(n);
    for (let i = 0; i < W; i++) pw[(n - 1) * W + i] = Math.exp(-(sig0 + (sig1 - sig0) * i / ns) * ln[n]);
  }
  for (let j = 0; j < H; j++) {
    const t = t0 + (t1 - t0) * j / nt;
    sr.fill(0); si.fill(0);
    for (let n = 1; n < N; n++) {                                   // sum of n^-s for n < N
      const c = Math.cos(t * ln[n]), s = -Math.sin(t * ln[n]), row = (n - 1) * W;
      for (let i = 0; i < W; i++) { const m = pw[row + i]; sr[i] += m * c; si[i] += m * s; }
    }
    const c = Math.cos(t * ln[N]), s = -Math.sin(t * ln[N]), N2 = N * N;
    for (let i = 0; i < W; i++) {
      const sg = sig0 + (sig1 - sig0) * i / ns, m = pw[(N - 1) * W + i], pr = m * c, pi = m * s;   // p = N^-s
      const a = sg - 1, d = a * a + t * t, k0 = j * W + i;
      if (d < 1e-20) { re[k0] = Infinity; im[k0] = 0; continue; }   // the pole at s = 1
      let zr = sr[i] + 0.5 * pr + N * (pr * a + pi * t) / d, zi = si[i] + 0.5 * pi + N * (pi * a - pr * t) / d;   // + N^-s / 2 + N^(1-s) / (s-1)
      let wr = sg, wi = t, ur = pr / N, ui = pi / N, x;             // w = s (s+1) ..., u = N^(-s-2k+1)
      zr += (wr * ur - wi * ui) / 12; zi += (wr * ui + wi * ur) / 12;
      for (const [k, cf] of [[1, -1 / 720], [3, 1 / 30240]]) {
        x = wr * (sg + k) - wi * t; wi = wr * t + wi * (sg + k); wr = x;
        x = wr * (sg + k + 1) - wi * t; wi = wr * t + wi * (sg + k + 1); wr = x;
        ur /= N2; ui /= N2;
        zr += cf * (wr * ur - wi * ui); zi += cf * (wr * ui + wi * ur);
      }
      re[k0] = zr; im[k0] = zi;
    }
  }
  return { re, im };
}

// Self-check: every listed zero is a zero, and zeta(2) = pi^2 / 6.
const size = (sigma, t) => { const z = zetaGrid(sigma, sigma, 1, t, t, 1); return Math.hypot(z.re[0], z.im[0]); };
const CHECKED = ZEROS.map(t => size(0.5, t) < 1e-4), ZETA2_OK = Math.abs(size(2, 0) - Math.PI ** 2 / 6) < 1e-6;
console.assert(CHECKED.every(Boolean) && ZETA2_OK, 'zeta self-check failed');

// ---- the world -------------------------------------------------------------
// x = WIDTH * (Re(s) - 1/2), z = LEN * (T_MAX / 2 - Im(s)): north is -z, so east is on the right looking up the road.
// y = RISE * (2 / pi) * atan|zeta(s)|: a zero is a pit to the floor and the pole s = 1 is a spire of height RISE.
export const xOf = sigma => WIDTH * (sigma - 0.5), zOf = t => LEN * (T_MAX / 2 - t);

// The wash look, for the guide: the canvas is transparent so the page's ground and ticks show around the land.
// The land is a wash by height, from WELL at the floor to HIGH on top, and nothing is lit, so these are the colours on screen.
// The palette is the guide's (guide.html): a near-black ground, light ink for what is real, gold for the critical line.
const GROUND = 0x0d1117, WELL = 0x05070b, HIGH = 0x566279, GOLD = 0xf5c542, INK = 0xecebe6, UNCHECKED = 0x364052;

// Starts the world on a canvas and returns { camera, controls, zeros, resize, run, tick }. Throws where WebGL is unavailable.
// panel: the text panel a portrait layout frames the scene above. Call resize() when its height changes.
// count: the element the roll call writes to. wash: the wash look above, in place of the phase colours.
// Set tick to a function of the frame timestamp to move the camera. run(false) stops drawing and run(true) resumes.
export function startWorld(canvas, { panel, count, wash = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: wash });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  if (!wash) scene.background = new THREE.Color(0x05060f);    // in the wash look the canvas stays clear. Never setClearColor: its alpha defaults to 1
  scene.fog = new THREE.Fog(wash ? GROUND : 0x05060f, FOG0, FOG1);   // the render loop rescales it
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a3a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(30, 25, 20);
  scene.add(sun);

  // Baked north to south (t from T_MAX down to 0): that is PlaneGeometry's row order after rotateX(-90 deg),
  // so the grid index is the vertex index and the fill loop needs no arithmetic.
  const { re, im } = zetaGrid(SIG0, SIG1, NS, T_MAX, 0, NT);

  const terrain = new THREE.PlaneGeometry(WIDTH * (SIG1 - SIG0), LEN * T_MAX, NS, NT).rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  const ROAD = NS * (0.5 - SIG0) / (SIG1 - SIG0);                             // the vertex column of Re(s) = 1/2
  for (let v = 0; v < pos.count; v++) pos.setY(v, RISE * (2 / Math.PI) * Math.atan(Math.hypot(re[v], im[v])));   // the pole is Infinity, which atan turns into RISE
  terrain.computeVertexNormals();
  const normal = terrain.attributes.normal, well = new THREE.Color(WELL), high = new THREE.Color(HIGH);
  for (let v = 0; v < pos.count; v++) {
    const col = Math.abs(v % (NS + 1) - ROAD), y = pos.getY(v);
    if (wash) {
      if (col === 0) c.set(GOLD);                                             // the critical line, painted on,
      else if (col === 1) c.set(GROUND);                                      // with a dark casing so it is gold against the ground even on high land
      else c.lerpColors(well, high, Math.sqrt(y / RISE)).multiplyScalar(SHADE0 + (1 - SHADE0) * Math.max(0, normal.getX(v) * SUN[0] + normal.getY(v) * SUN[1] + normal.getZ(v) * SUN[2]));
    } else if (col === 0) c.set(0xf5c542);                                    // the critical line, painted on
    else c.setHSL(Math.atan2(im[v], re[v]) / (2 * Math.PI) + 0.5, 0.75, LUM0 + LUM1 * y / RISE);   // +0.5: positive real is cyan, so the gold line stands out
    c.toArray(colors, v * 3);
  }
  terrain.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Mesh self-check, by world position: a north-south flip would lift the first pit, an east-west flip would move the spire off Re(s) = 1.
  const vPit = Math.round((1 - ZEROS[0] / T_MAX) * NT) * (NS + 1) + ROAD, vPole = NT * (NS + 1) + NS * (1 - SIG0) / (SIG1 - SIG0);
  console.assert(Math.abs(pos.getZ(vPit) - zOf(ZEROS[0])) < LEN * T_MAX / NT && pos.getY(vPit) < 0.05 * RISE
    && Math.hypot(pos.getX(vPole) - xOf(1), pos.getZ(vPole) - zOf(0)) < 1e-3 && pos.getY(vPole) === RISE, 'terrain self-check failed: the mesh is flipped');
  scene.add(new THREE.Mesh(terrain, wash ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide })));

  // Pin heads sit above everything (the land never exceeds RISE) so no ridge hides them; the stalk's foot is the zero.
  const pin = new THREE.CylinderGeometry(HEAD / 7, HEAD / 7, PIN).translate(0, PIN / 2, 0), head = new THREE.SphereGeometry(HEAD, 16, 12).translate(0, PIN, 0);
  const dim = new THREE.MeshBasicMaterial({ color: wash ? UNCHECKED : 0x4a4d66 });
  const glow = new THREE.MeshBasicMaterial({ color: wash ? INK : 0xffffff, fog: false });   // a checked pin shows through the fog
  const markers = ZEROS.map(t => {
    const marker = new THREE.Group().add(new THREE.Mesh(pin, dim), new THREE.Mesh(head, dim));
    marker.position.set(0, 0, zOf(t));
    scene.add(marker);
    return marker;
  });

  // Roll call: pins light up south to north, and a pin only lights (and counts) if its zero passed the self-check above.
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lit = 0, passed = 0;
  function rollCall(ms) {
    const n = still ? ZEROS.length : Math.min(ZEROS.length, ms / ROLL_MS);
    if (lit >= n) return;
    for (; lit < n; lit++) if (CHECKED[lit]) { passed++; for (const m of markers[lit].children) m.material = glow; }
    if (count) count.textContent = `${passed} / ${ZEROS.length} zeros checked`;
  }

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(-3.5, 6.5, zOf(7));          // start pose: west of the road at Im(s) = 7, low, looking north up it
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, zOf(22));              // 23 degrees down: any lower and the ridge south of each pit hides it
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;        // stay above the floor
  controls.minDistance = 2; controls.maxDistance = 300;   // 300 fits the whole road on screen

  function resize() {
    // Portrait: frame the scene in the space above the text, and widen the view so the whole strip still fits.
    const free = panel && innerWidth < innerHeight ? Math.max(innerHeight - panel.offsetHeight, innerHeight / 4) : innerHeight;
    renderer.setSize(innerWidth, innerHeight, false);
    camera.fov = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(25)) * Math.max(1, 1.6 * free / innerWidth)));
    camera.setViewOffset(innerWidth, free, 0, 0, innerWidth, innerHeight);   // sets the aspect and updates the projection
  }
  addEventListener('resize', resize);
  resize();

  const world = { camera, controls, zeros: ZEROS, resize, tick: null, run: on => renderer.setAnimationLoop(on ? frame : null) };
  const start = performance.now();
  const frame = now => {
    rollCall(now - start);
    world.tick?.(now);                                                        // a page's own camera moves go here, before update() re-aims the camera
    controls.update();
    const k = Math.max(camera.position.y / FOG_H, 1);                         // fog thins as the camera climbs: low down the road vanishes into it,
    scene.fog.near = FOG0 * k; scene.fog.far = FOG1 * k;                      // from high up the whole road is clear
    renderer.render(scene, camera);
  };
  world.run(true);
  return world;
}
