import dynamic from "next/dynamic";

// Three.js touches `window`, so the canvas never renders on the server.
const ThreeCanvas = dynamic(() => import("@/three/ThreeCanvas"), { ssr: false });

/**
 * The Phaser -> Three.js migration route: a PARALLEL route that renders the
 * same authored world data in 3D, while /world continues to run the existing
 * Phaser renderer untouched.
 *
 * Phase 3 adds authored collision and world bounds without changing /world.
 * Multiplayer and voice remain on the later migration path.
 */
export default function World3DPage() {
  return (
    <main className="fixed inset-0 bg-[#8fb7d4]">
      <ThreeCanvas />

      <div className="pointer-events-none absolute left-4 top-4 z-20">
        <div className="rounded-lg bg-ink/85 px-3 py-2 text-parchment shadow-lg">
          <div className="text-[10px] uppercase tracking-widest opacity-60">
            Renderer preview
          </div>
          <div className="font-semibold">Future City · 3D</div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider opacity-40">
            complete city layout · first-person
          </div>
          <div className="mt-1.5 border-t border-parchment/15 pt-1.5 font-mono text-[10px] opacity-60">
            WASD / arrows / click to walk
          </div>
        </div>
      </div>
    </main>
  );
}
