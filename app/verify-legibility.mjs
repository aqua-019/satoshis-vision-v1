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
const stylesPath = "src/styles.css";
// v6.1.3 — the fifth sheet. Adding a stylesheet WITHOUT adding it here is the
// silent-coverage failure this file exists to prevent: every layer assertion
// below iterates STYLESHEETS, so an omitted sheet is not "passing", it is
// unexamined. ::view-transition-* pseudo-elements are the specific hazard —
// they match on the document root and read like they belong at top level, so
// an unlayered rule there would outrank every layered rule in the app.
const motionPath = "src/styles-motion.css";

const legSrc = read(legPath);
const themeSrc = read(themePath);
const ambSrc = read(ambPath);
const stylesSrc = read(stylesPath);
const motionSrc = read(motionPath);

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

// ── 1b) every color-mix() must mix toward `transparent` ────────────────────
// v6.1.2 — the colour audit replaced ~119 hardcoded rgba() tints with
// color-mix(in srgb, var(--role) N%, transparent). That is the only way to keep
// an alpha tint while still resolving through a theme role, since a CSS custom
// property cannot be alpha-adjusted at the call site and a React inline style
// object cannot carry a fallback declaration for the same key.
//
// The safety property this asserts: color-mix() is Chrome 111+ / Firefox 113+ /
// Safari 16.2+, the same era as oklch(), which this repo already guards behind
// @supports. On an older engine the declaration is simply invalid and does not
// apply — so a mix TOWARD TRANSPARENT degrades to "no tint", which is fine, while
// a mix toward an opaque colour would degrade to "no surface at all". On a page
// with an aurora behind it that is the panel-goes-transparent bug verify-contrast
// checks for at runtime. Keep every mix ending in `, transparent)` and the
// degraded case can only ever be flatter, never broken.
{
  const tsxFiles = walk(join(appDir, "src"), ".tsx").sort();
  const violations = [];
  for (const f of tsxFiles) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/color-mix\(/g)) {
      let i = m.index + m[0].length, depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === "(") depth++;
        else if (src[i] === ")") depth--;
        i++;
      }
      const expr = src.slice(m.index, i);
      if (!/,\s*transparent\s*\)$/.test(expr)) {
        violations.push(`${f.replace(appDir + "/", "")}  ${expr.slice(0, 80)}`);
      }
    }
  }
  assert(
    "every color-mix() in app/src/**/*.tsx mixes toward transparent (degrades to no-tint, never to no-surface)",
    violations.length === 0,
    violations.length === 0
      ? ""
      : `${violations.length} mix(es) toward an opaque colour:\n    ` + violations.join("\n    ")
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
    const layerViolations = [];
    // v6.1.2 — three themes. The old pair of regexes hardcoded "indigo" and the
    // `:not([data-theme="indigo"])` classic branch; with phosphor in the tree
    // "not indigo" no longer means "classic", so every theme is now named
    // explicitly and the unstamped case (JS off — the pre-paint stamp never
    // runs) is matched by :root:not([data-theme]) rather than by exclusion.
    const THEME_NAMES = ["classic", "indigo", "phosphor"];
    const SCOPED = new RegExp(
      `^:root(?:\\[data-theme="(?:${THEME_NAMES.join("|")})"\\]|:not\\(\\[data-theme\\]\\))`
    );

    // v6.0.7: @supports is a conditional GROUP rule — its own header is never a
    // selector, so checking it directly would always "fail". Descend into its
    // body and hold the rules inside to the same scoping contract instead.
    // Offsets stay absolute so violations still report a real line number.
    // v6.0.11 cascade-layers retrofit: the whole file is now wrapped in one or
    // more `@layer theme { ... }` blocks (§1 of the retrofit), so every real
    // rule's header is nested one level deeper than before. @layer is the same
    // kind of conditional GROUP rule @supports already is here — its header is
    // never a selector either — so it gets the identical descend-and-flatten
    // treatment, recursively (a `@supports` block inside a `@layer` block, as
    // styles-theme.css has, unwraps both levels).
    // Carries the enclosing @layer name down, so a rule can be checked for
    // WHICH layer it landed in as well as how it is scoped.
    const flatten = (list, offset, layer) =>
      list.flatMap((b) => {
        const h = b.header || "";
        const m = /^@layer\s+([a-z]+)/.exec(h);
        if (m) return flatten(topLevelBlocks(b.body ?? ""), offset + b.bodyStart + 1, m[1]);
        if (/^@supports\b/.test(h)) return flatten(topLevelBlocks(b.body ?? ""), offset + b.bodyStart + 1, layer);
        return [{ ...b, headerStart: b.headerStart + offset, layer }];
      });

    for (const b of flatten(blocks, 0, null)) {
      const header = b.header;
      if (!header) continue; // stray/empty (shouldn't happen)
      if (/^@keyframes\b/.test(header)) continue; // unconditional, allowed
      if (header === ":root") continue; // shared identity/alias bindings, allowed

      const parts = header.split(",").map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (!SCOPED.test(part)) {
          violations.push(`${themePath}:${lineOf(stripped, b.headerStart)}  "${part}" (in rule "${header}")`);
        }
        // LAYER PLACEMENT. A rule that only sets custom properties is a TOKEN
        // block and belongs in `theme`. A rule with a descendant/compound part
        // after the :root scope is a COMPONENT OVERRIDE and must live in
        // `components` — because layer order beats specificity, and `theme` is
        // declared BEFORE `components`. A component override left in `theme`
        // loses to styles.css's base `.topbar`/`.panel`/`.mblock` rules however
        // specific it is, and does nothing at all. That regressed once during
        // the v6.1.2 layer retrofit and no other assertion in this repo noticed:
        // they all check selector SHAPE, none check which declaration won.
        const isOverride = /^:root(?:\[[^\]]*\]|:not\([^)]*\))*\s*\S/.test(part) &&
                           /[\s>+~]/.test(part.replace(/^:root(?:\[[^\]]*\]|:not\([^)]*\))*/, "").trim() ||
                             part.replace(/^:root(?:\[[^\]]*\]|:not\([^)]*\))*/, "").trim());
        if (isOverride && b.layer && b.layer !== "components") {
          layerViolations.push(
            `${themePath}:${lineOf(stripped, b.headerStart)}  "${part}" is in @layer ${b.layer}, must be @layer components`
          );
        }
      }
    }

    assert(
      `styles-theme.css: every rule outside :root/@keyframes is scoped to one of ${THEME_NAMES.map((t) => `[data-theme="${t}"]`).join(" / ")} or :root:not([data-theme])`,
      violations.length === 0,
      violations.length === 0
        ? ""
        : `${violations.length} unscoped rule(s):\n    ` + violations.join("\n    ")
    );

    assert(
      "styles-theme.css: component overrides live in @layer components, not @layer theme (layer order beats specificity)",
      layerViolations.length === 0,
      layerViolations.length === 0
        ? ""
        : `${layerViolations.length} rule(s) in the wrong layer — these silently lose to styles.css:\n    ` +
          layerViolations.join("\n    ")
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

// ── 6) v6.0.10 · the in-chart type tokens ──────────────────────────────────
// Deliberately NOT appended to the SCALE array above: that loop asserts each
// token is declared EXACTLY ONCE, and these two are declared twice on purpose —
// once in :root and once in the ≤768px block, because §2.4 requires chart text
// to scale UP on phones while prose scales down.
{
  const CHART_TOKENS = [
    // [token, desktop, mobile]
    ["--fs-chart-tick", "11px", "12px"],
    ["--fs-chart-label", "12px", "13px"],
  ];
  if (!legSrc) {
    assert("styles-legibility.css declares the chart type tokens", false, `${legPath} not found`);
  } else {
    // topLevelBlocks() is brace-depth aware, so the @media block comes back as
    // one unit rather than being split at its inner braces.
    // topLevelBlocks() yields { header, body } — the @media block comes back as
    // ONE unit (it is brace-depth aware), which is exactly what we need here.
    // Strip comments FIRST: a block's header is everything since the previous
    // closing brace, so a doc comment above `:root {` lands inside the header
    // and an equality test against ":root" never matches. stripCssComments
    // preserves length, so line numbers still resolve.
    // v6.0.11 cascade-layers retrofit: the whole file now lives inside one or
    // more `@layer utilities { ... }` wrappers, so :root and the ≤768px block
    // are no longer top-level — they sit one level inside the layer. Flatten
    // through @layer first, same descend-and-offset treatment the
    // styles-theme.css check above gives @supports/@layer.
    const flattenLayer = (list, offset) =>
      list.flatMap((b) =>
        /^@layer\b/.test(b.header || "")
          ? flattenLayer(topLevelBlocks(b.body ?? ""), offset + b.bodyStart + 1)
          : [{ ...b, headerStart: b.headerStart + offset }]
      );
    const blocks = flattenLayer(topLevelBlocks(stripCssComments(legSrc)), 0);
    const mobile = blocks.find((b) => /@media[^{]*max-width:\s*768px/.test(b.header));
    const rootBlocks = blocks.filter((b) => b.header.trim() === ":root");

    for (const [name, desktop, mobileVal] of CHART_TOKENS) {
      const re = new RegExp(escapeRegExp(name) + "\\s*:\\s*([^;]+);");
      const inRoot = rootBlocks.map((b) => b.body.match(re)).filter(Boolean);
      assert(
        `${name} is declared once at :root as ${desktop}`,
        inRoot.length === 1 && inRoot[0][1].trim() === desktop,
        inRoot.length === 0 ? "not declared at :root"
          : inRoot.length > 1 ? `declared ${inRoot.length} times at :root`
          : `got "${inRoot[0][1].trim()}"`,
      );
      const inMobile = mobile ? mobile.body.match(re) : null;
      assert(
        `${name} steps UP to ${mobileVal} inside @media (max-width: 768px)`,
        !!inMobile && inMobile[1].trim() === mobileVal,
        !mobile ? "no ≤768px block found"
          : !inMobile ? "not overridden on mobile — chart text would shrink with prose"
          : `got "${inMobile[1].trim()}"`,
      );
    }

    // Plain px, never clamp(): design/useChartMetrics.ts reads these back with
    // getComputedStyle to derive chart geometry, and an unregistered custom
    // property computes to its own token stream — a clamp() would hand JS the
    // literal string "clamp(11px, …)" and parseFloat would return 11 by
    // accident rather than by design.
    for (const [name] of CHART_TOKENS) {
      const re = new RegExp(escapeRegExp(name) + "\\s*:\\s*([^;]+);", "g");
      const bad = [...legSrc.matchAll(re)].filter((m) => /clamp|calc|var/.test(m[1]));
      assert(
        `${name} is a plain px length (useChartMetrics parses it)`,
        bad.length === 0,
        bad.map((m) => `${legPath}:${lineOf(legSrc, m.index)}  ${m[1].trim()}`).join("\n    "),
      );
    }
  }
}

// ── 7) no sub-11 SVG fontSize ATTRIBUTE in the migrated file set ───────────
// Assertion 2 above scans the `fontSize:` object form and deliberately excludes
// the `fontSize="9"` presentation attribute. That exclusion is what let 3.2px
// chart labels ship. This closes it — scoped to files that have actually been
// migrated, so a file owned by another stream reports as ⚠ rather than ❌.
{
  const MIGRATED = [
    "src/pages/markets/charts.tsx",
    "src/protocols/metaphors.tsx",
    "src/protocols/ringct.tsx",
    "src/protocols/fcmp.tsx",
    "src/protocols/dandelion.tsx",
    "src/protocols/decoy-selection.tsx",
    "src/protocols/stealth.tsx",
    "src/protocols/lighthouse.tsx",
    "src/pages/monero/TechTab.tsx",
    // src/mempool/** is NOT listed. v6.0.10 migrated those views, then the
    // v6.0.8/6.0.9 work on main rewrote them (MemViewShell, imperative gauge
    // painting, chart-kit). Re-applying the type pass onto that new structure
    // during a merge would be unreviewable and unverifiable — the mempool
    // routes need the live node feed, which no gate here can reach — and no
    // v6.0.10 defect concerns them. Main's version stands; the mempool type
    // pass wants its own change, verified against a real node.
  ];
  // `=` form only: fontSize="9" / fontSize={9}. The `:` form is assertion 2's.
  const re = /fontSize=(?:"([\d.]+)"|\{\s*([\d.]+)\s*\})/g;
  const violations = [];
  for (const rel of MIGRATED) {
    let src;
    try { src = readFileSync(new URL("./" + rel, import.meta.url), "utf8"); }
    catch { violations.push(`${rel}  (unreadable)`); continue; }
    for (const m of src.matchAll(re)) {
      const v = Number(m[1] ?? m[2]);
      if (v < 11) violations.push(`${rel}:${lineOf(src, m.index)}  fontSize=${m[1] ?? m[2]}`);
    }
  }
  assert(
    "no sub-11 SVG fontSize attribute remains in the migrated chart/diagram files",
    violations.length === 0,
    violations.slice(0, 20).join("\n    ") + (violations.length > 20 ? `\n    …and ${violations.length - 20} more` : ""),
  );
}

// ── 8) cascade layers · v6.0.11 retrofit ────────────────────────────────────
// 8a) the layer order is declared exactly once, verbatim, across the
// stylesheets. THE governing hazard: an unlayered rule beats every layered
// rule, silently — so the order statement itself must exist exactly once
// (declaring it more than once is harmless per spec, but a second, drifted
// copy is exactly the kind of thing that goes stale unnoticed) and every
// real rule below must live inside one of the five named layers.
{
  const LAYER_STMT = "@layer reset, base, theme, components, utilities;";
  const STYLESHEETS = [
    [stylesPath, stylesSrc],
    [legPath, legSrc],
    [themePath, themeSrc],
    [ambPath, ambSrc],
    [motionPath, motionSrc],
  ];

  const occurrences = [];
  for (const [path, src] of STYLESHEETS) {
    if (!src) continue;
    let idx = src.indexOf(LAYER_STMT);
    while (idx !== -1) {
      occurrences.push(`${path}:${lineOf(src, idx)}`);
      idx = src.indexOf(LAYER_STMT, idx + LAYER_STMT.length);
    }
  }
  assert(
    `the layer order statement ("${LAYER_STMT}") appears exactly once across ${STYLESHEETS.map(([p]) => p.replace("src/", "")).join(" / ")}`,
    occurrences.length === 1,
    occurrences.length === 0
      ? `not found in any of the ${STYLESHEETS.length} files`
      : `found ${occurrences.length} time(s): ${occurrences.join(", ")}`
  );

  // 8b) no top-level rule in any of the layered stylesheets sits outside a
  // @layer block. Exempt: @font-face, @keyframes, @property, @charset, @import
  // (none of which participate in layering) and the @layer statement itself (it
  // has no body, so topLevelBlocks — which only ever sees brace-delimited
  // blocks — can never surface it here in the first place). Anything else at
  // the top level that isn't itself a `@layer ... { }` wrapper is the exact
  // hazard §2 of the retrofit warns about: it silently outranks every rule
  // that IS layered, with no error from any tool.
  //
  // @property is exempt for a specific reason, not by analogy: a registration
  // is not a declaration and takes part in no cascade, so a layer around it
  // would change nothing. Its `initial-value` is a last-resort fallback, and
  // the thing that actually matters about it — that no theme ever silently
  // falls back TO that value (a custom-property cycle, a bad var()
  // reference, or a value the engine rejects all self-heal a registered
  // property straight to initial-value, with nothing else signalling it) —
  // is asserted at runtime by verify-roles.mjs instead. It resolves all 18
  // role tokens per theme via getComputedStyle and fails if a role that
  // theme actually declares resolves to its initial-value (classic gets a
  // stronger self-consistency check, since classic's healthy value equals
  // initial-value by construction and that comparison alone can't tell a
  // working classic from a broken one); a role a theme doesn't declare is
  // checked against the value it's actually inheriting instead.
  const EXEMPT_AT_RULE = /^@(font-face|keyframes|property|charset|import)\b/;
  const LAYER_BLOCK = /^@layer\b/;
  const unlayered = [];
  for (const [path, src] of STYLESHEETS) {
    if (!src) {
      unlayered.push(`${path}  (file not found)`);
      continue;
    }
    const stripped = stripCssComments(src);
    for (const b of topLevelBlocks(stripped)) {
      const header = b.header;
      if (!header) continue; // stray/empty (shouldn't happen)
      if (EXEMPT_AT_RULE.test(header)) continue;
      if (LAYER_BLOCK.test(header)) continue;
      unlayered.push(`${path}:${lineOf(stripped, b.headerStart)}  "${header}"`);
    }
  }
  assert(
    `no top-level rule in ${STYLESHEETS.map(([p]) => p.replace("src/", "")).join(" / ")} sits outside a @layer block`,
    unlayered.length === 0,
    unlayered.length === 0
      ? ""
      : `${unlayered.length} unlayered rule(s):\n    ` + unlayered.join("\n    ")
  );
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
