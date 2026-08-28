import * as THREE from "three";
import type { WorldMap } from "@/world/schema";
import { buildTerrain } from "./build/TerrainBuilder";
import { buildBuildings } from "./build/BuildingBuilder";
import { buildObjects } from "./build/ObjectBuilder";
import { buildPlayer } from "./build/PlayerBuilder";
import { CameraRig, type CameraView } from "./CameraRig";
import { Input } from "./Input";
import { PlayerController } from "./PlayerController";
import { AssetRegistry } from "./assets/AssetRegistry";
import { WORLD_ASSET_BINDINGS, WORLD_GLBS } from "./assets/catalog";

/**
 * Owns the Three.js scene, renderer, camera rig and animation loop for the 3D
 * world. This is the Three.js counterpart to Phaser's Scene + Game, and it is
 * the only place that touches renderer lifecycle.
 *
 * Deliberately thin on game rules: it wires input to a controller, the
 * controller to a mesh, and the mesh to the camera rig. Networking and
 * proximity stay outside it so they can be shared with — or migrated from —
 * the existing 2D implementation.
 *
 * Phase 3 status: the controllable player now respects the authored collision
 * map and world bounds. No multiplayer or voice yet (Phase 4).
 */

/** Cap device pixel ratio: beyond 2 costs fill rate for no visible gain. */
const MAX_PIXEL_RATIO = 2;

/** Clamp for a single frame's delta, in seconds — protects against tab resume. */
const MAX_FRAME_DELTA = 0.1;

/** Vertical bob amplitude and rate while walking, in scene units. */
const BOB_AMPLITUDE = 0.045;
const BOB_RATE = 11;

export type { CameraView };

export interface WorldRendererOptions {
  view?: CameraView;
}

export interface RendererDiagnostics {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  pixelRatio: number;
  size: { width: number; height: number };
  camera: CameraRig["info"];
  player: {
    scene: { x: number; y: number; z: number };
    worldPixel: { x: number; y: number };
    tile: { x: number; y: number };
    facingDeg: number;
    speed: number;
    moving: boolean;
    walkingToClick: boolean;
    collision: {
      solidTiles: number;
      blockedX: boolean;
      blockedZ: boolean;
    };
  };
  assets: {
    buildingErrors: readonly string[];
    objectErrors: readonly string[];
  };
}

export class WorldRenderer {
  private readonly container: HTMLElement;
  private readonly map: WorldMap;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private rig: CameraRig;
  private input: Input;
  private player: PlayerController;
  private playerMesh: THREE.Group;
  private assets: AssetRegistry;
  private buildingAssetErrors: readonly string[] = [];
  private objectAssetErrors: readonly string[] = [];

  /** Ground plane used to turn a screen click into a world position. */
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly raycaster = new THREE.Raycaster();

  private disposers: Array<() => void> = [];
  private frameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  private lastTime = 0;
  private elapsed = 0;
  private fps = 0;

  constructor(container: HTMLElement, map: WorldMap, options: WorldRendererOptions = {}) {
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
    this.renderer.shadowMap.enabled = false; // Phase 6 adds shadows.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // --- Scene ------------------------------------------------------------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fb7d4); // plain daylight sky

    // --- Camera -----------------------------------------------------------
    this.rig = new CameraRig(map, width / height, options.view ?? "first-person");

    // --- World content ----------------------------------------------------
    const terrain = buildTerrain(map);
    this.scene.add(terrain.group);
    this.disposers.push(terrain.dispose);

    this.assets = new AssetRegistry(WORLD_GLBS);
    const buildings = buildBuildings(map, this.assets, WORLD_ASSET_BINDINGS.buildings);
    this.buildingAssetErrors = buildings.assetErrors;
    this.scene.add(buildings.group);
    this.disposers.push(buildings.dispose);

    const objects = buildObjects(map, this.assets, WORLD_ASSET_BINDINGS.objects);
    this.objectAssetErrors = objects.assetErrors;
    this.scene.add(objects.group);
    this.disposers.push(objects.dispose);
    this.disposers.push(() => this.assets.dispose());

    // --- Player -----------------------------------------------------------
    this.input = new Input(this.renderer.domElement);
    this.player = new PlayerController(map, this.input);

    const avatar = buildPlayer();
    this.playerMesh = avatar.group;
    this.playerMesh.visible = (options.view ?? "first-person") !== "first-person";
    this.scene.add(this.playerMesh);
    this.disposers.push(avatar.dispose);

    this.syncPlayerMesh(0);
    this.rig.setFollowTarget(this.player.position, this.player.facing);
    this.rig.snap();

    this.addLighting();

    // --- Resize -----------------------------------------------------------
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    window.addEventListener("resize", this.handleResize);

    // --- Loop -------------------------------------------------------------
    this.frameId = requestAnimationFrame(this.loop);
  }

  /**
   * Hemisphere fill + one directional key light. No shadows in Phase 1/2.
   *
   * The key comes from the camera's LEFT so the two faces the camera yaw
   * reveals are lit unequally: without that contrast a box reads as a flat
   * silhouette no matter how well it is framed.
   */
  private addLighting() {
    const centre = this.rig.lookAt;

    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x4a5a3a, 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d8, 2.1);
    sun.position.set(centre.x - 34, 46, centre.z + 20);
    sun.target.position.copy(centre);
    this.scene.add(sun);
    this.scene.add(sun.target);

    this.disposers.push(() => {
      hemi.dispose();
      sun.dispose();
    });
  }

  /**
   * Resolves a click against the ground plane and walks there.
   *
   * Founding principle: a click never triggers a consequential action. Here it
   * can only ever set a destination. Picking people — the other thing a click
   * does in the 2D world — arrives with remote players in Phase 4.
   */
  private handleClicks() {
    const click = this.input.consumeClick();
    if (!click) return;

    this.raycaster.setFromCamera(new THREE.Vector2(click.x, click.y), this.rig.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return;

    // Clamp into the map so a click on the sky beyond the edge still resolves
    // to somewhere reachable rather than sending the player at the boundary.
    hit.x = THREE.MathUtils.clamp(hit.x, 0, this.map.widthTiles);
    hit.z = THREE.MathUtils.clamp(hit.z, 0, this.map.heightTiles);

    this.player.setWalkTarget(hit.x, hit.z);
  }

  /** Copies controller state onto the avatar, plus a walk bob. */
  private syncPlayerMesh(elapsed: number) {
    this.playerMesh.position.set(
      this.player.position.x,
      this.player.isMoving ? Math.abs(Math.sin(elapsed * BOB_RATE)) * BOB_AMPLITUDE : 0,
      this.player.position.z,
    );
    this.playerMesh.rotation.y = this.player.facing;
  }

  private handleResize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.rig.setAspect(width / height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height);
  };

  private loop = (now: number) => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.loop);

    const dt = this.lastTime === 0 ? 0 : Math.min((now - this.lastTime) / 1000, MAX_FRAME_DELTA);
    this.lastTime = now;
    this.elapsed += dt;
    if (dt > 0) this.fps = this.fps === 0 ? 1 / dt : this.fps * 0.9 + (1 / dt) * 0.1;

    this.handleClicks();
    this.player.update(dt);
    this.syncPlayerMesh(this.elapsed);

    this.rig.setFollowTarget(this.player.position, this.player.facing);
    this.rig.update(dt);

    this.renderer.render(this.scene, this.rig.camera);
  };

  /** Switch framing at runtime. Diagnostic only — not a player-facing control. */
  setView(view: CameraView) {
    if (this.disposed) return;
    this.playerMesh.visible = view !== "first-person";
    this.rig.setView(view);
  }

  /** Live renderer counters — the performance baseline for later phases. */
  getDiagnostics(): RendererDiagnostics {
    const info = this.renderer.info;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const round = (n: number) => Math.round(n * 10) / 10;
    const p = this.player.position;
    return {
      fps: Math.round(this.fps),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      pixelRatio: this.renderer.getPixelRatio(),
      size: { width: size.x, height: size.y },
      camera: this.rig.info,
      player: {
        scene: { x: round(p.x), y: round(p.y), z: round(p.z) },
        worldPixel: this.player.worldPixel,
        tile: { x: Math.floor(p.x), y: Math.floor(p.z) },
        facingDeg: Math.round(THREE.MathUtils.radToDeg(this.player.facing)),
        speed: round(this.player.speed),
        moving: this.player.isMoving,
        walkingToClick: this.player.hasWalkTarget,
        collision: this.player.collisionInfo,
      },
      assets: {
        buildingErrors: this.buildingAssetErrors,
        objectErrors: this.objectAssetErrors,
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

    this.input.dispose();

    this.disposers.forEach((d) => d());
    this.disposers = [];

    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();

    const canvas = this.renderer.domElement;
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
}
