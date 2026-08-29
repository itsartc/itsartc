import * as THREE from "three";

/**
 * Signage and façade textures drawn in code.
 *
 * These are the surfaces a sponsor buys: a vertical LED banner down a tower, a
 * lit wordmark on a crown, a ticker above the entrance. Drawing them rather
 * than shipping images means a building's branding is *data* — change a name
 * and two colours and the tower re-skins itself, with no asset pipeline and no
 * download.
 *
 * Everything is emissive-ready: the colours are drawn bright so that, with
 * bloom, they read as light sources rather than painted panels.
 */

function canvas(w: number, h: number) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable");
  return { ctx, el };
}

function toTexture(el: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 8;
  return tex;
}

/**
 * A vertical LED banner: letters stacked down a tall panel over a gradient.
 *
 * The panel is authored tall and narrow so it maps onto a full-height strip
 * without stretching the glyphs.
 */
export function makeVerticalBanner(text: string, top: string, bottom: string): THREE.CanvasTexture {
  const W = 256;
  const H = 1536;
  const { ctx, el } = canvas(W, H);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // A darker inset border keeps the panel from bleeding into the wall behind.
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);

  const letters = text.toUpperCase().replace(/\s+/g, "").split("");
  // The emblem occupies the first fifth; letters share what remains.
  const emblemH = H * 0.18;
  const slot = (H - emblemH) / Math.max(letters.length, 1);

  // Emblem: concentric arcs, geometric enough to read as a mark at distance.
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 9;
  for (const r of [W * 0.3, W * 0.19]) {
    ctx.beginPath();
    ctx.arc(W / 2, emblemH * 0.55, r, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(W / 2, emblemH * 0.55, W * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.floor(slot * 0.62)}px ui-sans-serif, system-ui, sans-serif`;
  letters.forEach((letter, i) => {
    ctx.fillText(letter, W / 2, emblemH + slot * (i + 0.5));
  });

  return toTexture(el);
}

/** A lit wordmark for a tower crown: bright text on near-black. */
export function makeCrownSign(text: string, accent: string): THREE.CanvasTexture {
  const W = 1024;
  const H = 256;
  const { ctx, el } = canvas(W, H);

  ctx.fillStyle = "#0a0d11";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = accent;
  ctx.fillRect(0, H - 12, W, 12);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Wide tracking reads as architectural signage rather than body text.
  const spaced = text.toUpperCase().split("").join(" ");

  // Fit the wordmark to the panel. A fixed size clipped longer names — "AI
  // District" rendered as "I DISTRIC" — and district names are authored data,
  // so their length is not something this can assume.
  let size = 116;
  ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
  const maxWidth = W * 0.88;
  const measured = ctx.measureText(spaced).width;
  if (measured > maxWidth) {
    size = Math.floor(size * (maxWidth / measured));
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
  }
  ctx.fillText(spaced, W / 2, H / 2 + 6);

  return toTexture(el);
}

/**
 * A diagonal exoskeleton, as a tiling texture.
 *
 * Real crossed members would be thousands of triangles per façade. Drawn as a
 * texture the lattice costs nothing, tiles seamlessly, and stays sharp — the
 * same trade that makes the whole city cheap.
 */
export function makeDiagridTexture(bars: string, glass: string): THREE.CanvasTexture {
  const S = 512;
  const { ctx, el } = canvas(S, S);

  ctx.fillStyle = glass;
  ctx.fillRect(0, 0, S, S);

  ctx.strokeStyle = bars;
  ctx.lineWidth = S * 0.055;
  ctx.lineCap = "square";

  // Both diagonals, drawn twice offset by a tile so the seams match on wrap.
  for (const dir of [1, -1]) {
    for (let i = -1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * S, dir > 0 ? 0 : S);
      ctx.lineTo((i + 1) * S, dir > 0 ? S : 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i * S - S, dir > 0 ? 0 : S);
      ctx.lineTo(i * S, dir > 0 ? S : 0);
      ctx.stroke();
    }
  }

  // A horizontal floor member every half tile grounds the diagonals.
  ctx.lineWidth = S * 0.03;
  for (const y of [0, S / 2]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y);
    ctx.stroke();
  }

  return toTexture(el, true);
}

/** A scrolling-style ticker band above an entrance. */
export function makeTicker(text: string, accent: string): THREE.CanvasTexture {
  const W = 1024;
  const H = 64;
  const { ctx, el } = canvas(W, H);

  ctx.fillStyle = "#070a0d";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = accent;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "700 34px ui-monospace, monospace";
  const phrase = `${text.toUpperCase()}   ◂◂◂   `;
  let x = 12;
  while (x < W) {
    ctx.fillText(phrase, x, H / 2 + 2);
    x += ctx.measureText(phrase).width;
  }

  return toTexture(el, true);
}
