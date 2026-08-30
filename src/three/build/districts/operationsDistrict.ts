import * as THREE from "three";
import type { Building } from "@/world/schema";
import { orientedBox, orientedTiltedBox } from "../geometry";
import { entranceReveal, facePanels, frame, glow, shadowed, solidFrom , type Frame } from "./kit";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Operations District: turned inside out.
 *
 * Everything a building normally hides is on the outside — service risers in
 * their coded colours, an external stair, ducts and a gantry across the roof —
 * which leaves the interior as clear span. It is the one honest building
 * downtown: you can read how it works from the pavement.
 */

const SHELL = 0x9aa1a8;
const DUCT = 0x6f777e;
const STAIR = 0xf0b429;
const PIPES = ["#3b82f6", "#22c55e", "#ef4444", "#f0b429"] as const;

export const operationsDistrict: DistrictSignature = {
  entranceSign() {
    return { width: 12, height: 1.8, y: 7.6, depth: 0.5 };
  },

  build(_building: Building, ctx: SignatureContext) {
    const f = frame(_building);
    if (!f) return;
    const { origin, yaw, halfWidth, depth, base, top } = f;
    const bay = 7;
    const bayTop = base + f.floorHeight * 1.7;

    ctx.add(
      "operations-shell",
      () => new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.78, metalness: 0.28 }),
      facePanels(f, { from: base, to: top, offset: 0.14, thickness: 0.24, inset: 0.8, openBay: { halfWidth: bay, height: bayTop } }),
    );

    // Service risers, one colour per run, banded at each floor.
    const byColour = PIPES.map(() => [] as THREE.BufferGeometry[]);
    const collars: THREE.BufferGeometry[] = [];
    const xs = [-21, -13.5, 13.5, 21];
    xs.forEach((x, i) => {
      const radius = i % 2 === 0 ? 0.55 : 0.4;
      const pipe = new THREE.CylinderGeometry(radius, radius, top - base + 2.4, 10);
      pipe.translate(x, base + (top - base + 2.4) / 2, 1.3);
      pipe.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
      pipe.translate(origin.x, origin.y, origin.z);
      byColour[i].push(pipe);
      for (let y = base + 2.4; y < top; y += f.floorHeight) {
        collars.push(orientedBox(radius * 2.6, 0.34, radius * 2.6, x, y, 1.3, origin, yaw));
      }
    });
    byColour.forEach((parts, i) => {
      ctx.add(
        `operations-pipe-${i}`,
        () => new THREE.MeshStandardMaterial({ color: new THREE.Color(PIPES[i]), roughness: 0.5, metalness: 0.35 }),
        parts,
      );
    });
    ctx.add("operations-duct", () => new THREE.MeshStandardMaterial({ color: DUCT, roughness: 0.7, metalness: 0.5 }), collars);

    buildExternalStair(ctx, f);

    // Roof plant and a gantry rail across it.
    const plant: THREE.BufferGeometry[] = [
      orientedBox(halfWidth * 2 - 6, 0.5, 0.5, 0, top + 3.4, -depth * 0.3, origin, yaw),
      orientedBox(0.6, 3.4, 0.6, -halfWidth + 4, top + 1.7, -depth * 0.3, origin, yaw),
      orientedBox(0.6, 3.4, 0.6, halfWidth - 4, top + 1.7, -depth * 0.3, origin, yaw),
      orientedBox(9, 2.4, 7, -8, top + 1.2, -depth * 0.62, origin, yaw),
      orientedBox(6, 1.8, 5.5, 10, top + 0.9, -depth * 0.7, origin, yaw),
    ];
    for (let z = -depth * 0.2; z >= -depth * 0.85; z -= 6) {
      plant.push(orientedBox(halfWidth * 1.5, 0.9, 0.9, 0, top + 1.1, z, origin, yaw));
    }
    ctx.add("operations-duct", () => new THREE.MeshStandardMaterial({ color: DUCT, roughness: 0.7, metalness: 0.5 }), plant);

    ctx.add("operations-shade", () => shadowed(0x22262a), entranceReveal(f, { halfWidth: bay, height: bayTop }));
    ctx.add(
      "operations-light",
      () => glow("#f0b429", 1.15),
      [orientedBox(bay * 2 + 2, 0.2, 0.28, 0, bayTop + 0.4, 0.8, origin, yaw)],
      { bloom: true },
    );
  },
};

/** A switchback stair strapped to one flank, in safety yellow. */
function buildExternalStair(ctx: SignatureContext, f: Frame) {
  const { origin, yaw, halfWidth, depth, base, top, floorHeight } = f;
  const x = -halfWidth - 2.4;
  const parts: THREE.BufferGeometry[] = [];
  const zStart = -depth * 0.28;

  for (let floor = 0; base + floor * floorHeight < top - floorHeight; floor++) {
    const y = base + floor * floorHeight;
    const dir = floor % 2 === 0 ? 1 : -1;
    // A raked flight, plus the landing it arrives on.
    parts.push(
      orientedTiltedBox(3.4, 0.4, 5.6, x, y + floorHeight / 2, zStart - dir * 3.4, dir * 0.57, origin, yaw),
      orientedBox(3.4, 0.34, 3.2, x, y + floorHeight, zStart - dir * 6.9, origin, yaw),
      orientedBox(0.22, 1.1, 3.2, x - 1.6, y + floorHeight + 0.7, zStart - dir * 6.9, origin, yaw),
    );
  }
  parts.push(orientedBox(0.5, top - base, 0.5, x - 1.65, (base + top) / 2, zStart - 6.9, origin, yaw));
  parts.push(orientedBox(0.5, top - base, 0.5, x - 1.65, (base + top) / 2, zStart + 6.9, origin, yaw));

  const tower = orientedBox(4.2, top - base, 15, x, (base + top) / 2, zStart, origin, yaw);
  solidFrom(ctx, tower);
  tower.dispose();

  ctx.add("operations-stair", () => new THREE.MeshStandardMaterial({ color: STAIR, roughness: 0.62, metalness: 0.3 }), parts);
}
