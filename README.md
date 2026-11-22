# Zeta World

A way to visualize the Riemann hypothesis in 3D, built with Three.js for Sundai Hack 150 (Building 3D Worlds).

**Live: https://alex-lop.github.io/zeta-world/** · [The plan](PLAN.md)

The idea is still broad. The goal is a world you can fly through that lets you *see* the Riemann hypothesis, the most famous problem in math, and how it connects to the prime numbers.

## Status of the math

As of 22 Nov 2026: a computer-checked proof of the Riemann hypothesis was released on 20 Nov and certified correct on 21 Nov in a [joint statement of the Lean and Mathlib communities](https://leanprover-community.github.io/blog/posts/riemann-hypothesis/). Its author has published it only as Lean code, with no paper yet, and it has not been peer reviewed. In October 2026 a proof of a weaker "quasi-Riemann hypothesis" (no zeros with real part above 7/8) was released, checked in Lean and also not peer reviewed.

This project shows what the hypothesis says. It proves nothing.

## Getting started

1. **Understand it first.** What the zeta function is, what its zeros are, what the hypothesis claims about them, and why the primes care.
2. **First picture.** Draw the height of |ζ(s)| over the critical strip (0 < Re(s) < 1) as a terrain, computed in a shader.
3. **Mark the zeros.** Hardcode the first ~100 nontrivial zeros and show them on the line Re(s) = 1/2.
4. **Zeros build the primes.** A slider that adds zeros one at a time and shows the smooth curve turning into the prime-counting staircase (the explicit formula). This is the part that teaches something, so it comes before polish.
5. **Stretch.** Sound for each zero, a marker for the region the quasi-RH result covers, an AI guide that flies the camera to answer a question.

## Stack

Three.js and a plain `index.html` to start. Add a build step only when something needs it.
