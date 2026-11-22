// Riemann zeta in double precision, valid in the critical strip.
//
// The series sum 1/n^s only converges for Re(s) > 1, so we use the
// alternating (Dirichlet eta) series, accelerated with Borwein's algorithm:
//
//   eta(s)  = sum_{k>=0} (-1)^k / (k+1)^s          (converges for Re(s) > 0)
//   zeta(s) = eta(s) / (1 - 2^(1-s))
//
// Borwein replaces the slowly converging tail with fixed weights w_k so that
// n terms give an error of roughly (1+2|t|) e^(pi|t|/2) / (3+sqrt 8)^n.
// That means the number of terms has to grow with |t|; see termsFor().

const LN2 = Math.LN2;

// Number of Borwein terms for ~1e-12 accuracy up to height |t|.
export function termsFor(tAbs) {
  const need = (Math.PI * tAbs) / 2 + Math.log(1 + 2 * tAbs) + 28;
  return Math.ceil(need / Math.log(3 + Math.sqrt(8)));
}

const weightCache = new Map();

// w_k = (-1)^k (1 - d_k / d_n), with
// d_k = n * sum_{i=0}^{k} (n+i-1)! 4^i / ((n-i)! (2i)!)
export function borweinWeights(n) {
  if (weightCache.has(n)) return weightCache.get(n);
  const d = new Float64Array(n + 1);
  let a = 1 / n; // i = 0 term: (n-1)!/n!
  let sum = a;
  d[0] = n * sum;
  for (let i = 0; i < n; i++) {
    a *= (4 * (n + i) * (n - i)) / ((2 * i + 1) * (2 * i + 2));
    sum += a;
    d[i + 1] = n * sum;
  }
  const w = new Float64Array(n);
  for (let k = 0; k < n; k++) w[k] = (k % 2 ? -1 : 1) * (1 - d[k] / d[n]);
  weightCache.set(n, w);
  return w;
}

// eta(sigma + i t) -> { re, im }, the Borwein-weighted alternating sum.
export function eta(sigma, t, n = termsFor(Math.abs(t))) {
  const w = borweinWeights(n);
  let er = 0;
  let ei = 0;
  for (let k = 0; k < n; k++) {
    const L = Math.log(k + 1);
    const m = w[k] * Math.exp(-sigma * L);
    const ang = t * L;
    er += m * Math.cos(ang);
    ei -= m * Math.sin(ang);
  }
  return { re: er, im: ei };
}

// zeta(sigma + i t) -> { re, im }. Pass n to fix the number of terms.
export function zeta(sigma, t, n = termsFor(Math.abs(t))) {
  const { re: er, im: ei } = eta(sigma, t, n);
  // denominator 1 - 2^(1-s)
  const m2 = Math.exp((1 - sigma) * LN2);
  const a2 = t * LN2;
  const dr = 1 - m2 * Math.cos(a2);
  const di = m2 * Math.sin(a2);
  const dd = dr * dr + di * di;
  return { re: (er * dr + ei * di) / dd, im: (ei * dr - er * di) / dd };
}

// ---- The completed zeta function xi(s) ------------------------------------------
//
//   xi(s) = 1/2 s (s-1) pi^(-s/2) Gamma(s/2) zeta(s) = (s-1) zeta(s) * pi^(-s/2) Gamma(s/2 + 1)
//
// The second form (using s/2 Gamma(s/2) = Gamma(s/2 + 1)) avoids the pole of Gamma at s = 0,
// and (s-1) zeta(s) = eta(s) (s-1)/(1 - 2^(1-s)) has a finite limit at s = 1.

const LN_PI = Math.log(Math.PI);
const HALF_LN_2PI = 0.5 * Math.log(2 * Math.PI);
const GAMMA_SHIFT = 8;

// log Gamma(z) for Re z > 0, via Gamma(z) = Gamma(z + 8) / (z (z+1) ... (z+7)) and Stirling at z + 8.
// Only exp() of the result is used, so the branch of the imaginary part does not matter.
export function logGamma(re, im) {
  let sr = 0, si = 0;
  for (let k = 0; k < GAMMA_SHIFT; k++) {
    sr += 0.5 * Math.log((re + k) ** 2 + im * im);
    si += Math.atan2(im, re + k);
  }
  const wr = re + GAMMA_SHIFT, wi = im;
  const lr = 0.5 * Math.log(wr * wr + wi * wi), li = Math.atan2(wi, wr);
  // (w - 1/2) log w - w + 1/2 log(2 pi)
  let gr = (wr - 0.5) * lr - wi * li - wr + HALF_LN_2PI;
  let gi = (wr - 0.5) * li + wi * lr - wi;
  // + 1/(12 w) - 1/(360 w^3) + 1/(1260 w^5)
  const d = wr * wr + wi * wi;
  const ir = wr / d, ii = -wi / d;              // 1/w
  const i2r = ir * ir - ii * ii, i2i = 2 * ir * ii; // 1/w^2
  // series in 1/w^2: c0 + c1 u + c2 u^2 with u = 1/w^2, then times 1/w
  const c0 = 1 / 12, c1 = -1 / 360, c2 = 1 / 1260;
  let pr = c1 + c2 * i2r, pi = c2 * i2i;
  [pr, pi] = [pr * i2r - pi * i2i + c0, pr * i2i + pi * i2r];
  gr += pr * ir - pi * ii;
  gi += pr * ii + pi * ir;
  return { re: gr - sr, im: gi - si };
}

// G(s) = log( pi^(-s/2) Gamma(s/2 + 1) ), so xi(s) = (s-1) zeta(s) e^G(s).
export function xiLogFactor(sigma, t) {
  const g = logGamma(sigma / 2 + 1, t / 2);
  return { re: g.re - (sigma / 2) * LN_PI, im: g.im - (t / 2) * LN_PI };
}

// (s-1) zeta(s), finite at s = 1 (limit 1).
export function sm1Zeta(sigma, t, n = termsFor(Math.abs(t))) {
  const e = eta(sigma, t, n);
  // r = (s-1) / (1 - 2^(1-s))
  const ar = sigma - 1, ai = t;
  let rr, ri;
  if (ar * ar + ai * ai < 1e-12) {
    rr = 1 / LN2; ri = 0; // limit; the next term is (s-1)/2, below 1e-6 here
  } else {
    const m2 = Math.exp((1 - sigma) * LN2);
    const a2 = t * LN2;
    const dr = 1 - m2 * Math.cos(a2), di = m2 * Math.sin(a2);
    const dd = dr * dr + di * di;
    rr = (ar * dr + ai * di) / dd;
    ri = (ai * dr - ar * di) / dd;
  }
  return { re: e.re * rr - e.im * ri, im: e.re * ri + e.im * rr };
}

// xi(sigma + i t), unscaled. It is tiny for large t: about e^(-pi t / 4).
export function xi(sigma, t) {
  const p = sm1Zeta(sigma, t);
  const g = xiLogFactor(sigma, t);
  const m = Math.exp(g.re), c = Math.cos(g.im) * m, s = Math.sin(g.im) * m;
  return { re: p.re * c - p.im * s, im: p.re * s + p.im * c };
}

// xi(s) divided by N(t) = |(s-1) e^G(s)| at s = 1/2 + it, a positive number that depends only on t.
// Dividing by it keeps the zeros, the phase and the mirror symmetry, and on the critical line
// |xiScaled| = |zeta| (in fact xiScaled(1/2 + it) = -Z(t), Hardy's function).
export function xiScaled(sigma, t) {
  const p = sm1Zeta(sigma, t);
  const g = xiLogFactor(sigma, t);
  const g0 = xiLogFactor(0.5, t);
  const m = Math.exp(g.re - g0.re) / Math.hypot(0.5, t);
  const c = Math.cos(g.im) * m, s = Math.sin(g.im) * m;
  return { re: p.re * c - p.im * s, im: p.re * s + p.im * c };
}

// Riemann–Siegel theta(t) = arg Gamma(1/4 + it/2) - (t/2) ln pi (asymptotic, good for t > ~3).
export function theta(t) {
  return (
    (t / 2) * Math.log(t / (2 * Math.PI)) -
    t / 2 -
    Math.PI / 8 +
    1 / (48 * t) +
    7 / (5760 * t ** 3)
  );
}

// Hardy Z(t) = e^{i theta(t)} zeta(1/2 + it) is real; its sign changes are the zeros on the critical line.
export function hardyZ(t) {
  const { re, im } = zeta(0.5, t);
  const th = theta(t);
  return re * Math.cos(th) - im * Math.sin(th);
}

// Find the zeros 1/2 + i t with 0 < t <= tMax by scanning Z(t) for sign changes and refining.
// Note: a pair of zeros closer than `step` would be missed; at these heights the closest pairs are ~0.7 apart.
export function criticalZeros(tMax, step = 0.05) {
  const zeros = [];
  let t0 = 10;
  let z0 = hardyZ(t0);
  for (let t1 = t0 + step; t1 <= tMax; t1 += step) {
    const z1 = hardyZ(t1);
    if (z0 === 0 || Math.sign(z0) !== Math.sign(z1)) {
      let a = t0, b = t1, fa = z0;
      for (let i = 0; i < 60; i++) {
        const m = (a + b) / 2;
        const fm = hardyZ(m);
        if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
      }
      zeros.push((a + b) / 2);
    }
    t0 = t1;
    z0 = z1;
  }
  return zeros;
}
