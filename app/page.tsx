import dynamic from "next/dynamic";

// Three.js touches `window`, so the canvas never renders on the server.
const DowntownCanvas = dynamic(() => import("@/three/DowntownCanvas"), { ssr: false });

/**
 * The world.
 *
 * Downtown is generated on the client from layout data, so there is no model to
 * download and nothing to wait on beyond the texture library.
 */
export default function Home() {
  return (
    <main className="fixed inset-0 bg-[#12161c]">
      <DowntownCanvas />
    </main>
  );
}
