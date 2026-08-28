import * as THREE from "three";
import type { WorldMap } from "@/world/schema";
import { WorldCollision } from "@/world/collision";
import { SCALE, tileCenterToThree, threeToWorldPixel, type WorldPixel } from "./coords";
import type { Input } from "./Input";
import { PLAYER_RADIUS } from "./build/PlayerBuilder";

/**
 * Player movement for the 3D world: fixed-step integration, three input
 * methods, and a facing yaw derived from the direction of travel.
 *
 * ## Parity with the 2D renderer
 *
 * The Phaser scene walks at 165 world pixels per second. Converting through
 * SCALE rather than hard-coding a unit speed means the two renderers cross the
 * same ground in the same time, which is what makes a mixed Phaser/Three world
 * viable in Phase 4 — a player who walks faster in one client would desync.
 *
 * ## Fixed step
 *
 * Movement integrates at a fixed 60 Hz regardless of frame rate, so a 144 Hz
 * monitor and a struggling laptop produce identical trajectories. The
 * accumulator is capped so a backgrounded tab resuming after ten seconds walks
 * a few frames, not six hundred.
 *
 * Collision is a small renderer-neutral circle-vs-tile solver. It uses the
 * same authored rules as the Phaser route without introducing a physics engine.
 */

/** Phaser's PLAYER_SPEED, in world pixels per second. Kept in sync deliberately. */
const PLAYER_SPEED_PIXELS = 165;

/** Top speed in scene units per second. */
const MAX_SPEED = PLAYER_SPEED_PIXELS * SCALE;

/** Seconds to reach top speed from rest, and to come to rest from top speed. */
const ACCEL_TIME = 0.11;
const DECEL_TIME = 0.09;

/** Fixed simulation step, in seconds. */
const STEP = 1 / 60;

/** Never simulate more than this many steps in one frame. */
const MAX_STEPS = 5;

/** Stop when this close to a click target, in scene units (~4 world pixels). */
const ARRIVE_RADIUS = 0.14;

/** How fast the avatar turns toward its direction of travel, in radians/sec. */
const TURN_RATE = 12;

/** Below this speed the avatar is considered idle. */
const IDLE_SPEED = 0.05;

export class PlayerController {
  /** Ground position in scene units. Y is always 0; the mesh stands on it. */
  readonly position = new THREE.Vector3();

  /** Facing angle in radians. 0 faces +Z, matching the avatar's local forward. */
  facing = 0;

  private readonly map: WorldMap;
  private readonly input: Input;
  private readonly collision: WorldCollision;

  private velocity = new THREE.Vector2();
  private walkTarget: THREE.Vector2 | null = null;
  private accumulator = 0;
  private blockedX = false;
  private blockedZ = false;

  constructor(map: WorldMap, input: Input) {
    this.map = map;
    this.input = input;
    this.collision = new WorldCollision(map);
    this.position.copy(tileCenterToThree(map.spawn.x, map.spawn.y));
    if (this.collision.collidesCircle(this.position.x, this.position.z, PLAYER_RADIUS)) {
      throw new Error(`World spawn (${map.spawn.x}, ${map.spawn.y}) overlaps collision`);
    }
  }

  /** Speed in scene units per second. */
  get speed(): number {
    return this.velocity.length();
  }

  get isMoving(): boolean {
    return this.speed > IDLE_SPEED;
  }

  /** True while the player is walking to a clicked point rather than steering. */
  get hasWalkTarget(): boolean {
    return this.walkTarget !== null;
  }

  get collisionInfo() {
    return {
      solidTiles: this.collision.solidTileCount,
      blockedX: this.blockedX,
      blockedZ: this.blockedZ,
    };
  }

  /** Position in world pixels — the wire format, unchanged from the 2D client. */
  get worldPixel(): WorldPixel {
    return threeToWorldPixel(this.position);
  }

  /**
   * Sets a click-to-walk destination. The renderer resolves the screen click
   * against the ground plane and passes the result here.
   */
  setWalkTarget(x: number, z: number) {
    this.walkTarget = new THREE.Vector2(
      THREE.MathUtils.clamp(x, PLAYER_RADIUS, this.map.widthTiles - PLAYER_RADIUS),
      THREE.MathUtils.clamp(z, PLAYER_RADIUS, this.map.heightTiles - PLAYER_RADIUS),
    );
  }

  clearWalkTarget() {
    this.walkTarget = null;
  }

  /** Advances the simulation by a frame's worth of real time. */
  update(dt: number) {
    this.accumulator += Math.min(dt, STEP * MAX_STEPS);
    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS) {
      this.step(STEP);
      this.accumulator -= STEP;
      steps++;
    }
    this.turnToward(dt);
  }

  private step(dt: number) {
    const desired = this.desiredVelocity();

    // Accelerate toward the desired velocity, decelerating faster than we
    // accelerate so stopping feels crisp rather than floaty.
    const stopping = desired.lengthSq() === 0;
    const rate = MAX_SPEED / (stopping ? DECEL_TIME : ACCEL_TIME);
    const maxDelta = rate * dt;

    const delta = desired.clone().sub(this.velocity);
    if (delta.length() > maxDelta) delta.setLength(maxDelta);
    this.velocity.add(delta);

    const move = this.collision.moveCircle(
      this.position.x,
      this.position.z,
      this.velocity.x * dt,
      this.velocity.y * dt,
      PLAYER_RADIUS,
    );
    this.position.set(move.x, 0, move.z);
    this.blockedX = move.blockedX;
    this.blockedZ = move.blockedZ;
    if (move.blockedX) this.velocity.x = 0;
    if (move.blockedZ) this.velocity.y = 0;

    // Arriving cancels the walk target, so the player doesn't jitter on the spot.
    if (this.walkTarget) {
      const dx = this.walkTarget.x - this.position.x;
      const dz = this.walkTarget.y - this.position.z;
      if (Math.hypot(dx, dz) < ARRIVE_RADIUS) this.walkTarget = null;
    }
  }

  /** Keyboard wins over click-to-walk, matching the 2D renderer exactly. */
  private desiredVelocity(): THREE.Vector2 {
    const kb = this.input.moveVector();

    if (kb.x !== 0 || kb.z !== 0) {
      this.walkTarget = null;
      return new THREE.Vector2(kb.x, kb.z).normalize().multiplyScalar(MAX_SPEED);
    }

    if (this.walkTarget) {
      const dx = this.walkTarget.x - this.position.x;
      const dz = this.walkTarget.y - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= ARRIVE_RADIUS) {
        return new THREE.Vector2(dx, dz).normalize().multiplyScalar(MAX_SPEED);
      }
      this.walkTarget = null;
    }

    return new THREE.Vector2(0, 0);
  }

  /**
   * Rotates the avatar toward its direction of travel by the shortest arc.
   * Facing is held when idle so the player doesn't snap back to a default.
   */
  private turnToward(dt: number) {
    if (!this.isMoving) return;
    const target = Math.atan2(this.velocity.x, this.velocity.y);
    let diff = target - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = TURN_RATE * dt;
    this.facing += THREE.MathUtils.clamp(diff, -maxTurn, maxTurn);

    // Keep the angle in (-PI, PI] so it never winds up over a long session.
    if (this.facing > Math.PI) this.facing -= Math.PI * 2;
    if (this.facing < -Math.PI) this.facing += Math.PI * 2;
  }
}
