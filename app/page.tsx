import dynamic from "next/dynamic";

// Three.js touches `window`, so the canvas never renders on the server.
const CityCanvas = dynamic(() => import("@/three/CityCanvas"), { ssr: false });

/**
 * The world.
 *
 * A single imported GLB. There is a model to download before anything is
 * visible, which is what the canvas's loading state is for.
 */
export default function Home() {
  return (
    <main className="fixed inset-0 bg-[#12161c]">
      <CityCanvas />
    </main>
  );
}
