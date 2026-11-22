# Zeta World

A way to visualize the Riemann hypothesis in 3D, built with Three.js for Sundai Hack 150 (Building 3D Worlds).

The idea is still broad. The goal is a world you can fly through that lets you *see* the most famous problem in math and how it connects to the prime numbers.

## Status of the math

On 20 November 2026 Levent Alpöge announced a proof of the Riemann hypothesis, and of the generalized Riemann hypothesis for Dirichlet L-functions, published as a formal proof in Lean (175,187 files).

- **Machine-checked:** two independent proof checkers (Lean's kernel and NanoDA, written in Rust) accepted the complete proof, and several outside groups report reproducing that. It uses only Lean's three standard axioms, and its final statements match Mathlib's definition of the Riemann hypothesis.
- **Not yet refereed:** there is no human-readable write-up of the argument, and mathematicians have not reviewed it.

Before that, in October 2026, a proof of a weaker "quasi-Riemann hypothesis" was announced.

This project visualizes the statement: the zeros, the critical line, and how the zeros shape the primes. It makes no claim about the proof. For a map of the announced proof and a record of who has checked what, see [riemann-rev](https://github.com/nasqret/riemann-rev) ([site](https://nasqret.github.io/riemann-rev/)).

## Getting started

1. **Understand it first.** What the zeta function is, what its zeros are, what the hypothesis claims about them, and why the primes care.
2. **First picture.** Draw the height of |ζ(s)| over the critical strip (0 < Re(s) < 1) as a terrain, computed in a shader.
3. **Mark the zeros.** Hardcode the first ~100 nontrivial zeros and show them on the line Re(s) = 1/2.
4. **Zeros build the primes.** A slider that adds zeros one at a time and shows the smooth curve turning into the prime-counting staircase (the explicit formula). This is the part that teaches something, so it comes before polish.
5. **Stretch.** Sound for each zero, a marker for the region the quasi-RH result covers, an AI guide that flies the camera to answer a question.

## Stack

Three.js and a plain `index.html` to start. Add a build step only when something needs it.

## Running

ES modules need a server, not `file://`:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

- `zeta.js`: double-precision ζ(s) using the Borwein-accelerated eta series (valid in the critical strip), the completed function ξ(s), Hardy's Z(t), and a zero finder.
- `main.js`: the terrain (ζ, ξ or L(s, χ) computed per vertex in a shader, chosen with tabs and radio buttons), critical-line probe, and the critical-line curve.
- `dirichlet.js`: Dirichlet characters, L(s, χ) via Hurwitz sums with Euler–Maclaurin, the completed Λ(s, χ), and its zeros (the L(s,χ) tab).
- `primes.js`, `primesView.js`: ψ(x), the explicit formula, and the Primes tab chart (the zeros rebuilding the prime staircase).

See [docs/riemann_graph_v1.md](docs/riemann_graph_v1.md) for how it works, with the math.
