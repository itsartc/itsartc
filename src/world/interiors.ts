import type { Interior, PersonSeed, SubArea, TerrainType, WorldObject } from "./schema";

/**
 * Building interiors (Phase 1F).
 *
 * Each enterable building in `townCentral` declares an `interiorId`; this file
 * supplies the matching interior map. They live apart from the outdoor world
 * data because they are independent surfaces — an interior is not a region of
 * the outdoor map, and its size has nothing to do with the building's footprint.
 *
 * Every interior is built by `room()`, which lays down the enclosure so authors
 * (and later the admin editor) only describe what makes each place different:
 * its floor, its zoned areas, its props and its people.
 */

/** Interior tile size matches the outdoor world so one player speed serves both. */
const TILE = 32;

interface RoomSpec {
  id: string;
  name: string;
  buildingId: string;
  districtId: string;
  floor: TerrainType;
  w: number;
  h: number;
  /** Extra solid rectangles inside the room: counters, partitions, stages. */
  partitions?: { x: number; y: number; w: number; h: number }[];
  terrain?: Interior["terrain"];
  subAreas?: SubArea[];
  objects?: WorldObject[];
  people?: PersonSeed[];
}

/**
 * Wraps a room in a one-tile perimeter wall with a door gap at the bottom
 * centre, and places spawn just inside it.
 *
 * The perimeter is authored as four explicit rectangles rather than implied by
 * the map edge, so a later interior can open a wall, add a second door, or run
 * a partition across the room without the renderer or collision needing to
 * special-case anything.
 */
function room(spec: RoomSpec): Interior {
  const { w, h } = spec;
  const doorX = Math.floor(w / 2);

  const walls = [
    { x: 0, y: 0, w, h: 1 }, // north
    { x: 0, y: h - 1, w: doorX, h: 1 }, // south, left of the door
    { x: doorX + 1, y: h - 1, w: w - doorX - 1, h: 1 }, // south, right of the door
    { x: 0, y: 1, w: 1, h: h - 2 }, // west
    { x: w - 1, y: 1, w: 1, h: h - 2 }, // east
    ...(spec.partitions ?? []),
  ];

  return {
    id: spec.id,
    name: spec.name,
    buildingId: spec.buildingId,
    districtId: spec.districtId,
    tileSize: TILE,
    widthTiles: w,
    heightTiles: h,
    baseTerrain: spec.floor,
    terrain: spec.terrain ?? [],
    spawn: { x: doorX, y: h - 2 },
    exit: { x: doorX, y: h - 1 },
    walls,
    objects: spec.objects ?? [],
    subAreas: spec.subAreas,
    people: spec.people,
  };
}

/** Terse sub-area helper — every interior area is a labelled gathering spot. */
function area(
  id: string,
  name: string,
  interiorId: string,
  districtId: string,
  buildingId: string,
  subcategory: string,
  kind: SubArea["kind"],
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
): SubArea {
  return {
    id, name, districtId, venueId: buildingId, interiorId,
    subcategory, kind, x, y, w, h, accent,
  };
}

/** Terse object helper. */
function obj(
  id: string,
  type: WorldObject["type"],
  x: number,
  y: number,
  label?: string,
  solid = true,
): WorldObject {
  return { id, type, x, y, label, solid };
}

export const interiors: Interior[] = [
  // --- Founder Café -------------------------------------------------------
  room({
    id: "int-founder-cafe",
    name: "Founder Café",
    buildingId: "b-founder-cafe",
    districtId: "founder-cafe",
    floor: "wood",
    w: 22,
    h: 16,
    // The counter runs along the north wall.
    partitions: [{ x: 3, y: 2, w: 8, h: 1 }],
    terrain: [
      { type: "carpet", x: 13, y: 3, w: 7, h: 5 },
      { type: "tile", x: 2, y: 1, w: 10, h: 2 },
    ],
    subAreas: [
      area("sa-int-cafe-ai", "AI Table", "int-founder-cafe", "founder-cafe", "b-founder-cafe", "AI", "seating", 3, 5, 4, 3, "#a371f7"),
      area("sa-int-cafe-saas", "SaaS Table", "int-founder-cafe", "founder-cafe", "b-founder-cafe", "SaaS", "seating", 9, 5, 4, 3, "#5b9bd5"),
      area("sa-int-cafe-fintech", "Fintech Table", "int-founder-cafe", "founder-cafe", "b-founder-cafe", "Fintech", "seating", 3, 10, 4, 3, "#3fb950"),
      area("sa-int-cafe-raising", "Raising Now", "int-founder-cafe", "founder-cafe", "b-founder-cafe", "Raising Now", "booth", 9, 10, 4, 3, "#d9a441"),
      area("sa-int-cafe-investor", "Investor Corner", "int-founder-cafe", "founder-cafe", "b-founder-cafe", "Investing", "lounge", 14, 4, 6, 4, "#e3b341"),
      area("sa-int-cafe-cofounder", "Cofounder Search", "int-founder-cafe", "founder-cafe", "b-founder-cafe", "Cofounder Search", "booth", 15, 10, 5, 3, "#e06c9f"),
    ],
    objects: [
      obj("io-cafe-sign", "sign", 11, 3, "Founder Café"),
      obj("io-cafe-t1", "table", 4, 6),
      obj("io-cafe-t2", "table", 10, 6),
      obj("io-cafe-t3", "table", 4, 11),
      obj("io-cafe-t4", "table", 10, 11),
      obj("io-cafe-b1", "bench", 6, 6),
      obj("io-cafe-b2", "bench", 12, 6),
      obj("io-cafe-b3", "bench", 6, 11),
      obj("io-cafe-b4", "bench", 12, 11),
      obj("io-cafe-sofa1", "bench", 16, 6),
      obj("io-cafe-sofa2", "bench", 18, 6),
      obj("io-cafe-p1", "planter", 20, 2),
      obj("io-cafe-p2", "planter", 1, 13),
      obj("io-cafe-l1", "lamp", 7, 3, undefined, false),
      obj("io-cafe-l2", "lamp", 17, 3, undefined, false),
      obj("io-cafe-l3", "lamp", 7, 13, undefined, false),
      obj("io-cafe-l4", "lamp", 17, 13, undefined, false),
    ],
    people: [
      {
        id: "p-int-cafe-lena", name: "Lena Fischer", role: "Founder", company: "Tabular",
        location: "Berlin", intent: "raising",
        bio: "Data tooling for finance teams. Second-time founder.",
        workingOn: "Seed round", lookingFor: "Fintech angels",
        x: 5, y: 7, palette: { skin: "#f0c8a0", hair: "#5a3a1f", top: "#3fb950", bottom: "#2f3b4a" }, wander: 2,
      },
      {
        id: "p-int-cafe-omar", name: "Omar Haddad", role: "ML Lead", company: "Vecta",
        location: "Amsterdam", intent: "cofounder",
        bio: "Retrieval + evals. Want a commercial cofounder.",
        workingOn: "Agent eval harness", lookingFor: "A GTM cofounder",
        x: 11, y: 7, palette: { skin: "#c98a5b", hair: "#1a1a1a", top: "#a371f7", bottom: "#333" }, wander: 2,
      },
      {
        id: "p-int-cafe-sara", name: "Sara Lindqvist", role: "Partner", company: "Norrsken Ventures",
        location: "Stockholm", intent: "open_to_chat",
        bio: "Pre-seed cheques across the Nordics. Always up for a coffee.",
        workingOn: "New fund close", lookingFor: "Technical founders",
        x: 17, y: 6, palette: { skin: "#e8b48c", hair: "#c9a227", top: "#d9a441", bottom: "#2f2f2f" }, wander: 2,
      },
    ],
  }),

  // --- AI Labs ------------------------------------------------------------
  room({
    id: "int-ai-labs",
    name: "AI Labs",
    buildingId: "b-ai-labs",
    districtId: "ai-district",
    floor: "concrete",
    w: 22,
    h: 16,
    partitions: [{ x: 10, y: 3, w: 1, h: 8 }],
    terrain: [
      { type: "tile", x: 1, y: 1, w: 9, h: 13 },
      { type: "carpet", x: 12, y: 3, w: 8, h: 6 },
    ],
    subAreas: [
      area("sa-int-ai-research", "Research Bay", "int-ai-labs", "ai-district", "b-ai-labs", "Research", "section", 2, 3, 7, 5, "#a371f7"),
      area("sa-int-ai-infra", "Infra Bench", "int-ai-labs", "ai-district", "b-ai-labs", "Infra", "section", 2, 9, 7, 4, "#5b9bd5"),
      area("sa-int-ai-demo", "Demo Lounge", "int-ai-labs", "ai-district", "b-ai-labs", "Demos", "lounge", 12, 3, 8, 6, "#3fb950"),
      area("sa-int-ai-hiring", "Hiring Desk", "int-ai-labs", "ai-district", "b-ai-labs", "Hiring", "booth", 13, 10, 6, 3, "#e06c9f"),
    ],
    objects: [
      obj("io-ai-sign", "sign", 11, 2, "AI Labs"),
      obj("io-ai-screen", "billboard", 16, 2, "Now demoing"),
      obj("io-ai-t1", "table", 3, 5),
      obj("io-ai-t2", "table", 6, 5),
      obj("io-ai-t3", "table", 3, 10),
      obj("io-ai-t4", "table", 6, 10),
      obj("io-ai-b1", "bench", 13, 6),
      obj("io-ai-b2", "bench", 15, 6),
      obj("io-ai-b3", "bench", 17, 6),
      obj("io-ai-p1", "planter", 20, 13),
      obj("io-ai-l1", "lamp", 5, 2, undefined, false),
      obj("io-ai-l2", "lamp", 16, 12, undefined, false),
      obj("io-ai-l3", "lamp", 5, 13, undefined, false),
    ],
    people: [
      {
        id: "p-int-ai-kai", name: "Kai Tanaka", role: "Research Engineer", company: "Vecta",
        location: "Tokyo", intent: "feedback",
        bio: "Long-context retrieval. Publishing soon.",
        workingOn: "A new eval benchmark", lookingFor: "Reviewers who'll be harsh",
        x: 5, y: 6, palette: { skin: "#f2d0ae", hair: "#1a1a1a", top: "#5b9bd5", bottom: "#2f2f2f" }, wander: 2,
      },
      {
        id: "p-int-ai-nadia", name: "Nadia Rahman", role: "Head of Talent", company: "Vecta",
        location: "London", intent: "hiring",
        bio: "Hiring applied-AI engineers. Fast process, no take-homes.",
        workingOn: "Scaling the research team", lookingFor: "ML engineers",
        x: 15, y: 11, palette: { skin: "#c98a5b", hair: "#2a1a10", top: "#e06c9f", bottom: "#333" }, wander: 1,
      },
    ],
  }),

  // --- Event Hall ---------------------------------------------------------
  room({
    id: "int-event-hall",
    name: "Event Hall",
    buildingId: "b-event-hall",
    districtId: "event-hall",
    floor: "carpet",
    w: 24,
    h: 18,
    // Raised stage across the north end.
    partitions: [{ x: 6, y: 2, w: 12, h: 2 }],
    terrain: [
      { type: "wood", x: 5, y: 1, w: 14, h: 4 },
      { type: "tile", x: 1, y: 14, w: 22, h: 3 },
    ],
    subAreas: [
      area("sa-int-hall-stage", "Stage", "int-event-hall", "event-hall", "b-event-hall", "Talks", "stage", 6, 2, 12, 3, "#5b9bd5"),
      area("sa-int-hall-front", "Front Rows", "int-event-hall", "event-hall", "b-event-hall", "Talks", "seating", 6, 6, 12, 4, "#a371f7"),
      area("sa-int-hall-back", "Back Rows", "int-event-hall", "event-hall", "b-event-hall", "Talks", "seating", 6, 11, 12, 3, "#8b98a5"),
      area("sa-int-hall-foyer", "Foyer", "int-event-hall", "event-hall", "b-event-hall", "Networking", "lounge", 2, 14, 20, 3, "#3fb950"),
    ],
    objects: [
      obj("io-hall-banner", "billboard", 11, 1, "Demo Night — 19:00"),
      obj("io-hall-b1", "bench", 7, 7),
      obj("io-hall-b2", "bench", 10, 7),
      obj("io-hall-b3", "bench", 13, 7),
      obj("io-hall-b4", "bench", 16, 7),
      obj("io-hall-b5", "bench", 7, 12),
      obj("io-hall-b6", "bench", 10, 12),
      obj("io-hall-b7", "bench", 13, 12),
      obj("io-hall-b8", "bench", 16, 12),
      obj("io-hall-p1", "planter", 1, 15),
      obj("io-hall-p2", "planter", 22, 15),
      obj("io-hall-l1", "lamp", 4, 3, undefined, false),
      obj("io-hall-l2", "lamp", 19, 3, undefined, false),
      obj("io-hall-l3", "lamp", 4, 15, undefined, false),
      obj("io-hall-l4", "lamp", 19, 15, undefined, false),
    ],
    people: [
      {
        id: "p-int-hall-tom", name: "Tom Bergström", role: "Community Lead", company: "itsartc",
        location: "Copenhagen", intent: "open_to_chat",
        bio: "I run the demo nights. Ask me who you should meet.",
        workingOn: "Tonight's line-up", lookingFor: "Speakers for next month",
        x: 11, y: 15, palette: { skin: "#f0c8a0", hair: "#8a5a2f", top: "#3fb950", bottom: "#2f3b4a" }, wander: 3,
      },
    ],
  }),

  // --- Hiring Hall --------------------------------------------------------
  room({
    id: "int-hiring-hall",
    name: "Hiring Hall",
    buildingId: "b-hiring-hall",
    districtId: "hiring-hall",
    floor: "tile",
    w: 20,
    h: 15,
    partitions: [
      { x: 5, y: 4, w: 1, h: 7 },
      { x: 13, y: 4, w: 1, h: 7 },
    ],
    terrain: [{ type: "carpet", x: 6, y: 4, w: 7, h: 7 }],
    subAreas: [
      area("sa-int-hire-eng", "Engineering", "int-hiring-hall", "hiring-hall", "b-hiring-hall", "Engineering", "booth", 1, 4, 4, 7, "#5b9bd5"),
      area("sa-int-hire-open", "Open to Work", "int-hiring-hall", "hiring-hall", "b-hiring-hall", "Open to work", "lounge", 6, 4, 7, 7, "#a371f7"),
      area("sa-int-hire-gtm", "Sales & GTM", "int-hiring-hall", "hiring-hall", "b-hiring-hall", "GTM", "booth", 14, 4, 5, 7, "#3fb950"),
    ],
    objects: [
      obj("io-hire-sign", "sign", 10, 2, "Hiring Hall"),
      obj("io-hire-board", "billboard", 4, 2, "Open roles"),
      obj("io-hire-t1", "table", 2, 6),
      obj("io-hire-t2", "table", 16, 6),
      obj("io-hire-b1", "bench", 8, 6),
      obj("io-hire-b2", "bench", 10, 6),
      obj("io-hire-b3", "bench", 8, 9),
      obj("io-hire-b4", "bench", 10, 9),
      obj("io-hire-l1", "lamp", 3, 12, undefined, false),
      obj("io-hire-l2", "lamp", 16, 12, undefined, false),
    ],
    people: [
      {
        id: "p-int-hire-priya", name: "Priya Raman", role: "Talent Partner", company: "Northwind",
        location: "Bangalore", intent: "hiring",
        bio: "I place engineers into seed-stage teams across Europe.",
        workingOn: "12 open roles", lookingFor: "Backend and infra engineers",
        x: 3, y: 7, palette: { skin: "#c98a5b", hair: "#1a1a1a", top: "#5b9bd5", bottom: "#333" }, wander: 1,
      },
      {
        id: "p-int-hire-jonas", name: "Jonas Weber", role: "Staff Engineer", company: "(open)",
        location: "Munich", intent: "open_to_work",
        bio: "15 years backend. Distributed systems. Open to staff roles.",
        workingOn: "A Rust side project", lookingFor: "A small team with hard problems",
        x: 9, y: 7, palette: { skin: "#f2d0ae", hair: "#3a2a1a", top: "#a371f7", bottom: "#2f2f2f" }, wander: 2,
      },
    ],
  }),

  // --- Investor Lounge ----------------------------------------------------
  room({
    id: "int-investor-lounge",
    name: "Investor Lounge",
    buildingId: "b-investor-lounge",
    districtId: "investor-lounge",
    floor: "carpet",
    w: 20,
    h: 14,
    partitions: [{ x: 8, y: 5, w: 4, h: 1 }],
    terrain: [{ type: "wood", x: 1, y: 1, w: 18, h: 3 }],
    subAreas: [
      area("sa-int-inv-preseed", "Pre-seed", "int-investor-lounge", "investor-lounge", "b-investor-lounge", "Pre-seed", "booth", 2, 7, 5, 5, "#d9a441"),
      area("sa-int-inv-seed", "Seed", "int-investor-lounge", "investor-lounge", "b-investor-lounge", "Seed", "booth", 8, 7, 5, 5, "#e3b341"),
      area("sa-int-inv-a", "Series A", "int-investor-lounge", "investor-lounge", "b-investor-lounge", "Series A", "booth", 14, 7, 4, 5, "#3fb950"),
      area("sa-int-inv-bar", "The Bar", "int-investor-lounge", "investor-lounge", "b-investor-lounge", "Networking", "lounge", 2, 1, 16, 3, "#e06c9f"),
    ],
    objects: [
      obj("io-inv-sign", "sign", 10, 2, "Investor Lounge"),
      obj("io-inv-t1", "table", 3, 9),
      obj("io-inv-t2", "table", 9, 9),
      obj("io-inv-t3", "table", 15, 9),
      obj("io-inv-b1", "bench", 5, 9),
      obj("io-inv-b2", "bench", 11, 9),
      obj("io-inv-p1", "planter", 1, 12),
      obj("io-inv-p2", "planter", 18, 12),
      obj("io-inv-l1", "lamp", 5, 5, undefined, false),
      obj("io-inv-l2", "lamp", 15, 5, undefined, false),
    ],
    people: [
      {
        id: "p-int-inv-clara", name: "Clara Moreau", role: "General Partner", company: "Rive Capital",
        location: "Paris", intent: "open_to_chat",
        bio: "Seed and Series A in Europe. Ex-operator.",
        workingOn: "Two term sheets", lookingFor: "B2B founders with real usage",
        x: 10, y: 9, palette: { skin: "#f0c8a0", hair: "#3a2a1a", top: "#d9a441", bottom: "#2f3b4a" }, wander: 2,
      },
    ],
  }),

  // --- Coworking House ----------------------------------------------------
  room({
    id: "int-coworking-house",
    name: "Coworking House",
    buildingId: "b-coworking-house",
    districtId: "coworking-house",
    floor: "wood",
    w: 22,
    h: 16,
    partitions: [
      { x: 7, y: 1, w: 1, h: 6 },
      { x: 14, y: 1, w: 1, h: 6 },
    ],
    terrain: [{ type: "concrete", x: 1, y: 9, w: 20, h: 5 }],
    subAreas: [
      area("sa-int-cow-focus", "Focus Room", "int-coworking-house", "coworking-house", "b-coworking-house", "Deep work", "section", 1, 1, 6, 6, "#8b98a5"),
      area("sa-int-cow-teams", "Team Desks", "int-coworking-house", "coworking-house", "b-coworking-house", "Teams", "section", 8, 1, 6, 6, "#5b9bd5"),
      area("sa-int-cow-calls", "Call Booths", "int-coworking-house", "coworking-house", "b-coworking-house", "Calls", "booth", 15, 1, 6, 6, "#a371f7"),
      area("sa-int-cow-kitchen", "Kitchen", "int-coworking-house", "coworking-house", "b-coworking-house", "Open to chat", "lounge", 2, 9, 19, 5, "#3fb950"),
    ],
    objects: [
      obj("io-cow-sign", "sign", 11, 8, "Coworking House"),
      obj("io-cow-t1", "table", 3, 3),
      obj("io-cow-t2", "table", 10, 3),
      obj("io-cow-t3", "table", 17, 3),
      obj("io-cow-t4", "table", 5, 11),
      obj("io-cow-t5", "table", 15, 11),
      obj("io-cow-b1", "bench", 5, 3),
      obj("io-cow-b2", "bench", 12, 3),
      obj("io-cow-b3", "bench", 7, 11),
      obj("io-cow-b4", "bench", 13, 11),
      obj("io-cow-p1", "planter", 20, 14),
      obj("io-cow-l1", "lamp", 4, 8, undefined, false),
      obj("io-cow-l2", "lamp", 18, 8, undefined, false),
    ],
    people: [
      {
        id: "p-int-cow-eli", name: "Eli Novak", role: "Solo Founder", company: "Draftly",
        location: "Prague", intent: "cofounder",
        bio: "Shipping a writing tool alone. It's going okay. Mostly.",
        workingOn: "v2 launch", lookingFor: "A technical cofounder",
        x: 6, y: 11, palette: { skin: "#e8b48c", hair: "#8a5a2f", top: "#e06c9f", bottom: "#333" }, wander: 3,
      },
    ],
  }),

  // --- Builder Workshop ---------------------------------------------------
  room({
    id: "int-builder-workshop",
    name: "Builder Workshop",
    buildingId: "b-builder-district",
    districtId: "builder-district",
    floor: "concrete",
    w: 20,
    h: 15,
    partitions: [{ x: 1, y: 7, w: 8, h: 1 }],
    terrain: [{ type: "wood", x: 11, y: 2, w: 8, h: 6 }],
    subAreas: [
      area("sa-int-build-hard", "Hardware Bench", "int-builder-workshop", "builder-district", "b-builder-district", "Hardware", "section", 1, 2, 8, 5, "#ce7b3c"),
      area("sa-int-build-oss", "Open Source", "int-builder-workshop", "builder-district", "b-builder-district", "Open source", "section", 11, 2, 8, 6, "#3fb950"),
      area("sa-int-build-show", "Show & Tell", "int-builder-workshop", "builder-district", "b-builder-district", "Demos", "lounge", 2, 9, 16, 4, "#a371f7"),
    ],
    objects: [
      obj("io-build-sign", "sign", 10, 1, "Builder Workshop"),
      obj("io-build-t1", "table", 3, 4),
      obj("io-build-t2", "table", 6, 4),
      obj("io-build-t3", "table", 13, 4),
      obj("io-build-t4", "table", 16, 4),
      obj("io-build-b1", "bench", 5, 10),
      obj("io-build-b2", "bench", 9, 10),
      obj("io-build-b3", "bench", 13, 10),
      obj("io-build-l1", "lamp", 3, 12, undefined, false),
      obj("io-build-l2", "lamp", 16, 12, undefined, false),
    ],
    people: [
      {
        id: "p-int-build-yuki", name: "Yuki Mori", role: "Hardware Hacker", company: "Bench",
        location: "Osaka", intent: "feedback",
        bio: "Small robots, mostly. Come look at this one.",
        workingOn: "A desk robot", lookingFor: "Anyone who's shipped hardware",
        x: 5, y: 5, palette: { skin: "#f2d0ae", hair: "#1a1a1a", top: "#ce7b3c", bottom: "#2f2f2f" }, wander: 2,
      },
    ],
  }),

  // --- After Hours --------------------------------------------------------
  room({
    id: "int-after-hours",
    name: "After Hours",
    buildingId: "b-after-hours",
    districtId: "after-hours",
    floor: "wood",
    w: 20,
    h: 14,
    partitions: [{ x: 4, y: 2, w: 12, h: 1 }],
    terrain: [
      { type: "carpet", x: 1, y: 5, w: 18, h: 7 },
      { type: "tile", x: 3, y: 1, w: 14, h: 2 },
    ],
    subAreas: [
      area("sa-int-ah-bar", "The Bar", "int-after-hours", "after-hours", "b-after-hours", "Networking", "lounge", 4, 1, 12, 3, "#8b5cf6"),
      area("sa-int-ah-booths", "Quiet Booths", "int-after-hours", "after-hours", "b-after-hours", "Open to chat", "booth", 1, 5, 6, 6, "#3fb950"),
      area("sa-int-ah-floor", "The Floor", "int-after-hours", "after-hours", "b-after-hours", "Social", "lounge", 8, 5, 11, 6, "#e06c9f"),
    ],
    objects: [
      obj("io-ah-sign", "sign", 10, 4, "After Hours"),
      obj("io-ah-b1", "bench", 2, 7),
      obj("io-ah-b2", "bench", 2, 9),
      obj("io-ah-t1", "table", 4, 7),
      obj("io-ah-t2", "table", 11, 8),
      obj("io-ah-t3", "table", 15, 8),
      obj("io-ah-p1", "planter", 18, 12),
      obj("io-ah-l1", "lamp", 6, 4, undefined, false),
      obj("io-ah-l2", "lamp", 13, 4, undefined, false),
      obj("io-ah-l3", "lamp", 10, 11, undefined, false),
    ],
    people: [
      {
        id: "p-int-ah-rui", name: "Rui Almeida", role: "Design Lead", company: "Ledgerly",
        location: "Lisbon", intent: "open_to_chat",
        bio: "Off the clock. Happy to talk shop anyway.",
        workingOn: "A rebrand", lookingFor: "Nothing — just here",
        x: 11, y: 8, palette: { skin: "#c98a5b", hair: "#2a1a10", top: "#8b5cf6", bottom: "#333" }, wander: 3,
      },
    ],
  }),
];

/** Look up an interior by the id a Building carries in `interiorId`. */
export function findInterior(id: string | undefined): Interior | null {
  if (!id) return null;
  return interiors.find((i) => i.id === id) ?? null;
}
