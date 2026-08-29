import * as THREE from "three";

/**
 * Signage and façade textures drawn in code.
 *
 * These are the surfaces a sponsor buys: a vertical LED banner hung down a
 * façade, a marquee over a venue's doors. Drawing them rather than shipping
 * images means a building's branding is *data* — change a name and two colours
 * and the façade re-skins itself, with no asset pipeline and no download.
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

function toTexture(el: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
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

/**
 * A venue marquee: a small standing line over a large title.
 *
 * Authored wide and shallow so it maps onto a board above an entrance without
 * stretching. The title is measured and fitted rather than assumed — a venue
 * name is authored data, and a fixed size clips the long ones.
 */
export function makeMarquee(title: string, standing: string, accent: string): THREE.CanvasTexture {
  const W = 1024;
  const H = 256;
  const { ctx, el } = canvas(W, H);

  ctx.fillStyle = "#17110d";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 10);
  ctx.fillRect(0, H - 10, W, 10);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = accent;
  ctx.font = "700 34px ui-monospace, monospace";
  ctx.fillText(standing.toUpperCase().split("").join(" "), W / 2, 62);

  ctx.fillStyle = "#fdf3e6";
  const label = title.toUpperCase();
  let size = 118;
  ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
  const maxWidth = W * 0.88;
  const measured = ctx.measureText(label).width;
  if (measured > maxWidth) {
    size = Math.floor(size * (maxWidth / measured));
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`;
  }
  ctx.fillText(label, W / 2, 160);

  return toTexture(el);
}
