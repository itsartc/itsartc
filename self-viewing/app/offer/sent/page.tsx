"use client";

import Link from "next/link";
import { Guard, MockNote, Shell } from "@/components/Shell";
import { formatPrice, property } from "@/lib/property";
import { useDemo } from "@/lib/state";

// Step 9b — explicit human handoff. The AI's role ends here.
export default function OfferSentPage() {
  const { state } = useDemo();
  const offer = state.offer;

  return (
    <Guard ok={!!offer} to="/offer">
      <Shell step={5} title="Offer received">
        {offer && (
          <div className="space-y-5">
            <div className="flex flex-col items-center pt-4 text-center">
              <div className="grid h-16 w-16 animate-pop place-items-center rounded-full bg-brand text-3xl text-white">✓</div>
              <h2 className="mt-4 text-xl font-semibold">Thanks — a licensed agent will follow up with you to finalize this.</h2>
              <p className="mt-2 text-sm text-slate-500">
                Your offer of <b className="text-ink">{formatPrice(offer.amount)}</b> for {property.address} has been passed on.
              </p>
              <div className="mt-2 rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-600">Ref {offer.reference}</div>
            </div>

            <div className="card">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700">JR</span>
                <div>
                  <div className="font-semibold">Jordan Reyes</div>
                  <div className="text-xs text-slate-500">Licensed agent · {property.agency} (placeholder)</div>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                &ldquo;Hi {state.buyerName || "there"}, I&apos;ve got your offer. I&apos;ll speak to the sellers and call you within one business day.&rdquo;
              </div>
            </div>

            <div className="card text-sm">
              <div className="mb-3 font-semibold">What happens next</div>
              <ol className="space-y-3">
                {[
                  ["Offer captured by AI", "Done", true],
                  ["Licensed agent reviews & presents to seller", "Within 1 business day", false],
                  ["Negotiation & acceptance", "Handled by the agent", false],
                  ["Legal & paperwork", "Agent + your legal representative", false],
                ].map(([t, s, done]) => (
                  <li key={t as string} className="flex gap-3">
                    <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full ${done ? "bg-brand" : "border-2 border-slate-300"}`} />
                    <span>
                      <span className="block font-medium">{t}</span>
                      <span className="text-xs text-slate-500">{s}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <MockNote>
              Nothing was sent. Production would create the offer in the agency CRM and notify an on-duty negotiator
              (<code>submitOfferForHandoff()</code> stub). The AI never negotiates or handles legal steps.
            </MockNote>

            <Link href="/after" className="btn-secondary">Back to property</Link>
          </div>
        )}
      </Shell>
    </Guard>
  );
}
