// ─────────────────────────────────────────────────────────────────────────────
// MOCK: Identity verification (KYC)
// Production: hand off to a KYC vendor (e.g. Onfido, Veriff, Persona, Stripe
// Identity) that does document authenticity + selfie liveness/face match,
// then receive the result via webhook. Nothing is uploaded or compared here —
// the files never leave the browser.
// ─────────────────────────────────────────────────────────────────────────────

export type KycResult = { status: "verified"; reference: string };

export async function verifyIdentity(_idDocument: File, _selfie: File): Promise<KycResult> {
  // TODO(integration): create a vendor session, upload/capture, await webhook.
  await new Promise((r) => setTimeout(r, 2600));
  const reference = "kyc_mock_" + Math.random().toString(36).slice(2, 8);
  console.log("[MOCK KYC] Identity marked verified:", reference);
  return { status: "verified", reference };
}
