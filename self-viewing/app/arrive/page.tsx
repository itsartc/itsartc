"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Guard, MockNote, Shell } from "@/components/Shell";
import { property } from "@/lib/property";
import { useDemo } from "@/lib/state";

// Step 4 — arrival. A stand-in for the physical smart-lock keypad at the door.
// Validation goes through /api/lock/unlock (mock of the lock vendor).
export default function ArrivePage() {
  const router = useRouter();
  const { state } = useDemo();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "wrong" | "open">("idle");
  const [showHint, setShowHint] = useState(false);

  async function submit(c: string) {
    setStatus("checking");
    const r = await fetch("/api/lock/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: state.booking?.bookingId, code: c }),
    }).then((r) => r.json());
    if (r.ok) {
      setStatus("open");
      setTimeout(() => router.push("/call"), 2200);
    } else {
      setStatus("wrong");
      setTimeout(() => {
        setCode("");
        setStatus("idle");
      }, 900);
    }
  }

  function press(k: string) {
    if (status !== "idle") return;
    if (k === "⌫") return setCode((c) => c.slice(0, -1));
    if (k === "✓") return code.length === 6 && submit(code);
    const next = (code + k).slice(0, 6);
    setCode(next);
    if (next.length === 6) submit(next);
  }

  const open = status === "open";

  return (
    <Guard ok={!!state.booking} to="/">
      <Shell step={3} title="At the front door" back="/confirmed">
        <p className="text-center text-sm text-slate-500">{property.address} · Front door</p>

        {/* The lock */}
        <div
          className={`mx-auto mt-4 w-64 rounded-[2rem] p-5 shadow-2xl transition-colors duration-500 ${
            open ? "bg-emerald-900" : "bg-slate-900"
          } ${status === "wrong" ? "animate-shake" : ""}`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase tracking-widest">Smart lock</span>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                open ? "bg-emerald-400 shadow-[0_0_12px] shadow-emerald-400" : status === "wrong" ? "bg-red-500" : "bg-amber-400"
              }`}
            />
          </div>

          {open ? (
            <div className="flex h-[21.5rem] animate-pop flex-col items-center justify-center text-center text-white">
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.6">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 7.5-2" />
              </svg>
              <div className="mt-4 text-xl font-semibold">Unlocked</div>
              <div className="mt-1 text-sm text-emerald-200">Welcome in — your AI guide is calling…</div>
            </div>
          ) : (
            <>
              <div className="my-5 flex justify-center gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-3 w-3 rounded-full ${
                      status === "wrong" ? "bg-red-500" : i < code.length ? "bg-white" : "bg-slate-700"
                    }`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map((k) => (
                  <button
                    key={k}
                    onClick={() => press(k)}
                    className="aspect-square rounded-full bg-slate-800 text-xl font-medium text-white shadow-inner transition active:scale-90 active:bg-slate-700"
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div className="mt-3 h-4 text-center text-xs text-slate-400">
                {status === "checking" ? "Checking…" : status === "wrong" ? "Wrong code — try again" : ""}
              </div>
            </>
          )}
        </div>

        {!open && (
          <div className="mt-6 space-y-3 text-center">
            <button onClick={() => setShowHint((s) => !s)} className="text-sm font-medium text-brand">
              {showHint ? `Your code: ${state.booking?.code}` : "Forgot your code?"}
            </button>
            <MockNote>
              This keypad stands in for walking up to the property. In production the lock validates the code itself
              and its &ldquo;door opened&rdquo; event triggers the AI phone call. Time-window checks are skipped in the demo.
            </MockNote>
          </div>
        )}
      </Shell>
    </Guard>
  );
}
