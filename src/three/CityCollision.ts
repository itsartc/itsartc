import * as THREE from "three";
import type { WorldCollision } from "./collision/types";
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
  type MeshBVH,
} from "three-mesh-bvh";

/**
 * Collision and ground queries against the city mesh.
 *
 * The city is over a million triangles across hundreds of meshes. Three's
 * default raycaster tests every triangle, which is far too slow to run several
 * times per frame, so each mesh gets a bounds tree (BVH) built once at load.
 *
 * The renderer normalises the source asset before this class sees it, so all
 * collision distances here are metres.
 */

// Patch three's raycasting to use the BVH when one is present.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/** Highest point we cast down from when looking for ground. */
const SKY_Y = 500;

/** A ground hit must leave at least this much headroom to count as walkable. */
const REQUIRED_HEADROOM = 4;

export interface GroundHit {
  y: number;
  normal: THREE.Vector3;
}

export class CityCollision implements WorldCollision {
  private readonly meshes: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();

  /** Dominant walkable street level, refined while choosing a spawn. */
  groundY: number;

  constructor(root: THREE.Object3D) {
    root.updateMatrixWorld(true);

    // Hidden model sections are intentional world edits and must not leave
    // invisible walls behind.
    root.traverseVisible((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      mesh.geometry.computeBoundsTree();
      this.meshes.push(mesh);
    });

    const box = new THREE.Box3().setFromObject(root);
    this.groundY = box.min.y;

    // firstHitOnly is a large win: we never need the full sorted hit list.
    (this.raycaster as unknown as { firstHitOnly: boolean }).firstHitOnly = true;
    this.raycaster.far = SKY_Y * 2;
  }

  /** Surface directly below a point, or null if there is nothing under it. */
  groundAt(x: number, z: number, fromY = SKY_Y): GroundHit | null {
    this.raycaster.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0));
    const hits = this.raycaster.intersectObjects(this.meshes, false);
    const hit = hits[0];
    if (!hit) return null;
    return {
      y: hit.point.y,
      normal: hit.face
        ? hit.face.normal.clone().applyNormalMatrix(
            new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld),
          )
        : new THREE.Vector3(0, 1, 0),
    };
  }

  /**
   * Distance to the nearest obstruction along a direction, or null if clear.
   * Used both for walls in front of the player and for the camera pulling in.
   */
  castDistance(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): number | null {
    this.raycaster.set(origin, direction.clone().normalize());
    this.raycaster.far = maxDistance;
    const hits = this.raycaster.intersectObjects(this.meshes, false);
    this.raycaster.far = SKY_Y * 2;
    return hits[0] ? hits[0].distance : null;
  }

  /**
   * Finds a point standing on open street.
   *
   * Scans a grid across the site and keeps candidates that sit close to ground
   * level with clear sky above them — which excludes rooftops (too high) and
   * building interiors (no headroom). Among those it prefers open ground near
   * the middle of the site.
   *
   * The centre bias matters: scoring on openness alone picks the emptiest point
   * available, which is the bare terrain outside the city, not a street inside
   * it. An inset margin rules out the site's outer rim for the same reason.
   */
  findStreetSpawn(bounds: THREE.Box3, steps = 48): THREE.Vector3 | null {
    const best = { point: null as THREE.Vector3 | null, score: -Infinity };

    const centre = bounds.getCenter(new THREE.Vector3());
    const span = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    const inset = span * 0.12;

    const minX = bounds.min.x + inset;
    const maxX = bounds.max.x - inset;
    const minZ = bounds.min.z + inset;
    const maxZ = bounds.max.z - inset;

    const samples: Array<{ x: number; z: number; ground: GroundHit }> = [];

    for (let i = 1; i < steps; i++) {
      for (let j = 1; j < steps; j++) {
        const x = minX + ((maxX - minX) * i) / steps;
        const z = minZ + ((maxZ - minZ) * j) / steps;

        const ground = this.groundAt(x, z);
        if (!ground) continue;
        // Steep faces are walls, not pavement.
        if (ground.normal.y < 0.7) continue;

        samples.push({ x, z, ground });
      }
    }

    if (samples.length === 0) return null;

    // The GLB contains a few decorative meshes below the actual roads, so its
    // bounding-box minimum is not a usable street level. Find the lowest
    // significant horizontal-surface cluster instead. Roads and pavements
    // form a broad, repeated band; roofs are split across many higher bands.
    const bucketSize = 0.75;
    const buckets = new Map<number, { count: number; total: number }>();
    for (const { ground } of samples) {
      const key = Math.round(ground.y / bucketSize);
      const bucket = buckets.get(key) ?? { count: 0, total: 0 };
      bucket.count++;
      bucket.total += ground.y;
      buckets.set(key, bucket);
    }

    const largestBucket = Math.max(...Array.from(buckets.values(), (bucket) => bucket.count));
    const streetBucket = Array.from(buckets.entries())
      .filter(([, bucket]) => bucket.count >= largestBucket * 0.3)
      .sort(([a], [b]) => a - b)[0];
    if (streetBucket) this.groundY = streetBucket[1].total / streetBucket[1].count;

    for (const { x, z, ground } of samples) {
      // Rooftops and raised platforms sit above the street band.
      if (Math.abs(ground.y - this.groundY) > 1.5) continue;

      // Must be able to stand up here.
      const headroom = this.castDistance(
        new THREE.Vector3(x, ground.y + 0.4, z),
        new THREE.Vector3(0, 1, 0),
        60,
      );
      if (headroom !== null && headroom < REQUIRED_HEADROOM) continue;

      // Prefer somewhere with room to walk in every direction.
      let openness = 0;
      for (let a = 0; a < 8; a++) {
        const angle = (a / 8) * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const d = this.castDistance(new THREE.Vector3(x, ground.y + 1.0, z), dir, 25);
        openness += d === null ? 25 : d;
      }

      // Openness in metres, less a penalty for wandering away from the middle
      // of the site. The weight is tuned so a genuinely wide street near the
      // edge can still beat a cramped alley dead centre.
      const fromCentre = Math.hypot(x - centre.x, z - centre.z);
      const score = openness - fromCentre * 0.8;

      if (score > best.score) {
        best.score = score;
        best.point = new THREE.Vector3(x, ground.y, z);
      }
    }

    return best.point;
  }

  dispose() {
    for (const mesh of this.meshes) {
      (mesh.geometry as THREE.BufferGeometry & { disposeBoundsTree?: () => void })
        .disposeBoundsTree?.();
    }
    this.meshes.length = 0;
  }
}

export type { MeshBVH };
