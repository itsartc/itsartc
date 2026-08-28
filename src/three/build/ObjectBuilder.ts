import * as THREE from "three";
import type { ObjectType, WorldMap, WorldObject } from "@/world/schema";
import { tileCenterToThree } from "../coords";
import type { AssetRegistry } from "../assets/AssetRegistry";

interface ObjectFit {
  width: number;
  depth: number;
  height: number;
}

const FIT_BY_TYPE: Partial<Record<ObjectType, ObjectFit>> = {
  tree: { width: 0.9, depth: 0.9, height: 2.6 },
  blossom: { width: 1, depth: 1, height: 2.5 },
  rock: { width: 0.65, depth: 0.65, height: 0.55 },
  flowers: { width: 0.45, depth: 0.45, height: 0.3 },
  sign: { width: 0.8, depth: 0.6, height: 1.15 },
  table: { width: 0.9, depth: 0.9, height: 1.45 },
};

export interface ObjectsBuild {
  group: THREE.Group;
  ready: Promise<void>;
  assetErrors: readonly string[];
  dispose: () => void;
}

/**
 * Places curated GLBs for authored world objects. A small set of readable
 * procedural fallbacks covers objects that do not have an approved asset yet;
 * authored data and collision stay the source of truth throughout migration.
 */
export function buildObjects(
  map: WorldMap,
  assets: AssetRegistry,
  bindings: Readonly<Partial<Record<ObjectType, string>>>,
): ObjectsBuild {
  const group = new THREE.Group();
  group.name = "objects";
  const assetErrors: string[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let disposed = false;

  const loading: Promise<void>[] = [];
  for (const object of map.objects) {
    const assetId = bindings[object.type];
    const fit = FIT_BY_TYPE[object.type];
    if (assetId && fit) {
      loading.push(
        assets
          .instantiate(assetId)
          .then((model) => {
            if (disposed) return;
            fitToTile(model, object, fit);
            model.name = `object:${object.id}`;
            model.userData.objectId = object.id;
            group.add(model);
          })
          .catch((error: unknown) => {
            if (disposed) return;
            assetErrors.push(
              `${object.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }),
      );
      continue;
    }

    const procedural = buildProceduralObject(object, geometries, materials);
    if (procedural) group.add(procedural);
  }

  return {
    group,
    ready: Promise.all(loading).then(() => undefined),
    assetErrors,
    dispose: () => {
      disposed = true;
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}

/** Minimal readable fallbacks for objects whose curated GLB has not landed yet. */
function buildProceduralObject(
  object: WorldObject,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): THREE.Group | null {
  const result = new THREE.Group();
  result.name = `object:${object.id}`;
  result.userData.objectId = object.id;
  const target = tileCenterToThree(object.x, object.y);
  result.position.copy(target);

  const material = (color: number, emissive = 0) => {
    const value = new THREE.MeshStandardMaterial({
      color,
      emissive,
      roughness: 0.82,
      metalness: 0,
    });
    materials.push(value);
    return value;
  };
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    geometries.push(geometry);
    const value = new THREE.Mesh(geometry, mat);
    value.name = name;
    value.castShadow = true;
    value.receiveShadow = true;
    result.add(value);
    return value;
  };

  if (object.type === "fountain") {
    // The authored fountain occupies 2x2 tiles from its top-left coordinate.
    result.position.copy(tileCenterToThree(object.x + 0.5, object.y + 0.5));
    const stone = material(0x7189a5);
    const water = material(0x45aee8, 0x103b55);
    const basin = mesh(new THREE.CylinderGeometry(0.92, 1, 0.22, 24), stone, "fountain-basin");
    basin.position.y = 0.11;
    const pool = mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.05, 24), water, "fountain-water");
    pool.position.y = 0.24;
    const column = mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.85, 16), stone, "fountain-column");
    column.position.y = 0.64;
    const crown = mesh(new THREE.SphereGeometry(0.24, 16, 10), water, "fountain-crown");
    crown.position.y = 1.12;
    return result;
  }

  if (object.type === "lamp") {
    const pole = mesh(
      new THREE.CylinderGeometry(0.055, 0.075, 1.35, 10),
      material(0x313743),
      "lamp-pole",
    );
    pole.position.y = 0.675;
    const bulb = mesh(
      new THREE.SphereGeometry(0.16, 12, 8),
      material(0xffd785, 0x6b4814),
      "lamp-bulb",
    );
    bulb.position.y = 1.43;
    return result;
  }

  if (object.type === "billboard") {
    const frame = material(0x3b332e);
    const post = mesh(new THREE.BoxGeometry(0.1, 1.15, 0.1), frame, "billboard-post");
    post.position.y = 0.575;
    const board = mesh(
      new THREE.BoxGeometry(1.35, 0.72, 0.12),
      material(0xe8c66d, 0x2b210c),
      "billboard-board",
    );
    board.position.y = 1.25;
    return result;
  }

  if (object.type === "bench") {
    const wood = material(0x875a35);
    const seat = mesh(new THREE.BoxGeometry(0.9, 0.12, 0.32), wood, "bench-seat");
    seat.position.y = 0.36;
    const back = mesh(new THREE.BoxGeometry(0.9, 0.42, 0.1), wood, "bench-back");
    back.position.set(0, 0.58, 0.16);
    for (const x of [-0.33, 0.33]) {
      const leg = mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), material(0x3c4148), "bench-leg");
      leg.position.set(x, 0.17, 0);
    }
    return result;
  }

  if (object.type === "planter" || object.type === "bush") {
    if (object.type === "planter") {
      const planter = mesh(
        new THREE.BoxGeometry(0.72, 0.36, 0.72),
        material(0x9b6847),
        "planter-box",
      );
      planter.position.y = 0.18;
    }
    const foliage = mesh(
      new THREE.SphereGeometry(object.type === "bush" ? 0.43 : 0.38, 12, 8),
      material(0x4f8c47),
      "planter-foliage",
    );
    foliage.scale.y = 0.75;
    foliage.position.y = object.type === "bush" ? 0.38 : 0.62;
    return result;
  }

  return null;
}

function fitToTile(model: THREE.Group, object: WorldObject, fit: ObjectFit) {
  model.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(model);
  const size = initialBounds.getSize(new THREE.Vector3());
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
    throw new Error("GLB has no measurable geometry");
  }

  const scale = Math.min(fit.width / size.x, fit.depth / size.z, fit.height / size.y);
  model.scale.multiplyScalar(scale);
  model.rotation.y = stableRotation(object.id);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const centre = bounds.getCenter(new THREE.Vector3());
  const target = tileCenterToThree(object.x, object.y);
  model.position.x += target.x - centre.x;
  model.position.y -= bounds.min.y;
  model.position.z += target.z - centre.z;
  model.updateMatrixWorld(true);
}

/** Stable visual variety without putting renderer state into authored world data. */
function stableRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((hash >>> 0) % 4) * (Math.PI / 2);
}
