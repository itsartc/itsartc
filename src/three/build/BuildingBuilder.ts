import * as THREE from "three";
import type { WorldMap } from "@/world/schema";
import { tileCornerToThree, tileCenterToThree } from "../coords";
import type { AssetRegistry } from "../assets/AssetRegistry";

/**
 * Builds each authored building as a simple extruded box on its exact tile
 * footprint, plus a small marker on the entrance tile.
 *
 * Every building starts with a footprint-correct placeholder. A curated GLB
 * may replace that visual asynchronously, but failure leaves the placeholder
 * intact and never changes authored coordinates or collision.
 *
 * Height is expressed in scene units where 1 unit = 1 tile. Buildings are made
 * tall enough that their façades are clearly visible from the elevated camera,
 * which is the commercial requirement: sponsored buildings, logos and branded
 * entrances must read from the default gameplay angle without the player
 * rotating anything.
 */

/** Building height in scene units (tiles). Tall enough to show a façade. */
const BUILDING_HEIGHT = 2.4;

/** How far the entrance marker sits above ground, in scene units. */
const ENTRANCE_MARKER_Y = 0.02;

/** Breathing room between an asset and its authored collision footprint. */
const MODEL_INSET = 0.18;

export interface BuildingsBuild {
  group: THREE.Group;
  ready: Promise<void>;
  assetErrors: readonly string[];
  dispose: () => void;
}

export function buildBuildings(
  map: WorldMap,
  assets?: AssetRegistry,
  bindings: Readonly<Partial<Record<string, string>>> = {},
): BuildingsBuild {
  const group = new THREE.Group();
  group.name = "buildings";

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const assetErrors: string[] = [];
  const loading: Promise<void>[] = [];
  let disposed = false;

  const hex = (s: string) => new THREE.Color(s);

  // Shared entrance-marker resources.
  const entranceGeo = new THREE.PlaneGeometry(0.9, 0.9);
  entranceGeo.rotateX(-Math.PI / 2);
  geometries.push(entranceGeo);
  const entranceMat = new THREE.MeshStandardMaterial({
    color: 0xffd98a,
    roughness: 0.6,
    emissive: 0x3a2a10,
  });
  materials.push(entranceMat);

  for (const b of map.buildings) {
    const corner = tileCornerToThree(b.x, b.y);
    const placeholder = new THREE.Group();
    placeholder.name = `placeholder:${b.id}`;
    group.add(placeholder);

    // Walls: a box sitting on the ground, covering the exact tile footprint.
    const geo = new THREE.BoxGeometry(b.w, BUILDING_HEIGHT, b.h);
    geo.translate(
      corner.x + b.w / 2,
      BUILDING_HEIGHT / 2,
      corner.z + b.h / 2,
    );
    geometries.push(geo);

    const mat = new THREE.MeshStandardMaterial({
      color: hex(b.wallColor),
      roughness: 0.85,
      metalness: 0,
    });
    materials.push(mat);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `building:${b.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.buildingId = b.id;
    placeholder.add(mesh);

    // Roof: a thin slab in the roof colour, so each building reads as a
    // distinct volume from above and the district accent is legible.
    const roofGeo = new THREE.BoxGeometry(b.w + 0.12, 0.18, b.h + 0.12);
    roofGeo.translate(
      corner.x + b.w / 2,
      BUILDING_HEIGHT + 0.09,
      corner.z + b.h / 2,
    );
    geometries.push(roofGeo);
    const roofMat = new THREE.MeshStandardMaterial({
      color: hex(b.roofColor),
      roughness: 0.8,
      metalness: 0,
    });
    materials.push(roofMat);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.castShadow = true;
    roof.name = `roof:${b.id}`;
    placeholder.add(roof);

    // Entrance marker: a lit pad on the door tile, proving entrance
    // coordinates survive the mapping.
    if (b.entrance) {
      const e = tileCenterToThree(b.entrance.x, b.entrance.y, ENTRANCE_MARKER_Y);
      const pad = new THREE.Mesh(entranceGeo, entranceMat);
      pad.position.copy(e);
      pad.name = `entrance:${b.id}`;
      group.add(pad);
    }

    const assetId = bindings[b.id];
    if (assets && assetId) {
      loading.push(
        assets.instantiate(assetId)
          .then((model) => {
            if (disposed) return;
            fitToFootprint(model, corner, b.w, b.h);
            model.userData.buildingId = b.id;
            group.add(model);
            placeholder.visible = false;
          })
          .catch((error: unknown) => {
            if (disposed) return;
            assetErrors.push(`${b.id}: ${error instanceof Error ? error.message : String(error)}`);
          }),
      );
    }
  }

  return {
    group,
    ready: Promise.all(loading).then(() => undefined),
    assetErrors,
    dispose: () => {
      disposed = true;
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

/** Uniformly fit a model to the XZ footprint and place its lowest point on the ground. */
function fitToFootprint(
  model: THREE.Group,
  corner: THREE.Vector3,
  width: number,
  depth: number,
) {
  model.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(model);
  const size = initialBounds.getSize(new THREE.Vector3());
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
    throw new Error("GLB has no measurable geometry");
  }

  const scale = Math.min(
    (width - MODEL_INSET * 2) / size.x,
    (depth - MODEL_INSET * 2) / size.z,
  );
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const centre = bounds.getCenter(new THREE.Vector3());
  model.position.x += corner.x + width / 2 - centre.x;
  model.position.y -= bounds.min.y;
  model.position.z += corner.z + depth / 2 - centre.z;
  model.updateMatrixWorld(true);
}
