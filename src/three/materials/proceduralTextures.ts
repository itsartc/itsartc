import * as THREE from "three";

/**
 * Textures drawn in code rather than loaded.
 *
 * The supplied asset pack turned out to contain two kinds of image: genuinely
 * seamless PBR materials (concrete, tiles, grass, bark) which tile beautifully,
 * and baked atlases (the façade sheet, the road mashup) which were authored for
 * one specific UV layout and repeat into visible garbage. The seamless ones are
 * loaded; the atlases are replaced by these.
 *
 * Drawing façades is not a workaround, it is the better answer for this
 * product: a procedural façade is perfectly tileable, weighs a few kilobytes,
 * stays sharp at any distance, and — the part that matters commercially — has
 * addressable window bays and a ground-floor band where a sponsor's signage can
 * be composited later.
 */

/** One texel per centimetre at typical façade scale. */
const FACADE_SIZE = 512;

function canvas(size: number): { ctx: CanvasRenderingContext2D; el: HTMLCanvasElement } {
  const el = document.createElement("canvas");
  el.width = size;
  el.height = size;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable");
  return { ctx, el };
}

function toTexture(el: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(el);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export interface FacadeOptions {
  /** Window bays across one texture repeat. */
  bays: number;
  wall: string;
  glass: string;
  frame: string;
  /** 0 = flush glazing, 1 = deep punched openings. */
  relief?: number;
}

/**
 * A single storey of façade: a band of wall with a row of windows, drawn so the
 * repeat is seamless in both axes. One repeat maps to one floor, so windows
 * line up with storeys at any building height.
 */
export function makeFacadeTexture(opts: FacadeOptions): THREE.CanvasTexture {
  const { ctx, el } = canvas(FACADE_SIZE);
  const S = FACADE_SIZE;
  const bays = opts.bays;
  const bayWidth = S / bays;

  ctx.fillStyle = opts.wall;
  ctx.fillRect(0, 0, S, S);

  // Subtle vertical shading so a flat wall does not read as flat colour.
  const shade = ctx.createLinearGradient(0, 0, 0, S);
  shade.addColorStop(0, "rgba(0,0,0,0.16)");
  shade.addColorStop(0.35, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, S, S);

  // Floor slab band across the top of the repeat.
  ctx.fillStyle = opts.frame;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, 0, S, Math.round(S * 0.09));
  ctx.globalAlpha = 1;

  const winW = bayWidth * 0.62;
  const winH = S * 0.52;
  const winY = S * 0.24;

  for (let i = 0; i < bays; i++) {
    const x = i * bayWidth + (bayWidth - winW) / 2;

    // Reveal: a darker frame gives punched windows some apparent depth.
    if ((opts.relief ?? 0.5) > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x - 3, winY - 3, winW + 6, winH + 6);
    }

    ctx.fillStyle = opts.frame;
    ctx.fillRect(x - 1.5, winY - 1.5, winW + 3, winH + 3);

    // Glass, brighter at the top where it catches sky.
    const g = ctx.createLinearGradient(x, winY, x, winY + winH);
    g.addColorStop(0, opts.glass);
    g.addColorStop(1, shadeColor(opts.glass, -0.35));
    ctx.fillStyle = g;
    ctx.fillRect(x, winY, winW, winH);

    // A mullion and a transom, so windows read as glazing rather than holes.
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(x + winW / 2 - 1, winY, 2, winH);
    ctx.fillRect(x, winY + winH * 0.45, winW, 2);
  }

  return toTexture(el);
}

/** Asphalt: dark, lightly mottled, and genuinely seamless. */
export function makeAsphaltTexture(): THREE.CanvasTexture {
  const size = 512;
  const { ctx, el } = canvas(size);

  ctx.fillStyle = "#3d3f42";
  ctx.fillRect(0, 0, size, size);

  // Aggregate speckle. Wrapping each blot keeps the tile seamless.
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.9 + 0.3;
    const v = Math.random();
    ctx.fillStyle =
      v > 0.7 ? "rgba(255,255,255,0.05)" : v > 0.35 ? "rgba(0,0,0,0.16)" : "rgba(140,140,145,0.07)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (x < r) { ctx.beginPath(); ctx.arc(x + size, y, r, 0, Math.PI * 2); ctx.fill(); }
    if (y < r) { ctx.beginPath(); ctx.arc(x, y + size, r, 0, Math.PI * 2); ctx.fill(); }
  }

  return toTexture(el);
}

/** A flat normal map, used where a material has no authored one. */
export function makeFlatNormal(): THREE.CanvasTexture {
  const { ctx, el } = canvas(4);
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, 4, 4);
  return toTexture(el, false);
}

/** Lightens (amount > 0) or darkens a hex colour. */
function shadeColor(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const target = amount > 0 ? 1 : 0;
  const t = Math.abs(amount);
  return `#${new THREE.Color(
    c.r + (target - c.r) * t,
    c.g + (target - c.g) * t,
    c.b + (target - c.b) * t,
  ).getHexString()}`;
}
