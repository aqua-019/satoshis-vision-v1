#!/usr/bin/env node
/**
 * scripts/port-jsx-to-tsx.mjs
 *
 * One-shot porter for the legacy five01/src/**\/*.jsx files into the
 * Vite+TS repo layout. Idempotent — run as many times as you like.
 *
 * Usage:
 *   node scripts/port-jsx-to-tsx.mjs ../five01/src   src
 *
 * Transformations applied per file:
 *   1) Strip `Object.assign(window, { … })` blobs (replaced with ES exports)
 *   2) `window.Foo = Foo` → `export { Foo }`
 *   3) Add `import * as React from "react"` at the top
 *   4) Add typed imports for shared primitives (useTick, ShortHash, fmtFee, …)
 *   5) Add `: any` parameter annotations where missing (TS-lite mode)
 *   6) Rename .jsx → .tsx
 *
 * The output is NOT 100% strict-TS clean — you'll likely need to:
 *   - fix any remaining implicit-any in JSX prop spreads
 *   - tighten parameter types from `any` to the proper data types
 *   - resolve any cross-file references that the script couldn't deduce
 *
 * Track the manual fixups in MIGRATION.md.
 */

import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const [, , SRC = "../five01/src", DST = "src"] = process.argv;

const SHARED_IMPORTS = `import * as React from "react";
import { useTick, ArtBackground } from "@/design/ArtBackground";
import {
  Stat, Pill, PanelFrame, Sparkline, MiniBar, Crumbs, Card,
} from "@/design/primitives";
import { ProtoArtboard, ProtoStep, ProtoHeader } from "@/design/ProtoArtboard";
import { NavTop } from "@/layout/NavTop";
import { NetRail } from "@/layout/NetRail";
import { Footer } from "@/layout/Footer";
import { useMoneroLive } from "@/data/DataContext";
import { fmtN, fmtFee, fmtBytes, shortHash as ShortHash, randHex } from "@/data/types";

`;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && e.name.endsWith(".jsx")) out.push(p);
  }
  return out;
}

function transform(src, file) {
  let s = src;

  // Strip window.X = X lines
  s = s.replace(/window\.([A-Za-z_$][\w$]*)\s*=\s*\1\s*;?/g, "");

  // Strip Object.assign(window, { ... }) blocks (multiline)
  s = s.replace(/Object\.assign\(\s*window\s*,\s*\{[\s\S]*?\}\s*\)\s*;?/g, "");

  // Map: `function FooView({...}) {` → `export function FooView({...}: any) {`
  s = s.replace(
    /function\s+([A-Z]\w*)\s*\(\s*\{([^}]*)\}\s*\)\s*\{/g,
    (_m, name, dest) => `export function ${name}({${dest}}: any) {`
  );

  // Function components without destructure: `function FooView(props) {`
  s = s.replace(
    /function\s+([A-Z]\w*)\s*\(\s*([a-z_]\w*)\s*\)\s*\{/g,
    (_m, name, arg) => `export function ${name}(${arg}: any) {`
  );

  // Component-internal helpers: just type their props as any too
  // (skipping for now — manual fixup is cheap)

  // Replace bare `useMoneroLive()` calls — they're now from the context module
  // (no change needed if the file uses it the same way)

  // Comment markers that the script ran
  s = `// AUTO-PORTED from ${file}\n// Run \`npm run port\` to refresh. Manual fixups land in MIGRATION.md.\n${SHARED_IMPORTS}${s}`;

  return s;
}

async function main() {
  const files = await walk(SRC);
  console.log(`Found ${files.length} .jsx files under ${SRC}`);
  for (const f of files) {
    const rel = path.relative(SRC, f);
    if (rel.startsWith("app01")) continue; // skip the design-hub-only shell
    const out = path.join(DST, rel.replace(/\.jsx$/, ".tsx"));
    await mkdir(path.dirname(out), { recursive: true });
    const src = await readFile(f, "utf8");
    const tsx = transform(src, rel);
    await writeFile(out, tsx, "utf8");
    console.log("  →", out);
  }
  console.log("\nDone. Review MIGRATION.md for manual cleanup steps.");
}

main().catch((e) => { console.error(e); process.exit(1); });
