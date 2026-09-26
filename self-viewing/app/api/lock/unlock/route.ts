import { NextResponse } from "next/server";
import { validateAccessCode } from "@/lib/services/smartLock";

// MOCK smart-lock keypad check. Production: the physical lock validates the PIN
// and reports an "unlocked"/"door opened" webhook, which triggers the AI call.
export async function POST(req: Request) {
  const { bookingId, code } = (await req.json()) as { bookingId?: string; code?: string };
  if (!bookingId || !code) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = validateAccessCode(bookingId, code);
  console.log(`[MOCK LOCK] ${bookingId} code ${code} → ${ok ? "UNLOCKED" : "rejected"}`);
  if (ok) console.log("[MOCK VOICE] Would now trigger outbound AI call to buyer (Vapi/Retell).");
  return NextResponse.json({ ok });
}
