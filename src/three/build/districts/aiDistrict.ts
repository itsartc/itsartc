import * as THREE from "three";
import type { Building } from "@/world/schema";
import { KERB_HEIGHT } from "@/world/schema";
import { addGeometryCollider, entranceSide, entranceYaw, orientedBox } from "../geometry";
import {
  makeCrownSign,
  makeDiagridTexture,
  makeTicker,
  makeVerticalBanner,
} from "../../materials/signTextures";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The AI District: a corporate tower in the mould of the supplied reference.
 *
 * The massing is two-part — the district's base volume reads as a podium, and a
 * slimmer tower rises from it, set back toward the rear so the podium's roof
 * stays visible from the street. Above the tower sits a dark signage crown and
 * a lattice mast.
 *
 * The signature decorates rather than replaces: the standard shell still
 * provides the hollow interior, the doorway opening and its collision, so the
 * building stays enterable and every fix made there applies here too.
 *
 * Almost all of the character comes from four drawn textures — a vertical LED
 * banner, a diagonal exoskeleton, a crown wordmark and an entrance ticker. That
 * is deliberate: they are the surfaces a sponsor buys, and drawing them means
 * re-skinning a tower is a change of two colours and a string.
 */

/** How far the tower's footprint insets from the podium, in metres. */
const TOWER_INSET_SIDE = 13;
const TOWER_INSET_FRONT = 20;

/** Tower height above the podium roof, and the crown and mast above that. */
const TOWER_HEIGHT = 46;
const CROWN_HEIGHT = 8.5;
const MAST_HEIGHT = 15;

const ACCENT = "#a371f7";
const BANNER_TOP = "#7c3aed";
const BANNER_BOTTOM = "#22d3ee";

export const aiDistrict: DistrictSignature = {
  build(building: Building, ctx: SignatureContext) {
    if (!building.entrance) return;

    const origin = new THREE.Vector3(building.entrance.x, 0, building.entrance.z);
    const yaw = entranceYaw(entranceSide(building));
    const podiumTop = KERB_HEIGHT + building.height;

    const halfW = building.w / 2;
    const depth = building.d;

    // In the building's own frame local +z points out of the entrance, so the
    // podium spans z from 0 (the entrance face) back to -depth.
    const towerW = building.w - TOWER_INSET_SIDE * 2;
    const towerD = depth - TOWER_INSET_FRONT - 6;
    const towerCentreZ = -TOWER_INSET_FRONT - towerD / 2;
    const towerTop = podiumTop + TOWER_HEIGHT;

    buildPodiumSkin(building, ctx, origin, yaw, halfW, depth, podiumTop);
    buildTower(ctx, origin, yaw, towerW, towerD, towerCentreZ, podiumTop, towerTop, building);
    buildCrown(building, ctx, origin, yaw, towerW, towerD, towerCentreZ, towerTop);
    buildMast(ctx, origin, yaw, towerCentreZ, towerTop + CROWN_HEIGHT);
    buildCurvedScreen(ctx, origin, yaw, halfW, depth, podiumTop);
    buildStreetEdge(building, ctx, origin, yaw, halfW);

    // One collider for the whole tower mass. The podium already has its own
    // from the standard shell.
    const half = new THREE.Vector3(towerW / 2, 0, towerD / 2);
    const centre = new THREE.Vector3(0, 0, towerCentreZ)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      .add(origin);
    ctx.solid(
      new THREE.Box3(
        new THREE.Vector3(centre.x - half.x, podiumTop, centre.z - half.z),
        new THREE.Vector3(centre.x + half.x, towerTop, centre.z + half.z),
      ),
    );
  },
};

/**
 * The podium: a pale structural frame, a diagrid exoskeleton on one flank, and
 * the vertical LED banner beside the entrance.
 */
function buildPodiumSkin(
  building: Building,
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  halfW: number,
  depth: number,
  podiumTop: number,
) {
  const h = building.height;
  const mid = KERB_HEIGHT + h / 2;

  // Structural frame: corner piers and a capping band, in pale concrete.
  const concrete = () =>
    new THREE.MeshStandardMaterial({ color: 0xc9ced2, roughness: 0.85, metalness: 0.02 });
  ctx.add("ai-frame", concrete, [
    orientedBox(2.4, h + 0.9, 0.7, -halfW + 1.2, mid, 0.26, origin, yaw),
    orientedBox(2.4, h + 0.9, 0.7, halfW - 1.2, mid, 0.26, origin, yaw),
    orientedBox(building.w + 0.5, 1.1, 0.9, 0, podiumTop + 0.3, 0.24, origin, yaw),
    // A deep cornice where the podium meets the tower, as in the reference.
    orientedBox(building.w + 1.2, 0.7, depth + 1.2, 0, podiumTop + 1.0, -depth / 2, origin, yaw),
  ]);

  // Diagonal exoskeleton across the right-hand flank of the entrance face.
  const diagrid = makeDiagridTexture("#b9bfc4", "#2b3a44");
  ctx.ownTexture(diagrid);
  diagrid.repeat.set(4, Math.max(2, Math.round(h / 7)));
  ctx.add(
    "ai-diagrid",
    () => new THREE.MeshStandardMaterial({ map: diagrid, roughness: 0.5, metalness: 0.35 }),
    orientedBox(halfW - 4, h - 1.2, 0.35, halfW / 2 + 1.4, mid, 0.42, origin, yaw),
  );

  // The LED banner: a tall emissive panel on the left of the entrance face.
  const banner = makeVerticalBanner(building.name, BANNER_TOP, BANNER_BOTTOM);
  ctx.ownTexture(banner);
  ctx.add(
    "ai-banner",
    () =>
      new THREE.MeshStandardMaterial({
        map: banner,
        // The panel is emissive, so its lit diffuse contribution is dimmed
        // right down. Left at full white it was counted twice — once as a lit
        // surface and once as a light source — and blew out to a white blob.
        color: 0x2a2a2a,
        emissive: 0xffffff,
        emissiveMap: banner,
        emissiveIntensity: 1.0,
        roughness: 0.45,
      }),
    orientedBox(6.4, h - 3.5, 0.3, -halfW + 6.4, mid + 0.6, 0.5, origin, yaw),
    { bloom: true },
  );
}

/** The set-back tower: dark glazing between graphite fin banks. */
function buildTower(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  towerW: number,
  towerD: number,
  centreZ: number,
  base: number,
  top: number,
  building: Building,
) {
  const height = top - base;
  const mid = base + height / 2;

  ctx.add(
    "ai-tower-glass",
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x2c3f52,
        roughness: 0.14,
        metalness: 0.55,
      }),
    orientedBox(towerW, height, towerD, 0, mid, centreZ, origin, yaw),
  );

  // Vertical fin banks, the tower's strongest vertical rhythm at distance.
  const fins: THREE.BufferGeometry[] = [];
  const spacing = 2.6;
  for (let x = -towerW / 2 + 1.6; x <= towerW / 2 - 1.6; x += spacing) {
    fins.push(orientedBox(0.35, height - 1, 0.5, x, mid, centreZ + towerD / 2 + 0.2, origin, yaw));
    fins.push(orientedBox(0.35, height - 1, 0.5, x, mid, centreZ - towerD / 2 - 0.2, origin, yaw));
  }
  for (let z = centreZ - towerD / 2 + 1.6; z <= centreZ + towerD / 2 - 1.6; z += spacing) {
    fins.push(orientedBox(0.5, height - 1, 0.35, -towerW / 2 - 0.2, mid, z, origin, yaw));
    fins.push(orientedBox(0.5, height - 1, 0.35, towerW / 2 + 0.2, mid, z, origin, yaw));
  }
  ctx.add(
    "ai-fins",
    () => new THREE.MeshStandardMaterial({ color: 0x252b31, roughness: 0.6, metalness: 0.4 }),
    fins,
  );

  // Floor bands, so the glazing reads as storeys rather than one dark slab.
  const bands: THREE.BufferGeometry[] = [];
  const floorHeight = building.height / building.floors;
  for (let y = base + floorHeight; y < top - 1; y += floorHeight) {
    bands.push(orientedBox(towerW + 0.1, 0.16, towerD + 0.1, 0, y, centreZ, origin, yaw));
  }
  ctx.add(
    "ai-tower-bands",
    () => new THREE.MeshStandardMaterial({ color: 0x8f9aa4, roughness: 0.7, metalness: 0.2 }),
    bands,
  );
}

/** A dark crown carrying the district wordmark on all four faces. */
function buildCrown(
  building: Building,
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  towerW: number,
  towerD: number,
  centreZ: number,
  towerTop: number,
) {
  const mid = towerTop + CROWN_HEIGHT / 2;

  ctx.add(
    "ai-crown",
    () => new THREE.MeshStandardMaterial({ color: 0x0d1116, roughness: 0.55, metalness: 0.3 }),
    orientedBox(towerW + 1.4, CROWN_HEIGHT, towerD + 1.4, 0, mid, centreZ, origin, yaw),
  );

  const sign = makeCrownSign(building.name, ACCENT);
  ctx.ownTexture(sign);
  const signMaterial = () =>
    new THREE.MeshStandardMaterial({
      map: sign,
      color: 0x2a2a2a,
      emissive: 0xffffff,
      emissiveMap: sign,
      emissiveIntensity: 1.15,
      roughness: 0.45,
    });

  const halfW = (towerW + 1.4) / 2;
  const halfD = (towerD + 1.4) / 2;
  // Only the two faces along the tower's long axis carry the wordmark. Signs
  // on all four met at the corners and read as clutter.
  ctx.add("ai-crown-sign", signMaterial, [
    orientedBox(towerW - 4, CROWN_HEIGHT * 0.46, 0.3, 0, mid, centreZ + halfD + 0.1, origin, yaw),
    orientedBox(towerW - 4, CROWN_HEIGHT * 0.46, 0.3, 0, mid, centreZ - halfD - 0.1, origin, yaw),
  ], { bloom: true });
}

/** A red-and-white lattice mast, the reference's tallest element. */
function buildMast(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  centreZ: number,
  base: number,
) {
  const white: THREE.BufferGeometry[] = [];
  const red: THREE.BufferGeometry[] = [];
  const segments = 8;
  const segment = MAST_HEIGHT / segments;

  for (let i = 0; i < segments; i++) {
    const y = base + segment * (i + 0.5);
    const taper = 1 - i / (segments * 1.5);
    const geo = orientedBox(1.5 * taper, segment * 0.92, 1.5 * taper, 0, y, centreZ, origin, yaw);
    (i % 2 === 0 ? red : white).push(geo);
  }
  // A slim finial above the lattice.
  white.push(orientedBox(0.24, 4, 0.24, 0, base + MAST_HEIGHT + 2, centreZ, origin, yaw));

  ctx.add(
    "ai-mast-red",
    () => new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.65 }),
    red,
  );
  ctx.add(
    "ai-mast-white",
    () => new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.6 }),
    white,
  );
}

/**
 * The curved screen that sweeps between podium and tower in the reference.
 *
 * A segmented arc rather than a flat panel: eight facets are enough to read as
 * a curve at street distance and cost almost nothing.
 */
function buildCurvedScreen(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  halfW: number,
  depth: number,
  podiumTop: number,
) {
  const facets = 8;
  const radius = 9;
  const height = 11;
  const centreX = -halfW + 11;
  const parts: THREE.BufferGeometry[] = [];

  for (let i = 0; i < facets; i++) {
    const t0 = (i / facets) * Math.PI * 0.62 - Math.PI * 0.31;
    const t1 = ((i + 1) / facets) * Math.PI * 0.62 - Math.PI * 0.31;
    const mx = centreX + ((Math.sin(t0) + Math.sin(t1)) / 2) * radius;
    const mz = 0.6 + ((Math.cos(t0) + Math.cos(t1)) / 2 - 1) * radius * 0.34;
    // Each facet leans back a little more toward the top of the arc.
    const width = (Math.abs(t1 - t0) * radius) / Math.cos(0.2);
    const geo = orientedBox(width, height, 0.4, mx, podiumTop - height / 2 - 1.2, mz, origin, yaw);
    parts.push(geo);
  }

  ctx.add(
    "ai-curved-screen",
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x123c4a,
        emissive: new THREE.Color(BANNER_BOTTOM),
        // The screen is the largest emissive surface on the building, so it
        // needs the lowest intensity of the lot: area counts as much as
        // brightness once bloom is spreading it.
        emissiveIntensity: 0.55,
        roughness: 0.3,
        metalness: 0.1,
      }),
    parts,
    { bloom: true },
  );
}

/** Ticker band and a neon sill along the street frontage. */
function buildStreetEdge(
  building: Building,
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  halfW: number,
) {
  const ticker = makeTicker(`${building.name} · open`, "#7dd3fc");
  ctx.ownTexture(ticker);
  ticker.repeat.set(3, 1);
  ctx.add(
    "ai-ticker",
    () =>
      new THREE.MeshStandardMaterial({
        map: ticker,
        color: 0x2a2a2a,
        emissive: 0xffffff,
        emissiveMap: ticker,
        emissiveIntensity: 1.1,
        roughness: 0.5,
      }),
    orientedBox(building.w - 6, 0.9, 0.25, 0, KERB_HEIGHT + 5.6, 0.55, origin, yaw),
    { bloom: true },
  );

  // A continuous neon sill at pavement level, the reference's brightest line.
  ctx.add(
    "ai-neon-sill",
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x35f0c0).multiplyScalar(1.6),
        toneMapped: false,
      }),
    [
      orientedBox(building.w - 2, 0.22, 0.22, 0, KERB_HEIGHT + 0.5, 0.62, origin, yaw),
      orientedBox(0.22, 0.22, building.d - 2, -halfW - 0.1, KERB_HEIGHT + 0.5, -building.d / 2, origin, yaw),
      orientedBox(0.22, 0.22, building.d - 2, halfW + 0.1, KERB_HEIGHT + 0.5, -building.d / 2, origin, yaw),
    ],
    { bloom: true },
  );
}
