import * as THREE from "three";
import type { CityMap, Road } from "@/world/schema";

/**
 * Paints lane markings and pedestrian crossings onto the roadway.
 *
 * Markings are geometry rather than part of the road texture, because they have
 * to be *placed*: a centre line follows a carriageway and stops short of the
 * junction, and a crossing sits on a specific approach. A tiled texture cannot
 * know where the junctions are; the city data does.
 *
 * Everything is emitted as flat quads a few millimetres above the road and
 * biased toward the camera with a polygon offset, so they never z-fight with
 * the surface they sit on.
 */

/** Height above the roadway, in metres. */
const PAINT_Y = 0.006;

/** Centre line: dash length, gap, and width. */
const DASH_LENGTH = 3;
const DASH_GAP = 5;
const LINE_WIDTH = 0.16;

/** Zebra crossing: how far it reaches across the pavement-to-pavement gap. */
const CROSSING_DEPTH = 3.2;
const STRIPE_WIDTH = 0.55;
const STRIPE_PITCH = 1.15;

/** Distance from the junction edge to the crossing, and the stop line beyond. */
const CROSSING_SETBACK = 0.9;
const STOP_BAR_WIDTH = 0.45;

export interface MarkingsBuild {
  mesh: THREE.Mesh;
  dispose: () => void;
}

interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export function buildRoadMarkings(map: CityMap): MarkingsBuild | null {
  const quads: THREE.BufferGeometry[] = [];

  const paint = (x: number, z: number, w: number, d: number) => {
    if (w <= 0 || d <= 0) return;
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    geo.translate(x + w / 2, PAINT_Y, z + d / 2);
    quads.push(geo);
  };

  const alongX = map.roads.filter((r) => r.axis === "x");
  const alongZ = map.roads.filter((r) => r.axis === "z");
  const junctions = findJunctions(alongX, alongZ);

  // --- Centre lines --------------------------------------------------------
  // Dashes are skipped near a junction: real carriageways stop marking short
  // of the box so the crossing and stop line read clearly.
  const clearance = CROSSING_DEPTH + CROSSING_SETBACK + 2;

  for (const road of alongX) {
    const centreZ = road.z + road.d / 2 - LINE_WIDTH / 2;
    for (let x = road.x; x < road.x + road.w; x += DASH_LENGTH + DASH_GAP) {
      const mid = x + DASH_LENGTH / 2;
      if (nearJunction(junctions, mid, centreZ, clearance, "x")) continue;
      paint(x, centreZ, DASH_LENGTH, LINE_WIDTH);
    }
  }

  for (const road of alongZ) {
    const centreX = road.x + road.w / 2 - LINE_WIDTH / 2;
    for (let z = road.z; z < road.z + road.d; z += DASH_LENGTH + DASH_GAP) {
      const mid = z + DASH_LENGTH / 2;
      if (nearJunction(junctions, centreX, mid, clearance, "z")) continue;
      paint(centreX, z, LINE_WIDTH, DASH_LENGTH);
    }
  }

  // --- Crossings and stop lines -------------------------------------------
  for (const j of junctions) {
    // Crossing an avenue: the pedestrian walks along X, so the stripes are
    // bars running along Z — parallel to the traffic they are crossing.
    for (const side of [-1, 1] as const) {
      const z =
        side < 0
          ? j.z - CROSSING_SETBACK - CROSSING_DEPTH
          : j.z + j.d + CROSSING_SETBACK;
      for (let x = j.x + 0.4; x + STRIPE_WIDTH <= j.x + j.w - 0.4; x += STRIPE_PITCH) {
        paint(x, z, STRIPE_WIDTH, CROSSING_DEPTH);
      }
      const barZ = side < 0 ? z - 0.7 - STOP_BAR_WIDTH : z + CROSSING_DEPTH + 0.7;
      // Only the approaching half of the carriageway gets a stop line.
      const barX = side < 0 ? j.x + j.w / 2 : j.x;
      paint(barX, barZ, j.w / 2, STOP_BAR_WIDTH);
    }

    // Crossing a street: stripes run along X.
    for (const side of [-1, 1] as const) {
      const x =
        side < 0
          ? j.x - CROSSING_SETBACK - CROSSING_DEPTH
          : j.x + j.w + CROSSING_SETBACK;
      for (let z = j.z + 0.4; z + STRIPE_WIDTH <= j.z + j.d - 0.4; z += STRIPE_PITCH) {
        paint(x, z, CROSSING_DEPTH, STRIPE_WIDTH);
      }
      const barX = side < 0 ? x - 0.7 - STOP_BAR_WIDTH : x + CROSSING_DEPTH + 0.7;
      const barZ = side < 0 ? j.z : j.z + j.d / 2;
      paint(barX, barZ, STOP_BAR_WIDTH, j.d / 2);
    }
  }

  if (quads.length === 0) return null;

  const geometry = mergeQuads(quads);
  quads.forEach((q) => q.dispose());

  const material = new THREE.MeshStandardMaterial({
    color: 0xe6e2d6,
    roughness: 0.72,
    metalness: 0,
    // Paint is not a separate surface in reality, so it sits at almost the same
    // depth as the road. The offset is what stops the two fighting.
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "road-markings";

  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

/** Every place an east-west road crosses a north-south one. */
function findJunctions(alongX: Road[], alongZ: Road[]): Rect[] {
  const out: Rect[] = [];
  for (const a of alongX) {
    for (const b of alongZ) {
      const x = Math.max(a.x, b.x);
      const z = Math.max(a.z, b.z);
      const w = Math.min(a.x + a.w, b.x + b.w) - x;
      const d = Math.min(a.z + a.d, b.z + b.d) - z;
      if (w > 0 && d > 0) out.push({ x, z, w, d });
    }
  }
  return out;
}

/**
 * True when a point on a centre line sits inside a junction's marking-free
 * zone. Only the axis the line runs along is expanded, so a dash is suppressed
 * as it approaches the box but lines on the crossing road are unaffected.
 */
function nearJunction(
  junctions: Rect[],
  x: number,
  z: number,
  clearance: number,
  axis: "x" | "z",
): boolean {
  const padX = axis === "x" ? clearance : 0;
  const padZ = axis === "z" ? clearance : 0;
  return junctions.some(
    (j) =>
      x > j.x - padX &&
      x < j.x + j.w + padX &&
      z > j.z - padZ &&
      z < j.z + j.d + padZ,
  );
}

/** Concatenates plane geometries that share position/normal/uv attributes. */
function mergeQuads(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const vertexCount = parts.reduce((n, p) => n + p.attributes.position.count, 0);
  const indexCount = parts.reduce((n, p) => n + (p.index?.count ?? 0), 0);

  for (const name of ["position", "normal", "uv"] as const) {
    const itemSize = parts[0].attributes[name].itemSize;
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
  let cursor = 0;
  let base = 0;
  for (const part of parts) {
    const idx = part.index!;
    for (let i = 0; i < idx.count; i++) indices[cursor++] = idx.getX(i) + base;
    base += part.attributes.position.count;
  }
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}
