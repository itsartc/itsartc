"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Guard, MockNote, Shell } from "@/components/Shell";
import { property } from "@/lib/property";
import { formatWindow } from "@/lib/slots";
import { useDemo, type Booking } from "@/lib/state";

// Step 3 — booking confirmation + access code. The API route calls the
// sendAccessCodeSMS() stub server-side (check the server console).
function ConfirmedInner() {
  const second = useSearchParams().get("second") === "1";
  const { state, update } = useDemo();
  const existing = second ? state.secondBooking : state.booking;
  const [booking, setBooking] = useState<Booking | null>(existing);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    // Re-issue if the stored booking is for a different slot than the one picked.
    if (existing && existing.start === state.slot?.start) return setBooking(existing);
    if (requested.current || !state.slot) return;
    requested.current = true;
    fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...state.slot, buyerName: state.buyerName, phone: state.phone, kycRef: state.kycRef }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        const b: Booking = { ...d, kind: second ? "second" : "first" };
        console.log("[MOCK SMS] Message that would have been sent:\n" + d.smsPreview);
        setBooking(b);
        update(second ? { secondBooking: b } : { booking: b });
      })
      .catch((e) => setError(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell
      step={second ? 5 : 2}
      title={second ? "Second viewing booked" : "You're booked"}
      footer={
        booking &&
        (second ? (
          <Link href="/after" className="btn-secondary">Back</Link>
        ) : (
          <Link href="/arrive" className="btn-primary">
            I&apos;m at the door →
          </Link>
        ))
      }
    >
      {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Couldn&apos;t create booking: {error}</div>}
      {!booking && !error && (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-light border-t-brand" />
        </div>
      )}
      {booking && (
        <div className="animate-pop space-y-4">
          <div className="card text-center">
            <div className="text-sm text-slate-500">{property.address}</div>
            <div className="mt-1 font-semibold">{formatWindow(booking.start, booking.end)}</div>
            <div className="mt-5 text-xs font-medium uppercase tracking-widest text-slate-400">Your door code</div>
            <div className="mt-2 font-mono text-5xl font-bold tracking-[0.2em] text-brand">{booking.code}</div>
            <div className="mt-3 text-xs text-slate-500">Works only during your slot · single use</div>
          </div>

          {/* Mock phone notification showing what would be texted */}
          <div className="rounded-2xl bg-slate-800 p-3 text-white shadow-lg">
            <div className="flex items-center gap-2 text-[11px] text-slate-300">
              <span className="grid h-5 w-5 place-items-center rounded bg-green-500 text-[10px] text-white">✉</span>
              MESSAGES · now
            </div>
            <div className="mt-1 text-sm leading-snug">{booking.smsPreview}</div>
          </div>

          <MockNote>
            In production this code would also be sent via SMS/WhatsApp to {state.phone || "your phone"}. Nothing was
            sent — the message was logged to the console instead (<code>sendAccessCodeSMS()</code> stub).
          </MockNote>

          {!second && (
            <div className="card space-y-2 text-sm text-slate-600">
              <div className="font-semibold text-ink">What happens on the day</div>
              <p>1. Enter the code on the smart lock at the front door.</p>
              <p>2. Once you&apos;re in, our AI assistant will call you to guide you round.</p>
              <p>3. When you leave, just close the door — it locks itself.</p>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

export default function ConfirmedPage() {
  const { state } = useDemo();
  return (
    <Guard ok={!!state.slot && state.verified} to="/book">
      <Suspense>
        <ConfirmedInner />
      </Suspense>
    </Guard>
  );
}
