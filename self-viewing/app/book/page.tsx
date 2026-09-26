"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { getAvailableSlots } from "@/lib/slots";
import { useDemo } from "@/lib/state";

// Step 1b — time slot picker + contact details.
function BookInner() {
  const router = useRouter();
  const second = useSearchParams().get("second") === "1";
  const { state, update } = useDemo();
  const slots = useMemo(() => getAvailableSlots(3), []);
  const [picked, setPicked] = useState<string | null>(state.slot?.start ?? null);
  const [name, setName] = useState(state.buyerName);
  const [phone, setPhone] = useState(state.phone);

  const days = useMemo(() => {
    const m = new Map<string, typeof slots>();
    for (const s of slots) {
      const k = new Date(s.start).toDateString();
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [slots]);

  const canContinue = picked && name.trim() && phone.trim();

  function next() {
    const s = slots.find((x) => x.start === picked)!;
    update({ slot: { start: s.start, end: s.end }, buyerName: name.trim(), phone: phone.trim() });
    // Already verified (e.g. booking a second viewing) → skip straight to confirmation.
    router.push(state.verified ? `/confirmed${second ? "?second=1" : ""}` : "/verify");
  }

  return (
    <Shell
      step={0}
      title={second ? "Book a second viewing" : "Book a viewing"}
      back={second ? "/after" : "/"}
      footer={
        <button className="btn-primary" disabled={!canContinue} onClick={next}>
          {state.verified ? "Confirm booking" : "Continue to ID check"}
        </button>
      }
    >
      <h2 className="text-lg font-semibold">Pick a 30-minute slot</h2>
      <p className="text-sm text-slate-500">You&apos;ll have the place to yourself — no agent needed.</p>

      <div className="mt-4 space-y-4">
        {days.map(([day, ds]) => (
          <div key={day}>
            <div className="mb-2 text-sm font-medium text-slate-600">
              {new Date(ds[0].start).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ds.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setPicked(s.start)}
                  className={`rounded-xl py-3 text-sm font-medium ring-1 transition ${
                    picked === s.start ? "bg-brand text-white ring-brand" : "bg-white ring-slate-200 hover:ring-brand"
                  }`}
                >
                  {new Date(s.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Mobile number</label>
          <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+00 000 000 000" type="tel" autoComplete="tel" />
          <p className="mt-1 text-xs text-slate-400">We&apos;ll text your door code here, and the AI assistant will call this number during the viewing.</p>
        </div>
      </div>
    </Shell>
  );
}

export default function BookPage() {
  return (
    <Suspense>
      <BookInner />
    </Suspense>
  );
}
