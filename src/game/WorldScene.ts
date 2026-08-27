import Phaser from "phaser";
import type { WorldMap, PersonSeed } from "@/world/schema";
import { INTENTS } from "@/world/schema";
import { bus, type NearPerson } from "./bus";
import {
  paintTerrain,
  paintBuildings,
  paintObject,
  ensureCharacterTexture,
} from "./render";

const PLAYER_SPEED = 165;
const NPC_SPEED = 40;
const PROXIMITY_TILES = 3.2;

interface NpcState {
  seed: PersonSeed;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  spawn: { x: number; y: number };
  target: { x: number; y: number };
  pauseUntil: number;
}

export class WorldScene extends Phaser.Scene {
  private map!: WorldMap;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private solid: boolean[][] = [];
  private npcs: NpcState[] = [];
  private walkTarget: { x: number; y: number } | null = null;
  private lastDistrict: string | null = null;
  private lastEntrance: string | null = null;
  private lastNearKey = "";

  constructor() {
    super("world");
  }

  init(data: { map: WorldMap }) {
    this.map = data.map;
  }

  create() {
    const map = this.map;
    const ts = map.tileSize;
    const worldW = map.widthTiles * ts;
    const worldH = map.heightTiles * ts;

    paintTerrain(this, map);
    paintBuildings(this, map);
    for (const o of map.objects) paintObject(this, map, o);

    this.buildCollision();

    // Player
    ensureCharacterTexture(this, "char-player", {
      skin: "#e8b48c", hair: "#2a2a2a", top: "#c33c3c", bottom: "#2f3b4a",
    });
    this.player = this.physics.add.sprite(
      map.spawn.x * ts + ts / 2,
      map.spawn.y * ts + ts / 2,
      "char-player",
    );
    this.player.setDepth(this.player.y);
    this.player.setCollideWorldBounds(true);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(14, 12).setOffset(3, 15);

    // Player shadow + name tag
    const tag = this.add.text(this.player.x, this.player.y - 22, "You", {
      fontFamily: "monospace", fontSize: "11px", color: "#fff",
      backgroundColor: "#c33c3c", padding: { x: 3, y: 1 },
    });
    tag.setOrigin(0.5, 1).setDepth(200000);
    this.player.setData("tag", tag);

    // Collisions
    this.physics.add.collider(this.player, this.solidGroup);

    // NPCs
    this.spawnNpcs();

    // Camera
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBackgroundColor("#3a5a2a");

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D") as typeof this.keys;

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onPointerDown(p));

    bus.emit("world:ready", { name: map.name });
  }

  // --- Collision -----------------------------------------------------------

  private solidGroup!: Phaser.Physics.Arcade.StaticGroup;

  private buildCollision() {
    const map = this.map;
    const W = map.widthTiles;
    const H = map.heightTiles;
    this.solid = Array.from({ length: H }, () => Array<boolean>(W).fill(false));

    // Water
    for (const r of map.terrain) {
      if (r.type !== "water") continue;
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) this.mark(x, y);
    }
    // Buildings (footprint solid, entrance left open)
    for (const b of map.buildings) {
      for (let y = b.y; y < b.y + b.h; y++)
        for (let x = b.x; x < b.x + b.w; x++) {
          if (b.entrance && b.entrance.x === x && b.entrance.y === y) continue;
          this.mark(x, y);
        }
    }
    // Solid objects
    for (const o of map.objects) {
      if (o.solid) this.mark(o.x, o.y);
      if (o.type === "fountain") {
        // fountain is 2x2 visually
        this.mark(o.x, o.y); this.mark(o.x + 1, o.y);
        this.mark(o.x, o.y + 1); this.mark(o.x + 1, o.y + 1);
      }
    }

    // Merge row-runs into static bodies
    this.solidGroup = this.physics.add.staticGroup();
    const ts = map.tileSize;
    for (let y = 0; y < H; y++) {
      let runStart = -1;
      for (let x = 0; x <= W; x++) {
        const s = x < W && this.solid[y][x];
        if (s && runStart < 0) runStart = x;
        if (!s && runStart >= 0) {
          const w = x - runStart;
          const rect = this.add.rectangle(
            runStart * ts, y * ts, w * ts, ts, 0x000000, 0,
          ).setOrigin(0, 0);
          this.solidGroup.add(rect);
          const body = rect.body as Phaser.Physics.Arcade.StaticBody;
          body.updateFromGameObject();
          runStart = -1;
        }
      }
    }
  }

  private mark(x: number, y: number) {
    if (y >= 0 && y < this.map.heightTiles && x >= 0 && x < this.map.widthTiles)
      this.solid[y][x] = true;
  }

  private isSolidTile(tx: number, ty: number): boolean {
    if (ty < 0 || ty >= this.map.heightTiles || tx < 0 || tx >= this.map.widthTiles)
      return true;
    return this.solid[ty][tx];
  }

  // --- NPCs ----------------------------------------------------------------

  private spawnNpcs() {
    const ts = this.map.tileSize;
    for (const seed of this.map.people) {
      ensureCharacterTexture(this, `char-${seed.id}`, seed.palette);
      const sprite = this.add.sprite(
        seed.x * ts + ts / 2, seed.y * ts + ts / 2, `char-${seed.id}`,
      );
      sprite.setDepth(sprite.y);

      const intent = INTENTS[seed.intent];
      const label = this.add.text(
        sprite.x, sprite.y - 22,
        `${intent.emoji} ${seed.name.split(" ")[0]}`,
        {
          fontFamily: "monospace", fontSize: "11px", color: "#fff",
          backgroundColor: "#00000099", padding: { x: 3, y: 1 },
        },
      );
      label.setOrigin(0.5, 1).setDepth(200000);

      this.npcs.push({
        seed, sprite, label,
        spawn: { x: seed.x, y: seed.y },
        target: { x: seed.x, y: seed.y },
        pauseUntil: 0,
      });
    }
  }

  // --- Input ---------------------------------------------------------------

  private onPointerDown(p: Phaser.Input.Pointer) {
    const wx = p.worldX;
    const wy = p.worldY;

    // Hit-test avatars first — clicking a person is intentional selection,
    // never movement, and never a consequential action.
    for (const n of this.npcs) {
      const b = n.sprite.getBounds();
      // generous hit padding
      if (wx >= b.x - 6 && wx <= b.right + 6 && wy >= b.y - 6 && wy <= b.bottom + 6) {
        bus.emit("person:selected", n.seed);
        return;
      }
    }

    // Otherwise click-to-walk.
    this.walkTarget = { x: wx, y: wy };
  }

  private readKeyboardVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) y += 1;
    return { x, y };
  }

  // --- Update loop ---------------------------------------------------------

  update(time: number, delta: number) {
    this.updatePlayer();
    this.updateNpcs(time, delta);
    this.updateProximity();
    this.updateDistrict();
    this.updateEntrance();
  }

  private updatePlayer() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const kb = this.readKeyboardVector();

    if (kb.x !== 0 || kb.y !== 0) {
      // Keyboard input always overrides click-to-walk.
      this.walkTarget = null;
      const v = new Phaser.Math.Vector2(kb.x, kb.y).normalize().scale(PLAYER_SPEED);
      body.setVelocity(v.x, v.y);
      this.player.setFlipX(kb.x < 0);
    } else if (this.walkTarget) {
      const dx = this.walkTarget.x - this.player.x;
      const dy = this.walkTarget.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        this.walkTarget = null;
        body.setVelocity(0, 0);
      } else {
        const v = new Phaser.Math.Vector2(dx, dy).normalize().scale(PLAYER_SPEED);
        body.setVelocity(v.x, v.y);
        this.player.setFlipX(dx < 0);
      }
    } else {
      body.setVelocity(0, 0);
    }

    // Bob animation while moving
    const moving = body.velocity.lengthSq() > 1;
    this.player.y += 0; // no-op; keep hook for future anim
    this.player.setScale(1, moving ? 1 + Math.sin(this.time.now / 80) * 0.03 : 1);

    this.player.setDepth(this.player.y);
    const tag = this.player.getData("tag") as Phaser.GameObjects.Text;
    tag.setPosition(this.player.x, this.player.y - 20);
  }

  private updateNpcs(time: number, delta: number) {
    const ts = this.map.tileSize;
    for (const n of this.npcs) {
      const wander = n.seed.wander ?? 0;
      const cx = n.sprite.x;
      const cy = n.sprite.y;
      const tgx = n.target.x * ts + ts / 2;
      const tgy = n.target.y * ts + ts / 2;
      const dx = tgx - cx;
      const dy = tgy - cy;
      const dist = Math.hypot(dx, dy);

      if (wander > 0 && (dist < 3 || time > n.pauseUntil) && time > n.pauseUntil) {
        // choose a new nearby, non-solid target tile
        for (let tries = 0; tries < 6; tries++) {
          const nx = Phaser.Math.Clamp(
            n.spawn.x + Phaser.Math.Between(-wander, wander), 1, this.map.widthTiles - 2);
          const ny = Phaser.Math.Clamp(
            n.spawn.y + Phaser.Math.Between(-wander, wander), 1, this.map.heightTiles - 2);
          if (!this.isSolidTile(nx, ny)) { n.target = { x: nx, y: ny }; break; }
        }
        n.pauseUntil = time + Phaser.Math.Between(1200, 3500);
      }

      if (dist > 2 && time < n.pauseUntil + 3500) {
        const step = (NPC_SPEED * delta) / 1000;
        const vx = (dx / dist) * step;
        const vy = (dy / dist) * step;
        const ntx = Math.floor((cx + vx) / ts);
        const nty = Math.floor((cy + vy) / ts);
        if (!this.isSolidTile(ntx, nty)) {
          n.sprite.x += vx;
          n.sprite.y += vy;
          n.sprite.setFlipX(vx < 0);
        }
      }
      n.sprite.setDepth(n.sprite.y);
      n.label.setPosition(n.sprite.x, n.sprite.y - 20);
    }
  }

  private updateProximity() {
    const ts = this.map.tileSize;
    const near: NearPerson[] = [];
    for (const n of this.npcs) {
      const d = Math.hypot(n.sprite.x - this.player.x, n.sprite.y - this.player.y) / ts;
      if (d <= PROXIMITY_TILES) {
        near.push({ person: n.seed, distanceTiles: Math.round(d * 10) / 10 });
        n.label.setColor("#c8ffce");
      } else {
        n.label.setColor("#ffffff");
      }
    }
    near.sort((a, b) => a.distanceTiles - b.distanceTiles);
    const key = near.map((n) => n.person.id).join(",");
    if (key !== this.lastNearKey) {
      this.lastNearKey = key;
      bus.emit("proximity:update", near);
    }
  }

  private updateDistrict() {
    const ts = this.map.tileSize;
    const ptx = this.player.x / ts;
    const pty = this.player.y / ts;
    let best: { id: string; name: string } | null = null;
    let bestD = 11; // tiles
    for (const d of this.map.districts) {
      const dist = Math.hypot(d.labelX - ptx, d.labelY - pty);
      if (dist < bestD) { bestD = dist; best = { id: d.id, name: d.name }; }
    }
    const key = best?.id ?? null;
    if (key !== this.lastDistrict) {
      this.lastDistrict = key;
      bus.emit("district:change", best);
    }
  }

  private updateEntrance() {
    const ts = this.map.tileSize;
    const ptx = Math.floor(this.player.x / ts);
    const pty = Math.floor(this.player.y / ts);
    let onEntrance: string | null = null;
    for (const b of this.map.buildings) {
      if (b.enterable && b.entrance && b.entrance.x === ptx && b.entrance.y === pty) {
        onEntrance = b.id;
        if (this.lastEntrance !== b.id) {
          bus.emit("building:enter", { id: b.id, name: b.name, interiorId: b.interiorId });
        }
        break;
      }
    }
    this.lastEntrance = onEntrance;
  }
}
