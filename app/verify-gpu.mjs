// verify-gpu.mjs — D0673. Animate `transform` and `opacity` only.
// Run from app/: `node verify-gpu.mjs`
//
// Offline source assertion, no browser. Scans app/src/mempool/** and
// app/src/protocols/** — the two directories where a layout-property animation
// is most expensive, because they carry the per-frame surfaces (six mempool
// views, 21 simulators) rather than page chrome.
//
// WHY THIS EXISTS, stated plainly: five `transition: width` sites survived a
// merge in v6.1.3. Four of them had just been TOKENISED — rewritten to
// `var(--d-4)` with a tidy `// D0651:` comment — so they read as freshly
// audited and compliant while doing exactly what the rule forbids. Nothing was
// watching: verify-motion.mjs covers the View Transitions machinery only. A
// gate that does not exist is why a rule with no enforcement decays into a
// comment. Animating width/left/top forces layout on every frame of every
// animation; transform and opacity are composited.
//
// Two design choices worth keeping if this file is edited:
//
//  1. COMMENTS ARE STRIPPED BEFORE MATCHING. This code legitimately NAMES the
//     banned properties in its own prose — including every explanatory comment
//     the D0673 conversion added, which say things like "scaleX, not width".
//     verify-memshell.mjs strips for the same reason. A gate that trips on its
//     own documentation gets weakened rather than fixed.
//
//  2. THE MATCH IS ON THE TRANSITIONED PROPERTY LIST, not on any occurrence of
//     the word. `max-width`, `min-height`, `border-width`, `line-height`,
//     `background-position` and a static `inset: "0 auto 0 0"` all contain a
//     banned substring and none of them is an animation. Matching loosely would
//     produce false positives, and a gate that cries wolf gets disabled.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { makeReporter } from "./verify-lib.mjs";

const appDir = dirname(fileURLToPath(import.meta.url));
const R = makeReporter("verify-gpu");

/** Directories this gate owns. */
const SCOPE = ["src/mempool", "src/protocols"];

/** Layout-triggering properties. Animating any of these forces a reflow. */
const BANNED = [
  "top", "left", "right", "bottom",
  "width", "height",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "inset",
];

// ── SVG carve-out ───────────────────────────────────────────────────────────
// These are SVG GEOMETRY / PRESENTATION ATTRIBUTES, not CSS box properties.
// They are exempt for a reason, not by convenience, and the reason is what
// makes the exemption safe to keep:
//
//   • `r` (protocols/stealth.tsx) is a circle's radius. There is no transform
//     that expresses "grow the radius" without also scaling stroke width and
//     any text inside, so the usual `scaleX/scaleY` substitution changes what
//     the drawing means.
//   • `stroke-dashoffset` (mempool/bridge.tsx) is how you animate a path being
//     drawn. It has no transform equivalent at all.
//
// Neither triggers layout: an SVG attribute animation reflows nothing outside
// its own <svg> viewport, which is the entire cost this gate exists to prevent.
//
// Listed as PROPERTY NAMES rather than file paths on purpose. A file list rots
// the first time someone moves a line; a reason survives, and if a third SVG
// attribute genuinely needs animating, the next reader can check it against the
// same two tests — is it an SVG attribute, and does it avoid layout?
const SVG_EXEMPT = new Set(["r", "cx", "cy", "stroke-dashoffset", "stroke-dasharray", "x", "y"]);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && /\.(tsx?|css)$/.test(e.name)) out.push(full);
  }
  return out;
}

/** Blank out comments, preserving offsets so line numbers stay correct. */
function stripComments(src) {
  const blank = (m) => m.replace(/[^\n]/g, " ");
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)   // /* … */ and JSX {/* … */} bodies
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + blank(m.slice(p1.length)));
}

const lineOf = (src, i) => src.slice(0, i).split("\n").length;

/**
 * Pull candidate animated property names out of one `transition:` value.
 *
 * Deliberately NOT "the first identifier of each comma-separated segment",
 * which is what a CSS grammar would suggest. Half the sites here are React
 * inline styles written as a ternary:
 *
 *   transition: reduced ? "none" : "stroke-dashoffset 0.95s linear, stroke .3s"
 *
 * where the first token of the first segment is `reduced`, not a property at
 * all — a positional parser silently reads that as compliant and the gate goes
 * quiet on exactly the sites most likely to be wrong. So instead: harvest every
 * lowercase identifier in the value and test each for membership. Durations
 * (`0.95s`), functions (`var`, `cubic-bezier`) and capitalised JS identifiers
 * are not property names and fall out on their own.
 */
function transitionProps(value) {
  return [...value.matchAll(/[a-z][a-z-]*/g)].map((m) => m[0]);
}

/** Not properties — the tail of a transition shorthand, or CSS plumbing. */
const NOT_A_PROPERTY = new Set([
  "none", "ease", "linear", "steps", "var", "cubic", "bezier", "cubic-bezier",
  "ease-in", "ease-out", "ease-in-out", "s", "ms", "infinite", "both",
  "alternate", "forwards", "backwards", "normal", "reverse", "initial",
  "inherit", "unset", "revert",
]);

const violations = [];
const svgAllowed = [];
let filesScanned = 0;
let transitionsSeen = 0;
let keyframesSeen = 0;

for (const scope of SCOPE) {
  for (const file of walk(join(appDir, scope))) {
    filesScanned++;
    const rel = relative(appDir, file);
    const src = stripComments(readFileSync(file, "utf8"));

    // ── transition: … (CSS declarations and inline style strings alike) ──
    for (const m of src.matchAll(/\btransition\s*:\s*([^;\n}]*)/g)) {
      transitionsSeen++;
      const raw = m[1];
      // A ternary (`reduceMotion ? "none" : "transform …"`) yields both arms;
      // checking every identifier in the whole value covers both.
      for (const prop of transitionProps(raw)) {
        if (NOT_A_PROPERTY.has(prop)) continue;
        if (SVG_EXEMPT.has(prop)) { svgAllowed.push(`${rel}:${lineOf(src, m.index)}  ${prop}`); continue; }
        if (prop === "all" || BANNED.includes(prop)) {
          violations.push(`${rel}:${lineOf(src, m.index)}  transition animates "${prop}"`);
        }
      }
    }

    // ── transition-property: … ──
    for (const m of src.matchAll(/\btransition-property\s*:\s*([^;\n}]*)/g)) {
      for (const prop of transitionProps(m[1])) {
        if (NOT_A_PROPERTY.has(prop)) continue;
        if (SVG_EXEMPT.has(prop)) { svgAllowed.push(`${rel}:${lineOf(src, m.index)}  ${prop}`); continue; }
        if (prop === "all" || BANNED.includes(prop)) {
          violations.push(`${rel}:${lineOf(src, m.index)}  transition-property "${prop}"`);
        }
      }
    }

    // ── @keyframes … { … } — check the DECLARATIONS inside each block ──
    for (const m of src.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)\s*\{/g)) {
      keyframesSeen++;
      // Brace-match the block so a nested `{ }` cannot end it early.
      let depth = 1, i = m.index + m[0].length;
      while (i < src.length && depth > 0) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") depth--;
        i++;
      }
      const body = src.slice(m.index + m[0].length, i);
      for (const d of body.matchAll(/(^|[{;\s])([a-z-]+)\s*:/g)) {
        const prop = d[2];
        if (SVG_EXEMPT.has(prop)) continue;
        if (BANNED.includes(prop)) {
          violations.push(`${rel}:${lineOf(src, m.index)}  @keyframes ${m[1]} animates "${prop}"`);
        }
      }
    }
  }
}

R.group("── D0673 · transform and opacity only ─────────────────────");
R.info(`scanned ${filesScanned} files under ${SCOPE.join(", ")} — ${transitionsSeen} transition declarations, ${keyframesSeen} @keyframes blocks`);
if (svgAllowed.length) {
  R.info(`${svgAllowed.length} SVG attribute animation(s) exempt (geometry/presentation, no layout):`);
  for (const s of svgAllowed) R.info(`    ${s}`);
}
R.ok(
  violations.length === 0,
  `no transition or @keyframes under ${SCOPE.join(" / ")} animates a layout property`,
  violations.join("\n     "),
);

process.exit(R.finish());
