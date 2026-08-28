import Phaser from "phaser";
import type {
  WorldMap,
  WorldObject,
  TerrainType,
  SubArea,
  TerrainSurface,
  Interior,
} from "@/world/schema";

/**
 * Renderer for the world.
 *
 * All art is still generated in code (no binary assets yet), but this pass adds
 * real richness: textured terrain with shorelines, layered foliage, warm lamp
 * glow, neon venue signs, shaded characters, and a cozy dusk ambience — moving
 * the look toward the target mood while staying a "dumb" interpreter of the
 * world data. Real sprite sheets / tilesets drop in behind the same data later.
 */

/** Base terrain fill colours (cozy Pokémon-era palette). */
const TERRAIN_COLORS: Record<TerrainType, number> = {
  grass: 0x6fae43,
  grassdark: 0x568a34,
  path: 0xc2a06a,
  plaza: 0xd6c69a,
  water: 0x3f97cf,
  sand: 0xe0cd93,
  // Indoor floors (Phase 1F interiors).
  wood: 0xb5854f,
  carpet: 0xa15c58,
  tile: 0xdfe4e8,
  concrete: 0x9aa0a6,
};

/** Detail tones layered on top of each terrain type for texture. */
const TERRAIN_DETAIL: Partial<Record<TerrainType, { light: number; dark: number }>> = {
  grass: { light: 0x82bd54, dark: 0x5d9636 },
  grassdark: { light: 0x67a041, dark: 0x477528 },
  path: { light: 0xd0b07e, dark: 0xa8894f },
  plaza: { light: 0xe4d6ad, dark: 0xbcac80 },
  sand: { light: 0xeeddab, dark: 0xcbb679 },
  wood: { light: 0xc79a63, dark: 0x94693b },
  carpet: { light: 0xb56d68, dark: 0x854a47 },
  tile: { light: 0xeef2f5, dark: 0xc2c9cf },
  concrete: { light: 0xadb3b8, dark: 0x82888e },
};

// Deterministic value hash → [0,1); keeps terrain texture stable across renders.
function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Build a per-cell terrain-type grid from base + painted regions (last wins). */
function terrainGrid(map: TerrainSurface): TerrainType[][] {
  const grid: TerrainType[][] = Array.from({ length: map.heightTiles }, () =>
    Array<TerrainType>(map.widthTiles).fill(map.baseTerrain),
  );
  for (const r of map.terrain) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (y >= 0 && y < map.heightTiles && x >= 0 && x < map.widthTiles) grid[y][x] = r.type;
      }
    }
  }
  return grid;
}

/**
 * Paints terrain once into static Graphics: base fills, per-tile texture, water
 * ripples + shorelines, plaza seams. Drawn on create(), never per frame.
 */
export function paintTerrain(scene: Phaser.Scene, map: TerrainSurface): void {
  const ts = map.tileSize;
  const W = map.widthTiles;
  const H = map.heightTiles;
  const grid = terrainGrid(map);

  const g = scene.add.graphics();
  g.setDepth(0);

  // Base fills
  g.fillStyle(TERRAIN_COLORS[map.baseTerrain], 1);
  g.fillRect(0, 0, W * ts, H * ts);
  for (const r of map.terrain) {
    g.fillStyle(TERRAIN_COLORS[r.type] ?? 0x000000, 1);
    g.fillRect(r.x * ts, r.y * ts, r.w * ts, r.h * ts);
  }

  // Per-tile detail
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = grid[y][x];
      const px = x * ts;
      const py = y * ts;

      if (t === "water") {
        // Ripples
        g.fillStyle(0x62aede, 0.5);
        const rows = 2 + Math.floor(hash(x, y, 5) * 2);
        for (let i = 0; i < rows; i++) {
          const ry = py + 6 + i * 10 + Math.floor(hash(x, y, i) * 4);
          const rw = 8 + Math.floor(hash(x, y, i + 9) * 12);
          const rx = px + 3 + Math.floor(hash(x, y, i + 3) * (ts - rw - 6));
          g.fillRect(rx, ry, rw, 2);
        }
        continue;
      }

      const detail = TERRAIN_DETAIL[t];
      if (!detail) continue;

      if (t === "plaza") {
        // Stone seams + occasional speck
        g.fillStyle(detail.dark, 0.35);
        g.fillRect(px, py, ts, 1);
        g.fillRect(px, py, 1, ts);
        if (hash(x, y, 7) > 0.7) {
          g.fillStyle(detail.light, 0.5);
          g.fillRect(px + 6 + Math.floor(hash(x, y, 2) * 18), py + 6 + Math.floor(hash(x, y, 4) * 18), 3, 3);
        }
        continue;
      }

      if (t === "wood") {
        // Plank seams running along X, with a stagger so joins don't line up.
        g.fillStyle(detail.dark, 0.45);
        g.fillRect(px, py, ts, 1);
        g.fillRect(px, py + ts / 2, ts, 1);
        const joint = hash(x, y, 8) > 0.55 ? 0 : ts / 2;
        g.fillRect(px + Math.floor(hash(x, y, 9) * (ts - 4)), py + joint, 1, ts / 2);
        if (hash(x, y, 10) > 0.6) {
          g.fillStyle(detail.light, 0.35);
          g.fillRect(px + 2, py + joint + 4, ts - 4, 1);
        }
        continue;
      }

      if (t === "tile" || t === "concrete") {
        // Grout lines; concrete gets a coarser speckle on top.
        g.fillStyle(detail.dark, t === "tile" ? 0.45 : 0.25);
        g.fillRect(px, py, ts, 1);
        g.fillRect(px, py, 1, ts);
        if (t === "tile") {
          g.fillRect(px + ts / 2, py, 1, ts);
          g.fillRect(px, py + ts / 2, ts, 1);
        } else if (hash(x, y, 11) > 0.4) {
          g.fillStyle(detail.light, 0.4);
          g.fillRect(px + 4 + Math.floor(hash(x, y, 12) * 20), py + 4 + Math.floor(hash(x, y, 13) * 20), 2, 2);
        }
        continue;
      }

      if (t === "carpet") {
        // Dense fine weave, no hard edges.
        for (let i = 0; i < 6; i++) {
          const cx = px + Math.floor(hash(x, y, i + 50) * ts);
          const cy = py + Math.floor(hash(x, y, i + 60) * ts);
          g.fillStyle(hash(x, y, i + 70) > 0.5 ? detail.light : detail.dark, 0.3);
          g.fillRect(cx, cy, 2, 1);
        }
        continue;
      }

      // grass / grassdark / path / sand: scatter tufts / specks
      const n = t === "path" || t === "sand" ? 3 : 2 + Math.floor(hash(x, y, 1) * 3);
      for (let i = 0; i < n; i++) {
        const hx = px + 2 + Math.floor(hash(x, y, i * 2 + 11) * (ts - 6));
        const hy = py + 2 + Math.floor(hash(x, y, i * 2 + 12) * (ts - 6));
        const light = hash(x, y, i + 20) > 0.5;
        g.fillStyle(light ? detail.light : detail.dark, t === "path" || t === "sand" ? 0.5 : 0.6);
        if (t === "grass" || t === "grassdark") {
          // little vertical blades
          g.fillRect(hx, hy, 1, 3);
          if (hash(x, y, i + 30) > 0.85) g.fillRect(hx + 1, hy - 1, 1, 3);
        } else {
          g.fillRect(hx, hy, 2, 2);
        }
      }
      // rare wildflower on grass
      if ((t === "grass" || t === "grassdark") && hash(x, y, 42) > 0.955) {
        const fx = px + 8 + Math.floor(hash(x, y, 43) * 12);
        const fy = py + 8 + Math.floor(hash(x, y, 44) * 12);
        const cols = [0xffffff, 0xf2c94c, 0xe06c9f, 0x9b7bd6];
        g.fillStyle(cols[Math.floor(hash(x, y, 45) * cols.length)], 0.9);
        g.fillRect(fx, fy, 2, 2);
      }
    }
  }

  // Water shorelines — a soft rim wherever water meets land
  const shore = scene.add.graphics();
  shore.setDepth(0.5);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== "water") continue;
      const px = x * ts;
      const py = y * ts;
      const up = y > 0 ? grid[y - 1][x] : map.baseTerrain;
      const dn = y < H - 1 ? grid[y + 1][x] : map.baseTerrain;
      const lf = x > 0 ? grid[y][x - 1] : map.baseTerrain;
      const rt = x < W - 1 ? grid[y][x + 1] : map.baseTerrain;
      shore.fillStyle(0xdcc58f, 0.55); // damp sand rim
      if (up !== "water") shore.fillRect(px, py, ts, 3);
      if (dn !== "water") shore.fillRect(px, py + ts - 3, ts, 3);
      if (lf !== "water") shore.fillRect(px, py, 3, ts);
      if (rt !== "water") shore.fillRect(px + ts - 3, py, 3, ts);
      shore.fillStyle(0x2f7fb3, 0.5); // inner darker water edge
      if (up !== "water") shore.fillRect(px, py + 3, ts, 2);
      if (dn !== "water") shore.fillRect(px, py + ts - 5, ts, 2);
    }
  }
}

/** A soft radial glow texture (white), created once; tinted + additively blended per light. */
function ensureGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists("glow")) return;
  const size = 128;
  const tex = scene.textures.createCanvas("glow", size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

/** Add an additive light blob at a world position. Sits above the dusk overlay. */
function addLight(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radiusPx: number,
  color: number,
  intensity = 0.9,
): void {
  ensureGlowTexture(scene);
  const light = scene.add.image(x, y, "glow");
  light.setBlendMode(Phaser.BlendModes.ADD);
  light.setTint(color);
  light.setAlpha(intensity);
  light.setDisplaySize(radiusPx * 2, radiusPx * 2);
  light.setDepth(95000);
}

/** Draws every building: shaded walls, lit windows, door, and a neon venue sign. */
export function paintBuildings(scene: Phaser.Scene, map: WorldMap): void {
  const ts = map.tileSize;
  const hex = (s: string) => Phaser.Display.Color.HexStringToColor(s).color;

  for (const b of map.buildings) {
    const px = b.x * ts;
    const py = b.y * ts;
    const pw = b.w * ts;
    const ph = b.h * ts;
    const accent = map.districts.find((d) => d.id === b.districtId)?.accent ?? "#e3b341";

    const g = scene.add.graphics();
    g.setDepth(py + ph);

    // Ground shadow
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(px + pw / 2, py + ph + 3, pw + 8, ts * 0.7);

    // Wall + a vertical shade gradient (stacked bands)
    const wall = hex(b.wallColor);
    const wallDark = Phaser.Display.Color.IntegerToColor(wall).darken(18).color;
    g.fillStyle(wall, 1);
    g.fillRect(px, py + ts, pw, ph - ts);
    g.fillStyle(wallDark, 0.5);
    g.fillRect(px, py + ph - 10, pw, 10); // base shadow
    g.fillStyle(0xffffff, 0.06);
    g.fillRect(px, py + ts, pw, 4); // top highlight under roof

    // Roof with a lip + shading
    const roof = hex(b.roofColor);
    g.fillStyle(roof, 1);
    g.fillRect(px - 4, py, pw + 8, ts + 6);
    g.fillStyle(0x000000, 0.12);
    g.fillRect(px - 4, py + ts + 2, pw + 8, 4);
    g.fillStyle(0xffffff, 0.08);
    g.fillRect(px - 4, py, pw + 8, 3);

    // Warm lit windows
    for (let i = 1; i < b.w - 1; i += 2) {
      const wx = px + i * ts + 6;
      const wy = py + ts + 8;
      g.fillStyle(0x3a2f1e, 1);
      g.fillRect(wx - 1, wy - 1, ts - 10, ts - 10);
      g.fillStyle(0xffd98a, 0.95);
      g.fillRect(wx, wy, ts - 12, ts - 12);
      addLight(scene, wx + (ts - 12) / 2, wy + (ts - 12) / 2, 20, 0xffcf7a, 0.28);
    }

    // Door
    if (b.entrance) {
      const dx = b.entrance.x * ts;
      const dy = b.entrance.y * ts;
      g.fillStyle(0x241812, 1);
      g.fillRect(dx + 4, dy - ts + 6, ts - 8, ts - 6);
      g.fillStyle(0xffd98a, 0.85);
      g.fillRect(dx + 5, dy - ts + 7, ts - 10, 4); // warm light spilling from doorway
      g.fillStyle(0xe3b341, 1);
      g.fillRect(dx + ts - 10, dy - ts + 16, 3, 3);
    }

    // Neon venue sign — the glowing name strip from the target mood
    const sign = scene.add.text(px + pw / 2, py - 4, b.name.toUpperCase(), {
      fontFamily: "monospace",
      fontSize: "13px",
      fontStyle: "bold",
      color: accent,
      backgroundColor: "#12131aee",
      padding: { x: 7, y: 3 },
    });
    sign.setOrigin(0.5, 1).setDepth(100000);
    sign.setStroke("#000000", 3);
    sign.setShadow(0, 0, accent, 8, true, true);
    addLight(scene, px + pw / 2, py - 12, 46, hex(accent), 0.4);

    if (b.status === "closed") {
      const closed = scene.add.text(px + pw / 2, py + ph / 2, "closed", {
        fontFamily: "monospace", fontSize: "11px", color: "#ffd7d7", backgroundColor: "#00000099",
        padding: { x: 3, y: 1 },
      });
      closed.setOrigin(0.5).setDepth(100001);
    }
  }
}

/** A translucent footprint + label for a sub-area (Phase 1B/1D). */
export function paintSubArea(scene: Phaser.Scene, map: TerrainSurface, sa: SubArea): void {
  const ts = map.tileSize;
  const px = sa.x * ts;
  const py = sa.y * ts;
  const pw = sa.w * ts;
  const ph = sa.h * ts;
  const accent = Phaser.Display.Color.HexStringToColor(sa.accent ?? "#f5efe0").color;

  const g = scene.add.graphics();
  g.setDepth(1); // just above terrain, below props/characters
  g.fillStyle(accent, 0.1);
  g.fillRoundedRect(px + 2, py + 2, pw - 4, ph - 4, 8);
  g.lineStyle(1, accent, 0.4);
  g.strokeRoundedRect(px + 2, py + 2, pw - 4, ph - 4, 8);

  const lx = (sa.labelX ?? sa.x + sa.w / 2) * ts;
  const ly = (sa.labelY ?? sa.y) * ts;
  const label = scene.add.text(lx, ly - 2, sa.name, {
    fontFamily: "monospace", fontSize: "9px",
    color: sa.accent ?? "#f5efe0", backgroundColor: "#0e1016cc",
    padding: { x: 4, y: 1 },
  });
  label.setOrigin(0.5, 1).setDepth(90050); // above dusk overlay, below big labels
}

/** Draws a single world object with shading and drop shadows. */
export function paintObject(scene: Phaser.Scene, map: TerrainSurface, o: WorldObject): void {
  const ts = map.tileSize;
  const cx = o.x * ts + ts / 2;
  const cy = o.y * ts + ts / 2;
  const g = scene.add.graphics();
  g.setDepth(cy);

  const shadow = (rx: number, ry = rx * 0.5) => {
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(cx, cy + 8, rx, ry);
  };

  switch (o.type) {
    case "tree": {
      shadow(24, 10);
      g.fillStyle(0x5a3a1a, 1);
      g.fillRect(cx - 3, cy, 6, 13);
      g.fillStyle(0x432a12, 1);
      g.fillRect(cx + 1, cy, 2, 13);
      g.fillStyle(0x3f6b28, 1); // dark canopy base
      g.fillCircle(cx, cy - 3, 15);
      g.fillStyle(0x4e8330, 1);
      g.fillCircle(cx - 3, cy - 6, 12);
      g.fillStyle(0x66a83e, 1); // highlight
      g.fillCircle(cx - 5, cy - 9, 7);
      g.fillStyle(0x81c159, 0.8);
      g.fillCircle(cx - 6, cy - 11, 3);
      break;
    }
    case "blossom": {
      shadow(24, 10);
      g.fillStyle(0x6b4a2a, 1);
      g.fillRect(cx - 3, cy, 6, 13);
      g.fillStyle(0x4a3018, 1);
      g.fillRect(cx + 1, cy, 2, 13);
      g.fillStyle(0xe79ec2, 1); // blossom base
      g.fillCircle(cx, cy - 3, 15);
      g.fillStyle(0xf4b8d6, 1);
      g.fillCircle(cx - 3, cy - 6, 12);
      g.fillStyle(0xffd6e8, 1);
      g.fillCircle(cx - 5, cy - 9, 7);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(cx - 6, cy - 11, 2);
      break;
    }
    case "bush":
      shadow(16, 7);
      g.fillStyle(0x3f6b28, 1);
      g.fillCircle(cx, cy, 11);
      g.fillStyle(0x4e8330, 1);
      g.fillCircle(cx - 3, cy - 3, 7);
      g.fillStyle(0x66a83e, 0.8);
      g.fillCircle(cx - 4, cy - 5, 3);
      break;
    case "flowers": {
      shadow(12, 5);
      const cols = [0xffffff, 0xf2c94c, 0xe06c9f, 0x9b7bd6, 0xff8a5c];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const fx = cx + Math.cos(a) * (5 + (i % 2) * 3);
        const fy = cy + Math.sin(a) * (4 + (i % 2) * 2);
        g.fillStyle(0x3f6b28, 1);
        g.fillRect(fx, fy, 1, 3);
        g.fillStyle(cols[(i + o.x) % cols.length], 1);
        g.fillCircle(fx, fy - 1, 2);
      }
      break;
    }
    case "rock":
      shadow(16, 7);
      g.fillStyle(0x7c828a, 1);
      g.fillEllipse(cx, cy, 22, 15);
      g.fillStyle(0x969ca4, 1);
      g.fillEllipse(cx - 2, cy - 2, 14, 9);
      g.fillStyle(0xb4b9c0, 0.7);
      g.fillEllipse(cx - 4, cy - 4, 6, 4);
      break;
    case "planter":
      shadow(14, 6);
      g.fillStyle(0x8a5a3b, 1);
      g.fillRect(cx - 10, cy - 4, 20, 12);
      g.fillStyle(0x6b4329, 1);
      g.fillRect(cx - 10, cy + 5, 20, 3);
      g.fillStyle(0x4e8330, 1);
      g.fillCircle(cx, cy - 6, 8);
      g.fillStyle(0xe06c9f, 1);
      g.fillCircle(cx - 3, cy - 8, 2);
      break;
    case "bench":
      shadow(18, 6);
      g.fillStyle(0x9a6a44, 1);
      g.fillRect(cx - 14, cy - 3, 28, 6);
      g.fillStyle(0x7a4f30, 1);
      g.fillRect(cx - 14, cy + 1, 28, 2);
      g.fillRect(cx - 12, cy + 3, 4, 6);
      g.fillRect(cx + 8, cy + 3, 4, 6);
      break;
    case "lamp":
      shadow(10, 5);
      g.fillStyle(0x2b2b30, 1);
      g.fillRect(cx - 2, cy - 6, 4, 22);
      g.fillStyle(0x1f1f24, 1);
      g.fillRect(cx + 1, cy - 6, 1, 22);
      g.fillStyle(0xfff0b8, 1);
      g.fillCircle(cx, cy - 9, 5);
      addLight(scene, cx, cy - 9, 34, 0xffcf7a, 0.7);
      break;
    case "fountain": {
      const fx = cx + ts / 2;
      const fy = cy + ts / 2;
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(fx, fy + 6, 60, 26);
      g.fillStyle(0x9aa4b0, 1);
      g.fillCircle(fx, fy, 27);
      g.fillStyle(0x7c8794, 1);
      g.fillCircle(fx, fy, 27);
      g.fillStyle(0x3f97cf, 1);
      g.fillCircle(fx, fy, 21);
      g.fillStyle(0x62aede, 0.8);
      g.fillCircle(fx, fy, 14);
      g.fillStyle(0xcdeaf8, 1);
      g.fillCircle(fx, fy, 6);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(fx - 2, fy - 2, 2);
      break;
    }
    case "sign":
      shadow(10, 5);
      g.fillStyle(0x5a3f28, 1);
      g.fillRect(cx - 2, cy, 4, 14);
      g.fillStyle(0xb89663, 1);
      g.fillRect(cx - 16, cy - 12, 32, 14);
      g.fillStyle(0x8f7047, 1);
      g.fillRect(cx - 16, cy, 32, 2);
      if (o.label) {
        const t = scene.add.text(cx, cy - 5, o.label, {
          fontFamily: "monospace", fontSize: "8px", color: "#2a1a10", align: "center",
          wordWrap: { width: 30 },
        });
        t.setOrigin(0.5).setDepth(cy + 1);
      }
      break;
    case "billboard":
      shadow(20, 7);
      g.fillStyle(0x2b2b30, 1);
      g.fillRect(cx - 3, cy, 6, 16);
      g.fillStyle(0x11161f, 1);
      g.fillRect(cx - 24, cy - 24, 48, 26);
      g.lineStyle(2, 0xe3b341, 1);
      g.strokeRect(cx - 24, cy - 24, 48, 26);
      addLight(scene, cx, cy - 11, 30, 0xe3b341, 0.35);
      {
        const t = scene.add.text(cx, cy - 11, o.label ?? "AD", {
          fontFamily: "monospace", fontSize: "9px", color: "#e3b341", align: "center",
          wordWrap: { width: 44 },
        });
        t.setOrigin(0.5).setDepth(cy + 1);
      }
      break;
    case "table":
      shadow(14, 6);
      g.fillStyle(0x6b4a2f, 1);
      g.fillCircle(cx, cy + 2, 12);
      g.fillStyle(0x8a6440, 1);
      g.fillCircle(cx, cy, 12);
      g.fillStyle(0xa8815a, 0.7);
      g.fillCircle(cx - 3, cy - 3, 5);
      break;
  }
}

/**
 * A cozy dusk overlay: darkens + warms the whole scene beneath the additive
 * lights, so lamps, windows and neon read as pools of light. Sits above world
 * sprites but below labels/HUD.
 */
export function paintAmbience(scene: Phaser.Scene, map: WorldMap): void {
  const ts = map.tileSize;
  const w = map.widthTiles * ts;
  const h = map.heightTiles * ts;
  const g = scene.add.graphics();
  g.setDepth(90000);
  g.fillStyle(0x161a33, 0.36); // deep indigo dusk
  g.fillRect(0, 0, w, h);
  // A faint warm wash so lit areas feel golden rather than grey
  g.fillStyle(0x3a2a1e, 0.06);
  g.fillRect(0, 0, w, h);
  // Vignette — darker toward the edges, in a few falloff bands
  const band = ts * 2;
  for (let i = 0; i < 3; i++) {
    g.fillStyle(0x080a16, 0.14);
    const off = i * band;
    g.fillRect(0, off, w, band);
    g.fillRect(0, h - off - band, w, band);
    g.fillRect(off, 0, band, h);
    g.fillRect(w - off - band, 0, band, h);
  }
}

/**
 * Generates a shaded blocky character texture for a palette, cached under `key`.
 * Faces "down" (front) with a soft baked shadow, side shading and an outline.
 * Directional sprite sheets slot in later behind the same call.
 */
export function ensureCharacterTexture(
  scene: Phaser.Scene,
  key: string,
  palette: { skin: string; hair: string; top: string; bottom: string },
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const hex = (s: string) => Phaser.Display.Color.HexStringToColor(s).color;
  const dk = (c: number, amt: number) => Phaser.Display.Color.IntegerToColor(c).darken(amt).color;

  const skin = hex(palette.skin);
  const top = hex(palette.top);
  const bottom = hex(palette.bottom);
  const hair = hex(palette.hair);

  // Baked ground shadow
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(10, 27, 16, 5);

  // Silhouette outline (draw body 1px larger in near-black first)
  g.fillStyle(0x14110f, 1);
  g.fillRect(3, 1, 14, 26);

  // Legs
  g.fillStyle(bottom, 1);
  g.fillRect(5, 19, 4, 8);
  g.fillRect(11, 19, 4, 8);
  g.fillStyle(dk(bottom, 22), 1);
  g.fillRect(7, 19, 2, 8);
  g.fillRect(13, 19, 2, 8);

  // Torso + right-side shade
  g.fillStyle(top, 1);
  g.fillRect(4, 12, 12, 8);
  g.fillStyle(dk(top, 20), 1);
  g.fillRect(12, 12, 4, 8);
  g.fillStyle(0xffffff, 0.12);
  g.fillRect(4, 12, 12, 1);

  // Arms
  g.fillStyle(skin, 1);
  g.fillRect(2, 13, 3, 6);
  g.fillRect(15, 13, 3, 6);
  g.fillStyle(dk(skin, 18), 1);
  g.fillRect(15, 13, 3, 6);

  // Head + shade
  g.fillStyle(skin, 1);
  g.fillRect(5, 4, 10, 9);
  g.fillStyle(dk(skin, 16), 1);
  g.fillRect(12, 5, 3, 8);

  // Hair
  g.fillStyle(hair, 1);
  g.fillRect(4, 2, 12, 4);
  g.fillRect(4, 4, 3, 5);
  g.fillRect(13, 4, 3, 5);
  g.fillStyle(Phaser.Display.Color.IntegerToColor(hair).lighten(18).color, 1); // hair highlight
  g.fillRect(5, 2, 5, 1);

  // Eyes
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(7, 8, 2, 2);
  g.fillRect(11, 8, 2, 2);

  g.generateTexture(key, 20, 30);
  g.destroy();
}

/**
 * Paints an interior's shell: walls, their lit inner faces, and a marked exit.
 *
 * Interiors reuse `paintTerrain` for the floor and `paintObject` for props, so
 * this only has to draw what the outdoor world doesn't have — the enclosure.
 * Walls are drawn as blocks with a lighter top face and a darker skirt so the
 * room reads as a space with height rather than a flat plan.
 */
export function paintInteriorShell(scene: Phaser.Scene, interior: Interior): void {
  const ts = interior.tileSize;

  const g = scene.add.graphics();
  g.setDepth(1);

  for (const w of interior.walls) {
    const px = w.x * ts;
    const py = w.y * ts;
    const pw = w.w * ts;
    const ph = w.h * ts;

    // Body.
    g.fillStyle(0x6b5744, 1);
    g.fillRect(px, py, pw, ph);
    // Lit top edge, reading as the wall cap catching the room light.
    g.fillStyle(0x8a7157, 1);
    g.fillRect(px, py, pw, Math.min(6, ph));
    // Dark skirt where the wall meets the floor.
    g.fillStyle(0x4a3b2d, 1);
    g.fillRect(px, py + ph - 4, pw, 4);
    // Vertical seams so long walls don't read as one flat slab.
    g.fillStyle(0x5c4b3a, 0.7);
    for (let x = px + ts; x < px + pw; x += ts) g.fillRect(x, py, 1, ph);
  }

  // Exit: a lit doorway on the floor, so the way out is never ambiguous.
  const ex = interior.exit.x * ts;
  const ey = interior.exit.y * ts;
  const door = scene.add.graphics();
  door.setDepth(1.5);
  door.fillStyle(0x2b2118, 1);
  door.fillRect(ex + 2, ey, ts - 4, ts);
  door.fillStyle(0xf2d9a0, 0.85);
  door.fillRect(ex + 4, ey + ts - 10, ts - 8, 8);
  door.fillStyle(0xffeec4, 0.35);
  door.fillRect(ex, ey + ts - 6, ts, 10);

  const label = scene.add.text(ex + ts / 2, ey - 6, "EXIT", {
    fontFamily: "monospace",
    fontSize: "10px",
    color: "#ffeec4",
    backgroundColor: "#00000088",
    padding: { x: 3, y: 1 },
  });
  label.setOrigin(0.5, 1).setDepth(200001);
}
