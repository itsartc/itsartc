import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', "ui-monospace", "monospace"],
      },
      colors: {
        // Cozy world palette
        grass: "#7cb342",
        grassdark: "#689f38",
        path: "#c9a66b",
        water: "#4a9fd4",
        ink: "#1e2733",
        parchment: "#f5efe0",
      },
    },
  },
  plugins: [],
};

export default config;
