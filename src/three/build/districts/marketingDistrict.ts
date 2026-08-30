import * as THREE from "three";
import type { Building } from "@/world/schema";
import { orientedBox, orientedYawBox } from "../geometry";
import { entranceReveal, facePanels, frame, glow, shadowed } from "./kit";
import { makeMarquee } from "../../materials/signTextures";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Marketing District: the building as a hoarding.
 *
 * A plain dark frame carrying boards of every size, hung at angles off a
 * scaffold. The architecture is deliberately worthless — nobody is meant to
 * look at it — and every surface worth seeing is rented. It is the loudest
 * building downtown and the only one where that is the intention.
 *
 * It is also the clearest statement of the sponsor model: strip the boards
 * off and there is a shed underneath.
 */

const FRAME_COLOUR = 0x2b2f36;
const SCAFFOLD = 0x8d949c;
const HOT = "#ff4d9d";
const COOL = "#41d6ff";

/** x, y, width, height, tilt in radians, and which colour it burns. */
type Board = readonly [x: number, y: number, w: number, h: number, tilt: number, hot: boolean];

const BOARDS: Board[] = [
  [-17, 15.5, 20, 7, 0.06, true],
  [10, 16.8, 15, 5.4, -0.1, false],
  [-21, 8.4, 11, 4.2, -0.14, false],
  [15, 8.9, 13, 4.8, 0.12, true],
  [1, 20.2, 12, 3.6, 0, false],
];

export const marketingDistrict: DistrictSignature = {

  build(building: Building, ctx: SignatureContext) {
    const f = frame(building);
    if (!f) return;
    const { origin, yaw, halfWidth, depth, base, top } = f;
    const bay = 7;
    const bayTop = base + f.floorHeight * 2;

    ctx.add(
      "marketing-frame",
      () => new THREE.MeshStandardMaterial({ color: FRAME_COLOUR, roughness: 0.85, metalness: 0.15 }),
      facePanels(f, { from: base, to: top, offset: 0.14, thickness: 0.24, openBay: { halfWidth: bay, height: bayTop } }),
    );

    // Scaffold: uprights and lifts, the thing the boards actually hang from.
    const scaffold: THREE.BufferGeometry[] = [];
    for (let x = -halfWidth + 3; x <= halfWidth - 3; x += 6.5) {
      scaffold.push(orientedBox(0.26, top - base, 0.26, x, (base + top) / 2, 1.05, origin, yaw));
    }
    for (let y = base + 4; y < top; y += 4.2) {
      scaffold.push(orientedBox(halfWidth * 2 - 4, 0.22, 0.22, 0, y, 1.05, origin, yaw));
    }
    scaffold.push(orientedBox(halfWidth * 2 - 2, 0.5, 2.6, 0, top + 1.4, 1.2, origin, yaw));
    ctx.add("marketing-scaffold", () => new THREE.MeshStandardMaterial({ color: SCAFFOLD, roughness: 0.6, metalness: 0.45 }), scaffold);

    const hot: THREE.BufferGeometry[] = [];
    const cool: THREE.BufferGeometry[] = [];
    const backs: THREE.BufferGeometry[] = [];
    for (const [x, y, w, h, tilt, isHot] of BOARDS) {
      if (y + h / 2 > top + 3) continue;
      const face = orientedYawBox(w, h, 0.22, x, y, 1.9, tilt, origin, yaw);
      (isHot ? hot : cool).push(face);
      backs.push(orientedYawBox(w + 0.5, h + 0.5, 0.3, x, y, 1.55, tilt, origin, yaw));
    }
    // A board on each flank, for the walk along the avenue.
    for (const sx of [-1, 1]) {
      cool.push(orientedYawBox(16, 5.5, 0.22, sx * (halfWidth + 1.5), top - 6, -depth * 0.35, sx * Math.PI / 2, origin, yaw));
      backs.push(orientedYawBox(16.6, 6.1, 0.3, sx * (halfWidth + 1.15), top - 6, -depth * 0.35, sx * Math.PI / 2, origin, yaw));
    }

    ctx.add("marketing-back", () => new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 }), backs);
    ctx.add("marketing-hot", () => glow(HOT, 0.85), hot, { bloom: true });
    ctx.add("marketing-cool", () => glow(COOL, 0.85), cool, { bloom: true });

    // One board carries actual copy, so the wall is not purely abstract.
    // Unsold, the board advertises itself. That is the honest state of this
    // building: strip the boards off and there is a shed underneath.
    const headline = makeMarquee(building.sponsor ?? "This Space", "now booking", "#ff4d9d");
    ctx.ownTexture(headline);
    ctx.add(
      "marketing-headline",
      () =>
        new THREE.MeshStandardMaterial({
          map: headline,
          color: 0x2a2a2a,
          emissive: 0xffffff,
          emissiveMap: headline,
          emissiveIntensity: 0.8,
          roughness: 0.5,
        }),
      orientedBox(18, 4.5, 0.3, 0, bayTop + 3.4, 2.1, origin, yaw),
      { bloom: true },
    );

    ctx.add("marketing-shade", () => shadowed(0x191c21), entranceReveal(f, { halfWidth: bay, height: bayTop }));
    ctx.add(
      "marketing-light",
      () => glow(COOL, 1.3),
      [
        orientedBox(0.18, bayTop - base, 0.22, -bay, (base + bayTop) / 2, 0.7, origin, yaw),
        orientedBox(0.18, bayTop - base, 0.22, bay, (base + bayTop) / 2, 0.7, origin, yaw),
        orientedBox(bay * 2, 0.18, 0.22, 0, bayTop, 0.7, origin, yaw),
      ],
      { bloom: true },
    );
  },
};
