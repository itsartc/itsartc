import * as THREE from "three";
import type { Building } from "@/world/schema";
import { KERB_HEIGHT } from "@/world/schema";
import { entranceSide, entranceYaw, orientedBox, orientedYawBox } from "../geometry";
import type { SignatureContext } from "./types";

/**
 * Shared architectural components.
 *
 * Twelve bespoke buildings would otherwise repeat the same dozen moves —
 * banding a façade, panelling it, hanging a canopy, laying a plinth — in
 * twelve slightly different and slightly wrong ways. Each district composes
 * these and adds the one or two elements that are actually its own, which is
 * what keeps a design module short enough to read in a sitting.
 */

/**
 * A building's own coordinate frame: local +z points out of the entrance, x
 * runs along the entrance façade and z runs back into the building.
 *
 * The swap in here is the point of the function. Blocks on the north and south
 * rows are entered on a 62m face; the four inner blocks are entered from the
 * side, on a 50m face, and there the building's `w` is its *depth*. Reading
 * `w` as the façade width regardless — which is what both hand-written
 * modules did — builds those four sideways.
 */
export interface Frame {
  origin: THREE.Vector3;
  yaw: number;
  /** Half the width of the entrance façade. */
  halfWidth: number;
  /** How far the building runs back from the entrance face. */
  depth: number;
  base: number;
  top: number;
  height: number;
  floors: number;
  floorHeight: number;
}

export function frame(building: Building): Frame | null {
  if (!building.entrance) return null;
  const side = entranceSide(building);
  const acrossX = side === "north" || side === "south";
  return {
    origin: new THREE.Vector3(building.entrance.x, 0, building.entrance.z),
    yaw: entranceYaw(side),
    halfWidth: (acrossX ? building.w : building.d) / 2,
    depth: acrossX ? building.d : building.w,
    base: KERB_HEIGHT,
    top: KERB_HEIGHT + building.height,
    height: building.height,
    floors: building.floors,
    floorHeight: building.height / building.floors,
  };
}

/** Which façades a component applies to. */
export interface Faces {
  front?: boolean;
  back?: boolean;
  sides?: boolean;
}

const ALL_FACES: Required<Faces> = { front: true, back: true, sides: true };
const resolve = (faces?: Faces) => ({ ...ALL_FACES, ...faces });

/**
 * A horizontal band wrapping the building — a floor line, a sill, a cornice.
 *
 * `inset` shortens each run so it stops before the corners, for designs that
 * put something else there.
 */
export function band(
  f: Frame,
  options: {
    y: number;
    height: number;
    offset: number;
    thickness: number;
    inset?: number;
    faces?: Faces;
  },
): THREE.BufferGeometry[] {
  const { y, height, offset, thickness, inset = 0 } = options;
  const faces = resolve(options.faces);
  const { origin, yaw, halfWidth, depth } = f;
  const across = (halfWidth - inset) * 2;
  const along = depth - inset * 2;
  const parts: THREE.BufferGeometry[] = [];

  if (faces.front) parts.push(orientedBox(across, height, thickness, 0, y, offset, origin, yaw));
  if (faces.back) parts.push(orientedBox(across, height, thickness, 0, y, -depth - offset, origin, yaw));
  if (faces.sides) {
    parts.push(
      orientedBox(thickness, height, along, -halfWidth - offset, y, -depth / 2, origin, yaw),
      orientedBox(thickness, height, along, halfWidth + offset, y, -depth / 2, origin, yaw),
    );
  }
  return parts;
}

/**
 * Flat panels over the façades, standing just off the shell.
 *
 * `openBay` leaves a gap across the middle of the entrance face, for the
 * designs that cut an opening there; the panel resumes above `openHeight`.
 */
export function facePanels(
  f: Frame,
  options: {
    from: number;
    to: number;
    offset: number;
    thickness: number;
    inset?: number;
    openBay?: { halfWidth: number; height: number };
    faces?: Faces;
  },
): THREE.BufferGeometry[] {
  const { from, to, offset, thickness, inset = 0, openBay } = options;
  const faces = resolve(options.faces);
  const { origin, yaw, halfWidth, depth } = f;
  const height = to - from;
  const midY = (from + to) / 2;
  const edge = halfWidth - inset;
  const parts: THREE.BufferGeometry[] = [];

  if (faces.front) {
    if (openBay) {
      const flank = edge - openBay.halfWidth;
      const centre = (edge + openBay.halfWidth) / 2;
      parts.push(
        orientedBox(flank, height, thickness, -centre, midY, offset, origin, yaw),
        orientedBox(flank, height, thickness, centre, midY, offset, origin, yaw),
        orientedBox(
          openBay.halfWidth * 2,
          to - openBay.height,
          thickness,
          0,
          (openBay.height + to) / 2,
          offset,
          origin,
          yaw,
        ),
      );
    } else {
      parts.push(orientedBox(edge * 2, height, thickness, 0, midY, offset, origin, yaw));
    }
  }
  if (faces.back) parts.push(orientedBox(edge * 2, height, thickness, 0, midY, -depth - offset, origin, yaw));
  if (faces.sides) {
    const along = depth - inset * 2;
    parts.push(
      orientedBox(thickness, height, along, -halfWidth - offset, midY, -depth / 2, origin, yaw),
      orientedBox(thickness, height, along, halfWidth + offset, midY, -depth / 2, origin, yaw),
    );
  }
  return parts;
}

/**
 * Evenly spaced vertical fins, optionally turned to a fixed rake.
 *
 * `openBay` lifts the fins that fall across the entrance so they start above
 * it rather than running down over the doors and the name plaque — which is
 * exactly what the first louvred façade did.
 */
export function fins(
  f: Frame,
  options: {
    from: number;
    to: number;
    spacing: number;
    width: number;
    projection: number;
    offset: number;
    rake?: number;
    inset?: number;
    openBay?: { halfWidth: number; height: number };
    faces?: Faces;
  },
): THREE.BufferGeometry[] {
  const { from, to, spacing, width, projection, offset, rake = 0, inset = 2, openBay } = options;
  const faces = resolve(options.faces);
  const { origin, yaw, halfWidth, depth } = f;
  const parts: THREE.BufferGeometry[] = [];

  const place = (x: number, z: number, turn: number, top = to, bottom = from) => {
    if (top - bottom <= 0) return;
    parts.push(
      orientedYawBox(width, top - bottom, projection, x, (top + bottom) / 2, z, turn + rake, origin, yaw),
    );
  };

  if (faces.front || faces.back) {
    for (let x = -halfWidth + inset; x <= halfWidth - inset; x += spacing) {
      const lifted = openBay && Math.abs(x) < openBay.halfWidth ? Math.max(from, openBay.height) : from;
      if (faces.front) place(x, offset + projection / 2, 0, to, lifted);
      if (faces.back) place(x, -depth - offset - projection / 2, Math.PI);
    }
  }
  if (faces.sides) {
    for (let z = -inset; z >= -depth + inset; z -= spacing) {
      place(-halfWidth - offset - projection / 2, z, Math.PI / 2);
      place(halfWidth + offset + projection / 2, z, -Math.PI / 2);
    }
  }
  return parts;
}

/**
 * A projecting canopy and the dark plate beneath it.
 *
 * The soffit is not decoration. Nothing in this scene casts shadows, so a
 * projecting slab has no shade under it and flattens into a stripe; the dark
 * plate supplies the shadow the lighting cannot.
 */
export function canopy(
  f: Frame,
  options: { y: number; height: number; projection: number; width?: number },
): { structure: THREE.BufferGeometry; soffit: THREE.BufferGeometry } {
  const { y, height, projection } = options;
  const width = options.width ?? f.halfWidth * 2 + 2;
  const { origin, yaw } = f;
  return {
    structure: orientedBox(width, height, projection, 0, y + height / 2, projection / 2, origin, yaw),
    soffit: orientedBox(
      width - 0.6,
      0.24,
      projection - 0.3,
      0,
      y - 0.12,
      projection / 2,
      origin,
      yaw,
    ),
  };
}

/**
 * A walkable plinth with a single riser down to the pavement.
 *
 * Registered as a solid, which is what makes it walkable: BoxCollision counts
 * the top of any solid as ground, and PlayerController snaps up any riser
 * under 0.55m — so the step height here must stay below that.
 */
export function plinth(
  f: Frame,
  ctx: SignatureContext,
  options: { depth: number; rise: number; overhang?: number },
): THREE.BufferGeometry[] {
  const { depth: front, rise } = options;
  const overhang = options.overhang ?? 2;
  const width = f.halfWidth * 2 + overhang;
  const { origin, yaw, base } = f;

  const solid = (w: number, h: number, d: number, y: number, z: number) => {
    const geometry = orientedBox(w, h, d, 0, y, z, origin, yaw);
    geometry.computeBoundingBox();
    if (geometry.boundingBox) ctx.solid(geometry.boundingBox.clone());
    return geometry;
  };

  return [
    solid(width, rise, front, base + rise / 2, front / 2),
    solid(width - 6, rise / 2, 1, base + rise / 4, front + 0.5),
  ];
}

/**
 * A dark reveal filling the entrance bay, split around the doorway.
 *
 * Without it the shared shell wall shows through in whichever pale façade
 * every other building uses, and the entrance looks borrowed from the block
 * next door.
 */
export function entranceReveal(
  f: Frame,
  options: { halfWidth: number; height: number; offset?: number },
): THREE.BufferGeometry[] {
  const { halfWidth: bay, height } = options;
  const offset = options.offset ?? 0.09;
  const { origin, yaw, base } = f;
  // Clear of the shell's own 4.8m doorway and its frame.
  const doorHalf = 2.6;
  const doorHead = 3.75;

  return [
    orientedBox(bay - doorHalf, height - base, 0.14, -(bay + doorHalf) / 2, (base + height) / 2, offset, origin, yaw),
    orientedBox(bay - doorHalf, height - base, 0.14, (bay + doorHalf) / 2, (base + height) / 2, offset, origin, yaw),
    orientedBox(doorHalf * 2, height - doorHead, 0.14, 0, (doorHead + height) / 2, offset, origin, yaw),
  ];
}

/** A zig-zag run of panels between two points, for a folded skin. */
export function foldedRun(
  f: Frame,
  from: { x: number; z: number },
  to: { x: number; z: number },
  outward: { x: number; z: number },
  options: { bays: number; fold: number; height: number; midY: number; thickness: number },
): THREE.BufferGeometry[] {
  const { bays, fold, height, midY, thickness } = options;
  const parts: THREE.BufferGeometry[] = [];
  const along = { x: (to.x - from.x) / bays, z: (to.z - from.z) / bays };

  const panel = (a: { x: number; z: number }, b: { x: number; z: number }) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    // rotateY maps a box's width axis to (cos, 0, -sin) — hence the negated z.
    parts.push(
      orientedYawBox(
        Math.hypot(dx, dz),
        height,
        thickness,
        (a.x + b.x) / 2,
        midY,
        (a.z + b.z) / 2,
        Math.atan2(-dz, dx),
        f.origin,
        f.yaw,
      ),
    );
  };

  for (let i = 0; i < bays; i++) {
    const start = { x: from.x + along.x * i, z: from.z + along.z * i };
    const end = { x: from.x + along.x * (i + 1), z: from.z + along.z * (i + 1) };
    const apex = {
      x: (start.x + end.x) / 2 + outward.x * fold,
      z: (start.z + end.z) / 2 + outward.z * fold,
    };
    panel(start, apex);
    panel(apex, end);
  }
  return parts;
}

/** Registers a box collider from geometry already placed in world space. */
export function solidFrom(ctx: SignatureContext, geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  if (geometry.boundingBox) ctx.solid(geometry.boundingBox.clone());
}

/** An unlit, tone-mapping-exempt material for light lines and emblems. */
export function glow(colour: string | number, intensity = 1.25): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(colour).multiplyScalar(intensity),
    toneMapped: false,
  });
}

/**
 * Architectural glazing.
 *
 * One definition for the six districts that have glass. It is dielectric,
 * because glass is not a metal: the metalness these carried individually — up
 * to 0.62 — is what turned the façades into mirrors of the scene's studio
 * environment. Roughness is high enough that the reflection is a sheen rather
 * than an image.
 */
export function glazing(colour: number, options: { opacity?: number } = {}): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.42,
    metalness: 0.1,
  });
  if (options.opacity !== undefined) {
    material.transparent = true;
    material.opacity = options.opacity;
  }
  return material;
}

/** A matte, deliberately under-lit material for recesses and soffits. */
export function shadowed(colour: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.82,
    metalness: 0.05,
    // Image-based lighting here is bright enough to wash a recess back to pale
    // grey, which is the one thing a recess must not do.
    envMapIntensity: 0.3,
  });
}
