// The numbers behind proof.html: the centered prime sum G(y) used by the announced proof, the band
// that RH forces on it, and the wave that one hypothetical zero off the critical line would add.
//
//   G(y) = sum_{n<=y} Lambda(n) (y/n - 1) - y (log y - 1 - gamma)
//        = log(2 pi) - sum_rho y^rho / (rho (rho - 1)) + O(y^-2)                     (explicit formula)
//
// Under RH, |G(y) - log 2pi| <= (2 + gamma - log 4pi) sqrt(y) + O(y^-2). The definitions follow
// riemann-rev (scripts/rhlib.py), so the numbers can be checked against its facts.json.

export const EULER_GAMMA = 0.5772156649015329;
export const LOG_2PI = Math.log(2 * Math.PI);
export const RH_BAND = 2 + EULER_GAMMA - Math.log(4 * Math.PI); // 0.0461914...

// r(y) = (G(y) - log 2pi) / sqrt(y) at the sorted points ys (all in [1, yMax]), from one sieve pass.
export function normalizedPrimeSum(ys, yMax) {
  const N = Math.floor(yMax);
  const composite = new Uint8Array(N + 1);
  for (let p = 2; p * p <= N; p++) {
    if (composite[p]) continue;
    for (let m = p * p; m <= N; m += p) composite[m] = 1;
  }
  // prime powers p^k with k >= 2 are rare (about 600 up to 10^7): list them, sorted
  const powers = [];
  for (let p = 2; p * p <= N; p++) {
    if (composite[p]) continue;
    for (let q = p * p; q <= N; q *= p) powers.push([q, Math.log(p)]);
  }
  powers.sort((a, b) => a[0] - b[0]);

  const out = new Float64Array(ys.length);
  let s0 = 0, s1 = 0; // sum Lambda(n), sum Lambda(n)/n over n <= current
  let j = 0, k = 0;
  const emit = (y) => {
    const G = y * s1 - s0 - y * Math.log(y) + (1 + EULER_GAMMA) * y;
    return (G - LOG_2PI) / Math.sqrt(y);
  };
  for (let n = 2; n <= N + 1; n++) {
    while (j < ys.length && ys[j] < n) out[j] = emit(ys[j++]);
    if (j === ys.length || n > N) break;
    let lam = 0;
    if (!composite[n]) lam = Math.log(n);
    else if (k < powers.length && powers[k][0] === n) lam = powers[k++][1];
    if (lam) { s0 += lam; s1 += lam / n; }
  }
  while (j < ys.length) out[j] = emit(ys[j++]);
  return out;
}

// Log-spaced sample points.
export function logSpace(a, b, n) {
  const la = Math.log(a), lb = Math.log(b);
  return Float64Array.from({ length: n }, (_, i) => Math.exp(la + ((lb - la) * i) / (n - 1)));
}

// The term a zero pair rho = beta +- i gamma adds to r(y): -2 Re(y^rho / (rho (rho - 1))) / sqrt(y).
// Its size grows like y^(beta - 1/2) / |rho|^2.
export function rogueWave(y, beta, gamma) {
  const L = Math.log(y);
  const m = Math.exp((beta - 0.5) * L); // y^beta / sqrt(y)
  const nr = m * Math.cos(gamma * L), ni = m * Math.sin(gamma * L);
  // rho (rho - 1) = (beta + i g)(beta - 1 + i g)
  const dr = beta * (beta - 1) - gamma * gamma, di = gamma * (2 * beta - 1);
  const d = dr * dr + di * di;
  return (-2 * (nr * dr + ni * di)) / d;
}

// Rough envelope of the rogue wave: 2 y^(beta - 1/2) / |rho (rho - 1)|.
export function rogueAmplitude(y, beta, gamma) {
  const dr = beta * (beta - 1) - gamma * gamma, di = gamma * (2 * beta - 1);
  return (2 * Math.exp((beta - 0.5) * Math.log(y))) / Math.hypot(dr, di);
}

// Smallest y >= y0 where the envelope of the rogue wave reaches the band, or Infinity if beta = 1/2.
export function breachPoint(beta, gamma) {
  if (beta <= 0.5) return Infinity;
  const dr = beta * (beta - 1) - gamma * gamma, di = gamma * (2 * beta - 1);
  return Math.exp(Math.log((RH_BAND * Math.hypot(dr, di)) / 2) / (beta - 0.5));
}

// ---- Step 4: the quadratic character of an imaginary quadratic field -------------------
//
// For K = Q(sqrt(-d)) with fundamental discriminant D < 0, chi_D(p) = (D/p) (Kronecker symbol) is
// +1 if p splits in K, -1 if p stays inert, 0 if p ramifies (p | D). It is completely multiplicative.

export const FIELDS = [
  { D: -3, name: 'ℚ(√−3)' }, { D: -4, name: 'ℚ(i)' }, { D: -7, name: 'ℚ(√−7)' }, { D: -8, name: 'ℚ(√−2)' },
  { D: -11, name: 'ℚ(√−11)' }, { D: -19, name: 'ℚ(√−19)' }, { D: -43, name: 'ℚ(√−43)' },
  { D: -67, name: 'ℚ(√−67)' }, { D: -163, name: 'ℚ(√−163)' },
];

function powmod(b, e, m) {
  let r = 1; b %= m; if (b < 0) b += m;
  while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; }
  return r;
}

// (D/p) for a prime p.
export function kroneckerPrime(D, p) {
  if (p === 2) {
    if (D % 2 === 0) return 0;
    const r = ((D % 8) + 8) % 8;
    return r === 1 || r === 7 ? 1 : -1;
  }
  if (D % p === 0) return 0;
  return powmod(D, (p - 1) / 2, p) === 1 ? 1 : -1;
}

// chi_D(n) for 0 <= n < |D|, as {re, im} values (the format dirichlet.js uses).
export function quadraticChiValues(D) {
  const q = Math.abs(D);
  const vals = [];
  for (let n = 0; n < q; n++) {
    if (n === 0) { vals.push({ re: 0, im: 0 }); continue; }
    let m = n, v = 1;
    for (let p = 2; p <= m; p++) {
      while (m % p === 0) { v *= kroneckerPrime(D, p); m /= p; }
    }
    vals.push({ re: v, im: 0 });
  }
  return vals;
}

// ASK(a) and MAIN(a) with equal weights w = 1 (so the average of log w is 0):
//   ASK(a)  = sum_{n<=a} Lambda(n) (1 - chi(n)) (a/n - 1)       (divisibility gained, at inert primes)
//   MAIN(a) = a (log a - 1 - gamma + L'/L(1, chi))               (its expected size)
// and ASK - MAIN = G(a) - g_chi(a), with g_chi(a) = sum Lambda(n) chi(n) (a/n - 1) + a L'/L(1, chi).
export function askMain(D, as, aMax, logDeriv) {
  const N = Math.floor(aMax);
  const composite = new Uint8Array(N + 1);
  for (let p = 2; p * p <= N; p++) {
    if (composite[p]) continue;
    for (let m = p * p; m <= N; m += p) composite[m] = 1;
  }
  const chiP = new Map(); // chi at small primes, for prime powers
  const powers = [];
  for (let p = 2; p * p <= N; p++) {
    if (composite[p]) continue;
    chiP.set(p, kroneckerPrime(D, p));
    let k = 2;
    for (let q = p * p; q <= N; q *= p, k++) powers.push([q, p, k]);
  }
  powers.sort((x, y) => x[0] - y[0]);
  const ask = new Float64Array(as.length), main = new Float64Array(as.length);
  let s0 = 0, s1 = 0; // sums of Lambda(n)(1 - chi(n)) and Lambda(n)(1 - chi(n))/n
  let j = 0, k = 0;
  const emit = (a) => {
    ask[j] = a * s1 - s0;
    main[j] = a * (Math.log(a) - 1 - EULER_GAMMA + logDeriv);
    j++;
  };
  for (let n = 2; n <= N + 1; n++) {
    while (j < as.length && as[j] < n) emit(as[j]);
    if (j === as.length || n > N) break;
    let lam = 0, c = 0;
    if (!composite[n]) { lam = Math.log(n); c = kroneckerPrime(D, n); }
    else if (k < powers.length && powers[k][0] === n) {
      const [, p, e] = powers[k++];
      lam = Math.log(p); c = chiP.get(p) ** e;
    }
    if (lam) { const wgt = lam * (1 - c); s0 += wgt; s1 += wgt / n; }
  }
  while (j < as.length) emit(as[j]);
  return { ask, main };
}
