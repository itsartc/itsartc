import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CityCollision } from "./CityCollision";
import { Input } from "./Input";
import { PlayerController } from "./PlayerController";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { buildAvatar } from "./build/PlayerAvatar";

/**
 * Renders the procedural-city-6 world and the player walking through it.
 *
 * Owns the Scene, camera, WebGL renderer and animation loop. Model loading is
 * the only asynchronous step; everything else is set up synchronously so a
 * failure is easy to attribute.
 *
 * ## Camera
 *
 * A third-person chase camera behind the player, in the vein of a modern
 * open-world action game. Movement input is read relative to wherever it looks,
 * and it eases back behind the player as they walk.
 *
 * ## Compression
 *
 * The GLB is meshopt-compressed. The decoder is a small JS module imported from
 * three itself rather than fetched from a CDN, so the app has no external
 * runtime dependency and works offline.
 *
 * ## Units
 *
 * The model measures ~248 x 196 units across with towers ~112 tall, which reads
 * as metres. Every distance and speed in this subsystem is therefore metric.
 */

const CAMERA_FOV = 55;
const MAX_PIXEL_RATIO = 2;

/** Clamp for a single frame's delta, in seconds — protects against tab resume. */
const MAX_FRAME_DELTA = 0.1;

/** Vertical bob while walking, in metres, and its rate. */
const BOB_AMPLITUDE = 0.05;
const BOB_RATE = 9;

const MODEL_URL = "/assets/procedural-city-6/city.glb";

export interface CityDiagnostics {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  pixelRatio: number;
  size: { width: number; height: number };
  ready: boolean;
  model: {
    bboxMin: [number, number, number];
    bboxMax: [number, number, number];
    sizeUnits: [number, number, number];
    meshes: number;
  } | null;
  player: {
    position: [number, number, number];
    facingDeg: number;
    speed: number;
    moving: boolean;
    grounded: boolean;
    running: boolean;
  } | null;
  camera: ThirdPersonCamera["info"] | null;
}

export interface CityRendererOptions {
  onProgress?: (fraction: number) => void;
  onLoaded?: () => void;
  onError?: (message: string) => void;
}

export class CityRenderer {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private collision: CityCollision | null = null;
  private input: Input | null = null;
  private player: PlayerController | null = null;
  private chase: ThirdPersonCamera | null = null;
  private avatar: THREE.Group | null = null;
  private disposeAvatar: (() => void) | null = null;

  private model: THREE.Group | null = null;
  private modelStats: CityDiagnostics["model"] = null;

  private frameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  private lastTime = 0;
  private elapsed = 0;
  private fps = 0;

  constructor(container: HTMLElement, options: CityRendererOptions = {}) {
    this.container = container;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    // --- Renderer ---------------------------------------------------------
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // The model uses PBR materials with clearcoat and transmission; filmic tone
    // mapping keeps bright façades and glass from clipping to flat white.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // --- Scene ------------------------------------------------------------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fc4e0);
    this.scene.fog = new THREE.Fog(0x9fc4e0, 120, 620);

    // A generated environment gives PBR materials something to reflect. Without
    // it, the model's metal and glass render as flat black.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // Near/far are deliberately tight. Depth-buffer precision falls off with
    // the near:far ratio, and road markings are decals sitting a fraction of a
    // millimetre above the road: at 0.1 near against 2000 far there is not
    // enough precision to keep them apart, so they flicker as the camera moves.
    // 0.5 : 900 is a 30x smaller ratio and still far past the fog.
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.5, 900);
    this.addLighting();

    // --- Model -------------------------------------------------------------
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (this.disposed) return;
        try {
          this.model = gltf.scene;
          this.prepareModel(this.model);
          this.scene.add(this.model);
          this.setupWorld();
          options.onLoaded?.();
        } catch (err) {
          options.onError?.(err instanceof Error ? err.message : String(err));
        }
      },
      (event) => {
        if (event.total > 0) options.onProgress?.(event.loaded / event.total);
      },
      (err) => {
        if (this.disposed) return;
        options.onError?.(err instanceof Error ? err.message : String(err));
      },
    );

    // --- Resize -------------------------------------------------------------
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    window.addEventListener("resize", this.handleResize);

    this.frameId = requestAnimationFrame(this.loop);
  }

  /**
   * Prepares the loaded city for real-time viewing: texture filtering,
   * transparency handling, and bounding volumes.
   *
   * ## Transparency
   *
   * Blender exported the road markings, stains, street clutter and tree
   * foliage with alphaMode BLEND, which three renders as `transparent: true`.
   * Transparent surfaces skip depth writes and are re-sorted by distance every
   * frame, so as the camera moves the sort order flips and whole surfaces swap
   * in front of one another — the flickering seen while walking. Because these
   * are cutout textures (their names literally say "masked" and "alpha"), the
   * right treatment is alpha testing: they rejoin the opaque queue, the depth
   * buffer orders them per pixel, and nothing pops.
   *
   * Genuine glass is left alone — transmission needs real blending.
   *
   * ## Depth
   *
   * Markings and stains are decals lying on the road surface. Once they write
   * depth they would z-fight with it, so a small polygon offset biases them
   * toward the camera.
   *
   * ## Filtering
   *
   * A chase camera sits low and looks down the street, so road surfaces are
   * viewed at a very grazing angle. Standard mipmapping picks an over-blurred
   * level for that case and fine markings crawl and sparkle as the camera
   * moves. Anisotropic filtering samples along the direction of compression
   * instead, which is what stops the shimmering.
   */
  private prepareModel(root: THREE.Object3D) {
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const seenTextures = new Set<THREE.Texture>();
    const seenMaterials = new Set<THREE.Material>();

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;

      // Stale bounds make three cull meshes that are actually on screen, which
      // reads as parts of the world blinking out as you turn.
      mesh.geometry?.computeBoundingSphere();
      mesh.geometry?.computeBoundingBox();

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!material || seenMaterials.has(material)) continue;
        seenMaterials.add(material);

        const physical = material as THREE.MeshPhysicalMaterial;
        const isGlass = (physical.transmission ?? 0) > 0;

        if (material.transparent && !isGlass) {
          material.transparent = false;
          material.alphaTest = 0.3;
          material.depthWrite = true;
          material.polygonOffset = true;
          material.polygonOffsetFactor = -2;
          material.polygonOffsetUnits = -2;
          material.needsUpdate = true;
        }

        for (const value of Object.values(material)) {
          const tex = value as THREE.Texture;
          if (!tex || !tex.isTexture || seenTextures.has(tex)) continue;
          seenTextures.add(tex);
          tex.anisotropy = maxAnisotropy;
          tex.needsUpdate = true;
        }
      }
    });
  }

  /**
   * Sun plus sky fill. The environment map handles reflections; these give the
   * scene a direction so façades separate into lit and shaded faces.
   */
  private addLighting() {
    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x4a4a44, 1.1);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sun.position.set(-160, 220, 140);
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  /**
   * Builds everything that depends on the loaded city: collision, a spawn point
   * on the street, the player, and the camera behind them.
   */
  private setupWorld() {
    if (!this.model) return;

    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    box.getSize(size);

    let meshes = 0;
    this.model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
    });
    this.modelStats = {
      bboxMin: [box.min.x, box.min.y, box.min.z],
      bboxMax: [box.max.x, box.max.y, box.max.z],
      sizeUnits: [size.x, size.y, size.z],
      meshes,
    };

    this.collision = new CityCollision(this.model);

    // Find open street rather than guessing a coordinate: a hardcoded spawn
    // would land inside a building the moment the model is re-exported.
    const spawn =
      this.collision.findStreetSpawn(box) ??
      new THREE.Vector3(box.getCenter(new THREE.Vector3()).x, this.collision.groundY, box.getCenter(new THREE.Vector3()).z);

    this.input = new Input();
    this.player = new PlayerController(this.collision, this.input, spawn);

    const avatar = buildAvatar();
    this.avatar = avatar.group;
    this.disposeAvatar = avatar.dispose;
    this.avatar.position.copy(spawn);
    this.scene.add(this.avatar);

    this.chase = new ThirdPersonCamera(this.camera, this.collision, this.renderer.domElement);
    this.chase.snapBehind(spawn, 0);
  }

  private handleResize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height);
  };

  private loop = (now: number) => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.loop);

    // Frame rate is measured from the RAW delta. Measuring it from the clamped
    // delta silently caps the reading at 1 / MAX_FRAME_DELTA, which reports a
    // struggling renderer as a healthy one.
    const rawDt = this.lastTime === 0 ? 0 : (now - this.lastTime) / 1000;
    const dt = Math.min(rawDt, MAX_FRAME_DELTA);
    this.lastTime = now;
    this.elapsed += dt;
    if (rawDt > 0) this.fps = this.fps === 0 ? 1 / rawDt : this.fps * 0.9 + (1 / rawDt) * 0.1;

    if (this.player && this.chase && this.avatar) {
      this.player.update(dt, this.chase.facingYaw);

      this.avatar.position.set(
        this.player.position.x,
        this.player.position.y +
          (this.player.isMoving ? Math.abs(Math.sin(this.elapsed * BOB_RATE)) * BOB_AMPLITUDE : 0),
        this.player.position.z,
      );
      this.avatar.rotation.y = this.player.facing;

      this.chase.update(dt, this.player.position, this.player.facing, this.player.isMoving);
    }

    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Internals exposed for smoke tests and console probing. Not part of the
   * runtime contract — nothing in the app reads this.
   */
  get debug() {
    return {
      collision: this.collision,
      player: this.player,
      chase: this.chase,
      scene: this.scene,
      model: this.model,
      THREE,
    };
  }

  getDiagnostics(): CityDiagnostics {
    const info = this.renderer.info;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      fps: Math.round(this.fps),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      pixelRatio: this.renderer.getPixelRatio(),
      size: { width: size.x, height: size.y },
      ready: this.player !== null,
      model: this.modelStats,
      player: this.player
        ? {
            position: [
              round(this.player.position.x),
              round(this.player.position.y),
              round(this.player.position.z),
            ],
            facingDeg: Math.round(THREE.MathUtils.radToDeg(this.player.facing)),
            speed: round(this.player.speed),
            moving: this.player.isMoving,
            grounded: this.player.isGrounded,
            running: this.input?.running ?? false,
          }
        : null,
      camera: this.chase ? this.chase.info : null,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;

    window.removeEventListener("resize", this.handleResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.input?.dispose();
    this.chase?.dispose();
    this.collision?.dispose();
    this.disposeAvatar?.();

    // Release every GPU resource the loaded model brought with it.
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      (Array.isArray(mat) ? mat : [mat]).forEach((m) => {
        if (!m) return;
        Object.values(m).forEach((v) => {
          if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
        });
        m.dispose();
      });
    });
    this.scene.clear();

    this.renderer.dispose();
    this.renderer.forceContextLoss();
    const canvas = this.renderer.domElement;
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
}
