import Phaser from "phaser";
import type { WorldMap, PersonSeed, Interior } from "@/world/schema";
import { INTENTS } from "@/world/schema";
import { bus, type NearPerson } from "./bus";
import {
  paintTerrain,
  paintBuildings,
  paintObject,
  paintSubArea,
  paintAmbience,
  paintInteriorShell,
  ensureCharacterTexture,
} from "./render";
import { getLocalIdentity, type PlayerIdentity } from "@/net/identity";
import { joinWorld, type RemotePlayerState } from "@/net/presence";
import { findInterior } from "@/world/interiors";
import { createVoice, type VoiceManager } from "@/net/voice";
import { captureError, logEvent } from "@/observability/monitor";

const PLAYER_SPEED = 165;
const NPC_SPEED = 40;
const PROXIMITY_TILES = 3.2;
/** Within this many tiles a peer's voice is at full volume; it fades to 0 at PROXIMITY_TILES. */
const VOICE_FULL_TILES = 1.0;

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
  /** Which interior they are inside, or null outdoors (Phase 1F). */
  interiorId: string | null;
}

export class WorldScene extends Phaser.Scene {
  private map!: WorldMap;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private solid: boolean[][] = [];
  private npcs: NpcState[] = [];

  /**
   * The place the player is currently standing in: an interior, or null for the
   * outdoor world. Everything that reads the world grid \u2014 collision, NPCs,
   * camera bounds, remote visibility \u2014 goes through the active place, so an
   * interior is a first-class location rather than an overlay on the map.
   */
  private interior: Interior | null = null;

  /** Display objects belonging to the active place, destroyed on transition. */
  private placeGfx: Phaser.GameObjects.GameObject[] = [];

  /** Active place dimensions in tiles \u2014 an interior is not the world's size. */
  private placeW = 0;
  private placeH = 0;

  /** Where to put the player back down when they leave an interior. */
  private returnTo: { x: number; y: number } | null = null;
  private walkTarget: { x: number; y: number } | null = null;
  private lastDistrict: string | null = null;
  private lastEntrance: string | null = null;
  private lastNearKey = "";
  private lastAudible = -1;

  // Networking
  private identity!: PlayerIdentity;
  private remotes = new Map<string, RemotePlayer>();
  private net: { pushMove: (now: number) => void; destroy: () => void } | null = null;
  private lastFlipX = false;

  // Proximity voice
  private voice: VoiceManager | null = null;
  private busOffs: Array<() => void> = [];

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

    this.paintOutdoor();

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
    this.solidCollider = this.physics.add.collider(this.player, this.solidGroup);

    // Camera
    this.applyPlaceBounds(worldW, worldH);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBackgroundColor("#3a5a2a");

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D") as typeof this.keys;

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onPointerDown(p));

    this.busOffs.push(bus.on("interior:leave", () => this.exitInterior()));

    this.startNetwork();
    this.startVoice();

    // Tear everything down cleanly when the scene ends.
    const teardown = () => {
      this.net?.destroy();
      this.voice?.destroy();
      this.busOffs.forEach((off) => off());
      this.busOffs = [];
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, teardown);
    this.events.once(Phaser.Scenes.Events.DESTROY, teardown);

    logEvent("world_entered", { world: map.id });
    bus.emit("world:ready", { name: map.name });
  }

  // --- Networking (live multiplayer) ---------------------------------------

  private startNetwork() {
    try {
      this.net = joinWorld(
        this.map.id,
        this.identity,
        () => ({
          x: this.player.x,
          y: this.player.y,
          flipX: this.lastFlipX,
          interiorId: this.interior?.id ?? null,
        }),
        {
          onJoin: (s) => this.addRemote(s),
          onMove: (m) => this.moveRemote(m.id, m.x, m.y, m.flipX, m.interiorId ?? null),
          onLeave: (id) => this.removeRemote(id),
          onCount: (c) => bus.emit("presence:count", c),
          onStatus: (s) => bus.emit("net:status", s),
        },
      );
    } catch (err) {
      // The world stays fully playable offline if realtime is unavailable.
      captureError(err, { where: "startNetwork" });
    }
  }

  private startVoice() {
    try {
      this.voice = createVoice(this.map.id, this.identity.id, {
        onStatus: (s) => bus.emit("voice:status", s),
        onLinks: (n) => bus.emit("voice:links", n),
      });
      // The React overlay drives the mic on/off (needs a user gesture anyway).
      this.busOffs.push(
        bus.on("voice:enable", () => void this.voice?.enableMic()),
        bus.on("voice:disable", () => this.voice?.disableMic()),
      );
    } catch (err) {
      captureError(err, { where: "startVoice" });
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
      this.moveRemote(s.id, s.x, s.y, s.flipX, s.interiorId ?? null);
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
      interiorId: s.interiorId ?? null,
    });

    // Open a voice connection to this player (audio stays silent until they're near).
    this.voice?.addPeer(s.id);
  }

  private moveRemote(
    id: string,
    x: number,
    y: number,
    flipX: boolean,
    interiorId: string | null,
  ) {
    const r = this.remotes.get(id);
    if (!r) return;

    // Crossing a threshold is a teleport, not a walk: snap rather than
    // interpolating a peer across the room they just left.
    if (r.interiorId !== interiorId) {
      r.interiorId = interiorId;
      r.sprite.setPosition(x, y);
    }
    r.target.x = x;
    r.target.y = y;
    r.flipX = flipX;
  }

  /** True when a remote player is standing in the same place as us. */
  private sharesPlace(r: RemotePlayer): boolean {
    return (r.interiorId ?? null) === (this.interior?.id ?? null);
  }

  private removeRemote(id: string) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.sprite.destroy();
    r.label.destroy();
    this.remotes.delete(id);
    this.voice?.removePeer(id);
  }

  private updateRemotes() {
    for (const r of this.remotes.values()) {
      // People in another interior are elsewhere, not invisible neighbours:
      // hide them and skip their motion entirely.
      const here = this.sharesPlace(r);
      r.sprite.setVisible(here);
      r.label.setVisible(here);
      if (!here) continue;

      // Smoothly interpolate toward the last position we heard.
      r.sprite.x += (r.target.x - r.sprite.x) * 0.25;
      r.sprite.y += (r.target.y - r.sprite.y) * 0.25;
      r.sprite.setFlipX(r.flipX);
      r.sprite.setDepth(r.sprite.y);
      r.label.setPosition(r.sprite.x, r.sprite.y - 20);
    }
  }


  // --- Places: the outdoor world, or a building interior -------------------

  /**
   * Records every display object a paint pass creates, so leaving a place can
   * destroy exactly what that place added and nothing else.
   *
   * Diffing the display list is deliberate: the alternative is threading a
   * container or a return value through every painter in render.ts, which would
   * couple the renderer to the transition mechanism for no gain.
   */
  private paintPlace(paint: () => void) {
    const before = new Set(this.children.list);
    paint();
    this.placeGfx = this.children.list.filter((o) => !before.has(o));
  }

  private paintOutdoor() {
    const map = this.map;
    this.paintPlace(() => {
      paintTerrain(this, map);
      for (const sa of map.subAreas ?? []) paintSubArea(this, map, sa);
      paintBuildings(this, map);
      for (const o of map.objects) paintObject(this, map, o);
      paintAmbience(this, map);
    });
    this.placeW = map.widthTiles;
    this.placeH = map.heightTiles;
    this.buildOutdoorCollision();
    this.spawnPeople(map.people);
  }

  private paintInterior(interior: Interior) {
    this.paintPlace(() => {
      paintTerrain(this, interior);
      for (const sa of interior.subAreas ?? []) paintSubArea(this, interior, sa);
      paintInteriorShell(this, interior);
      for (const o of interior.objects) paintObject(this, interior, o);
    });
    this.placeW = interior.widthTiles;
    this.placeH = interior.heightTiles;
    this.buildInteriorCollision(interior);
    this.spawnPeople(interior.people ?? []);
  }

  /** Destroys everything belonging to the place we are leaving. */
  private teardownPlace() {
    this.placeGfx.forEach((o) => o.destroy());
    this.placeGfx = [];

    for (const n of this.npcs) {
      n.sprite.destroy();
      n.label.destroy();
    }
    this.npcs = [];
    this.lastNearKey = "";

    this.solidCollider?.destroy();
    this.solidCollider = null;
    this.solidGroup?.clear(true, true);
    this.solidGroup?.destroy();
  }

  private applyPlaceBounds(width: number, height: number) {
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(0, 0, width, height);
    // An interior is smaller than the viewport, so whatever sits beyond its
    // walls is visible. Grass green there would read as a hole in the building.
    this.cameras.main.setBackgroundColor(this.interior ? "#241c15" : "#3a5a2a");
  }

  /**
   * Moves the player into a building interior.
   *
   * The outdoor world is torn down rather than hidden. An interior is its own
   * surface with its own dimensions and its own collision grid, so keeping the
   * outdoor grid alive underneath would mean two sources of truth for "is this
   * tile solid".
   */
  private enterInterior(interior: Interior) {
    if (this.interior?.id === interior.id) return;

    // Remember the tile just outside the door so leaving puts them back where
    // they walked in from, not on top of the entrance trigger.
    const building = this.map.buildings.find((b) => b.id === interior.buildingId);
    const ts = this.map.tileSize;
    if (building?.entrance) {
      this.returnTo = {
        x: building.entrance.x * ts + ts / 2,
        y: (building.entrance.y + 1) * ts + ts / 2,
      };
    }

    this.teardownPlace();
    this.interior = interior;
    this.paintInterior(interior);

    this.applyPlaceBounds(
      interior.widthTiles * interior.tileSize,
      interior.heightTiles * interior.tileSize,
    );
    this.solidCollider = this.physics.add.collider(this.player, this.solidGroup);

    this.placePlayerAtTile(interior.spawn.x, interior.spawn.y, interior.tileSize);
    this.walkTarget = null;
    this.lastEntrance = null;
    this.lastDistrict = null;

    logEvent("interior_entered", { interior: interior.id });
    bus.emit("interior:change", {
      id: interior.id,
      name: interior.name,
      buildingId: interior.buildingId,
    });
  }

  /** Returns the player to the outdoor world, at the door they came in by. */
  private exitInterior() {
    if (!this.interior) return;
    const left = this.interior;

    this.teardownPlace();
    this.interior = null;
    this.paintOutdoor();

    const ts = this.map.tileSize;
    this.applyPlaceBounds(this.map.widthTiles * ts, this.map.heightTiles * ts);
    this.solidCollider = this.physics.add.collider(this.player, this.solidGroup);

    const back = this.returnTo ?? {
      x: this.map.spawn.x * ts + ts / 2,
      y: this.map.spawn.y * ts + ts / 2,
    };
    this.player.setPosition(back.x, back.y);
    (this.player.body as Phaser.Physics.Arcade.Body).reset(back.x, back.y);
    this.walkTarget = null;
    // Suppress the entrance trigger we are standing next to, so stepping out
    // doesn't immediately walk us back in.
    this.lastEntrance = left.buildingId;
    this.lastDistrict = null;

    logEvent("interior_left", { interior: left.id });
    bus.emit("interior:change", null);
  }

  private placePlayerAtTile(tx: number, ty: number, tileSize: number) {
    const px = tx * tileSize + tileSize / 2;
    const py = ty * tileSize + tileSize / 2;
    this.player.setPosition(px, py);
    (this.player.body as Phaser.Physics.Arcade.Body).reset(px, py);
  }

  /** The place the player is standing in, as a paintable surface. */
  private get surface() {
    return this.interior ?? this.map;
  }

  // --- Collision -----------------------------------------------------------

  private solidGroup!: Phaser.Physics.Arcade.StaticGroup;
  private solidCollider: Phaser.Physics.Arcade.Collider | null = null;

  /** Solid tiles for a building interior: its walls, plus any solid props. */
  private buildInteriorCollision(interior: Interior) {
    const W = interior.widthTiles;
    const H = interior.heightTiles;
    this.solid = Array.from({ length: H }, () => Array<boolean>(W).fill(false));

    for (const w of interior.walls) {
      for (let y = w.y; y < w.y + w.h; y++)
        for (let x = w.x; x < w.x + w.w; x++) this.mark(x, y);
    }
    for (const o of interior.objects) {
      if (o.solid) this.mark(o.x, o.y);
    }
    // The exit tile always stays walkable, whatever a wall rectangle says.
    this.solid[interior.exit.y][interior.exit.x] = false;

    this.rasterizeSolids(interior.tileSize);
  }

  private buildOutdoorCollision() {
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

    this.rasterizeSolids(map.tileSize);
  }

  /** Merges the boolean grid into row-run static bodies. */
  private rasterizeSolids(ts: number) {
    const W = this.placeW;
    const H = this.placeH;
    this.solidGroup = this.physics.add.staticGroup();
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
    if (y >= 0 && y < this.placeH && x >= 0 && x < this.placeW) this.solid[y][x] = true;
  }

  private isSolidTile(tx: number, ty: number): boolean {
    if (ty < 0 || ty >= this.placeH || tx < 0 || tx >= this.placeW) return true;
    return this.solid[ty][tx];
  }

  // --- NPCs ----------------------------------------------------------------

  private spawnPeople(people: PersonSeed[]) {
    const ts = this.map.tileSize;
    for (const seed of people) {
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
    // Live players count toward conversation range too, and their voice volume
    // is driven by the same distance: full within VOICE_FULL_TILES, fading to
    // silence at PROXIMITY_TILES.
    let audible = 0;
    for (const [id, r] of this.remotes) {
      // Someone in another interior is not nearby, however close their
      // coordinates happen to look.
      if (!this.sharesPlace(r)) {
        this.voice?.setPeerVolume(id, 0);
        continue;
      }
      const d = Math.hypot(r.sprite.x - this.player.x, r.sprite.y - this.player.y) / ts;
      if (d <= PROXIMITY_TILES) {
        near.push({ person: r.seed, distanceTiles: Math.round(d * 10) / 10 });
        r.label.setColor("#c8ffce");
      } else {
        r.label.setColor("#ffffff");
      }
      const vol = Phaser.Math.Clamp(
        (PROXIMITY_TILES - d) / (PROXIMITY_TILES - VOICE_FULL_TILES),
        0,
        1,
      );
      if (vol > 0) audible += 1;
      this.voice?.setPeerVolume(id, vol);
    }

    if (audible !== this.lastAudible) {
      this.lastAudible = audible;
      bus.emit("voice:audible", audible);
    }

    near.sort((a, b) => a.distanceTiles - b.distanceTiles);
    const key = near.map((n) => n.person.id).join(",");
    if (key !== this.lastNearKey) {
      this.lastNearKey = key;
      bus.emit("proximity:update", near);
    }
  }

  private updateDistrict() {
    // Inside a building the interior IS the location; the outdoor district
    // labels are meaningless there.
    if (this.interior) {
      const key = `interior:${this.interior.id}`;
      if (key !== this.lastDistrict) {
        this.lastDistrict = key;
        bus.emit("district:change", { id: this.interior.districtId, name: this.interior.name });
      }
      return;
    }

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

  /**
   * Walking onto a door tile moves the player between places.
   *
   * Outdoors that means a building entrance; inside it means the interior's
   * exit tile. `lastEntrance` debounces the trigger so standing on the tile
   * fires once rather than every frame.
   */
  private updateEntrance() {
    const ts = this.map.tileSize;
    const ptx = Math.floor(this.player.x / ts);
    const pty = Math.floor(this.player.y / ts);

    if (this.interior) {
      if (ptx === this.interior.exit.x && pty === this.interior.exit.y) this.exitInterior();
      return;
    }

    let onEntrance: string | null = null;
    for (const b of this.map.buildings) {
      if (b.enterable && b.entrance && b.entrance.x === ptx && b.entrance.y === pty) {
        onEntrance = b.id;
        if (this.lastEntrance !== b.id) {
          bus.emit("building:enter", { id: b.id, name: b.name, interiorId: b.interiorId });
          const inside = findInterior(b.interiorId);
          if (inside) {
            this.lastEntrance = b.id;
            this.enterInterior(inside);
            return;
          }
        }
        break;
      }
    }
    this.lastEntrance = onEntrance;
  }
}
