"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Guard, MockNote, Shell } from "@/components/Shell";
import { verifyIdentity } from "@/lib/services/kyc";
import { useDemo } from "@/lib/state";

// Step 2 — identity verification (mocked; see lib/services/kyc.ts).
export default function VerifyPage() {
  const router = useRouter();
  const { state, update } = useDemo();
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "checking" | "done">("idle");
  const [stage, setStage] = useState(0);
  const stages = ["Reading document…", "Checking document security features…", "Matching selfie to ID…"];

  async function run() {
    if (!idDoc || !selfie) return;
    setPhase("checking");
    const t = setInterval(() => setStage((s) => Math.min(s + 1, stages.length - 1)), 850);
    const res = await verifyIdentity(idDoc, selfie);
    clearInterval(t);
    update({ verified: true, kycRef: res.reference });
    setPhase("done");
    setTimeout(() => router.push("/confirmed"), 1100);
  }

  return (
    <Guard ok={!!state.slot} to="/book">
      <Shell
        step={1}
        title="Verify your identity"
        back="/book"
        footer={
          phase === "idle" && (
            <button className="btn-primary" disabled={!idDoc || !selfie} onClick={run}>
              Verify me
            </button>
          )
        }
      >
        {phase === "idle" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              For the owner&apos;s security, everyone who self-views is ID-checked once. It takes under a minute.
            </p>
            <Upload
              label="Photo ID"
              hint="Passport, national ID card or driving licence"
              icon="🪪"
              file={idDoc}
              onFile={setIdDoc}
            />
            <Upload label="Selfie" hint="Face the camera in good light" icon="🤳" file={selfie} onFile={setSelfie} capture="user" />
            <MockNote>
              No real verification happens. Files stay in your browser and are never uploaded. Production would use a
              KYC vendor (document + liveness + face match).
            </MockNote>
          </div>
        )}

        {phase !== "idle" && (
          <div className="flex flex-col items-center py-16 text-center">
            {phase === "checking" ? (
              <>
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-light border-t-brand" />
                <div className="mt-6 font-semibold">Verifying…</div>
                <div className="mt-1 text-sm text-slate-500">{stages[stage]}</div>
              </>
            ) : (
              <>
                <div className="grid h-16 w-16 animate-pop place-items-center rounded-full bg-brand text-3xl text-white">✓</div>
                <div className="mt-6 text-lg font-semibold">You&apos;re verified</div>
                <div className="mt-1 text-sm text-slate-500">Creating your access code…</div>
              </>
            )}
          </div>
        )}
      </Shell>
    </Guard>
  );
}

function Upload({
  label,
  hint,
  icon,
  file,
  onFile,
  capture,
}: {
  label: string;
  hint: string;
  icon: string;
  file: File | null;
  onFile: (f: File | null) => void;
  capture?: "user" | "environment";
}) {
  return (
    <label className={`card flex cursor-pointer items-center gap-4 transition hover:ring-brand ${file ? "ring-2 ring-brand" : ""}`}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl">{file ? "✅" : icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block truncate text-sm text-slate-500">{file ? file.name : hint}</span>
      </span>
      <span className="text-sm font-medium text-brand">{file ? "Change" : "Add"}</span>
      <input type="file" accept="image/*" capture={capture} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}
