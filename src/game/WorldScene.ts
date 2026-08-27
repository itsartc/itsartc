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
import { getLocalIdentity, type PlayerIdentity } from "@/net/identity";
import { joinWorld, type RemotePlayerState } from "@/net/presence";

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

/** A network-driven player rendered from realtime presence + move broadcasts. */
interface RemotePlayer {
  seed: PersonSeed;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  /** Interpolation target in world pixels (last position we heard). */
  target: { x: number; y: number };
  flipX: boolean;
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

  // Networking
  private identity!: PlayerIdentity;
  private remotes = new Map<string, RemotePlayer>();
  private net: { pushMove: (now: number) => void; destroy: () => void } | null = null;
  private lastFlipX = false;

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

    // Player — appearance comes from this browser's live guest identity, so
    // other players see the same avatar we broadcast.
    this.identity = getLocalIdentity();
    ensureCharacterTexture(this, "char-player", this.identity.palette);
    this.player = this.physics.add.sprite(
      map.spawn.x * ts + ts / 2,
      map.spawn.y * ts + ts / 2,
      "char-player",
    );
    this.player.setDepth(this.player.y);
    this.player.setCollideWorldBounds(true);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(14, 12).setOffset(3, 15);

    // Player name tag
    const tag = this.add.text(
      this.player.x, this.player.y - 22,
      `${INTENTS[this.identity.intent].emoji} You`,
      {
        fontFamily: "monospace", fontSize: "11px", color: "#fff",
        backgroundColor: this.identity.palette.top, padding: { x: 3, y: 1 },
      },
    );
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

    this.startNetwork();

    // Tear the realtime channel down cleanly when the scene ends.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.net?.destroy());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.net?.destroy());

    bus.emit("world:ready", { name: map.name });
  }

  // --- Networking (live multiplayer) ---------------------------------------

  private startNetwork() {
    try {
      this.net = joinWorld(
        this.map.id,
        this.identity,
        () => ({ x: this.player.x, y: this.player.y, flipX: this.lastFlipX }),
        {
          onJoin: (s) => this.addRemote(s),
          onMove: (m) => this.moveRemote(m.id, m.x, m.y, m.flipX),
          onLeave: (id) => this.removeRemote(id),
          onCount: (c) => bus.emit("presence:count", c),
          onStatus: (s) => bus.emit("net:status", s),
        },
      );
    } catch (err) {
      // The world stays fully playable offline if realtime is unavailable.
      console.warn("[itsartc] realtime unavailable:", err);
    }
  }

  /** Build a PersonSeed from a remote player so the existing profile/proximity UI works unchanged. */
  private seedFromRemote(s: RemotePlayerState): PersonSeed {
    const ts = this.map.tileSize;
    return {
      id: s.id, name: s.name, role: s.role, company: s.company,
      location: s.location, intent: s.intent, bio: s.bio,
      workingOn: s.workingOn, lookingFor: s.lookingFor,
      x: Math.floor(s.x / ts), y: Math.floor(s.y / ts),
      palette: s.palette,
    };
  }

  private addRemote(s: RemotePlayerState) {
    if (this.remotes.has(s.id)) {
      // Re-sync of an existing peer: just refresh their target.
      this.moveRemote(s.id, s.x, s.y, s.flipX);
      return;
    }
    const key = `remote-${s.id}`;
    ensureCharacterTexture(this, key, s.palette);
    const sprite = this.add.sprite(s.x, s.y, key);
    sprite.setDepth(s.y);
    sprite.setFlipX(s.flipX);

    const intent = INTENTS[s.intent];
    const label = this.add.text(
      s.x, s.y - 22,
      `${intent.emoji} ${s.name.split(" ")[0]}`,
      {
        fontFamily: "monospace", fontSize: "11px", color: "#fff",
        backgroundColor: "#1e88e5cc", padding: { x: 3, y: 1 },
      },
    );
    label.setOrigin(0.5, 1).setDepth(200000);

    this.remotes.set(s.id, {
      seed: this.seedFromRemote(s),
      sprite, label,
      target: { x: s.x, y: s.y },
      flipX: s.flipX,
    });
  }

  private moveRemote(id: string, x: number, y: number, flipX: boolean) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.target.x = x;
    r.target.y = y;
    r.flipX = flipX;
  }

  private removeRemote(id: string) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.sprite.destroy();
    r.label.destroy();
    this.remotes.delete(id);
  }

  private updateRemotes() {
    for (const r of this.remotes.values()) {
      // Smoothly interpolate toward the last position we heard.
      r.sprite.x += (r.target.x - r.sprite.x) * 0.25;
      r.sprite.y += (r.target.y - r.sprite.y) * 0.25;
      r.sprite.setFlipX(r.flipX);
      r.sprite.setDepth(r.sprite.y);
      r.label.setPosition(r.sprite.x, r.sprite.y - 20);
    }
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
    // never movement, and never a consequential action. Live players take
    // precedence over seeded NPCs when they overlap.
    for (const r of this.remotes.values()) {
      const b = r.sprite.getBounds();
      if (wx >= b.x - 6 && wx <= b.right + 6 && wy >= b.y - 6 && wy <= b.bottom + 6) {
        bus.emit("person:selected", r.seed);
        return;
      }
    }
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
    this.updateRemotes();
    this.net?.pushMove(time);
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
      if (kb.x !== 0) { this.lastFlipX = kb.x < 0; this.player.setFlipX(this.lastFlipX); }
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
        this.lastFlipX = dx < 0;
        this.player.setFlipX(this.lastFlipX);
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
    // Live players count toward conversation range too.
    for (const r of this.remotes.values()) {
      const d = Math.hypot(r.sprite.x - this.player.x, r.sprite.y - this.player.y) / ts;
      if (d <= PROXIMITY_TILES) {
        near.push({ person: r.seed, distanceTiles: Math.round(d * 10) / 10 });
        r.label.setColor("#c8ffce");
      } else {
        r.label.setColor("#ffffff");
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
