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
const GROUND = 0x0d1117, WELL = 0x05070b, HIGH = 0x566279, GOLD = 0xf5c542, INK = 0xecebe6, UNCHECKED = 0x364052, RED = 0xe6392d;
const squash = size => RISE * (2 / Math.PI) * Math.atan(size);   // every height in the world: 0 at a zero, RISE at the pole

// ln |Gamma(x + iy)| for x > 0: step x up until |z| is at least 9, then Stirling's series.
function lnAbsGamma(x, y) {
  let stepped = 0;
  while (x * x + y * y < 81) { stepped += 0.5 * Math.log(x * x + y * y); x += 1; }
  const r2 = x * x + y * y, th = Math.atan2(y, x);
  return (x - 0.5) * 0.5 * Math.log(r2) - y * th - x + 0.5 * Math.log(2 * Math.PI) + x / (12 * r2) - Math.cos(3 * th) / (360 * r2 ** 1.5) - stepped;
}
console.assert(Math.abs(lnAbsGamma(0.5, 0) - 0.5 * Math.log(Math.PI)) < 1e-7 && Math.abs(lnAbsGamma(1, 1) - 0.5 * Math.log(Math.PI / Math.sinh(Math.PI))) < 1e-7, 'gamma self-check failed');

// Starts the world on a canvas and returns { camera, controls, zeros, resize, run, tick }, plus, in the wash look,
// { mirror, ghost, project, holding, onGhost } for the second half of the guide. Throws where WebGL is unavailable.
// panel: the text panel a portrait layout frames the scene above. Call resize() when its height changes.
// count: the element the roll call writes to. wash: the wash look above, in place of the phase colours.
// quiet: a function that says whether motion is paused. Set tick to a function of the frame timestamp to move the camera.
// run(false) stops drawing and run(true) resumes.
export function startWorld(canvas, { panel, count, wash = false, quiet = () => false } = {}) {
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
  for (let v = 0; v < pos.count; v++) pos.setY(v, squash(Math.hypot(re[v], im[v])));   // the pole is Infinity, which atan turns into RISE
  terrain.computeVertexNormals();
  const W = NS + 1, normal = terrain.attributes.normal, well = new THREE.Color(WELL), high = new THREE.Color(HIGH);
  // Wash look. The land can morph between two lands, y0 (zeta, as baked above) and y1 (set by mirror() below), each with its own
  // baked slope shading s0 and s1. mix runs from 0 to 1 toward `to`.
  const shading = () => Float32Array.from(pos.array.subarray(0, pos.count), (_, v) => SHADE0 + (1 - SHADE0) * Math.max(0, normal.getX(v) * SUN[0] + normal.getY(v) * SUN[1] + normal.getZ(v) * SUN[2]));
  const land = { y0: null, y1: null, s0: null, s1: null, mix: 0, to: 0, hatch: false, tint: new Float32Array(wash ? pos.count : 0) };   // tint: how red, for the hypothetical wells
  const blush = new THREE.Color(RED);
  // Sets the heights and colours of rows j0 to j1. The line and its casing keep the colours they were given once.
  function paint(j0 = 0, j1 = NT) {
    const { y0, y1, s0, s1, mix, hatch, tint } = land, P = pos.array;
    for (let j = j0; j <= j1; j++) for (let i = 0, v = j * W; i < W; i++, v++) {
      const y = y0[v] + (y1[v] - y0[v]) * mix, col = Math.abs(i - ROAD);
      P[v * 3 + 1] = y;
      if (col < 2) continue;
      let shade = s0[v] + (s1[v] - s0[v]) * mix;
      if (hatch && col >= 13 && col <= 15 && (j >> 3 & 1)) shade *= 0.55;   // stripes on the columns strictly inside the strip's outer eighths
      const k = Math.sqrt(y / RISE);
      const q = tint[v] * mix;                                                // everything the hypothetical zero causes is red
      colors[v * 3] = (well.r + (high.r - well.r) * k) * shade * (1 - q) + blush.r * q; colors[v * 3 + 1] = (well.g + (high.g - well.g) * k) * shade * (1 - q) + blush.g * q; colors[v * 3 + 2] = (well.b + (high.b - well.b) * k) * shade * (1 - q) + blush.b * q;
    }
    pos.needsUpdate = true;
    if (terrain.attributes.color) terrain.attributes.color.needsUpdate = true;
  }
  if (wash) {
    land.y0 = land.y1 = Float32Array.from(pos.array.subarray(0, pos.count), (_, v) => pos.getY(v)); land.s0 = land.s1 = shading();
    for (let v = 0; v < pos.count; v++) {
      const col = Math.abs(v % W - ROAD);
      if (col === 0) c.set(GOLD).toArray(colors, v * 3);                      // the critical line, painted on,
      else if (col === 1) c.set(GROUND).toArray(colors, v * 3);               // with a dark casing so it is gold against the ground even on high land
    }
    paint();
  } else for (let v = 0; v < pos.count; v++) {
    if (v % W === ROAD) c.set(0xf5c542);                                      // the critical line, painted on
    else c.setHSL(Math.atan2(im[v], re[v]) / (2 * Math.PI) + 0.5, 0.75, LUM0 + LUM1 * pos.getY(v) / RISE);   // +0.5: positive real is cyan, so the gold line stands out
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

  // ---- the second half of the guide: the mirror, and one hypothetical zero. Wash look only. ----
  // The completed function xi(s) = s (s - 1) / 2 * pi^(-s/2) * Gamma(s/2) * zeta(s) has zeta's nontrivial zeros and is its own
  // mirror image: xi(s) = xi(1 - s). Its size falls fast going north, so each row is divided by its size on the line. That leaves
  // a land equal to zeta's on the line and symmetric across it. s Gamma(s/2) / 2 = Gamma(s/2 + 1) keeps it finite at s = 0.
  const lnF = (sg, t) => 0.5 * Math.log((sg - 1) ** 2 + t * t) - sg / 2 * Math.log(Math.PI) + lnAbsGamma(sg / 2 + 1, t / 2);
  const sgOf = i => SIG0 + (SIG1 - SIG0) * i / NS, tOf = j => T_MAX * (1 - j / NT), rowOf = t => Math.min(NT, Math.max(0, Math.round(NT * (1 - t / T_MAX))));
  let size1 = null;                                  // the size of that completed, rescaled function at each vertex
  function bakeMirror() {
    size1 = new Float32Array(pos.count);
    for (let j = 0; j <= NT; j++) for (let i = 0, t = tOf(j), on = lnF(0.5, t); i < W; i++) {
      const v = j * W + i, sg = sgOf(i);
      size1[v] = isFinite(re[v]) ? Math.hypot(re[v], im[v]) * Math.exp(lnF(sg, t) - on)
        : Math.exp(-sg / 2 * Math.log(Math.PI) + lnAbsGamma(sg / 2 + 1, 0) - on);   // at the pole (s - 1) zeta(s) is 1
    }
    // Self-check: the land is its own mirror image, to the accuracy of zetaGrid.
    console.assert([[300, 6], [2000, 20], [3800, 28], [NT, 16]].every(([j, i]) => Math.abs(size1[j * W + i] - size1[j * W + NS - i]) < 0.02 * size1[j * W + i] + 0.005), 'mirror self-check failed');
    land.y1 = size1.map(squash);
    for (let v = 0; v < pos.count; v++) pos.setY(v, land.y1[v]);
    terrain.computeVertexNormals(); land.s1 = shading();
    paint();
  }
  world.mirror = on => { if (on && !size1) bakeMirror(); land.to = on ? 1 : 0; };

  // The hypothetical zero: an open red square on a dashed stalk at beta + i gamma, its twin at 1 - beta + i gamma, and a well
  // under each, cut into the mirror land. It is fiction: guide.js labels it wherever it shows. ghost() with no arguments removes it.
  const red = new THREE.MeshBasicMaterial({ color: RED, side: THREE.DoubleSide, fog: false });
  const square = new THREE.RingGeometry(0.17, 0.23, 4, 1, Math.PI / 4), dash = new THREE.CylinderGeometry(HEAD / 4, HEAD / 4, 0.17);
  const [east, west] = [0, 1].map(() => {
    const mark = new THREE.Group().add(new THREE.Mesh(square, red));
    mark.children[0].position.y = PIN;
    for (let y = 0.12; y < PIN - 0.3; y += 0.3) mark.add(new THREE.Mesh(dash, red)).children.at(-1).position.y = y;
    mark.visible = false; scene.add(mark);
    return mark;
  });
  // Walls at Re(s) = 0 and 1, shown with the hypothetical zero.
  const wall = new THREE.PlaneGeometry(LEN * T_MAX, 1.4 * RISE).rotateY(Math.PI / 2).translate(0, 0.7 * RISE, 0);
  const glass = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const walls = new THREE.Group().add(new THREE.Mesh(wall, glass), new THREE.Mesh(wall, glass));
  walls.children[0].position.x = xOf(0); walls.children[1].position.x = xOf(1); walls.visible = false; scene.add(walls);

  const WELL_R = 0.5, REACH = 5;                     // the wells' width in units of s, and how many units north and south they are drawn
  let spot = null, cut = null;                       // where the hypothetical zero is, and the rows its wells were cut into
  world.ghost = (beta, gamma) => {
    if (!wash) return;
    if (!size1) bakeMirror();
    const was = cut, hadSpot = !!spot;
    if (cut) for (let v = cut[0] * W, end = (cut[1] + 1) * W; v < end; v++) { land.y1[v] = squash(size1[v]); land.tint[v] = 0; }   // fill the old wells in
    spot = beta == null ? null : { beta, gamma }; cut = null;
    east.visible = walls.visible = land.hatch = !!spot; west.visible = !!spot && beta > 0.5;
    if (spot) {
      const depth = Math.min(1, (beta - 0.5) / 0.04);                       // on the line it cuts nothing: it is only hypothetical off it
      cut = [rowOf(gamma + REACH), rowOf(gamma - REACH)];
      for (let j = cut[0]; j <= cut[1]; j++) for (let i = 0, dt = (tOf(j) - gamma) ** 2; i < W; i++) {
        const v = j * W + i, a = (sgOf(i) - beta) ** 2 + dt, b = (sgOf(i) - 1 + beta) ** 2 + dt;
        const dip = depth * (1 - Math.sqrt(a / (a + WELL_R ** 2) * b / (b + WELL_R ** 2)));
        land.y1[v] = squash(size1[v] * (1 - dip)); land.tint[v] = 0.75 * dip * dip;
      }
      east.position.set(xOf(beta), 0, zOf(gamma)); west.position.set(xOf(1 - beta), 0, zOf(gamma));
    }
    if (hadSpot !== !!spot) paint(); else if (cut) paint(Math.min(cut[0], was[0]), Math.max(cut[1], was[1]));
  };

  // Where a point of the s-plane, y above the floor, is on screen, in CSS pixels.
  const p3 = new THREE.Vector3();
  world.project = (sigma, t, y = 0) => { p3.set(xOf(sigma), y, zOf(t)).project(camera); return [(p3.x + 1) / 2 * innerWidth, (1 - p3.y) / 2 * innerHeight]; };

  // Dragging: a press near either red mark takes it, and the orbit controls never see that press. The drag is on the floor plane.
  // onGhost(beta, gamma) tells the page where the visitor has put it.
  const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const floorAt = e => { ndc.set(e.clientX / innerWidth * 2 - 1, 1 - e.clientY / innerHeight * 2); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(floor, hit); };
  let held = null;                                   // while dragging: from the pointer's point on the floor to the mark's foot
  canvas.addEventListener('pointerdown', e => {
    if (!spot) return;
    const near = sigma => [0, PIN].some(y => { const [x, yy] = world.project(sigma, spot.gamma, y); return Math.hypot(x - e.clientX, yy - e.clientY) < 44; });
    const side = near(spot.beta) ? 1 : near(1 - spot.beta) ? -1 : 0;
    if (!side || !floorAt(e)) return;
    e.stopImmediatePropagation(); canvas.setPointerCapture(e.pointerId);
    held = { x: side * xOf(spot.beta) - hit.x, z: zOf(spot.gamma) - hit.z };
  }, { capture: true });
  canvas.addEventListener('pointermove', e => {
    if (!held || !floorAt(e)) return;
    const beta = Math.min(0.875, Math.max(0.5, Math.abs(hit.x + held.x) / WIDTH + 0.5)), gamma = Math.min(60, Math.max(10, (zOf(0) - hit.z - held.z) / LEN));
    world.ghost(beta, gamma); world.onGhost?.(beta, gamma);
  });
  for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, () => { held = null; });
  world.holding = () => !!held;

  const start = performance.now();
  const frame = now => {
    rollCall(now - start);
    if (land.mix !== land.to) {                                               // the morph between the two lands
      land.mix = quiet() || Math.abs(land.to - land.mix) < 0.003 ? land.to : land.mix + (land.to - land.mix) * 0.06;
      paint();
    }
    east.children[0].quaternion.copy(camera.quaternion); west.children[0].quaternion.copy(camera.quaternion);   // the open squares face the viewer
    world.tick?.(now);                                                        // a page's own camera moves go here, before update() re-aims the camera
    controls.update();
    const k = Math.max(camera.position.y / FOG_H, 1);                         // fog thins as the camera climbs: low down the road vanishes into it,
    scene.fog.near = FOG0 * k; scene.fog.far = FOG1 * k;                      // from high up the whole road is clear
    renderer.render(scene, camera);
  };
  world.run(true);
  return world;
}
