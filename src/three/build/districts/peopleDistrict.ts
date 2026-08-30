import * as THREE from "three";
import type { Building } from "@/world/schema";
import { orientedBox } from "../geometry";
import { band, canopy, entranceReveal, facePanels, frame, glow, plinth, shadowed , type Frame } from "./kit";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The People District: terraces and a welcome.
 *
 * The brief for a district about people is openness, so this building gives
 * its floor area away. Every third storey steps out into a planted terrace,
 * the entrance is a full-height glazed atrium behind a wide flight of steps,
 * and there is no dark glass anywhere on it.
 *
 * The steps are the design. This and the Finance exchange are the two
 * buildings you can stand *on* rather than merely beside, and standing
 * somewhere together is the entire product.
 */

const RENDER = 0xe7e3da;
const GLASS = 0x9fc4cf;
const SOIL = 0x4a3b30;
const LEAF = "#4ea36a";
const WARM = "#c9f2d4";

const ATRIUM_HALF_WIDTH = 10.5;

export const peopleDistrict: DistrictSignature = {

  build(_building: Building, ctx: SignatureContext) {
    const f = frame(_building);
    if (!f) return;
    const { origin, yaw, halfWidth, depth, base, top, floorHeight } = f;
    const atriumTop = base + floorHeight * 4;

    ctx.add(
      "people-render",
      () => new THREE.MeshStandardMaterial({ color: RENDER, roughness: 0.9, metalness: 0.02 }),
      facePanels(f, {
        from: base,
        to: top,
        offset: 0.16,
        thickness: 0.26,
        openBay: { halfWidth: ATRIUM_HALF_WIDTH, height: atriumTop },
      }),
    );

    // Pale glazing in a continuous ribbon under each floor line — this
    // building has nothing to hide behind.
    const glazing: THREE.BufferGeometry[] = [];
    for (let floor = 1; floor < f.floors; floor++) {
      glazing.push(...band(f, { y: base + floor * floorHeight - 1.1, height: 1.9, offset: 0.36, thickness: 0.3, inset: 2.6 }));
    }
    glazing.push(
      orientedBox(ATRIUM_HALF_WIDTH * 2, atriumTop - base - 4.4, 0.3, 0, (base + 4.4 + atriumTop) / 2, 0.36, origin, yaw),
    );
    ctx.add(
      "people-glass",
      () => new THREE.MeshStandardMaterial({ color: GLASS, roughness: 0.16, metalness: 0.28, transparent: true, opacity: 0.82 }),
      glazing,
    );

    buildTerraces(ctx, f);

    const arrival = canopy(f, { y: atriumTop, height: 1.2, projection: 4.6, width: halfWidth * 2 + 1.6 });
    ctx.add("people-render", () => new THREE.MeshStandardMaterial({ color: RENDER, roughness: 0.9, metalness: 0.02 }), arrival.structure);
    ctx.add("people-shade", () => shadowed(0x2b3330), [arrival.soffit, ...entranceReveal(f, { halfWidth: ATRIUM_HALF_WIDTH, height: atriumTop })]);
    ctx.add(
      "people-light",
      () => glow(WARM, 1.15),
      [orientedBox(halfWidth * 2 - 2, 0.2, 0.32, 0, atriumTop - 0.36, 4.2, origin, yaw)],
      { bloom: true },
    );

    // A broad, shallow flight — wide enough to be somewhere to sit.
    ctx.add(
      "people-stone",
      () => new THREE.MeshStandardMaterial({ color: 0xc9c2b6, roughness: 0.88 }),
      [
        ...plinth(f, ctx, { depth: 4.2, rise: 0.34 }),
        orientedBox(halfWidth * 2 - 14, 0.9, 1.4, 0, base + 0.45, -depth - 0.7, origin, yaw),
      ],
    );
  },
};

/** Planted terraces every third floor, on all four sides. */
function buildTerraces(ctx: SignatureContext, f: Frame) {
  const { origin, yaw, halfWidth, depth, base, floorHeight, floors } = f;
  const slabs: THREE.BufferGeometry[] = [];
  const beds: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];

  for (let floor = 3; floor < floors; floor += 3) {
    const y = base + floor * floorHeight;
    slabs.push(...band(f, { y, height: 0.6, offset: 2.4, thickness: 4.8 }));
    beds.push(...band(f, { y: y + 0.85, height: 1.1, offset: 4, thickness: 1.6 }));

    for (let x = -halfWidth + 4; x <= halfWidth - 4; x += 5) {
      for (const z of [4, -depth - 4]) leaves.push(blob(x, y + 1.75, z, origin, yaw));
    }
    for (let z = -4; z >= -depth + 4; z -= 5) {
      leaves.push(blob(-halfWidth - 4, y + 1.75, z, origin, yaw));
      leaves.push(blob(halfWidth + 4, y + 1.75, z, origin, yaw));
    }
  }

  ctx.add("people-render", () => new THREE.MeshStandardMaterial({ color: RENDER, roughness: 0.9, metalness: 0.02 }), slabs);
  ctx.add("people-soil", () => new THREE.MeshStandardMaterial({ color: SOIL, roughness: 0.95 }), beds);
  ctx.add(
    "people-leaf",
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(LEAF),
        roughness: 0.92,
        flatShading: true,
        // Foliage needs far less of this scene's bright sky than stone does,
        // or every planter washes out to pale mint.
        envMapIntensity: 0.25,
      }),
    leaves,
  );
}

function blob(x: number, y: number, z: number, origin: THREE.Vector3, yaw: number) {
  const geometry = new THREE.IcosahedronGeometry(1.15, 0);
  geometry.scale(1, 0.72, 1);
  geometry.translate(x, y, z);
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
  geometry.translate(origin.x, origin.y, origin.z);
  return geometry;
}
