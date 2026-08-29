import dynamic from "next/dynamic";

// Three.js touches `window`, so the canvas never renders on the server.
const CityCanvas = dynamic(() => import("@/three/CityCanvas"), { ssr: false });

export default function Home() {
  return (
    <main className="fixed inset-0 bg-[#12161c]">
      <CityCanvas />
    </main>
  );
}
