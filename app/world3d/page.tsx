import dynamic from "next/dynamic";

// Three.js touches `window`, so the canvas never renders on the server.
const ThreeCanvas = dynamic(() => import("@/three/ThreeCanvas"), { ssr: false });

/**
 * Phase 1 of the Phaser -> Three.js migration: a PARALLEL route that renders
 * the same authored world data in 3D.
 *
 * Deliberately has no HUD, no networking and no player controls. Its only job
 * is to prove the world data maps correctly into a 3D scene while /world
 * continues to run the existing Phaser renderer untouched.
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
          <div className="font-semibold">Town Central · 3D</div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider opacity-40">
            phase 1 · no player · no network
          </div>
        </div>
      </div>
    </main>
  );
}
