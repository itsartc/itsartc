import dynamic from "next/dynamic";

// Three.js touches `window`, so the canvas never renders on the server.
const DowntownCanvas = dynamic(() => import("@/three/DowntownCanvas"), { ssr: false });

/**
 * The generated city, at a parallel route.
 *
 * `/` keeps serving the imported model until this one is demonstrably better;
 * running them side by side is the only honest way to judge that.
 */
export default function DowntownPage() {
  return (
    <main className="fixed inset-0 bg-[#12161c]">
      <DowntownCanvas />
    </main>
  );
}
