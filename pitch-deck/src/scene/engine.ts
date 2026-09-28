import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildCharacter, clay, type CharacterRig } from './character';

export type CameraMode = 'isometric' | 'perspective';
export type MaterialPreset = 'matte' | 'copper' | 'rubber' | 'gloss';
export type StylePreset = 'none' | 'pastel' | 'sunset';

export interface LayerDef {
  id: string;
  name: string;
  kind: 'camera' | 'dome' | 'key' | 'area' | 'object';
}

export const MATERIAL_PRESETS: Record<MaterialPreset, Partial<THREE.MeshPhysicalMaterialParameters> & { color: string }> = {
  matte: { color: '#b9b9b9', roughness: 0.75, metalness: 0, clearcoat: 0, sheen: 0.3 },
  copper: { color: '#b86a4b', roughness: 0.35, metalness: 0.75, clearcoat: 0.2, sheen: 0 },
  rubber: { color: '#2b2b2b', roughness: 0.9, metalness: 0, clearcoat: 0, sheen: 0.4 },
  gloss: { color: '#0e0e0e', roughness: 0.12, metalness: 0.1, clearcoat: 1, sheen: 0 },
};

interface Entry {
  object: THREE.Object3D;
  locked: boolean;
  originals?: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
}

export class SceneEngine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  persp: THREE.PerspectiveCamera;
  ortho: THREE.OrthographicCamera;
  camera: THREE.Camera;
  controls!: OrbitControls;
  rig: CharacterRig;
  entries = new Map<string, Entry>();
  mode: CameraMode = 'isometric';
  zoom = 1;
  fov = 32;

  animations = { idle: true, wave: false };
  turntableUntil = 0;
  turntableDuration = 8;
  onTurntableEnd?: () => void;
  onSelect?: (id: string | null) => void;

  private host: HTMLElement;
  private raf = 0;
  private clock = new THREE.Clock();
  private ro: ResizeObserver;
  private dome: THREE.HemisphereLight;
  private key: THREE.DirectionalLight;
  private area: THREE.DirectionalLight;
  private bgColor = new THREE.Color('#f8f7f7');
  private extraCount = 0;
  private target = new THREE.Vector3(0, 1.3, 0);
  private pointerDown = { x: 0, y: 0 };

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    this.scene.background = this.bgColor.clone();

    this.persp = new THREE.PerspectiveCamera(this.fov, 1, 0.1, 100);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera = this.ortho;

    // ---------- Lights ----------
    this.dome = new THREE.HemisphereLight('#ffffff', '#d9d3cc', 0.9);
    this.dome.name = 'Dome Light';
    this.key = new THREE.DirectionalLight('#fff4ea', 1.9);
    this.key.name = 'Key Light';
    this.key.position.set(1.4, 4.5, 6);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.left = -2;
    this.key.shadow.camera.right = 2;
    this.key.shadow.camera.top = 3.2;
    this.key.shadow.camera.bottom = -1;
    this.key.shadow.radius = 6;
    this.key.shadow.bias = -0.0008;
    this.key.shadow.normalBias = 0.045;
    this.area = new THREE.DirectionalLight('#e8f0ff', 0.7);
    this.area.name = 'Area Light';
    this.area.position.set(-4, 3, 2);
    this.scene.add(this.dome, this.key, this.area);

    // ---------- Backgrounds ----------
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'Background 1';
    this.scene.add(floor);

    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 64),
      new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, opacity: 0.55 }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.002;
    blob.scale.set(1, 0.6, 1);
    blob.name = 'Background 2';
    this.scene.add(blob);

    // ---------- Character ----------
    this.rig = buildCharacter();
    this.scene.add(this.rig.root);

    const cameraProxy = new THREE.Object3D();
    this.entries.set('camera', { object: cameraProxy, locked: false });
    this.entries.set('dome', { object: this.dome, locked: false });
    this.entries.set('key', { object: this.key, locked: false });
    this.entries.set('area', { object: this.area, locked: false });
    this.entries.set('object2', { object: this.rig.bag, locked: false });
    this.entries.set('bg2', { object: blob, locked: false });
    this.entries.set('character', { object: this.rig.body, locked: false });
    this.entries.set('bg1', { object: floor, locked: false });

    this.setupControls();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.handlePointerDown);
    el.addEventListener('pointerup', this.handlePointerUp);

    this.loop();
  }

  // ---------- Camera ----------
  private setupControls() {
    const prevTarget = this.controls?.target.clone() ?? this.target.clone();
    this.controls?.dispose();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(prevTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.enablePan = true;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 20;
    this.controls.minZoom = 0.3;
    this.controls.maxZoom = 4;
    this.controls.addEventListener('change', () => {
      const cam = this.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
      this.zoom = cam.zoom;
    });
    this.controls.update();
  }

  setCameraMode(mode: CameraMode) {
    if (mode === this.mode) return;
    const from = this.camera;
    this.mode = mode;
    this.camera = mode === 'isometric' ? this.ortho : this.persp;
    this.camera.position.copy(from.position);
    this.camera.quaternion.copy(from.quaternion);
    this.setupControls();
    this.resize();
  }

  setDistortion(t: number) {
    // 0..1 → narrow (telephoto) to wide-angle
    this.fov = 18 + t * 62;
    this.frame();
  }

  setZoom(z: number) {
    this.zoom = z;
    this.ortho.zoom = z;
    this.persp.zoom = z;
    this.ortho.updateProjectionMatrix();
    this.persp.updateProjectionMatrix();
  }

  resetView() {
    this.controls.target.copy(this.target);
    this.frame(true);
  }

  private frame(resetPosition = false) {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    const aspect = w / h;
    // world units needed to fit the character comfortably
    const fitH = 4.2;
    const fitW = 2.2;
    const halfH = Math.max(fitH / 2, fitW / 2 / aspect);

    this.ortho.left = -halfH * aspect;
    this.ortho.right = halfH * aspect;
    this.ortho.top = halfH;
    this.ortho.bottom = -halfH;
    this.ortho.updateProjectionMatrix();

    this.persp.fov = this.fov;
    this.persp.aspect = aspect;
    this.persp.updateProjectionMatrix();

    // keep perspective framing constant while fov changes (dolly zoom)
    const dist = halfH / Math.tan(THREE.MathUtils.degToRad(this.fov / 2));
    const dir = resetPosition
      ? new THREE.Vector3(0, 0.12, 1).normalize()
      : this.camera.position.clone().sub(this.controls?.target ?? this.target).normalize();
    const target = this.controls?.target ?? this.target;
    const d = this.mode === 'perspective' ? dist : 10;
    this.camera.position.copy(target).addScaledVector(dir, d);
    this.camera.lookAt(target);
    this.controls?.update();
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const first = !this.resizedOnce;
    this.resizedOnce = true;
    this.frame(first);
  }
  private resizedOnce = false;

  // ---------- Layers ----------
  setVisible(id: string, visible: boolean) {
    const e = this.entries.get(id);
    if (e) e.object.visible = visible;
  }

  setLocked(id: string, locked: boolean) {
    const e = this.entries.get(id);
    if (e) e.locked = locked;
  }

  applyMaterial(id: string, preset: MaterialPreset | null) {
    const e = this.entries.get(id);
    if (!e || e.locked) return false;
    // Nested layers (e.g. the bag inside the character) keep their own material.
    const others = new Set([...this.entries.values()].map((x) => x.object).filter((o) => o !== e.object));
    const meshes: THREE.Mesh[] = [];
    const walk = (o: THREE.Object3D) => {
      if (others.has(o)) return;
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m.material instanceof THREE.MeshBasicMaterial) && !(m.material instanceof THREE.ShadowMaterial))
        meshes.push(m);
      o.children.forEach(walk);
    };
    walk(e.object);
    if (!meshes.length) return false;
    if (!e.originals) {
      e.originals = new Map();
      meshes.forEach((m) => e.originals!.set(m, m.material));
    }
    if (!preset) {
      meshes.forEach((m) => (m.material = e.originals!.get(m) ?? m.material));
      return true;
    }
    const mat = clay(MATERIAL_PRESETS[preset].color, MATERIAL_PRESETS[preset]);
    meshes.forEach((m) => {
      const orig = e.originals!.get(m) as THREE.MeshPhysicalMaterial | undefined;
      // keep transparent helpers (cheeks, lenses) as they were
      if (orig && orig.transparent) return;
      m.material = mat;
    });
    return true;
  }

  addObject(): LayerDef {
    this.extraCount += 1;
    const n = this.extraCount + 2;
    const kinds = [
      () => new THREE.SphereGeometry(0.28, 48, 32),
      () => new THREE.TorusKnotGeometry(0.2, 0.07, 128, 16),
      () => new RoundedBoxGeometry(0.45, 0.45, 0.45, 6, 0.08),
      () => new THREE.TorusGeometry(0.22, 0.09, 24, 64),
      () => new THREE.ConeGeometry(0.26, 0.5, 48),
    ];
    const palette = ['#f2b8a2', '#9fc3d6', '#e7c86b', '#b7a6e0', '#8fcfa6'];
    const geo = kinds[(this.extraCount - 1) % kinds.length]();
    const m = new THREE.Mesh(geo, clay(palette[(this.extraCount - 1) % palette.length], { roughness: 0.5 }));
    m.castShadow = m.receiveShadow = true;
    const side = this.extraCount % 2 ? 1 : -1;
    const ring = Math.ceil(this.extraCount / 2);
    m.position.set(side * (0.95 + ring * 0.45), 0.35, -0.2 * ring);
    geo.computeBoundingBox();
    m.position.y = -geo.boundingBox!.min.y + 0.001;
    m.name = `Object ${n}`;
    this.scene.add(m);
    const id = `obj${n}`;
    this.entries.set(id, { object: m, locked: false });
    // pop-in animation
    m.scale.setScalar(0.01);
    const start = performance.now();
    const grow = () => {
      const t = Math.min(1, (performance.now() - start) / 450);
      const s = 1 - Math.pow(1 - t, 3) * Math.cos(t * 6);
      m.scale.setScalar(Math.max(0.01, s));
      if (t < 1) requestAnimationFrame(grow);
    };
    grow();
    return { id, name: m.name, kind: 'object' };
  }

  // ---------- Look ----------
  setBackground(hex: string, opacity: number) {
    this.bgColor.set(hex);
    const bg = this.bgColor.clone().lerp(new THREE.Color('#ffffff'), 1 - opacity);
    this.scene.background = bg;
  }

  setStyle(style: StylePreset) {
    if (style === 'pastel') {
      this.dome.color.set('#eaf3ff');
      this.dome.groundColor.set('#f3d9d9');
      this.key.color.set('#fff1e6');
      this.area.color.set('#b9d6ff');
      this.area.intensity = 1.2;
      this.scene.environmentIntensity = 0.4;
    } else if (style === 'sunset') {
      this.dome.color.set('#ffd6e8');
      this.dome.groundColor.set('#6c4a9e');
      this.key.color.set('#ff9e7a');
      this.area.color.set('#9b7bff');
      this.area.intensity = 1.4;
      this.scene.environmentIntensity = 0.3;
    } else {
      this.dome.color.set('#ffffff');
      this.dome.groundColor.set('#d9d3cc');
      this.key.color.set('#fff4ea');
      this.area.color.set('#e8f0ff');
      this.area.intensity = 0.7;
      this.scene.environmentIntensity = 0.35;
    }
  }

  playTurntable(seconds: number) {
    this.turntableDuration = seconds;
    this.turntableUntil = this.clock.elapsedTime + seconds;
  }

  stopTurntable() {
    this.turntableUntil = 0;
    this.rig.root.rotation.y = 0;
  }

  exportPNG(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  // ---------- Picking ----------
  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY };
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y) > 5) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.scene.children, true).filter((h) => h.object.visible);
    for (const h of hits) {
      for (const [id, entry] of this.entries) {
        if (['bg1', 'bg2', 'camera', 'dome', 'key', 'area'].includes(id)) continue;
        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (o === entry.object) {
            this.onSelect?.(id);
            return;
          }
          o = o.parent;
        }
      }
    }
    this.onSelect?.(null);
  };

  // ---------- Loop ----------
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const t = this.clock.getElapsedTime();
    const { rig } = this;

    if (this.animations.idle) {
      const b = Math.sin(t * 2.2);
      rig.body.position.y = b * 0.012;
      rig.body.scale.set(1 + b * 0.004, 1 - b * 0.004, 1 + b * 0.004);
      rig.head.rotation.z = Math.sin(t * 0.9) * 0.035;
      rig.head.rotation.y = Math.sin(t * 0.6) * 0.06;
      const blink = t % 4 < 0.12 ? 0.1 : 1;
      rig.eyes.forEach((e) => (e.scale.y = blink));
    } else {
      rig.body.position.y = 0;
      rig.body.scale.set(1, 1, 1);
      rig.head.rotation.set(0, 0, 0);
      rig.eyes.forEach((e) => (e.scale.y = 1));
    }

    const waveTarget = this.animations.wave ? -2.4 + Math.sin(t * 8) * 0.35 : 0;
    rig.rightArm.rotation.z += (waveTarget - rig.rightArm.rotation.z) * 0.12;

    if (this.turntableUntil) {
      const remaining = this.turntableUntil - t;
      if (remaining <= 0) {
        this.turntableUntil = 0;
        rig.root.rotation.y = 0;
        this.onTurntableEnd?.();
      } else {
        const p = 1 - remaining / this.turntableDuration;
        const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        rig.root.rotation.y = eased * Math.PI * 2;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.handlePointerDown);
    el.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.dispose();
    el.remove();
  }
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.35)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0.12)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
