import * as THREE from "three";
import type { Building, CityMap, Prop } from "@/world/schema";
import { KERB_HEIGHT } from "@/world/schema";
import { CityMaterials, type MaterialName } from "../materials/CityMaterials";
import { buildRoadMarkings } from "./RoadMarkings";

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

const WALL_THICKNESS = 0.72;
const DOOR_WIDTH = 4.8;
const DOOR_HEIGHT = 3.35;
const SIGN_HEIGHT = 1.65;

type EntranceSide = "north" | "south" | "east" | "west";

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
  /** Materials created here rather than by the shared library. */
  const ownedMaterials: THREE.Material[] = [];
  const ownedTextures: THREE.Texture[] = [];
  const disposers: Array<() => void> = [];

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

  // --- Lane markings and crossings ----------------------------------------
  const markings = buildRoadMarkings(map);
  if (markings) {
    group.add(markings.mesh);
    disposers.push(markings.dispose);
  }

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
  const floorParts: THREE.BufferGeometry[] = [];
  const entranceFrameParts: THREE.BufferGeometry[] = [];
  const entranceDoorParts: THREE.BufferGeometry[] = [];
  const entranceGlowParts: THREE.BufferGeometry[] = [];
  const signPlaqueParts: THREE.BufferGeometry[] = [];

  for (const b of map.buildings) {
    const name = FACADE_MATERIAL[b.style];
    // Repeats are driven by floor height, so window rows land on storeys.
    const material = materials.get(name, Math.max(b.w, b.d), b.height, b.color);
    const key = `${name}:${b.color}`;
    let bucket = byFacade.get(key);
    if (!bucket) {
      bucket = { parts: [], material };
      byFacade.set(key, bucket);
    }

    // Four thin walls make a genuinely hollow building. The entrance-facing
    // wall is split around a human-scale opening, so the rendered doorway and
    // collision agree and the player can actually walk through it.
    const shell = buildBuildingShell(b);
    bucket.parts.push(...shell.walls);
    colliders.push(...shell.colliders);
    floorParts.push(shell.floor);

    buildEntrance(
      b,
      group,
      geometries,
      ownedMaterials,
      ownedTextures,
      entranceFrameParts,
      entranceDoorParts,
      entranceGlowParts,
      signPlaqueParts,
    );

    // A parapet slab reads as a roof edge and hides the flat top. It overlaps
    // down into the walls rather than sitting exactly on them: a shared plane
    // between two solids is a z-fight waiting for the right viewing angle.
    roofParts.push(
      slab(b.x - 0.3, b.z - 0.3, b.w + 0.6, b.d + 0.6, KERB_HEIGHT + b.height + 0.5, 0.75),
    );

  }

  let facadeIndex = 0;
  for (const [, bucket] of byFacade) {
    merge(bucket.parts, bucket.material, `facades-${facadeIndex++}`);
  }
  merge(roofParts, materials.get("roof", 40, 40), "roofs");
  merge(floorParts, materials.get("plaza", 40, 40), "building-floors");
  merge(entranceFrameParts, materials.get("metal", 4, 4, "#252b31"), "entrance-frames");
  merge(signPlaqueParts, materials.get("metal", 8, 2, "#20262d"), "building-sign-plaques");

  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f9db8,
    roughness: 0.18,
    metalness: 0.22,
    transparent: true,
    opacity: 0.72,
  });
  ownedMaterials.push(doorMaterial);
  merge(entranceDoorParts, doorMaterial, "open-glass-doors");

  const entranceGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd58a,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  ownedMaterials.push(entranceGlowMaterial);
  merge(entranceGlowParts, entranceGlowMaterial, "entrance-glow");

  // --- Props ---------------------------------------------------------------
  buildProps(map.props, materials, group, geometries, colliders, ownedMaterials);

  return {
    group,
    colliders,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      geometries.length = 0;
      ownedMaterials.forEach((m) => m.dispose());
      ownedMaterials.length = 0;
      ownedTextures.forEach((t) => t.dispose());
      ownedTextures.length = 0;
      disposers.forEach((d) => d());
      disposers.length = 0;
    },
  };
}

interface BuildingShell {
  walls: THREE.BufferGeometry[];
  colliders: THREE.Box3[];
  floor: THREE.BufferGeometry;
}

interface BoxPart {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

/** A hollow four-wall shell with the entrance cut into the correct façade. */
function buildBuildingShell(building: Building): BuildingShell {
  const walls: THREE.BufferGeometry[] = [];
  const colliders: THREE.Box3[] = [];
  const side = building.entrance ? entranceSide(building) : null;
  const top = KERB_HEIGHT + building.height;

  const add = (part: BoxPart) => {
    if (part.w <= 0 || part.h <= 0 || part.d <= 0) return;
    walls.push(boxPart(part));
    colliders.push(
      new THREE.Box3(
        new THREE.Vector3(part.x, part.y, part.z),
        new THREE.Vector3(part.x + part.w, part.y + part.h, part.z + part.d),
      ),
    );
  };

  const north = { x: building.x, y: KERB_HEIGHT, z: building.z, w: building.w, h: building.height, d: WALL_THICKNESS };
  const south = {
    x: building.x,
    y: KERB_HEIGHT,
    z: building.z + building.d - WALL_THICKNESS,
    w: building.w,
    h: building.height,
    d: WALL_THICKNESS,
  };
  const west = { x: building.x, y: KERB_HEIGHT, z: building.z, w: WALL_THICKNESS, h: building.height, d: building.d };
  const east = {
    x: building.x + building.w - WALL_THICKNESS,
    y: KERB_HEIGHT,
    z: building.z,
    w: WALL_THICKNESS,
    h: building.height,
    d: building.d,
  };

  if (!side || !building.entrance) {
    [north, south, west, east].forEach(add);
  } else if (side === "north" || side === "south") {
    const wall = side === "north" ? north : south;
    const doorMin = building.entrance.x - DOOR_WIDTH / 2;
    const doorMax = building.entrance.x + DOOR_WIDTH / 2;
    add({ ...wall, w: doorMin - building.x });
    add({ ...wall, x: doorMax, w: building.x + building.w - doorMax });
    add({
      ...wall,
      x: doorMin,
      y: KERB_HEIGHT + DOOR_HEIGHT,
      w: DOOR_WIDTH,
      h: top - (KERB_HEIGHT + DOOR_HEIGHT),
    });
    add(side === "north" ? south : north);
    add(west);
    add(east);
  } else {
    const wall = side === "west" ? west : east;
    const doorMin = building.entrance.z - DOOR_WIDTH / 2;
    const doorMax = building.entrance.z + DOOR_WIDTH / 2;
    add({ ...wall, d: doorMin - building.z });
    add({ ...wall, z: doorMax, d: building.z + building.d - doorMax });
    add({
      ...wall,
      z: doorMin,
      y: KERB_HEIGHT + DOOR_HEIGHT,
      d: DOOR_WIDTH,
      h: top - (KERB_HEIGHT + DOOR_HEIGHT),
    });
    add(side === "west" ? east : west);
    add(north);
    add(south);
  }

  // A separate interior floor makes the open doorway lead somewhere visible;
  // venue-specific furnishing can be added later without changing the shell.
  const floor = new THREE.BoxGeometry(
    building.w - WALL_THICKNESS * 2,
    0.04,
    building.d - WALL_THICKNESS * 2,
  );
  floor.translate(
    building.x + building.w / 2,
    KERB_HEIGHT - 0.01,
    building.z + building.d / 2,
  );

  return { walls, colliders, floor };
}

/** Adds the shared entrance architecture plus a data-driven name sign. */
function buildEntrance(
  building: Building,
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  ownedMaterials: THREE.Material[],
  ownedTextures: THREE.Texture[],
  frameParts: THREE.BufferGeometry[],
  doorParts: THREE.BufferGeometry[],
  glowParts: THREE.BufferGeometry[],
  plaqueParts: THREE.BufferGeometry[],
) {
  if (!building.entrance) return;

  const side = entranceSide(building);
  const yaw = entranceYaw(side);
  const origin = new THREE.Vector3(building.entrance.x, 0, building.entrance.z);
  const frameWidth = 0.3;
  const frameDepth = 0.32;
  const doorLeafWidth = DOOR_WIDTH * 0.42;

  // The glass leaves are shown slid open against the façade. That leaves the
  // full doorway clear without needing an interaction system just to enter.
  frameParts.push(
    orientedBox(frameWidth, DOOR_HEIGHT, frameDepth, -DOOR_WIDTH / 2 - frameWidth / 2, KERB_HEIGHT + DOOR_HEIGHT / 2, 0.12, origin, yaw),
    orientedBox(frameWidth, DOOR_HEIGHT, frameDepth, DOOR_WIDTH / 2 + frameWidth / 2, KERB_HEIGHT + DOOR_HEIGHT / 2, 0.12, origin, yaw),
    orientedBox(DOOR_WIDTH + frameWidth * 2, frameWidth, frameDepth, 0, KERB_HEIGHT + DOOR_HEIGHT + frameWidth / 2, 0.12, origin, yaw),
    orientedBox(DOOR_WIDTH + 1.5, 0.2, 1.55, 0, KERB_HEIGHT + DOOR_HEIGHT + 0.58, 0.65, origin, yaw),
  );

  doorParts.push(
    orientedBox(doorLeafWidth, DOOR_HEIGHT - 0.32, 0.08, -DOOR_WIDTH / 2 - doorLeafWidth / 2 + 0.16, KERB_HEIGHT + (DOOR_HEIGHT - 0.32) / 2, 0.2, origin, yaw),
    orientedBox(doorLeafWidth, DOOR_HEIGHT - 0.32, 0.08, DOOR_WIDTH / 2 + doorLeafWidth / 2 - 0.16, KERB_HEIGHT + (DOOR_HEIGHT - 0.32) / 2, 0.2, origin, yaw),
  );

  const glow = new THREE.PlaneGeometry(DOOR_WIDTH - 0.45, DOOR_HEIGHT - 0.35);
  glow.translate(0, KERB_HEIGHT + (DOOR_HEIGHT - 0.35) / 2, -0.42);
  transformFromEntrance(glow, origin, yaw);
  glowParts.push(glow);

  const signWidth = THREE.MathUtils.clamp(building.name.length * 0.72 + 3.2, 9, 17);
  const signY = KERB_HEIGHT + DOOR_HEIGHT + 1.82;
  plaqueParts.push(orientedBox(signWidth, SIGN_HEIGHT, 0.22, 0, signY, 0.18, origin, yaw));

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#f5f7f8";
  context.shadowColor = "rgba(0,0,0,0.65)";
  context.shadowBlur = 10;
  const label = building.name.toLocaleUpperCase();
  let fontSize = 112;
  do {
    context.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
    fontSize -= 4;
  } while (context.measureText(label).width > 900 && fontSize > 52);
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  ownedTextures.push(texture);

  const labelMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  ownedMaterials.push(labelMaterial);

  const labelGeometry = new THREE.PlaneGeometry(signWidth - 0.55, SIGN_HEIGHT - 0.3);
  labelGeometry.translate(0, signY, 0.305);
  transformFromEntrance(labelGeometry, origin, yaw);
  geometries.push(labelGeometry);

  const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
  labelMesh.name = `building-sign-${building.id}`;
  labelMesh.renderOrder = 2;
  group.add(labelMesh);
}

function entranceSide(building: Building): EntranceSide {
  const entrance = building.entrance!;
  const distances: Array<[EntranceSide, number]> = [
    ["north", Math.abs(entrance.z - building.z)],
    ["south", Math.abs(entrance.z - (building.z + building.d))],
    ["west", Math.abs(entrance.x - building.x)],
    ["east", Math.abs(entrance.x - (building.x + building.w))],
  ];
  distances.sort((a, b) => a[1] - b[1]);
  return distances[0][0];
}

/** Local +z always points out of the entrance. */
function entranceYaw(side: EntranceSide): number {
  if (side === "north") return Math.PI;
  if (side === "east") return Math.PI / 2;
  if (side === "west") return -Math.PI / 2;
  return 0;
}

function boxPart(part: BoxPart): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(part.w, part.h, part.d);
  geometry.translate(part.x + part.w / 2, part.y + part.h / 2, part.z + part.d / 2);
  return geometry;
}

function orientedBox(
  w: number,
  h: number,
  d: number,
  localX: number,
  localY: number,
  localZ: number,
  origin: THREE.Vector3,
  yaw: number,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(localX, localY, localZ);
  transformFromEntrance(geometry, origin, yaw);
  return geometry;
}

function transformFromEntrance(
  geometry: THREE.BufferGeometry,
  origin: THREE.Vector3,
  yaw: number,
) {
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
  geometry.translate(origin.x, origin.y, origin.z);
}

/** Instanced street furniture: one geometry, one draw call, many placements. */
function buildProps(
  props: Prop[],
  materials: CityMaterials,
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  colliders: THREE.Box3[],
  ownedMaterials: THREE.Material[],
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
    vary?: (index: number) => { scale: number; color?: THREE.Color },
  ) => {
    geometries.push(geo);
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    mesh.name = name;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const scale = new THREE.Vector3();
    list.forEach((p, i) => {
      const v = vary?.(i);
      q.setFromAxisAngle(up, p.rotation);
      scale.setScalar(v?.scale ?? 1);
      m.compose(new THREE.Vector3(p.x, KERB_HEIGHT, p.z), q, scale);
      mesh.setMatrixAt(i, m);
      if (v?.color) mesh.setColorAt(i, v.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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

  const fountains = byType.get("fountain");
  if (fountains) {
    const basin = new THREE.CylinderGeometry(2.2, 2.4, 0.38, 24);
    basin.translate(0, 0.19, 0);
    const rim = new THREE.TorusGeometry(2.04, 0.17, 8, 24);
    rim.rotateX(Math.PI / 2);
    rim.translate(0, 0.4, 0);
    const pedestal = new THREE.CylinderGeometry(0.34, 0.52, 1.05, 16);
    pedestal.translate(0, 0.9, 0);
    const bowl = new THREE.CylinderGeometry(0.82, 0.56, 0.26, 16);
    bowl.translate(0, 1.52, 0);
    const spout = new THREE.CylinderGeometry(0.1, 0.14, 0.65, 12);
    spout.translate(0, 1.96, 0);
    place(
      mergeGeometries([basin, rim, pedestal, bowl, spout]),
      materials.get("plaza", 4, 4, "#b8c0c7"),
      fountains,
      "fountain-stone",
    );

    const water = new THREE.CylinderGeometry(1.92, 1.92, 0.05, 24);
    water.translate(0, 0.4, 0);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x4da3d9,
      roughness: 0.2,
      metalness: 0,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    ownedMaterials.push(waterMaterial);
    place(water, waterMaterial, fountains, "fountain-water");

    for (const fountain of fountains) {
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(fountain.x - 2.4, 0, fountain.z - 2.4),
          new THREE.Vector3(fountain.x + 2.4, 2.3, fountain.z + 2.4),
        ),
      );
    }
  }

  const trees = byType.get("tree");
  if (trees) {
    // Deterministic per-tree variation, so the same city always grows the same
    // trees but no two neighbours look stamped from one mould.
    const wobble = (i: number, salt: number) => {
      const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };

    const trunk = new THREE.CylinderGeometry(0.16, 0.24, 3.4, 7);
    trunk.translate(0, 1.7, 0);
    place(trunk, materials.get("bark", 1.5, 3.4), trees, "trunks", (i) => ({
      scale: 0.85 + wobble(i, 1) * 0.4,
    }));

    // Canopy: three overlapping spheres rather than crossed billboards. The
    // supplied foliage image turned out to be a near-opaque white sheet — its
    // alpha channel averages 245/255 — so alpha testing had nothing to cut and
    // every tree rendered as a white rectangle. Geometry has no such doubt,
    // reads correctly from every angle, and instances just as cheaply.
    const blobs = [
      { r: 1.75, x: 0, y: 4.5, z: 0 },
      { r: 1.25, x: 0.95, y: 3.75, z: 0.35 },
      { r: 1.15, x: -0.8, y: 3.95, z: -0.5 },
      { r: 1.05, x: 0.15, y: 5.55, z: -0.35 },
    ].map((b) => {
      const geo = new THREE.IcosahedronGeometry(b.r, 1);
      geo.scale(1, 0.88, 1); // slightly flattened reads more like a canopy
      geo.translate(b.x, b.y, b.z);
      return geo;
    });

    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, // tinted per instance below
      roughness: 0.92,
      metalness: 0,
      flatShading: true,
      // The scene's image-based lighting is bright and desaturating; foliage
      // needs far less of it than glass and metal do, or every canopy washes
      // out to pale mint.
      envMapIntensity: 0.25,
    });
    ownedMaterials.push(canopyMaterial);

    const green = new THREE.Color();
    place(mergeGeometries(blobs), canopyMaterial, trees, "canopies", (i) => ({
      scale: 0.85 + wobble(i, 2) * 0.45,
      // A spread of greens keeps a row of street trees from reading as clones.
      color: green.setHSL(0.25 + wobble(i, 3) * 0.06, 0.52, 0.19 + wobble(i, 4) * 0.09).clone(),
    }));

    for (const p of trees) {
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(p.x - 0.3, 0, p.z - 0.3),
          new THREE.Vector3(p.x + 0.3, 3.4, p.z + 0.3),
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
