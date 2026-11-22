import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { ZEROS, CHECKED, zetaGrid } from './zeros.js?v=2';

export { ZEROS };

// The 3D world of Zeta World. The zeros and zetaGrid, the function's numbers, are in zeros.js and nowhere else.

// ---- layout: tuned by eye in headless Chrome, 22 Nov -------------------------
const WIDTH = 4, LEN = 1, RISE = 1;                // world units per unit of Re(s), per unit of Im(s), and the height of the pole.
                                                   // RISE / LEN must stay near 1: a zero is a cone, and at 6 its walls hide every pit from a low camera
const SIG0 = -0.5, SIG1 = 1.5, NS = 64, NT = 4096;
export const T_MAX = 237;                          // the road ends between zero 100 (236.52) and zero 101 (237.77), so every well has a pin
const FOG0 = 45, FOG1 = 130, FOG_H = 6.5;          // fog from 45 to 130 up to the start pose's height. Above that it scales with height
const PIN = 1.5 * RISE, HEAD = 0.1;                // pin height and head radius
const SUN = [0.68, 0.57, 0.46], SHADE0 = 0.8;      // slopes facing away from this direction darken to 0.8, baked into the colours
const ROLL_MS = 40;                                // roll call: one pin every 40 ms, 4 s for all 100
const RAIL = 2.6 * RISE, DIAL = 1.5;               // the survey: the rail's height, and the length the longest arrow tends to.
                                                   // RAIL - DIAL must stay above RISE, so the path never dips into the land

// ---- the math --------------------------------------------------------------

// ---- the world -------------------------------------------------------------
// x = WIDTH * (Re(s) - 1/2), z = LEN * (T_MAX / 2 - Im(s)): north is -z, so east is on the right looking up the road.
// y = RISE * (2 / pi) * atan|zeta(s)|: a zero is a pit to the floor and the pole s = 1 is a spire of height RISE.
export const xOf = sigma => WIDTH * (sigma - 0.5), zOf = t => LEN * (T_MAX / 2 - t);

// The look: the canvas is transparent, so the page's ground and ticks show around the land. The land is shaded by height,
// from WELL at the floor to HIGH on top, and nothing is lit, so these are the colours on screen. The palette is the page's
// (index.html): a near-black ground, light ink for what is real, gold for the critical line, red for the hypothetical zero.
const GROUND = 0x0d1117, WELL = 0x05070b, HIGH = 0x566279, GOLD = 0xf5c542, INK = 0xecebe6, UNCHECKED = 0x364052, RED = 0xe6392d, MUTED = 0x9aa0aa, DIM = 0x7f8794, ACT = 0x4fd6be;
const squash = size => RISE * (2 / Math.PI) * Math.atan(size);   // every height in the world: 0 at a zero, RISE at the pole

// ln |Gamma(x + iy)| for x > 0: step x up until |z| is at least 9, then Stirling's series.
function lnAbsGamma(x, y) {
  let stepped = 0;
  while (x * x + y * y < 81) { stepped += 0.5 * Math.log(x * x + y * y); x += 1; }
  const r2 = x * x + y * y, th = Math.atan2(y, x);
  return (x - 0.5) * 0.5 * Math.log(r2) - y * th - x + 0.5 * Math.log(2 * Math.PI) + x / (12 * r2) - Math.cos(3 * th) / (360 * r2 ** 1.5) - stepped;
}
console.assert(Math.abs(lnAbsGamma(0.5, 0) - 0.5 * Math.log(Math.PI)) < 1e-7 && Math.abs(lnAbsGamma(1, 1) - 0.5 * Math.log(Math.PI / Math.sinh(Math.PI))) < 1e-7, 'gamma self-check failed');

// Starts the world on a canvas and returns { camera, controls, zeros, resize, run, tick, probe, pick, light }, plus
// { mirror, ghost, project, holding, onGhost } for the second half of the guide. Throws where WebGL is unavailable.
// panel: the text panel a portrait layout frames the scene above. Call resize() when its height changes.
// count: the element the roll call writes to. quiet: a function that says whether motion is paused.
// Set tick to a function of the frame timestamp to move the camera. run(false) stops drawing and run(true) resumes.
export function startWorld(canvas, { panel, count, quiet = () => false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });   // the canvas stays clear. Never setClearColor: its alpha defaults to 1
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(GROUND, FOG0, FOG1);     // the far end of the land fades into the page. The render loop rescales it

  // Baked north to south (t from T_MAX down to 0): that is PlaneGeometry's row order after rotateX(-90 deg),
  // so the grid index is the vertex index and the fill loop needs no arithmetic.
  const { re, im } = zetaGrid(SIG0, SIG1, NS, T_MAX, 0, NT);

  const terrain = new THREE.PlaneGeometry(WIDTH * (SIG1 - SIG0), LEN * T_MAX, NS, NT).rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  const ROAD = NS * (0.5 - SIG0) / (SIG1 - SIG0);                             // the vertex column of Re(s) = 1/2
  for (let v = 0; v < pos.count; v++) pos.setY(v, squash(Math.hypot(re[v], im[v])));   // the pole is Infinity, which atan turns into RISE
  terrain.computeVertexNormals();
  const W = NS + 1, normal = terrain.attributes.normal, well = new THREE.Color(WELL), high = new THREE.Color(HIGH);
  // The land can morph between two lands, y0 (zeta, as baked above) and y1 (set by mirror() below), each with its own
  // baked slope shading s0 and s1. mix runs from 0 to 1 toward `to`.
  const shading = () => Float32Array.from(pos.array.subarray(0, pos.count), (_, v) => SHADE0 + (1 - SHADE0) * Math.max(0, normal.getX(v) * SUN[0] + normal.getY(v) * SUN[1] + normal.getZ(v) * SUN[2]));
  const land = { y0: null, y1: null, s0: null, s1: null, mix: 0, to: 0, hatch: false, tint: new Float32Array(pos.count) };   // tint: how red, for the hypothetical wells
  const blush = new THREE.Color(RED);
  // Sets the heights and colours of rows j0 to j1. What is painted on (fixed, below) keeps the colour it was given once.
  function paint(j0 = 0, j1 = NT) {
    const { y0, y1, s0, s1, mix, hatch, tint } = land, P = pos.array;
    for (let j = j0; j <= j1; j++) for (let i = 0, v = j * W; i < W; i++, v++) {
      const y = y0[v] + (y1[v] - y0[v]) * mix, col = Math.abs(i - ROAD);
      P[v * 3 + 1] = y;
      if (fixed[v]) continue;
      let shade = s0[v] + (s1[v] - s0[v]) * mix;
      if (hatch && col >= 13 && col <= 15 && (j >> 3 & 1)) shade *= 0.55;   // stripes on the columns strictly inside the strip's outer eighths
      const k = Math.sqrt(y / RISE);
      const q = tint[v] * mix;                                                // everything the hypothetical zero causes is red
      colors[v * 3] = (well.r + (high.r - well.r) * k) * shade * (1 - q) + blush.r * q; colors[v * 3 + 1] = (well.g + (high.g - well.g) * k) * shade * (1 - q) + blush.g * q; colors[v * 3 + 2] = (well.b + (high.b - well.b) * k) * shade * (1 - q) + blush.b * q;
    }
    pos.needsUpdate = true; terrain.attributes.color.needsUpdate = true;
  }
  terrain.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  land.y0 = land.y1 = Float32Array.from(pos.array.subarray(0, pos.count), (_, v) => pos.getY(v)); land.s0 = land.s1 = shading();
  // Painted on, so it lies on the land whatever its shape: the line, the two edges of the critical strip, and a ruler.
  const fixed = new Uint8Array(pos.count), EDGE = NS * 0.5 / (SIG1 - SIG0);   // EDGE: how many columns from the line to Re(s) = 0 or 1
  const ink = (v, colour) => { c.set(colour).toArray(colors, v * 3); fixed[v] = 1; };
  for (let v = 0; v < pos.count; v++) {
    const col = Math.abs(v % W - ROAD);
    if (col === 0) ink(v, GOLD);                                              // the critical line,
    else if (col === 1) ink(v, GROUND);                                       // with a dark casing so it is gold against the ground even on high land
    else if (col === EDGE) ink(v, DIM);                                       // Re(s) = 0 and Re(s) = 1
  }
  // The ruler: a tick on the land's east edge at every 10 of Im(s), longer at every 50, with its number beside it (below).
  const RULER = Array.from({ length: Math.floor(T_MAX / 10) }, (_, k) => 10 * (k + 1));
  for (const t of RULER) for (let j = Math.round(NT * (1 - t / T_MAX)), i = NS - (t % 50 ? 2 : 5); i <= NS; i++) { ink(j * W + i, INK); ink((j + 1) * W + i, INK); }
  paint();
  // Mesh self-check, by world position: a north-south flip would lift the first pit, an east-west flip would move the spire off Re(s) = 1.
  const vPit = Math.round((1 - ZEROS[0] / T_MAX) * NT) * (NS + 1) + ROAD, vPole = NT * (NS + 1) + NS * (1 - SIG0) / (SIG1 - SIG0);
  console.assert(Math.abs(pos.getZ(vPit) - zOf(ZEROS[0])) < LEN * T_MAX / NT && pos.getY(vPit) < 0.05 * RISE
    && Math.hypot(pos.getX(vPole) - xOf(1), pos.getZ(vPole) - zOf(0)) < 1e-3 && pos.getY(vPole) === RISE, 'terrain self-check failed: the mesh is flipped');
  scene.add(new THREE.Mesh(terrain, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

  // Pin heads sit above everything (the land never exceeds RISE) so no ridge hides them; the stalk's foot is the zero.
  const pin = new THREE.CylinderGeometry(HEAD / 7, HEAD / 7, PIN).translate(0, PIN / 2, 0), head = new THREE.SphereGeometry(HEAD, 16, 12).translate(0, PIN, 0);
  const dim = new THREE.MeshBasicMaterial({ color: UNCHECKED }), glow = new THREE.MeshBasicMaterial({ color: INK, fog: false });   // a checked pin shows through the fog
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

  // A word in the world: mono type on a clear canvas, on a sprite that faces the viewer. h is its height in world units.
  function word(text, h, colour = '#ecebe6') {
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d'), font = '500 44px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.font = font; cv.width = Math.ceil(ctx.measureText(text).width) + 8; cv.height = 56;
    ctx.font = font; ctx.fillStyle = colour; ctx.textBaseline = 'middle'; ctx.fillText(text, 4, 30);   // sizing a canvas clears its state
    const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
    sprite.scale.set(h * cv.width / cv.height, h, 1);
    return sprite;
  }
  for (const t of RULER) scene.add(word(String(t), t % 50 ? 0.42 : 0.6, '#9aa0aa')).children.at(-1).position.set(xOf(SIG1) + 0.7, 0.3, zOf(t));

  // ---- the survey: what a ride shows over the road ----------------------------
  // On the line, zeta's value is an arrow that turns and changes length as you go north. A rail runs over the line at RAIL. The dial
  // is at your height: the arrow from the rail is zeta(1/2 + i t), east for its real part and up for its imaginary part, and the ring is
  // size 1. The path is where the arrow's tip has been. Lengths are squashed as the land's heights are, so
  // the path is as far from the rail as the land on the line is high, times DIAL. At a zero the arrow has no length: the path passes
  // through the rail, and the pins grow to RAIL so that each head is on that crossing. The gate is the land's outline at your height.
  const survey = new THREE.Group(); survey.visible = false; scene.add(survey);
  const wire = (points, color, linewidth) => new Line2(new LineGeometry().setPositions(points), new LineMaterial({ color, linewidth, fog: true }));
  const tip = (zr, zi) => { const size = Math.hypot(zr, zi), k = size ? DIAL * (2 / Math.PI) * Math.atan(size) / size : 0; return [zr * k, zi * k]; };
  // zeta(1/2 + i t) between the two baked rows either side of t. The rows run north to south.
  const onLine = t => {
    const r = NT * (1 - Math.min(T_MAX, Math.max(0, t)) / T_MAX), j = Math.min(NT - 1, Math.floor(r)), f = r - j, a = j * W + ROAD, b = a + W;
    return [re[a] + (re[b] - re[a]) * f, im[a] + (im[b] - im[a]) * f];
  };
  // Self-check: at every listed zero the arrow has no length, so the path meets the rail where the pin's head is.
  console.assert(ZEROS.every(t => Math.hypot(...onLine(t)) < 0.02) && RAIL - DIAL >= RISE, 'survey self-check failed: the path misses the rail at a zero');
  const path = wire(Array.from({ length: NT + 1 }, (_, j) => { const v = (NT - j) * W + ROAD, [x, y] = tip(re[v], im[v]); return [x, RAIL + y, zOf(T_MAX * j / NT)]; }).flat(), INK, 2.5);   // south to north
  survey.add(path, wire([0, RAIL, zOf(0), 0, RAIL, zOf(T_MAX)], DIM, 1));
  ZEROS.forEach((t, k) => survey.add(word(String(k + 1), 0.3, '#9aa0aa')).children.at(-1).position.set(0, RAIL + 0.34, zOf(t)));   // each pin's number, over its head

  const dial = new THREE.Group(), hand = wire([0, 0, 0, 1, 0, 0], INK, 3);
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 16).translate(0, -0.13, 0), glow);   // its apex is its origin
  const name = word('ζ(s)', 0.34);
  const circle = (r, color, linewidth) => wire(Array.from({ length: 97 }, (_, k) => [r * Math.cos(k * Math.PI / 48), r * Math.sin(k * Math.PI / 48), 0]).flat(), color, linewidth);
  // The dial's face dims what is north of it, so the arrow reads against the road ahead. It is a little north of the arrow, and seen from the south only.
  const face = new THREE.Mesh(new THREE.CircleGeometry(DIAL, 96), new THREE.MeshBasicMaterial({ color: GROUND, transparent: true, opacity: 0.62, depthWrite: false }));
  face.position.z = -0.03;
  const ring = circle(DIAL / 2, MUTED, 1.5);         // size 1. The rim is as far as an arrow of any length can reach
  dial.add(face, circle(DIAL, UNCHECKED, 1), ring, hand, point, name);
  dial.position.y = RAIL;
  // The gate, with the strip's two edges named on it and a mast from the line up to the dial.
  const gate = wire(Array.from({ length: W }, (_, i) => [xOf(SIG0 + (SIG1 - SIG0) * i / NS), 0, 0]).flat(), INK, 1.5);
  const here = new THREE.Group().add(gate, wire([0, 0, 0, 0, RAIL, 0], DIM, 1), word('Re(s) = 0', 0.3, '#9aa0aa'), word('Re(s) = 1', 0.3, '#9aa0aa'));
  survey.add(dial, here);

  // probe(t) puts the survey at height t on the line and returns zeta(1/2 + i t) as [re, im]. probe() puts it away.
  const probe = t => {
    survey.visible = t != null;
    if (t == null) return null;
    const [zr, zi] = onLine(t), [x, y] = tip(zr, zi), r = Math.hypot(x, y), angle = Math.atan2(y, x);
    dial.position.z = here.position.z = zOf(t);
    hand.scale.x = Math.max(r, 1e-6); hand.rotation.z = angle;
    ring.material.linewidth = 1.5 + 3 * Math.max(0, 1 - Math.hypot(zr, zi) / 0.3);   // the ring thickens as the arrow vanishes: a zero
    point.position.set(x, y, 0); point.rotation.z = angle - Math.PI / 2; point.scale.setScalar(Math.min(1, r / 0.3));   // the head shrinks away with the arrow
    name.position.set(x + 0.42 * Math.cos(angle), y + 0.42 * Math.sin(angle), 0);
    const n = Math.round(NT * Math.min(T_MAX, Math.max(0, t)) / T_MAX);
    path.geometry.instanceCount = n;                                          // the path is drawn as far as you have come
    // The gate: the land's heights between the two rows either side of t, written into the wire's segments [x y z x y z].
    const row = NT * (1 - Math.min(T_MAX, Math.max(0, t)) / T_MAX), j = Math.min(NT - 1, Math.floor(row)), f = row - j, P = pos.array, seg = gate.geometry.attributes.instanceStart.data;
    const high = i => { const a = (j * W + i) * 3 + 1; return P[a] + (P[a + W * 3] - P[a]) * f + 0.04; };   // 0.04 clear of the land, so the land never hides it
    for (let i = 0; i < NS; i++) { seg.array[i * 6 + 1] = high(i); seg.array[i * 6 + 4] = high(i + 1); }
    seg.needsUpdate = true;
    here.children[2].position.set(xOf(0), high(EDGE) + 0.3, 0); here.children[3].position.set(xOf(1), high(NS - EDGE) + 0.3, 0);
    return [zr, zi];
  };

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

  const world = { camera, controls, zeros: ZEROS, resize, probe, tick: null, run: on => renderer.setAnimationLoop(on ? frame : null) };

  // ---- the second half of the guide: the mirror, and one hypothetical zero ----
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
    if (beta == null && !spot) return;               // nothing to remove
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

  // The height of the zero whose pin is under a point of the screen, or undefined: its foot, middle or head within 26 px.
  world.pick = (px, py) => {
    let best, d = 26;
    for (const t of ZEROS) for (const y of [0, lift / 2, lift]) {
      p3.set(0, y, zOf(t)).project(camera);
      const far = Math.hypot((p3.x + 1) / 2 * innerWidth - px, (1 - p3.y) / 2 * innerHeight - py);
      if (p3.z < 1 && far < d) { d = far; best = t; }                         // p3.z > 1 is behind the camera
    }
    return best;
  };

  // light(t) shows the head of the pin at height t in the page's colour for what can be clicked. light() puts it back.
  const act = new THREE.MeshBasicMaterial({ color: ACT, fog: false });
  let hot = -1;
  world.light = t => {
    const k = ZEROS.indexOf(t);
    if (k === hot) return;
    if (hot >= 0) markers[hot].children[1].material = CHECKED[hot] && hot < lit ? glow : dim;
    if (k >= 0) markers[k].children[1].material = act;
    hot = k;
  };

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
  let lift = PIN;                                    // how tall the pins are now: PIN, or RAIL while the survey is up
  const frame = now => {
    rollCall(now - start);
    const to = survey.visible ? RAIL : PIN;
    if (lift !== to) {
      lift = quiet() || Math.abs(to - lift) < 0.004 ? to : lift + (to - lift) * 0.12;
      for (const m of markers) { m.children[0].scale.y = lift / PIN; m.children[1].position.y = lift - PIN; }
    }
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
