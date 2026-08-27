import Phaser from "phaser";
import type { WorldMap, WorldObject } from "@/world/schema";

/** Terrain fill colours (cozy Pokémon-era palette). */
const TERRAIN_COLORS: Record<string, number> = {
  grass: 0x7cb342,
  grassdark: 0x689f38,
  path: 0xc9a66b,
  plaza: 0xd8c9a0,
  water: 0x4a9fd4,
  sand: 0xe4d29a,
};

/**
 * Paints the terrain once into a single Graphics object. Static — drawn on
 * create() and never cleared, so it costs nothing per frame.
 */
export function paintTerrain(scene: Phaser.Scene, map: WorldMap): void {
  const ts = map.tileSize;
  const g = scene.add.graphics();
  g.setDepth(0);

  // Base fill
  g.fillStyle(TERRAIN_COLORS[map.baseTerrain], 1);
  g.fillRect(0, 0, map.widthTiles * ts, map.heightTiles * ts);

  // Painted regions, in order
  for (const r of map.terrain) {
    g.fillStyle(TERRAIN_COLORS[r.type] ?? 0x000000, 1);
    g.fillRect(r.x * ts, r.y * ts, r.w * ts, r.h * ts);
  }

  // Subtle tile grid for that pixel-RPG feel
  g.lineStyle(1, 0x000000, 0.05);
  for (let x = 0; x <= map.widthTiles; x++) {
    g.lineBetween(x * ts, 0, x * ts, map.heightTiles * ts);
  }
  for (let y = 0; y <= map.heightTiles; y++) {
    g.lineBetween(0, y * ts, map.widthTiles * ts, y * ts);
  }
}

/** Draws every building (walls, roof, door, windows, name plate). */
export function paintBuildings(scene: Phaser.Scene, map: WorldMap): void {
  const ts = map.tileSize;
  for (const b of map.buildings) {
    const px = b.x * ts;
    const py = b.y * ts;
    const pw = b.w * ts;
    const ph = b.h * ts;

    const g = scene.add.graphics();
    g.setDepth(py + ph); // depth-sort by base so player can pass "behind"

    // Wall
    g.fillStyle(Phaser.Display.Color.HexStringToColor("#" + b.wallColor.slice(1)).color, 1);
    g.fillRect(px, py + ts, pw, ph - ts);
    // Roof
    g.fillStyle(Phaser.Display.Color.HexStringToColor("#" + b.roofColor.slice(1)).color, 1);
    g.fillRect(px - 4, py, pw + 8, ts + 6);
    // Windows
    g.fillStyle(0xfdf6d8, 0.9);
    for (let i = 1; i < b.w - 1; i += 2) {
      g.fillRect(px + i * ts + 6, py + ts + 8, ts - 12, ts - 12);
    }

    // Door at entrance
    if (b.entrance) {
      const dx = b.entrance.x * ts;
      const dy = b.entrance.y * ts;
      g.fillStyle(0x2a1a10, 1);
      // Door faces whichever building edge it sits on
      g.fillRect(dx + 4, dy - ts + 6, ts - 8, ts - 6);
      g.fillStyle(0xe3b341, 1);
      g.fillRect(dx + ts - 10, dy - ts + 16, 3, 3); // handle
    }

    // Name plate
    const label = scene.add.text(px + pw / 2, py - 6, b.name, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#fff",
      backgroundColor: "#00000088",
      padding: { x: 4, y: 2 },
    });
    label.setOrigin(0.5, 1).setDepth(100000);

    // Sponsor / status hint
    if (b.status === "closed") {
      const closed = scene.add.text(px + pw / 2, py + ph / 2, "closed", {
        fontFamily: "monospace", fontSize: "11px", color: "#ffd7d7", backgroundColor: "#00000099",
        padding: { x: 3, y: 1 },
      });
      closed.setOrigin(0.5).setDepth(100001);
    }
  }
}

/** Draws a single world object. Returns its approximate footprint radius (px) unused here. */
export function paintObject(scene: Phaser.Scene, map: WorldMap, o: WorldObject): void {
  const ts = map.tileSize;
  const cx = o.x * ts + ts / 2;
  const cy = o.y * ts + ts / 2;
  const g = scene.add.graphics();
  g.setDepth(cy);

  switch (o.type) {
    case "tree":
      g.fillStyle(0x5a3a1a, 1);
      g.fillRect(cx - 3, cy, 6, 12);
      g.fillStyle(0x4e7d2e, 1);
      g.fillCircle(cx, cy - 4, 14);
      g.fillStyle(0x67a83e, 1);
      g.fillCircle(cx - 4, cy - 8, 8);
      break;
    case "bush":
      g.fillStyle(0x4e7d2e, 1);
      g.fillCircle(cx, cy, 10);
      break;
    case "planter":
      g.fillStyle(0x8a5a3b, 1);
      g.fillRect(cx - 10, cy - 4, 20, 12);
      g.fillStyle(0x67a83e, 1);
      g.fillCircle(cx, cy - 6, 8);
      break;
    case "bench":
      g.fillStyle(0x8a5a3b, 1);
      g.fillRect(cx - 14, cy - 3, 28, 6);
      g.fillRect(cx - 12, cy + 3, 4, 6);
      g.fillRect(cx + 8, cy + 3, 4, 6);
      break;
    case "lamp":
      g.fillStyle(0x333333, 1);
      g.fillRect(cx - 2, cy - 4, 4, 20);
      g.fillStyle(0xffe08a, 1);
      g.fillCircle(cx, cy - 8, 6);
      break;
    case "fountain": {
      g.fillStyle(0x8f9aa6, 1);
      g.fillCircle(cx + ts / 2, cy + ts / 2, 26);
      g.fillStyle(0x4a9fd4, 1);
      g.fillCircle(cx + ts / 2, cy + ts / 2, 20);
      g.fillStyle(0xbfe3f5, 1);
      g.fillCircle(cx + ts / 2, cy + ts / 2, 8);
      break;
    }
    case "sign":
      g.fillStyle(0x6b4a2f, 1);
      g.fillRect(cx - 2, cy, 4, 14);
      g.fillStyle(0xc9a66b, 1);
      g.fillRect(cx - 16, cy - 12, 32, 14);
      if (o.label) {
        const t = scene.add.text(cx, cy - 5, o.label, {
          fontFamily: "monospace", fontSize: "8px", color: "#2a1a10", align: "center",
          wordWrap: { width: 30 },
        });
        t.setOrigin(0.5).setDepth(cy + 1);
      }
      break;
    case "billboard":
    case "table":
      if (o.type === "billboard") {
        g.fillStyle(0x333333, 1);
        g.fillRect(cx - 3, cy, 6, 16);
        g.fillStyle(0x1b2530, 1);
        g.fillRect(cx - 24, cy - 24, 48, 26);
        g.lineStyle(2, 0xe3b341, 1);
        g.strokeRect(cx - 24, cy - 24, 48, 26);
        const t = scene.add.text(cx, cy - 11, o.label ?? "AD", {
          fontFamily: "monospace", fontSize: "9px", color: "#e3b341", align: "center",
          wordWrap: { width: 44 },
        });
        t.setOrigin(0.5).setDepth(cy + 1);
      } else {
        g.fillStyle(0x8a5a3b, 1);
        g.fillCircle(cx, cy, 12);
      }
      break;
  }
}

/**
 * Generates a small blocky character texture for a given palette and caches it
 * under `key`. Faces "down" (front). Good enough for the foundation; real
 * directional sprite sheets slot in later.
 */
export function ensureCharacterTexture(
  scene: Phaser.Scene,
  key: string,
  palette: { skin: string; hair: string; top: string; bottom: string },
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const hex = (s: string) => Phaser.Display.Color.HexStringToColor("#" + s.slice(1)).color;

  // canvas 20x28
  // legs
  g.fillStyle(hex(palette.bottom), 1);
  g.fillRect(5, 19, 4, 8);
  g.fillRect(11, 19, 4, 8);
  // torso
  g.fillStyle(hex(palette.top), 1);
  g.fillRect(4, 12, 12, 9);
  // arms
  g.fillStyle(hex(palette.skin), 1);
  g.fillRect(2, 13, 3, 6);
  g.fillRect(15, 13, 3, 6);
  // head
  g.fillStyle(hex(palette.skin), 1);
  g.fillRect(5, 4, 10, 9);
  // hair
  g.fillStyle(hex(palette.hair), 1);
  g.fillRect(4, 2, 12, 4);
  g.fillRect(4, 4, 3, 4);
  g.fillRect(13, 4, 3, 4);
  // eyes
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(7, 8, 2, 2);
  g.fillRect(11, 8, 2, 2);

  g.generateTexture(key, 20, 28);
  g.destroy();
}
