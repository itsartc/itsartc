import * as THREE from "three";
import type { WorldMap } from "@/world/schema";

/**
 * The coordinate bridge between the authored 2D world and the Three.js scene.
 *
 * This is the ONLY module allowed to convert between the two spaces. Every
 * other renderer file must call these helpers rather than multiplying by a
 * scale factor inline — a scattered conversion is how a renderer silently
 * drifts out of agreement with the network protocol.
 *
 * ## Axis mapping
 *
 *   world pixel X  ->  three.x
 *   world pixel Y  ->  three.z      (NOT -z; see below)
 *   height         ->  three.y      (up)
 *
 * The authored world uses screen conventions: +y points DOWN the map. Three.js
 * is Y-up with the ground on the XZ plane. With the camera placed above and
 * offset toward +Z looking back at its target, +Z points toward the bottom of
 * the screen — exactly where the authored +y pointed. Mapping y -> +z therefore
 * reproduces the map with no mirroring. Mapping y -> -z would flip the world
 * north-to-south and silently invalidate every authored coordinate.
 *
 * ## Scale
 *
 * One tile = one Three.js world unit (SCALE = 1/32, since tileSize is 32px).
 * Human-scale units keep Three's lighting, shadow-camera and fog defaults in
 * their sensible range; pixel-scale units (2048 x 1472) would not.
 *
 * ## Network protocol
 *
 * The wire format is unchanged and stays in world PIXELS. `threeToWorldPixel`
 * is the boundary function a future networking hookup uses for `getPosition()`,
 * and `worldPixelToThree` places incoming peers. Because the conversion is
 * exact and centralised, a Phaser client and a Three.js client can occupy the
 * same world and agree on every position.
 */

/** Pixels per tile in the authored world data. */
export const TILE_PIXELS = 32;

/** World pixels -> Three.js scene units. One tile = one unit. */
export const SCALE = 1 / TILE_PIXELS;

/** Three.js scene units -> world pixels. */
export const INV_SCALE = TILE_PIXELS;

/** A position on the wire / in authored world data, in pixels. */
export interface WorldPixel {
  x: number;
  y: number;
}

/**
 * Convert an authored/network world-pixel position into scene space.
 * `height` is the Y (up) coordinate in scene units, defaulting to ground level.
 */
export function worldPixelToThree(x: number, y: number, height = 0): THREE.Vector3 {
  return new THREE.Vector3(x * SCALE, height, y * SCALE);
}

/**
 * Convert a scene-space position back to world pixels for the network layer.
 * Rounded to integers to match the existing wire format exactly.
 */
export function threeToWorldPixel(v: THREE.Vector3): WorldPixel {
  return {
    x: Math.round(v.x * INV_SCALE),
    y: Math.round(v.z * INV_SCALE),
  };
}

/** Scene position of the CENTRE of a tile — matches how entities are placed. */
export function tileCenterToThree(tx: number, ty: number, height = 0): THREE.Vector3 {
  return worldPixelToThree(
    tx * TILE_PIXELS + TILE_PIXELS / 2,
    ty * TILE_PIXELS + TILE_PIXELS / 2,
    height,
  );
}

/** Scene position of a tile's top-left CORNER — used for laying out footprints. */
export function tileCornerToThree(tx: number, ty: number, height = 0): THREE.Vector3 {
  return worldPixelToThree(tx * TILE_PIXELS, ty * TILE_PIXELS, height);
}

/** A tile-space size (w x h tiles) converted to scene units. */
export function tileSizeToThree(wTiles: number, hTiles: number): { w: number; h: number } {
  return { w: wTiles, h: hTiles }; // 1 tile = 1 unit, but go through here for clarity
}

/** Overall world extent in scene units. */
export function worldSize(map: WorldMap): { w: number; d: number } {
  return { w: map.widthTiles, d: map.heightTiles };
}

/** Scene-space centre of the whole world — a useful default camera target. */
export function worldCenterToThree(map: WorldMap, height = 0): THREE.Vector3 {
  return new THREE.Vector3(map.widthTiles / 2, height, map.heightTiles / 2);
}
