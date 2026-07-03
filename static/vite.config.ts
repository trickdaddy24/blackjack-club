import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Repo-root VERSION file is the source of truth, baked in at build time
const version = readFileSync("../VERSION", "utf8").trim();

// base "./" keeps asset URLs relative so the build works at
// https://<user>.github.io/<repo>/ without knowing the repo name.
export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react(), tailwindcss()],
  css: {
    // Stop Vite from discovering the parent Next app's postcss.config.mjs —
    // Tailwind already runs through its Vite plugin here.
    postcss: {},
  },
  server: {
    fs: {
      // engine.ts / sound.ts are imported from the parent app — single source of truth
      allow: [".."],
    },
  },
});
