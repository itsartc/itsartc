// ─────────────────────────────────────────────────────────────────────────────
// MOCK: SMS / WhatsApp delivery
// Production: replace the body of sendAccessCodeSMS() with Twilio (Verify or
// Messaging API) or a WhatsApp Business template send. Keep the signature so
// callers don't change. Runs server-side only (called from /api/bookings).
// ─────────────────────────────────────────────────────────────────────────────

export type SmsResult = { delivered: boolean; channel: "mock"; preview: string };

export async function sendAccessCodeSMS(params: {
  to: string;
  buyerName: string;
  code: string;
  address: string;
  windowLabel: string;
}): Promise<SmsResult> {
  const preview =
    `Hi ${params.buyerName}, your viewing at ${params.address} is confirmed for ${params.windowLabel}. ` +
    `Your one-time door code is ${params.code}. It only works during your slot.`;

  // TODO(integration): await twilio.messages.create({ to: params.to, from: TWILIO_FROM, body: preview })
  console.log(`[MOCK SMS] → ${params.to || "(no number given)"}\n${preview}`);

  return { delivered: false, channel: "mock", preview };
}
