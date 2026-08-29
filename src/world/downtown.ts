import type { Building, CityMap, District, FacadeStyle, Plaza, Prop, Road, Sidewalk } from "./schema";

/**
 * Generates Downtown as a compact, symmetrical launch city.
 *
 * Twelve mixed-use building blocks surround a two-by-two central park. The
 * park replaces the vehicle roads that would normally divide its four blocks
 * with pedestrian paths, giving the world one clear landmark and keeping every
 * district close enough to reach on foot.
 *
 * Geometry and props are mirrored across both map axes. District identities
 * differ, but opposite blocks share footprint, height, material family and
 * street furniture so the plan reads as intentionally symmetrical.
 */

/** Metres. Four blocks produce a city approximately 366 × 318 metres. */
const ROAD_WIDTH = 14;
const SIDEWALK_WIDTH = 4.5;
const BLOCK_W = 74;
const BLOCK_D = 62;
const COLS = 4;
const ROWS = 4;

const FLOOR_HEIGHT = 3.6;
const PATH_WIDTH = 8;
const BUILDING_INSET_X = 6;
const BUILDING_INSET_Z = 6;

type DistrictSpec = readonly [id: string, name: string, accent: string];

const DISTRICTS_BY_BLOCK: Record<string, DistrictSpec> = {
  "0-0": ["founder-cafe", "Founder Café", "#e0a53f"],
  "0-1": ["ai-district", "AI District", "#a371f7"],
  "0-2": ["hiring-hall", "Hiring Hall", "#3fb950"],
  "0-3": ["investor-row", "Investor Row", "#d9a441"],
  "1-0": ["builder-yard", "Builder Yard", "#ce7b3c"],
  "1-3": ["after-hours", "After Hours", "#8b5cf6"],
  "2-0": ["learning-hub", "Learning Hub", "#58a6ff"],
  "2-3": ["creative-studios", "Creative Studios", "#db61a2"],
  "3-0": ["community-hall", "Community Hall", "#56d364"],
  "3-1": ["shops", "Shops", "#f2cc60"],
  "3-2": ["event-hall", "Event Hall", "#ff7b72"],
  "3-3": ["member-lounge", "Member Lounge", "#79c0ff"],
};

interface BuildingTemplate {
  floors: number;
  style: FacadeStyle;
  color: string;
}

/**
 * Three mirrored building families. Every position in a family is reflected
 * across one or both axes, so skyline, massing and façade treatment balance.
 */
function buildingTemplate(row: number, col: number): BuildingTemplate {
  const onOuterRow = row === 0 || row === ROWS - 1;
  const onOuterCol = col === 0 || col === COLS - 1;

  if (onOuterRow && onOuterCol) {
    return { floors: 7, style: "concrete", color: "#aeb5b8" };
  }
  if (onOuterRow) {
    return { floors: 9, style: "glass", color: "#879faf" };
  }
  return { floors: 6, style: "tiles", color: "#c3b9a7" };
}

export function generateDowntown(_seed = 20260829): CityMap {
  const strideX = BLOCK_W + ROAD_WIDTH;
  const strideZ = BLOCK_D + ROAD_WIDTH;
  const width = COLS * strideX + ROAD_WIDTH;
  const depth = ROWS * strideZ + ROAD_WIDTH;

  const roads: Road[] = [];
  const sidewalks: Sidewalk[] = [];
  const buildings: Building[] = [];
  const props: Prop[] = [];
  const plazas: Plaza[] = [];
  const districts: District[] = [];

  const parkX = strideX + ROAD_WIDTH;
  const parkZ = strideZ + ROAD_WIDTH;
  const parkW = BLOCK_W * 2 + ROAD_WIDTH;
  const parkD = BLOCK_D * 2 + ROAD_WIDTH;
  const parkMaxX = parkX + parkW;
  const parkMaxZ = parkZ + parkD;
  const centreX = parkX + parkW / 2;
  const centreZ = parkZ + parkD / 2;

  // --- Roads ---------------------------------------------------------------
  // The middle avenue stops at the park's north and south entrances.
  for (let col = 0; col <= COLS; col++) {
    const x = col * strideX;
    if (col === COLS / 2) {
      roads.push({ id: "ave-centre-north", x, z: 0, w: ROAD_WIDTH, d: parkZ, axis: "z" });
      roads.push({
        id: "ave-centre-south",
        x,
        z: parkMaxZ,
        w: ROAD_WIDTH,
        d: depth - parkMaxZ,
        axis: "z",
      });
    } else {
      roads.push({ id: `ave-${col}`, x, z: 0, w: ROAD_WIDTH, d: depth, axis: "z" });
    }
  }

  // The middle street likewise becomes the park's east-west walking path.
  for (let row = 0; row <= ROWS; row++) {
    const z = row * strideZ;
    if (row === ROWS / 2) {
      roads.push({ id: "street-centre-west", x: 0, z, w: parkX, d: ROAD_WIDTH, axis: "x" });
      roads.push({
        id: "street-centre-east",
        x: parkMaxX,
        z,
        w: width - parkMaxX,
        d: ROAD_WIDTH,
        axis: "x",
      });
    } else {
      roads.push({ id: `street-${row}`, x: 0, z, w: width, d: ROAD_WIDTH, axis: "x" });
    }
  }

  // --- Outer building blocks ----------------------------------------------
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (isParkBlock(row, col)) continue;

      const blockX = col * strideX + ROAD_WIDTH;
      const blockZ = row * strideZ + ROAD_WIDTH;
      const district = DISTRICTS_BY_BLOCK[`${row}-${col}`];
      if (!district) throw new Error(`Missing district for block ${row},${col}`);

      sidewalks.push(blockSidewalk(blockX, blockZ));
      addDistrictAndBuilding(districts, buildings, row, col, blockX, blockZ, district);
      addSymmetricBlockProps(props, blockX, blockZ);
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
    version: 2,
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
  return row >= 1 && row <= 2 && col >= 1 && col <= 2;
}

function blockSidewalk(x: number, z: number): Sidewalk {
  return {
    x: x - SIDEWALK_WIDTH,
    z: z - SIDEWALK_WIDTH,
    w: BLOCK_W + SIDEWALK_WIDTH * 2,
    d: BLOCK_D + SIDEWALK_WIDTH * 2,
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
  const x = blockX + BUILDING_INSET_X;
  const z = blockZ + BUILDING_INSET_Z;
  const w = BLOCK_W - BUILDING_INSET_X * 2;
  const d = BLOCK_D - BUILDING_INSET_Z * 2;

  districts.push({ id, name, x: blockX + BLOCK_W / 2, z: blockZ + BLOCK_D / 2, accent });

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

/** Identical furniture on every outer block keeps both map axes balanced. */
function addSymmetricBlockProps(out: Prop[], x: number, z: number) {
  const edge = 2.2;
  // Paired positions keep the middle of every façade clear for its entrance.
  for (const offset of [13, 25, 49, 61]) {
    out.push({ type: "streetlight", x: x + offset, z: z - edge, rotation: 0 });
    out.push({ type: "streetlight", x: x + offset, z: z + BLOCK_D + edge, rotation: Math.PI });
  }
  for (const offset of [12, 22, 40, 50]) {
    out.push({ type: "streetlight", x: x - edge, z: z + offset, rotation: -Math.PI / 2 });
    out.push({ type: "streetlight", x: x + BLOCK_W + edge, z: z + offset, rotation: Math.PI / 2 });
  }
  for (const offset of [-12, 12]) {
    out.push({ type: "bench", x: x + BLOCK_W / 2 + offset, z: z - edge, rotation: 0 });
    out.push({
      type: "bench",
      x: x + BLOCK_W / 2 + offset,
      z: z + BLOCK_D + edge,
      rotation: Math.PI,
    });
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
