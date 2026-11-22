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
