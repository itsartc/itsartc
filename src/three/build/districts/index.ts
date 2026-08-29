import type { DistrictSignature } from "./types";
import { aiDistrict } from "./aiDistrict";

/**
 * Districts with a bespoke architectural identity.
 *
 * A district absent from this map gets the standard generated building, which
 * is the right default: the point of giving one district a distinct look is
 * lost if every district has one.
 *
 * Adding a design means writing one self-contained module and one line here.
 */
export const DISTRICT_SIGNATURES: Record<string, DistrictSignature> = {
  "ai-district": aiDistrict,
};

export type { DistrictSignature, SignatureContext } from "./types";
