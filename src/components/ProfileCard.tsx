"use client";

import { useState } from "react";
import type { PersonSeed } from "@/world/schema";
import { INTENTS } from "@/world/schema";

/**
 * The profile card shown when the player *clicks* an avatar. Opening it is the
 * first click (information). Consequential actions (Connect / Block / Report)
 * require a deliberate second click — never triggered by proximity or by the
 * click that opened the card.
 */
export default function ProfileCard({
  person,
  onClose,
}: {
  person: PersonSeed;
  onClose: () => void;
}) {
  const [connectState, setConnectState] = useState<"idle" | "sent">("idle");
  const [saved, setSaved] = useState(false);
  const intent = INTENTS[person.intent];

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-30 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-black/10 bg-parchment text-ink shadow-2xl">
      <div className="flex items-start gap-3 border-b border-black/10 bg-white/50 p-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
          style={{ background: person.palette.top }}
        >
          {person.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{person.name}</div>
          <div className="truncate text-sm opacity-80">
            {person.role} · {person.company}
          </div>
          <div className="text-xs opacity-60">{person.location}</div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-lg leading-none opacity-50 hover:opacity-100"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="space-y-3 p-4 text-sm">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{ background: intent.color }}
        >
          {intent.emoji} {intent.label}
        </span>

        <p className="opacity-90">{person.bio}</p>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-50">
            Working on
          </div>
          <div>{person.workingOn}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-50">
            Looking for
          </div>
          <div>{person.lookingFor}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-black/10 p-3">
        <button
          disabled={connectState === "sent"}
          onClick={() => setConnectState("sent")}
          className="col-span-2 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {connectState === "sent" ? "✓ Request sent" : "Connect"}
        </button>
        <button
          onClick={() => setSaved((s) => !s)}
          className="rounded-lg border border-black/15 bg-white/60 px-3 py-2 text-sm font-medium hover:bg-white"
        >
          {saved ? "★ Saved" : "Save"}
        </button>
        <button className="rounded-lg border border-black/15 bg-white/60 px-3 py-2 text-sm font-medium hover:bg-white">
          View Profile
        </button>
        <button className="rounded-lg border border-black/10 px-3 py-2 text-xs opacity-60 hover:opacity-100">
          Block
        </button>
        <button className="rounded-lg border border-black/10 px-3 py-2 text-xs opacity-60 hover:opacity-100">
          Report
        </button>
      </div>
    </div>
  );
}
