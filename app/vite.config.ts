import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Static-export friendly Vite config.
// Goals:
//  - Tor / I2P-safe (no third-party CDNs at runtime; CoinGecko is optional)
//  - Drop-in hosting (Cloudflare Pages, IPFS, plain S3+CF, .onion mirror)
//  - Easy to fork into a host runtime: import { App } from "src/App"
//
// Override `base` to a sub-path if you embed the build under /v5/ etc.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  base: process.env.VITE_BASE ?? "/",
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Stable chunk names so Tor users get long-tail HTTP cache hits.
        chunkFileNames: "assets/[name]-[hash:8].js",
        entryFileNames: "assets/[name]-[hash:8].js",
        assetFileNames: "assets/[name]-[hash:8][extname]",
      },
    },
  },
  // Dev-only proxy: forward /api and /ws to a live v4 origin so `npm run dev`
  // exercises the real endpoints SAME-ORIGIN (no CORS, no browser→third-party).
  // Production serves /api same-origin from the Vercel functions, so no proxy
  // is needed there. Override the target with VITE_API_ORIGIN.
  server: (() => {
    const apiOrigin = process.env.VITE_API_ORIGIN ?? "https://xmr.irish";
    return {
      port: 5173,
      host: true,
      proxy: {
        "/api": { target: apiOrigin, changeOrigin: true, secure: true },
        "/ws": {
          target: apiOrigin.replace(/^http/, "ws"),
          ws: true,
          changeOrigin: true,
          secure: true,
        },
      },
    };
  })(),
});
