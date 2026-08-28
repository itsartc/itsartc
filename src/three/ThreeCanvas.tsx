"use client";

import { useEffect, useRef, useState } from "react";
import { townCentral } from "@/world/townCentral";

/**
 * Mounts the Three.js world into a div.
 *
 * Mirrors the structure of the existing Phaser GameCanvas: client-only, with a
 * dynamic import inside the effect so Three.js stays out of the server bundle
 * and out of every route that doesn't use it.
 *
 * Strict-mode safe: the effect's cleanup fully disposes the renderer, and a
 * `cancelled` guard stops a late async import from mounting a second canvas
 * after unmount.
 */
export default function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderer: { dispose: () => void } | null = null;

    (async () => {
      try {
        const { WorldRenderer } = await import("./WorldRenderer");
        if (cancelled || !containerRef.current) return;

        const instance = new WorldRenderer(containerRef.current, townCentral);
        renderer = instance;

        // Exposed for smoke tests and manual diagnostics in the console.
        (window as unknown as { __three?: unknown }).__three = instance;
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      renderer?.dispose();
      renderer = null;
      delete (window as unknown as { __three?: unknown }).__three;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {!ready && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink text-parchment">
          <div className="text-center">
            <div className="mb-2 animate-pulse font-mono text-sm">Building the 3D world…</div>
            <div className="text-xs opacity-60">itsartc · /world3d</div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink p-6 text-parchment">
          <div className="max-w-md text-center">
            <div className="mb-2 font-mono text-sm text-red-300">3D renderer failed to start</div>
            <div className="font-mono text-xs opacity-70">{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}
