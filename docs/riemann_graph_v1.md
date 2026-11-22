# How Zeta World works

The code is split across three files:

| File | Role |
| --- | --- |
| [`zeta.js`](../zeta.js) | The math, in double precision on the CPU: $`\zeta(s)`$, Hardy's $`Z(t)`$, and a zero finder. |
| [`main.js`](../main.js) | The Three.js scene. The terrain is computed on the GPU in a shader, with overlays, a probe, and an output-plane view. |
| [`index.html`](../index.html) | The page and controls. Three.js is loaded from a CDN with an import map, so there is no build step. |

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

## 5. The ξ tab

The tab bar at the top of the controls switches the terrain between $`\zeta(s)`$ and Riemann's completed function

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

$`N(t)`$ is positive and does not depend on $`\sigma`$, so it changes neither the zeros, the phase, nor the mirror symmetry. On the critical line $`|\tilde\xi| = |\zeta|`$, so the white line has the same height in both tabs. In fact $`\tilde\xi(\tfrac12 + it) = -Z(t)`$.

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

## Known limits

- **Height.** The view stops at $`t = 110`$ because of the shader's precision and its 128-term limit. Going higher would need either the Riemann–Siegel formula in the shader, or computing on the CPU and uploading the result as a texture.
- **Grid resolution.** The grid step is $`\Delta t \approx 0.067`$ and $`\Delta\sigma = 0.02`$, so the sharpest valleys look slightly rounded. Zeros still reach $`y = 0`$, because $`\sigma = \tfrac12`$ falls exactly on a grid line.
- **Missed zeros.** The zero finder would miss two zeros closer together than its scan step of $`0.05`$.
