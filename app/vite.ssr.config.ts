import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// SSR/prerender build only. Deliberately does NOT reuse vite.config.ts's
// rollupOptions: its manualChunks names `react`, which is external in an SSR
// build and makes rollup fail outright.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    ssr: true,
    outDir: "dist-ssr",
    target: "es2022",
    rollupOptions: { input: "src/entry-ssr.tsx", output: { entryFileNames: "entry-ssr.js" } },
  },
});
