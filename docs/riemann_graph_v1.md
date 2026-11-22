# How Zeta World works

The code is split across three files:

| File | Role |
| --- | --- |
| [`zeta.js`](../zeta.js) | The math, in double precision on the CPU: $`\zeta(s)`$, Hardy's $`Z(t)`$, and a zero finder. |
| [`main.js`](../main.js) | The Three.js scene. The terrain is computed on the GPU in a shader, with overlays, a probe, and an output-plane view. |
| [`landscape.html`](../landscape.html) | The page and controls. Three.js is loaded from a CDN with an import map, so there is no build step. |

Throughout, $`s = \sigma + it`$ is the complex input.

---

## 1. Computing $`\zeta(s)`$ in the critical strip ([`zeta.js`](../zeta.js))

### Why the usual series doesn't work

The familiar definition

```math
\zeta(s) = \sum_{n=1}^{\infty} \frac{1}{n^{s}}
```

converges only for $`\sigma > 1`$. The nontrivial zeros lie in the critical strip $`0 < \sigma < 1`$, so we need a formula that is valid there.

### Step 1: the Dirichlet eta function

The alternating series

```math
\eta(s) = \sum_{k=0}^{\infty} \frac{(-1)^k}{(k+1)^{s}} = 1 - \frac{1}{2^s} + \frac{1}{3^s} - \cdots
```

converges for $`\sigma > 0`$, and $`\zeta`$ can be recovered from it:

```math
\zeta(s) = \frac{\eta(s)}{1 - 2^{1-s}}.
```

This division is the last few lines of `zeta()`.

### Step 2: Borwein acceleration

The alternating series converges slowly, especially when $`|t|`$ is large. Borwein's method replaces the signs $`(-1)^k`$ with precomputed weights $`w_k`$, so that a finite sum of $`n`$ terms is very accurate:

```math
\eta(s) \approx \sum_{k=0}^{n-1} \frac{w_k}{(k+1)^{s}},
\qquad
w_k = (-1)^k \left(1 - \frac{d_k}{d_n}\right),
```

```math
d_k = n \sum_{i=0}^{k} \frac{(n+i-1)!\; 4^i}{(n-i)!\,(2i)!}.
```

`borweinWeights(n)` computes the terms of $`d_k`$ with a recurrence, so it never forms a factorial:

```math
a_0 = \frac{1}{n}, \qquad
a_{i+1} = a_i \cdot \frac{4\,(n+i)(n-i)}{(2i+1)(2i+2)}.
```

The weights depend only on $`n`$, not on $`s`$, so they are computed once and cached. Every weight satisfies $`|w_k| \le 1`$, which matters for the GPU (see §2).

### How many terms

The error of the $`n`$-term sum is roughly

```math
|\text{error}| \lesssim \frac{(1 + 2|t|)\, e^{\pi |t| / 2}}{(3 + \sqrt{8})^{n}},
\qquad 3 + \sqrt 8 \approx 5.83.
```

So $`n`$ has to grow about linearly with $`|t|`$. `termsFor(t)` solves for the $`n`$ that gives about $`10^{-12}`$ error. That is about 60 terms at $`t = 40`$ and 234 at $`t = 240`$.

### Evaluating one term

For complex $`s`$, with $`L = \ln(k+1)`$:

```math
(k+1)^{-s} = e^{-\sigma L}\,\bigl(\cos(tL) - i \sin(tL)\bigr).
```

Each term therefore costs one `exp`, one `cos` and one `sin`. The denominator $`1 - 2^{1-s}`$ is expanded the same way.

### Finding the zeros

The Riemann–Siegel theta function is computed from its asymptotic expansion (`theta(t)`):

```math
\theta(t) \approx \frac{t}{2}\ln\frac{t}{2\pi} - \frac{t}{2} - \frac{\pi}{8} + \frac{1}{48t} + \frac{7}{5760\,t^3}.
```

It defines Hardy's function (`hardyZ(t)`):

```math
Z(t) = e^{i\theta(t)}\,\zeta\!\left(\tfrac12 + it\right).
```

$`Z(t)`$ is real and $`|Z(t)| = |\zeta(\tfrac12 + it)|`$. Every zero on the critical line is therefore a point where $`Z`$ changes sign.

`criticalZeros(tMax)` scans $`Z`$ in steps of $`0.05`$, starting at $`t = 10`$. It narrows down each sign change with 60 rounds of bisection. A pair of zeros closer together than one step would be missed, but nothing in the range used here comes close.

**Checks:**

| Quantity | Computed | Expected |
| --- | --- | --- |
| $`\zeta(2)`$ | 1.644934066848254 | $`\pi^2/6 = 1.644934066848226`$ |
| $`\zeta(\tfrac12)`$ | −1.460354508809589 | −1.460354508809587 |
| $`\zeta(0)`$ | −0.4999999999994 | $`-\tfrac12`$ |
| $`\zeta(-1)`$ | −0.0833333332 | $`-\tfrac{1}{12}`$ |
| 100th zero | 236.52422966581 | 236.52422966581 |

The scan finds exactly 100 zeros up to the 100th.

---

## 2. The terrain on the GPU ([`main.js`](../main.js))

### The mesh is only a grid

`PlaneGeometry(1, 1, 150, 600)` supplies about 90k vertices. Each vertex is used only for its uv coordinate $`(u, v) \in [0,1]^2`$.

### What the vertex shader does

For each vertex, the shader:

1. Maps uv to the input: $`\sigma \in [-1, 2]`$ and $`t \in [t_0,\ t_0 + 40]`$, where $`t_0`$ is the start of the window.
2. Runs the same Borwein sum as `zeta.js`. The weights come from `uniform float uW[128]` and the term count from `uN`.
3. Places the vertex in world space:

```math
x = 4\left(\sigma - \tfrac12\right), \qquad
y = 1.6 \cdot \min\!\bigl(\log(1 + |\zeta(s)|),\ 3\bigr), \qquad
z = -0.6\,(t - t_c),
```

where $`t_c`$ is the center of the window. The critical line $`\sigma = \tfrac12`$ runs along $`x = 0`$.

4. Passes $`\zeta(s)`$ to the fragment shader as `vZ`.

### Why this height formula

- $`\log(1 + |\zeta|)`$ is exactly $`0`$ when $`\zeta(s) = 0`$, so zeros touch the ground.
- It compresses large values.
- The cap at $`3`$ clips the pole at $`s = 1`$, where $`|\zeta| \to \infty`$.
- Near that pole the denominator $`|1 - 2^{1-s}|^2`$ is clamped to at least $`10^{-12}`$, so the shader never produces NaNs.

### Why compute in the vertex shader

The shader recomputes $`\zeta`$ every frame. That costs about 90k vertices × ~110 terms per frame, which a GPU handles easily. In exchange, moving the window only changes a few uniforms, and no geometry is rebuilt.

### What the fragment shader does

- **Hue is the phase.** The hue comes from $`\arg \zeta(s) = \operatorname{atan2}(\operatorname{Im}\zeta,\ \operatorname{Re}\zeta)`$. Going once around a simple zero passes through every color exactly once.
- **Magnitude bands.** The color darkens slightly in steps, following $`\operatorname{fract}(\log_2 |\zeta|)`$. Each band marks a doubling of $`|\zeta|`$.
- **Lighting.** The vertices are moved in the shader, so Three.js's own normals don't apply. The normal is rebuilt for each pixel from screen-space derivatives:

```math
\mathbf n = \frac{\partial_x \mathbf p \times \partial_y \mathbf p}{\|\partial_x \mathbf p \times \partial_y \mathbf p\|}.
```

  A simple diffuse light uses $`|\mathbf n \cdot \mathbf l|`$, so both sides of the surface are lit.

- **Why pass $`\zeta`$ and not its phase.** Interpolating the angle between vertices would smear wherever it wraps from $`+\pi`$ to $`-\pi`$. Interpolating the complex value and taking the angle per pixel avoids that.

### Precision

GPUs compute in 32-bit floats. Two consequences:

- **No overflow.** Because $`|w_k| \le 1`$, the weights fit in 32-bit floats. The raw values $`d_n`$ reach about $`10^{92}`$ and would overflow.
- **The main error** comes from evaluating $`\cos(t \ln k)`$ at large arguments.

The shader's arithmetic was simulated in Node with `Math.fround`. The maximum error is about $`0.006`$ for $`t \le 110`$. That is why the window stops at $`t = 110`$ (`T_START_MAX + WINDOW`) and the shader allows at most 128 terms.

---

## 3. Moving the window

The slider and the W/S keys call `setWindow(start)`, which does four things:

1. **Uniforms.** Picks $`n = `$ `termsFor(t0 + 40)` and uploads those weights, the new $`t`$ range and the new center.
2. **Output-plane curve.** Samples $`\zeta(\tfrac12 + it)`$ at 1,501 points across the window, on the CPU.
3. **Overlays.** Rebuilds them in `rebuildOverlay()`:
   - lines at $`\sigma = 0,\ \tfrac12,\ 1`$
   - $`t`$ tick labels, drawn with `CSS2DRenderer`
   - a green sphere and a label for each zero inside the window
4. **Probe.** Refreshes the probe (§4).

World coordinates are always centered on the window, so the terrain slides under a fixed camera. This keeps the numbers near zero, which helps precision, and it reads as flying along $`t`$.

---

## 4. The probe and the output plane

**The probe.** `updateProbe()` evaluates $`\zeta(\tfrac12 + it)`$ in double precision at the probe slider's $`t`$. It then:

- places a white marker at that height on the critical line;
- shows $`\zeta`$, $`|\zeta|`$ and the nearest zero;
- reports "at zero #k" when $`t`$ is within $`0.02`$ of a zero.

**The output plane.** `drawCurve()` plots the curve $`t \mapsto \zeta(\tfrac12 + it)`$ on a 2D canvas:

- The scale fits itself to the curve.
- Each segment is colored by its phase, using the same hues as the terrain.
- A white dot marks the current point.

The curve passes through the origin once for each zero on the critical line. These are the same zeros the terrain shows touching the ground. Moving the probe links the two views.

---

## 5. The ξ view

On the ζ tab, a pair of radio buttons switches the terrain between $`\zeta(s)`$ and Riemann's completed function

```math
\xi(s) = \tfrac12\, s(s-1)\, \pi^{-s/2}\, \Gamma\!\left(\tfrac s2\right) \zeta(s).
```

The choice is kept in the URL (`#xi`), and switching only flips the `uMode` uniform.

### Why ξ

- $`s-1`$ cancels the pole of $`\zeta`$ at $`s = 1`$.
- $`\Gamma(s/2)`$ has poles at $`s = 0, -2, -4, \dots`$. They cancel the trivial zeros of $`\zeta`$, and the factor $`s`$ cancels the pole at $`0`$.
- The result is entire, its zeros are exactly the nontrivial zeros of $`\zeta`$, and it satisfies $`\xi(s) = \xi(1-s)`$ and $`\xi(\bar s) = \overline{\xi(s)}`$. Together these give $`\xi(1-\bar s) = \overline{\xi(s)}`$, so $`|\xi|`$ is mirror-symmetric across $`\sigma = \tfrac12`$ and $`\xi`$ is real on that line.

### Computing it

Using $`\tfrac s2\,\Gamma(\tfrac s2) = \Gamma(\tfrac s2 + 1)`$:

```math
\xi(s) = (s-1)\zeta(s)\cdot e^{G(s)}, \qquad G(s) = \log\!\left(\pi^{-s/2}\,\Gamma\!\left(\tfrac s2 + 1\right)\right).
```

- $`(s-1)\zeta(s) = \eta(s)\,\dfrac{s-1}{1-2^{1-s}}`$ (`sm1Zeta`). The fraction tends to $`1/\ln 2`$ at $`s = 1`$, which is used directly there.
- $`\log\Gamma(z)`$ (`logGamma`) uses the shift $`\Gamma(z) = \Gamma(z+8)/\bigl(z(z+1)\cdots(z+7)\bigr)`$ and then Stirling's series up to $`1/(1260 w^5)`$. Here $`\operatorname{Re} z = \sigma/2 + 1 \ge \tfrac12`$, so the shift keeps $`|w| \ge 8.5`$.

### Scaling

$`|\xi(\tfrac12 + it)|`$ decays like $`e^{-\pi t/4}`$, which is about $`10^{-31}`$ at $`t = 100`$. The terrain therefore plots

```math
\tilde\xi(s) = \frac{\xi(s)}{N(t)}, \qquad N(t) = \bigl|(s-1)\,e^{G(s)}\bigr|_{s = \frac12 + it}.
```

$`N(t)`$ is positive and does not depend on $`\sigma`$, so it changes neither the zeros, the phase, nor the mirror symmetry. On the critical line $`|\tilde\xi| = |\zeta|`$, so the white line has the same height in both views. In fact $`\tilde\xi(\tfrac12 + it) = -Z(t)`$.

The output-plane panel becomes a graph of $`\tilde\xi(\tfrac12 + it)`$ against $`t`$, since a real-valued curve would only slide along the real axis.

**Checks** (`xi`, `xiScaled` in double precision):

| Quantity | Computed | Expected |
| --- | --- | --- |
| $`\xi(0)`$, $`\xi(1)`$ | 0.50000000006, 0.50000000004 | $`\tfrac12`$ |
| $`\xi(2)`$ | 0.52359877563 | $`\pi/6 = 0.52359877560`$ |
| $`\xi(\tfrac12)`$ | 0.49712077824 | 0.49712077818 |
| $`\tilde\xi(\sigma+it)`$ vs $`\overline{\tilde\xi(1-\sigma+it)}`$, $`\sigma \in [-1, \tfrac12]`$, $`t \le 110`$ | max relative difference $`10^{-9}`$ | equal |
| $`\tilde\xi(\tfrac12 + it) + Z(t)`$ | $`< 10^{-8}`$ | 0 |

---

## 6. The Primes tab ([`primes.js`](../primes.js), [`primesView.js`](../primesView.js))

This tab hides the 3D scene and draws a 2D chart. It compares Chebyshev's function

```math
\psi(x) = \sum_{p^k \le x} \log p
```

with Riemann's explicit formula (von Mangoldt's form), truncated to the first $`N`$ zeros:

```math
\psi(x) = x - \sum_{\rho} \frac{x^{\rho}}{\rho} - \log 2\pi - \tfrac12 \log\!\left(1 - x^{-2}\right).
```

Pairing each zero $`\rho = \tfrac12 + i\gamma`$ with its conjugate gives a real wave (`zeroWave`):

```math
-\left(\frac{x^{\rho}}{\rho} + \frac{x^{\bar\rho}}{\bar\rho}\right)
= -\frac{2\sqrt{x}\,\bigl(\tfrac12\cos(\gamma\ln x) + \gamma\sin(\gamma\ln x)\bigr)}{\tfrac14 + \gamma^2}.
```

- **Exact side:** `primePowerJumps` sieves up to 1000 and records each prime power with its jump $`\log p`$. `psiExact` looks up $`\psi(x)`$ by binary search.
- **Zeros:** the first 200 zeros come from `criticalZeros(400)`. They are computed the first time the tab opens, which takes about 0.2 s. The 100th and 200th match the published values 236.5242296658 and 396.3818542226.
- **Chart:** it shows the exact staircase, the formula with $`N`$ zeros, and the smooth main term. Below it, a strip shows the wave added by zero $`N`$. The error view plots $`\psi(x) - x`$ with $`\pm\sqrt x`$ for scale. That is a scale, not a bound: on $`[2, 1000]`$ the largest value of $`|\psi(x) - x|/\sqrt x`$ is 1.33, at $`x = 3`$.
- **Controls:** a slider for $`N`$ (0–200), a play button that adds zeros over time, the range $`x \le 30, 100, 300, 1000`$, and a hover readout.

The truncated sum converges only conditionally. Near each step it overshoots and rings, like a Fourier series at a jump. That ringing is real behavior of the formula, not a rendering bug.

**Checks:**

| $`x`$ | exact $`\psi(x)`$ | 10 zeros | 50 zeros | 200 zeros |
| --- | --- | --- | --- | --- |
| 10.5 | 7.832 | 7.702 | 7.975 | 7.847 |
| 30.5 | 28.476 | 29.248 | 28.304 | 28.629 |
| 100.5 | 94.045 | 95.776 | 94.905 | 93.910 |
| 500.5 | 501.652 | 501.127 | 502.040 | 500.463 |

---

## 7. The L(s, χ) tab ([`dirichlet.js`](../dirichlet.js))

This tab draws the terrain of a Dirichlet L-function for a primitive character $`\chi`$ mod $`q`$, for $`q \le 13`$:

```math
L(s, \chi) = \sum_{n \ge 1} \frac{\chi(n)}{n^{s}} = \prod_p \frac{1}{1 - \chi(p)\, p^{-s}}.
```

### Characters

`primitiveCharacters(q)` builds every character mod $`q`$ from the structure of $`(\mathbb Z/q\mathbb Z)^*`$. Each odd prime power has a primitive root, and $`2^e`$ for $`e \ge 3`$ is generated by $`-1`$ and $`5`$. It keeps the primitive characters: $`\chi`$ is primitive when no proper divisor $`d \mid q`$ has $`\chi(a) = 1`$ for every $`a \equiv 1 \pmod d`$. For each one it records:

- the parity $`\mathfrak a`$ ($`\chi(-1) = (-1)^{\mathfrak a}`$), the order, and whether it is real;
- the conjugate character;
- the root number $`\varepsilon(\chi) = \tau(\chi)/(i^{\mathfrak a}\sqrt q)`$, from the Gauss sum $`\tau(\chi) = \sum_a \chi(a)\, e^{2\pi i a/q}`$.

The counts match the known numbers of primitive characters (for example 1, 1, 3, 5, 2, 4, 9, 1, 11 for $`q = 3, 4, 5, 7, 8, 9, 11, 12, 13`$). $`|\varepsilon| = 1`$ to $`10^{-12}`$ in every case.

### Evaluating L

The series converges too slowly in the strip, and the Borwein trick used for $`\zeta`$ relies on the alternating signs, so `lChi` splits $`L`$ into Hurwitz zeta functions:

```math
L(s, \chi) = \sum_{n=1}^{qN} \frac{\chi(n)}{n^{s}} + q^{-s} \sum_{a=1}^{q-1} \chi(a)\, \zeta\!\left(s,\ N + \tfrac aq\right),
```

and evaluates each tail by Euler–Maclaurin:

```math
\zeta(s, x) = \frac{x^{1-s}}{s-1} + \frac{x^{-s}}{2} + \sum_{k=1}^{M} \frac{B_{2k}}{(2k)!}\, (s)_{2k-1}\, x^{-s-2k+1} + R_M .
```

- **The pole terms.** They combine as $`\sum_a \chi(a)\,(x_a^{1-s} - 1)/(s-1)`$, which is allowed because $`\sum_a \chi(a) = 0`$. This is finite at $`s = 1`$, so $`L(1, \chi)`$ comes out directly.
- **Parameters on the CPU:** $`N = \lceil |t|/2 \rceil + 8`$ and $`M = 10`$.
- **Parameters in the shader:** $`N = \lceil t_{\max}/\pi \rceil + 4`$ and $`M = 6`$, with a truncation error of about $`10^{-6}`$. The shader receives $`\chi`$ as `uniform vec2 uChi[16]`.

### The completed function

```math
\Lambda(s, \chi) = (q/\pi)^{(s+\mathfrak a)/2}\, \Gamma\!\left(\tfrac{s+\mathfrak a}{2}\right) L(s, \chi) = \varepsilon(\chi)\, \Lambda(1 - s, \bar\chi).
```

The Λ view plots $`\tilde\Lambda = \varepsilon^{-1/2}\, \Lambda(s, \chi) / N(t)`$, where $`N(t)`$ is the size of the completing factor at $`\tfrac12 + it`$. This $`\tilde\Lambda`$ is real on the critical line, $`|\tilde\Lambda| = |L|`$ there, and $`\tilde\Lambda(1 - \bar s) = \overline{\tilde\Lambda(s)}`$ for every primitive $`\chi`$, real or complex. Where the Γ pole meets the trivial zero ($`s = -\mathfrak a`$), the code steps slightly off the point.

### Zeros and the window

`lZeros` scans $`\tilde\Lambda(\tfrac12 + it)`$, which is real, for sign changes on $`-60 \le t \le 60`$ and refines each by bisection. The window can start below $`t = 0`$: for a complex $`\chi`$, $`L(\sigma - it, \chi) = \overline{L(\sigma + it, \bar\chi)}`$, so the lower half is the terrain of $`\bar\chi`$ and its zeros are at different heights. In the L view a gray marker shows the trivial zero at $`s = -\mathfrak a`$ on the real axis.

**Checks:**

| Quantity | Computed | Expected |
| --- | --- | --- |
| $`L(1, \chi_{-4})`$ | 0.7853981633974483 | $`\pi/4`$ |
| $`L(1, \chi_{-3})`$ | 0.6045997880780727 | $`\pi/(3\sqrt3)`$ |
| $`L(2 + 3i, \chi_{-4})`$ | 1.10389140733 + 0.01335828906i | direct series: same to $`2 \times 10^{-13}`$ |
| zeros of $`L(s, \chi_{-4})`$ | 6.020949, 10.243770, 12.988098, 16.342607, 18.291993, 21.450611 | published values |
| mirror $`\tilde\Lambda(1 - \bar s) = \overline{\tilde\Lambda(s)}`$, $`q = 5, 7, 8, 13`$ | relative error $`\le 3 \times 10^{-10}`$ | equal |
| shader arithmetic (simulated in 32-bit floats), $`q \le 13`$, $`|t| \le 60`$ | error $`\le 3 \times 10^{-4}`$ relative to $`1 + |f|`$ | — |

For the complex character mod 5 with $`\chi(2) = i`$, the first zeros above the axis are at $`t = 6.1836, 8.4572`$ and below it at $`t = -4.1329, -9.4429`$.

---

## Known limits

- **Height.** The view stops at $`t = 110`$ because of the shader's precision and its 128-term limit. Going higher would need either the Riemann–Siegel formula in the shader, or computing on the CPU and uploading the result as a texture.
- **Grid resolution.** The grid step is $`\Delta t \approx 0.067`$ and $`\Delta\sigma = 0.02`$, so the sharpest valleys look slightly rounded. Zeros still reach $`y = 0`$, because $`\sigma = \tfrac12`$ falls exactly on a grid line.
- **Missed zeros.** The zero finder would miss two zeros closer together than its scan step of $`0.05`$.
