/**
 * World data schema.
 *
 * The world is described entirely as structured data — never as a static image
 * or hardcoded engine coordinates. This is the foundation that lets an admin
 * editor (a later phase) mutate the world without touching source code, and
 * lets the renderer stay a dumb interpreter of data.
 *
 * All positions/sizes are in TILE units unless a field name says otherwise.
 * The renderer multiplies by `WorldMap.tileSize` to get pixels.
 */

export type TerrainType =
  | "grass"
  | "grassdark"
  | "path"
  | "plaza"
  | "water"
  | "sand";

/** A rectangular painted area of a single terrain type. */
export interface TerrainRegion {
  type: TerrainType;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A named district / neighbourhood of the world (a labelled area, not a room). */
export interface District {
  id: string;
  name: string;
  /** Where the floating label is anchored, in tiles. */
  labelX: number;
  labelY: number;
  /** Accent colour used for the label and district signage. */
  accent: string;
}

export type IntentKey =
  | "open_to_chat"
  | "raising"
  | "hiring"
  | "open_to_work"
  | "cofounder"
  | "feedback"
  | "exploring"
  | "busy";

/** An advertising / sponsorship surface baked into the world (Phase 1I hook). */
export interface AdSlot {
  id: string;
  kind: "billboard" | "banner" | "poster" | "screen" | "sign";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Filled when sold; null = available inventory. */
  sponsor: string | null;
}

/**
 * A building. May be pure scenery, or enterable (walking onto its `entrance`
 * tile transitions to `interiorId`). Interiors are separate maps — for now we
 * model the metadata; interior maps arrive in a later phase.
 */
export interface Building {
  id: string;
  name: string;
  districtId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  wallColor: string;
  roofColor: string;
  enterable: boolean;
  /** Door tile, in absolute tiles. Left walkable in the collision grid. */
  entrance?: { x: number; y: number };
  interiorId?: string;
  status?: "open" | "closed";
  sponsor?: string | null;
  capacity?: number;
  adSlots?: AdSlot[];
}

export type ObjectType =
  | "tree"
  | "bush"
  | "bench"
  | "lamp"
  | "fountain"
  | "sign"
  | "billboard"
  | "table"
  | "planter";

/** A reusable, independently-editable world object (Phase 1G). */
export interface WorldObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  /** Optional label, used by signs / billboards. */
  label?: string;
  /** Whether this object blocks movement. */
  solid?: boolean;
}

/** A special zone: event area, voice radius, ad activation, closed area (Phase 1J). */
export interface Zone {
  id: string;
  type: "event" | "voice" | "ad" | "closed";
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

/**
 * A seeded person in the world. In this foundation these are static NPCs that
 * demonstrate the proximity + profile-card interaction model. In a later phase
 * they are replaced by real, network-synchronised players.
 */
export interface PersonSeed {
  id: string;
  name: string;
  role: string;
  company: string;
  location: string;
  intent: IntentKey;
  bio: string;
  workingOn: string;
  lookingFor: string;
  /** Spawn tile. */
  x: number;
  y: number;
  /** Avatar palette for the generated pixel sprite. */
  palette: { skin: string; hair: string; top: string; bottom: string };
  /** How far this NPC wanders from spawn, in tiles (0 = stationary). */
  wander?: number;
}

export interface WorldMap {
  id: string;
  name: string;
  version: number;
  tileSize: number;
  widthTiles: number;
  heightTiles: number;
  /** Base terrain painted under everything. */
  baseTerrain: TerrainType;
  spawn: { x: number; y: number };
  terrain: TerrainRegion[];
  districts: District[];
  buildings: Building[];
  objects: WorldObject[];
  people: PersonSeed[];
  zones: Zone[];
}

/** Static metadata for each intent status: emoji + label + colour. */
export const INTENTS: Record<IntentKey, { emoji: string; label: string; color: string }> = {
  open_to_chat: { emoji: "🟢", label: "Open to chat", color: "#3fb950" },
  raising: { emoji: "💰", label: "Raising", color: "#d9a441" },
  hiring: { emoji: "👥", label: "Hiring", color: "#5b9bd5" },
  open_to_work: { emoji: "🔎", label: "Open to work", color: "#a371f7" },
  cofounder: { emoji: "🤝", label: "Looking for cofounder", color: "#e06c9f" },
  feedback: { emoji: "💡", label: "Looking for feedback", color: "#e3b341" },
  exploring: { emoji: "👀", label: "Exploring", color: "#8b98a5" },
  busy: { emoji: "🔴", label: "Busy", color: "#f85149" },
};
