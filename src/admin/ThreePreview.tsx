"use client";

import { useEffect, useRef, useState } from "react";
import type { CameraView } from "@/three/CameraRig";
import type { WorldMap } from "@/world/schema";

export default function ThreePreview({ map, view }: { map: WorldMap; view: CameraView }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderer: { dispose: () => void } | null = null;
    setError(null);

    (async () => {
      try {
        const { WorldRenderer } = await import("@/three/WorldRenderer");
        if (cancelled || !containerRef.current) return;
        renderer = new WorldRenderer(containerRef.current, map, { view });
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();

    return () => {
      cancelled = true;
      renderer?.dispose();
    };
  }, [map, view]);

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl bg-[#8fb7d4]">
      <div ref={containerRef} className="absolute inset-0" />
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/90 p-6 text-center text-sm text-red-200">
          Preview failed: {error}
        </div>
      )}
    </div>
  );
}
