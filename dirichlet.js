// Dirichlet L-functions L(s, chi) for primitive characters of small modulus, in double precision.
//
//   L(s, chi) = sum_{n>=1} chi(n) n^-s = q^-s sum_{a=1}^{q} chi(a) zeta(s, a/q)        (Hurwitz zeta)
//
// We sum the first q*N terms directly and add the Hurwitz tails zeta(s, N + a/q) by Euler–Maclaurin,
// which is valid for every s, including Re s < 0. The completed function is
//
//   Lambda(s, chi) = (q/pi)^((s+a)/2) Gamma((s+a)/2) L(s, chi),   a = 0 (even chi) or 1 (odd chi),
//   Lambda(s, chi) = eps(chi) Lambda(1-s, conj chi),               eps = tau(chi) / (i^a sqrt q).

import { logGamma } from './zeta.js';

const TAU = 2 * Math.PI;

// ---- Characters -------------------------------------------------------------------

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function factor(n) {
  const f = [];
  for (let p = 2; p * p <= n; p++) {
    if (n % p) continue;
    let e = 0;
    while (n % p === 0) { n /= p; e++; }
    f.push([p, e]);
  }
  if (n > 1) f.push([n, 1]);
  return f;
}

// Generators (with orders) of (Z/mZ)* for a prime power m = p^e.
function generators(p, e) {
  const m = p ** e;
  if (p === 2) {
    if (e === 1) return [];
    if (e === 2) return [{ g: 3, ord: 2 }];
    return [{ g: m - 1, ord: 2 }, { g: 5, ord: m / 4 }];
  }
  const phi = m - m / p;
  for (let g = 2; g < m; g++) {
    if (g % p === 0) continue;
    let x = 1, k = 0;
    do { x = (x * g) % m; k++; } while (x !== 1);
    if (k === phi) return [{ g, ord: phi }];
  }
  throw new Error('no primitive root');
}

// All characters mod q, as arrays of q complex values {re, im} (index = residue, chi(0..q-1)).
function allCharacters(q) {
  const parts = factor(q).map(([p, e]) => {
    const m = p ** e;
    const gens = generators(p, e);
    // discrete logs: residue mod m -> exponent vector
    const logs = new Map([[1 % m, gens.map(() => 0)]]);
    let frontier = [[1 % m, gens.map(() => 0)]];
    gens.forEach((G, i) => {
      const next = [];
      for (const [x, v] of frontier) {
        let y = x;
        for (let j = 0; j < G.ord; j++) {
          const w = v.slice(); w[i] = j;
          logs.set(y, w); next.push([y, w]);
          y = (y * G.g) % m;
        }
      }
      frontier = next;
    });
    return { m, gens, logs };
  });
  // a character is a choice of exponent k_i for every generator of every part
  const choices = parts.flatMap((P, pi) => P.gens.map((G, gi) => ({ pi, gi, ord: G.ord })));
  const chars = [];
  const ks = choices.map(() => 0);
  for (;;) {
    const vals = [];
    for (let a = 0; a < q; a++) {
      if (gcd(a, q) !== 1) { vals.push({ re: 0, im: 0 }); continue; }
      let ph = 0;
      choices.forEach((c, i) => {
        const P = parts[c.pi];
        ph += (ks[i] * P.logs.get(a % P.m)[c.gi]) / c.ord;
      });
      vals.push({ re: Math.cos(TAU * ph), im: Math.sin(TAU * ph) });
    }
    chars.push(vals);
    let i = 0;
    while (i < ks.length && ++ks[i] === choices[i].ord) ks[i++] = 0;
    if (i === ks.length) break;
  }
  return chars;
}

const near1 = (z) => Math.abs(z.re - 1) < 1e-9 && Math.abs(z.im) < 1e-9;

// chi is primitive if no proper divisor d of q has chi(a) = 1 for all a = 1 mod d coprime to q.
function isPrimitive(vals, q) {
  for (let d = 1; d < q; d++) {
    if (q % d) continue;
    let induced = true;
    for (let a = 1; a < q && induced; a++) if (gcd(a, q) === 1 && (a - 1) % d === 0 && !near1(vals[a])) induced = false;
    if (induced) return false;
  }
  return true;
}

function describe(vals, q) {
  const odd = vals[q - 1].re < 0;
  const real = vals.every((z) => Math.abs(z.im) < 1e-9);
  let order = 1;
  for (; order <= q; order++) {
    if (vals.every((z, a) => gcd(a, q) !== 1 || near1(cpow(z, order)))) break;
  }
  // Gauss sum and root number
  let tr = 0, ti = 0;
  for (let a = 1; a < q; a++) {
    const c = Math.cos((TAU * a) / q), s = Math.sin((TAU * a) / q);
    tr += vals[a].re * c - vals[a].im * s;
    ti += vals[a].re * s + vals[a].im * c;
  }
  // eps = tau / (i^a sqrt q)
  let er = tr / Math.sqrt(q), ei = ti / Math.sqrt(q);
  if (odd) [er, ei] = [ei, -er]; // divide by i
  return { odd, parity: odd ? 1 : 0, real, order, eps: { re: er, im: ei } };
}

function cpow(z, n) {
  let r = { re: 1, im: 0 };
  for (let i = 0; i < n; i++) r = { re: r.re * z.re - r.im * z.im, im: r.re * z.im + r.im * z.re };
  return r;
}

// Primitive characters mod q, each { q, index, values, odd, parity, real, order, eps, label, conjIndex }.
export function primitiveCharacters(q) {
  const list = allCharacters(q)
    .filter((v) => isPrimitive(v, q))
    .map((values) => ({ q, values, ...describe(values, q) }));
  // order: real first, then by order, then by the phase of chi at the smallest generator-ish residue
  const key = (c) => {
    const a = c.values.findIndex((z, i) => i > 1 && gcd(i, q) === 1 && !near1(z));
    const ph = a < 0 ? 0 : (Math.atan2(c.values[a].im, c.values[a].re) + TAU) % TAU;
    return [c.real ? 0 : 1, c.order, ph];
  };
  list.sort((x, y) => { const a = key(x), b = key(y); return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; });
  list.forEach((c, i) => {
    c.index = i + 1;
    c.label = c.real
      ? `(${c.odd ? '−' : ''}${q}/·), real, ${c.odd ? 'odd' : 'even'}`
      : `#${i + 1}, order ${c.order}, ${c.odd ? 'odd' : 'even'}, complex`;
  });
  list.forEach((c) => {
    c.conjIndex = list.find((d) => d.values.every((z, a) => Math.abs(z.re - c.values[a].re) < 1e-9 && Math.abs(z.im + c.values[a].im) < 1e-9)).index;
  });
  return list;
}

// Moduli up to qMax that have primitive characters (q = 2 mod 4 has none).
export function moduliWithPrimitive(qMax) {
  const out = [];
  for (let q = 3; q <= qMax; q++) if (q % 4 !== 2) out.push(q);
  return out;
}

// ---- L(s, chi) -------------------------------------------------------------------

// B_2k / (2k)!
const BERN = [1 / 6, -1 / 30, 1 / 42, -1 / 30, 5 / 66, -691 / 2730, 7 / 6, -3617 / 510, 43867 / 798, -174611 / 330];
export const EM_COEF = BERN.map((b, k) => { let f = 1; for (let i = 2; i <= 2 * k + 2; i++) f *= i; return b / f; });

// Direct-sum length N (per residue class) for a given |t|; the Hurwitz tails start at x = N + a/q.
export const directTerms = (tAbs) => Math.ceil(tAbs / 2) + 8;

// Hurwitz tail zeta(s, x) without the 1/(s-1) pole part: returns { pole, rest } where
//   zeta(s, x) = pole / (s - 1) + rest, pole = x^(1-s).
// For non-principal chi the sum over a of chi(a) x^(1-s)/(s-1) is finite at s = 1; see lChi.
function hurwitzTail(sg, t, x, M) {
  const L = Math.log(x);
  const m = Math.exp(-sg * L), c = Math.cos(t * L), sn = Math.sin(t * L);
  const xr = m * c, xi = -m * sn; // x^-s
  let rr = 0.5 * xr, ri = 0.5 * xi;
  // sum_k EM_COEF[k] (s)_{2k+1} x^(-s-2k-1)
  let pr = sg, pi = t;               // (s)_1 = s
  let xp = 1 / x;                     // x^(-1-2k)
  for (let k = 0; k < M; k++) {
    const tr = pr * xr - pi * xi, ti = pr * xi + pi * xr;
    rr += EM_COEF[k] * xp * tr;
    ri += EM_COEF[k] * xp * ti;
    // (s)_{2k+3} = (s)_{2k+1} (s + 2k + 1)(s + 2k + 2)
    const a1r = sg + 2 * k + 1, a2r = sg + 2 * k + 2;
    const mr = a1r * a2r - t * t, mi = t * (a1r + a2r);
    [pr, pi] = [pr * mr - pi * mi, pr * mi + pi * mr];
    xp /= x * x;
  }
  return { L, rest: { re: rr, im: ri } };
}

// (x^(1-s) - 1)/(s - 1) = -L (e^w - 1)/w with w = (1-s) L, stable near s = 1.
function poleDiff(sg, t, L) {
  const wr = (1 - sg) * L, wi = -t * L;
  let fr, fi; // (e^w - 1)/w
  if (wr * wr + wi * wi < 1e-6) {
    fr = 1 + wr / 2 + (wr * wr - wi * wi) / 6;
    fi = wi / 2 + (2 * wr * wi) / 6;
  } else {
    const e = Math.exp(wr);
    const nr = e * Math.cos(wi) - 1, ni = e * Math.sin(wi);
    const d = wr * wr + wi * wi;
    fr = (nr * wr + ni * wi) / d;
    fi = (ni * wr - nr * wi) / d;
  }
  return { re: -L * fr, im: -L * fi };
}

// L(sigma + i t, chi) for a non-principal character chi (values array of length q).
export function lChi(chi, sg, t, N = directTerms(Math.abs(t)), M = 10) {
  const q = chi.length;
  let sr = 0, si = 0;
  for (let n = 1; n <= q * N; n++) {
    const c = chi[n % q];
    if (!c.re && !c.im) continue;
    const L = Math.log(n), m = Math.exp(-sg * L);
    const vr = m * Math.cos(t * L), vi = -m * Math.sin(t * L);
    sr += c.re * vr - c.im * vi;
    si += c.re * vi + c.im * vr;
  }
  // tails: q^-s sum_a chi(a) zeta(s, N + a/q); the pole parts use sum chi(a) = 0
  let tr = 0, ti = 0;
  for (let a = 1; a < q; a++) {
    const c = chi[a];
    if (!c.re && !c.im) continue;
    const { L, rest } = hurwitzTail(sg, t, N + a / q, M);
    const p = poleDiff(sg, t, L);
    const vr = rest.re + p.re, vi = rest.im + p.im;
    tr += c.re * vr - c.im * vi;
    ti += c.re * vi + c.im * vr;
  }
  const Lq = Math.log(q), mq = Math.exp(-sg * Lq);
  const qr = mq * Math.cos(t * Lq), qi = -mq * Math.sin(t * Lq);
  return { re: sr + qr * tr - qi * ti, im: si + qr * ti + qi * tr };
}

// log of the completing factor (q/pi)^((s+a)/2) Gamma((s+a)/2).
export function lambdaLogFactor(q, parity, sg, t) {
  const zr = (sg + parity) / 2, zi = t / 2;
  const g = logGamma(zr, zi);
  const lq = Math.log(q / Math.PI);
  return { re: g.re + zr * lq, im: g.im + zi * lq };
}

// Lambda(s, chi) divided by its size N(t) on the critical line and rotated by eps^(-1/2):
// real on sigma = 1/2, |value| = |L| there, and value(1 - conj s) = conj value(s).
export function lambdaScaled(ch, sg, t) {
  // Gamma((s+a)/2) has a pole where L has its trivial zero (s = -a); step off it.
  if (Math.abs(sg + ch.parity) < 1e-6 && Math.abs(t) < 1e-6) sg += 1e-6;
  const l = lChi(ch.values, sg, t);
  const g = lambdaLogFactor(ch.q, ch.parity, sg, t);
  const g0 = lambdaLogFactor(ch.q, ch.parity, 0.5, t);
  const ph = g.im - Math.atan2(ch.eps.im, ch.eps.re) / 2;
  const m = Math.exp(g.re - g0.re);
  const c = m * Math.cos(ph), s = m * Math.sin(ph);
  return { re: l.re * c - l.im * s, im: l.re * s + l.im * c };
}

// Zeros 1/2 + i t of L(s, chi) with tLo <= t <= tHi, from sign changes of the real function
// Z_chi(t) = lambdaScaled(1/2 + it).
export function lZeros(ch, tLo, tHi, step = 0.04) {
  const Z = (t) => lambdaScaled(ch, 0.5, t).re;
  const out = [];
  let t0 = tLo, z0 = Z(t0);
  for (let t1 = tLo + step; t1 <= tHi + 1e-9; t1 += step) {
    const z1 = Z(t1);
    if (Math.sign(z0) !== Math.sign(z1)) {
      let a = t0, b = t1, fa = z0;
      for (let i = 0; i < 50; i++) {
        const mid = (a + b) / 2, fm = Z(mid);
        if (Math.sign(fm) === Math.sign(fa)) { a = mid; fa = fm; } else b = mid;
      }
      out.push((a + b) / 2);
    }
    t0 = t1; z0 = z1;
  }
  return out;
}
