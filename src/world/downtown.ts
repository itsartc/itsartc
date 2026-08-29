import type {
  Building,
  CityMap,
  District,
  FacadeStyle,
  Plaza,
  Prop,
  Road,
  Sidewalk,
} from "./schema";

/**
 * Generates "Downtown" — the launch city.
 *
 * Deterministic: the same seed always produces the same city, so the world is
 * reproducible across builds and machines without shipping a huge data file.
 * The generator is the authoring tool for now; the admin editor will later read
 * and write the same CityMap it produces.
 *
 * The layout is a Manhattan grid. Blocks are ringed with buildings around an
 * open core, which is what makes a city read as streets and frontage rather
 * than as scattered towers on a plane.
 */

/** Metres. Chosen so a block is walkable in a few seconds at 4.2 m/s. */
const ROAD_WIDTH = 14;
const SIDEWALK_WIDTH = 4.5;
const BLOCK_W = 74;
const BLOCK_D = 62;
const COLS = 6;
const ROWS = 5;

const FLOOR_HEIGHT = 3.6;

/** Mulberry32 — small, fast, and stable across engines. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DISTRICT_NAMES = [
  ["founder-cafe", "Founder Café", "#e0a53f"],
  ["ai-district", "AI District", "#a371f7"],
  ["investor-row", "Investor Row", "#d9a441"],
  ["hiring-hall", "Hiring Hall", "#3fb950"],
  ["builder-yard", "Builder Yard", "#ce7b3c"],
  ["after-hours", "After Hours", "#8b5cf6"],
];

/** Wall tints, multiplied over the façade texture so one texture serves many. */
const WALL_COLORS: Record<FacadeStyle, string[]> = {
  glass: ["#8fa9bd", "#7d97ab", "#9db4c4", "#6f8898"],
  tiles: ["#c9bda8", "#d6cbb6", "#b9ac95"],
  plaster: ["#cbb9a4", "#bda88f", "#d8c9b4"],
  concrete: ["#b4b4b0", "#a6a6a2", "#c2c1bc"],
};

export function generateDowntown(seed = 20260829): CityMap {
  const rand = rng(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

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

  // --- Roads: a full grid, avenues north-south and streets east-west --------
  for (let c = 0; c <= COLS; c++) {
    const x = c * strideX;
    roads.push({ id: `ave-${c}`, x, z: 0, w: ROAD_WIDTH, d: depth, axis: "z" });
  }
  for (let r = 0; r <= ROWS; r++) {
    const z = r * strideZ;
    roads.push({ id: `st-${r}`, x: 0, z, w: width, d: ROAD_WIDTH, axis: "x" });
  }

  // --- Blocks ---------------------------------------------------------------
  let districtIndex = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const bx = c * strideX + ROAD_WIDTH;
      const bz = r * strideZ + ROAD_WIDTH;

      // Pavement wraps the whole block.
      sidewalks.push({
        x: bx - SIDEWALK_WIDTH,
        z: bz - SIDEWALK_WIDTH,
        w: BLOCK_W + SIDEWALK_WIDTH * 2,
        d: BLOCK_D + SIDEWALK_WIDTH * 2,
      });

      // One block in the middle is left open as the central square.
      const isCentre = r === Math.floor(ROWS / 2) && c === Math.floor(COLS / 2);
      if (isCentre) {
        plazas.push({
          id: "plaza-central",
          name: "Central Square",
          x: bx,
          z: bz,
          w: BLOCK_W,
          d: BLOCK_D,
          surface: "paving",
        });
        districts.push({
          id: "central-square",
          name: "Central Square",
          x: bx + BLOCK_W / 2,
          z: bz + BLOCK_D / 2,
          accent: "#7dd3fc",
        });
        addBlockProps(props, bx, bz, rand, true);
        continue;
      }

      // A green block every so often, to break up the masonry.
      if (rand() < 0.1) {
        plazas.push({
          id: `park-${r}-${c}`,
          name: "Green",
          x: bx,
          z: bz,
          w: BLOCK_W,
          d: BLOCK_D,
          surface: "grass",
        });
        addBlockProps(props, bx, bz, rand, false, true);
        continue;
      }

      const districtId = assignDistrict(districts, districtIndex++, bx, bz);
      subdivideBlock(buildings, bx, bz, districtId, rand, pick);
      addBlockProps(props, bx, bz, rand);
    }
  }

  const spawnPlaza = plazas.find((p) => p.id === "plaza-central")!;

  return {
    id: "downtown",
    name: "Downtown",
    version: 1,
    size: { w: width, d: depth },
    spawn: { x: spawnPlaza.x + spawnPlaza.w / 2, z: spawnPlaza.z + spawnPlaza.d / 2 },
    districts,
    roads,
    sidewalks,
    plazas,
    buildings,
    props,
  };
}

/** Names the first few blocks after the product's districts, then numbers the rest. */
function assignDistrict(districts: District[], index: number, x: number, z: number): string {
  if (index < DISTRICT_NAMES.length) {
    const [id, name, accent] = DISTRICT_NAMES[index];
    districts.push({ id, name, x: x + BLOCK_W / 2, z: z + BLOCK_D / 2, accent });
    return id;
  }
  return `block-${index}`;
}

/**
 * Fills a block with buildings around its perimeter.
 *
 * Real blocks present continuous frontage to the street with a service core
 * behind, so buildings are laid along each edge rather than scattered. Widths
 * vary along the run so the skyline doesn't read as a repeated unit.
 */
function subdivideBlock(
  out: Building[],
  bx: number,
  bz: number,
  districtId: string,
  rand: () => number,
  pick: <T>(a: T[]) => T,
) {
  const depthOf = () => 16 + rand() * 8;

  const runs: Array<{ along: "x" | "z"; x: number; z: number; length: number; facing: number }> = [
    { along: "x", x: bx, z: bz, length: BLOCK_W, facing: -1 },
    { along: "x", x: bx, z: bz + BLOCK_D, length: BLOCK_W, facing: 1 },
    { along: "z", x: bx, z: bz, length: BLOCK_D, facing: -1 },
    { along: "z", x: bx + BLOCK_W, z: bz, length: BLOCK_D, facing: 1 },
  ];

  let n = 0;
  for (const run of runs) {
    let offset = 0;
    while (offset < run.length - 8) {
      const span = Math.min(12 + rand() * 14, run.length - offset);
      if (span < 8) break;

      const dep = depthOf();
      const floors = 3 + Math.floor(rand() * 14);
      const style: FacadeStyle =
        floors > 12 ? "glass" : pick<FacadeStyle>(["tiles", "plaster", "concrete", "glass"]);

      const bldX = run.along === "x" ? run.x + offset : run.facing < 0 ? run.x : run.x - dep;
      const bldZ = run.along === "x" ? (run.facing < 0 ? run.z : run.z - dep) : run.z + offset;
      const bldW = run.along === "x" ? span : dep;
      const bldD = run.along === "x" ? dep : span;

      const id = `b-${Math.round(bx)}-${Math.round(bz)}-${n++}`;
      out.push({
        id,
        name: `${districtId} ${n}`,
        districtId,
        x: bldX,
        z: bldZ,
        w: bldW,
        d: bldD,
        height: floors * 3.6,
        floors,
        style,
        color: pick(WALL_COLORS[style]),
        entrance:
          run.along === "x"
            ? { x: bldX + bldW / 2, z: run.facing < 0 ? bldZ : bldZ + bldD }
            : { x: run.facing < 0 ? bldX : bldX + bldW, z: bldZ + bldD / 2 },
        sponsor: null,
      });

      offset += span + 0.6;
    }
  }
}

/** Street furniture along the block edges, and trees inside open blocks. */
function addBlockProps(
  out: Prop[],
  bx: number,
  bz: number,
  rand: () => number,
  isPlaza = false,
  isPark = false,
) {
  const inset = 2.2;

  // Lamps at a regular pitch down each side; kerbside clutter between them.
  for (let x = bx + 6; x < bx + BLOCK_W - 4; x += 18) {
    out.push({ type: "streetlight", x, z: bz - inset, rotation: 0 });
    out.push({ type: "streetlight", x, z: bz + BLOCK_D + inset, rotation: Math.PI });
    if (rand() < 0.5) out.push({ type: "bin", x: x + 6, z: bz - inset, rotation: rand() * 6.28 });
    if (rand() < 0.4) {
      out.push({ type: "bench", x: x + 9, z: bz + BLOCK_D + inset, rotation: Math.PI });
    }
  }
  for (let z = bz + 8; z < bz + BLOCK_D - 4; z += 18) {
    out.push({ type: "streetlight", x: bx - inset, z, rotation: -Math.PI / 2 });
    out.push({ type: "streetlight", x: bx + BLOCK_W + inset, z, rotation: Math.PI / 2 });
    if (rand() < 0.45) out.push({ type: "tree", x: bx - inset, z: z + 8, rotation: rand() * 6.28 });
    if (rand() < 0.45) {
      out.push({ type: "tree", x: bx + BLOCK_W + inset, z: z + 8, rotation: rand() * 6.28 });
    }
  }

  if (isPark) {
    for (let i = 0; i < 22; i++) {
      out.push({
        type: "tree",
        x: bx + 6 + rand() * (BLOCK_W - 12),
        z: bz + 6 + rand() * (BLOCK_D - 12),
        rotation: rand() * 6.28,
      });
    }
  }

  if (isPlaza) {
    for (let i = 0; i < 10; i++) {
      out.push({
        type: "planter",
        x: bx + 8 + rand() * (BLOCK_W - 16),
        z: bz + 8 + rand() * (BLOCK_D - 16),
        rotation: rand() * 6.28,
      });
      out.push({
        type: "bench",
        x: bx + 8 + rand() * (BLOCK_W - 16),
        z: bz + 8 + rand() * (BLOCK_D - 16),
        rotation: rand() * 6.28,
      });
    }
  }
}

export const downtown = generateDowntown();
