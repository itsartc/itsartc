import type { Building, CityMap, District, FacadeStyle, Plaza, Prop, Road, Sidewalk } from "./schema";

/**
 * Generates Downtown as a compact, symmetrical launch city.
 *
 * A three-by-three grid of nine equal square cells. The middle one is the
 * park; the other eight are districts. Every block is the same size, so every
 * building is the same size, and the plan reads as the diagram it is.
 *
 * An earlier attempt kept the park at its old two-by-two dimensions by making
 * the middle column and row wider than the outer ones. That is arithmetically
 * a three-by-three, but it stretched the four cardinal buildings to 150 and
 * 126 metres — three times the length of the corners — which is not what a
 * three-by-three should look like. Equal cells, equal buildings.
 *
 * Everything is mirrored across both map axes. District identities differ, but
 * opposite blocks share footprint, height, material family and street
 * furniture, so the plan reads as intentionally symmetrical.
 */

/** Metres. One constant sets the whole city's scale. */
const BLOCK = 88;
const ROAD_WIDTH = 14;
const SIDEWALK_WIDTH = 4.5;
const COLS = 3;
const ROWS = 3;
/** Grid pitch, and the map's overall extent. */
const STRIDE = BLOCK + ROAD_WIDTH;
const MAP_SPAN = COLS * STRIDE + ROAD_WIDTH;

const FLOOR_HEIGHT = 3.6;
const PATH_WIDTH = 8;
const BUILDING_INSET = 6;

type DistrictSpec = readonly [id: string, name: string, accent: string];

/**
 * The eight districts, one per block.
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

interface BuildingTemplate {
  floors: number;
  style: FacadeStyle;
  color: string;
}

/**
 * Two mirrored families. The corners are lower than the four blocks facing the
 * park head-on, which is the only variation left once every footprint matches
 * — and it is symmetric across both axes.
 */
function buildingTemplate(row: number, col: number): BuildingTemplate {
  const corner = (row === 0 || row === ROWS - 1) && (col === 0 || col === COLS - 1);
  return corner
    ? { floors: 7, style: "concrete", color: "#aeb5b8" }
    : { floors: 9, style: "glass", color: "#879faf" };
}

export function generateDowntown(_seed = 20260829): CityMap {
  const roads: Road[] = [];
  const sidewalks: Sidewalk[] = [];
  const buildings: Building[] = [];
  const props: Prop[] = [];
  const plazas: Plaza[] = [];
  const districts: District[] = [];

  /** Where a cell starts, given its row or column index. */
  const cell = (index: number) => index * STRIDE + ROAD_WIDTH;

  const parkX = cell(1);
  const parkZ = cell(1);
  const centreX = parkX + BLOCK / 2;
  const centreZ = parkZ + BLOCK / 2;

  // --- Roads ---------------------------------------------------------------
  // No road crosses the park: its four edges are grid roads.
  for (let col = 0; col <= COLS; col++) {
    roads.push({ id: `ave-${col}`, x: col * STRIDE, z: 0, w: ROAD_WIDTH, d: MAP_SPAN, axis: "z" });
  }
  for (let row = 0; row <= ROWS; row++) {
    roads.push({ id: `street-${row}`, x: 0, z: row * STRIDE, w: MAP_SPAN, d: ROAD_WIDTH, axis: "x" });
  }

  // --- Building blocks -----------------------------------------------------
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (isParkBlock(row, col)) continue;

      const blockX = cell(col);
      const blockZ = cell(row);
      const district = DISTRICTS_BY_BLOCK[`${row}-${col}`];
      if (!district) throw new Error(`Missing district for block ${row},${col}`);

      sidewalks.push(blockSidewalk(blockX, blockZ));
      addDistrictAndBuilding(districts, buildings, row, col, blockX, blockZ, district);
      addBlockProps(props, blockX, blockZ);
    }
  }

  // --- Central park --------------------------------------------------------
  // One pavement slab under the park guarantees a clean base at its edges.
  sidewalks.push({
    x: parkX - SIDEWALK_WIDTH,
    z: parkZ - SIDEWALK_WIDTH,
    w: BLOCK + SIDEWALK_WIDTH * 2,
    d: BLOCK + SIDEWALK_WIDTH * 2,
  });

  addParkSurfaces(plazas, parkX, parkZ, BLOCK, BLOCK, centreX, centreZ);
  addParkProps(props, parkX, parkZ, BLOCK, BLOCK, centreX, centreZ);

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
    version: 4,
    size: { w: MAP_SPAN, d: MAP_SPAN },
    // Arrive just south of the fountain rather than inside its collider.
    spawn: { x: centreX, z: centreZ - 13 },
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

function blockSidewalk(x: number, z: number): Sidewalk {
  return {
    x: x - SIDEWALK_WIDTH,
    z: z - SIDEWALK_WIDTH,
    w: BLOCK + SIDEWALK_WIDTH * 2,
    d: BLOCK + SIDEWALK_WIDTH * 2,
  };
}

function addDistrictAndBuilding(
  districts: District[],
  buildings: Building[],
  row: number,
  col: number,
  blockX: number,
  blockZ: number,
  district: DistrictSpec,
) {
  const [id, name, accent] = district;
  const template = buildingTemplate(row, col);
  const x = blockX + BUILDING_INSET;
  const z = blockZ + BUILDING_INSET;
  const size = BLOCK - BUILDING_INSET * 2;

  districts.push({ id, name, x: blockX + BLOCK / 2, z: blockZ + BLOCK / 2, accent });

  // Every entrance faces the park.
  const entrance =
    row === 0
      ? { x: x + size / 2, z: z + size }
      : row === ROWS - 1
        ? { x: x + size / 2, z }
        : col === 0
          ? { x: x + size, z: z + size / 2 }
          : { x, z: z + size / 2 };

  buildings.push({
    id: `building-${id}`,
    name,
    districtId: id,
    x,
    z,
    w: size,
    d: size,
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
function addBlockProps(out: Prop[], x: number, z: number) {
  const edge = 2.2;
  const w = BLOCK;
  const d = BLOCK;

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

/**
 * Park planting, placed as fractions of the park rather than in metres.
 *
 * The offsets used to be absolute, authored against a 162-by-138 park; at the
 * park's present size the outermost trees would have crossed over each other
 * when mirrored. Fractions survive a change of scale, which is the whole point
 * of having one constant set the city's size.
 */
function addParkProps(
  out: Prop[],
  x: number,
  z: number,
  w: number,
  d: number,
  centreX: number,
  centreZ: number,
) {
  // Authored once for the north-west quadrant, then mirrored into the other
  // three. Every fraction is below 0.5 so nothing crosses the centre paths.
  const trees: Array<[number, number]> = [
    [0.1, 0.13],
    [0.26, 0.29],
    [0.4, 0.12],
    [0.13, 0.4],
    // Kept off the crossing paths, which are each district's axial view.
    [0.3, 0.38],
  ];

  for (const [fx, fz] of trees) {
    for (const mirrorX of [false, true]) {
      for (const mirrorZ of [false, true]) {
        out.push({
          type: "tree",
          x: mirrorX ? x + w * (1 - fx) : x + w * fx,
          z: mirrorZ ? z + d * (1 - fz) : z + d * fz,
          rotation: 0,
        });
      }
    }
  }

  // Low planted borders along the park's four edges.
  for (const fraction of [0.11, 0.29]) {
    for (const mirrorX of [false, true]) {
      for (const mirrorZ of [false, true]) {
        const px = mirrorX ? x + w * (1 - fraction) : x + w * fraction;
        const pz = mirrorZ ? z + d - 5 : z + 5;
        out.push({ type: "planter", x: px, z: pz, rotation: 0 });
      }
    }
  }

  // Benches face the two crossing paths from matching positions.
  for (const offset of [-w * 0.29, w * 0.29]) {
    out.push({ type: "bench", x: centreX + offset, z: centreZ - 6, rotation: 0 });
    out.push({ type: "bench", x: centreX + offset, z: centreZ + 6, rotation: Math.PI });
    out.push({ type: "bench", x: centreX - 6, z: centreZ + offset, rotation: Math.PI / 2 });
    out.push({ type: "bench", x: centreX + 6, z: centreZ + offset, rotation: -Math.PI / 2 });
  }

  // Park-edge lighting, leaving every cardinal entrance open and symmetrical.
  for (const fraction of [0.25, 0.75]) {
    out.push({ type: "streetlight", x: x + w * fraction, z: z - 2.2, rotation: 0 });
    out.push({ type: "streetlight", x: x + w * fraction, z: z + d + 2.2, rotation: Math.PI });
    out.push({ type: "streetlight", x: x - 2.2, z: z + d * fraction, rotation: -Math.PI / 2 });
    out.push({ type: "streetlight", x: x + w + 2.2, z: z + d * fraction, rotation: Math.PI / 2 });
  }

  out.push({ type: "fountain", x: centreX, z: centreZ, rotation: 0 });
}

export const downtown = generateDowntown();
