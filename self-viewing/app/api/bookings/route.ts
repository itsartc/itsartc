import { NextResponse } from "next/server";
import { property } from "@/lib/property";
import { formatWindow } from "@/lib/slots";
import { issueAccessCode, newBookingId } from "@/lib/services/smartLock";
import { sendAccessCodeSMS } from "@/lib/services/sms";

// Creates a booking and issues a one-time access code.
// Production: persist to a DB (Vercel Postgres/KV), check slot availability,
// require a verified KYC reference, and schedule the lock PIN + AI call.
export async function POST(req: Request) {
  const body = await req.json();
  const { start, end, buyerName, phone, kycRef } = body as Record<string, string>;
  if (!start || !end) return NextResponse.json({ error: "Missing slot" }, { status: 400 });
  if (!kycRef) return NextResponse.json({ error: "Identity not verified" }, { status: 400 });

  const bookingId = newBookingId();
  const code = issueAccessCode(bookingId);
  const sms = await sendAccessCodeSMS({
    to: phone,
    buyerName: buyerName || "there",
    code,
    address: property.address,
    windowLabel: formatWindow(start, end),
  });

  console.log(`[BOOKING] ${bookingId} for ${buyerName} (${kycRef}) ${start} → ${end}`);
  return NextResponse.json({ bookingId, code, start, end, smsPreview: sms.preview });
}
