import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { downtown } from "@/world/downtown";
import { KERB_HEIGHT } from "@/world/schema";
import { CityMaterials } from "./materials/CityMaterials";
import { buildCity } from "./build/CityBuilder";
import { BoxCollision } from "./collision/BoxCollision";
import { Input } from "./Input";
import { PlayerController } from "./PlayerController";
import { ThirdPersonCamera } from "./ThirdPersonCamera";
import { buildAvatar } from "./build/PlayerAvatar";

/**
 * Renders Downtown — the city we generate ourselves — and the player in it.
 *
 * The counterpart to CityRenderer, which loads an imported GLB. This one takes
 * no download beyond its texture library: the geometry is produced on the
 * client from a few hundred bytes of layout data, which is why it starts
 * instantly and why every building is an editable record rather than baked
 * triangles.
 */

const CAMERA_FOV = 55;
const MAX_PIXEL_RATIO = 2;
const MAX_FRAME_DELTA = 0.1;
const BOB_AMPLITUDE = 0.05;
const BOB_RATE = 9;

export interface DowntownDiagnostics {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  pixelRatio: number;
  size: { width: number; height: number };
  ready: boolean;
  city: {
    sizeMetres: [number, number];
    buildings: number;
    props: number;
    colliders: number;
  };
  player: {
    position: [number, number, number];
    facingDeg: number;
    speed: number;
    moving: boolean;
    grounded: boolean;
  } | null;
  camera: ThirdPersonCamera["info"] | null;
}

export class DowntownRenderer {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private materials: CityMaterials;
  private city: ReturnType<typeof buildCity>;
  private collision: BoxCollision;
  private input: Input;
  private player: PlayerController;
  private chase: ThirdPersonCamera;
  private avatar: THREE.Group;
  private disposeAvatar: () => void;

  private frameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;
  private lastTime = 0;
  private elapsed = 0;
  private fps = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fc4e0);
    this.scene.fog = new THREE.Fog(0x9fc4e0, 140, 520);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // Tight near:far, so decal-scale depth differences stay resolvable.
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.5, 900);

    this.addLighting();

    // --- World ------------------------------------------------------------
    this.materials = new CityMaterials(this.renderer);
    this.city = buildCity(downtown, this.materials);
    this.scene.add(this.city.group);

    this.collision = new BoxCollision(downtown, this.city.colliders);

    const spawn = new THREE.Vector3(downtown.spawn.x, KERB_HEIGHT, downtown.spawn.z);
    this.input = new Input();
    this.player = new PlayerController(this.collision, this.input, spawn);

    const avatar = buildAvatar();
    this.avatar = avatar.group;
    this.disposeAvatar = avatar.dispose;
    this.avatar.position.copy(spawn);
    this.scene.add(this.avatar);

    this.chase = new ThirdPersonCamera(this.camera, this.collision, this.renderer.domElement);
    this.chase.snapBehind(spawn, 0);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    window.addEventListener("resize", this.handleResize);
    this.frameId = requestAnimationFrame(this.loop);
  }

  private addLighting() {
    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x60605a, 1.0);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4e0, 2.3);
    sun.position.set(-180, 260, 160);
    this.scene.add(sun);
    this.scene.add(sun.target);
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

    const rawDt = this.lastTime === 0 ? 0 : (now - this.lastTime) / 1000;
    const dt = Math.min(rawDt, MAX_FRAME_DELTA);
    this.lastTime = now;
    this.elapsed += dt;
    if (rawDt > 0) this.fps = this.fps === 0 ? 1 / rawDt : this.fps * 0.9 + (1 / rawDt) * 0.1;

    this.player.update(dt, this.chase.facingYaw);
    this.avatar.position.set(
      this.player.position.x,
      this.player.position.y +
        (this.player.isMoving ? Math.abs(Math.sin(this.elapsed * BOB_RATE)) * BOB_AMPLITUDE : 0),
      this.player.position.z,
    );
    this.avatar.rotation.y = this.player.facing;
    this.chase.update(dt, this.player.position, this.player.facing, this.player.isMoving);

    this.renderer.render(this.scene, this.camera);
  };

  get debug() {
    return { collision: this.collision, player: this.player, chase: this.chase, city: downtown, THREE };
  }

  getDiagnostics(): DowntownDiagnostics {
    const info = this.renderer.info;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const round = (n: number) => Math.round(n * 100) / 100;
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
      ready: true,
      city: {
        sizeMetres: [downtown.size.w, downtown.size.d],
        buildings: downtown.buildings.length,
        props: downtown.props.length,
        colliders: this.city.colliders.length,
      },
      player: {
        position: [round(p.x), round(p.y), round(p.z)],
        facingDeg: Math.round(THREE.MathUtils.radToDeg(this.player.facing)),
        speed: round(this.player.speed),
        moving: this.player.isMoving,
        grounded: this.player.isGrounded,
      },
      camera: this.chase.info,
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

    this.input.dispose();
    this.chase.dispose();
    this.collision.dispose();
    this.city.dispose();
    this.disposeAvatar();
    this.materials.dispose();

    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    const canvas = this.renderer.domElement;
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
}
