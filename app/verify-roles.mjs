// verify-roles.mjs — v6.1.2 role-token @property registrations, resolved at
// runtime, per theme.
//
// styles.css:538-542 (verify-legibility.mjs, pre-fix) claimed that "no theme
// ever falls back TO [a role's] initial-value" was asserted at runtime by
// verify-contrast.mjs. It is not — verify-contrast.mjs never references
// @property, initial-value, or a role name. This is that missing gate.
//
// What it catches, in one check: a custom-property cycle, a typo'd var()
// reference inside a role's own declared value, and a value the CSS engine
// rejects — all three otherwise present identically as "a theme silently
// renders classic's colour and nothing tells you why".
//
// Source of truth: the 18 role names + their `initial-value` literals are
// PARSED out of styles.css's `@property` block (styles.css:40-57), not
// hardcoded — a hardcoded list would silently stop covering a 19th role the
// day one is added, which defeats the point of a rot-detector. Likewise
// which roles each theme declares is parsed out of styles.css (classic/base)
// and styles-theme.css (indigo, phosphor), not asserted by hand.
//
// Algorithm (see the two trap notes below for why it's shaped this way):
//
//   CLASSIC — classic's declared colour for every role is, by construction,
//   identical to that role's initial-value (styles.css:33-36: "initial-value
//   is CLASSIC's value in every case"). That makes "does it equal
//   initial-value?" useless as a bug signal for classic specifically: a
//   genuinely cyclic/broken classic role self-heals to registered
//   initial-value at :root, which is ALSO the value a healthy classic role
//   is supposed to show — same number, opposite reasons, indistinguishable
//   by that comparison alone. So classic gets a stronger, independent check:
//   its own raw declared expression (e.g. "var(--o-50)") is re-resolved
//   through a SEPARATE, unregistered custom property on a live probe element
//   (so it rides the exact same cascade/inheritance the real role would, but
//   can never itself be "the" cyclic declaration) and compared against what
//   the real, @property-typed role actually resolves to. A cycle or a typo'd
//   var() reference makes the two diverge even when both individually look
//   like "a colour" — see the worked example in this file's own comments
//   below the assertions, and the deliberate-break run in the handoff report
//   for what that divergence looks like when it fires for real. Classic also
//   gets the simpler equals-initial-value check too, since that IS the
//   correct, healthy state for classic and a drift between the two would
//   mean the @property initial-value literal and styles.css's declared
//   value fell out of sync with each other.
//
//   INDIGO / PHOSPHOR — every role either theme actually declares resolves,
//   BY DESIGN, to a colour that differs from initial-value (verified by hand
//   against both files while writing this gate: all 13 of indigo's and all
//   15 of phosphor's do). So for a DECLARED role, "resolves to something
//   other than initial-value" is both correct and sufficient — a cycle or a
//   rejected value self-heals a registered property straight to
//   initial-value, so this is exactly the failure mode it's built to catch.
//   For a role a theme does NOT declare (indigo inherits --accent-data /
//   --accent-data-hi plus the three theme-invariant --status-*; phosphor
//   inherits only the three --status-*), the assertion is "resolves to
//   classic's own resolved value for that role" — the base value it's
//   actually inheriting — which is also how a break in the BASE declaration
//   itself would surface here (it would surface on classic's own checks
//   too, correctly attributing the fault to where it actually lives).
//
// Trap 1 — not every theme declares every role. A naive "every theme
// declares all 18" assertion produces 8 false positives (5 on indigo, 3 on
// phosphor). The declared/inherited set is derived from source per theme,
// per role, and a skipped role is never counted toward a pass.
//
// Trap 2 — indigo re-declares --accent-structural / --accent-structural-dim
// a second time inside `@supports (color: oklch(0 0 0))`
// (styles-theme.css:216-231). Both bindings are collected as "declared" text
// candidates; the assertion used for indigo ("differs from initial-value")
// doesn't care which binding a given engine resolves, so this is satisfied
// without picking a side.
//
// Trap 3 — never `waitUntil: 'networkidle'`: the FAST polling tier fires
// every 3s, so the network is never idle. `domcontentloaded` + an explicit
// `waitForSelector` instead, exactly as verify-contrast.mjs:103-106 does.
//
// Colours are compared as resolved RGBA (via a 1×1 canvas paint, exactly
// verify-contrast.mjs's `resolve()`/`parse()` pattern), never as strings —
// Chromium re-serialises `oklch(...)` verbatim, so a naive text compare
// (or worse, a regex over the serialised string) either always agrees or
// always disagrees for the wrong reason. Two different notations for the
// same colour must compare equal.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launch, newThemedPage, makeReporter, BASE, THEMES } from './verify-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = __dirname;

const stylesPath = 'src/styles.css';
const themePath = 'src/styles-theme.css';
const stylesSrc = readFileSync(join(appDir, stylesPath), 'utf8');
const themeSrc = readFileSync(join(appDir, themePath), 'utf8');

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

// Strip CSS block comments while preserving length/newlines, so byte offsets
// computed on the stripped string still map to correct line numbers in the
// original file. (Same approach as verify-legibility.mjs.)
function stripCssComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

// Split top-level CSS into { header, body, headerStart, bodyStart } blocks,
// brace-depth aware. (Same as verify-legibility.mjs's topLevelBlocks.)
function topLevelBlocks(src) {
  const blocks = [];
  let depth = 0;
  let headerStart = 0;
  let cur = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      if (depth === 0) {
        cur = { header: src.slice(headerStart, i).trim(), headerStart, bodyStart: i };
        blocks.push(cur);
      }
      depth++;
    } else if (c === '}') {
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

// Descend into @layer and @supports — neither is a selector, both are
// conditional/grouping at-rules, so a rule nested inside either is still a
// top-level rule for cascade-scoping purposes. Recursive: styles-theme.css
// nests @supports inside @layer theme.
function flattenGroups(list, offset = 0) {
  return list.flatMap((b) => {
    const h = (b.header || '').trim();
    if (/^@layer\b/.test(h) || /^@supports\b/.test(h)) {
      return flattenGroups(topLevelBlocks(b.body ?? ''), offset + b.bodyStart + 1);
    }
    return [{ ...b, headerStart: b.headerStart + offset }];
  });
}

function findBlocksByHeader(src, exactHeader) {
  const stripped = stripCssComments(src);
  return flattenGroups(topLevelBlocks(stripped)).filter((b) => b.header.trim() === exactHeader);
}

// All raw declared-value texts for `role` inside `body`, in source order.
// Property-name-isolated so `--accent-structural` never matches inside
// `--accent-structural-dim`.
function extractRoleValues(body, role) {
  const re = new RegExp(`(?<![\\w-])${escapeRegExp(role)}(?![\\w-])\\s*:\\s*([^;]+);`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(body))) out.push(m[1].trim());
  return out;
}

// ── 1) parse the role list + initial-value literals out of the @property
// block. Nothing here is a hardcoded copy of styles.css:40-57 — add a 19th
// `@property --foo { syntax: '<color>'; ... }` role and it is picked up
// automatically on the next run. ──────────────────────────────────────────
function parsePropertyRoles(src) {
  const stripped = stripCssComments(src);
  const re = /@property\s+(--[\w-]+)\s*\{([^}]*)\}/g;
  const roles = [];
  let m;
  while ((m = re.exec(stripped))) {
    const body = m[2];
    const syntaxM = /syntax:\s*'([^']*)'/.exec(body);
    const initM = /initial-value:\s*([^;]+);/.exec(body);
    if (syntaxM && syntaxM[1] === '<color>' && initM) {
      roles.push({ name: m[1], initialValue: initM[1].trim(), line: lineOf(stripped, m.index) });
    }
  }
  return roles;
}

const ROLES = parsePropertyRoles(stylesSrc);

// ── 2) which roles each theme declares, and with what raw text. classic's
// come from styles.css's single unscoped `:root { ... }` (the `@layer base`
// block); indigo/phosphor's from styles-theme.css's `:root[data-theme="…"]`
// blocks (main + any @supports override, unioned). ─────────────────────────
const classicBlocks = findBlocksByHeader(stylesSrc, ':root');
const indigoBlocks = findBlocksByHeader(themeSrc, ':root[data-theme="indigo"]');
const phosphorBlocks = findBlocksByHeader(themeSrc, ':root[data-theme="phosphor"]');

function declsFor(blocks, role) {
  return blocks.flatMap((b) => extractRoleValues(b.body, role));
}

const DECLS = {
  classic: Object.fromEntries(ROLES.map((r) => [r.name, declsFor(classicBlocks, r.name)])),
  indigo: Object.fromEntries(ROLES.map((r) => [r.name, declsFor(indigoBlocks, r.name)])),
  phosphor: Object.fromEntries(ROLES.map((r) => [r.name, declsFor(phosphorBlocks, r.name)])),
};

// ── report scaffolding ──────────────────────────────────────────────────
const R = makeReporter('verify-roles');

console.log(`parsed ${ROLES.length} @property <color> role(s) from ${stylesPath}:40-57`);
console.log(
  `  classic blocks: ${classicBlocks.length} (${stylesPath}) · indigo blocks: ${indigoBlocks.length} · phosphor blocks: ${phosphorBlocks.length} (${themePath})`
);
if (ROLES.length === 0) {
  console.log('❌ no @property <color> registrations found — nothing to verify');
  process.exit(1);
}

// ── 3) resolve at runtime ───────────────────────────────────────────────
const { browser, engine } = await launch();
console.log('engine:', engine);

// Runs entirely in-page. Resolves:
//  - resolveVar(name): the REAL, @property-typed custom property, exactly as
//    a themed page would show it.
//  - resolveExpr(expr): `expr` assigned to a fresh, UNREGISTERED custom
//    property on the same probe, then consumed the same way. Because this
//    probe property is never itself the typed, potentially-cyclic one, it
//    can only diverge from resolveVar(role) if the role's declared value —
//    the same text handed in here — doesn't actually cascade to what the
//    role resolves to (a cycle, a bad var() reference, or a rejected value
//    all make the two diverge; a healthy role always agrees with itself).
const MEASURE = ({ roleNames, exprsToResolve }) => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    cx.globalCompositeOperation = 'copy'; // replace, so alpha survives
    cx.fillStyle = '#000';
    cx.fillStyle = c; // an invalid value leaves the previous fillStyle —
    // never hit in practice here, since `color`'s COMPUTED value is always a
    // valid rgb()/rgba() string (CSS falls back rather than leaving `color`
    // itself invalid), but guarded the same way verify-contrast.mjs is.
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], +(d[3] / 255).toFixed(4)];
  };

  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.opacity = '0';
  document.body.appendChild(probe);

  const resolveVar = (name) => {
    probe.style.color = '';
    probe.style.color = `var(${name})`;
    return parse(getComputedStyle(probe).color);
  };
  const resolveExpr = (expr) => {
    probe.style.removeProperty('--verify-expr');
    probe.style.color = '';
    probe.style.setProperty('--verify-expr', expr);
    probe.style.color = 'var(--verify-expr)';
    return parse(getComputedStyle(probe).color);
  };

  const actual = {};
  for (const name of roleNames) actual[name] = resolveVar(name);
  const expr = {};
  for (const [key, e] of Object.entries(exprsToResolve)) expr[key] = resolveExpr(e);

  probe.remove();
  return { actual, expr };
};

// Every colour compared here is a plain hex/rgba() literal (or, for indigo's
// two oklch-upgraded roles, an sRGB value nowhere near its initial-value —
// see trap 2 above), never the product of runtime float math on this page,
// so there is no rounding noise to tolerate. Exact equality is deliberate:
// phosphor's --surface-sunk (#010301) sits only 1 unit/channel from its
// initial-value (#020202) — a legitimate, deliberately-near-black design
// choice, not a bug — and a tolerance of even 1 falsely called that a match.
function colorsEqual(a, b, tol = 0) {
  if (!a || !b) return false;
  return (
    Math.abs(a[0] - b[0]) <= tol &&
    Math.abs(a[1] - b[1]) <= tol &&
    Math.abs(a[2] - b[2]) <= tol &&
    Math.abs(a[3] - b[3]) <= 1e-6
  );
}
function fmt(c) {
  if (!c) return '?';
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3]})`;
}

const results = {}; // theme -> { actual, initial }

for (const theme of THEMES) {
  R.group(`── ${theme} · role tokens ──────────────────────────────────`);
  const page = await newThemedPage(browser, { width: 1440, height: 900 }, theme);
  await page.goto(BASE + '/live/markets', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.panel', { timeout: 15000 });

  const roleNames = ROLES.map((r) => r.name);
  // Every theme needs the initial-value literal resolved too (it's a
  // theme-independent literal, but resolving it through the SAME live page
  // avoids trusting a second, unrelated colour-parsing code path).
  const exprsToResolve = { ...Object.fromEntries(ROLES.map((r) => [`initial:${r.name}`, r.initialValue])) };
  if (theme === 'classic') {
    for (const r of ROLES) {
      const texts = DECLS.classic[r.name];
      if (texts.length > 0) exprsToResolve[`decl:${r.name}`] = texts[texts.length - 1];
    }
  }

  const { actual, expr } = await page.evaluate(MEASURE, { roleNames, exprsToResolve });
  results[theme] = { actual, expr };

  let declaredN = 0;
  let inheritedN = 0;
  let skippedN = 0;

  for (const role of ROLES) {
    const name = role.name;
    const texts = DECLS[theme][name];
    const declared = texts.length > 0;
    const actualColor = actual[name];
    const initialColor = expr[`initial:${name}`];

    if (!actualColor) {
      R.ok(false, `${name} resolves to a value`, `getComputedStyle produced nothing usable`);
      skippedN++;
      continue;
    }

    if (theme === 'classic') {
      declaredN++;
      if (!declared) {
        R.ok(false, `${name} is declared in ${stylesPath}'s base :root`, 'not found — classic must declare all 18 roles');
        skippedN++;
        continue;
      }
      const exprColor = expr[`decl:${name}`];
      R.ok(
        colorsEqual(actualColor, exprColor),
        `${name} self-consistent: var(${name}) == its own declared expression`,
        `resolved role ${fmt(actualColor)} vs re-resolved declaration "${texts[texts.length - 1]}" → ${fmt(exprColor)} (a cycle/typo'd var()/rejected value makes these diverge)`
      );
      R.ok(
        colorsEqual(actualColor, initialColor),
        `${name} matches its own @property initial-value (${role.initialValue})`,
        `role resolved ${fmt(actualColor)}, initial-value resolved ${fmt(initialColor)} — styles.css:${role.line} and the base :root declaration have drifted apart`
      );
      continue;
    }

    // indigo / phosphor
    if (declared) {
      declaredN++;
      R.ok(
        !colorsEqual(actualColor, initialColor),
        `${name} (declared) resolves to something other than initial-value`,
        `both resolved to ${fmt(actualColor)} — this is exactly what a cycle/rejected value/typo'd reference self-heals to; declared as "${texts[texts.length - 1]}"${texts.length > 1 ? ` (${texts.length} candidate bindings, e.g. an @supports oklch upgrade — any non-initial resolution is accepted)` : ''}`
      );
    } else {
      inheritedN++;
      const baseColor = results.classic?.actual?.[name];
      R.ok(
        colorsEqual(actualColor, baseColor),
        `${name} (inherited) resolves to classic's base value`,
        `${theme} resolved ${fmt(actualColor)}, classic resolved ${fmt(baseColor)}`
      );
    }
  }

  R.info(`roles checked: ${ROLES.length} · declared: ${declaredN} · inherited: ${inheritedN} · skipped: ${skippedN}`);
  await page.context().close();
}

await browser.close();
process.exit(R.finish());
