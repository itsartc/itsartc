import type * as THREE from "three";

/**
 * What the player needs to know about the world to walk through it.
 *
 * Both collision backends implement this: the BVH one that raycasts an imported
 * mesh, and the box one built from city data. The player controller depends on
 * the interface, so swapping worlds does not touch movement code.
 */
export interface WorldCollision {
  /** Surface height directly below a point, or null if nothing is under it. */
  groundAt(x: number, z: number, fromY?: number): { y: number } | null;

  /** Distance to the nearest obstruction along a ray, or null if clear. */
  castDistance(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): number | null;
}
