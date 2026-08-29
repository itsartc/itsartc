import * as THREE from "three";
import { makeAsphaltTexture, makeFacadeTexture } from "./proceduralTextures";

/**
 * The city's material library.
 *
 * Every surface is a **tiling** material rather than a baked atlas. That is the
 * whole reason a generated city can look sharper than an imported one: a 1024²
 * concrete texture repeated every 4 m resolves at ~256 px per metre, where the
 * same texture stretched across a whole imported city resolves at a fraction of
 * that. It is also far cheaper — the full library is 2.3 MB on disk, against
 * 14 MB for the baked model.
 *
 * Two of the supplied images are **not** seamless: the façade sheet and the
 * road mashup are baked atlases authored for one specific UV layout, and tiling
 * them repeats visible seams and photo edges. Those are drawn procedurally
 * instead (see proceduralTextures), which also gives façades addressable window
 * bays for sponsor signage later.
 *
 * Materials are created once and shared by every mesh that uses them, so adding
 * buildings costs geometry but not draw state.
 */

const BASE = "/assets/city/textures";

export type MaterialName =
  | "road"
  | "sidewalk"
  | "plaza"
  | "grass"
  | "facadeGlass"
  | "facadeTiles"
  | "facadePlaster"
  | "facadeConcrete"
  | "roof"
  | "metal"
  | "bark";

interface TextureSet {
  color?: string;
  normal?: string;
  roughness?: string;
  /** Drawn in code rather than loaded — see proceduralTextures. */
  procedural?: string;
  /** Metres covered by one vertical texture repeat. */
  scale: number;
  /** Metres per horizontal repeat, when it differs from `scale`. */
  scaleX?: number;
}

/** Window palettes per façade style: wall, glass, frame. */
const FACADE_PALETTES: Record<string, { glass: string; frame: string; bays: number }> = {
  "facade-glass": { glass: "#7fa8c9", frame: "#4b5560", bays: 2 },
  "facade-tiles": { glass: "#5d7488", frame: "#6d6559", bays: 2 },
  "facade-plaster": { glass: "#59708a", frame: "#8c7f6d", bays: 2 },
  "facade-concrete": { glass: "#54697e", frame: "#8a8a86", bays: 2 },
};

const SETS: Record<MaterialName, TextureSet> = {
  road: { procedural: "asphalt", scale: 8 },
  sidewalk: { color: "sidewalk_color", normal: "sidewalk_normal", roughness: "sidewalk_rough", scale: 4 },
  plaza: { color: "plaza_color", roughness: "plaza_rough", scale: 4 },
  grass: { color: "grass_color", normal: "grass_normal", scale: 4 },
  // One repeat is one storey, so window rows always land on floors.
  facadeGlass: { procedural: "facade-glass", scale: 3.6, scaleX: 7.2 },
  facadeTiles: { procedural: "facade-tiles", scale: 3.6, scaleX: 7.2 },
  facadePlaster: { procedural: "facade-plaster", scale: 3.6, scaleX: 7.2 },
  facadeConcrete: { procedural: "facade-concrete", scale: 3.6, scaleX: 7.2 },
  roof: { color: "roof_color", normal: "roof_normal", scale: 6 },
  metal: { color: "metal_color", normal: "metal_normal", scale: 2 },
  bark: { color: "bark_color", normal: "bark_normal", scale: 2 },
};

export class CityMaterials {
  private readonly loader = new THREE.TextureLoader();
  private readonly cache = new Map<string, THREE.MeshStandardMaterial>();
  private readonly proceduralCache = new Map<string, THREE.Texture>();
  private readonly loaded = new Map<string, THREE.Texture>();
  private readonly textures: THREE.Texture[] = [];
  private readonly anisotropy: number;

  constructor(renderer: THREE.WebGLRenderer) {
    this.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  /**
   * Returns a per-material copy of a shared texture.
   *
   * `repeat` lives on the texture, not the material, so two materials wanting
   * different tiling densities cannot share one instance. Cloning gives each an
   * independent repeat while both keep pointing at the same image source, so
   * the GPU still only uploads it once.
   */
  private variant(base: THREE.Texture): THREE.Texture {
    const tex = base.clone();
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  /** Draws a procedural texture once; callers get a clone to tile themselves. */
  private procedural(key: string, make: () => THREE.Texture): THREE.Texture {
    let base = this.proceduralCache.get(key);
    if (!base) {
      base = make();
      base.anisotropy = this.anisotropy;
      this.proceduralCache.set(key, base);
      this.textures.push(base);
    }
    return this.variant(base);
  }

  /** Loads a texture file once; callers get a clone to tile themselves. */
  private texture(file: string, srgb: boolean): THREE.Texture {
    let base = this.loaded.get(file);
    if (!base) {
      base = this.loader.load(`${BASE}/${file}.webp`);
      base.wrapS = THREE.RepeatWrapping;
      base.wrapT = THREE.RepeatWrapping;
      // Grazing-angle surfaces — roads especially — shimmer without this.
      base.anisotropy = this.anisotropy;
      if (srgb) base.colorSpace = THREE.SRGBColorSpace;
      this.loaded.set(file, base);
      this.textures.push(base);
    }
    return this.variant(base);
  }

  /**
   * A material whose textures repeat once per `scale` metres over a surface of
   * the given size. Repeats are baked per material instance rather than per
   * mesh so meshes stay shareable.
   */
  get(name: MaterialName, width: number, height: number, tint?: string): THREE.MeshStandardMaterial {
    const set = SETS[name];
    const repeatX = Math.max(1, Math.round(width / (set.scaleX ?? set.scale)));
    const repeatY = Math.max(1, Math.round(height / set.scale));
    const key = `${name}:${repeatX}x${repeatY}:${tint ?? ""}`;

    const cached = this.cache.get(key);
    if (cached) return cached;

    const material = new THREE.MeshStandardMaterial({
      color: tint ? new THREE.Color(tint) : 0xffffff,
      roughness: 0.9,
      metalness: name === "facadeGlass" ? 0.35 : 0.02,
    });

    const apply = (tex: THREE.Texture) => {
      tex.repeat.set(repeatX, repeatY);
      return tex;
    };

    if (set.procedural === "asphalt") {
      material.map = apply(this.procedural("asphalt", makeAsphaltTexture));
      material.roughness = 0.95;
    } else if (set.procedural) {
      const palette = FACADE_PALETTES[set.procedural];
      material.map = apply(
        this.procedural(`${set.procedural}:${tint ?? "plain"}`, () =>
          makeFacadeTexture({
            bays: palette.bays,
            wall: tint ?? "#c3c3bf",
            glass: palette.glass,
            frame: palette.frame,
          }),
        ),
      );
      // The tint is already painted into the texture; leave the material white
      // so it is not applied twice.
      material.color.set(0xffffff);
    }

    if (set.color) material.map = apply(this.texture(set.color, true));
    if (set.normal) material.normalMap = apply(this.texture(set.normal, false));
    if (set.roughness) material.roughnessMap = apply(this.texture(set.roughness, false));

    if (name === "facadeGlass") material.roughness = 0.25;

    this.cache.set(key, material);
    return material;
  }

  dispose() {
    this.cache.forEach((m) => m.dispose());
    this.cache.clear();
    this.proceduralCache.clear();
    this.loaded.clear();
    this.textures.forEach((t) => t.dispose());
    this.textures.length = 0;
  }
}
