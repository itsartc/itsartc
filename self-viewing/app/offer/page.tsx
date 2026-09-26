"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Guard, Shell } from "@/components/Shell";
import { CURRENCY_SYMBOL, formatPrice, property } from "@/lib/property";
import { submitOfferForHandoff } from "@/lib/services/offers";
import { useDemo } from "@/lib/state";

// Step 9 — capture offer intent. The AI does NOT negotiate; it records the
// buyer's position and hands off to a licensed agent (lib/services/offers.ts).
export default function OfferPage() {
  const router = useRouter();
  const { state, update } = useDemo();
  const [raw, setRaw] = useState("");
  const [financing, setFinancing] = useState("Mortgage — agreed in principle");
  const [timeline, setTimeline] = useState("Flexible");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const amount = Number(raw.replace(/[^\d]/g, "")) || 0;
  const pct = amount ? Math.round((amount / property.price) * 100) : null;

  async function submit() {
    setSending(true);
    const res = await submitOfferForHandoff({
      amount,
      financing,
      timeline,
      note,
      buyerName: state.buyerName,
      bookingId: state.booking?.bookingId,
      propertyId: property.id,
    });
    update({ offer: { amount, financing, reference: res.reference } });
    router.push("/offer/sent");
  }

  return (
    <Guard ok={!!state.booking} to="/">
      <Shell
        step={5}
        title="Make an offer"
        back="/after"
        footer={
          <button className="btn-primary" disabled={!amount || sending} onClick={submit}>
            {sending ? "Sending to agent…" : "Send offer to a licensed agent"}
          </button>
        }
      >
        <div className="space-y-5">
          <div className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-500 text-white">✦</span>
            <div className="rounded-2xl rounded-tl-sm bg-white p-3.5 text-sm leading-relaxed ring-1 ring-slate-200">
              Happy to help you get an offer in. I&apos;ll pass it straight to a <b>licensed agent</b> — they handle the
              negotiation and paperwork, so I won&apos;t haggle on your behalf.
            </div>
          </div>

          <div>
            <label className="label" htmlFor="amount">Your offer</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400">{CURRENCY_SYMBOL}</span>
              <input
                id="amount"
                inputMode="numeric"
                className="input !py-4 pl-9 text-2xl font-semibold"
                placeholder={property.price.toLocaleString("en-US")}
                value={amount ? amount.toLocaleString("en-US") : raw}
                onChange={(e) => setRaw(e.target.value)}
              />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Asking price {formatPrice(property.price)}
              {pct !== null && ` · your offer is ${pct}% of asking`}
            </div>
          </div>

          <Choice label="How will you pay?" value={financing} onChange={setFinancing} options={["Cash", "Mortgage — agreed in principle", "Mortgage — not yet arranged", "Selling another property first"]} />
          <Choice label="When could you move?" value={timeline} onChange={setTimeline} options={["ASAP", "1–3 months", "3–6 months", "Flexible"]} />

          <div>
            <label className="label" htmlFor="note">Anything the agent should know? (optional)</label>
            <textarea id="note" className="input min-h-[80px] text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. We'd love to keep the garden shed" />
          </div>

          <p className="text-xs text-slate-400">
            This is a non-binding expression of interest. Nothing is agreed until a licensed agent confirms it with you and the seller.
          </p>
        </div>
      </Shell>
    </Guard>
  );
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-full px-3 py-2 text-sm ring-1 ${value === o ? "bg-brand text-white ring-brand" : "bg-white ring-slate-200"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
