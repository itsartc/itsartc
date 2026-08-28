"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { bus, type NearPerson } from "@/game/bus";
import type { PersonSeed } from "@/world/schema";
import { INTENTS } from "@/world/schema";
import ProfileCard from "./ProfileCard";

// Phaser must never render on the server.
const GameCanvas = dynamic(() => import("@/game/GameCanvas"), { ssr: false });

// Bump on each multiplayer-related deploy so a screenshot reveals the running
// build (a cached old bundle won't show the current tag).
const BUILD_TAG = "voice3";

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
  const [interior, setInterior] = useState<{ id: string; name: string } | null>(null);
  const [online, setOnline] = useState(1);
  const [netStatus, setNetStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [voice, setVoice] = useState({ micEnabled: false, micDenied: false, supported: true });
  const [audible, setAudible] = useState(0);
  const [links, setLinks] = useState(0);

  useEffect(() => {
    const offs = [
      bus.on("world:ready", () => setReady(true)),
      bus.on("district:change", (d) => setDistrict(d?.name ?? "Town Central")),
      bus.on("proximity:update", (n) => setNear(n)),
      bus.on("person:selected", (p) => setSelected(p)),
      bus.on("presence:count", (c) => setOnline(Math.max(1, c))),
      bus.on("net:status", (s) => setNetStatus(s)),
      bus.on("voice:status", (s) => setVoice(s)),
      bus.on("voice:audible", (n) => setAudible(n)),
      bus.on("voice:links", (n) => setLinks(n)),
      bus.on("interior:change", (i) => setInterior(i ? { id: i.id, name: i.name } : null)),
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
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-start gap-2">
        <div className="rounded-lg bg-ink/85 px-3 py-2 text-parchment shadow-lg">
          <div className="text-[10px] uppercase tracking-widest opacity-60">
            {interior ? "You are inside" : "You are in"}
          </div>
          <div className="font-semibold">{district}</div>
        </div>

        {/* Leaving is always one click away, so nobody feels stuck in a room. */}
        {interior && (
          <button
            type="button"
            onClick={() => bus.emit("interior:leave", undefined)}
            className="pointer-events-auto rounded-lg bg-parchment/95 px-3 py-2 text-sm font-semibold text-ink shadow-lg transition hover:bg-parchment"
          >
            ← Leave
          </button>
        )}
        <div className="rounded-lg bg-ink/85 px-3 py-2 text-parchment shadow-lg">
          <div className="text-[10px] uppercase tracking-widest opacity-60">
            {netStatus === "live" ? "Live now" : netStatus === "connecting" ? "Connecting" : "Offline"}
          </div>
          <div className="flex items-center gap-1.5 font-semibold">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                netStatus === "live"
                  ? "animate-pulse bg-green-400"
                  : netStatus === "connecting"
                    ? "animate-pulse bg-amber-400"
                    : "bg-red-500"
              }`}
            />
            {online} {online === 1 ? "person" : "people"}
          </div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider opacity-40">
            {netStatus} · build {BUILD_TAG}
          </div>
        </div>
      </div>

      {/* Voice / mic control */}
      {voice.supported && (
        <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              bus.emit(voice.micEnabled ? "voice:disable" : "voice:enable", undefined)
            }
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg transition ${
              voice.micEnabled
                ? "bg-green-500 text-white hover:bg-green-600"
                : "bg-ink/85 text-parchment hover:bg-ink"
            }`}
            title={
              voice.micDenied
                ? "Microphone permission was blocked — enable it in your browser's site settings"
                : voice.micEnabled
                  ? "Turn your microphone off"
                  : "Turn your microphone on to talk to people near you"
            }
          >
            <span>{voice.micEnabled ? "🎙️" : "🔇"}</span>
            <span>
              {voice.micDenied ? "Mic blocked" : voice.micEnabled ? "Mic on" : "Enable mic"}
            </span>
          </button>
          {links > 0 && audible > 0 ? (
            <span className="rounded-full bg-ink/85 px-3 py-2 text-xs text-parchment shadow-lg">
              🔊 hearing {audible} nearby
            </span>
          ) : links > 0 ? (
            <span className="rounded-full bg-ink/85 px-3 py-2 text-xs text-parchment/80 shadow-lg">
              🔗 voice-linked to {links} · walk closer to hear them
            </span>
          ) : online > 1 ? (
            <span className="rounded-full bg-ink/85 px-3 py-2 text-xs text-amber-300/90 shadow-lg">
              🟡 connecting voice… (needs a TURN relay across networks)
            </span>
          ) : null}
        </div>
      )}

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
          </div>
        </div>
      )}

      {/* Profile card */}
      {selected && <ProfileCard person={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
