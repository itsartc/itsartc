import * as THREE from "three";
import type { Building } from "@/world/schema";
import { orientedBox } from "../geometry";
import { band, entranceReveal, facePanels, frame, glow, shadowed, solidFrom, glazing } from "./kit";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Legal District: a stone box that floats.
 *
 * The upper five storeys are a single windowless mass, incised with narrow
 * vertical slots, carried on a fully glazed ground floor so the weight has
 * nothing visible holding it up. An archive over an open room.
 *
 * It is the opposite move to the Finance exchange, which is the point: that
 * building is planted on the ground and this one refuses to touch it, and the
 * two would cancel out if both simply looked heavy.
 */

const STONE = 0x8d959c;
const INCISION = 0x4c545b;
const COLUMN = 0x5d666d;
const ACCENT = "#79c0ff";

export const legalDistrict: DistrictSignature = {

  build(_building: Building, ctx: SignatureContext) {
    const f = frame(_building);
    if (!f) return;
    const { origin, yaw, halfWidth, depth, base, top, floorHeight } = f;
    const liftHeight = floorHeight * 2;
    const massBase = base + liftHeight;

    // The mass: solid, oversailing the glazed floor beneath it on every side.
    ctx.add(
      "legal-stone",
      () => new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.84, metalness: 0.06 }),
      [
        ...facePanels(f, { from: massBase, to: top, offset: 1.3, thickness: 2.6 }),
        ...band(f, { y: massBase - 0.5, height: 1.5, offset: 1.6, thickness: 3.2 }),
        ...band(f, { y: top - 0.3, height: 1.2, offset: 1.6, thickness: 3.2 }),
      ],
    );

    // Narrow incisions, the only opening the mass admits.
    const slots: THREE.BufferGeometry[] = [];
    const slotTop = top - 2.4;
    const slotBase = massBase + 1.6;
    for (let x = -halfWidth + 4.5; x <= halfWidth - 4.5; x += 4.2) {
      slots.push(orientedBox(0.7, slotTop - slotBase, 0.5, x, (slotBase + slotTop) / 2, 2.4, origin, yaw));
      slots.push(orientedBox(0.7, slotTop - slotBase, 0.5, x, (slotBase + slotTop) / 2, -depth - 2.4, origin, yaw));
    }
    for (let z = -5; z >= -depth + 5; z -= 4.2) {
      slots.push(orientedBox(0.5, slotTop - slotBase, 0.7, -halfWidth - 2.4, (slotBase + slotTop) / 2, z, origin, yaw));
      slots.push(orientedBox(0.5, slotTop - slotBase, 0.7, halfWidth + 2.4, (slotBase + slotTop) / 2, z, origin, yaw));
    }
    ctx.add("legal-incision", () => shadowed(INCISION), slots);

    // The open floor: slim columns set well back, so the mass reads as
    // unsupported from anywhere but directly underneath.
    const columns: THREE.BufferGeometry[] = [];
    for (const x of [-halfWidth + 7, -8, 8, halfWidth - 7]) {
      for (const z of [-2.5, -depth + 2.5]) {
        const column = orientedBox(1.3, liftHeight, 1.3, x, base + liftHeight / 2, z, origin, yaw);
        columns.push(column);
        solidFrom(ctx, column);
      }
    }
    ctx.add("legal-column", () => new THREE.MeshStandardMaterial({ color: COLUMN, roughness: 0.7, metalness: 0.25 }), columns);

    ctx.add(
      "legal-glass",
      () => glazing(0x9fb8c4, { opacity: 0.5 }),
      facePanels(f, { from: base + 0.3, to: massBase - 1.4, offset: 0.2, thickness: 0.22, inset: 1, openBay: { halfWidth: 6.5, height: massBase - 1.4 } }),
    );

    ctx.add("legal-shade", () => shadowed(0x232a30), entranceReveal(f, { halfWidth: 6.5, height: massBase - 0.16 }));
    ctx.add(
      "legal-light",
      () => glow(ACCENT, 1.15),
      band(f, { y: massBase - 0.8, height: 0.2, offset: 1.5, thickness: 0.3 }),
      { bloom: true },
    );
  },
};
