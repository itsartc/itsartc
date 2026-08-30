import * as THREE from "three";
import type { Building } from "@/world/schema";
import { orientedBox } from "../geometry";
import { band, canopy, entranceReveal, facePanels, fins, frame, glow, shadowed } from "./kit";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Consulting District: a louvred box.
 *
 * One idea, executed exactly. Close-set vertical fins raked off the façade
 * make the building read as solid stone from the side and almost transparent
 * head-on, so it changes as you walk past it and never quite settles. That is
 * the whole design; everything else is deliberately restrained, because a
 * second gesture would spoil the first.
 */

const STONE = 0xd8d4cc;
const FIN = 0xb4b0a6;
const GLASS = 0x3d4a52;
const ACCENT = "#58a6ff";

export const consultingDistrict: DistrictSignature = {
  entranceSign() {
    return { width: 13, height: 1.9, y: 7.4, depth: 0.55 };
  },

  build(_building: Building, ctx: SignatureContext) {
    const f = frame(_building);
    if (!f) return;
    const { origin, yaw, halfWidth, depth, base, top } = f;
    const bay = 8.5;
    const bayTop = base + f.floorHeight * 1.7;

    ctx.add(
      "consulting-glass",
      () => new THREE.MeshStandardMaterial({ color: GLASS, roughness: 0.18, metalness: 0.5 }),
      facePanels(f, { from: base, to: top, offset: 0.14, thickness: 0.24, inset: 1.6, openBay: { halfWidth: bay, height: bayTop } }),
    );

    // The louvres. Raked a fixed 32 degrees, spaced tightly enough that the
    // gaps close up long before the façade is edge-on.
    ctx.add(
      "consulting-fin",
      () => new THREE.MeshStandardMaterial({ color: FIN, roughness: 0.66, metalness: 0.18 }),
      fins(f, { from: base + 0.4, to: top - 1.6, spacing: 2.15, width: 0.34, projection: 1.5, offset: 0.3, rake: 0.56, inset: 2.4 }),
    );

    // A crisp frame around the louvres, and a thin cornice.
    const stone: THREE.BufferGeometry[] = [
      ...band(f, { y: top - 0.7, height: 1.6, offset: 1.1, thickness: 1.5 }),
      ...band(f, { y: base + 0.2, height: 0.9, offset: 1.1, thickness: 1.5 }),
    ];
    for (const sx of [-1, 1]) {
      stone.push(
        orientedBox(2.2, top - base, 2.6, sx * halfWidth, (base + top) / 2, -0.4, origin, yaw),
        orientedBox(2.2, top - base, 2.6, sx * halfWidth, (base + top) / 2, -depth + 0.4, origin, yaw),
      );
    }
    const entry = canopy(f, { y: bayTop, height: 0.8, projection: 2.6, width: bay * 2 + 4 });
    stone.push(entry.structure);
    ctx.add("consulting-stone", () => new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.8, metalness: 0.04 }), stone);

    ctx.add("consulting-shade", () => shadowed(0x1e242a), [entry.soffit, ...entranceReveal(f, { halfWidth: bay, height: bayTop })]);
    ctx.add(
      "consulting-light",
      () => glow(ACCENT, 1.2),
      [orientedBox(bay * 2 + 3, 0.16, 0.26, 0, bayTop - 0.28, 2.35, origin, yaw)],
      { bloom: true },
    );
  },
};
