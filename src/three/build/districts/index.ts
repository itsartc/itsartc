import type { DistrictSignature } from "./types";
import { consultingDistrict } from "./consultingDistrict";
import { creativeDistrict } from "./creativeDistrict";
import { financeDistrict } from "./financeDistrict";
import { founderDistrict } from "./founderDistrict";
import { healthcareDistrict } from "./healthcareDistrict";
import { legalDistrict } from "./legalDistrict";
import { marketingDistrict } from "./marketingDistrict";
import { operationsDistrict } from "./operationsDistrict";
import { peopleDistrict } from "./peopleDistrict";
import { productDistrict } from "./productDistrict";
import { salesDistrict } from "./salesDistrict";
import { techDistrict } from "./techDistrict";

/**
 * Every district's architectural identity.
 *
 * All twelve are now designed. That was a deliberate decision and it spent
 * something: a signature used to be what made one district special, and when
 * everything is special nothing is. What replaces that is differentiation by
 * *kind* — no two of these buildings share a massing idea, a material family
 * or a way of meeting the street — so the city reads as twelve places rather
 * than one place twelve times.
 *
 * Adding or replacing a design is still one self-contained module and one
 * line here. Shared moves — banding, panelling, canopies, plinths, reveals —
 * live in ./kit, so a module carries only what is genuinely its own.
 */
export const DISTRICT_SIGNATURES: Record<string, DistrictSignature> = {
  "founder-district": founderDistrict,
  "tech-district": techDistrict,
  "people-district": peopleDistrict,
  "consulting-district": consultingDistrict,
  "product-district": productDistrict,
  "marketing-district": marketingDistrict,
  "operations-district": operationsDistrict,
  "creative-district": creativeDistrict,
  "healthcare-district": healthcareDistrict,
  "sales-district": salesDistrict,
  "finance-district": financeDistrict,
  "legal-district": legalDistrict,
};

export type { DistrictSignature, SignatureContext } from "./types";
