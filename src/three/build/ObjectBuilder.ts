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
  rock: { width: 0.65, depth: 0.65, height: 0.55 },
};

export interface ObjectsBuild {
  group: THREE.Group;
  ready: Promise<void>;
  assetErrors: readonly string[];
  dispose: () => void;
}

/**
 * Places curated GLBs for authored world objects. Unmapped types remain absent
 * until they have an approved asset; the authored data and collision stay the
 * source of truth throughout the migration.
 */
export function buildObjects(
  map: WorldMap,
  assets: AssetRegistry,
  bindings: Readonly<Partial<Record<ObjectType, string>>>,
): ObjectsBuild {
  const group = new THREE.Group();
  group.name = "objects";
  const assetErrors: string[] = [];
  let disposed = false;

  const loading = map.objects.flatMap((object) => {
    const assetId = bindings[object.type];
    const fit = FIT_BY_TYPE[object.type];
    if (!assetId || !fit) return [];

    return [
      assets.instantiate(assetId)
        .then((model) => {
          if (disposed) return;
          fitToTile(model, object, fit);
          model.name = `object:${object.id}`;
          model.userData.objectId = object.id;
          group.add(model);
        })
        .catch((error: unknown) => {
          if (disposed) return;
          assetErrors.push(`${object.id}: ${error instanceof Error ? error.message : String(error)}`);
        }),
    ];
  });

  return {
    group,
    ready: Promise.all(loading).then(() => undefined),
    assetErrors,
    dispose: () => {
      disposed = true;
    },
  };
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
