"use client";

import { useEffect, useRef } from "react";
import { downtown } from "@/world/downtown";

/**
 * A plan-view minimap of the city.
 *
 * The city layout never changes at runtime, so the streets, blocks and parks
 * are drawn once into an offscreen canvas and blitted each frame. Only the
 * player marker is redrawn, which keeps the overlay to a couple of draw
 * operations per frame rather than several hundred.
 *
 * World coordinates map straight through: +x is right, +z is down, so the map's
 * orientation always matches the world without a rotation step.
 */

const WIDTH = 210;
/** Derived from the city's aspect so the plan is never stretched. */
const HEIGHT = Math.round((WIDTH * downtown.size.d) / downtown.size.w);

const COLORS = {
  ground: "#22262c",
  road: "#3d444d",
  pavement: "#31373f",
  building: "#8d97a3",
  paving: "#b3ac9d",
  grass: "#3f6b3d",
  player: "#4da3ff",
};

export interface MinimapProps {
  /** Returns the player's world position and facing, or null before spawn. */
  getPlayer: () => { x: number; z: number; facing: number } | null;
}

export default function Minimap({ getPlayer }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const scale = WIDTH / downtown.size.w;
    const base = renderBase(scale, dpr);

    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);

      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.drawImage(base, 0, 0, WIDTH, HEIGHT);

      const player = getPlayer();
      if (!player) return;

      const px = player.x * scale;
      const pz = player.z * scale;

      // A cone showing which way the player faces, then the dot on top, so the
      // marker reads at a glance without a legend.
      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(-player.facing);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(4.5, 3);
      ctx.lineTo(-4.5, 3);
      ctx.closePath();
      ctx.fillStyle = "rgba(77,163,255,0.55)";
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(px, pz, 3.1, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.player;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [getPlayer]);

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-20">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/55 shadow-lg backdrop-blur">
        <canvas ref={canvasRef} style={{ width: WIDTH, height: HEIGHT, display: "block" }} />
        <div className="border-t border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-white/45">
          Downtown · {downtown.size.w}×{downtown.size.d} m
        </div>
      </div>
    </div>
  );
}

/** Draws the unchanging city plan once, at device resolution. */
function renderBase(scale: number, dpr: number): HTMLCanvasElement {
  const el = document.createElement("canvas");
  el.width = WIDTH * dpr;
  el.height = HEIGHT * dpr;
  const ctx = el.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const rect = (x: number, z: number, w: number, d: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x * scale, z * scale, w * scale, d * scale);
  };

  rect(0, 0, downtown.size.w, downtown.size.d, COLORS.ground);

  // Pavement first, so roads cut through it the way they do on the ground.
  for (const s of downtown.sidewalks) rect(s.x, s.z, s.w, s.d, COLORS.pavement);
  for (const r of downtown.roads) rect(r.x, r.z, r.w, r.d, COLORS.road);

  for (const p of downtown.plazas) {
    rect(p.x, p.z, p.w, p.d, p.surface === "grass" ? COLORS.grass : COLORS.paving);
  }

  for (const b of downtown.buildings) rect(b.x, b.z, b.w, b.d, COLORS.building);

  return el;
}
