import type * as THREE from "three";

/**
 * What the player needs to know about the world to walk through it.
 *
 * The player and camera depend on this rather than on a concrete backend. The
 * world in the app raycasts an imported mesh; a generated world built its
 * colliders from layout data instead, and swapping between the two never
 * touched movement code.
 */
export interface WorldCollision {
  /** Surface height directly below a point, or null if nothing is under it. */
  groundAt(x: number, z: number, fromY?: number): { y: number } | null;

  /** Distance to the nearest obstruction along a ray, or null if clear. */
  castDistance(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): number | null;
}
