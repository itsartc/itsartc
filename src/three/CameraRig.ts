import * as THREE from "three";
import type { WorldMap } from "@/world/schema";
import { worldCenterToThree, worldSize } from "./coords";

/**
 * The camera rig: a fixed elevated, angled social-world camera that follows a
 * target without ever rotating (product decisions D-001, D-002).
 *
 * Pitch and yaw are constants. Nothing in the game loop, and no user input, may
 * change them — the whole commercial premise is that a sponsored façade is
 * legible from the default view, which only holds if there is exactly one view.
 * What the rig *does* do is follow: it eases its look-at point toward the
 * player so walking feels like the world moving past you rather than the camera
 * being dragged.
 *
 * Three properties make the view read as 3D rather than as a map:
 *
 *  1. **Framing.** It sits at social range, not high enough to fit the whole
 *     world. Whole-world framing shrinks every façade to a few pixels, at which
 *     size perspective and orthographic projection look identical.
 *  2. **Pitch.** 48° is near the shallow end of the product band, keeping
 *     apparent façade height high relative to roof area while looking down far
 *     enough that no sky band enters the frame.
 *  3. **Yaw.** A 20° turn off the world axis means every building presents TWO
 *     faces instead of one. A roof plus a single flat rectangle is the classic
 *     2.5D-sprite silhouette.
 */

/** Downward viewing angle from horizontal, in degrees. Product band: 45-55. */
const CAMERA_PITCH_DEG = 48;

/**
 * Rotation off the world axis, in degrees. Small enough that map orientation is
 * preserved (north stays up, quadrants stay put), large enough that every
 * building shows a lit face and a shaded face.
 */
const CAMERA_YAW_DEG = 20;

/** Vertical field of view, in degrees. */
const CAMERA_FOV = 50;

/**
 * How much of the world the follow view spans horizontally, in tiles. Framing
 * by span rather than by raw distance keeps the sense of scale constant across
 * window shapes. The world is 64 tiles wide, so this shows about half.
 */
const FOLLOW_SPAN_TILES = 32;

/** Distance clamp for the follow view, in scene units. */
const MIN_DISTANCE = 18;
const MAX_DISTANCE = 30;

/** Extra breathing room when framing the whole world in the overview. */
const FRAME_MARGIN = 1.08;

/**
 * The camera looks slightly above ground, roughly head height, so the player
 * and nearby façades sit in the frame rather than at its bottom edge.
 */
const TARGET_HEIGHT = 1.2;

/**
 * Follow stiffness. Higher snaps harder; this is tuned to keep the player
 * near centre while still letting a direction change read as motion.
 * Applied frame-rate-independently, so the feel does not change with FPS.
 */
const FOLLOW_STIFFNESS = 9;

/**
 * `follow` is the product camera and the default: gameplay range, tracking the
 * player. `overview` frames the entire map and exists only as a diagnostic for
 * comparing orientation against the 2D route (`/world3d?view=overview`).
 */
export type CameraView = "follow" | "overview";

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  private readonly map: WorldMap;
  private view: CameraView;

  /** Where the camera currently looks. Eased toward `desired` each frame. */
  private readonly target = new THREE.Vector3();

  /** Where the camera would look if it caught up instantly. */
  private readonly desired = new THREE.Vector3();

  private distance = MAX_DISTANCE;

  constructor(map: WorldMap, aspect: number, view: CameraView = "follow") {
    this.map = map;
    this.view = view;
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 500);

    this.desired.copy(worldCenterToThree(map, TARGET_HEIGHT));
    this.target.copy(this.desired);
    this.refit();
    this.place();
  }

  /** Horizontal half-FOV in radians for the current aspect. */
  private halfHFov(): number {
    const vFov = THREE.MathUtils.degToRad(CAMERA_FOV);
    return Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
  }

  /**
   * Distance that makes the view span FOLLOW_SPAN_TILES horizontally. Clamped so
   * an extreme window shape can't push the camera into a building or out to a
   * map-like altitude.
   */
  private followDistance(): number {
    const d = FOLLOW_SPAN_TILES / 2 / Math.tan(this.halfHFov());
    return THREE.MathUtils.clamp(d, MIN_DISTANCE, MAX_DISTANCE);
  }

  /**
   * Distance needed to fit the whole world. The camera is yawed, so the map's
   * axis-aligned extent is projected onto the camera's own horizontal axes
   * first — otherwise a rotated map clips at the corners.
   */
  private overviewDistance(): number {
    const { w, d } = worldSize(this.map);
    const yaw = THREE.MathUtils.degToRad(CAMERA_YAW_DEG);
    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);

    const halfRight = (w / 2) * Math.cos(yaw) + (d / 2) * Math.sin(yaw);
    const halfForward = (w / 2) * Math.sin(yaw) + (d / 2) * Math.cos(yaw);

    const vFov = THREE.MathUtils.degToRad(CAMERA_FOV);
    const distForWidth = halfRight / Math.tan(this.halfHFov());
    // Ground depth foreshortens by sin(pitch) when viewed at an angle.
    const distForDepth = (halfForward * Math.sin(pitch)) / Math.tan(vFov / 2);

    return Math.max(distForWidth, distForDepth) * FRAME_MARGIN;
  }

  private refit() {
    this.distance = this.view === "overview" ? this.overviewDistance() : this.followDistance();
  }

  /**
   * Places the camera on its fixed elevated angle, offset from the look-at
   * point by pitch and yaw. Because authored +y maps to +z, offsetting along +Z
   * puts the viewer "south" of the target looking north — so building fronts
   * facing down the map present their façades to the camera. The yaw then
   * rotates that offset so a second face of each building comes into view.
   */
  private place() {
    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
    const yaw = THREE.MathUtils.degToRad(CAMERA_YAW_DEG);

    const horizontal = Math.cos(pitch) * this.distance;
    const vertical = Math.sin(pitch) * this.distance;

    this.camera.position.set(
      this.target.x + horizontal * Math.sin(yaw),
      this.target.y + vertical,
      this.target.z + horizontal * Math.cos(yaw),
    );
    this.camera.lookAt(this.target);
  }

  /** Point the rig should follow. Ignored in the overview view. */
  setFollowTarget(position: THREE.Vector3) {
    if (this.view === "overview") return;
    this.desired.set(position.x, TARGET_HEIGHT, position.z);
  }

  /** Jump straight to the follow target, skipping the ease. Used on spawn. */
  snap() {
    this.target.copy(this.desired);
    this.place();
  }

  /**
   * Eases the look-at point toward the target and repositions the camera.
   *
   * The smoothing factor is derived from dt with an exponential, not used as a
   * raw lerp alpha: a fixed alpha would make the camera chase faster on a
   * 144 Hz screen than a 60 Hz one.
   */
  update(dt: number) {
    const t = 1 - Math.exp(-FOLLOW_STIFFNESS * dt);
    this.target.lerp(this.desired, t);
    this.place();
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.refit();
    this.place();
  }

  setView(view: CameraView) {
    if (view === this.view) return;
    this.view = view;
    if (view === "overview") {
      this.desired.copy(worldCenterToThree(this.map, TARGET_HEIGHT));
    }
    this.refit();
    this.snap();
  }

  /** The world-space point directly under the camera's look-at, at ground level. */
  get lookAt(): THREE.Vector3 {
    return this.target.clone();
  }

  get info() {
    const p = this.camera.position;
    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      view: this.view,
      fovDeg: CAMERA_FOV,
      pitchDeg: CAMERA_PITCH_DEG,
      yawDeg: CAMERA_YAW_DEG,
      distance: round(this.distance),
      height: round(p.y),
      position: { x: round(p.x), y: round(p.y), z: round(p.z) },
      target: { x: round(this.target.x), y: round(this.target.y), z: round(this.target.z) },
    };
  }
}
