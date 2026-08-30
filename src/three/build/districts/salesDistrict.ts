import * as THREE from "three";
import type { Building } from "@/world/schema";
import { orientedBox, orientedYawBox } from "../geometry";
import { band, entranceReveal, facePanels, frame, glow, shadowed , type Frame } from "./kit";
import { makeMarquee } from "../../materials/signTextures";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Sales District: a showroom.
 *
 * Angled display bays along the whole frontage, so the ground floor is a run
 * of lit windows you walk past rather than a wall you walk along. Above them
 * a chevron banding that all points the same way, and a board near the top
 * carrying a number.
 *
 * Every element leans forward. That is not subtle, and a sales district that
 * was subtle would be the wrong building.
 */

const SHELL = 0x33393f;
const CHEVRON = 0xf2cc60;
const BAY_FRAME = 0xe8e4dc;
const VITRINE = "#fff0c2";
const ACCENT = "#f2cc60";

export const salesDistrict: DistrictSignature = {

  build(building: Building, ctx: SignatureContext) {
    const f = frame(building);
    if (!f) return;
    const { origin, yaw, halfWidth, base, top, floorHeight } = f;
    const bay = 8;
    const showroomTop = base + floorHeight * 2.2;

    ctx.add(
      "sales-shell",
      () => new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.62, metalness: 0.35 }),
      facePanels(f, { from: base, to: top, offset: 0.14, thickness: 0.26, openBay: { halfWidth: bay, height: showroomTop } }),
    );

    // Chevrons: two raked bars per bay, meeting at a point, all leaning the
    // same way up the façade.
    const chevrons: THREE.BufferGeometry[] = [];
    for (let y = showroomTop + 3; y < top - 3; y += 5.4) {
      for (let x = -halfWidth + 4; x <= halfWidth - 4; x += 9) {
        chevrons.push(
          orientedYawBox(6.4, 0.7, 0.5, x - 2.1, y, 0.6, 0, origin, yaw),
          orientedBox(6.4, 0.7, 0.5, x + 2.1, y + 1.5, 0.6, origin, yaw),
        );
      }
    }
    ctx.add("sales-chevron", () => new THREE.MeshStandardMaterial({ color: CHEVRON, roughness: 0.55, metalness: 0.3 }), chevrons);

    buildDisplayBays(ctx, f, bay, showroomTop);

    // The board, high and central.
    const board = makeMarquee(building.sponsor ?? "Showroom", "always on", ACCENT);
    ctx.ownTexture(board);
    ctx.add(
      "sales-board",
      () =>
        new THREE.MeshStandardMaterial({
          map: board,
          color: 0x2a2a2a,
          emissive: 0xffffff,
          emissiveMap: board,
          emissiveIntensity: 0.85,
          roughness: 0.5,
        }),
      orientedBox(20, 5, 0.5, 0, top - 6, 1.4, origin, yaw),
      { bloom: true },
    );

    ctx.add(
      "sales-chevron",
      () => new THREE.MeshStandardMaterial({ color: CHEVRON, roughness: 0.55, metalness: 0.3 }),
      band(f, { y: top - 0.4, height: 1.3, offset: 0.9, thickness: 1.1 }),
    );
    ctx.add("sales-shade", () => shadowed(0x1c2024), entranceReveal(f, { halfWidth: bay, height: showroomTop }));
  },
};

/** Angled vitrines along the frontage, each turned to face the passer-by. */
function buildDisplayBays(ctx: SignatureContext, f: Frame, bay: number, showroomTop: number) {
  const { origin, yaw, halfWidth, depth, base } = f;
  const frames: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  const height = showroomTop - base - 0.8;
  const midY = base + 0.4 + height / 2;

  const bays: Array<[x: number, z: number, turn: number]> = [];
  for (let x = -halfWidth + 5; x <= halfWidth - 5; x += 7.5) {
    if (Math.abs(x) < bay + 2) continue;
    bays.push([x, 1.5, x < 0 ? 0.34 : -0.34]);
  }
  for (let z = -6; z >= -depth + 6; z -= 7.5) {
    bays.push([-halfWidth - 1.5, z, -Math.PI / 2 + 0.34]);
    bays.push([halfWidth + 1.5, z, Math.PI / 2 - 0.34]);
  }

  for (const [x, z, turn] of bays) {
    frames.push(orientedYawBox(6.4, height, 2.6, x, midY, z, turn, origin, yaw));
    lights.push(orientedYawBox(5.4, height - 1.2, 0.3, x, midY, z, turn, origin, yaw));
  }

  ctx.add("sales-bay", () => new THREE.MeshStandardMaterial({ color: BAY_FRAME, roughness: 0.6, metalness: 0.2 }), frames);
  ctx.add(
    "sales-vitrine",
    () => glow(VITRINE, 0.72),
    lights,
    { bloom: true },
  );
}
