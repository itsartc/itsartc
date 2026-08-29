import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * Bloom applied to chosen objects only.
 *
 * Threshold bloom does not work in this world. It decides what glows by
 * brightness, and in a daylight scene the sky, the sun disc and any pale
 * sunlit wall are already brighter than the signage meant to glow — so either
 * the whole city blooms or nothing does. Two attempts at tuning the threshold
 * produced exactly those two results.
 *
 * Selecting by layer removes the guesswork. The scene is rendered twice: once
 * with everything that should not glow painted black, which the bloom pass
 * turns into a glow texture, and once normally. The two are then added. Only
 * objects on the bloom layer can ever contribute, whatever the time of day or
 * how bright the sun happens to be.
 *
 * The cost is a second geometry pass. At this city's scale — around forty draw
 * calls — that is a cheap price for a result that cannot drift.
 */

/** Objects on this layer glow. Everything else is masked out of the bloom pass. */
export const BLOOM_LAYER = 1;

const STRENGTH = 0.55;
const RADIUS = 0.35;
/**
 * Zero: the mask has already decided what glows, so brightness must not.
 *
 * It also means emissive materials need no inflated intensity to clear a bar —
 * their value goes straight into the glow. Driving them to 6 with a threshold
 * of zero, as an earlier pass did, produced a white veil over the whole frame.
 */
const THRESHOLD = 0;

export class SelectiveBloom {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;

  private readonly bloomComposer: EffectComposer;
  private readonly finalComposer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;

  private readonly bloomLayer = new THREE.Layers();
  private readonly darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  private readonly saved = new Map<string, THREE.Material | THREE.Material[]>();

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.bloomLayer.set(BLOOM_LAYER);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      STRENGTH,
      RADIUS,
      THRESHOLD,
    );

    this.bloomComposer = new EffectComposer(renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new RenderPass(scene, camera));
    this.bloomComposer.addPass(this.bloomPass);

    // Additive composite: the base render plus the glow, then tone mapping and
    // colour-space conversion at the very end.
    const mix = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
          }
        `,
        defines: {},
      }),
      "baseTexture",
    );
    mix.needsSwap = true;

    this.finalComposer = new EffectComposer(renderer);
    this.finalComposer.addPass(new RenderPass(scene, camera));
    this.finalComposer.addPass(mix);
    this.finalComposer.addPass(new OutputPass());
  }

  /** Paints everything that must not glow black, for the bloom pass only. */
  private mask = (object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (this.bloomLayer.test(mesh.layers)) return;
    this.saved.set(mesh.uuid, mesh.material);
    mesh.material = this.darkMaterial;
  };

  private unmask = (object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;
    const original = this.saved.get(mesh.uuid);
    if (!original) return;
    mesh.material = original;
    this.saved.delete(mesh.uuid);
  };

  render() {
    // The sky and fog would otherwise light up the whole glow texture.
    const background = this.scene.background;
    const fog = this.scene.fog;
    this.scene.background = null;
    this.scene.fog = null;

    this.scene.traverse(this.mask);
    this.bloomComposer.render();
    this.scene.traverse(this.unmask);

    this.scene.background = background;
    this.scene.fog = fog;

    this.finalComposer.render();
  }

  setSize(width: number, height: number, pixelRatio: number) {
    this.bloomComposer.setPixelRatio(pixelRatio);
    this.bloomComposer.setSize(width, height);
    this.finalComposer.setPixelRatio(pixelRatio);
    this.finalComposer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  dispose() {
    this.bloomComposer.dispose();
    this.finalComposer.dispose();
    this.darkMaterial.dispose();
    this.saved.clear();
  }
}
