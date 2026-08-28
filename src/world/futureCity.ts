import type { Building, WorldMap } from "./schema";
import { interiors } from "./interiors";

const venue = (
  building: Omit<Building, "wallColor" | "roofColor" | "enterable" | "status" | "rotation">,
): Building => ({
  ...building,
  wallColor: "#53657d",
  roofColor: "#303846",
  enterable: true,
  status: "open",
  rotation: 0,
});

/**
 * The supplied Future_city_1 layout normalized into the existing tile/world-
 * pixel coordinate system. The large environment owns roads and fixed props;
 * the seven major buildings remain individual, editable GLBs.
 */
export const futureCity: WorldMap = {
  id: "future-city",
  name: "Future City",
  version: 1,
  tileSize: 32,
  widthTiles: 96,
  heightTiles: 94,
  baseTerrain: "concrete",
  // Central marked road, facing north along its open walking corridor.
  spawn: { x: 33, y: 45 },
  environment: {
    assetId: "future-city-1.full-city",
    // The source's street surface sits 1.62m above its lowest foundation.
    offset: { x: 4, y: -1.62, z: 4 },
    // Building 11 is retained inside the fixed environment. Building 6 sits
    // inside the Coworking House footprint and needs no additional blocker.
    collisionRects: [{ x: 66, y: 27, w: 15, h: 33 }],
  },
  terrain: [],
  districts: [
    { id: "city-centre", name: "City Centre", labelX: 33, labelY: 45, accent: "#7dd3fc" },
    { id: "founder-cafe", name: "Founder Café", labelX: 81, labelY: 22, accent: "#fbbf24" },
    { id: "ai-district", name: "AI District", labelX: 45, labelY: 77, accent: "#a78bfa" },
    { id: "event-hall", name: "Event Hall", labelX: 48, labelY: 61, accent: "#60a5fa" },
    { id: "hiring-hall", name: "Hiring Hall", labelX: 85, labelY: 62, accent: "#4ade80" },
    { id: "investor-lounge", name: "Investor Lounge", labelX: 17, labelY: 60, accent: "#f59e0b" },
    { id: "coworking-house", name: "Coworking House", labelX: 48, labelY: 37, accent: "#f472b6" },
    { id: "builder-district", name: "Builder District", labelX: 26, labelY: 36, accent: "#fb923c" },
  ],
  buildings: [
    venue({
      id: "b-founder-cafe", name: "Founder Café", districtId: "founder-cafe",
      x: 72, y: 14, w: 18, h: 18, entrance: { x: 85, y: 32 },
      interiorId: "int-founder-cafe", capacity: 60, sponsor: null,
      assetId: "future-city-1.building-1",
    }),
    venue({
      id: "b-ai-labs", name: "AI Labs", districtId: "ai-district",
      x: 38, y: 69, w: 14, h: 16, entrance: { x: 45, y: 85 },
      interiorId: "int-ai-labs", capacity: 80, sponsor: null,
      assetId: "future-city-1.building-2",
    }),
    venue({
      id: "b-hiring-hall", name: "Hiring Hall", districtId: "hiring-hall",
      x: 79, y: 55, w: 13, h: 15, entrance: { x: 78, y: 62 },
      interiorId: "int-hiring-hall", capacity: 100, sponsor: null,
      assetId: "future-city-1.building-3",
    }),
    venue({
      id: "b-event-hall", name: "Event Hall", districtId: "event-hall",
      x: 36, y: 54, w: 24, h: 15, entrance: { x: 48, y: 53 },
      interiorId: "int-event-hall", capacity: 200, sponsor: null,
      assetId: "future-city-1.building-4",
    }),
    venue({
      id: "b-coworking-house", name: "Coworking House", districtId: "coworking-house",
      x: 37, y: 25, w: 23, h: 23, entrance: { x: 48, y: 48 },
      interiorId: "int-coworking-house", capacity: 120, sponsor: null,
      assetId: "future-city-1.building-5",
    }),
    venue({
      id: "b-investor-lounge", name: "Investor Lounge", districtId: "investor-lounge",
      x: 6, y: 54, w: 22, h: 13, entrance: { x: 28, y: 60 },
      interiorId: "int-investor-lounge", capacity: 40, sponsor: null,
      assetId: "future-city-1.building-7",
    }),
    venue({
      id: "b-builder-district", name: "Builder Workshop", districtId: "builder-district",
      x: 24, y: 31, w: 4, h: 11, entrance: { x: 28, y: 36 },
      interiorId: "int-builder-workshop", capacity: 100, sponsor: null,
      assetId: "future-city-1.building-8",
    }),
  ],
  objects: [],
  people: [],
  zones: [
    { id: "z-city-centre", type: "voice", x: 29, y: 39, w: 8, h: 14, label: "City Centre" },
  ],
  subAreas: [],
  rooms: [],
  interiors,
};
