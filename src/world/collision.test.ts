import { describe, expect, it } from "vitest";
import type { WorldMap } from "./schema";
import { WorldCollision } from "./collision";

function map(overrides: Partial<WorldMap> = {}): WorldMap {
  return {
    id: "test",
    name: "Test",
    version: 1,
    tileSize: 32,
    widthTiles: 8,
    heightTiles: 8,
    baseTerrain: "grass",
    spawn: { x: 1, y: 1 },
    terrain: [],
    districts: [],
    buildings: [],
    objects: [],
    people: [],
    zones: [],
    ...overrides,
  };
}

describe("WorldCollision", () => {
  it("derives the same authored solid tiles as the Phaser world", () => {
    const collision = new WorldCollision(map({
      terrain: [{ type: "water", x: 0, y: 3, w: 2, h: 1 }],
      buildings: [{
        id: "building",
        name: "Building",
        districtId: "district",
        x: 2,
        y: 2,
        w: 2,
        h: 2,
        wallColor: "#000",
        roofColor: "#000",
        enterable: true,
        entrance: { x: 2, y: 3 },
      }],
      objects: [
        { id: "rock", type: "rock", x: 5, y: 1, solid: true },
        { id: "fountain", type: "fountain", x: 5, y: 4 },
      ],
    }));

    expect(collision.isSolidTile(0, 3)).toBe(true);
    expect(collision.isSolidTile(2, 2)).toBe(true);
    expect(collision.isSolidTile(2, 3)).toBe(false);
    expect(collision.isSolidTile(5, 1)).toBe(true);
    expect(collision.isSolidTile(6, 5)).toBe(true);
    expect(collision.isSolidTile(-1, 1)).toBe(true);
  });

  it("stops at a wall and preserves movement along it", () => {
    const collision = new WorldCollision(map({
      buildings: [{
        id: "wall",
        name: "Wall",
        districtId: "district",
        x: 3,
        y: 1,
        w: 1,
        h: 5,
        wallColor: "#000",
        roofColor: "#000",
        enterable: false,
      }],
    }));

    const result = collision.moveCircle(2, 2, 2, 1, 0.3);
    expect(result.blockedX).toBe(true);
    expect(result.blockedZ).toBe(false);
    expect(result.x).toBeCloseTo(2.7, 3);
    expect(result.z).toBeCloseTo(3, 5);
  });

  it("keeps the entire player circle inside world bounds", () => {
    const collision = new WorldCollision(map());
    const result = collision.moveCircle(0.4, 0.4, -2, -2, 0.3);

    expect(result.blockedX).toBe(true);
    expect(result.blockedZ).toBe(true);
    expect(result.x).toBeCloseTo(0.3, 3);
    expect(result.z).toBeCloseTo(0.3, 3);
  });

  it("subdivides large movement so it cannot tunnel through one tile", () => {
    const collision = new WorldCollision(map({
      objects: [{ id: "rock", type: "rock", x: 3, y: 2, solid: true }],
    }));
    const result = collision.moveCircle(1.5, 2.5, 5, 0, 0.3);

    expect(result.blockedX).toBe(true);
    expect(result.x).toBeCloseTo(2.7, 3);
  });
});
