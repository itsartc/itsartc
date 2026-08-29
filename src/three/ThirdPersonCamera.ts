import * as THREE from "three";
import type { WorldCollision } from "./collision/types";
import { PLAYER_HEIGHT } from "./build/PlayerAvatar";

/**
 * A third-person chase camera, in the vein of a modern open-world action game.
 *
 * It sits behind and above the player, eases into place rather than snapping,
 * swings around to sit behind them as they turn, and pulls in when a building
 * comes between it and the player. The mouse orbits it; movement input is
 * interpreted relative to wherever it happens to be looking.
 *
 * Distances are metres, matching the city model.
 */

/** Resting distance behind the player, and how close a wall may push it. */
const DISTANCE = 9;
const MIN_DISTANCE = 1.8;

/** Height of the point the camera looks at, up the player's body. */
const LOOK_HEIGHT = PLAYER_HEIGHT * 0.75;

/** Starting downward tilt, and the range the mouse may pitch within. */
const DEFAULT_PITCH = THREE.MathUtils.degToRad(14);
const MIN_PITCH = THREE.MathUtils.degToRad(-8);
const MAX_PITCH = THREE.MathUtils.degToRad(65);

/** How quickly position and look-at ease toward their targets. */
const POSITION_STIFFNESS = 11;
const LOOK_STIFFNESS = 16;

/**
 * How quickly the camera drifts back behind a moving player. Deliberately
 * gentle: snapping the view around the instant someone turns is disorienting.
 */
const AUTO_ALIGN_RATE = 1.9;

/** Mouse sensitivity, radians per pixel. */
const MOUSE_SENSITIVITY = 0.0042;

/** Keeps the camera from ending up inside the wall it collided with. */
const WALL_PADDING = 0.3;

export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;

  /** Horizontal angle the camera looks along. Movement input is relative to it. */
  private yaw = 0;
  private pitch = DEFAULT_PITCH;

  private readonly position = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private initialised = false;

  private readonly collision: WorldCollision;
  private readonly element: HTMLElement;
  private dragging = false;
  private userControlledUntil = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    collision: WorldCollision,
    element: HTMLElement,
  ) {
    this.camera = camera;
    this.collision = collision;
    this.element = element;

    element.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  /** Direction the camera faces, for interpreting movement input. */
  get facingYaw(): number {
    return this.yaw;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.dragging = true;
    this.element.style.cursor = "grabbing";
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.yaw -= e.movementX * MOUSE_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + e.movementY * MOUSE_SENSITIVITY,
      MIN_PITCH,
      MAX_PITCH,
    );
    // Suspend auto-alignment briefly so the camera doesn't fight the user.
    this.userControlledUntil = performance.now() + 1400;
  };

  private onPointerUp = () => {
    this.dragging = false;
    this.element.style.cursor = "";
  };

  update(dt: number, playerPosition: THREE.Vector3, playerFacing: number, moving: boolean) {
    // Drift back behind the player once they are moving and the mouse is idle.
    if (moving && performance.now() > this.userControlledUntil) {
      let diff = playerFacing - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, AUTO_ALIGN_RATE * dt);
    }

    const focus = new THREE.Vector3(
      playerPosition.x,
      playerPosition.y + LOOK_HEIGHT,
      playerPosition.z,
    );

    // The camera sits opposite the direction of view, raised by the pitch.
    const horizontal = Math.cos(this.pitch) * DISTANCE;
    const desired = new THREE.Vector3(
      focus.x - Math.sin(this.yaw) * horizontal,
      focus.y + Math.sin(this.pitch) * DISTANCE,
      focus.z - Math.cos(this.yaw) * horizontal,
    );

    // If a building is in the way, slide the camera in along the same line.
    const toCamera = desired.clone().sub(focus);
    const distance = toCamera.length();
    const blocked = this.collision.castDistance(focus, toCamera.clone().normalize(), distance);
    if (blocked !== null) {
      const clamped = Math.max(MIN_DISTANCE, blocked - WALL_PADDING);
      desired.copy(focus).add(toCamera.normalize().multiplyScalar(clamped));
    }

    if (!this.initialised) {
      this.position.copy(desired);
      this.lookAt.copy(focus);
      this.initialised = true;
    } else {
      // Frame-rate independent easing: a fixed lerp alpha would chase faster on
      // a 144Hz screen than a 60Hz one.
      this.position.lerp(desired, 1 - Math.exp(-POSITION_STIFFNESS * dt));
      this.lookAt.lerp(focus, 1 - Math.exp(-LOOK_STIFFNESS * dt));
    }

    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookAt);
  }

  /** Places the camera behind the player immediately, with no easing. */
  snapBehind(playerPosition: THREE.Vector3, playerFacing: number) {
    this.yaw = playerFacing;
    this.pitch = DEFAULT_PITCH;
    this.initialised = false;
    this.update(1, playerPosition, playerFacing, false);
  }

  get info() {
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      yawDeg: Math.round(THREE.MathUtils.radToDeg(this.yaw)),
      pitchDeg: Math.round(THREE.MathUtils.radToDeg(this.pitch)),
      distance: DISTANCE,
      position: [round(this.position.x), round(this.position.y), round(this.position.z)],
    };
  }

  dispose() {
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
  }
}
