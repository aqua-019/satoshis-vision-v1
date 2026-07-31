// verify-legibility.mjs — static assertions for the v6.0.2 three-layer visual
// system (L1 styles-legibility.css / L2 styles-theme.css / L3 styles-ambient.css).
// Run from app/: `node verify-legibility.mjs`
//
// Reads source files with fs.readFileSync and asserts the contract in the
// static-source-assertion style of verify-sediment.mjs. Prints ✅/❌ per
// check; exits 1 on any failure.
//
// NOTE: assertion 2 (no sub-14 inline fontSize) scans *.tsx files owned by
// other streams (ui-builder et al). It may legitimately fail while sibling
// agents are still mid-edit — that is expected and reported, not a reason
// to weaken the check.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = __dirname; // this script lives in app/

const read = (rel) => {
  try {
    return readFileSync(join(appDir, rel), "utf8");
  } catch (e) {
    return null;
  }
};

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Recursively collect files under a directory matching a suffix.
function walk(dir, suffix, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, suffix, out);
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      out.push(full);
    }
  }
  return out;
}

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

// Strip CSS block comments while preserving length/newlines, so byte offsets
// computed on the stripped string still map to correct line numbers in the
// original file.
function stripCssComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

// Split top-level CSS into { header, body, headerStart, bodyEnd } blocks,
// brace-depth aware (so a nested @keyframes body doesn't end the block early).
function topLevelBlocks(src) {
  const blocks = [];
  let depth = 0;
  let headerStart = 0;
  let cur = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "{") {
      if (depth === 0) {
        cur = { header: src.slice(headerStart, i).trim(), headerStart, bodyStart: i };
        blocks.push(cur);
      }
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && cur) {
        cur.body = src.slice(cur.bodyStart + 1, i);
        cur.bodyEnd = i;
        headerStart = i + 1;
        cur = null;
      }
    }
  }
  return blocks;
}

const legPath = "src/styles-legibility.css";
const themePath = "src/styles-theme.css";
const ambPath = "src/styles-ambient.css";

const legSrc = read(legPath);
const themeSrc = read(themePath);
const ambSrc = read(ambPath);

let failed = false;
const checks = [];

function assert(label, ok, detail = "", { owned = true } = {}) {
  checks.push({ label, ok, detail, owned });
  if (!ok && owned) failed = true;
}

// ── 1) the fluid type scale exists, exactly, verbatim ───────────────────────
const SCALE = [
  ["--fs-hero", "clamp(36px, 3.3vw, 60px)"],
  ["--fs-h1", "clamp(28px, 2.4vw, 44px)"],
  ["--fs-h2", "clamp(21px, 1.7vw, 30px)"],
  ["--fs-body", "clamp(14px, 1vw, 16.5px)"],
  ["--fs-mono", "clamp(12.5px, 0.9vw, 14px)"],
  // v6.0.10: floor raised 10.5 → 11. "Nothing below 11 ships" is now a
  // site-wide rule, not just a chart rule, and --fs-label is the only
  // token that was still under it.
  ["--fs-label", "clamp(11px, 0.74vw, 12px)"],
];

for (const [name, expected] of SCALE) {
  if (!legSrc) {
    assert(`${legPath} defines ${name} exactly once as ${expected}`, false, `${legPath} not found`);
    continue;
  }
  const re = new RegExp(escapeRegExp(name) + "\\s*:\\s*([^;]+);", "g");
  const matches = [...legSrc.matchAll(re)];
  const count = matches.length;
  const value = count === 1 ? matches[0][1].trim() : null;
  assert(
    `${legPath} defines ${name} exactly once as ${expected}`,
    count === 1 && value === expected,
    count === 0
      ? "not declared"
      : count > 1
        ? `declared ${count} times (must be exactly once) at lines ${matches.map((m) => lineOf(legSrc, m.index)).join(", ")}`
        : `found "${value}" at ${legPath}:${lineOf(legSrc, matches[0].index)}`
  );
}

// ── 2) no sub-14 inline style-object fontSize in app/src/**/*.tsx ───────────
// In scope:  `fontSize: 12`            (object property, colon — React inline style)
//            `fontSize: mono ? 12 : 13` (ternary of numeric literals)
// Out of scope: `fontSize="9"` / `fontSize={9}` (JSX attribute, equals sign —
//            SVG presentation attribute, user-space units inside a viewBox).
// Distinguished purely by syntax: the regex anchors on `fontSize:`, which an
// `=`-form attribute can never match.
{
  const tsxFiles = walk(join(appDir, "src"), ".tsx").sort();
  const violations = [];
  const valueRe = /fontSize:\s*([^,\n}]+)/g;
  const numRe = /-?\d+(?:\.\d+)?/g;

  for (const file of tsxFiles) {
    const src = readFileSync(file, "utf8");
    const relPath = relative(appDir, file);
    let m;
    valueRe.lastIndex = 0;
    while ((m = valueRe.exec(src))) {
      const raw = m[1].trim();
      // A string/template literal (e.g. a CSS `clamp(...)` value, or a plain
      // px string) is not the "bare number" form this check targets — skip.
      if (raw[0] === '"' || raw[0] === "'" || raw[0] === "`") continue;
      const nums = raw.match(numRe);
      if (!nums) continue; // no numeric literal at all (e.g. bare identifier) — skip
      const subFourteen = nums.map(Number).filter((n) => n < 14);
      if (subFourteen.length > 0) {
        violations.push(`${relPath}:${lineOf(src, m.index)}  fontSize: ${raw}`);
      }
    }
  }

  assert(
    "no sub-14 inline style-object fontSize remains in app/src/**/*.tsx",
    violations.length === 0,
    violations.length === 0
      ? ""
      : `${violations.length} violation(s):\n    ` + violations.join("\n    ")
  );
}

// ── 3) .art-canvas declares both width:100% and height:100% ────────────────
{
  if (!legSrc) {
    assert(".art-canvas declares both width:100% and height:100% in styles-legibility.css", false, `${legPath} not found`);
  } else {
    const re = /\.art-canvas\s*\{([^}]*)\}/g;
    const blocks = [...legSrc.matchAll(re)];
    const matchingBlock = blocks.find((b) => /width\s*:\s*100%/.test(b[1]) && /height\s*:\s*100%/.test(b[1]));
    assert(
      ".art-canvas declares both width:100% and height:100% in styles-legibility.css",
      !!matchingBlock,
      matchingBlock
        ? `found at ${legPath}:${lineOf(legSrc, matchingBlock.index)}`
        : blocks.length === 0
          ? "no .art-canvas rule found at all"
          : `found ${blocks.length} .art-canvas block(s) at lines ${blocks.map((b) => lineOf(legSrc, b.index)).join(", ")}, none with both properties in one block`
    );
  }
}

// ── 4) layer purity ──────────────────────────────────────────────────────────
// 4a) L1 and L3 must never reference [data-theme=...] — they are unconditional.
for (const [label, src, path] of [
  ["styles-legibility.css (L1)", legSrc, legPath],
  ["styles-ambient.css (L3)", ambSrc, ambPath],
]) {
  if (!src) {
    assert(`${label} contains no [data-theme=...] selector`, false, `${path} not found`);
    continue;
  }
  const idx = src.indexOf("[data-theme=");
  assert(
    `${label} contains no [data-theme=...] selector`,
    idx === -1,
    idx === -1 ? "" : `found "[data-theme=" at ${path}:${lineOf(src, idx)}`
  );
}

// 4b) every chrome-recolor rule in styles-theme.css is scoped to
// :root[data-theme="indigo"] or :root:not([data-theme="indigo"]), except the
// classic-identity `:root { ... }` block and any `@keyframes` block.
{
  if (!themeSrc) {
    assert("styles-theme.css: every rule outside :root/@keyframes is theme-scoped", false, `${themePath} not found`);
  } else {
    const stripped = stripCssComments(themeSrc);
    const blocks = topLevelBlocks(stripped);
    const violations = [];
    const INDIGO = /^:root\[data-theme="indigo"\]/;
    const NOT_INDIGO = /^:root:not\(\[data-theme="indigo"\]\)/;

    for (const b of blocks) {
      const header = b.header;
      if (!header) continue; // stray/empty (shouldn't happen)
      if (/^@keyframes\b/.test(header)) continue; // unconditional, allowed
      if (header === ":root") continue; // classic-identity bindings, allowed

      const parts = header.split(",").map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (!INDIGO.test(part) && !NOT_INDIGO.test(part)) {
          violations.push(`${themePath}:${lineOf(stripped, b.headerStart)}  "${part}" (in rule "${header}")`);
        }
      }
    }

    assert(
      "styles-theme.css: every rule outside :root/@keyframes is scoped to :root[data-theme=\"indigo\"] or :root:not([data-theme=\"indigo\"])",
      violations.length === 0,
      violations.length === 0
        ? ""
        : `${violations.length} unscoped rule(s):\n    ` + violations.join("\n    ")
    );
  }
}

// ── 5) no bare keyframe-name collisions in styles-ambient.css ──────────────
{
  const BANNED = ["sweep", "drift", "streamY", "bg-pulse", "bg-pulse-soft"];
  if (!ambSrc) {
    assert("styles-ambient.css does not redeclare styles.css keyframe names", false, `${ambPath} not found`);
  } else {
    const violations = [];
    for (const name of BANNED) {
      // negative lookahead guards bg-pulse from also matching bg-pulse-soft
      const re = new RegExp("@keyframes\\s+" + escapeRegExp(name) + "(?![A-Za-z0-9_-])", "g");
      let m;
      while ((m = re.exec(ambSrc))) {
        violations.push(`${ambPath}:${lineOf(ambSrc, m.index)}  @keyframes ${name}`);
      }
    }
    assert(
      "styles-ambient.css does not redeclare sweep/drift/streamY/bg-pulse/bg-pulse-soft (already in styles.css)",
      violations.length === 0,
      violations.length === 0 ? "" : violations.join("\n    ")
    );
  }
}

// ── report ──────────────────────────────────────────────────────────────────
console.log("verify-legibility — static assertions\n");
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
  console.log(`❌ ${ownedFails} assertion(s) failed.`);
  process.exit(1);
} else {
  if (otherFails) console.log(`⚠️  ${otherFails} non-owned (other-stream) assertion(s) failed — expected if not yet landed.`);
  console.log("✅ All legibility assertions passed.");
  process.exit(0);
}
