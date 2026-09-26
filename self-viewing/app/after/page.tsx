"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Guard, MockNote, Photo, Shell } from "@/components/Shell";
import { useAgent } from "@/components/useAgent";
import { formatPrice, property } from "@/lib/property";
import { formatWindow } from "@/lib/slots";
import { useDemo } from "@/lib/state";

// Step 8 — post-viewing nurture. In production the AI keeps this conversation
// going over SMS/WhatsApp/phone in the days after the viewing.
export default function AfterPage() {
  const { state } = useDemo();
  const [chatOpen, setChatOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  return (
    <Guard ok={!!state.booking} to="/">
      <Shell step={5} title="After your viewing">
        <div className="space-y-5">
          <div className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-500 text-white">✦</span>
            <div className="rounded-2xl rounded-tl-sm bg-white p-3.5 text-sm leading-relaxed ring-1 ring-slate-200">
              Thanks for viewing {property.address}, {state.buyerName || "there"}! I hope it felt like home.{" "}
              <b>Interested in this property?</b> I can answer anything else, set up a second look, or help you put an
              offer to the agent.
            </div>
          </div>

          <div className="card flex gap-3">
            <Photo src={property.heroPhoto} alt="Property" className="h-16 w-20 shrink-0 rounded-lg" />
            <div className="min-w-0 text-sm">
              <div className="font-semibold">{formatPrice(property.price)}</div>
              <div className="truncate text-slate-600">{property.address}</div>
              <div className="text-xs text-slate-400">
                {property.beds} bed · {property.baths} bath · {property.sizeSqm} m²
              </div>
            </div>
          </div>

          {state.secondBooking && (
            <div className="rounded-2xl bg-brand-light/60 p-4 text-sm text-teal-900">
              <b>Second viewing booked:</b> {formatWindow(state.secondBooking.start, state.secondBooking.end)} · code{" "}
              <span className="font-mono font-semibold">{state.secondBooking.code}</span>
            </div>
          )}
          {state.offer && (
            <div className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-900">
              <b>Offer submitted:</b> {formatPrice(state.offer.amount)} · ref {state.offer.reference}. A licensed agent will be in touch.
            </div>
          )}

          <div className="space-y-3">
            <button className="btn-secondary justify-between" onClick={() => setChatOpen((o) => !o)}>
              <span>💬 Ask another question</span>
              <span className="text-slate-400">{chatOpen ? "–" : "+"}</span>
            </button>
            {chatOpen && <FollowUpChat />}
            <Link href="/book?second=1" className="btn-secondary justify-start">
              📅 Schedule a second viewing
            </Link>
            <Link href="/offer" className="btn-primary">
              Make an offer
            </Link>
          </div>

          <div className="card">
            <div className="text-sm font-medium">How did it feel?</div>
            <div className="mt-2 flex gap-2">
              {["😕", "🙂", "😊", "😍"].map((e, i) => (
                <button
                  key={e}
                  onClick={() => setRating(i)}
                  className={`flex-1 rounded-xl py-2 text-2xl transition ${rating === i ? "bg-brand-light ring-2 ring-brand" : "bg-slate-50"}`}
                >
                  {e}
                </button>
              ))}
            </div>
            {rating !== null && <div className="mt-2 text-xs text-slate-500">Thanks — noted for the agent.</div>}
          </div>

          <MockNote>
            In production the AI would follow up over SMS/WhatsApp or a call in the following days (nurture sequence),
            and any offer is handed to a licensed human agent.
          </MockNote>
        </div>
      </Shell>
    </Guard>
  );
}

function FollowUpChat() {
  const roomRef = useRef<string | null>(null);
  const agent = useAgent(roomRef);
  const [draft, setDraft] = useState("");
  const ideas = ["Why are they selling?", "Is there parking?", "What schools are nearby?", "Would they take less?"];

  return (
    <div className="card space-y-3">
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {agent.messages.length === 0 && <div className="text-sm text-slate-500">Ask me anything about the home or the area.</div>}
        {agent.messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "buyer" ? "justify-end" : ""}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "buyer" ? "bg-brand text-white" : "bg-slate-100"}`}>{m.text}</div>
          </div>
        ))}
        {agent.thinking && <div className="text-xs text-slate-400">Typing…</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        {ideas.map((i) => (
          <button key={i} onClick={() => agent.ask(i)} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200">
            {i}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          agent.ask(draft);
          setDraft("");
        }}
        className="flex gap-2"
      >
        <input className="input !py-2 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a question…" />
        <button className="rounded-xl bg-brand px-4 text-sm font-semibold text-white">Ask</button>
      </form>
    </div>
  );
}
