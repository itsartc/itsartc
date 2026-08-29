import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Renders the procedural-city-6 world.
 *
 * Owns the Scene, camera, WebGL renderer and animation loop. Model loading is
 * the only asynchronous step; everything else is set up synchronously so a
 * failure is easy to attribute.
 *
 * ## Camera
 *
 * A fixed elevated, angled view rather than a free-flying one: the product's
 * whole premise is that a street and its building façades read clearly from the
 * default angle. Orbit is enabled for now as an inspection aid while the world
 * is being evaluated, and is trivially removed once the gameplay camera lands.
 *
 * ## Compression
 *
 * The GLB is meshopt-compressed. The decoder is a small JS module imported from
 * three itself rather than fetched from a CDN, so the app has no external
 * runtime dependency and works offline.
 */

/** Downward viewing angle from horizontal, in degrees. */
const CAMERA_PITCH_DEG = 38;

/** Rotation off the model's axis, so buildings show two faces, not one. */
const CAMERA_YAW_DEG = 35;

const CAMERA_FOV = 50;

/** Breathing room when framing the whole model. */
const FRAME_MARGIN = 1.25;

const MAX_PIXEL_RATIO = 2;

export interface CityDiagnostics {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  pixelRatio: number;
  size: { width: number; height: number };
  model: {
    bboxMin: [number, number, number];
    bboxMax: [number, number, number];
    sizeUnits: [number, number, number];
    meshes: number;
  } | null;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fovDeg: number;
    pitchDeg: number;
    yawDeg: number;
    distance: number;
  };
}

export interface CityRendererOptions {
  /** Called with 0..1 as the model downloads. */
  onProgress?: (fraction: number) => void;
  onLoaded?: () => void;
  onError?: (message: string) => void;
}

const MODEL_URL = "/assets/procedural-city-6/city.glb";

export class CityRenderer {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private model: THREE.Group | null = null;
  private modelStats: CityDiagnostics["model"] = null;

  private frameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  private distance = 300;
  private readonly target = new THREE.Vector3();
  private lastTime = 0;
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
    this.scene.fog = new THREE.Fog(0x9fc4e0, 400, 1400);

    // A generated indoor-style environment gives PBR materials something to
    // reflect. Without it, metal and glass render as flat black.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // --- Camera + controls -------------------------------------------------
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.5, 5000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // never go under the ground
    this.controls.minDistance = 20;
    this.controls.maxDistance = 1500;

    this.addLighting();

    // --- Model -------------------------------------------------------------
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (this.disposed) return;
        this.model = gltf.scene;
        this.scene.add(this.model);
        this.measureAndFrame();
        options.onLoaded?.();
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
   * Reads the model's real bounds and frames the camera to them.
   *
   * Framing is derived rather than hard-coded because the model's scale is
   * whatever Blender exported; a fixed distance that suits one export would put
   * the next one off-screen.
   */
  private measureAndFrame() {
    if (!this.model) return;

    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    const centre = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(centre);

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

    // Look at the middle of the site, a little above ground rather than at the
    // midpoint of the tallest tower.
    this.target.set(centre.x, box.min.y + size.y * 0.18, centre.z);

    // Distance that fits the footprint's larger horizontal axis in view.
    const vFov = THREE.MathUtils.degToRad(CAMERA_FOV);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const span = Math.max(size.x, size.z);
    this.distance = Math.max(
      span / 2 / Math.tan(hFov / 2),
      size.y / 2 / Math.tan(vFov / 2),
    ) * FRAME_MARGIN;

    const pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
    const yaw = THREE.MathUtils.degToRad(CAMERA_YAW_DEG);
    const horizontal = Math.cos(pitch) * this.distance;

    this.camera.position.set(
      this.target.x + horizontal * Math.sin(yaw),
      this.target.y + Math.sin(pitch) * this.distance,
      this.target.z + horizontal * Math.cos(yaw),
    );
    this.camera.far = this.distance * 6;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(this.target);
    this.controls.update();

    // Push fog out past the far side of the site so nothing greys out.
    this.scene.fog = new THREE.Fog(0x9fc4e0, this.distance * 0.9, this.distance * 3.2);
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

    const dt = this.lastTime === 0 ? 0 : (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0) this.fps = this.fps === 0 ? 1 / dt : this.fps * 0.9 + (1 / dt) * 0.1;

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  getDiagnostics(): CityDiagnostics {
    const info = this.renderer.info;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const p = this.camera.position;
    return {
      fps: Math.round(this.fps),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      pixelRatio: this.renderer.getPixelRatio(),
      size: { width: size.x, height: size.y },
      model: this.modelStats,
      camera: {
        position: [p.x, p.y, p.z],
        target: [this.target.x, this.target.y, this.target.z],
        fovDeg: CAMERA_FOV,
        pitchDeg: CAMERA_PITCH_DEG,
        yawDeg: CAMERA_YAW_DEG,
        distance: this.distance,
      },
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

    this.controls.dispose();

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
