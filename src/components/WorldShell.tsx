"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { bus, type NearPerson } from "@/game/bus";
import type { PersonSeed } from "@/world/schema";
import { INTENTS } from "@/world/schema";
import ProfileCard from "./ProfileCard";

// Phaser must never render on the server.
const GameCanvas = dynamic(() => import("@/game/GameCanvas"), { ssr: false });

/**
 * The full-screen world experience: the Phaser canvas plus the React overlay
 * (location HUD, proximity/conversation bar, profile card, enter-building toast).
 */
export default function WorldShell() {
  const [ready, setReady] = useState(false);
  const [district, setDistrict] = useState<string>("Town Central");
  const [near, setNear] = useState<NearPerson[]>([]);
  const [selected, setSelected] = useState<PersonSeed | null>(null);
  const [enterPrompt, setEnterPrompt] = useState<string | null>(null);

  useEffect(() => {
    const offs = [
      bus.on("world:ready", () => setReady(true)),
      bus.on("district:change", (d) => setDistrict(d?.name ?? "Town Central")),
      bus.on("proximity:update", (n) => setNear(n)),
      bus.on("person:selected", (p) => setSelected(p)),
      bus.on("building:enter", (b) => {
        setEnterPrompt(b.name);
        window.clearTimeout((window as unknown as { __et?: number }).__et);
        (window as unknown as { __et?: number }).__et = window.setTimeout(
          () => setEnterPrompt(null),
          3200,
        );
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#3a5a2a]">
      <GameCanvas />

      {/* Loading veil */}
      {!ready && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink text-parchment">
          <div className="text-center">
            <div className="mb-2 animate-pulse font-mono text-sm">Entering the world…</div>
            <div className="text-xs opacity-60">itsartc</div>
          </div>
        </div>
      )}

      {/* Location HUD */}
      <div className="pointer-events-none absolute left-4 top-4 z-20">
        <div className="rounded-lg bg-ink/85 px-3 py-2 text-parchment shadow-lg">
          <div className="text-[10px] uppercase tracking-widest opacity-60">You are in</div>
          <div className="font-semibold">{district}</div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="pointer-events-none absolute right-4 bottom-4 z-20 hidden sm:block">
        <div className="rounded-lg bg-ink/70 px-3 py-2 text-xs text-parchment/80 shadow-lg">
          <span className="font-semibold">Move:</span> click · WASD · arrows &nbsp;·&nbsp;
          <span className="font-semibold">Meet:</span> walk up to someone &nbsp;·&nbsp;
          <span className="font-semibold">Info:</span> click them
        </div>
      </div>

      {/* Proximity / conversation bar */}
      {near.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-[min(92vw,520px)] -translate-x-1/2">
          <div className="rounded-xl border border-white/10 bg-ink/90 p-3 text-parchment shadow-2xl">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest opacity-70">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-400" />
              In conversation range
            </div>
            <div className="flex flex-wrap gap-2">
              {near.map(({ person, distanceTiles }) => {
                const intent = INTENTS[person.intent];
                return (
                  <div
                    key={person.id}
                    className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-2 pr-3 text-sm"
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ background: person.palette.top }}
                    >
                      {person.name[0]}
                    </span>
                    <span className="font-medium">{person.name.split(" ")[0]}</span>
                    <span title={intent.label}>{intent.emoji}</span>
                    <span className="text-xs opacity-50">{distanceTiles}m</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[11px] opacity-50">
              Voices fade in as you get closer — click anyone to see their profile.
            </div>
          </div>
        </div>
      )}

      {/* Enter-building toast */}
      {enterPrompt && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2">
          <div className="rounded-full bg-parchment px-4 py-2 text-sm font-semibold text-ink shadow-xl">
            🚪 You entered <span className="font-bold">{enterPrompt}</span>
            <span className="ml-2 opacity-50">(interior coming soon)</span>
          </div>
        </div>
      )}

      {/* Profile card */}
      {selected && <ProfileCard person={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
