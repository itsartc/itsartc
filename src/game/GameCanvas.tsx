"use client";

import { useEffect, useRef } from "react";
import { townCentral } from "@/world/townCentral";

/**
 * Mounts the Phaser world into a div. Phaser touches `window`, so this
 * component is client-only and imports Phaser dynamically inside the effect to
 * keep it out of the server bundle.
 */
export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);

  useEffect(() => {
    let destroyed = false;

    (async () => {
      const Phaser = (await import("phaser")).default;
      const { WorldScene } = await import("./WorldScene");
      if (destroyed || !containerRef.current) return;

      // Allow forcing the Canvas renderer (?renderer=canvas) — useful for
      // headless environments where WebGL context creation is unreliable.
      const forceCanvas =
        new URLSearchParams(window.location.search).get("renderer") === "canvas";

      const game = new Phaser.Game({
        type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
        parent: containerRef.current,
        backgroundColor: "#3a5a2a",
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: "100%",
          height: "100%",
        },
        pixelArt: true,
        physics: {
          default: "arcade",
          arcade: { gravity: { x: 0, y: 0 }, debug: false },
        },
        scene: [WorldScene],
      });

      game.scene.start("world", { map: townCentral });
      gameRef.current = game;
      // Handy for debugging in the browser console (and automated smoke tests).
      (window as unknown as { __game?: unknown }).__game = game;
    })();

    return () => {
      destroyed = true;
      const g = gameRef.current as { destroy: (b: boolean) => void } | null;
      if (g) g.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full touch-none" />;
}
