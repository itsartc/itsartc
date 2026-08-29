/**
 * The city as structured data.
 *
 * The renderer is a dumb interpreter of these types: it draws what the data
 * says and knows nothing about layout rules. That separation is what makes the
 * world editable — a building's façade, sponsor, height or entrance is a field
 * to change, not geometry to re-export from Blender.
 *
 * Every distance is in metres, matching a real-world scale.
 */

/** How a building's walls are surfaced. */
export type FacadeStyle = "glass" | "tiles" | "plaster" | "concrete";

export interface Building {
  id: string;
  name: string;
  districtId: string;
  /** Footprint: north-west corner and extent, in metres. */
  x: number;
  z: number;
  w: number;
  d: number;
  height: number;
  floors: number;
  style: FacadeStyle;
  /** Wall tint, multiplied over the façade texture. */
  color: string;
  /** Door position on the footprint edge, in metres. */
  entrance?: { x: number; z: number };
  /** Filled when sold; null means available inventory. */
  sponsor?: string | null;
}

/** A carriageway. Roads are axis-aligned; `w` and `d` give the extent. */
export interface Road {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  /** Lane markings run along this axis. */
  axis: "x" | "z";
}

/** A raised pavement slab bordering the roads. */
export interface Sidewalk {
  x: number;
  z: number;
  w: number;
  d: number;
}

export type PropType = "streetlight" | "tree" | "bin" | "bench" | "planter" | "fountain";

export interface Prop {
  type: PropType;
  x: number;
  z: number;
  /** Y rotation in radians. */
  rotation: number;
}

/** A named area of the city, for the location HUD and for grouping venues. */
export interface District {
  id: string;
  name: string;
  x: number;
  z: number;
  accent: string;
}

/** An open square or park. */
export interface Plaza {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  surface: "paving" | "grass";
}

export interface CityMap {
  id: string;
  name: string;
  version: number;
  /** Overall extent in metres. */
  size: { w: number; d: number };
  /** Where the player arrives, in metres. */
  spawn: { x: number; z: number };
  districts: District[];
  roads: Road[];
  sidewalks: Sidewalk[];
  plazas: Plaza[];
  buildings: Building[];
  props: Prop[];
}

/** Pavement height above the roadway, in metres. */
export const KERB_HEIGHT = 0.16;
