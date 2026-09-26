import { createHmac, randomBytes } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK: Smart lock access codes
// Production: issueAccessCode() would call the lock vendor's API (e.g. igloohome
// algoPIN, Tuya temporary password, Nuki) to create a time-bound PIN on the
// physical lock, and validation would happen on the lock itself.
//
// Here the code is derived from the booking ID with an HMAC, so validation is
// stateless and survives serverless cold starts on Vercel without a database.
// Server-side only.
// ─────────────────────────────────────────────────────────────────────────────

const SECRET = process.env.ACCESS_CODE_SECRET || "prototype-only-secret";

export function newBookingId() {
  return "bk_" + randomBytes(6).toString("hex");
}

export function issueAccessCode(bookingId: string): string {
  // TODO(integration): lockVendor.createTemporaryPin({ lockId, start, end })
  const digest = createHmac("sha256", SECRET).update(bookingId).digest();
  const n = digest.readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

export function validateAccessCode(bookingId: string, code: string): boolean {
  // Demo shortcut: the time window is NOT enforced so the flow can be clicked
  // through at any time. Production enforces [start - 15 min, end].
  return issueAccessCode(bookingId) === code;
}
