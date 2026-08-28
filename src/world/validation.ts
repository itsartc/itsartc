import { getWorldAsset, getWorldEnvironmentAsset } from "./assetCatalog";
import { WorldCollision } from "./collision";
import type { Building, WorldMap } from "./schema";

export interface WorldValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  entityId?: string;
}

const overlaps = (a: Building, b: Building) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const inBounds = (map: WorldMap, x: number, y: number, w = 1, h = 1) =>
  x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= map.widthTiles && y + h <= map.heightTiles;

/** Pure validation shared by the editor, tests, and eventual publish endpoint. */
export function validateWorldMap(map: WorldMap): WorldValidationIssue[] {
  const issues: WorldValidationIssue[] = [];
  const ids = new Set<string>();
  const addId = (id: string) => {
    if (ids.has(id)) {
      issues.push({ severity: "error", code: "duplicate-id", message: `Duplicate id: ${id}`, entityId: id });
    }
    ids.add(id);
  };

  if (map.environment && !getWorldEnvironmentAsset(map.environment.assetId)) {
    issues.push({
      severity: "error",
      code: "invalid-environment-asset",
      message: `Unknown environment asset: ${map.environment.assetId}`,
    });
  }
  for (const [index, rect] of (map.environment?.collisionRects ?? []).entries()) {
    if (!inBounds(map, rect.x, rect.y, rect.w, rect.h)) {
      issues.push({
        severity: "error",
        code: "environment-collision-out-of-bounds",
        message: `Environment collision ${index + 1} extends beyond the map`,
      });
    }
  }

  for (const building of map.buildings) {
    addId(building.id);
    if (!inBounds(map, building.x, building.y, building.w, building.h)) {
      issues.push({
        severity: "error",
        code: "building-out-of-bounds",
        message: `${building.name} extends beyond the map`,
        entityId: building.id,
      });
    }
    if (building.assetId && getWorldAsset(building.assetId)?.placement !== "building") {
      issues.push({
        severity: "error",
        code: "invalid-building-asset",
        message: `${building.name} uses an unknown or non-building asset`,
        entityId: building.id,
      });
    }
    if (building.enterable && !building.entrance) {
      issues.push({
        severity: "error",
        code: "missing-entrance",
        message: `${building.name} is enterable but has no entrance`,
        entityId: building.id,
      });
    }
    if (building.entrance && !inBounds(map, building.entrance.x, building.entrance.y)) {
      issues.push({
        severity: "error",
        code: "entrance-out-of-bounds",
        message: `${building.name}'s entrance is outside the map`,
        entityId: building.id,
      });
    }
  }

  for (let i = 0; i < map.buildings.length; i++) {
    for (let j = i + 1; j < map.buildings.length; j++) {
      const first = map.buildings[i];
      const second = map.buildings[j];
      if (!overlaps(first, second)) continue;
      issues.push({
        severity: "error",
        code: "building-overlap",
        message: `${first.name} overlaps ${second.name}`,
        entityId: second.id,
      });
    }
  }

  for (const object of map.objects) {
    addId(object.id);
    const asset = getWorldAsset(object.assetId);
    const footprint = asset?.defaultFootprint ?? { w: object.type === "fountain" ? 2 : 1, h: object.type === "fountain" ? 2 : 1 };
    if (!inBounds(map, object.x, object.y, footprint.w, footprint.h)) {
      issues.push({
        severity: "error",
        code: "object-out-of-bounds",
        message: `${object.id} extends beyond the map`,
        entityId: object.id,
      });
    }
    if (object.assetId && asset?.placement !== "object") {
      issues.push({
        severity: "error",
        code: "invalid-object-asset",
        message: `${object.id} uses an unknown or non-object asset`,
        entityId: object.id,
      });
    }
  }

  if (!inBounds(map, map.spawn.x, map.spawn.y)) {
    issues.push({ severity: "error", code: "spawn-out-of-bounds", message: "Spawn is outside the map" });
    return issues;
  }

  const collision = new WorldCollision(map);
  if (collision.isSolidTile(map.spawn.x, map.spawn.y)) {
    issues.push({ severity: "error", code: "spawn-blocked", message: "Spawn is blocked" });
    return issues;
  }

  const key = (x: number, y: number) => `${x},${y}`;
  const queue = [{ x: map.spawn.x, y: map.spawn.y }];
  const reachable = new Set([key(map.spawn.x, map.spawn.y)]);
  for (let index = 0; index < queue.length; index++) {
    const tile = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = tile.x + dx;
      const y = tile.y + dy;
      const nextKey = key(x, y);
      if (reachable.has(nextKey) || collision.isSolidTile(x, y)) continue;
      reachable.add(nextKey);
      queue.push({ x, y });
    }
  }

  for (const building of map.buildings) {
    if (!building.entrance || !inBounds(map, building.entrance.x, building.entrance.y)) continue;
    if (reachable.has(key(building.entrance.x, building.entrance.y))) continue;
    issues.push({
      severity: "error",
      code: "entrance-unreachable",
      message: `${building.name}'s entrance cannot be reached from spawn`,
      entityId: building.id,
    });
  }

  return issues;
}

export function cloneWorldMap(map: WorldMap): WorldMap {
  return JSON.parse(JSON.stringify(map)) as WorldMap;
}
