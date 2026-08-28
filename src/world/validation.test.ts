import { describe, expect, it } from "vitest";
import { townCentral } from "./townCentral";
import { cloneWorldMap, validateWorldMap } from "./validation";

describe("validateWorldMap", () => {
  it("accepts the committed Town Central map", () => {
    expect(validateWorldMap(townCentral)).toEqual([]);
  });

  it("rejects overlapping buildings before a draft can be published", () => {
    const draft = cloneWorldMap(townCentral);
    const afterHours = draft.buildings.find((building) => building.id === "b-after-hours")!;
    afterHours.x = 7;
    afterHours.y = 39;
    afterHours.entrance = { x: 7, y: 39 };

    expect(validateWorldMap(draft)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "building-overlap", entityId: "b-after-hours" }),
        expect.objectContaining({ code: "entrance-unreachable", entityId: "b-after-hours" }),
      ]),
    );
  });
});
