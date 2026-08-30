import type { Building, CityMap, District, FacadeStyle, Plaza, Prop, Road, Sidewalk } from "./schema";

/**
 * Generates Downtown as a compact, symmetrical launch city.
 *
 * A three-by-three plan: eight building blocks in a ring around a central
 * park. The middle column is as wide as the park and the middle row as deep,
 * so the green keeps exactly the size and position it had under the earlier
 * four-by-four plan — 162 by 138 metres at (102, 90) — and the map keeps its
 * overall 366 by 318. Only the ring around it changed.
 *
 * That makes the four cardinal blocks long: they face the park across its full
 * width, which frames the green the way a square is framed rather than merely
 * bounded. The four corners stay at the original block size.
 *
 * Everything is mirrored across both map axes. District identities differ, but
 * opposite blocks share footprint, height, material family and street
 * furniture, so the plan reads as intentionally symmetrical.
 */

/** Metres. */
const ROAD_WIDTH = 14;
const SIDEWALK_WIDTH = 4.5;

/**
 * Column widths and row depths. The middle of each is the park's own span,
 * which is what keeps the green unchanged while the ring around it shrinks
 * from twelve blocks to eight.
 */
const COLUMN_W = [74, 162, 74] as const;
const ROW_D = [62, 138, 62] as const;
const COLS = COLUMN_W.length;
const ROWS = ROW_D.length;

const FLOOR_HEIGHT = 3.6;
const PATH_WIDTH = 8;
const BUILDING_INSET_X = 6;
const BUILDING_INSET_Z = 6;

type DistrictSpec = readonly [id: string, name: string, accent: string];

/**
 * The eight districts, one per block.
 *
 * The four long cardinal blocks take the districts whose designs are built on
 * repetition and so carry a 126- or 150-metre frontage; the corners take the
 * ones composed around a centre, which is what a 62-metre façade suits.
 *
 * Healthcare, Operations, Legal and Product have no block in this plan. Their
 * modules are still registered in the district signatures, so swapping any of
 * them back in is a change to one line here.
 */
const DISTRICTS_BY_BLOCK: Record<string, DistrictSpec> = {
  "0-0": ["founder-district", "Founder District", "#e0a53f"],
  "0-1": ["tech-district", "Tech District", "#a371f7"],
  "0-2": ["consulting-district", "Consulting District", "#58a6ff"],
  "1-0": ["people-district", "People District", "#3fb950"],
  "1-2": ["sales-district", "Sales District", "#f2cc60"],
  "2-0": ["marketing-district", "Marketing District", "#db61a2"],
  "2-1": ["finance-district", "Finance District", "#ff7b72"],
  "2-2": ["creative-district", "Creative District", "#f778ba"],
};

/** Where each block starts, and the road that precedes it. */
function offsets(sizes: readonly number[]): { road: number[]; start: number[] } {
  const road = [0];
  for (const size of sizes) road.push(road[road.length - 1] + ROAD_WIDTH + size);
  return { road, start: road.slice(0, -1).map((r) => r + ROAD_WIDTH) };
}

interface BuildingTemplate {
  floors: number;
  style: FacadeStyle;
  color: string;
}

/**
 * Two mirrored families: the four long cardinal blocks and the four corners.
 * Opposite blocks are identical, so the skyline balances across both axes.
 */
function buildingTemplate(row: number, col: number): BuildingTemplate {
  const corner = (row === 0 || row === ROWS - 1) && (col === 0 || col === COLS - 1);
  return corner
    ? { floors: 7, style: "concrete", color: "#aeb5b8" }
    : { floors: 9, style: "glass", color: "#879faf" };
}

export function generateDowntown(_seed = 20260829): CityMap {
  const columns = offsets(COLUMN_W);
  const rows = offsets(ROW_D);
  const width = columns.road[COLS] + ROAD_WIDTH;
  const depth = rows.road[ROWS] + ROAD_WIDTH;

  const roads: Road[] = [];
  const sidewalks: Sidewalk[] = [];
  const buildings: Building[] = [];
  const props: Prop[] = [];
  const plazas: Plaza[] = [];
  const districts: District[] = [];

  const parkX = columns.start[1];
  const parkZ = rows.start[1];
  const parkW = COLUMN_W[1];
  const parkD = ROW_D[1];
  const centreX = parkX + parkW / 2;
  const centreZ = parkZ + parkD / 2;

  // --- Roads ---------------------------------------------------------------
  // No road crosses the park now: its four edges are grid roads, so the
  // splitting the four-by-four plan needed is gone with it.
  for (let col = 0; col <= COLS; col++) {
    roads.push({ id: `ave-${col}`, x: columns.road[col], z: 0, w: ROAD_WIDTH, d: depth, axis: "z" });
  }
  for (let row = 0; row <= ROWS; row++) {
    roads.push({ id: `street-${row}`, x: 0, z: rows.road[row], w: width, d: ROAD_WIDTH, axis: "x" });
  }

  // --- Building blocks -----------------------------------------------------
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (isParkBlock(row, col)) continue;

      const blockX = columns.start[col];
      const blockZ = rows.start[row];
      const blockW = COLUMN_W[col];
      const blockD = ROW_D[row];
      const district = DISTRICTS_BY_BLOCK[`${row}-${col}`];
      if (!district) throw new Error(`Missing district for block ${row},${col}`);

      sidewalks.push(blockSidewalk(blockX, blockZ, blockW, blockD));
      addDistrictAndBuilding(districts, buildings, row, col, blockX, blockZ, blockW, blockD, district);
      addBlockProps(props, blockX, blockZ, blockW, blockD);
    }
  }

  // --- Central park --------------------------------------------------------
  // One pavement slab under the park guarantees a clean base at its edges.
  sidewalks.push({
    x: parkX - SIDEWALK_WIDTH,
    z: parkZ - SIDEWALK_WIDTH,
    w: parkW + SIDEWALK_WIDTH * 2,
    d: parkD + SIDEWALK_WIDTH * 2,
  });

  addParkSurfaces(plazas, parkX, parkZ, parkW, parkD, centreX, centreZ);
  addParkProps(props, parkX, parkZ, parkW, parkD, centreX, centreZ);

  districts.push({
    id: "networking-park",
    name: "Networking Park",
    x: centreX,
    z: centreZ,
    accent: "#56d364",
  });

  return {
    id: "downtown",
    name: "Downtown",
    version: 3,
    size: { w: width, d: depth },
    // Arrive just south of the fountain rather than inside its collider.
    spawn: { x: centreX, z: centreZ - 15 },
    districts,
    roads,
    sidewalks,
    plazas,
    buildings,
    props,
  };
}

function isParkBlock(row: number, col: number) {
  return row === 1 && col === 1;
}

function blockSidewalk(x: number, z: number, w: number, d: number): Sidewalk {
  return {
    x: x - SIDEWALK_WIDTH,
    z: z - SIDEWALK_WIDTH,
    w: w + SIDEWALK_WIDTH * 2,
    d: d + SIDEWALK_WIDTH * 2,
  };
}

function addDistrictAndBuilding(
  districts: District[],
  buildings: Building[],
  row: number,
  col: number,
  blockX: number,
  blockZ: number,
  blockW: number,
  blockD: number,
  district: DistrictSpec,
) {
  const [id, name, accent] = district;
  const template = buildingTemplate(row, col);
  const x = blockX + BUILDING_INSET_X;
  const z = blockZ + BUILDING_INSET_Z;
  const w = blockW - BUILDING_INSET_X * 2;
  const d = blockD - BUILDING_INSET_Z * 2;

  districts.push({ id, name, x: blockX + blockW / 2, z: blockZ + blockD / 2, accent });

  // Every entrance faces the park.
  const entrance =
    row === 0
      ? { x: x + w / 2, z: z + d }
      : row === ROWS - 1
        ? { x: x + w / 2, z }
        : col === 0
          ? { x: x + w, z: z + d / 2 }
          : { x, z: z + d / 2 };

  buildings.push({
    id: `building-${id}`,
    name,
    districtId: id,
    x,
    z,
    w,
    d,
    height: template.floors * FLOOR_HEIGHT,
    floors: template.floors,
    style: template.style,
    color: template.color,
    entrance,
    sponsor: null,
  });
}

function addParkSurfaces(
  plazas: Plaza[],
  x: number,
  z: number,
  w: number,
  d: number,
  centreX: number,
  centreZ: number,
) {
  const pathHalf = PATH_WIDTH / 2;
  const leftW = centreX - pathHalf - x;
  const topD = centreZ - pathHalf - z;
  const rightX = centreX + pathHalf;
  const bottomZ = centreZ + pathHalf;

  const quadrants = [
    { id: "nw", x, z, w: leftW, d: topD },
    { id: "ne", x: rightX, z, w: x + w - rightX, d: topD },
    { id: "sw", x, z: bottomZ, w: leftW, d: z + d - bottomZ },
    { id: "se", x: rightX, z: bottomZ, w: x + w - rightX, d: z + d - bottomZ },
  ];

  for (const quadrant of quadrants) {
    plazas.push({
      id: `networking-park-${quadrant.id}`,
      name: "Networking Park",
      x: quadrant.x,
      z: quadrant.z,
      w: quadrant.w,
      d: quadrant.d,
      surface: "grass",
    });
  }

  // Split the horizontal path around the vertical one to avoid coplanar
  // overlap at the centre. The fountain sits on the vertical path above it.
  plazas.push({
    id: "park-path-north-south",
    name: "Park Path",
    x: centreX - pathHalf,
    z,
    w: PATH_WIDTH,
    d,
    surface: "paving",
  });
  plazas.push({
    id: "park-path-west",
    name: "Park Path",
    x,
    z: centreZ - pathHalf,
    w: leftW,
    d: PATH_WIDTH,
    surface: "paving",
  });
  plazas.push({
    id: "park-path-east",
    name: "Park Path",
    x: rightX,
    z: centreZ - pathHalf,
    w: x + w - rightX,
    d: PATH_WIDTH,
    surface: "paving",
  });
}

/**
 * Street furniture on a block of any size, mirrored on both axes.
 *
 * Blocks are no longer all the same shape — the cardinal blocks are two to
 * three times the length of the corners — so positions are derived from each
 * edge rather than listed. Deriving them symmetrically is what keeps opposite
 * blocks identical without having to state each one.
 */
function addBlockProps(out: Prop[], x: number, z: number, w: number, d: number) {
  const edge = 2.2;

  /** Even pitch along an edge, symmetric about its middle, entrance kept clear. */
  const along = (length: number) => {
    const count = Math.max(2, Math.round(length / 17));
    const step = length / (count + 1);
    const result: number[] = [];
    for (let i = 1; i <= count; i++) {
      const at = step * i;
      if (Math.abs(at - length / 2) < 9) continue;
      result.push(at);
    }
    return result;
  };

  for (const offset of along(w)) {
    out.push({ type: "streetlight", x: x + offset, z: z - edge, rotation: 0 });
    out.push({ type: "streetlight", x: x + offset, z: z + d + edge, rotation: Math.PI });
  }
  for (const offset of along(d)) {
    out.push({ type: "streetlight", x: x - edge, z: z + offset, rotation: -Math.PI / 2 });
    out.push({ type: "streetlight", x: x + w + edge, z: z + offset, rotation: Math.PI / 2 });
  }

  // Benches flanking the middle of each edge, where the entrance is.
  for (const offset of [-13, 13]) {
    out.push({ type: "bench", x: x + w / 2 + offset, z: z - edge, rotation: 0 });
    out.push({ type: "bench", x: x + w / 2 + offset, z: z + d + edge, rotation: Math.PI });
    out.push({ type: "bench", x: x - edge, z: z + d / 2 + offset, rotation: -Math.PI / 2 });
    out.push({ type: "bench", x: x + w + edge, z: z + d / 2 + offset, rotation: Math.PI / 2 });
  }
}

function addParkProps(
  out: Prop[],
  x: number,
  z: number,
  w: number,
  d: number,
  centreX: number,
  centreZ: number,
) {
  // Author one north-west quadrant, then mirror it into the other three.
  const treeOffsets: Array<[number, number]> = [
    [14, 13],
    [35, 16],
    [58, 12],
    [18, 34],
    [43, 38],
    [65, 49],
    [12, 56],
  ];

  for (const [offsetX, offsetZ] of treeOffsets) {
    for (const mirrorX of [false, true]) {
      for (const mirrorZ of [false, true]) {
        out.push({
          type: "tree",
          x: mirrorX ? x + w - offsetX : x + offsetX,
          z: mirrorZ ? z + d - offsetZ : z + offsetZ,
          rotation: 0,
        });
      }
    }
  }

  // Low planted borders, mirrored at the four outer corners of the park.
  for (const offsetX of [8, 26, 44, 62]) {
    for (const mirrorX of [false, true]) {
      for (const mirrorZ of [false, true]) {
        out.push({
          type: "planter",
          x: mirrorX ? x + w - offsetX : x + offsetX,
          z: mirrorZ ? z + d - 5 : z + 5,
          rotation: 0,
        });
      }
    }
  }

  // Benches face the two crossing paths from matching positions.
  for (const offset of [-46, 46]) {
    out.push({ type: "bench", x: centreX + offset, z: centreZ - 6, rotation: 0 });
    out.push({ type: "bench", x: centreX + offset, z: centreZ + 6, rotation: Math.PI });
    out.push({
      type: "bench",
      x: centreX - 6,
      z: centreZ + offset,
      rotation: Math.PI / 2,
    });
    out.push({
      type: "bench",
      x: centreX + 6,
      z: centreZ + offset,
      rotation: -Math.PI / 2,
    });
  }

  // Park-edge lighting leaves every cardinal entrance open and symmetrical.
  for (const offset of [28, w - 28]) {
    out.push({ type: "streetlight", x: x + offset, z: z - 2.2, rotation: 0 });
    out.push({ type: "streetlight", x: x + offset, z: z + d + 2.2, rotation: Math.PI });
  }
  for (const offset of [24, d - 24]) {
    out.push({ type: "streetlight", x: x - 2.2, z: z + offset, rotation: -Math.PI / 2 });
    out.push({ type: "streetlight", x: x + w + 2.2, z: z + offset, rotation: Math.PI / 2 });
  }

  out.push({ type: "fountain", x: centreX, z: centreZ, rotation: 0 });
}

export const downtown = generateDowntown();
