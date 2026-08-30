import * as THREE from "three";
import type { Building } from "@/world/schema";
import { KERB_HEIGHT } from "@/world/schema";
import {
  entranceSide,
  entranceYaw,
  orientedBox,
  orientedYawBox,
} from "../geometry";
import { makeMarquee } from "../../materials/signTextures";
import type { DistrictSignature, SignatureContext } from "./types";

/**
 * The Finance District, built as an exchange.
 *
 * Deliberately the opposite of the Tech District in every respect that
 * matters. The two sit on diagonally opposite corners of the park with
 * identical footprints and identical heights, so they are constantly seen
 * together: if this one were also dark glass and cool light with a glowing
 * emblem, neither would read as special. So where that building is glazed,
 * curved, banded and cool, this one is opaque, angular, unbroken and warm.
 *
 * The move the whole design rests on is having **no visible floors**. Every
 * other building downtown announces nine storeys through a window grid; a
 * trading floor is one big room, and hiding the storeys behind a solid folded
 * skin is what makes this read as an exchange rather than an office block
 * with a sign on it. The shell underneath is untouched, so the interior and
 * doorway are unaffected — the skin simply covers it.
 *
 * The forecourt is the other half of the argument. This is the one building
 * that can give people a reason to gather *outside* it — every exchange in
 * the world has steps people stand on — so it gets a plinth, a step and a
 * colonnade deep enough to shelter under. The existing movement code already
 * handles this: PlayerController snaps up any riser under 0.55m and
 * BoxCollision treats the top of a solid as ground, so a low plinth needs no
 * new physics.
 */

/** The folded skin: how far it stands off the wall, and how deep it folds. */
const SKIN_OFFSET = 0.12;
const SKIN_THICKNESS = 0.3;
const FOLD_DEPTH = 0.95;

/** Solid piers close the corners where two folded runs meet. */
const PIER_SIZE = 3;

/** The entrance recess, and the marquee over it. */
const RECESS_HALF_WIDTH = 11;
const RECESS_HEIGHT = 12.6;
// Clear of the colonnade roof, which projects to 4.3m and was cutting
// straight across the board.
const MARQUEE_BOTTOM = 15.5;
const MARQUEE_TOP = 20;
/** Matches the marquee texture's 4:1 aspect; anything wider squeezes the title. */
const MARQUEE_WIDTH = 18;

/**
 * The forecourt. Shallow by necessity: street furniture is placed 8.2m out
 * from this façade by the city generator, so anything deeper collides with a
 * row of lamp posts this module has no business moving.
 */
const COLONNADE_STANDOFF = 3.2;
const CANOPY_FRONT = 4.3;
const PLINTH_FRONT = 4.9;
const STEP_FRONT = 5.9;
const PLINTH_RISE = 0.35;

/**
 * Oxidised bronze, over a pale stone plinth.
 *
 * The first pass was champagne, which sat only four points off the tiled
 * buildings' own beige — and four of those stand downtown already, so the
 * palette was doing far less to separate this building than intended. Bronze
 * is unambiguous against both the tiles and the blue-grey glass, and it is
 * the right ground for the coral accent.
 */
const SKIN = 0xa9714c;
const PIER = 0x8a5a3a;
const COLONNADE = 0x6f4830;
const DARK = 0x2a1e18;
const STONE = 0xc3b9ab;
const ACCENT = "#ff7b72";

export const financeDistrict: DistrictSignature = {

  build(building: Building, ctx: SignatureContext) {
    if (!building.entrance) return;

    const origin = new THREE.Vector3(building.entrance.x, 0, building.entrance.z);
    const yaw = entranceYaw(entranceSide(building));
    const halfWidth = building.w / 2;
    const depth = building.d;
    const base = KERB_HEIGHT;
    const top = KERB_HEIGHT + building.height;

    buildPiers(ctx, origin, yaw, halfWidth, depth, base, top);
    buildFoldedSkin(ctx, origin, yaw, halfWidth, depth, base, top);
    buildRecess(ctx, origin, yaw, base);
    buildForecourt(ctx, origin, yaw, halfWidth, base);
    buildMarquee(building, ctx, origin, yaw);
    buildBladeSign(ctx, origin, yaw, halfWidth, top);
    buildCornice(ctx, origin, yaw, halfWidth, depth, top);
  },
};

/** Square piers at the four corners, closing the folded runs. */
function buildPiers(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  halfWidth: number,
  depth: number,
  base: number,
  top: number,
) {
  const parts: THREE.BufferGeometry[] = [];
  const height = top - base + 0.4;
  const midY = base + height / 2 - 0.2;

  for (const x of [-halfWidth, halfWidth]) {
    for (const z of [0, -depth]) {
      parts.push(orientedBox(PIER_SIZE, height, PIER_SIZE, x, midY, z, origin, yaw));
      const centre = new THREE.Vector3(x, 0, z)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
        .add(origin);
      ctx.solid(
        new THREE.Box3(
          new THREE.Vector3(centre.x - PIER_SIZE / 2, base, centre.z - PIER_SIZE / 2),
          new THREE.Vector3(centre.x + PIER_SIZE / 2, top, centre.z + PIER_SIZE / 2),
        ),
      );
    }
  }
  ctx.add("finance-pier", () => new THREE.MeshStandardMaterial({ color: PIER, roughness: 0.62, metalness: 0.35 }), parts);
}

interface Point {
  x: number;
  z: number;
}

/**
 * A zig-zag run of flat panels between two points in the building's frame.
 *
 * Each bay pushes out to an apex and back, so the run has real depth rather
 * than a drawn-on pattern. That matters here more than usual: nothing in this
 * scene casts shadows, so relief has to come from surfaces genuinely facing
 * different directions and catching the sun differently.
 */
/** Bays are derived so the fold keeps this pitch whatever the run's length. */
const FOLD_PITCH = 6.4;

function foldedRun(
  from: Point,
  to: Point,
  outward: Point,
  height: number,
  midY: number,
  origin: THREE.Vector3,
  yaw: number,
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  // A fixed bay count made a 21m fold on the long cardinal blocks and a 6m one
  // on the corners — the same building reading as two different scales. Pitch
  // is the thing that should stay constant.
  const bays = Math.max(2, Math.round(Math.hypot(to.x - from.x, to.z - from.z) / FOLD_PITCH));
  const along = { x: (to.x - from.x) / bays, z: (to.z - from.z) / bays };

  const panel = (a: Point, b: Point) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    // orientedYawBox turns a box about the vertical, and rotateY maps the box's
    // width axis to (cos, 0, -sin) — hence the negated z in the angle.
    const angle = Math.atan2(-dz, dx);
    parts.push(
      orientedYawBox(
        length,
        height,
        SKIN_THICKNESS,
        (a.x + b.x) / 2,
        midY,
        (a.z + b.z) / 2,
        angle,
        origin,
        yaw,
      ),
    );
  };

  for (let i = 0; i < bays; i++) {
    const start = { x: from.x + along.x * i, z: from.z + along.z * i };
    const end = { x: from.x + along.x * (i + 1), z: from.z + along.z * (i + 1) };
    const apex = {
      x: (start.x + end.x) / 2 + outward.x * FOLD_DEPTH,
      z: (start.z + end.z) / 2 + outward.z * FOLD_DEPTH,
    };
    panel(start, apex);
    panel(apex, end);
  }
  return parts;
}

/** The folded skin, wrapping all four faces and stopping at the recess. */
function buildFoldedSkin(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  halfWidth: number,
  depth: number,
  base: number,
  top: number,
) {
  const inset = halfWidth - PIER_SIZE / 2 + 0.5;
  const zInset = PIER_SIZE / 2 - 0.5;
  const full = top - 0.9 - base;
  const fullMid = base + full / 2;
  const parts: THREE.BufferGeometry[] = [];

  // Entrance face, either side of the recess and again above it.
  const front = { x: 0, z: 1 };
  parts.push(
    ...foldedRun({ x: -inset, z: SKIN_OFFSET }, { x: -RECESS_HALF_WIDTH, z: SKIN_OFFSET }, front, full, fullMid, origin, yaw),
    ...foldedRun({ x: RECESS_HALF_WIDTH, z: SKIN_OFFSET }, { x: inset, z: SKIN_OFFSET }, front, full, fullMid, origin, yaw),
    ...foldedRun(
      { x: -RECESS_HALF_WIDTH, z: SKIN_OFFSET },
      { x: RECESS_HALF_WIDTH, z: SKIN_OFFSET },
      front,
      top - 0.9 - RECESS_HEIGHT,
      (RECESS_HEIGHT + top - 0.9) / 2,
      origin,
      yaw,
    ),
  );

  // Rear.
  parts.push(
    ...foldedRun(
      { x: -inset, z: -depth - SKIN_OFFSET },
      { x: inset, z: -depth - SKIN_OFFSET },
      { x: 0, z: -1 },
      full,
      fullMid,
      origin,
      yaw,
    ),
  );

  // Flanks.
  for (const side of [-1, 1]) {
    parts.push(
      ...foldedRun(
        { x: side * (halfWidth + SKIN_OFFSET), z: -zInset },
        { x: side * (halfWidth + SKIN_OFFSET), z: -depth + zInset },
        { x: side, z: 0 },
        full,
        fullMid,
        origin,
        yaw,
      ),
    );
  }

  ctx.add(
    "finance-skin",
    () => new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.62, metalness: 0.26 }),
    parts,
  );
}

/** The entrance recess: a dark reveal and a heavy head beam over the opening. */
function buildRecess(ctx: SignatureContext, origin: THREE.Vector3, yaw: number, base: number) {
  ctx.add(
    "finance-recess",
    () =>
      new THREE.MeshStandardMaterial({
        color: DARK,
        roughness: 0.82,
        metalness: 0.05,
        // A recess washed pale by image-based lighting stops being a recess.
        envMapIntensity: 0.3,
      }),
    orientedBox(
      RECESS_HALF_WIDTH * 2,
      RECESS_HEIGHT - base,
      0.2,
      0,
      (base + RECESS_HEIGHT) / 2,
      0.08,
      origin,
      yaw,
    ),
  );

  ctx.add(
    "finance-pier",
    () => new THREE.MeshStandardMaterial({ color: PIER, roughness: 0.62, metalness: 0.35 }),
    orientedBox(RECESS_HALF_WIDTH * 2 + 2.4, 1.5, 1.5, 0, RECESS_HEIGHT + 0.75, 0.55, origin, yaw),
  );
}

/**
 * Plinth, step and colonnade: somewhere to stand.
 *
 * The plinth is registered as a solid, which is what makes it walkable —
 * BoxCollision counts the top of any solid as ground.
 */
function buildForecourt(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  halfWidth: number,
  base: number,
) {
  const width = halfWidth * 2 + PIER_SIZE;
  const stone = () => new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.86, metalness: 0.03 });

  const solidBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const geometry = orientedBox(w, h, d, x, y, z, origin, yaw);
    geometry.computeBoundingBox();
    if (geometry.boundingBox) ctx.solid(geometry.boundingBox.clone());
    return geometry;
  };

  // Plinth, then one 0.35m riser down to the pavement — inside the step height
  // the player controller already handles, so no new movement code.
  ctx.add("finance-stone", stone, [
    solidBox(width, PLINTH_RISE, PLINTH_FRONT, 0, base + PLINTH_RISE / 2, PLINTH_FRONT / 2),
    solidBox(
      width - 6,
      PLINTH_RISE / 2,
      STEP_FRONT - PLINTH_FRONT,
      0,
      base + PLINTH_RISE / 4,
      (PLINTH_FRONT + STEP_FRONT) / 2,
    ),
  ]);

  const columns: THREE.BufferGeometry[] = [];
  const canopyTop = RECESS_HEIGHT + 1.5;
  const columnTop = canopyTop - 0.2;
  // Spaced at a fixed pitch rather than listed. Six hardcoded positions
  // clustered in the middle of a 153m canopy the moment this district moved to
  // a long block, leaving most of the roof standing on nothing.
  const pitch = 10.8;
  const bays = Math.max(3, Math.round((halfWidth - 3) / pitch));
  for (let i = -bays; i <= bays; i++) {
    if (i === 0) continue;
    const x = (i - Math.sign(i) * 0.5) * ((halfWidth - 3) / bays);
    columns.push(
      orientedBox(
        1.7,
        columnTop - base - PLINTH_RISE,
        1.7,
        x,
        base + PLINTH_RISE + (columnTop - base - PLINTH_RISE) / 2,
        COLONNADE_STANDOFF,
        origin,
        yaw,
      ),
    );
    const centre = new THREE.Vector3(x, 0, COLONNADE_STANDOFF)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      .add(origin);
    ctx.solid(
      new THREE.Box3(
        new THREE.Vector3(centre.x - 0.85, base, centre.z - 0.85),
        new THREE.Vector3(centre.x + 0.85, columnTop, centre.z + 0.85),
      ),
    );
  }
  // A tone of its own: at the skin's colour the columns merged straight into
  // the folds behind them and the colonnade stopped reading as a colonnade.
  ctx.add(
    "finance-colonnade",
    () => new THREE.MeshStandardMaterial({ color: COLONNADE, roughness: 0.7, metalness: 0.2 }),
    [
      ...columns,
      // The roof plane the columns carry.
      orientedBox(width, 1.7, CANOPY_FRONT, 0, canopyTop + 0.85, CANOPY_FRONT / 2, origin, yaw),
    ],
  );

  // The same lesson as the AI District canopy: with no shadows in the scene, a
  // projecting plane reads as a stripe until something dark sits beneath it.
  ctx.add(
    "finance-recess",
    () =>
      new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.82, metalness: 0.05, envMapIntensity: 0.3 }),
    orientedBox(width - 0.6, 0.26, CANOPY_FRONT - 0.3, 0, canopyTop - 0.13, CANOPY_FRONT / 2, origin, yaw),
  );

  // Warm light in the soffit. Without it the whole building reads as sealed,
  // which is the wrong signal entirely for the one place people are meant to
  // gather outside and then go in.
  const lights: THREE.BufferGeometry[] = [];
  for (let x = -width / 2 + 4; x <= width / 2 - 4; x += 5.4) {
    lights.push(orientedBox(2.6, 0.14, 1.4, x, canopyTop - 0.32, CANOPY_FRONT / 2, origin, yaw));
  }
  ctx.add(
    "finance-light",
    () =>
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd7a8).multiplyScalar(1.2), toneMapped: false }),
    lights,
    { bloom: true },
  );
}

/** The marquee, over the doors. */
function buildMarquee(
  building: Building,
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
) {
  const marquee = makeMarquee(building.sponsor ?? "Trading Floor", "markets open", ACCENT);
  ctx.ownTexture(marquee);
  const height = MARQUEE_TOP - MARQUEE_BOTTOM;

  ctx.add(
    "finance-marquee",
    () =>
      new THREE.MeshStandardMaterial({
        map: marquee,
        // Dimmed diffuse, as on every emissive panel here: at full white the
        // surface is counted both as lit and as a light source and blows out.
        color: 0x2a2a2a,
        emissive: 0xffffff,
        emissiveMap: marquee,
        emissiveIntensity: 0.85,
        roughness: 0.5,
      }),
    orientedBox(MARQUEE_WIDTH, height, 0.5, 0, (MARQUEE_BOTTOM + MARQUEE_TOP) / 2, 1.5, origin, yaw),
    { bloom: true },
  );

  ctx.add(
    "finance-pier",
    () => new THREE.MeshStandardMaterial({ color: PIER, roughness: 0.62, metalness: 0.35 }),
    [
      orientedBox(MARQUEE_WIDTH + 1.4, 0.5, 1.1, 0, MARQUEE_TOP + 0.25, 1.3, origin, yaw),
      orientedBox(MARQUEE_WIDTH + 1.4, 0.5, 1.1, 0, MARQUEE_BOTTOM - 0.25, 1.3, origin, yaw),
    ],
  );
}

/** A vertical blade at one corner, read from along the street. */
function buildBladeSign(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  halfWidth: number,
  top: number,
) {
  const bottom = 15;
  const height = top + 2.6 - bottom;

  ctx.add(
    "finance-pier",
    () => new THREE.MeshStandardMaterial({ color: PIER, roughness: 0.62, metalness: 0.35 }),
    orientedBox(0.7, height, 3.2, -halfWidth - 0.6, bottom + height / 2, 1.9, origin, yaw),
  );
  ctx.add(
    "finance-blade",
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(ACCENT).multiplyScalar(1.25),
        toneMapped: false,
      }),
    orientedBox(0.24, height - 1.4, 2.4, -halfWidth - 1.05, bottom + height / 2, 1.9, origin, yaw),
    { bloom: true },
  );
}

/**
 * A sawtooth cornice.
 *
 * Every roofline downtown is a flat parapet. Tilting alternate plates gives
 * this one a folded edge, which is the cheapest way to make the building
 * identifiable from anywhere in the city without adding height.
 */
function buildCornice(
  ctx: SignatureContext,
  origin: THREE.Vector3,
  yaw: number,
  halfWidth: number,
  depth: number,
  top: number,
) {
  const band = halfWidth + 1.6;
  const parts: THREE.BufferGeometry[] = [
    orientedBox(band * 2, 1.5, 1.5, 0, top - 0.2, 1.05, origin, yaw),
    orientedBox(band * 2, 1.5, 1.5, 0, top - 0.2, -depth - 1.05, origin, yaw),
    orientedBox(1.5, 1.5, depth + 1.4, band - 0.75, top - 0.2, -depth / 2, origin, yaw),
    orientedBox(1.5, 1.5, depth + 1.4, -band + 0.75, top - 0.2, -depth / 2, origin, yaw),
  ];

  // A crown that zig-zags in plan rather than up and down. Alternating raised
  // plates were the first attempt and read unmistakably as castle battlements;
  // folding the crown instead keeps the roofline level and carries the skin's
  // own motif to the top of the building.
  const crownHeight = 2.4;
  const crownMid = top + 0.55 + crownHeight / 2;
  parts.push(
    ...foldedRun({ x: -band, z: 1.7 }, { x: band, z: 1.7 }, { x: 0, z: 1 }, crownHeight, crownMid, origin, yaw),
    ...foldedRun({ x: -band, z: -depth - 1.7 }, { x: band, z: -depth - 1.7 }, { x: 0, z: -1 }, crownHeight, crownMid, origin, yaw),
    ...foldedRun({ x: band - 1.4, z: -1.7 }, { x: band - 1.4, z: -depth + 1.7 }, { x: 1, z: 0 }, crownHeight, crownMid, origin, yaw),
    ...foldedRun({ x: -band + 1.4, z: -1.7 }, { x: -band + 1.4, z: -depth + 1.7 }, { x: -1, z: 0 }, crownHeight, crownMid, origin, yaw),
  );

  ctx.add(
    "finance-pier",
    () => new THREE.MeshStandardMaterial({ color: PIER, roughness: 0.62, metalness: 0.35 }),
    parts,
  );
}
