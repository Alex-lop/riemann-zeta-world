// Primes from zeros: Chebyshev's psi(x) and Riemann's explicit formula.
//
//   psi(x) = sum over prime powers p^k <= x of log p          (jumps by log p at each p^k)
//
//   psi(x) = x - sum_rho x^rho / rho - log(2 pi) - 1/2 log(1 - x^-2)      (x > 1, not a prime power)
//
// The sum runs over the nontrivial zeros rho, paired with their conjugates. For rho = 1/2 + i gamma,
//   x^rho/rho + conj = 2 sqrt(x) (cos(gamma ln x)/2 + gamma sin(gamma ln x)) / (1/4 + gamma^2).
// The terms: x comes from the pole of zeta at s = 1, log(2 pi) = zeta'(0)/zeta(0), and the last
// term is the sum over the trivial zeros -2, -4, ...

// Jump points of psi up to xMax: [{ x: p^k, p, log: ln p }], sorted by x.
export function primePowerJumps(xMax) {
  const n = Math.floor(xMax);
  const composite = new Uint8Array(n + 1);
  const jumps = [];
  for (let p = 2; p <= n; p++) {
    if (composite[p]) continue;
    for (let m = p * p; m <= n; m += p) composite[m] = 1;
    for (let q = p; q <= n; q *= p) jumps.push({ x: q, p, log: Math.log(p) });
  }
  jumps.sort((a, b) => a.x - b.x);
  let sum = 0;
  for (const j of jumps) j.psi = (sum += j.log); // psi just after the jump
  return jumps;
}

// Exact psi(x) from the jump list (right-continuous).
export function psiExact(x, jumps) {
  let lo = 0, hi = jumps.length; // first index with jumps[i].x > x
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (jumps[mid].x <= x) lo = mid + 1; else hi = mid;
  }
  return lo === 0 ? 0 : jumps[lo - 1].psi;
}

// The wave contributed by the zero pair 1/2 +- i gamma: -(x^rho/rho + conj).
export function zeroWave(x, gamma) {
  const L = Math.log(x);
  return (-2 * Math.sqrt(x) * (0.5 * Math.cos(gamma * L) + gamma * Math.sin(gamma * L))) / (0.25 + gamma * gamma);
}

// The smooth part: x - log(2 pi) - 1/2 log(1 - x^-2).
export function psiMain(x) {
  return x - Math.log(2 * Math.PI) - 0.5 * Math.log(1 - 1 / (x * x));
}

// Explicit formula truncated to the first n zeros (gammas sorted ascending).
export function psiExplicit(x, gammas, n) {
  let s = psiMain(x);
  for (let k = 0; k < n; k++) s += zeroWave(x, gammas[k]);
  return s;
}
