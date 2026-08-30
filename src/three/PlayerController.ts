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
 * Metres per second, and there is only one of them now.
 *
 * Far faster than a real walk on purpose: a person covers about 1.4 m/s, and
 * crossing a 320 m city at that pace is tedious. This is what used to be the
 * sprint speed, which turned out to be the right default — an 88 m block takes
 * about seven seconds, and the shift key it used to need was being held
 * permanently.
 *
 * The walk/run split went with it rather than being left as a modifier that
 * changes nothing. Reintroducing a sprint means a second constant here and a
 * branch back in `step` and `desiredVelocity`.
 */
const MOVE_SPEED = 12;

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

/** Small allowance above step height for a downward destination probe. */
const GROUND_PROBE = 0.08;

/** Anything steeper is not a floor the player can stand on. */
const MIN_GROUND_NORMAL_Y = 0.7;

export class PlayerController {
  /** Feet position in world units. */
  readonly position = new THREE.Vector3();

  /** Facing angle in radians; 0 faces +Z, matching the avatar's local forward. */
  facing = 0;

  private readonly collision: WorldCollision;
  private readonly input: Input;

  private velocity = new THREE.Vector2();
  private verticalVelocity = 0;
  private motionSpeed = 0;
  private grounded = true;
  private accumulator = 0;

  constructor(collision: WorldCollision, input: Input, spawn: THREE.Vector3) {
    this.collision = collision;
    this.input = input;
    this.position.copy(spawn);
  }

  get speed(): number {
    return this.motionSpeed;
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
    const rate = MOVE_SPEED / (stopping ? DECEL_TIME : ACCEL_TIME);

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

    return new THREE.Vector2(worldX, worldZ).normalize().multiplyScalar(MOVE_SPEED);
  }

  /**
   * Moves along X and Z separately so running into a wall at an angle slides
   * along it rather than stopping dead — the difference between a city that
   * feels navigable and one that feels sticky.
   */
  private moveHorizontally(dt: number) {
    const startX = this.position.x;
    const startZ = this.position.z;
    const stepX = this.velocity.x * dt;
    const stepZ = this.velocity.y * dt;

    if (stepX !== 0) {
      if (this.canMove(stepX, 0)) this.position.x += stepX;
      else this.velocity.x = 0;
    }
    if (stepZ !== 0) {
      if (this.canMove(0, stepZ)) this.position.z += stepZ;
      else this.velocity.y = 0;
    }

    this.motionSpeed = Math.hypot(this.position.x - startX, this.position.z - startZ) / dt;
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

    // Check the destination rather than walking first and correcting later.
    // This prevents edge jitter, roof teleports and stepping into holes where
    // the imported model has no supporting surface.
    const ground = this.collision.groundAt(
      this.position.x + dx,
      this.position.z + dz,
      this.position.y + STEP_HEIGHT + GROUND_PROBE,
    );
    if (!ground || (ground.normal?.y ?? 1) < MIN_GROUND_NORMAL_Y) return false;
    return ground.y - this.position.y <= STEP_HEIGHT + GROUND_PROBE;
  }

  /**
   * Keeps the player on the pavement: snaps up onto small steps, and otherwise
   * falls under gravity until the ground catches them.
   */
  private settleVertically(dt: number) {
    const ground = this.collision.groundAt(
      this.position.x,
      this.position.z,
      this.position.y + STEP_HEIGHT + GROUND_PROBE,
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

    // A surface above step height is not valid ground. Do not teleport onto it;
    // the destination probe will keep subsequent movement out of that area.
    this.verticalVelocity = 0;
    this.grounded = false;
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
