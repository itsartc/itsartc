import * as THREE from "three";
import type { WorldMap } from "@/world/schema";
import type { AssetRegistry } from "../assets/AssetRegistry";

export interface EnvironmentBuild {
  group: THREE.Group;
  ready: Promise<void>;
  assetErrors: readonly string[];
}

/** Loads an optional large visual layer without making its meshes game state. */
export function buildEnvironment(map: WorldMap, assets: AssetRegistry): EnvironmentBuild {
  const group = new THREE.Group();
  group.name = "environment";
  const assetErrors: string[] = [];
  const definition = map.environment;

  if (!definition) return { group, ready: Promise.resolve(), assetErrors };

  const ready = assets.instantiate(definition.assetId)
    .then((model) => {
      model.name = `environment:${definition.assetId}`;
      model.position.set(definition.offset.x, definition.offset.y, definition.offset.z);
      group.add(model);
    })
    .catch((error: unknown) => {
      assetErrors.push(error instanceof Error ? error.message : String(error));
    });

  return { group, ready, assetErrors };
}
