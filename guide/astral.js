import * as THREE from 'three';

// The sky of Zeta World: a nebula, stars that twinkle, and now and then a shooting star. It is scenery and stands for nothing,
// so it keeps clear of the page's four colours that mean something (gold, blue, red, mint).
// makeSky() returns { group, update }. Add the group to a scene and call update(seconds, camera) every frame: the group rides
// with the camera, so the sky is always infinitely far away. `seconds` is the caller's clock, which stops while motion is paused.

const R = 700;                                       // the sky's radius. The camera's far plane must be beyond it
const BAND = new THREE.Vector3(0.42, 0.9, 0).normalize();   // the bright band is the great circle with this normal: it passes
                                                            // through due north, where the line leads, and falls away to the east
const GROUND = 0x0d1117, VIOLET = 0x2b1f5c, TEAL = 0x0c3340, ROSE = 0x4a2148;

const NOISE = `
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }`;

export function makeSky({ stars = 3600 } = {}) {
  const group = new THREE.Group(), clock = { value: 0 };
  const far = { depthWrite: false, depthTest: false, fog: false };   // behind everything, whatever is drawn

  // The nebula: clouds of noise, warped by more noise, brightest along the band. It drifts too slowly to see move.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24), new THREE.ShaderMaterial({
    ...far, side: THREE.BackSide,
    uniforms: { uTime: clock, uBand: { value: BAND }, uGround: { value: new THREE.Color(GROUND) }, uA: { value: new THREE.Color(VIOLET) }, uB: { value: new THREE.Color(TEAL) }, uC: { value: new THREE.Color(ROSE) } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uTime; uniform vec3 uBand, uGround, uA, uB, uC; varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float off = dot(d, uBand), band = exp(-off * off / 0.09);
        vec3 q = d * 2.3 + vec3(0.0, uTime * 0.003, 0.0);
        float n1 = fbm(q), n2 = fbm(q * 2.1 + n1 * 1.9 + 3.0);
        vec3 col = uGround;
        col += uA * smoothstep(0.38, 0.8, n2) * (0.3 + 1.1 * band);
        col += uB * smoothstep(0.42, 0.85, n1) * (0.5 + 0.5 * band);
        col += uC * band * band * smoothstep(0.3, 0.75, n2 * n1 * 2.2);
        float north = 1.0 - dot(d, normalize(vec3(0.0, 0.02, -1.0)));           // a far light due north, where the line leads
        col += vec3(1.0, 0.86, 0.66) * (0.6 * exp(-north * 260.0) + 0.17 * exp(-north * 42.0) + 0.04 * exp(-north * 7.0));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  dome.renderOrder = -3;

  // The stars: more of them along the band, most of them faint, a few large. Each twinkles at its own pace.
  const at = new Float32Array(stars * 3), size = new Float32Array(stars), phase = new Float32Array(stars), tint = new Float32Array(stars * 3);
  const v = new THREE.Vector3(), c = new THREE.Color();
  for (let k = 0; k < stars; k++) {
    do v.randomDirection(); while (Math.random() > 0.3 + 0.7 * Math.exp(-(v.dot(BAND) ** 2) / 0.06));
    v.multiplyScalar(R * 0.95).toArray(at, k * 3);
    const big = Math.random() ** 7;
    size[k] = 1.1 + 3.4 * big; phase[k] = Math.random();
    c.setHSL([0.6, 0.62, 0.08, 0.72][k % 4], 0.5 * Math.random(), 0.72 + 0.2 * Math.random()).multiplyScalar(0.35 + 0.65 * Math.max(big, Math.random() ** 2)).toArray(tint, k * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(at, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1)); geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  const dpr = { value: Math.min(devicePixelRatio, 2) };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    ...far, transparent: true, blending: THREE.AdditiveBlending, uniforms: { uTime: clock, uDpr: dpr },
    vertexShader: `
      attribute float aSize, aPhase; attribute vec3 aTint; uniform float uTime, uDpr; varying vec3 vTint;
      void main() {
        vTint = aTint * (0.7 + 0.3 * sin(uTime * (0.5 + 2.2 * fract(aPhase * 7.13)) + aPhase * 6.2832));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uDpr;
      }`,
    fragmentShader: `
      varying vec3 vTint;
      void main() {
        float a = smoothstep(1.0, 0.0, length(gl_PointCoord - 0.5) * 2.0);
        gl_FragColor = vec4(vTint * a * a, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  points.renderOrder = -2; points.frustumCulled = false;

  // A shooting star: one line, bright at its head and nothing at its tail, that crosses a little of the sky in under a second.
  const streak = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)).setAttribute('color', new THREE.BufferAttribute(new Float32Array(6), 3)),
    new THREE.LineBasicMaterial({ ...far, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending }));
  streak.renderOrder = -1; streak.frustumCulled = false; streak.visible = false;
  const from = new THREE.Vector3(), along = new THREE.Vector3(), P = streak.geometry.attributes.position, C = streak.geometry.attributes.color;
  let next = 3, born = -1;                            // when the next one starts, and when the one in flight did

  group.add(dome, points, streak);
  return {
    group,
    update(seconds, camera) {
      clock.value = seconds;
      group.position.copy(camera.position);
      points.rotation.y = seconds * 0.0015;           // the stars wheel round, a turn in about an hour
      if (born < 0 && seconds > next) {               // start one somewhere in the northern sky, heading any way across it
        born = seconds;
        from.set(Math.random() * 2 - 1, Math.random() * 1.1 - 0.6, -0.4 - Math.random()).normalize();
        along.randomDirection().cross(from).normalize();
      }
      if (born >= 0) {
        const u = (seconds - born) / 0.8, glow = Math.sin(Math.PI * Math.min(u, 1));
        v.copy(from).addScaledVector(along, 0.3 * u).normalize().multiplyScalar(R * 0.9).toArray(P.array, 0);
        v.copy(from).addScaledVector(along, 0.3 * Math.max(0, u - 0.3)).normalize().multiplyScalar(R * 0.9).toArray(P.array, 3);
        C.array.fill(glow, 0, 3); P.needsUpdate = C.needsUpdate = true;
        streak.visible = u < 1;
        if (u >= 1) { born = -1; next = seconds + 4 + 7 * Math.random(); }
      }
    },
  };
}
