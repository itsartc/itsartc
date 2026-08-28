import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORLD_ASSETS } from "./assetCatalog";

describe("WORLD_ASSETS", () => {
  it("catalogues the Kenney libraries and curated Future City assets", () => {
    expect(WORLD_ASSETS).toHaveLength(149);
    expect(new Set(WORLD_ASSETS.map((asset) => asset.id)).size).toBe(WORLD_ASSETS.length);
    expect(WORLD_ASSETS.filter((asset) => asset.pack === "City Kit Commercial")).toHaveLength(41);
    expect(WORLD_ASSETS.filter((asset) => asset.pack === "Nature Kit")).toHaveLength(98);
    expect(WORLD_ASSETS.filter((asset) => asset.pack === "Future City 1")).toHaveLength(10);
  });

  it("only exposes files that are actually present", () => {
    for (const asset of WORLD_ASSETS) {
      expect(existsSync(join(process.cwd(), "public", asset.url)), asset.id).toBe(true);
    }
  });

  it("keeps unsupported façade attachments disabled", () => {
    const disabled = WORLD_ASSETS.filter((asset) => !asset.editorReady);
    expect(disabled).toHaveLength(4);
    expect(disabled.every((asset) => asset.placement === "attachment")).toBe(true);
  });

  it("only exposes Future City outputs that pass the first browser budget", () => {
    const root = join(process.cwd(), "public", "assets", "sketchfab", "future-city-1");
    const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
      assets: { id: string; bytes: number; triangles: number }[];
      deferred: { id: string }[];
    };
    const catalogIds = WORLD_ASSETS
      .filter((asset) => asset.pack === "Future City 1")
      .map((asset) => asset.id)
      .sort();

    expect(catalogIds).toEqual(manifest.assets.map((asset) => `future-city-1.${asset.id}`).sort());
    expect(manifest.assets.every((asset) => asset.triangles < 100_000)).toBe(true);
    expect(manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0)).toBeLessThan(25 * 1024 * 1024);
    expect(manifest.deferred.map((asset) => asset.id).sort()).toEqual(["building-11", "park-bench"]);
    expect(existsSync(join(root, "future_city_1.glb"))).toBe(false);
    expect(existsSync(join(root, "ATTRIBUTION.md"))).toBe(true);
  });
});
