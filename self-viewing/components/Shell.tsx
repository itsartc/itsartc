"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useDemo } from "@/lib/state";

export const STEPS = ["Book", "Verify", "Code", "Arrive", "View", "Next"] as const;

export function Shell({
  step,
  title,
  back,
  children,
  footer,
}: {
  step?: number;
  title?: string;
  back?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col sm:min-h-[calc(100dvh-3rem)]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-3">
          {back ? (
            <Link href={back} className="-ml-1 rounded-full p-1 text-slate-500 hover:bg-slate-100" aria-label="Back">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
          ) : (
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-xs font-bold text-white">SV</span>
          )}
          <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
          <RestartButton />
        </div>
        {step !== undefined && (
          <div className="mt-3 flex gap-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className={`h-1 rounded-full ${i <= step ? "bg-brand" : "bg-slate-200"}`} />
                <div className={`mt-1 text-center text-[10px] ${i === step ? "font-semibold text-brand" : "text-slate-400"}`}>{s}</div>
              </div>
            ))}
          </div>
        )}
      </header>
      <main className="flex-1 px-4 py-5">{children}</main>
      {footer && <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">{footer}</div>}
    </div>
  );
}

export function RestartButton({ className = "" }: { className?: string }) {
  const { reset } = useDemo();
  const router = useRouter();
  return (
    <button
      onClick={() => {
        reset();
        router.push("/");
      }}
      className={`rounded-full px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${className}`}
    >
      Restart demo
    </button>
  );
}

/** Visible marker wherever a real integration would sit. */
export function MockNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
      <span className="shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">Mock</span>
      <span>{children}</span>
    </div>
  );
}

/** Image with a soft gradient fallback if the remote photo can't load. */
export function Photo({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-teal-100 via-slate-100 to-amber-100 ${className}`}>
      <span className="absolute inset-0 grid place-items-center text-sm text-slate-400">{alt}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="relative h-full w-full object-cover"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
      />
    </div>
  );
}

/** Redirects to `to` when a flow prerequisite is missing (e.g. deep link). */
export function Guard({ ok, to, children }: { ok: boolean; to: string; children: ReactNode }) {
  const { ready } = useDemo();
  const router = useRouter();
  useEffect(() => {
    if (ready && !ok) router.replace(to);
  }, [ready, ok, to, router]);
  if (!ready || !ok) return null;
  return <>{children}</>;
}
