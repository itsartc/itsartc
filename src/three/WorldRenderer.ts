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
 * ## Camera (product decision D-001)
 *
 * A fixed elevated, angled "social world" camera. It preserves the readability
 * of the original top-down view while adding real depth, and — importantly for
 * the commercial model — keeps building façades, entrances and future signage
 * legible from the default angle without the player rotating anything.
 *
 * It is not a free-orbit, first-person, or over-the-shoulder camera, and never
 * looks straight down.
 */

/** Downward viewing angle from horizontal, in degrees. */
const CAMERA_PITCH_DEG = 50;

/**
 * Extra breathing room when framing the whole world, as a multiplier on the
 * computed fit distance.
 */
const FRAME_MARGIN = 1.12;

/**
 * Distance used once the camera follows a player (Phase 2+), in scene units.
 * Phase 1 has no player, so the camera instead frames the entire world to make
 * orientation verifiable against the 2D route.
 */
const FOLLOW_DISTANCE = 34;

/** Vertical field of view, in degrees. */
const CAMERA_FOV = 45;

/** Cap device pixel ratio: beyond 2 costs fill rate for no visible gain. */
const MAX_PIXEL_RATIO = 2;

export interface RendererDiagnostics {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  pixelRatio: number;
  size: { width: number; height: number };
  cameraPitchDeg: number;
  cameraDistance: number;
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

  /** Where the camera looks — world centre in Phase 1; the player later. */
  private target = new THREE.Vector3();

  /** Current camera distance from the target, in scene units. */
  private distance = FOLLOW_DISTANCE;

  constructor(container: HTMLElement, map: WorldMap) {
    this.container = container;
    this.map = map;

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
    this.target.copy(worldCenterToThree(map));
    this.distance = this.fitDistance(width / height);
    this.placeCamera();

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

  /**
   * Distance needed to fit the whole world in view at the current aspect and
   * field of view. Phase 1 frames the entire map so orientation can be checked
   * against the 2D route; Phase 2 will drop to FOLLOW_DISTANCE and track the
   * player instead.
   */
  private fitDistance(aspect: number): number {
    const { w, d } = worldSize(this.map);
    const vFov = THREE.MathUtils.degToRad(CAMERA_FOV);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

    // The map is viewed at an angle, so its depth foreshortens by sin(pitch).
    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
    const apparentDepth = d * Math.sin(pitch);

    const distForWidth = w / 2 / Math.tan(hFov / 2);
    const distForDepth = apparentDepth / 2 / Math.tan(vFov / 2);

    return Math.max(distForWidth, distForDepth) * FRAME_MARGIN;
  }

  /**
   * Positions the camera on a fixed elevated angle in front of (+Z of) the
   * target, looking back up the map. Because authored +y maps to +z, offsetting
   * along +Z puts the viewer at the "south" edge looking north — so building
   * fronts facing down the map present their façades to the camera, which is
   * what keeps signage and sponsored entrances legible.
   */
  private placeCamera() {
    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
    const horizontal = Math.cos(pitch) * this.distance;
    const vertical = Math.sin(pitch) * this.distance;

    this.camera.position.set(
      this.target.x,
      this.target.y + vertical,
      this.target.z + horizontal,
    );
    this.camera.lookAt(this.target);
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

  /** Hemisphere fill + one directional key light. No shadows in Phase 1. */
  private addLighting() {
    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x4a5a3a, 1.15);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
    // Angled so building faces read with distinct light and shade.
    sun.position.set(
      this.target.x + 30,
      40,
      this.target.z + 22,
    );
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
    // Keep the whole world framed as the viewport changes shape.
    this.distance = this.fitDistance(this.camera.aspect);
    this.placeCamera();
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
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      pixelRatio: this.renderer.getPixelRatio(),
      size: { width: size.x, height: size.y },
      cameraPitchDeg: CAMERA_PITCH_DEG,
      cameraDistance: Math.round(this.distance * 10) / 10,
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
