// ─────────────────────────────────────────────────────────────────────────────
// MOCK: Offer submission + human handoff
// Production: create a lead/offer record in the agency CRM and notify a
// licensed negotiator (email/Slack/CRM task). The AI never negotiates price or
// handles legal paperwork — it only captures the buyer's intent and hands off.
// ─────────────────────────────────────────────────────────────────────────────

export type OfferPayload = {
  amount: number;
  financing: string;
  timeline: string;
  note: string;
  buyerName: string;
  bookingId?: string;
  propertyId: string;
};

export async function submitOfferForHandoff(offer: OfferPayload) {
  // TODO(integration): await crm.createOffer(offer); await notifyNegotiator(offer)
  console.log("[MOCK HANDOFF] Offer passed to licensed agent:", offer);
  await new Promise((r) => setTimeout(r, 1200));
  return { reference: "OF-" + Math.random().toString(36).slice(2, 7).toUpperCase() };
}
