// The Primes tab: a 2D chart of psi(x) against the explicit formula with the first N zeros.
import { criticalZeros } from './zeta.js';
import { primePowerJumps, psiExact, psiExplicit, psiMain, zeroWave } from './primes.js';

const MAX_ZEROS = 200;
const X_MIN = 1.5; // the formula's last term blows up at x = 1
const C = {
  grid: 'rgba(255,255,255,0.08)',
  axis: 'rgba(255,255,255,0.22)',
  text: 'rgba(154,161,178,0.95)',
  stair: 'rgba(235,238,245,0.95)',
  main: 'rgba(154,161,178,0.8)',
  approx: '#f5c542',
  wave: '#7dffb2',
  prime: 'rgba(125,255,178,0.55)',
};

export function createPrimesView({ canvas, nInput, nVal, playBtn, xMaxInput, errInput, readout }) {
  const ctx = canvas.getContext('2d');
  let gammas = null; // computed the first time the tab opens (~0.2 s)
  let jumps = primePowerJumps(1000);
  let hoverX = null;
  let timer = null;
  let active = false;

  const N = () => Number(nInput.value);
  const X = () => Number(xMaxInput.value);
  const errView = () => errInput.checked;

  function ensureZeros() {
    if (!gammas) gammas = criticalZeros(400).slice(0, MAX_ZEROS);
  }

  // Plot area: leave room for the controls panel on wide screens, or below it on narrow ones.
  function layout() {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = innerWidth, h = innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wide = w > 760;
    const left = wide ? 16 + 340 + 56 : 48;
    const top = wide ? 40 : Math.min(h * 0.45, 380);
    const right = w - 24, bottom = h - 36;
    const gap = 34;
    const waveH = Math.max(70, (bottom - top) * 0.24);
    return {
      w, h,
      main: { l: left, r: right, t: top, b: bottom - waveH - gap },
      wave: { l: left, r: right, t: bottom - waveH, b: bottom },
    };
  }

  function sample(n, xMax, count) {
    const xs = [], approx = [], exact = [], wave = [];
    for (let i = 0; i <= count; i++) {
      const x = X_MIN + ((xMax - X_MIN) * i) / count;
      xs.push(x);
      approx.push(psiExplicit(x, gammas, n));
      exact.push(psiExact(x, jumps));
      wave.push(n > 0 ? zeroWave(x, gammas[n - 1]) : 0);
    }
    return { xs, approx, exact, wave };
  }

  function niceStep(range, target) {
    const raw = range / target;
    const p = 10 ** Math.floor(Math.log10(raw));
    for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
    return 10 * p;
  }

  function draw() {
    if (!active) return;
    ensureZeros();
    const n = N(), xMax = X(), err = errView();
    nVal.textContent = n;
    const L = layout();
    const count = Math.round((L.main.r - L.main.l) * 2);
    const S = sample(n, xMax, count);
    const sub = (i) => (err ? S.xs[i] : 0); // in the error view, subtract x from everything

    ctx.clearRect(0, 0, L.w, L.h);
    ctx.font = '12px ui-monospace, Menlo, monospace';

    // ---- main chart ranges
    const M = L.main;
    let yLo, yHi;
    if (err) {
      const r = 1.6 * Math.sqrt(xMax);
      yLo = -r; yHi = r;
    } else {
      yLo = 0; yHi = xMax * 1.05;
    }
    const px = (x) => M.l + ((x - X_MIN) / (xMax - X_MIN)) * (M.r - M.l);
    const py = (y) => M.b - ((y - yLo) / (yHi - yLo)) * (M.b - M.t);
    const clampY = (y) => Math.min(Math.max(y, yLo - (yHi - yLo)), yHi + (yHi - yLo));

    // grid + labels
    ctx.strokeStyle = C.grid; ctx.fillStyle = C.text; ctx.lineWidth = 1;
    const xs = niceStep(xMax, 8);
    for (let x = xs; x <= xMax; x += xs) {
      ctx.beginPath(); ctx.moveTo(px(x), M.t); ctx.lineTo(px(x), M.b); ctx.stroke();
      ctx.fillText(String(x), px(x) - 8, M.b + 16);
    }
    const ys = niceStep(yHi - yLo, 6);
    for (let y = Math.ceil(yLo / ys) * ys; y <= yHi; y += ys) {
      ctx.beginPath(); ctx.moveTo(M.l, py(y)); ctx.lineTo(M.r, py(y)); ctx.stroke();
      ctx.fillText(String(+y.toFixed(6)), M.l - 8 - ctx.measureText(String(+y.toFixed(6))).width, py(y) + 4);
    }
    ctx.strokeStyle = C.axis;
    ctx.beginPath(); ctx.moveTo(M.l, py(err ? 0 : yLo)); ctx.lineTo(M.r, py(err ? 0 : yLo)); ctx.stroke();

    // prime ticks along the bottom
    ctx.strokeStyle = C.prime;
    for (const j of jumps) {
      if (j.x > xMax) break;
      if (j.x !== j.p) continue;
      ctx.beginPath(); ctx.moveTo(px(j.x), M.b); ctx.lineTo(px(j.x), M.b - 6); ctx.stroke();
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(M.l, M.t - 2, M.r - M.l, M.b - M.t + 4); ctx.clip();

    // reference: the main term x - log 2pi - ..., or +-sqrt(x) in the error view
    ctx.setLineDash([5, 5]); ctx.strokeStyle = C.main; ctx.lineWidth = 1.2;
    if (err) {
      for (const sgn of [1, -1]) {
        ctx.beginPath();
        S.xs.forEach((x, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, px(x), py(sgn * Math.sqrt(x))));
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      S.xs.forEach((x, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, px(x), py(psiMain(x))));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // exact staircase
    ctx.strokeStyle = C.stair; ctx.lineWidth = 1.6;
    ctx.beginPath();
    S.xs.forEach((x, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, px(x), py(S.exact[i] - sub(i))));
    ctx.stroke();

    // explicit formula with n zeros
    ctx.strokeStyle = C.approx; ctx.lineWidth = 2;
    ctx.beginPath();
    S.xs.forEach((x, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, px(x), py(clampY(S.approx[i] - sub(i)))));
    ctx.stroke();
    ctx.restore();

    // legend
    const legend = [
      [C.stair, err ? 'ψ(x) − x  (exact)' : 'ψ(x)  exact prime staircase', false],
      [C.approx, `explicit formula, ${n} zero${n === 1 ? '' : 's'}`, false],
      [C.main, err ? '±√x' : 'main term  x − log 2π − ½ log(1 − x⁻²)', true],
    ];
    let ly = M.t + 4;
    for (const [col, text, dash] of legend) {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash ? [5, 5] : []);
      ctx.beginPath(); ctx.moveTo(M.l + 12, ly + 6); ctx.lineTo(M.l + 34, ly + 6); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(11,13,18,0.7)';
      ctx.fillRect(M.l + 38, ly - 4, ctx.measureText(text).width + 8, 18);
      ctx.fillStyle = C.text; ctx.fillText(text, M.l + 42, ly + 10);
      ly += 20;
    }

    // ---- wave strip: the contribution of the newest zero
    const W = L.wave;
    let wr = 1e-9;
    for (const v of S.wave) wr = Math.max(wr, Math.abs(v));
    wr *= 1.15;
    const wy = (v) => (W.t + W.b) / 2 - (v / wr) * ((W.b - W.t) / 2);
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W.l, wy(0)); ctx.lineTo(W.r, wy(0)); ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.fillText(
      n > 0
        ? `wave added by zero #${n}  (ρ = ½ ± ${gammas[n - 1].toFixed(3)}i):  −2·Re(x^ρ/ρ),  scale ±${wr.toFixed(2)}`
        : 'no zeros yet: only the main term',
      W.l, W.t - 8,
    );
    if (n > 0) {
      ctx.strokeStyle = C.wave; ctx.lineWidth = 1.4;
      ctx.beginPath();
      S.xs.forEach((x, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, px(x), wy(S.wave[i])));
      ctx.stroke();
    }

    // ---- hover guide and readout
    if (hoverX !== null && hoverX >= X_MIN && hoverX <= xMax) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px(hoverX), M.t); ctx.lineTo(px(hoverX), W.b); ctx.stroke();
      const e = psiExact(hoverX, jumps), a = psiExplicit(hoverX, gammas, n);
      readout.innerHTML =
        `x = ${hoverX.toFixed(2)}<br>ψ(x) = ${e.toFixed(3)} exact<br>` +
        `formula = ${a.toFixed(3)} with ${n} zeros<br>difference = ${(a - e).toFixed(3)}`;
    } else {
      readout.innerHTML = 'Hover over the chart to read off values.';
    }
  }

  function stop() {
    clearInterval(timer); timer = null;
    playBtn.textContent = '▶ Add zeros one by one';
  }

  function play() {
    if (timer) return stop();
    if (N() >= MAX_ZEROS) nInput.value = 0;
    playBtn.textContent = '❚❚ Pause';
    timer = setInterval(() => {
      const n = N();
      if (n >= MAX_ZEROS) return stop();
      nInput.value = Math.min(MAX_ZEROS, n + (n < 20 ? 1 : n < 60 ? 2 : 5));
      draw();
    }, 140);
  }

  nInput.max = MAX_ZEROS;
  nInput.addEventListener('input', () => { stop(); draw(); });
  xMaxInput.addEventListener('change', draw);
  errInput.addEventListener('change', draw);
  playBtn.addEventListener('click', play);
  canvas.addEventListener('mousemove', (e) => {
    const L = layout();
    const f = (e.clientX - L.main.l) / (L.main.r - L.main.l);
    hoverX = f >= 0 && f <= 1 ? X_MIN + f * (X() - X_MIN) : null;
    draw();
  });
  canvas.addEventListener('mouseleave', () => { hoverX = null; draw(); });
  addEventListener('resize', draw);

  return {
    show() { active = true; draw(); },
    hide() { active = false; stop(); },
  };
}
