import * as THREE from "three";
import type { Building } from "@/world/schema";
import { orientedBox, orientedTiltedBox } from "../geometry";
import { band, entranceReveal, facePanels, frame, glow, shadowed , type Frame } from "./kit";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Creative District: a working warehouse.
 *
 * Sawtooth roof lights, brick below, and a wall given over to paint. The
 * sawtooth is the giveaway — it is the roof of a place where things are made,
 * and it is the only roofline downtown that is not a parapet or a crown.
 *
 * The mural is blocks of flat colour rather than a picture. A picture would
 * need an image, and the point of this city is that its surfaces are drawn
 * from data; blocks of colour can be reshuffled by changing an array.
 */

// Engineering brick, not the stock brick this started as: at 0x94705c it sat
// almost exactly on the Finance exchange's bronze, and the two share a
// diagonal across the park. The mural carries the colour here instead.
const BRICK = 0x646c76;
const FRAME_COLOUR = 0xe4e0d8;
const ROOF_GLASS = 0x8fb6c4;
const MURAL = [0xef5f8c, 0xf5b83d, 0x3fb6a8, 0x7c5cd6, 0xf07a3f] as const;

export const creativeDistrict: DistrictSignature = {

  build(_building: Building, ctx: SignatureContext) {
    const f = frame(_building);
    if (!f) return;
    const { origin, yaw, halfWidth, depth, base, top } = f;
    const bay = 7.5;
    const bayTop = base + f.floorHeight * 2;
    const brickTop = base + f.floorHeight * 3;

    ctx.add(
      "creative-brick",
      () => new THREE.MeshStandardMaterial({ color: BRICK, roughness: 0.95, metalness: 0.02 }),
      facePanels(f, { from: base, to: brickTop, offset: 0.16, thickness: 0.28, openBay: { halfWidth: bay, height: bayTop } }),
    );

    // Above the brick: a light steel frame with tall studio glazing.
    const frames: THREE.BufferGeometry[] = [
      ...band(f, { y: brickTop, height: 0.7, offset: 0.5, thickness: 0.7 }),
      ...band(f, { y: top - 0.5, height: 1, offset: 0.9, thickness: 1.1 }),
    ];
    for (let x = -halfWidth + 3; x <= halfWidth - 3; x += 4.4) {
      frames.push(orientedBox(0.42, top - brickTop, 0.6, x, (brickTop + top) / 2, 0.42, origin, yaw));
      frames.push(orientedBox(0.42, top - brickTop, 0.6, x, (brickTop + top) / 2, -depth - 0.42, origin, yaw));
    }
    ctx.add("creative-frame", () => new THREE.MeshStandardMaterial({ color: FRAME_COLOUR, roughness: 0.7, metalness: 0.2 }), frames);
    ctx.add(
      "creative-studio-glass",
      () => new THREE.MeshStandardMaterial({ color: ROOF_GLASS, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.8 }),
      facePanels(f, { from: brickTop + 0.5, to: top - 1, offset: 0.22, thickness: 0.24, inset: 2 }),
    );

    buildSawtooth(ctx, f);

    // The mural: flat blocks on the flank that faces the avenue.
    const blocks: THREE.BufferGeometry[][] = MURAL.map(() => []);
    const layout: Array<[z: number, y: number, w: number, h: number, colour: number]> = [
      [-8, 6, 12, 9, 0], [-20, 4.5, 9, 6, 1], [-20, 12, 9, 5, 2],
      [-31, 7, 11, 11, 3], [-42, 5.5, 8, 8, 4], [-42, 14.5, 8, 5, 0],
    ];
    for (const [z, y, w, h, colour] of layout) {
      if (y + h / 2 > brickTop) continue;
      blocks[colour].push(orientedBox(0.22, h, w, -halfWidth - 0.34, y, z, origin, yaw));
    }
    blocks.forEach((parts, i) => {
      if (parts.length === 0) return;
      ctx.add(`creative-mural-${i}`, () => new THREE.MeshStandardMaterial({ color: MURAL[i], roughness: 0.88 }), parts);
    });

    ctx.add("creative-shade", () => shadowed(0x241d1a), entranceReveal(f, { halfWidth: bay, height: bayTop }));
    ctx.add(
      "creative-light",
      () => glow("#f5b83d", 1.2),
      [orientedBox(bay * 2 + 2.4, 0.2, 0.3, 0, bayTop + 0.5, 0.75, origin, yaw)],
      { bloom: true },
    );
  },
};

/** North-light roof: a run of asymmetric ridges, glazed on one slope. */
function buildSawtooth(ctx: SignatureContext, f: Frame) {
  const { origin, yaw, halfWidth, depth, top } = f;
  const solids: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  const pitch = 7.5;
  const rise = 2.8;

  for (let z = -3; z > -depth + 3; z -= pitch) {
    // The long shallow slope, then the short steep face that carries glass.
    solids.push(orientedTiltedBox(halfWidth * 2 + 1.2, 0.45, pitch - 1.4, 0, top + 0.6 + rise / 2, z - pitch / 2 + 0.7, 0.38, origin, yaw));
    lights.push(orientedTiltedBox(halfWidth * 2 + 0.6, 0.3, rise + 0.4, 0, top + 0.6 + rise / 2, z, -0.18, origin, yaw));
  }

  ctx.add("creative-frame", () => new THREE.MeshStandardMaterial({ color: FRAME_COLOUR, roughness: 0.7, metalness: 0.2 }), solids);
  ctx.add(
    "creative-studio-glass",
    () => new THREE.MeshStandardMaterial({ color: ROOF_GLASS, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.8 }),
    lights,
  );
}
