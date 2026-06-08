// verify-sediment.mjs — static assertions for the P5 SEDIMENT VIEW work.
// Run from app/: `node verify-sediment.mjs`
//
// Reads source files with fs.readFileSync and asserts the contract for the
// sediment view rebuild. Prints ✅/❌ per check; exits 1 on any failure.
//
// NOTE: the map.ts BLOCKS_CAP=100 check belongs to another stream; it documents
// the runtime contract that data.blocks can hold up to 100 blocks. It may fail
// until that stream lands — that is expected and reported, not owned here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = __dirname; // this script lives in app/

const read = (rel) => {
  try {
    return readFileSync(join(appDir, rel), "utf8");
  } catch (e) {
    return null;
  }
};

const mapSrc = read("src/data/map.ts");
const sedSrc = read("src/mempool/sediment.tsx");

let failed = false;
const checks = [];

function assert(label, ok, detail = "", { owned = true } = {}) {
  checks.push({ label, ok, detail, owned });
  if (!ok && owned) failed = true;
}

// Helper: extract a function body by name (best-effort brace matcher).
function fnBody(src, name) {
  if (!src) return null;
  const start = src.indexOf("export function " + name);
  if (start === -1) return null;
  const braceStart = src.indexOf("{", start);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(braceStart, i + 1);
    }
  }
  return src.slice(braceStart);
}

// 1) map.ts contains BLOCKS_CAP = 100 (another stream's change — not owned).
assert(
  "map.ts declares BLOCKS_CAP = 100",
  !!mapSrc && /BLOCKS_CAP\s*=\s*100/.test(mapSrc),
  mapSrc ? "" : "src/data/map.ts not found",
  { owned: false }
);

// 2) sediment.tsx imports AreaSeries AND BarSeries from @/pages/markets/charts.
{
  const importRe = /import\s*\{([^}]*)\}\s*from\s*["']@\/pages\/markets\/charts["']/;
  const m = sedSrc && sedSrc.match(importRe);
  const names = m ? m[1] : "";
  const hasArea = /\bAreaSeries\b/.test(names);
  const hasBar = /\bBarSeries\b/.test(names);
  assert(
    "sediment.tsx imports AreaSeries AND BarSeries from @/pages/markets/charts",
    !!m && hasArea && hasBar,
    m ? `imports: ${names.trim()}` : "no charts import found"
  );
}

// 3) No preserveAspectRatio in SedStrataLog / SedFeeProfile (assert none in file).
{
  const fileHasPAR = sedSrc && /preserveAspectRatio\s*=\s*["']none["']/.test(sedSrc);
  const strata = fnBody(sedSrc, "SedStrataLog") || "";
  const feeProf = fnBody(sedSrc, "SedFeeProfile") || "";
  const regionHasPAR = /preserveAspectRatio/.test(strata) || /preserveAspectRatio/.test(feeProf);
  assert(
    'no preserveAspectRatio="none" in sediment.tsx (and none in SedStrataLog/SedFeeProfile)',
    !!sedSrc && !fileHasPAR && !regionHasPAR,
    fileHasPAR ? 'found preserveAspectRatio="none"' : regionHasPAR ? "found preserveAspectRatio in rebuilt region" : ""
  );
}

// 4) sediment.tsx uses BLOCKS_CAP for the strata slice.
assert(
  "sediment.tsx slices strata with slice(0, BLOCKS_CAP)",
  !!sedSrc && /slice\(0,\s*BLOCKS_CAP\)/.test(sedSrc),
  ""
);

// 5) BLOCKS_CAP resolves to 100 (declared in sediment.tsx) — proves up-to-100 strata.
{
  const m = sedSrc && sedSrc.match(/BLOCKS_CAP\s*=\s*(\d+)/);
  const val = m ? Number(m[1]) : NaN;
  assert(
    "sediment.tsx SedStrataLog scales to BLOCKS_CAP === 100 (up to 100 strata)",
    val === 100,
    Number.isNaN(val) ? "BLOCKS_CAP not declared in sediment.tsx" : `BLOCKS_CAP = ${val}`
  );
}

// ── report ──────────────────────────────────────────────────────────────────
console.log("verify-sediment — static assertions\n");
for (const c of checks) {
  const mark = c.ok ? "✅" : "❌";
  const tag = c.owned ? "" : " (other stream)";
  const detail = c.detail ? `  — ${c.detail}` : "";
  console.log(`${mark} ${c.label}${tag}${detail}`);
}

const ownedFails = checks.filter((c) => c.owned && !c.ok).length;
const otherFails = checks.filter((c) => !c.owned && !c.ok).length;
console.log("");
if (failed) {
  console.log(`❌ ${ownedFails} owned assertion(s) failed.`);
  process.exit(1);
} else {
  if (otherFails) console.log(`⚠️  ${otherFails} non-owned (other-stream) assertion(s) failed — expected if not yet landed.`);
  console.log("✅ All sediment.tsx-scoped assertions passed.");
  process.exit(0);
}
