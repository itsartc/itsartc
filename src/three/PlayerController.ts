import * as THREE from "three";
import type { WorldCollision } from "./collision/types";
import type { Input } from "./Input";
import { PLAYER_HEIGHT, PLAYER_RADIUS } from "./build/PlayerAvatar";

/**
 * Player movement through the city.
 *
 * Movement is expressed relative to the camera, the way a third-person action
 * game works: pressing up walks away from the viewer regardless of which way
 * the camera happens to face, and the avatar turns to follow.
 *
 * The city is modelled in metres, so the constants here are real walking
 * figures rather than tuned magic numbers.
 */

/**
 * Metres per second. Faster than a real walk on purpose: a person covers about
 * 1.4 m/s, but the city is over 500 m across and crossing it at a true walking
 * pace is tedious. These are game speeds tuned to the block size — one 74 m
 * block takes about twelve seconds at a walk, four at a run.
 */
const WALK_SPEED = 6.4;
const RUN_SPEED = 12;

/** Seconds to reach top speed, and to stop from it. */
const ACCEL_TIME = 0.16;
const DECEL_TIME = 0.11;

/** How fast the avatar turns toward its direction of travel, radians/sec. */
const TURN_RATE = 11;

/** Gravity in m/s², and the speed at which falling is capped. */
const GRAVITY = 24;
const MAX_FALL = 55;

/** Steps up to this height are walked over rather than blocked. */
const STEP_HEIGHT = 0.55;

/** Fixed simulation step, and the most we will simulate in one frame. */
const STEP = 1 / 60;
const MAX_STEPS = 5;

/** How far ahead we probe for walls, beyond the body radius. */
const WALL_PROBE = 0.35;

export class PlayerController {
  /** Feet position in world units. */
  readonly position = new THREE.Vector3();

  /** Facing angle in radians; 0 faces +Z, matching the avatar's local forward. */
  facing = 0;

  private readonly collision: WorldCollision;
  private readonly input: Input;

  private velocity = new THREE.Vector2();
  private verticalVelocity = 0;
  private grounded = true;
  private accumulator = 0;

  constructor(collision: WorldCollision, input: Input, spawn: THREE.Vector3) {
    this.collision = collision;
    this.input = input;
    this.position.copy(spawn);
  }

  get speed(): number {
    return this.velocity.length();
  }

  get isMoving(): boolean {
    return this.speed > 0.15;
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  /**
   * Advances the simulation. `cameraYaw` is the direction the camera looks, so
   * input can be interpreted in screen terms.
   */
  update(dt: number, cameraYaw: number) {
    this.accumulator += Math.min(dt, STEP * MAX_STEPS);
    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS) {
      this.step(STEP, cameraYaw);
      this.accumulator -= STEP;
      steps++;
    }
    this.turnToward(dt);
  }

  private step(dt: number, cameraYaw: number) {
    const desired = this.desiredVelocity(cameraYaw);

    const stopping = desired.lengthSq() === 0;
    const topSpeed = this.input.running ? RUN_SPEED : WALK_SPEED;
    const rate = topSpeed / (stopping ? DECEL_TIME : ACCEL_TIME);

    const delta = desired.clone().sub(this.velocity);
    const maxDelta = rate * dt;
    if (delta.length() > maxDelta) delta.setLength(maxDelta);
    this.velocity.add(delta);

    this.moveHorizontally(dt);
    this.settleVertically(dt);
  }

  /** Input mapped from camera space into world space. */
  private desiredVelocity(cameraYaw: number): THREE.Vector2 {
    const v = this.input.vector();
    if (v.x === 0 && v.z === 0) return new THREE.Vector2(0, 0);

    // Rotate the raw input into the camera's basis so "up" is always away from
    // the viewer and "right" is always screen-right, whichever way it faces.
    //
    // The camera looks along forward = (sin yaw, cos yaw). Screen-right is
    // cross(forward, worldUp) = (-cos yaw, sin yaw) — note the sign: looking
    // along +Z, right is -X, not +X. Getting this backwards swaps the left and
    // right arrow keys, which is exactly what it did.
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const worldX = -v.x * cos + v.z * sin;
    const worldZ = v.x * sin + v.z * cos;

    const speed = this.input.running ? RUN_SPEED : WALK_SPEED;
    return new THREE.Vector2(worldX, worldZ).normalize().multiplyScalar(speed);
  }

  /**
   * Moves along X and Z separately so running into a wall at an angle slides
   * along it rather than stopping dead — the difference between a city that
   * feels navigable and one that feels sticky.
   */
  private moveHorizontally(dt: number) {
    const stepX = this.velocity.x * dt;
    const stepZ = this.velocity.y * dt;

    if (stepX !== 0 && this.canMove(stepX, 0)) this.position.x += stepX;
    if (stepZ !== 0 && this.canMove(0, stepZ)) this.position.z += stepZ;
  }

  /**
   * Probes for a wall in the direction of travel, at chest height so kerbs and
   * small steps don't register as obstacles.
   */
  private canMove(dx: number, dz: number): boolean {
    const dir = new THREE.Vector3(dx, 0, dz).normalize();
    const distance = Math.hypot(dx, dz) + PLAYER_RADIUS + WALL_PROBE;

    for (const height of [STEP_HEIGHT + 0.15, PLAYER_HEIGHT * 0.55, PLAYER_HEIGHT - 0.25]) {
      const origin = new THREE.Vector3(
        this.position.x,
        this.position.y + height,
        this.position.z,
      );
      const hit = this.collision.castDistance(origin, dir, distance);
      if (hit !== null) return false;
    }
    return true;
  }

  /**
   * Keeps the player on the pavement: snaps up onto small steps, and otherwise
   * falls under gravity until the ground catches them.
   */
  private settleVertically(dt: number) {
    const ground = this.collision.groundAt(
      this.position.x,
      this.position.z,
      this.position.y + PLAYER_HEIGHT + 2,
    );

    if (!ground) {
      // Nothing underneath — keep falling, and let the caller notice if this
      // ever persists (it would mean the player left the model entirely).
      this.verticalVelocity = Math.max(this.verticalVelocity - GRAVITY * dt, -MAX_FALL);
      this.position.y += this.verticalVelocity * dt;
      this.grounded = false;
      return;
    }

    const delta = ground.y - this.position.y;

    if (delta > 0 && delta <= STEP_HEIGHT) {
      // Walking up a kerb or step.
      this.position.y = ground.y;
      this.verticalVelocity = 0;
      this.grounded = true;
      return;
    }

    if (Math.abs(delta) < 0.02) {
      this.position.y = ground.y;
      this.verticalVelocity = 0;
      this.grounded = true;
      return;
    }

    if (delta < 0) {
      // Ground is below: fall toward it.
      this.verticalVelocity = Math.max(this.verticalVelocity - GRAVITY * dt, -MAX_FALL);
      this.position.y += this.verticalVelocity * dt;
      if (this.position.y <= ground.y) {
        this.position.y = ground.y;
        this.verticalVelocity = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
      return;
    }

    // Ground is above us by more than a step: we are inside geometry. Push out
    // rather than leaving the player stuck under a mesh.
    this.position.y = ground.y;
    this.verticalVelocity = 0;
    this.grounded = true;
  }

  /** Rotates the avatar toward travel by the shortest arc; holds facing when idle. */
  private turnToward(dt: number) {
    if (!this.isMoving) return;
    const target = Math.atan2(this.velocity.x, this.velocity.y);
    let diff = target - this.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.facing += THREE.MathUtils.clamp(diff, -TURN_RATE * dt, TURN_RATE * dt);
    if (this.facing > Math.PI) this.facing -= Math.PI * 2;
    if (this.facing < -Math.PI) this.facing += Math.PI * 2;
  }
}
