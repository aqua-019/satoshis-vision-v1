import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * bundleGraph — emits the chunk import graph for verify-bundle.mjs. v6.1.5.
 *
 * WHY THIS IMPLEMENTS ONLY `writeBundle`, AND NOTHING ELSE
 * A plugin that implements only `writeBundle` is structurally incapable of
 * altering emitted output: the hook runs after Rollup has written every file,
 * and its return value is discarded. That is the mechanical guarantee behind
 * this release's claim that the budget gates change nothing the site does —
 * and PERF-BASELINE.md records the check that turns it into a fact: build dist/
 * with and without this plugin and diff every asset hash. Do not "upgrade" this
 * to `generateBundle` for convenience; that hook CAN mutate the bundle, and the
 * guarantee dies silently.
 *
 * That check compares dist/assets/ only, and deliberately so: `npm run build`
 * is NOT reproducible for the 11 prerendered index.html files. Footer.tsx
 * renders a live UTC clock, and scripts/prerender.mjs bakes the build machine's
 * wall clock into every route — two consecutive builds of identical source
 * measured `UTC 13:32:51` and `UTC 13:33:29`. Pre-existing, unrelated to this
 * plugin, and recorded in PERF-BASELINE.md as a finding. Assets are the only
 * output Rollup emits, so they are the only output this plugin could affect.
 *
 * WHY IT RECORDS NO SIZES
 * verify-bundle.mjs stats and gzips the files from disk instead. That measures
 * the bytes serve-dist actually serves, and it keeps this plugin trivially
 * output-neutral. Two responsibilities, two files, and no in-memory-vs-on-disk
 * discrepancy to explain later.
 *
 * WHY NOT `modules[].renderedLength`
 * It is pre-minification and pre-gzip. Recording it here would invite someone
 * to budget against it, and per-module "sizes" that do not sum to the chunk
 * are how a bundle report starts lying.
 *
 * WHERE IT WRITES
 * app/.perf/ — deliberately OUTSIDE dist/. vercel.json publishes app/dist, so
 * nothing here reaches the deploy. verify-bundle.mjs asserts that rather than
 * assuming it.
 */
function bundleGraph(): Plugin {
  const appDir = fileURLToPath(new URL(".", import.meta.url));
  return {
    name: "xmri-bundle-graph",
    apply: "build",
    writeBundle(options, bundle) {
      const outDir = options.dir ?? join(appDir, "dist");
      // The SSR build uses its own config and never registers this plugin, but
      // guard anyway: a graph describing dist-ssr/ would silently poison every
      // route budget.
      if (!outDir.replace(/\\/g, "/").endsWith("/dist")) return;

      const chunks = Object.values(bundle)
        .filter((c): c is Extract<typeof c, { type: "chunk" }> => c.type === "chunk")
        .map((c) => ({
          fileName: c.fileName,
          name: c.name,
          isEntry: c.isEntry,
          isDynamicEntry: c.isDynamicEntry,
          // Absolute and platform-shaped as Rollup hands it over; relativise to
          // app/ and force POSIX so the mapping in verify-bundle.mjs can be
          // written once and hold on any checkout.
          facadeModuleId: c.facadeModuleId
            ? relative(appDir, c.facadeModuleId).replace(/\\/g, "/")
            : null,
          imports: [...c.imports],
          dynamicImports: [...c.dynamicImports],
          moduleCount: Object.keys(c.modules).length,
        }))
        .sort((a, b) => a.fileName.localeCompare(b.fileName));

      const assets = Object.values(bundle)
        .filter((a): a is Extract<typeof a, { type: "asset" }> => a.type === "asset")
        .map((a) => a.fileName)
        .sort();

      const out = join(appDir, ".perf", "bundle-graph.json");
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(
        out,
        JSON.stringify({ schema: 1, builtAt: new Date().toISOString(), chunks, assets }, null, 2),
      );
    },
  };
}

// Static-export friendly Vite config.
// Goals:
//  - Tor / I2P-safe (no third-party CDNs at runtime; CoinGecko is optional)
//  - Drop-in hosting (Cloudflare Pages, IPFS, plain S3+CF, .onion mirror)
//  - Easy to fork into a host runtime: import { App } from "src/App"
//
// Override `base` to a sub-path if you embed the build under /v5/ etc.
export default defineConfig({
  plugins: [react(), bundleGraph()],
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
        // Pin the framework into its own chunk. This serves the same goal as
        // the stable names above: React + the router change on a dependency
        // bump (rarely), app code changes on every deploy (often). Split, a
        // returning Tor visitor re-downloads only what actually moved instead
        // of the framework riding along on every app-code hash change.
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
        },
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
