import * as THREE from "three";
import type { Building } from "@/world/schema";
import { KERB_HEIGHT } from "@/world/schema";
import { entranceSide, entranceYaw, orientedBox, orientedTiltedBox, orientedYawBox, transformFromEntrance } from "../geometry";
import { makeVerticalBanner } from "../../materials/signTextures";
import { BLOOM_LAYER } from "../../postprocessing/SelectiveBloom";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Tech District.
 *
 * It keeps the height of the block it stands in — nine storeys, level with its
 * neighbours — and earns its identity from form and light rather than from
 * mass. An earlier version rose a tower above the podium, which read as a
 * different building dropped into the row; at this city's scale the skyline
 * wants to stay flat and one building wants to be *shaped* differently.
 *
 * The composition:
 *
 *  - **Rounded corners.** Four glazed drums swallow the shell's square corners,
 *    so the block reads as an extruded lozenge. Nothing else downtown is
 *    curved, which makes the silhouette recognisable from two blocks away.
 *  - **A ribbon curtain wall.** A thin band at every floor line, a deep one
 *    every third, over dark glazing. Horizontal rhythm against neighbours whose
 *    windows read as a grid.
 *  - **An exoskeleton.** A white chevron truss stands clear of the two flanks —
 *    real members, not a mapped lattice, so it casts and catches light and
 *    keeps its depth at any angle.
 *  - **A portal and brow.** A twenty-metre opening under a canopy that runs the
 *    full frontage, holding the doorway and the wordmark in one composition.
 *  - **A halo.** Two rings above the roofline, the inner one turning. It is the
 *    district's emblem and the one element that moves.
 *
 * The signature decorates rather than replaces: the standard shell still
 * provides the hollow interior, the doorway opening and its collision, so the
 * building stays enterable and every fix made there applies here too.
 */

/** Radius of the glazed corner drums, in metres. */
const DRUM_RADIUS = 4.2;
const DRUM_SEGMENTS = 18;
/** How far the flat façades stop short of a corner, leaving the drum to it. */
const CORNER_CLEARANCE = 3.4;

/** The dark glazing sits just off the shell wall; bands stand proud of it. */
const SKIN_OFFSET = 0.16;
const SKIN_THICKNESS = 0.24;

/** The entrance opening, and the canopy immediately above it. */
const PORTAL_HALF_WIDTH = 10;
const PORTAL_HEIGHT = 11;
const PIER_WIDTH = 1.8;
const CANOPY_TOP = 13.5;
const CANOPY_PROJECTION = 3;

/** The exoskeleton, and the crown band it runs into. */
const TRUSS_BASE = 11.6;
const TRUSS_MID = 21;
const TRUSS_TOP = 30.4;
const TRUSS_BAYS = 4;
const TRUSS_OFFSET = 1.15;

/** The halo, measured above the parapet. */
const HALO_RADIUS = 9;
const HALO_RISE = 3;

const GLASS = 0x1b2733;
const FRAME = 0xd6dbdf;
const STRUCT = 0x39424b;
const ACCENT = "#a371f7";
const CYAN = "#22d3ee";

export const techDistrict: DistrictSignature = {

  build(building: Building, ctx: SignatureContext) {
    if (!building.entrance) return;

    const origin = new THREE.Vector3(building.entrance.x, 0, building.entrance.z);
    const yaw = entranceYaw(entranceSide(building));

    // In the building's own frame local +z points out of the entrance, so the
    // volume spans z from 0 (the entrance face) back to -depth.
    const shape: Shape = {
      halfWidth: building.w / 2,
      depth: building.d,
      base: KERB_HEIGHT,
      top: KERB_HEIGHT + building.height,
      floorHeight: building.height / building.floors,
      floors: building.floors,
      flatHalfWidth: building.w / 2 - CORNER_CLEARANCE,
      flatHalfDepth: building.d / 2 - CORNER_CLEARANCE,
    };

    buildCornerDrums(ctx, origin, yaw, shape);
    buildGlazing(ctx, origin, yaw, shape);
    buildRibbons(ctx, origin, yaw, shape);
    buildPortal(ctx, origin, yaw, shape);
    buildExoskeleton(ctx, origin, yaw, shape);
    buildBanner(building, ctx, origin, yaw, shape);
    buildOculus(ctx, origin, yaw, shape.flatHalfWidth);
    buildCrown(ctx, origin, yaw, shape);
    buildHalo(ctx, origin, yaw, shape);
  },
};

interface Shape {
  halfWidth: number;
  depth: number;
  base: number;
  top: number;
  floorHeight: number;
  floors: number;
  /** Where a flat façade stops, leaving the corner drum to close it. */
  flatHalfWidth: number;
  flatHalfDepth: number;
}

/** The four corner positions, in the building's own frame. */
function corners(shape: Shape): Array<{ x: number; z: number; outward: number }> {
  const out: Array<{ x: number; z: number; outward: number }> = [];
  for (const sx of [-1, 1]) {
    for (const front of [true, false]) {
      out.push({
        x: sx * shape.halfWidth,
        z: front ? 0 : -shape.depth,
        // Yaw of the outward diagonal, for anything that must face away from
        // the building at a corner.
        outward: Math.atan2(sx, front ? 1 : -1),
      });
    }
  }
  return out;
}

/** A horizontal ring wrapped around a corner drum, matching a façade band. */
function drumRing(
  radius: number,
  height: number,
  y: number,
  corner: { x: number; z: number },
  origin: THREE.Vector3,
  yaw: number,
): THREE.BufferGeometry {
  // Open-ended: only the outside is ever seen, and the caps would be two more
  // fans per band across thirty-odd bands.
  const geometry = new THREE.CylinderGeometry(radius, radius, height, DRUM_SEGMENTS, 1, true);
  geometry.translate(corner.x, y, corner.z);
  transformFromEntrance(geometry, origin, yaw);
  return geometry;
}

/**
 * Glazed drums at the four corners.
 *
 * They are what makes the plan read as rounded. The shell's square corner sits
 * entirely inside each drum, so nothing has to be cut away — the drum simply
 * hides it, which is why this works as decoration over the standard shell.
 */
function buildCornerDrums(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  shape: Shape,
) {
  const drumTop = shape.top + 0.9;
  const height = drumTop - (shape.base - 0.4);
  const shells: THREE.BufferGeometry[] = [];
  const caps: THREE.BufferGeometry[] = [];
  const seams: THREE.BufferGeometry[] = [];

  for (const corner of corners(shape)) {
    // Started below the pavement, so the bottom cap is buried rather than
    // sharing a plane with the pavement slab.
    const drum = new THREE.CylinderGeometry(DRUM_RADIUS, DRUM_RADIUS, height, DRUM_SEGMENTS);
    drum.translate(corner.x, shape.base - 0.4 + height / 2, corner.z);
    transformFromEntrance(drum, origin, yaw);
    shells.push(drum);

    const cap = new THREE.CylinderGeometry(DRUM_RADIUS + 0.5, DRUM_RADIUS + 0.5, 0.6, DRUM_SEGMENTS);
    cap.translate(corner.x, drumTop + 0.3, corner.z);
    transformFromEntrance(cap, origin, yaw);
    caps.push(cap);

    // A light seam down the outward face of each drum. Four vertical lines at
    // the corners are what give the building an outline after dark.
    const reach = (DRUM_RADIUS + 0.12) / Math.SQRT2;
    const sx = Math.sign(corner.x);
    const sz = corner.z === 0 ? 1 : -1;
    seams.push(
      orientedYawBox(
        0.34,
        shape.top - shape.base - 1.2,
        0.26,
        corner.x + sx * reach,
        (shape.base + shape.top) / 2,
        corner.z + sz * reach,
        corner.outward,
        origin,
        yaw,
      ),
    );

    // One box collider per drum, inscribed rather than circumscribed: a square
    // the width of the drum would block the pavement corner beside it.
    const centre = new THREE.Vector3(corner.x, 0, corner.z)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      .add(origin);
    ctx.solid(
      new THREE.Box3(
        new THREE.Vector3(centre.x - 3, shape.base, centre.z - 3),
        new THREE.Vector3(centre.x + 3, shape.top, centre.z + 3),
      ),
    );
  }

  ctx.add("tech-glass", glassMaterial, shells);
  ctx.add("tech-frame", frameMaterial, caps);
  ctx.add(
    "tech-seam",
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(CYAN).multiplyScalar(1.35),
        toneMapped: false,
      }),
    seams,
    { bloom: true },
  );
}

const glassMaterial = () =>
  new THREE.MeshStandardMaterial({ color: GLASS, roughness: 0.13, metalness: 0.62 });

const frameMaterial = () =>
  new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.72, metalness: 0.06 });

/**
 * Dark glazing over the four flat façades.
 *
 * The block's neighbours use the shared pale glass; laying a darker skin over
 * the shell is what separates this building from them at a glance, and it costs
 * six boxes.
 */
function buildGlazing(ctx: SignatureContext, origin: THREE.Vector3, yaw: number, shape: Shape) {
  const { flatHalfWidth, flatHalfDepth, halfWidth, depth, base, top } = shape;
  const height = top - base;
  const midY = base + height / 2;
  const pierEdge = PORTAL_HALF_WIDTH + PIER_WIDTH * 0.5;
  const flankWidth = flatHalfWidth - pierEdge;
  const flankCentre = (flatHalfWidth + pierEdge) / 2;
  const aboveBase = CANOPY_TOP + 0.4;

  ctx.add("tech-glass", glassMaterial, [
    // Entrance face, split around the portal and closed above the canopy.
    orientedBox(flankWidth, height, SKIN_THICKNESS, -flankCentre, midY, SKIN_OFFSET, origin, yaw),
    orientedBox(flankWidth, height, SKIN_THICKNESS, flankCentre, midY, SKIN_OFFSET, origin, yaw),
    orientedBox(
      pierEdge * 2,
      top - aboveBase,
      SKIN_THICKNESS,
      0,
      (aboveBase + top) / 2,
      SKIN_OFFSET,
      origin,
      yaw,
    ),
    // Rear.
    orientedBox(
      flatHalfWidth * 2,
      height,
      SKIN_THICKNESS,
      0,
      midY,
      -depth - SKIN_OFFSET,
      origin,
      yaw,
    ),
    // Flanks.
    orientedBox(
      SKIN_THICKNESS,
      height,
      flatHalfDepth * 2,
      -halfWidth - SKIN_OFFSET,
      midY,
      -depth / 2,
      origin,
      yaw,
    ),
    orientedBox(
      SKIN_THICKNESS,
      height,
      flatHalfDepth * 2,
      halfWidth + SKIN_OFFSET,
      midY,
      -depth / 2,
      origin,
      yaw,
    ),
  ]);
}

/**
 * A band at every floor line, deeper every third.
 *
 * The hierarchy is what stops nine identical lines reading as corduroy: the
 * eye picks up three storeys at a time from across the park, and the finer
 * rhythm only at street distance.
 */
function buildRibbons(ctx: SignatureContext, origin: THREE.Vector3, yaw: number, shape: Shape) {
  const { flatHalfWidth, flatHalfDepth, halfWidth, depth, base, floors, floorHeight } = shape;
  const parts: THREE.BufferGeometry[] = [];
  const pierEdge = PORTAL_HALF_WIDTH + PIER_WIDTH * 0.5;

  for (let floor = 1; floor < floors; floor++) {
    const y = base + floor * floorHeight;
    const deep = floor % 3 === 0;
    const bandHeight = deep ? 0.72 : 0.34;
    const offset = deep ? 0.62 : 0.34;
    const thickness = deep ? 0.7 : 0.34;

    // Entrance face: below the canopy the band has to step around the portal.
    if (y < PORTAL_HEIGHT) {
      const flank = flatHalfWidth - pierEdge;
      const centre = (flatHalfWidth + pierEdge) / 2;
      parts.push(
        orientedBox(flank, bandHeight, thickness, -centre, y, offset, origin, yaw),
        orientedBox(flank, bandHeight, thickness, centre, y, offset, origin, yaw),
      );
    } else {
      parts.push(
        orientedBox(flatHalfWidth * 2, bandHeight, thickness, 0, y, offset, origin, yaw),
      );
    }

    parts.push(
      orientedBox(flatHalfWidth * 2, bandHeight, thickness, 0, y, -depth - offset, origin, yaw),
      orientedBox(
        thickness,
        bandHeight,
        flatHalfDepth * 2,
        -halfWidth - offset,
        y,
        -depth / 2,
        origin,
        yaw,
      ),
      orientedBox(
        thickness,
        bandHeight,
        flatHalfDepth * 2,
        halfWidth + offset,
        y,
        -depth / 2,
        origin,
        yaw,
      ),
    );

    for (const corner of corners(shape)) {
      parts.push(drumRing(DRUM_RADIUS + offset, bandHeight, y, corner, origin, yaw));
    }
  }

  ctx.add("tech-frame", frameMaterial, parts);
}

/**
 * The entrance: a twenty-metre opening between deep piers, under a canopy that
 * runs the whole frontage.
 *
 * The canopy is the building's strongest horizontal and does the work the old
 * tower's set-back used to do — it gives the façade a top edge and puts the
 * doorway in shadow, so the entrance reads as an entrance from across the park.
 */
function buildPortal(ctx: SignatureContext, origin: THREE.Vector3, yaw: number, shape: Shape) {
  const { flatHalfWidth, base } = shape;
  const pierCentre = PORTAL_HALF_WIDTH + PIER_WIDTH / 2;
  const pierTop = PORTAL_HEIGHT + 1.4;
  const canopyHeight = CANOPY_TOP - pierTop;
  const canopyMid = (pierTop + CANOPY_TOP) / 2;

  const structure: THREE.BufferGeometry[] = [
    orientedBox(PIER_WIDTH, pierTop - base, 1.7, -pierCentre, (base + pierTop) / 2, 0.85, origin, yaw),
    orientedBox(PIER_WIDTH, pierTop - base, 1.7, pierCentre, (base + pierTop) / 2, 0.85, origin, yaw),
    orientedBox(
      flatHalfWidth * 2,
      canopyHeight,
      CANOPY_PROJECTION,
      0,
      canopyMid,
      CANOPY_PROJECTION / 2,
      origin,
      yaw,
    ),
  ];

  // The canopy carries on around the two front drums, so it reads as a
  // continuous brow rather than a plank stuck to one face.
  for (const corner of corners(shape).filter((c) => c.z === 0)) {
    structure.push(
      drumRing(DRUM_RADIUS + CANOPY_PROJECTION * 0.55, canopyHeight, canopyMid, corner, origin, yaw),
    );
  }
  ctx.add("tech-frame", frameMaterial, structure);

  // Nothing in this scene casts shadows, so a projecting canopy has no shade
  // under it and flattens into just another band. A dark soffit plate supplies
  // the shadow the light cannot, which is what makes the brow read as depth.
  ctx.add(
    "tech-soffit",
    () => new THREE.MeshStandardMaterial({ color: 0x1d232a, roughness: 0.85 }),
    orientedBox(
      flatHalfWidth * 2 - 0.4,
      0.22,
      CANOPY_PROJECTION - 0.3,
      0,
      pierTop - 0.12,
      CANOPY_PROJECTION / 2,
      origin,
      yaw,
    ),
  );

  // Inside the opening the shared shell wall shows through, in the pale glass
  // every other building uses — which made the entrance look borrowed from the
  // block next door. A dark reveal, split around the doorway exactly as the
  // shell splits its wall, carries the district's palette into the recess.
  const doorHalf = 2.6;
  const doorHead = 3.75;
  ctx.add(
    "tech-reveal",
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x161d25,
        roughness: 0.78,
        metalness: 0.05,
        // The scene's image-based lighting is bright enough to wash a recess
        // back to pale grey, which is the very thing this panel exists to fix.
        envMapIntensity: 0.35,
      }),
    [
      orientedBox(
        PORTAL_HALF_WIDTH - doorHalf,
        PORTAL_HEIGHT - base,
        0.14,
        -(PORTAL_HALF_WIDTH + doorHalf) / 2,
        (base + PORTAL_HEIGHT) / 2,
        0.09,
        origin,
        yaw,
      ),
      orientedBox(
        PORTAL_HALF_WIDTH - doorHalf,
        PORTAL_HEIGHT - base,
        0.14,
        (PORTAL_HALF_WIDTH + doorHalf) / 2,
        (base + PORTAL_HEIGHT) / 2,
        0.09,
        origin,
        yaw,
      ),
      orientedBox(
        doorHalf * 2,
        PORTAL_HEIGHT - doorHead,
        0.14,
        0,
        (doorHead + PORTAL_HEIGHT) / 2,
        0.09,
        origin,
        yaw,
      ),
    ],
  );

  ctx.add(
    "tech-portal-light",
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(CYAN).multiplyScalar(1.3),
        toneMapped: false,
      }),
    [
      // A lit reveal around the opening.
      orientedBox(0.2, PORTAL_HEIGHT - base, 0.24, -PORTAL_HALF_WIDTH, (base + PORTAL_HEIGHT) / 2, 0.74, origin, yaw),
      orientedBox(0.2, PORTAL_HEIGHT - base, 0.24, PORTAL_HALF_WIDTH, (base + PORTAL_HEIGHT) / 2, 0.74, origin, yaw),
      orientedBox(PORTAL_HALF_WIDTH * 2, 0.2, 0.24, 0, PORTAL_HEIGHT, 0.74, origin, yaw),
      // A line along the canopy's leading edge, which is what lights the
      // pavement below it after dark.
      orientedBox(
        flatHalfWidth * 2 - 1,
        0.18,
        0.3,
        0,
        pierTop + 0.14,
        CANOPY_PROJECTION - 0.35,
        origin,
        yaw,
      ),
    ],
    { bloom: true },
  );
}

/**
 * A chevron truss standing clear of both flanks.
 *
 * Built from real members rather than a diagrid texture. A mapped lattice is
 * cheaper and was what the previous design used, but it flattens the moment the
 * camera passes it — and the flanks are exactly what the player sees walking
 * the avenue. Forty boxes is a fair price for depth that survives the angle.
 */
function buildExoskeleton(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  shape: Shape,
) {
  const { halfWidth, depth, flatHalfDepth } = shape;
  const parts: THREE.BufferGeometry[] = [];
  const span = flatHalfDepth * 2 - 2.2;
  const bay = span / TRUSS_BAYS;
  const half = bay / 2;
  const start = -depth / 2 - span / 2;
  const thickness = 0.6;

  for (const sx of [-1, 1]) {
    const x = sx * (halfWidth + TRUSS_OFFSET);

    for (const [low, high] of [
      [TRUSS_BASE, TRUSS_MID],
      [TRUSS_MID, TRUSS_TOP],
    ]) {
      const rise = high - low;
      const length = Math.hypot(half, rise);
      const lean = Math.atan2(half, rise);
      const midY = (low + high) / 2;

      for (let i = 0; i < TRUSS_BAYS; i++) {
        const apex = start + bay * i + half;
        // Rotating a box about local X leans it in the y–z plane, which is the
        // plane of a flank. The two halves of each chevron lean opposite ways.
        parts.push(
          orientedTiltedBox(thickness, length, thickness, x, midY, apex - half / 2, lean, origin, yaw),
          orientedTiltedBox(thickness, length, thickness, x, midY, apex + half / 2, -lean, origin, yaw),
        );
      }
    }

    for (const y of [TRUSS_BASE, TRUSS_MID, TRUSS_TOP]) {
      parts.push(orientedBox(thickness, thickness, span, x, y, -depth / 2, origin, yaw));
    }
  }

  ctx.add(
    "tech-truss",
    () => new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.6, metalness: 0.18 }),
    parts,
  );
}

/**
 * The vertical LED banner.
 *
 * Hung clear of the façade rather than flush with it, so the floor bands pass
 * behind it instead of cutting it into nine pieces. This is the surface a
 * sponsor buys: its content is the building's own name, drawn at build time.
 */
function buildBanner(
  building: Building,
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  shape: Shape,
) {
  // The sponsor's name, not the district's — the plaque over the doors carries
  // that, and one building saying its own name twice reads as a mistake. Unsold
  // (which is all of them, for now) the panel is emblem and gradient alone.
  const banner = makeVerticalBanner(building.sponsor ?? "", "#7c3aed", CYAN);
  ctx.ownTexture(banner);

  const top = TRUSS_TOP - 0.4;
  const bottom = CANOPY_TOP + 0.6;
  const x = -shape.flatHalfWidth + 5.6;

  ctx.add(
    "tech-banner",
    () =>
      new THREE.MeshStandardMaterial({
        map: banner,
        // The panel is emissive, so its lit diffuse contribution is dimmed
        // right down. Left at full white it was counted twice — once as a lit
        // surface and once as a light source — and blew out to a white blob.
        color: 0x2a2a2a,
        emissive: 0xffffff,
        emissiveMap: banner,
        // Bloom spreads in proportion to area as well as brightness, and at 1.0
        // this panel — sixteen metres of it — smeared into a bright blur that
        // lost the lettering entirely. Dimmer reads brighter here.
        emissiveIntensity: 0.62,
        roughness: 0.45,
      }),
    orientedBox(7.2, top - bottom, 0.4, x, (top + bottom) / 2, 1.15, origin, yaw),
    { bloom: true },
  );

  // Two brackets, so the panel reads as hung rather than floating.
  ctx.add(
    "tech-bracket",
    () => new THREE.MeshStandardMaterial({ color: STRUCT, roughness: 0.6, metalness: 0.3 }),
    [
      orientedBox(0.3, 0.3, 1, x - 2.2, top - 1.2, 0.6, origin, yaw),
      orientedBox(0.3, 0.3, 1, x + 2.2, bottom + 1.2, 0.6, origin, yaw),
    ],
  );
}

/**
 * A lit ring on the upper frontage, echoing the halo above the roof.
 *
 * The façade needed one vertical event: banded glazing between two drums is
 * calm to the point of blankness in the middle, and the entrance composition
 * all happens in the lowest third. Hanging the ring clear of the wall puts it
 * in front of the floor bands, which would otherwise slice it into quarters.
 */
function buildOculus(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  flatHalfWidth: number,
) {
  const centreY = 22.5;
  const standoff = 1.4;
  // Sized against the façade rather than fixed: at 5.4m it read correctly on a
  // 62m frontage and vanished on a 150m one. Capped, or it starts competing
  // with the building instead of marking it.
  const radius = Math.min(flatHalfWidth * 0.175, 10.5);
  const scale = radius / 5.4;
  const parts: THREE.BufferGeometry[] = [];

  // A torus is authored in the x–y plane facing +z, which is exactly how a
  // wall-mounted ring wants to sit in this frame — no rotation needed.
  const place = (geometry: THREE.BufferGeometry) => {
    geometry.translate(0, centreY, standoff);
    transformFromEntrance(geometry, origin, yaw);
    parts.push(geometry);
  };

  place(new THREE.TorusGeometry(radius, 0.32 * scale, 8, 48));
  place(new THREE.TorusGeometry(radius * 0.574, 0.22 * scale, 8, 40));

  const hub = new THREE.CylinderGeometry(1.05 * scale, 1.05 * scale, 0.34, 20);
  hub.rotateX(Math.PI / 2);
  place(hub);

  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.BoxGeometry(0.2 * scale, 2.4 * scale, 0.2);
    spoke.translate(0, 4.25 * scale, 0);
    spoke.rotateZ((i / 6) * Math.PI * 2);
    place(spoke);
  }

  ctx.add(
    "tech-oculus",
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(ACCENT).multiplyScalar(1.15),
        toneMapped: false,
      }),
    parts,
    { bloom: true },
  );

  // Two arms back to the glazing, so the ring is mounted rather than floating.
  ctx.add(
    "tech-bracket",
    () => new THREE.MeshStandardMaterial({ color: STRUCT, roughness: 0.6, metalness: 0.3 }),
    [
      orientedBox(0.26, 0.26, standoff, -radius, centreY, standoff / 2, origin, yaw),
      orientedBox(0.26, 0.26, standoff, radius, centreY, standoff / 2, origin, yaw),
    ],
  );
}

/** A deep fascia at the roofline, lit from beneath. */
function buildCrown(ctx: SignatureContext, origin: THREE.Vector3, yaw: number, shape: Shape) {
  const { flatHalfWidth, flatHalfDepth, halfWidth, depth, top } = shape;
  const bottom = TRUSS_TOP;
  const height = top - bottom;
  const midY = (bottom + top) / 2;
  const offset = 0.95;

  const fascia: THREE.BufferGeometry[] = [
    orientedBox(flatHalfWidth * 2, height, offset, 0, midY, offset / 2, origin, yaw),
    orientedBox(flatHalfWidth * 2, height, offset, 0, midY, -depth - offset / 2, origin, yaw),
    orientedBox(offset, height, flatHalfDepth * 2, -halfWidth - offset / 2, midY, -depth / 2, origin, yaw),
    orientedBox(offset, height, flatHalfDepth * 2, halfWidth + offset / 2, midY, -depth / 2, origin, yaw),
  ];
  const light: THREE.BufferGeometry[] = [
    orientedBox(flatHalfWidth * 2 - 1, 0.24, 0.32, 0, bottom - 0.2, 0.8, origin, yaw),
    orientedBox(flatHalfWidth * 2 - 1, 0.24, 0.32, 0, bottom - 0.2, -depth - 0.8, origin, yaw),
    orientedBox(0.32, 0.24, flatHalfDepth * 2 - 1, -halfWidth - 0.8, bottom - 0.2, -depth / 2, origin, yaw),
    orientedBox(0.32, 0.24, flatHalfDepth * 2 - 1, halfWidth + 0.8, bottom - 0.2, -depth / 2, origin, yaw),
  ];

  for (const corner of corners(shape)) {
    fascia.push(drumRing(DRUM_RADIUS + offset, height, midY, corner, origin, yaw));
    light.push(drumRing(DRUM_RADIUS + 0.8, 0.24, bottom - 0.2, corner, origin, yaw));
  }

  ctx.add("tech-frame", frameMaterial, fascia);
  ctx.add(
    "tech-crown-light",
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(ACCENT).multiplyScalar(1.25),
        toneMapped: false,
      }),
    light,
    { bloom: true },
  );
}

/**
 * Two rings above the roof, the inner one turning slowly.
 *
 * The district's emblem, and the only thing in the city that moves under its
 * own steam. It sits three metres over the parapet: enough to be seen over the
 * roofline from street level, not enough to break the block's height.
 */
function buildHalo(ctx: SignatureContext, origin: THREE.Vector3, yaw: number, shape: Shape) {
  const centreZ = -shape.depth / 2;
  const parapet = shape.top + 0.5;
  const ringY = parapet + HALO_RISE;
  const diagonal = HALO_RADIUS / Math.SQRT2;

  const masts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      masts.push(
        orientedBox(
          0.26,
          HALO_RISE + 0.6,
          0.26,
          sx * diagonal,
          parapet + (HALO_RISE - 0.6) / 2,
          centreZ + sz * diagonal,
          origin,
          yaw,
        ),
      );
    }
  }

  // Two low plant volumes, so the roof is not a bare plane when the camera
  // catches it from the park.
  masts.push(
    orientedBox(9, 2.2, 6, -12, parapet + 1.1, centreZ - 9, origin, yaw),
    orientedBox(5.5, 1.7, 5, 11, parapet + 0.85, centreZ + 11, origin, yaw),
  );
  ctx.add(
    "tech-roof-plant",
    () => new THREE.MeshStandardMaterial({ color: STRUCT, roughness: 0.75, metalness: 0.25 }),
    masts,
  );

  const outer = new THREE.TorusGeometry(HALO_RADIUS, 0.26, 8, 48);
  outer.rotateX(Math.PI / 2);
  outer.translate(0, ringY, centreZ);
  transformFromEntrance(outer, origin, yaw);
  ctx.add(
    "tech-halo",
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(ACCENT).multiplyScalar(1.2),
        toneMapped: false,
      }),
    outer,
    { bloom: true },
  );

  // The turning ring cannot be merged into a batch, so it is the one standalone
  // mesh the district adds — and the only draw call it costs.
  const innerGeometry = new THREE.TorusGeometry(HALO_RADIUS * 0.66, 0.2, 8, 40);
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(CYAN).multiplyScalar(1.3),
    toneMapped: false,
  });
  const inner = new THREE.Mesh(innerGeometry, innerMaterial);
  inner.name = "tech-district-halo";
  inner.layers.enable(BLOOM_LAYER);
  inner.rotation.z = 0.42;
  inner.position
    .set(0, ringY, centreZ)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    .add(origin);
  ctx.object(inner, () => {
    innerGeometry.dispose();
    innerMaterial.dispose();
  });
  ctx.animate((_elapsed, dt) => {
    inner.rotation.y += dt * 0.35;
  });
}
