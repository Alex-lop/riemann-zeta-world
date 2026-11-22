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

// zeta(sigma + i t) -> { re, im }. Pass n to fix the number of terms.
export function zeta(sigma, t, n = termsFor(Math.abs(t))) {
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
  // denominator 1 - 2^(1-s)
  const m2 = Math.exp((1 - sigma) * LN2);
  const a2 = t * LN2;
  const dr = 1 - m2 * Math.cos(a2);
  const di = m2 * Math.sin(a2);
  const dd = dr * dr + di * di;
  return { re: (er * dr + ei * di) / dd, im: (ei * dr - er * di) / dd };
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
