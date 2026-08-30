import * as THREE from "three";
import type { Building } from "@/world/schema";
import { orientedBox } from "../geometry";
import { canopy, entranceReveal, frame, glow, shadowed } from "./kit";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Product District: shipped in modules.
 *
 * The building is visibly assembled rather than cast — boxes of several sizes
 * stacked, offset and cantilevered past the shell, with the joints left on
 * show. Two of them are painted in the district's own orange, so the stack
 * reads as versions rather than as a pattern.
 *
 * The modules are placed by hand rather than generated. A rule would produce
 * a rhythm, and a rhythm is exactly what this building must not have.
 */

const SHELL = 0xb9bcc0;
/** Three tones, so the stack reads as versions rather than as a pattern. */
const TONES = [0xdfe2e5, 0xd4783a, 0x55606b] as const;
const JOINT = 0x2a2f34;
const ACCENT = "#ff9b52";

/**
 * x, floor, width in metres, floors tall, and which tone it takes.
 *
 * Entered from the side, this block presents its 50m face, so x runs -25..25.
 * Nothing here straddles the entrance bay: a module that did was dropped
 * whole by the old placement rule, which is what left the frontage blank.
 */
type Module = readonly [x: number, floor: number, w: number, floors: number, tone: number];

const FRONT_MODULES: Module[] = [
  [-24, 0, 16, 2, 0],
  [8, 0, 16, 3, 1],
  [-24, 2, 11, 3, 2],
  [-13, 3, 13, 2, 1],
  [0, 2, 12, 2, 0],
  [12, 3, 12, 3, 0],
  [-8, 4, 14, 2, 1],
];

export const productDistrict: DistrictSignature = {

  build(_building: Building, ctx: SignatureContext) {
    const f = frame(_building);
    if (!f) return;
    const { origin, yaw, halfWidth, depth, base, top, floorHeight } = f;
    const bay = 7.5;
    const bayTop = base + floorHeight * 2;

    // The rack the modules plug into.
    ctx.add(
      "product-shell",
      () => new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.72, metalness: 0.2 }),
      [
        orientedBox(halfWidth * 2, top - base, 0.3, 0, (base + top) / 2, 0.14, origin, yaw),
        orientedBox(halfWidth * 2, top - base, 0.3, 0, (base + top) / 2, -depth - 0.14, origin, yaw),
        orientedBox(0.3, top - base, depth, -halfWidth - 0.14, (base + top) / 2, -depth / 2, origin, yaw),
        orientedBox(0.3, top - base, depth, halfWidth + 0.14, (base + top) / 2, -depth / 2, origin, yaw),
      ],
    );

    const byTone: THREE.BufferGeometry[][] = TONES.map(() => []);
    const joints: THREE.BufferGeometry[] = [];

    const place = (x: number, floor: number, w: number, floors: number, tone: number, z: number, faceDepth: number) => {
      const y = base + floor * floorHeight;
      const h = floors * floorHeight;
      const box = orientedBox(w, h - 0.3, faceDepth, x + w / 2, y + h / 2, z, origin, yaw);
      byTone[tone].push(box);
      // A dark reveal at every joint, so the stack reads as separate parts
      // rather than one lumpy wall.
      // Thick enough to read from across the street; a fine line vanished.
      joints.push(
        orientedBox(w + 0.5, 0.5, faceDepth + 0.14, x + w / 2, y, z, origin, yaw),
        orientedBox(0.5, h, faceDepth + 0.14, x, y + h / 2, z, origin, yaw),
        orientedBox(0.5, h, faceDepth + 0.14, x + w, y + h / 2, z, origin, yaw),
      );
    };

    for (const [x, floor, w, floors, tone] of FRONT_MODULES) {
      if (base + floor * floorHeight >= top) continue;
      const clipped = Math.min(floors, f.floors - floor);
      if (clipped > 0) place(x, floor, w, clipped, tone, 1.5, 2.6);
    }
    // The flanks get a quieter version of the same idea.
    for (const [z, sx, tone] of [[-12, -1, 0], [-30, 1, 2], [-40, -1, 1], [-50, 1, 0]] as const) {
      const h = floorHeight * 2;
      const y = base + floorHeight * (sx < 0 ? 1 : 3);
      byTone[tone].push(orientedBox(2.4, h - 0.3, 12, sx * (halfWidth + 1.2), y + h / 2, z, origin, yaw));
    }

    byTone.forEach((parts, i) => {
      ctx.add(`product-tone-${i}`, () => new THREE.MeshStandardMaterial({ color: TONES[i], roughness: 0.58, metalness: 0.28 }), parts);
    });
    ctx.add("product-joint", () => new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.8, metalness: 0.3 }), joints);

    // The entrance is a module pulled out to make a porch.
    const porch = canopy(f, { y: bayTop, height: 1.4, projection: 4, width: bay * 2 + 3 });
    ctx.add("product-tone-1", () => new THREE.MeshStandardMaterial({ color: TONES[1], roughness: 0.58, metalness: 0.28 }), porch.structure);
    ctx.add("product-shade", () => shadowed(0x24282c), [porch.soffit, ...entranceReveal(f, { halfWidth: bay, height: bayTop })]);
    ctx.add(
      "product-light",
      () => glow(ACCENT, 1.2),
      [orientedBox(bay * 2 + 1.6, 0.18, 0.28, 0, bayTop - 0.3, 3.6, origin, yaw)],
      { bloom: true },
    );
  },
};
