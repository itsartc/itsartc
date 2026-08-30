"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mounts the generated city.
 *
 * Unlike the imported world there is no model download to wait on — the
 * geometry is built on the client — so this only guards the dynamic import of
 * Three.js itself.
 */
export default function DowntownCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderer: { dispose: () => void } | null = null;

    (async () => {
      try {
        const { DowntownRenderer } = await import("./DowntownRenderer");
        if (cancelled || !containerRef.current) return;
        const instance = new DowntownRenderer(containerRef.current);
        renderer = instance;
        (window as unknown as { __downtown?: unknown }).__downtown = instance;
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      renderer?.dispose();
      renderer = null;
      delete (window as unknown as { __downtown?: unknown }).__downtown;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {!ready && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#12161c]">
          <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] opacity-50">
            building downtown…
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#12161c] p-6">
          <div className="max-w-md text-center">
            <p className="font-mono text-sm text-red-300">Downtown failed to build</p>
            <p className="mt-2 font-mono text-xs opacity-60">{error}</p>
          </div>
        </div>
      )}

      {ready && (
        <>
          <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg bg-black/55 px-3 py-2 text-white/80 backdrop-blur">
            <div className="text-[10px] uppercase tracking-widest opacity-50">Generated world</div>
            <div className="font-semibold">Downtown</div>
          </div>
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 font-mono text-[11px] tracking-wide text-white/70 backdrop-blur">
            ↑ ↓ ← →  move  ·  drag  look around
          </div>
        </>
      )}
    </div>
  );
}
