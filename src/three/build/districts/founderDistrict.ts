import * as THREE from "three";
import type { Building } from "@/world/schema";
import { orientedBox } from "../geometry";
import { band, canopy, entranceReveal, facePanels, frame, glow, plinth, shadowed , type Frame } from "./kit";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Founder District: the garage that grew.
 *
 * Brick and exposed steel, an industrial opening wide enough to have driven a
 * van through, and a rooftop terrace under a pergola. It is the only building
 * downtown that looks *older* than the city around it, which is the point —
 * everyone else's district is where they work, and this one is where the
 * whole thing started.
 */

const BRICK = 0x8c4a3a;
const STEEL = 0x33373b;
const TIMBER = 0xb08348;
const LAMP = "#ffcf8a";

const BAY_HALF_WIDTH = 9;
const BAY_HEIGHT = 8.6;

export const founderDistrict: DistrictSignature = {

  build(_building: Building, ctx: SignatureContext) {
    const f = frame(_building);
    if (!f) return;
    const { origin, yaw, halfWidth, depth, base, top } = f;

    // Brickwork, left open across the entrance bay.
    ctx.add(
      "founder-brick",
      () => new THREE.MeshStandardMaterial({ color: BRICK, roughness: 0.94, metalness: 0.02 }),
      facePanels(f, {
        from: base,
        to: top,
        offset: 0.16,
        thickness: 0.26,
        inset: 1.4,
        openBay: { halfWidth: BAY_HALF_WIDTH, height: BAY_HEIGHT },
      }),
    );

    // Exposed steel: corner piers, a beam at every floor, and the bay frame.
    const steel: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      steel.push(orientedBox(2, top - base, 2, sx * halfWidth, (base + top) / 2, 0, origin, yaw));
      steel.push(orientedBox(2, top - base, 2, sx * halfWidth, (base + top) / 2, -depth, origin, yaw));
    }
    for (let floor = 1; floor < f.floors; floor++) {
      steel.push(...band(f, { y: base + floor * f.floorHeight, height: 0.42, offset: 0.44, thickness: 0.42, inset: 1.4 }));
    }
    steel.push(
      orientedBox(1.1, BAY_HEIGHT - base, 1.1, -BAY_HALF_WIDTH, (base + BAY_HEIGHT) / 2, 0.5, origin, yaw),
      orientedBox(1.1, BAY_HEIGHT - base, 1.1, BAY_HALF_WIDTH, (base + BAY_HEIGHT) / 2, 0.5, origin, yaw),
      orientedBox(BAY_HALF_WIDTH * 2 + 2.2, 1.2, 1.1, 0, BAY_HEIGHT + 0.6, 0.5, origin, yaw),
    );

    // Boxed-out oriel windows, at no rhythm in particular. A founder's building
    // is one that got extended whenever it had to be.
    for (const [x, floor] of [[-19, 3], [14, 2], [22, 4], [-8, 5]] as const) {
      if (floor >= f.floors) continue;
      const y = base + floor * f.floorHeight + 0.9;
      steel.push(orientedBox(5.4, 2.6, 1.5, x, y, 0.85, origin, yaw));
    }
    ctx.add("founder-steel", () => new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.66, metalness: 0.38 }), steel);

    const brow = canopy(f, { y: BAY_HEIGHT + 1.2, height: 0.7, projection: 3.4, width: BAY_HALF_WIDTH * 2 + 5 });
    ctx.add("founder-steel", () => new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.66, metalness: 0.38 }), brow.structure);
    ctx.add("founder-shade", () => shadowed(0x241a16), [brow.soffit, ...entranceReveal(f, { halfWidth: BAY_HALF_WIDTH, height: BAY_HEIGHT })]);

    ctx.add("founder-stone", () => new THREE.MeshStandardMaterial({ color: 0xb9ad9d, roughness: 0.88 }), plinth(f, ctx, { depth: 3.4, rise: 0.3 }));

    buildRoofTerrace(ctx, f);
  },
};

/** Posts, slats and strung lights over the roof — the meeting place. */
function buildRoofTerrace(ctx: SignatureContext, f: Frame) {
  const { origin, yaw, halfWidth, depth, top } = f;
  const deck = top + 0.95;
  const posts: THREE.BufferGeometry[] = [];
  const slats: THREE.BufferGeometry[] = [];
  const lamps: THREE.BufferGeometry[] = [];

  const spanX = halfWidth - 8;
  const spanZ = depth / 2 - 6;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      posts.push(orientedBox(0.4, 3.2, 0.4, sx * spanX, deck + 1.6, -depth / 2 + sz * spanZ, origin, yaw));
    }
  }
  for (let x = -spanX; x <= spanX; x += 2.2) {
    slats.push(orientedBox(0.28, 0.2, spanZ * 2, x, deck + 3.2, -depth / 2, origin, yaw));
  }
  slats.push(
    orientedBox(spanX * 2 + 0.6, 0.3, 0.3, 0, deck + 3.35, -depth / 2 - spanZ, origin, yaw),
    orientedBox(spanX * 2 + 0.6, 0.3, 0.3, 0, deck + 3.35, -depth / 2 + spanZ, origin, yaw),
  );
  for (let x = -spanX + 1.4; x <= spanX; x += 3.4) {
    for (const sz of [-1, 1]) {
      lamps.push(orientedBox(0.36, 0.36, 0.36, x, deck + 3.0, -depth / 2 + sz * spanZ, origin, yaw));
    }
  }

  ctx.add("founder-timber", () => new THREE.MeshStandardMaterial({ color: TIMBER, roughness: 0.86, metalness: 0.02 }), [...posts, ...slats]);
  ctx.add("founder-lamps", () => glow(LAMP, 1.3), lamps, { bloom: true });
}
