import * as THREE from "three";
import type { CityMap } from "@/world/schema";
import { KERB_HEIGHT } from "@/world/schema";
import type { WorldCollision } from "./types";

/**
 * Collision built from the city's own data.
 *
 * Because we generated the world, we already know where every solid is: there
 * is no need to raycast a mesh to rediscover it. Buildings and props are
 * axis-aligned boxes and the ground is a set of flat rectangles, so queries are
 * arithmetic rather than triangle intersection — roughly two orders of
 * magnitude cheaper than the BVH the imported model required.
 *
 * A uniform grid keeps it that way as the city grows: a query only tests the
 * boxes in the cells it actually touches.
 */

/** Grid cell size in metres. Roughly a building's footprint. */
const CELL = 16;

interface GroundRect {
  x: number;
  z: number;
  w: number;
  d: number;
  y: number;
}

export class BoxCollision implements WorldCollision {
  private readonly boxes: THREE.Box3[];
  private readonly ground: GroundRect[] = [];
  private readonly cells = new Map<number, number[]>();
  private readonly originX: number;
  private readonly originZ: number;
  private readonly cols: number;

  constructor(map: CityMap, boxes: THREE.Box3[]) {
    this.boxes = boxes;
    this.originX = 0;
    this.originZ = 0;
    this.cols = Math.ceil(map.size.w / CELL) + 2;

    // Raised surfaces. Anything not covered by one of these is roadway at y=0.
    for (const s of map.sidewalks) {
      this.ground.push({ x: s.x, z: s.z, w: s.w, d: s.d, y: KERB_HEIGHT });
    }
    for (const p of map.plazas) {
      this.ground.push({ x: p.x, z: p.z, w: p.w, d: p.d, y: KERB_HEIGHT + 0.01 });
    }

    boxes.forEach((box, index) => {
      const minC = this.cellOf(box.min.x, box.min.z);
      const maxC = this.cellOf(box.max.x, box.max.z);
      for (let cz = minC.cz; cz <= maxC.cz; cz++) {
        for (let cx = minC.cx; cx <= maxC.cx; cx++) {
          const key = cz * this.cols + cx;
          const bucket = this.cells.get(key);
          if (bucket) bucket.push(index);
          else this.cells.set(key, [index]);
        }
      }
    });
  }

  private cellOf(x: number, z: number) {
    return {
      cx: Math.floor((x - this.originX) / CELL),
      cz: Math.floor((z - this.originZ) / CELL),
    };
  }

  /** Collider indices in every cell overlapping an axis-aligned area. */
  private candidates(minX: number, minZ: number, maxX: number, maxZ: number): Set<number> {
    const a = this.cellOf(minX, minZ);
    const b = this.cellOf(maxX, maxZ);
    const out = new Set<number>();
    for (let cz = a.cz; cz <= b.cz; cz++) {
      for (let cx = a.cx; cx <= b.cx; cx++) {
        const bucket = this.cells.get(cz * this.cols + cx);
        if (bucket) for (const i of bucket) out.add(i);
      }
    }
    return out;
  }

  groundAt(x: number, z: number, fromY = 500): { y: number } | null {
    // Start from the roadway and take the highest surface at or below fromY.
    let best = 0;

    for (const g of this.ground) {
      if (x < g.x || x > g.x + g.w || z < g.z || z > g.z + g.d) continue;
      if (g.y <= fromY && g.y > best) best = g.y;
    }

    // Standing on top of a solid — a planter, say — counts as ground.
    for (const i of this.candidates(x, z, x, z)) {
      const box = this.boxes[i];
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
      if (box.max.y <= fromY && box.max.y > best) best = box.max.y;
    }

    return { y: best };
  }

  castDistance(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): number | null {
    const dir = direction.clone().normalize();
    const end = origin.clone().addScaledVector(dir, maxDistance);

    const minX = Math.min(origin.x, end.x);
    const maxX = Math.max(origin.x, end.x);
    const minZ = Math.min(origin.z, end.z);
    const maxZ = Math.max(origin.z, end.z);

    let nearest: number | null = null;
    for (const i of this.candidates(minX, minZ, maxX, maxZ)) {
      const t = intersectBox(origin, dir, this.boxes[i], maxDistance);
      if (t !== null && (nearest === null || t < nearest)) nearest = t;
    }
    return nearest;
  }

  dispose() {
    this.cells.clear();
    this.ground.length = 0;
  }
}

/** Slab method: the standard ray/AABB test, returning entry distance. */
function intersectBox(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  box: THREE.Box3,
  maxDistance: number,
): number | null {
  let tMin = 0;
  let tMax = maxDistance;

  for (const axis of ["x", "y", "z"] as const) {
    const o = origin[axis];
    const d = dir[axis];
    const lo = box.min[axis];
    const hi = box.max[axis];

    if (Math.abs(d) < 1e-8) {
      // Parallel to this slab: miss unless the origin already lies inside it.
      if (o < lo || o > hi) return null;
      continue;
    }

    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  return tMin;
}
