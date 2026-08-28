import type { ObjectType } from "@/world/schema";
import type { GlbAssetCatalog } from "./AssetRegistry";

/** Curated sources only: each entry must earn its place in the world. */
export const WORLD_GLBS: GlbAssetCatalog = {
  "city-commercial.building-e": {
    url: "/assets/kenney/city-kit-commercial/building-e.glb",
  },
  "nature.tree-default": {
    url: "/assets/kenney/nature-kit/tree-default.glb",
  },
  "nature.rock-small-a": {
    url: "/assets/kenney/nature-kit/rock-small-a.glb",
  },
};

/** World identities stay separate from visual asset identities. */
export interface WorldAssetBindings {
  player?: string;
  buildings: Readonly<Partial<Record<string, string>>>;
  objects: Readonly<Partial<Record<ObjectType, string>>>;
}

/** Builders opt into mappings one model at a time while boxes remain the fallback. */
export const WORLD_ASSET_BINDINGS: WorldAssetBindings = {
  buildings: {
    // Low, wide and welcoming: a good first scale/orientation proof for the café.
    "b-founder-cafe": "city-commercial.building-e",
  },
  objects: {
    tree: "nature.tree-default",
    rock: "nature.rock-small-a",
  },
};
