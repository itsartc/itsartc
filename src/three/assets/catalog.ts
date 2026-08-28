import type { ObjectType } from "@/world/schema";
import type { GlbAssetCatalog } from "./AssetRegistry";

/** Curated sources only: each entry must earn its place in the world. */
export const WORLD_GLBS: GlbAssetCatalog = {
  "city-commercial.building-e": {
    url: "/assets/kenney/city-kit-commercial/building-e.glb",
  },
  "city-commercial.building-b": {
    url: "/assets/kenney/city-kit-commercial/building-b.glb",
  },
  "city-commercial.building-c": {
    url: "/assets/kenney/city-kit-commercial/building-c.glb",
  },
  "city-commercial.building-h": {
    url: "/assets/kenney/city-kit-commercial/building-h.glb",
  },
  "city-commercial.building-i": {
    url: "/assets/kenney/city-kit-commercial/building-i.glb",
  },
  "city-commercial.building-j": {
    url: "/assets/kenney/city-kit-commercial/building-j.glb",
  },
  "city-commercial.building-k": {
    url: "/assets/kenney/city-kit-commercial/building-k.glb",
  },
  "city-commercial.building-n": {
    url: "/assets/kenney/city-kit-commercial/building-n.glb",
  },
  "city-commercial.parasol-a": {
    url: "/assets/kenney/city-kit-commercial/detail-parasol-a.glb",
  },
  "nature.tree-default": {
    url: "/assets/kenney/nature-kit/tree-default.glb",
  },
  "nature.rock-small-a": {
    url: "/assets/kenney/nature-kit/rock-small-a.glb",
  },
  "nature.tree-default-fall": {
    url: "/assets/kenney/nature-kit/tree-default-fall.glb",
  },
  "nature.flower-purple-a": {
    url: "/assets/kenney/nature-kit/flower-purple-a.glb",
  },
  "nature.sign": {
    url: "/assets/kenney/nature-kit/sign.glb",
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
    "b-ai-labs": "city-commercial.building-n",
    "b-event-hall": "city-commercial.building-j",
    "b-hiring-hall": "city-commercial.building-k",
    "b-investor-lounge": "city-commercial.building-c",
    "b-coworking-house": "city-commercial.building-i",
    "b-builder-district": "city-commercial.building-h",
    "b-after-hours": "city-commercial.building-b",
  },
  objects: {
    tree: "nature.tree-default",
    blossom: "nature.tree-default-fall",
    rock: "nature.rock-small-a",
    flowers: "nature.flower-purple-a",
    sign: "nature.sign",
    table: "city-commercial.parasol-a",
  },
};
