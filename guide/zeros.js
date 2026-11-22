// The one copy of the zeros, and of zetaGrid, the function they are zeros of. This module has no imports, so the intro and
// the first steps can use both before three.js is fetched.

// Heights (imaginary parts) of the first 100 nontrivial zeros, from mpmath.zetazero.
export const ZEROS = [
  14.134725, 21.022040, 25.010858, 30.424876, 32.935062, 37.586178, 40.918719, 43.327073, 48.005151, 49.773832,
  52.970321, 56.446248, 59.347044, 60.831779, 65.112544, 67.079811, 69.546402, 72.067158, 75.704691, 77.144840,
  79.337375, 82.910381, 84.735493, 87.425275, 88.809111, 92.491899, 94.651344, 95.870634, 98.831194, 101.317851,
  103.725538, 105.446623, 107.168611, 111.029536, 111.874659, 114.320221, 116.226680, 118.790783, 121.370125, 122.946829,
  124.256819, 127.516684, 129.578704, 131.087689, 133.497737, 134.756510, 138.116042, 139.736209, 141.123707, 143.111846,
  146.000982, 147.422765, 150.053520, 150.925258, 153.024694, 156.112909, 157.597592, 158.849988, 161.188964, 163.030710,
  165.537069, 167.184440, 169.094515, 169.911976, 173.411537, 174.754192, 176.441434, 178.377408, 179.916484, 182.207078,
  184.874468, 185.598784, 187.228923, 189.416159, 192.026656, 193.079727, 195.265397, 196.876482, 198.015310, 201.264752,
  202.493595, 204.189672, 205.394697, 207.906259, 209.576510, 211.690863, 213.347919, 214.547045, 216.169539, 219.067596,
  220.714919, 221.430706, 224.007000, 224.983325, 227.421444, 229.337413, 231.250189, 231.987235, 233.693404, 236.524230,
];

// zeta(sigma + i t) on a (ns+1) x (nt+1) vertex grid by Euler-Maclaurin summation: N terms plus 3 Bernoulli corrections.
// Returns { re, im } as Float32Arrays, index j * (ns + 1) + i, with i along sigma and j along t.
// cos and sin depend only on (t, n) and n^-sigma only on (sigma, n), so the inner loop is two multiply-adds.
// N = 128 is good to t of about 400. Keep t below about 3 N.
export function zetaGrid(sig0, sig1, ns, t0, t1, nt, N = 128) {
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
export const CHECKED = ZEROS.map(t => size(0.5, t) < 1e-4), ZETA2_OK = Math.abs(size(2, 0) - Math.PI ** 2 / 6) < 1e-6;
console.assert(CHECKED.every(Boolean) && ZETA2_OK, 'zeta self-check failed');
