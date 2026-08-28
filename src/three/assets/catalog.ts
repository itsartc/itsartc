import type { ObjectType } from "@/world/schema";
import { WORLD_ASSETS } from "@/world/assetCatalog";
import type { GlbAssetCatalog } from "./AssetRegistry";

/** One loadable registry generated from the editor's verified asset catalog. */
export const WORLD_GLBS: GlbAssetCatalog = Object.fromEntries(
  WORLD_ASSETS.map((asset) => [asset.id, { url: asset.url }]),
);

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
    table: "city-commercial.detail-parasol-a",
  },
};
