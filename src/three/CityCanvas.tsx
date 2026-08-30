"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mounts the city renderer into a full-bleed div.
 *
 * Client-only, with the renderer imported inside the effect so Three.js stays
 * out of the server bundle. A `cancelled` guard stops a late async import from
 * mounting a second canvas after unmount, which React strict mode would
 * otherwise cause in development.
 */
export default function CityCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderer: { dispose: () => void } | null = null;

    (async () => {
      try {
        const { CityRenderer } = await import("./CityRenderer");
        if (cancelled || !containerRef.current) return;

        const instance = new CityRenderer(containerRef.current, {
          onProgress: (f) => !cancelled && setProgress(f),
          onLoaded: () => !cancelled && setReady(true),
          onError: (m) => !cancelled && setError(m),
        });
        renderer = instance;

        // Exposed for smoke tests and console diagnostics.
        (window as unknown as { __city?: unknown }).__city = instance;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      renderer?.dispose();
      renderer = null;
      delete (window as unknown as { __city?: unknown }).__city;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {!ready && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#12161c]">
          <div className="w-64 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-40">itsartc</p>
            <p className="mt-3 text-sm opacity-70">Loading the world…</p>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/70 transition-[width] duration-200"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[10px] opacity-40">
              {Math.round(progress * 100)}%
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#12161c] p-6">
          <div className="max-w-md text-center">
            <p className="font-mono text-sm text-red-300">The world failed to load</p>
            <p className="mt-2 font-mono text-xs opacity-60">{error}</p>
          </div>
        </div>
      )}

      {ready && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
          <div className="rounded-full bg-black/55 px-4 py-2 font-mono text-[11px] tracking-wide text-white/70 backdrop-blur">
            ↑ ↓ ← →  move  ·  drag  look around
          </div>
        </div>
      )}
    </div>
  );
}
