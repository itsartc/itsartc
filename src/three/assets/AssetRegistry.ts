import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export interface GlbAssetDefinition {
  /** Public URL for one GLB. Keep asset files outside authored world data. */
  url: string;
  scale?: number | readonly [number, number, number];
  rotationY?: number;
  offset?: readonly [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export type GlbAssetCatalog = Readonly<Record<string, GlbAssetDefinition>>;

/**
 * Loads each GLB once and returns safe scene clones for individual placements.
 * No assets are registered yet: this is the seam where a curated Kenney pack
 * can land later without teaching world builders about URLs or GLTFLoader.
 */
export class AssetRegistry<AssetId extends string = string> {
  private readonly loader: GLTFLoader;
  private readonly pending = new Map<AssetId, Promise<THREE.Group>>();
  private readonly sources = new Map<AssetId, THREE.Group>();
  private disposed = false;

  constructor(
    private readonly catalog: Readonly<Record<AssetId, GlbAssetDefinition>>,
    manager?: THREE.LoadingManager,
  ) {
    this.loader = new GLTFLoader(manager);
  }

  has(id: string): id is AssetId {
    return Object.prototype.hasOwnProperty.call(this.catalog, id);
  }

  async preload(ids: readonly AssetId[] = Object.keys(this.catalog) as AssetId[]) {
    await Promise.all(ids.map((id) => this.loadSource(id)));
  }

  async instantiate(id: AssetId): Promise<THREE.Group> {
    const definition = this.definition(id);
    const source = await this.loadSource(id);
    const instance = cloneSkeleton(source) as THREE.Group;
    instance.name = `asset:${id}`;

    const scale = definition.scale ?? 1;
    if (typeof scale === "number") instance.scale.setScalar(scale);
    else instance.scale.set(...scale);
    if (definition.rotationY !== undefined) instance.rotation.y = definition.rotationY;
    if (definition.offset) instance.position.set(...definition.offset);

    instance.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = definition.castShadow ?? true;
      child.receiveShadow = definition.receiveShadow ?? true;
    });
    return instance;
  }

  private definition(id: AssetId): GlbAssetDefinition {
    const definition = this.catalog[id];
    if (!definition) throw new Error(`Unknown GLB asset: ${id}`);
    return definition;
  }

  private loadSource(id: AssetId): Promise<THREE.Group> {
    if (this.disposed) return Promise.reject(new Error("AssetRegistry is disposed"));
    const cached = this.sources.get(id);
    if (cached) return Promise.resolve(cached);
    const inFlight = this.pending.get(id);
    if (inFlight) return inFlight;

    const promise = this.loader.loadAsync(this.definition(id).url)
      .then((gltf) => {
        if (this.disposed) {
          disposeObjectResources(gltf.scene);
          throw new Error("AssetRegistry was disposed while loading");
        }
        this.sources.set(id, gltf.scene);
        this.pending.delete(id);
        return gltf.scene;
      })
      .catch((error: unknown) => {
        this.pending.delete(id);
        throw error;
      });
    this.pending.set(id, promise);
    return promise;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const source of this.sources.values()) disposeObjectResources(source);
    this.sources.clear();
    this.pending.clear();
  }
}

function disposeObjectResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    geometries.add(child.geometry);
    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of meshMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}
