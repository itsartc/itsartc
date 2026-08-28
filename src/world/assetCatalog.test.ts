import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORLD_ASSETS } from "./assetCatalog";

describe("WORLD_ASSETS", () => {
  it("catalogues the complete commercial pack and verified nature library", () => {
    expect(WORLD_ASSETS).toHaveLength(139);
    expect(new Set(WORLD_ASSETS.map((asset) => asset.id)).size).toBe(WORLD_ASSETS.length);
    expect(WORLD_ASSETS.filter((asset) => asset.pack === "City Kit Commercial")).toHaveLength(41);
    expect(WORLD_ASSETS.filter((asset) => asset.pack === "Nature Kit")).toHaveLength(98);
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
});
