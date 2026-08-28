import type { WorldMap } from "./schema";

/** Collision uses authored tile units, independent of either renderer. */
export interface CircleMoveResult {
  x: number;
  z: number;
  blockedX: boolean;
  blockedZ: boolean;
}

const COLLISION_EPSILON = 1e-9;
const BINARY_SEARCH_STEPS = 12;

/**
 * Immutable collision lookup derived from WorldMap.
 *
 * This deliberately mirrors the rules that originally lived in WorldScene:
 * water, building footprints except entrance tiles, solid objects, and the
 * fountain's 2x2 footprint block movement. Out-of-bounds tiles are solid.
 */
export class WorldCollision {
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly solidTileCount: number;

  private readonly solid: Uint8Array;

  constructor(map: WorldMap) {
    this.widthTiles = map.widthTiles;
    this.heightTiles = map.heightTiles;
    this.solid = new Uint8Array(this.widthTiles * this.heightTiles);

    for (const region of map.terrain) {
      if (region.type !== "water") continue;
      this.markRect(region.x, region.y, region.w, region.h);
    }

    for (const building of map.buildings) {
      for (let y = building.y; y < building.y + building.h; y++) {
        for (let x = building.x; x < building.x + building.w; x++) {
          if (building.entrance?.x === x && building.entrance.y === y) continue;
          this.mark(x, y);
        }
      }
    }

    for (const object of map.objects) {
      if (object.solid) this.mark(object.x, object.y);
      if (object.type === "fountain") this.markRect(object.x, object.y, 2, 2);
    }

    let count = 0;
    for (const value of this.solid) count += value;
    this.solidTileCount = count;
  }

  isSolidTile(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.widthTiles || y >= this.heightTiles) return true;
    return this.solid[y * this.widthTiles + x] === 1;
  }

  /** True when a ground-plane circle overlaps a solid tile or the world edge. */
  collidesCircle(x: number, z: number, radius: number): boolean {
    if (radius <= 0) throw new Error("Collision radius must be greater than zero");
    if (
      x - radius < 0 ||
      z - radius < 0 ||
      x + radius > this.widthTiles ||
      z + radius > this.heightTiles
    ) {
      return true;
    }

    const minTileX = Math.floor(x - radius);
    const maxTileX = Math.floor(x + radius - COLLISION_EPSILON);
    const minTileZ = Math.floor(z - radius);
    const maxTileZ = Math.floor(z + radius - COLLISION_EPSILON);

    for (let tileZ = minTileZ; tileZ <= maxTileZ; tileZ++) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
        if (!this.isSolidTile(tileX, tileZ)) continue;

        const closestX = Math.max(tileX, Math.min(x, tileX + 1));
        const closestZ = Math.max(tileZ, Math.min(z, tileZ + 1));
        const dx = x - closestX;
        const dz = z - closestZ;
        if (dx * dx + dz * dz < radius * radius - COLLISION_EPSILON) return true;
      }
    }
    return false;
  }

  /**
   * Move a circle through the grid, resolving X and Z separately so the player
   * slides along walls. Large deltas are subdivided to prevent tunnelling.
   */
  moveCircle(
    x: number,
    z: number,
    deltaX: number,
    deltaZ: number,
    radius: number,
  ): CircleMoveResult {
    if (this.collidesCircle(x, z, radius)) {
      throw new Error("Cannot move a circle from an already-colliding position");
    }

    const maxSubstep = Math.max(radius * 0.5, 0.01);
    const substeps = Math.max(1, Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaZ)) / maxSubstep));
    const stepX = deltaX / substeps;
    const stepZ = deltaZ / substeps;
    let nextX = x;
    let nextZ = z;
    let blockedX = false;
    let blockedZ = false;

    for (let step = 0; step < substeps; step++) {
      const resolvedX = this.resolveAxis(nextX, nextX + stepX, nextZ, radius, "x");
      blockedX ||= resolvedX.blocked;
      nextX = resolvedX.value;

      const resolvedZ = this.resolveAxis(nextZ, nextZ + stepZ, nextX, radius, "z");
      blockedZ ||= resolvedZ.blocked;
      nextZ = resolvedZ.value;
    }

    return { x: nextX, z: nextZ, blockedX, blockedZ };
  }

  private resolveAxis(
    from: number,
    to: number,
    otherAxis: number,
    radius: number,
    axis: "x" | "z",
  ): { value: number; blocked: boolean } {
    if (from === to) return { value: from, blocked: false };
    const collides = (value: number) =>
      axis === "x"
        ? this.collidesCircle(value, otherAxis, radius)
        : this.collidesCircle(otherAxis, value, radius);

    if (!collides(to)) return { value: to, blocked: false };

    let clear = 0;
    let blocked = 1;
    for (let i = 0; i < BINARY_SEARCH_STEPS; i++) {
      const midpoint = (clear + blocked) / 2;
      if (collides(from + (to - from) * midpoint)) blocked = midpoint;
      else clear = midpoint;
    }
    return { value: from + (to - from) * clear, blocked: true };
  }

  private markRect(x: number, y: number, width: number, height: number) {
    for (let tileY = y; tileY < y + height; tileY++) {
      for (let tileX = x; tileX < x + width; tileX++) this.mark(tileX, tileY);
    }
  }

  private mark(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.widthTiles || y >= this.heightTiles) return;
    this.solid[y * this.widthTiles + x] = 1;
  }
}
