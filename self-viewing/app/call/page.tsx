"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Guard, Photo, RestartButton } from "@/components/Shell";
import { useAgent, useDictation } from "@/components/useAgent";
import { property, rooms } from "@/lib/property";
import { greeting, roomIntro } from "@/lib/services/voiceAgent";
import { useDemo } from "@/lib/state";

// Steps 5–7 — the AI-guided viewing.
// MOCK: framed as a live phone call, but it's an in-page chat. Production
// would place a real outbound call via a real-time voice API (Vapi/Retell)
// triggered by the lock's "door opened" event. See lib/services/voiceAgent.ts.
export default function CallPage() {
  const { state } = useDemo();
  return (
    <Guard ok={!!state.booking} to="/">
      <Call />
    </Guard>
  );
}

function Call() {
  const router = useRouter();
  const { state } = useDemo();
  const [phase, setPhase] = useState<"ringing" | "connecting" | "live" | "ending">("ringing");
  const [roomId, setRoomId] = useState<string | null>(null);
  const roomRef = useRef<string | null>(null);
  roomRef.current = roomId;
  const agent = useAgent(roomRef);
  const dictation = useDictation((t) => agent.ask(t));
  const [draft, setDraft] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [visited, setVisited] = useState<string[]>([]);
  const [showRooms, setShowRooms] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const room = rooms.find((r) => r.id === roomId) ?? null;

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [agent.messages, agent.thinking]);

  function accept() {
    // The tap is also the user gesture that unlocks speechSynthesis on mobile.
    setPhase("connecting");
    setTimeout(() => {
      setPhase("live");
      agent.push("system", "Call connected · AI viewing assistant");
      agent.say(greeting(state.buyerName));
      enterRoom(rooms[0].id, true);
    }, 1800);
  }

  function enterRoom(id: string, quiet = false) {
    if (id === roomId) return;
    const r = rooms.find((x) => x.id === id)!;
    setRoomId(id);
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
    agent.push("system", `📍 ${r.name}`);
    // On first connect the intro queues after the greeting; later moves interrupt.
    agent.say(roomIntro(r), { interrupt: !quiet });
  }

  function endViewing() {
    window.speechSynthesis?.cancel();
    setPhase("ending");
    setTimeout(() => router.push("/after"), 2600);
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (phase === "ringing" || phase === "connecting") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-between bg-gradient-to-b from-slate-900 to-teal-950 px-6 py-14 text-white sm:min-h-[calc(100dvh-3rem)]">
        <div className="text-center">
          <div className="text-sm text-teal-200">{phase === "ringing" ? "Incoming call…" : "Connecting…"}</div>
          <div className="relative mx-auto mt-10 h-28 w-28">
            <span className="absolute inset-0 animate-ring rounded-full bg-teal-400/40" />
            <span className="absolute inset-0 animate-ring rounded-full bg-teal-400/30 [animation-delay:0.8s]" />
            <span className="relative grid h-28 w-28 place-items-center rounded-full bg-teal-500 text-4xl">✦</span>
          </div>
          <div className="mt-8 text-2xl font-semibold">AI Viewing Assistant</div>
          <div className="mt-1 text-sm text-slate-300">{property.address}</div>
        </div>
        {phase === "ringing" ? (
          <div className="w-full space-y-4">
            <button onClick={accept} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-3xl shadow-lg shadow-emerald-500/40 transition active:scale-95">
              📞
            </button>
            <div className="text-center text-sm text-slate-300">Tap to answer</div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center text-[11px] leading-relaxed text-amber-100">
              <b>MOCK:</b> In production this is a real phone call from a voice AI (e.g. Vapi/Retell), placed
              automatically when the door opens. Here it&apos;s simulated in the browser — turn your sound on.
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-teal-300" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-col bg-slate-950 text-white sm:h-[calc(100dvh-3rem)]">
      {/* Call header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-500 text-lg">
          ✦
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">AI Agent — On Call</div>
          <div className="truncate text-xs text-emerald-300">
            ● {mmss} · {room ? room.name : property.address}
          </div>
        </div>
        <button
          onClick={agent.toggleMute}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base ${agent.muted ? "bg-white/10" : "bg-white"}`}
          aria-label={agent.muted ? "Turn speaker on" : "Turn speaker off"}
          title="Speaker"
        >
          {agent.muted ? "🔇" : "🔊"}
        </button>
        <RestartButton className="shrink-0 !px-1 !text-[10px] !text-slate-500 hover:!bg-white/10" />
      </div>

      {/* Current room + waveform */}
      <div className="relative">
        {room && <Photo key={room.id} src={room.photo} alt={room.name} className={`w-full transition-all ${showRooms ? "h-32" : "h-20"}`} />}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        <div className="absolute bottom-2 left-4 right-4 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-teal-200">You are in</div>
            <div className="text-lg font-semibold">{room?.name}</div>
          </div>
          <Waveform active={agent.speaking} listening={dictation.listening} />
        </div>
      </div>

      {/* Room navigator */}
      <div className="border-b border-white/10 px-2 py-2">
        <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] text-slate-400">
          <span>Walk through — tap the room you&apos;re entering</span>
          <button onClick={() => setShowRooms((s) => !s)} className="text-teal-300">
            {showRooms ? "Hide" : "Show"}
          </button>
        </div>
        {showRooms && (
          <div className="flex gap-2 overflow-x-auto px-2 pb-1">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => enterRoom(r.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  r.id === roomId
                    ? "bg-teal-500 text-white"
                    : visited.includes(r.id)
                      ? "bg-white/15 text-slate-200"
                      : "bg-white/5 text-slate-300 ring-1 ring-white/15"
                }`}
              >
                {visited.includes(r.id) && r.id !== roomId ? "✓ " : ""}
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Transcript (live captions of the call) */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {agent.messages.map((m) =>
          m.from === "system" ? (
            <div key={m.id} className="text-center text-[11px] text-slate-500">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className={`flex ${m.from === "buyer" ? "justify-end" : ""}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.from === "buyer" ? "rounded-br-sm bg-teal-600" : "rounded-bl-sm bg-white/10"
                }`}
              >
                {m.text}
              </div>
            </div>
          ),
        )}
        {agent.thinking && (
          <div className="flex gap-1 px-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>

      {/* Suggested questions */}
      {room && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2">
          {room.suggestions.map((s) => (
            <button key={s} onClick={() => agent.ask(s)} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/20">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Ask + controls */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          agent.ask(draft);
          setDraft("");
        }}
        className="flex items-center gap-2 px-4 pb-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={dictation.listening ? "Listening…" : "Ask anything — e.g. how old is the boiler?"}
          className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-teal-400"
        />
        {dictation.supported && (
          <button
            type="button"
            onClick={dictation.listening ? dictation.stop : dictation.start}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${dictation.listening ? "animate-pulse bg-red-500" : "bg-white/10"}`}
            aria-label="Speak your question"
          >
            🎙
          </button>
        )}
        <button type="submit" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal-500" aria-label="Send">
          ↑
        </button>
      </form>
      <div className="px-4 pb-4 pt-1">
        <button onClick={endViewing} className="btn bg-red-600 py-3 text-white hover:bg-red-700">
          End viewing
        </button>
        <div className="mt-1.5 text-center text-[10px] text-slate-500">
          Mock: stands in for the lock detecting the door closing behind you.
        </div>
      </div>

      {phase === "ending" && (
        <div className="absolute inset-0 z-30 flex animate-pop flex-col items-center justify-center bg-slate-950/95 text-center">
          <div className="text-5xl">🔒</div>
          <div className="mt-4 text-lg font-semibold">Door closed · Locked</div>
          <div className="mt-1 text-sm text-slate-400">Call ended · {mmss}</div>
          <div className="mt-6 max-w-xs text-sm text-slate-300">Thanks for viewing {property.address}. Your access code has now expired.</div>
        </div>
      )}
    </div>
  );
}

function Waveform({ active, listening }: { active: boolean; listening: boolean }) {
  const bars = [0.5, 0.8, 1, 0.7, 0.9, 0.6, 1, 0.75, 0.55];
  return (
    <div className="flex h-8 items-center gap-[3px]" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] origin-center rounded-full ${listening ? "bg-red-400" : "bg-teal-300"} ${active || listening ? "animate-wave" : ""}`}
          style={{
            height: `${h * 100}%`,
            transform: active || listening ? undefined : "scaleY(0.15)",
            animationDelay: `${i * 0.09}s`,
            animationDuration: `${0.7 + (i % 3) * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}
