// Small canvas helpers shared by proof.js and step4.js.

export const C = {
  bg: '#12151d', grid: 'rgba(255,255,255,0.07)', axis: 'rgba(255,255,255,0.22)', text: 'rgba(154,161,178,0.95)',
  data: 'rgba(201,206,216,0.85)', red: '#ff6b6b', gold: '#f5c542', green: '#7dffb2', white: '#ffffff', cyan: '#6fd6ff',
};

export const $ = (id) => document.getElementById(id);

// Size a canvas for the device pixel ratio. Canvases whose class contains "fill" take their height
// from CSS (sized to the screen); others get height = width * aspect.
export function setup(canvas, aspect) {
  const dpr = Math.min(devicePixelRatio, 2);
  const w = canvas.clientWidth || 600;
  let h;
  if (/\bfill/.test(canvas.className)) h = canvas.clientHeight || Math.round(w * aspect);
  else { h = Math.round(w * aspect); canvas.style.height = `${h}px`; }
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.font = '11px ui-monospace, Menlo, monospace';
  return { g, w, h };
}

// Superscript digits, and compact numbers like 3.2×10⁵.
export const sup = (n) => String(n).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
export const sci = (x) => {
  if (!Number.isFinite(x)) return '∞';
  if (x < 1e5) return Math.round(x).toLocaleString('en-US');
  const e = Math.floor(Math.log10(x));
  return `${(x / 10 ** e).toFixed(1)}×10${sup(e)}`;
};
