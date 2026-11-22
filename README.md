# Zeta World

A way to visualize the Riemann hypothesis in 3D, built with Three.js for Sundai Hack 150 (Building 3D Worlds).

The idea is still broad. The goal is a world you can fly through that lets you *see* the most famous unsolved problem in math and how it connects to the prime numbers.

## Status of the math

The Riemann hypothesis is **not proven**. In October 2026 a proof of a weaker "quasi-Riemann hypothesis" was announced, with its first version checked in Lean. This project visualizes the conjecture; it does not claim anything about it.

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

- `zeta.js`: double-precision ζ(s) using the Borwein-accelerated eta series (valid in the critical strip), Hardy's Z(t), and a zero finder.
- `main.js`: the terrain (ζ computed per vertex in a shader), critical-line probe, and the ζ(½ + it) output-plane curve.
