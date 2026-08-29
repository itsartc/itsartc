import * as THREE from "three";
import type { Building, CityMap, Prop } from "@/world/schema";
import { KERB_HEIGHT } from "@/world/schema";
import { CityMaterials, type MaterialName } from "../materials/CityMaterials";

/**
 * Turns a CityMap into geometry.
 *
 * Two techniques carry the performance budget:
 *
 *  - **Merging.** All ground surfaces of a kind become one mesh, so a city of
 *    thirty blocks costs one draw call for roads rather than thirty.
 *  - **Instancing.** Street furniture is one geometry drawn many times through
 *    an InstancedMesh, so two thousand lamp posts cost one draw call.
 *
 * Both matter more here than in the imported model, because a generated city
 * has far more separate objects.
 */

const FACADE_MATERIAL: Record<Building["style"], MaterialName> = {
  glass: "facadeGlass",
  tiles: "facadeTiles",
  plaster: "facadePlaster",
  concrete: "facadeConcrete",
};

export interface CityBuild {
  group: THREE.Group;
  /** Axis-aligned boxes the player collides with, in world metres. */
  colliders: THREE.Box3[];
  dispose: () => void;
}

export function buildCity(map: CityMap, materials: CityMaterials): CityBuild {
  const group = new THREE.Group();
  group.name = "city";
  const colliders: THREE.Box3[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  const slab = (
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    thickness: number,
  ): THREE.BufferGeometry => {
    const geo = new THREE.BoxGeometry(w, thickness, d);
    geo.translate(x + w / 2, y - thickness / 2, z + d / 2);
    return geo;
  };

  /** Merges a list of geometries into one mesh under a shared material. */
  const merge = (parts: THREE.BufferGeometry[], material: THREE.Material, name: string) => {
    if (parts.length === 0) return;
    const merged = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    geometries.push(merged);
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    group.add(mesh);
  };

  // --- Roadway -------------------------------------------------------------
  merge(
    map.roads.map((r) => slab(r.x, r.z, r.w, r.d, 0, 0.4)),
    materials.get("road", map.size.w, map.size.d),
    "roads",
  );

  // --- Pavement ------------------------------------------------------------
  merge(
    map.sidewalks.map((s) => slab(s.x, s.z, s.w, s.d, KERB_HEIGHT, 0.5)),
    materials.get("sidewalk", map.size.w, map.size.d),
    "sidewalks",
  );

  // --- Plazas and parks ----------------------------------------------------
  const paving = map.plazas.filter((p) => p.surface === "paving");
  const green = map.plazas.filter((p) => p.surface === "grass");
  merge(
    paving.map((p) => slab(p.x, p.z, p.w, p.d, KERB_HEIGHT + 0.01, 0.4)),
    materials.get("plaza", map.size.w, map.size.d),
    "plazas",
  );
  merge(
    green.map((p) => slab(p.x, p.z, p.w, p.d, KERB_HEIGHT + 0.01, 0.4)),
    materials.get("grass", map.size.w, map.size.d),
    "parks",
  );

  // --- Buildings -----------------------------------------------------------
  // Grouped by façade material so each style is one draw call, not one per
  // building. Tint varies per building, so the key includes the colour.
  const byFacade = new Map<string, { parts: THREE.BufferGeometry[]; material: THREE.Material }>();
  const roofParts: THREE.BufferGeometry[] = [];

  for (const b of map.buildings) {
    const wallGeo = new THREE.BoxGeometry(b.w, b.height, b.d);
    wallGeo.translate(b.x + b.w / 2, KERB_HEIGHT + b.height / 2, b.z + b.d / 2);

    const name = FACADE_MATERIAL[b.style];
    // Repeats are driven by floor height, so window rows land on storeys.
    const material = materials.get(name, Math.max(b.w, b.d), b.height, b.color);
    const key = `${name}:${b.color}`;
    let bucket = byFacade.get(key);
    if (!bucket) {
      bucket = { parts: [], material };
      byFacade.set(key, bucket);
    }
    bucket.parts.push(wallGeo);

    // A parapet slab reads as a roof edge and hides the flat top.
    roofParts.push(slab(b.x - 0.3, b.z - 0.3, b.w + 0.6, b.d + 0.6, KERB_HEIGHT + b.height + 0.5, 0.5));

    colliders.push(
      new THREE.Box3(
        new THREE.Vector3(b.x, 0, b.z),
        new THREE.Vector3(b.x + b.w, KERB_HEIGHT + b.height, b.z + b.d),
      ),
    );
  }

  let facadeIndex = 0;
  for (const [, bucket] of byFacade) {
    merge(bucket.parts, bucket.material, `facades-${facadeIndex++}`);
  }
  merge(roofParts, materials.get("roof", 40, 40), "roofs");

  // --- Props ---------------------------------------------------------------
  buildProps(map.props, materials, group, geometries, colliders);

  return {
    group,
    colliders,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      geometries.length = 0;
    },
  };
}

/** Instanced street furniture: one geometry, one draw call, many placements. */
function buildProps(
  props: Prop[],
  materials: CityMaterials,
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  colliders: THREE.Box3[],
) {
  const byType = new Map<Prop["type"], Prop[]>();
  for (const p of props) {
    const list = byType.get(p.type);
    if (list) list.push(p);
    else byType.set(p.type, [p]);
  }

  const place = (
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    list: Prop[],
    name: string,
  ) => {
    geometries.push(geo);
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    mesh.name = name;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    list.forEach((p, i) => {
      q.setFromAxisAngle(up, p.rotation);
      m.compose(new THREE.Vector3(p.x, KERB_HEIGHT, p.z), q, one);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  };

  const metal = materials.get("metal", 2, 2, "#3a3f45");

  const lamps = byType.get("streetlight");
  if (lamps) {
    const post = new THREE.CylinderGeometry(0.09, 0.12, 7, 8);
    post.translate(0, 3.5, 0);
    const arm = new THREE.BoxGeometry(1.6, 0.12, 0.12);
    arm.translate(0.8, 6.9, 0);
    place(mergeGeometries([post, arm]), metal, lamps, "streetlights");
    for (const p of lamps) {
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(p.x - 0.2, 0, p.z - 0.2),
          new THREE.Vector3(p.x + 0.2, 7, p.z + 0.2),
        ),
      );
    }
  }

  const bins = byType.get("bin");
  if (bins) {
    const geo = new THREE.CylinderGeometry(0.35, 0.3, 1, 10);
    geo.translate(0, 0.5, 0);
    place(geo, materials.get("metal", 1, 1, "#4a5a48"), bins, "bins");
  }

  const benches = byType.get("bench");
  if (benches) {
    const seat = new THREE.BoxGeometry(1.9, 0.12, 0.55);
    seat.translate(0, 0.48, 0);
    const back = new THREE.BoxGeometry(1.9, 0.5, 0.1);
    back.translate(0, 0.75, -0.24);
    place(mergeGeometries([seat, back]), materials.get("metal", 2, 2, "#8a7b62"), benches, "benches");
  }

  const planters = byType.get("planter");
  if (planters) {
    const geo = new THREE.BoxGeometry(1.4, 0.7, 1.4);
    geo.translate(0, 0.35, 0);
    place(geo, materials.get("plaza", 2, 2, "#b8ae9c"), planters, "planters");
  }

  const trees = byType.get("tree");
  if (trees) {
    const trunk = new THREE.CylinderGeometry(0.18, 0.26, 4.2, 7);
    trunk.translate(0, 2.1, 0);
    place(trunk, materials.get("bark", 2, 4), trees, "trunks");

    // Crossed billboards: the classic cheap tree that still reads as foliage
    // in the round, and costs four triangles.
    const leafA = new THREE.PlaneGeometry(4.6, 4.6);
    leafA.translate(0, 5.2, 0);
    const leafB = leafA.clone();
    leafB.rotateY(Math.PI / 2);
    place(mergeGeometries([leafA, leafB]), materials.get("foliage", 1, 1), trees, "foliage");

    for (const p of trees) {
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(p.x - 0.3, 0, p.z - 0.3),
          new THREE.Vector3(p.x + 0.3, 4, p.z + 0.3),
        ),
      );
    }
  }
}

/**
 * Minimal geometry merge.
 *
 * three ships BufferGeometryUtils for this, but it pulls in a large module for
 * one function and assumes matching attribute sets. Everything merged here is
 * generated by this file with identical attributes, so a direct concatenation
 * is smaller and clearer.
 */
function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 1) return parts[0].clone();

  const attributes = ["position", "normal", "uv"] as const;
  const merged = new THREE.BufferGeometry();
  let indexCount = 0;
  let vertexCount = 0;

  for (const part of parts) {
    vertexCount += part.attributes.position.count;
    indexCount += part.index ? part.index.count : part.attributes.position.count;
  }

  for (const name of attributes) {
    const first = parts[0].attributes[name];
    if (!first) continue;
    const itemSize = first.itemSize;
    const array = new Float32Array(vertexCount * itemSize);
    let offset = 0;
    for (const part of parts) {
      const attr = part.attributes[name];
      array.set(attr.array as Float32Array, offset);
      offset += attr.count * itemSize;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
  }

  const indices = new Uint32Array(indexCount);
  let indexOffset = 0;
  let vertexOffset = 0;
  for (const part of parts) {
    const count = part.attributes.position.count;
    if (part.index) {
      for (let i = 0; i < part.index.count; i++) {
        indices[indexOffset++] = part.index.getX(i) + vertexOffset;
      }
    } else {
      for (let i = 0; i < count; i++) indices[indexOffset++] = i + vertexOffset;
    }
    vertexOffset += count;
  }
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}
