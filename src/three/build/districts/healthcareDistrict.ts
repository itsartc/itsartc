import * as THREE from "three";
import type { Building } from "@/world/schema";
import { orientedBox } from "../geometry";
import { band, canopy, entranceReveal, facePanels, frame, glow, plinth, shadowed, glazing } from "./kit";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Healthcare District: a lantern.
 *
 * Quiet where its neighbours are loud. White render, deep-set windows in a
 * calm grid, a broad canopy over the arrival, and a top storey of translucent
 * panels that glows softly rather than advertising anything.
 *
 * The lantern is the whole gesture, and it is a restrained one on purpose:
 * this is the district people come to when something is wrong, and a building
 * that shouts would be the wrong building.
 */

const RENDER = 0xf1efe9;
const REVEAL = 0xd6d2c8;
const GLASS = 0x8fb3bd;
const LANTERN = "#d8f3ee";
const MINT = "#5ecfb4";

export const healthcareDistrict: DistrictSignature = {

  build(_building: Building, ctx: SignatureContext) {
    const f = frame(_building);
    if (!f) return;
    const { origin, yaw, halfWidth, depth, base, top, floorHeight } = f;
    const bay = 9.5;
    const bayTop = base + floorHeight * 2;
    const lanternBase = top - floorHeight;

    ctx.add(
      "healthcare-render",
      () => new THREE.MeshStandardMaterial({ color: RENDER, roughness: 0.92, metalness: 0.02 }),
      facePanels(f, { from: base, to: lanternBase, offset: 0.16, thickness: 0.28, openBay: { halfWidth: bay, height: bayTop } }),
    );

    // Deep window reveals, in a calm and completely regular grid. Every other
    // district downtown breaks its rhythm somewhere; this one does not.
    const reveals: THREE.BufferGeometry[] = [];
    const panes: THREE.BufferGeometry[] = [];
    for (let floor = 1; floor < f.floors - 1; floor++) {
      const y = base + floor * floorHeight + 1.7;
      for (let x = -halfWidth + 5; x <= halfWidth - 5; x += 6.2) {
        if (y < bayTop && Math.abs(x) < bay) continue;
        reveals.push(orientedBox(4.4, 2.5, 0.9, x, y, 0.5, origin, yaw));
        panes.push(orientedBox(3.6, 1.9, 0.2, x, y, 0.16, origin, yaw));
      }
      for (let z = -5; z >= -depth + 5; z -= 6.2) {
        for (const sx of [-1, 1]) {
          reveals.push(orientedBox(0.9, 2.5, 4.4, sx * (halfWidth + 0.5), y, z, origin, yaw));
          panes.push(orientedBox(0.2, 1.9, 3.6, sx * (halfWidth + 0.16), y, z, origin, yaw));
        }
      }
    }
    ctx.add("healthcare-reveal", () => new THREE.MeshStandardMaterial({ color: REVEAL, roughness: 0.88 }), reveals);
    ctx.add(
      "healthcare-glass",
      () => glazing(GLASS, { opacity: 0.85 }),
      panes,
    );

    // The lantern: the whole top storey, lit from within.
    ctx.add(
      "healthcare-lantern",
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x3a3a3a,
          emissive: new THREE.Color(LANTERN),
          // The largest emissive surface on any building here, so it takes the
          // lowest intensity of any: with bloom, area counts as much as level.
          emissiveIntensity: 0.42,
          roughness: 0.6,
        }),
      facePanels(f, { from: lanternBase, to: top - 0.6, offset: 0.3, thickness: 0.4 }),
      { bloom: true },
    );
    ctx.add(
      "healthcare-render",
      () => new THREE.MeshStandardMaterial({ color: RENDER, roughness: 0.92, metalness: 0.02 }),
      [...band(f, { y: top, height: 1.1, offset: 0.8, thickness: 1.2 }), ...band(f, { y: lanternBase - 0.4, height: 0.9, offset: 0.8, thickness: 1.2 })],
    );

    const arrival = canopy(f, { y: bayTop, height: 1.1, projection: 3.8, width: bay * 2 + 16 });
    ctx.add("healthcare-render", () => new THREE.MeshStandardMaterial({ color: RENDER, roughness: 0.92, metalness: 0.02 }), arrival.structure);
    ctx.add("healthcare-shade", () => shadowed(0x424b4c), [arrival.soffit, ...entranceReveal(f, { halfWidth: bay, height: bayTop })]);

    // Two slim columns, so the arrival canopy is carried rather than stuck on.
    ctx.add(
      "healthcare-reveal",
      () => new THREE.MeshStandardMaterial({ color: REVEAL, roughness: 0.88 }),
      [
        orientedBox(0.8, bayTop - base, 0.8, -bay - 3, (base + bayTop) / 2, 3.2, origin, yaw),
        orientedBox(0.8, bayTop - base, 0.8, bay + 3, (base + bayTop) / 2, 3.2, origin, yaw),
      ],
    );
    // Kept to the width of the opening. At the full 58m frontage this one bar
    // bloomed green over the whole building — area tells as much as level.
    ctx.add(
      "healthcare-light",
      () => glow(MINT, 0.9),
      [orientedBox(bay * 2 + 4, 0.18, 0.28, 0, bayTop - 0.3, 3.4, origin, yaw)],
      { bloom: true },
    );
    ctx.add("healthcare-stone", () => new THREE.MeshStandardMaterial({ color: 0xd2cec4, roughness: 0.9 }), plinth(f, ctx, { depth: 4, rise: 0.28 }));
  },
};
