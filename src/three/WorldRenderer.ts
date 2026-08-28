import * as THREE from "three";
import type { WorldMap } from "@/world/schema";
import { tileCenterToThree, worldCenterToThree, worldSize } from "./coords";
import { buildTerrain } from "./build/TerrainBuilder";
import { buildBuildings } from "./build/BuildingBuilder";

/**
 * Owns the Three.js scene, camera, renderer and animation loop for the 3D
 * world. This is the Three.js counterpart to Phaser's Scene + Game, and it is
 * the only place that touches renderer lifecycle.
 *
 * Deliberately free of game rules: it reads world data and draws it. Movement,
 * collision, networking and proximity stay outside the renderer so they can be
 * shared with (or migrated from) the existing 2D implementation.
 *
 * ## Camera (product decisions D-001, D-002)
 *
 * A fixed elevated, angled "social world" camera. It preserves the readability
 * of the original top-down view while adding real depth, and — importantly for
 * the commercial model — keeps building façades, entrances and future signage
 * legible from the default angle without the player rotating anything.
 *
 * Three things make it read as 3D rather than as a map (see D-002):
 *
 *  1. **Framing.** The default view sits at social range around the spawn, not
 *     high enough to fit the whole world. Whole-world framing shrinks every
 *     façade to a few pixels, which is what made the first pass look top-down.
 *  2. **Pitch.** 48° sits near the shallow end of the product band, which
 *     keeps apparent façade height high relative to roof area while still
 *     looking down far enough that no sky/horizon band enters the frame.
 *  3. **Yaw.** A 20° turn off the world axis means every building presents TWO
 *     faces instead of one. An axis-aligned box viewed dead-on shows a roof and
 *     a single flat rectangle — the classic 2.5D-sprite look.
 *
 * It is not a free-orbit, first-person, or over-the-shoulder camera, and never
 * looks straight down. Yaw and pitch are constants, not user input.
 */

/** Downward viewing angle from horizontal, in degrees. Product band: 45-55. */
const CAMERA_PITCH_DEG = 48;

/**
 * Rotation off the world axis, in degrees. Small enough that map orientation is
 * preserved (north stays up, quadrants stay where they are), large enough that
 * every building shows a lit face and a shaded face.
 */
const CAMERA_YAW_DEG = 20;

/** Vertical field of view, in degrees. */
const CAMERA_FOV = 50;

/**
 * How much of the world the default "social" view spans horizontally, in tiles.
 * Framing by span rather than by raw distance keeps the sense of scale constant
 * across window shapes. The world is 64 tiles wide, so this shows about half of it.
 */
const SOCIAL_SPAN_TILES = 32;

/** Distance clamp for the social view, in scene units. */
const SOCIAL_MIN_DISTANCE = 18;
const SOCIAL_MAX_DISTANCE = 30;

/** Extra breathing room when framing the whole world in the overview. */
const FRAME_MARGIN = 1.08;

/**
 * The camera looks slightly above ground, roughly half a building tall, so
 * façades sit in the frame rather than at its bottom edge.
 */
const TARGET_HEIGHT = 1.2;

/** Cap device pixel ratio: beyond 2 costs fill rate for no visible gain. */
const MAX_PIXEL_RATIO = 2;

/**
 * `social` is the product camera and the default: gameplay range, around the
 * spawn. `overview` frames the entire map and exists only as a diagnostic for
 * comparing orientation against the 2D route (`/world3d?view=overview`).
 */
export type CameraView = "social" | "overview";

export interface WorldRendererOptions {
  view?: CameraView;
}

export interface RendererDiagnostics {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  pixelRatio: number;
  size: { width: number; height: number };
  view: CameraView;
  cameraFovDeg: number;
  cameraPitchDeg: number;
  cameraYawDeg: number;
  cameraDistance: number;
  cameraHeight: number;
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
}

export class WorldRenderer {
  private readonly container: HTMLElement;
  private readonly map: WorldMap;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private disposers: Array<() => void> = [];
  private frameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  private view: CameraView;

  /** Where the camera looks — the spawn in Phase 1; the player later. */
  private target = new THREE.Vector3();

  /** Current camera distance from the target, in scene units. */
  private distance = SOCIAL_MAX_DISTANCE;

  constructor(container: HTMLElement, map: WorldMap, options: WorldRendererOptions = {}) {
    this.container = container;
    this.map = map;
    this.view = options.view ?? "social";

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    // --- Renderer ---------------------------------------------------------
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = false; // Phase 1: no shadows yet.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // --- Scene ------------------------------------------------------------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fb7d4); // plain daylight sky

    // --- Camera -----------------------------------------------------------
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 500);
    this.applyFraming();

    // --- World content ----------------------------------------------------
    const terrain = buildTerrain(map);
    this.scene.add(terrain.group);
    this.disposers.push(terrain.dispose);

    const buildings = buildBuildings(map);
    this.scene.add(buildings.group);
    this.disposers.push(buildings.dispose);

    this.addSpawnMarker();
    this.addLighting();

    // --- Resize -----------------------------------------------------------
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    window.addEventListener("resize", this.handleResize);

    // --- Loop -------------------------------------------------------------
    this.loop();
  }

  /** Horizontal half-FOV in radians for the current aspect. */
  private halfHFov(aspect: number): number {
    const vFov = THREE.MathUtils.degToRad(CAMERA_FOV);
    return Math.atan(Math.tan(vFov / 2) * aspect);
  }

  /**
   * Distance that makes the view span SOCIAL_SPAN_TILES horizontally. Clamped so
   * an extreme window shape can't push the camera into a building or out to a
   * map-like altitude.
   */
  private socialDistance(aspect: number): number {
    const d = SOCIAL_SPAN_TILES / 2 / Math.tan(this.halfHFov(aspect));
    return THREE.MathUtils.clamp(d, SOCIAL_MIN_DISTANCE, SOCIAL_MAX_DISTANCE);
  }

  /**
   * Distance needed to fit the whole world at the current aspect. The camera is
   * yawed, so the map's axis-aligned extent is projected onto the camera's own
   * horizontal axes first — otherwise a rotated map clips at the corners.
   */
  private overviewDistance(aspect: number): number {
    const { w, d } = worldSize(this.map);
    const yaw = THREE.MathUtils.degToRad(CAMERA_YAW_DEG);
    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);

    // Extent along the camera's right axis, and along its ground-forward axis.
    const halfRight = (w / 2) * Math.cos(yaw) + (d / 2) * Math.sin(yaw);
    const halfForward = (w / 2) * Math.sin(yaw) + (d / 2) * Math.cos(yaw);

    const vFov = THREE.MathUtils.degToRad(CAMERA_FOV);
    const distForWidth = halfRight / Math.tan(this.halfHFov(aspect));
    // Ground depth foreshortens by sin(pitch) when viewed at an angle.
    const distForDepth = (halfForward * Math.sin(pitch)) / Math.tan(vFov / 2);

    return Math.max(distForWidth, distForDepth) * FRAME_MARGIN;
  }

  /** Recomputes target and distance for the active view, then places the camera. */
  private applyFraming() {
    const aspect = this.camera.aspect;

    if (this.view === "overview") {
      this.target.copy(worldCenterToThree(this.map, TARGET_HEIGHT));
      this.distance = this.overviewDistance(aspect);
    } else {
      const spawn = tileCenterToThree(this.map.spawn.x, this.map.spawn.y, TARGET_HEIGHT);
      this.target.copy(spawn);
      this.distance = this.socialDistance(aspect);
    }

    this.placeCamera();
  }

  /**
   * Positions the camera on its fixed elevated angle, offset from the target by
   * pitch and yaw. Because authored +y maps to +z, offsetting along +Z puts the
   * viewer "south" of the target looking north — so building fronts facing down
   * the map present their façades to the camera, which is what keeps signage and
   * sponsored entrances legible. The yaw then rotates that offset so a second
   * face of each building comes into view.
   */
  private placeCamera() {
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

  /** Switch framing at runtime. Diagnostic only — not a player-facing control. */
  setView(view: CameraView) {
    if (this.disposed || view === this.view) return;
    this.view = view;
    this.applyFraming();
  }

  /** A clearly visible temporary marker at the authored spawn tile. */
  private addSpawnMarker() {
    const pos = tileCenterToThree(this.map.spawn.x, this.map.spawn.y);

    const geo = new THREE.CapsuleGeometry(0.35, 0.9, 4, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe0342c,
      roughness: 0.5,
      emissive: 0x3a0906,
    });
    const marker = new THREE.Mesh(geo, mat);
    marker.name = "spawn-marker";
    // Capsule origin is its centre; lift so it stands on the ground.
    marker.position.set(pos.x, 0.8, pos.z);
    this.scene.add(marker);

    // A vertical pole makes the spawn readable from any distance.
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 4, 8);
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x555555,
    });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(pos.x, 2.6, pos.z);
    this.scene.add(pole);

    this.disposers.push(() => {
      geo.dispose();
      mat.dispose();
      poleGeo.dispose();
      poleMat.dispose();
    });
  }

  /**
   * Hemisphere fill + one directional key light. No shadows in Phase 1.
   *
   * The key comes from the camera's LEFT so the two faces the yaw reveals are
   * lit unequally: without that contrast a box reads as a flat silhouette no
   * matter how well it is framed.
   */
  private addLighting() {
    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x4a5a3a, 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d8, 2.1);
    sun.position.set(this.target.x - 34, 46, this.target.z + 20);
    sun.target.position.copy(this.target);
    this.scene.add(sun);
    this.scene.add(sun.target);

    this.disposers.push(() => {
      hemi.dispose();
      sun.dispose();
    });
  }

  private handleResize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // Keep the framing consistent as the viewport changes shape.
    this.applyFraming();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height);
  };

  private loop = () => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.loop);
    this.renderer.render(this.scene, this.camera);
  };

  /** Live renderer counters — the Phase 1 performance baseline. */
  getDiagnostics(): RendererDiagnostics {
    const info = this.renderer.info;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const round = (n: number) => Math.round(n * 10) / 10;
    const p = this.camera.position;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      pixelRatio: this.renderer.getPixelRatio(),
      size: { width: size.x, height: size.y },
      view: this.view,
      cameraFovDeg: CAMERA_FOV,
      cameraPitchDeg: CAMERA_PITCH_DEG,
      cameraYawDeg: CAMERA_YAW_DEG,
      cameraDistance: round(this.distance),
      cameraHeight: round(p.y),
      cameraPosition: { x: round(p.x), y: round(p.y), z: round(p.z) },
      cameraTarget: {
        x: round(this.target.x),
        y: round(this.target.y),
        z: round(this.target.z),
      },
    };
  }

  /** Full teardown: loop, listeners, GPU resources, canvas. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;

    window.removeEventListener("resize", this.handleResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.disposers.forEach((d) => d());
    this.disposers = [];

    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();

    const canvas = this.renderer.domElement;
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
}
