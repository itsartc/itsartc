import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0f766e", dark: "#115e59", light: "#ccfbf1" },
        ink: "#0f172a",
      },
      keyframes: {
        wave: { "0%,100%": { transform: "scaleY(0.25)" }, "50%": { transform: "scaleY(1)" } },
        ring: { "0%": { transform: "scale(1)", opacity: "0.6" }, "100%": { transform: "scale(1.8)", opacity: "0" } },
        pop: { "0%": { transform: "scale(0.6)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        shake: { "0%,100%": { transform: "translateX(0)" }, "25%": { transform: "translateX(-8px)" }, "75%": { transform: "translateX(8px)" } },
      },
      animation: {
        wave: "wave 1s ease-in-out infinite",
        ring: "ring 1.6s ease-out infinite",
        pop: "pop 0.35s ease-out both",
        shake: "shake 0.3s ease-in-out 2",
      },
    },
  },
  plugins: [],
};
export default config;
