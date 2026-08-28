import type { ObjectType } from "./schema";

export type AssetPack = "City Kit Commercial" | "Nature Kit" | "Future City 1";
export type AssetCategory =
  | "building"
  | "skyscraper"
  | "background-building"
  | "attachment"
  | "street-furniture"
  | "tree"
  | "plant"
  | "rock"
  | "landmark"
  | "fence"
  | "bridge";

export interface WorldAssetDefinition {
  id: string;
  label: string;
  pack: AssetPack;
  category: AssetCategory;
  url: string;
  placement: "building" | "object" | "attachment";
  objectType?: ObjectType;
  defaultFootprint: { w: number; h: number };
  defaultHeight?: number;
  solidByDefault: boolean;
  /** Attachments are catalogued now but disabled until façade anchors exist. */
  editorReady: boolean;
}

export interface AssetPackCredit {
  creator: string;
  creatorUrl: string;
  modelUrl: string;
  license: string;
  licenseUrl: string;
  modified: boolean;
}

export const ASSET_PACK_CREDITS: Readonly<Partial<Record<AssetPack, AssetPackCredit>>> = {
  "Future City 1": {
    creator: "HiQ3D",
    creatorUrl: "https://sketchfab.com/HiQ3D",
    modelUrl: "https://sketchfab.com/3d-models/future-city-1-1363540d0f934472ac556a6f8cb0bdf1",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    modified: true,
  },
};

const title = (slug: string) =>
  slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const commercial = (
  slug: string,
  category: AssetCategory,
  footprint: { w: number; h: number },
  placement: WorldAssetDefinition["placement"] = "building",
): WorldAssetDefinition => ({
  id: `city-commercial.${slug}`,
  label: title(slug),
  pack: "City Kit Commercial",
  category,
  url: `/assets/kenney/city-kit-commercial/${slug}.glb`,
  placement,
  objectType: placement === "object" ? "parasol" : undefined,
  defaultFootprint: footprint,
  defaultHeight: placement === "object" ? 1.45 : undefined,
  solidByDefault: placement === "building",
  editorReady: placement !== "attachment",
});

const nature = (
  slug: string,
  category: AssetCategory,
  objectType: ObjectType,
  footprint: { w: number; h: number },
  defaultHeight: number,
  solidByDefault: boolean,
): WorldAssetDefinition => ({
  id: `nature.${slug}`,
  label: title(slug),
  pack: "Nature Kit",
  category,
  url: `/assets/kenney/nature-kit/${slug}.glb`,
  placement: "object",
  objectType,
  defaultFootprint: footprint,
  defaultHeight,
  solidByDefault,
  editorReady: true,
});

const futureCity = (
  slug: string,
  label: string,
  category: AssetCategory,
  footprint: { w: number; h: number },
  placement: WorldAssetDefinition["placement"] = "building",
  options: {
    objectType?: ObjectType;
    defaultHeight?: number;
    solidByDefault?: boolean;
  } = {},
): WorldAssetDefinition => ({
  id: `future-city-1.${slug}`,
  label,
  pack: "Future City 1",
  category,
  url: `/assets/sketchfab/future-city-1/${slug}.glb`,
  placement,
  objectType: options.objectType,
  defaultFootprint: footprint,
  defaultHeight: options.defaultHeight,
  solidByDefault: options.solidByDefault ?? placement === "building",
  editorReady: true,
});

const regularBuildings = [
  "building-a", "building-b", "building-c", "building-d", "building-e", "building-f",
  "building-g", "building-h", "building-i", "building-j", "building-k", "building-l",
  "building-m", "building-n",
].map((slug) => commercial(slug, "building", { w: 8, h: 6 }));

const skyscrapers = [
  "building-skyscraper-a", "building-skyscraper-b", "building-skyscraper-c",
  "building-skyscraper-d", "building-skyscraper-e",
].map((slug) => commercial(slug, "skyscraper", { w: 7, h: 7 }));

const backgroundBuildings = [
  "low-detail-building-a", "low-detail-building-b", "low-detail-building-c",
  "low-detail-building-d", "low-detail-building-e", "low-detail-building-f",
  "low-detail-building-g", "low-detail-building-h", "low-detail-building-i",
  "low-detail-building-j", "low-detail-building-k", "low-detail-building-l",
  "low-detail-building-m", "low-detail-building-n", "low-detail-building-wide-a",
  "low-detail-building-wide-b",
].map((slug) =>
  commercial(
    slug,
    "background-building",
    slug.includes("wide") ? { w: 9, h: 4 } : { w: 5, h: 5 },
  ),
);

const commercialDetails = [
  commercial("detail-awning", "attachment", { w: 2, h: 1 }, "attachment"),
  commercial("detail-awning-wide", "attachment", { w: 3, h: 1 }, "attachment"),
  commercial("detail-overhang", "attachment", { w: 2, h: 1 }, "attachment"),
  commercial("detail-overhang-wide", "attachment", { w: 3, h: 1 }, "attachment"),
  commercial("detail-parasol-a", "street-furniture", { w: 1, h: 1 }, "object"),
  commercial("detail-parasol-b", "street-furniture", { w: 1, h: 1 }, "object"),
];

const treeSlugs = [
  "tree-blocks", "tree-blocks-dark", "tree-blocks-fall",
  "tree-cone", "tree-cone-dark", "tree-cone-fall",
  "tree-default", "tree-default-dark", "tree-default-fall",
  "tree-detailed", "tree-detailed-dark", "tree-detailed-fall",
  "tree-oak", "tree-oak-dark", "tree-oak-fall",
  "tree-palm", "tree-palm-bend", "tree-palm-detailed-short", "tree-palm-detailed-tall",
  "tree-pine-default-a", "tree-pine-default-b",
  "tree-pine-round-a", "tree-pine-round-b", "tree-pine-round-c",
  "tree-pine-small-a", "tree-pine-small-b", "tree-pine-small-c",
  "tree-pine-tall-a", "tree-pine-tall-b", "tree-pine-tall-c",
  "tree-simple", "tree-simple-dark", "tree-simple-fall",
  "tree-small", "tree-small-dark", "tree-small-fall",
  "tree-tall", "tree-tall-dark", "tree-tall-fall",
  "tree-thin", "tree-thin-dark", "tree-thin-fall",
];

const plantSlugs = [
  "flower-purple-a", "flower-purple-b", "flower-purple-c",
  "flower-red-a", "flower-red-b", "flower-red-c",
  "flower-yellow-a", "flower-yellow-b", "flower-yellow-c",
  "grass", "grass-large", "grass-leafs", "grass-leafs-large",
  "plant-bush", "plant-bush-detailed", "plant-bush-large",
  "plant-bush-large-triangle", "plant-bush-small", "plant-bush-triangle",
];

const rockSlugs = [
  "rock-large-a", "rock-large-b", "rock-large-c",
  "rock-small-a", "rock-small-b", "rock-small-c", "rock-small-d", "rock-small-e",
  "rock-small-f", "rock-tall-a", "rock-tall-b", "rock-tall-c",
];

const landmarkSlugs = [
  "log", "log-large", "log-stack", "log-stack-large",
  "pot-large", "pot-small", "sign", "statue-block", "statue-column", "statue-obelisk",
  "stump-old", "stump-round-detailed", "stump-square-detailed",
];

const fenceSlugs = [
  "fence-bend", "fence-corner", "fence-gate", "fence-planks", "fence-planks-double",
  "fence-simple", "fence-simple-high", "fence-simple-low",
];

const bridgeSlugs = ["bridge-stone", "bridge-stone-narrow", "bridge-wood", "bridge-wood-narrow"];

const futureCityAssets = [
  futureCity("building-1", "Future Building 1", "building", { w: 8, h: 8 }),
  futureCity("building-2", "Future Building 2", "skyscraper", { w: 7, h: 8 }),
  futureCity("building-3", "Future Building 3", "skyscraper", { w: 7, h: 8 }),
  futureCity("building-4", "Future Building 4", "building", { w: 9, h: 5 }),
  futureCity("building-5", "Future Building 5", "building", { w: 8, h: 8 }),
  futureCity("building-6", "Future Building 6", "skyscraper", { w: 8, h: 7 }),
  futureCity("building-7", "Future Building 7", "building", { w: 9, h: 5 }),
  futureCity("building-8", "Future Building 8", "skyscraper", { w: 3, h: 8 }),
  futureCity(
    "street-light",
    "Future Street Light",
    "street-furniture",
    { w: 1, h: 1 },
    "object",
    { objectType: "lamp", defaultHeight: 3, solidByDefault: true },
  ),
  futureCity(
    "tube-bridge",
    "Future Tube Bridge",
    "bridge",
    { w: 1, h: 8 },
    "object",
    { objectType: "bridge", defaultHeight: 1.2, solidByDefault: false },
  ),
];

export const WORLD_ASSETS: readonly WorldAssetDefinition[] = [
  ...regularBuildings,
  ...skyscrapers,
  ...backgroundBuildings,
  ...commercialDetails,
  ...treeSlugs.map((slug) => nature(slug, "tree", "tree", { w: 1, h: 1 }, 2.6, true)),
  ...plantSlugs.map((slug) =>
    nature(
      slug,
      "plant",
      slug.startsWith("plant-bush") ? "bush" : "grass",
      { w: 1, h: 1 },
      slug.startsWith("plant-bush") ? 0.85 : 0.35,
      false,
    ),
  ),
  ...rockSlugs.map((slug) => nature(slug, "rock", "rock", { w: 1, h: 1 }, 0.85, true)),
  ...landmarkSlugs.map((slug) =>
    nature(
      slug,
      "landmark",
      slug.startsWith("statue") ? "statue" : slug.startsWith("pot") ? "pot" : slug === "sign" ? "sign" : "log",
      { w: 1, h: 1 },
      slug.startsWith("statue") ? 1.8 : 1,
      slug.startsWith("statue") || slug.startsWith("log") || slug.startsWith("stump"),
    ),
  ),
  ...fenceSlugs.map((slug) => nature(slug, "fence", "fence", { w: 1, h: 1 }, 1, true)),
  ...bridgeSlugs.map((slug) => nature(slug, "bridge", "bridge", { w: 2, h: 1 }, 0.5, false)),
  ...futureCityAssets,
];

export const WORLD_ASSET_BY_ID: ReadonlyMap<string, WorldAssetDefinition> = new Map(
  WORLD_ASSETS.map((asset) => [asset.id, asset]),
);

export function getWorldAsset(id: string | undefined): WorldAssetDefinition | undefined {
  return id ? WORLD_ASSET_BY_ID.get(id) : undefined;
}
