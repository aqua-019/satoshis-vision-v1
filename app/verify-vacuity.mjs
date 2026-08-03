/**
 * verify-vacuity.mjs — the meta-gate. It does not check the site; it checks
 * whether the gates that check the site are capable of failing.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * v6.1.6 shipped two assertions in verify-ia.mjs that could not go red:
 *
 *   R.ok(!/markets-thesis/.test(stripped) || true, 'anchors are not …')
 *       `X || true` is `true`. The assertion had no condition at all.
 *
 *   } catch (e) { R.skip('ia.ts import failed', e.message); }
 *       wrapping an entire section's assertions. `skip` does not set `failed`,
 *       so a broken ia.ts left verify:static GREEN with the IA gate measuring
 *       nothing whatsoever. Break-tested, that catch reported
 *       `21 passed · 0 failed`, exit 0.
 *
 * Both survived a break test, and that is the part worth keeping. The gate WAS
 * break-tested — at FILE level. Breaking the file proved verify-ia could go
 * red; it proved nothing about whether any PARTICULAR assertion inside it
 * could. Every gate in this repo has been validated that way, so this is a
 * suite-wide blind spot rather than one file's slip, and no amount of further
 * file-level break-testing would have found it.
 *
 * Two remedies followed, and this file is only the cheap half:
 *   (a) THIS SCREEN — the two mechanical shapes, checked on every run forever.
 *   (b) PER-ASSERTION BREAK-TESTING for assertions added from v6.1.6 on, one
 *       at a time, with the count recorded. Existing assertions are
 *       grandfathered: re-break-testing 396 by hand is not a thing anyone
 *       finishes, and a remedy nobody completes is worse than a narrow one
 *       that runs.
 * (b) carries the real weight. (a) is deliberately narrow — see below.
 *
 * ── WHY IT IS THIS NARROW, WHICH IS THE LOAD-BEARING DECISION ────────────
 * The first draft also failed on a bare `R.ok(true, …)` condition. Eight sites
 * matched and ALL EIGHT were correct code, each verified individually rather
 * than grepped:
 *
 *   verify-chart-legibility.mjs:182   R.ok(true) after a `continue` — the
 *                                     enclosing `if` already decided it
 *   verify-shots.mjs:356              inside `if (diffs.length === 0)`, and
 *                                     guarded by an `R.ok(compared > 0, …)`
 *                                     above whose note names this exact
 *                                     failure mode
 *   verify-resilience-dom.mjs:141,144 inside the `else` of a length check
 *   verify-failure.mjs:181,219,230,   an explicit length assertion on the
 *              255,261                preceding line
 *   verify-sims.mjs (×4)              after a `waitFor({timeout})` that
 *                                     THROWS if the state never arrives
 *
 * `R.ok(true, …)` after a throwing await is a real idiom here and the control
 * flow is the condition. A screen that failed on all eight would be crying
 * wolf on day one — which is how verify-v510 taught this repo to ignore red,
 * and it would be a bleak way to reintroduce the exact failure this exercise
 * is about. So the screen fires ONLY where no control flow can rescue the
 * site: `|| true` / `&& false` inside a condition, and a catch path whose only
 * outcome is a skip. Both are unambiguous. Everything else is (b)'s job.
 *
 * ── WHAT IT CANNOT DO ────────────────────────────────────────────────────
 * This is a SYNTACTIC screen, not a proof. It cannot find an assertion that is
 * merely always true in practice (`R.ok(routes.length >= 0, …)` reads as
 * ordinary code), and it cannot find the third defect this batch produced — a
 * regex tested against string-STRIPPED text for a string literal, where every
 * token is real and only the composition is wrong. A green run here means "no
 * gate declares a dead assertion", never "every assertion is meaningful".
 *
 * Run: node verify-vacuity.mjs   (from app/)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeReporter } from './verify-reporter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const R = makeReporter('verify-vacuity');

/* Not gates: the reporter is where `ok` is DEFINED, the shared lib holds no
 * assertions, and this screen must not screen itself — its own documentation
 * names every pattern it hunts for. */
const NOT_A_GATE = new Set(['verify-reporter.mjs', 'verify-lib.mjs', 'verify-vacuity.mjs']);

/**
 * Reasoned exemptions. Each needs a file, an identifying substring, and a
 * REASON — an allowlist without reasons becomes the place you put things you
 * would rather not think about.
 */
const ALLOW = [
  {
    file: 'verify-govern.mjs', match: 'catch(() => false)',
    why: 'a reachability probe: `fetch(BASE).then(r => r.ok).catch(() => false)` — unreachable IS the false case, not a swallowed error',
  },
  {
    file: 'verify-nav.mjs', match: 'p.catch(() => null)',
    why: "the `soft()` helper, audited call-site by call-site in v6.1.6 — every wait it wraps has its dependency stated in-file",
  },
  {
    file: 'verify-palette.mjs', match: 'p.catch(() => null)',
    why: 'same `soft()` helper as verify-nav.mjs, same audit',
  },
];

// ── source masking ────────────────────────────────────────────────────────
/**
 * Replace comments, string/template contents and regex literals with spaces,
 * preserving length and newlines so every index maps back to the original.
 * Regex literals matter specifically: `waitForURL(/\/simulate/)` and `/['"]/`
 * both hold characters that would desynchronise a naive string masker for the
 * rest of the file — and a desynchronised masker fails OPEN, reporting a clean
 * sweep of text it never parsed.
 */
function mask(src) {
  const out = Array.from(src, (c) => (c === '\n' ? '\n' : c));
  const blank = (from, to) => {
    for (let k = from; k < to && k < src.length; k++) if (src[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  let prev = '';                       // last significant (non-space) code char
  while (i < src.length) {
    const c = src[i];
    const two = src.slice(i, i + 2);
    if (two === '//') {
      let j = i; while (j < src.length && src[j] !== '\n') j++;
      blank(i, j); i = j; continue;
    }
    if (two === '/*') {
      let j = i + 2; while (j < src.length && src.slice(j, j + 2) !== '*/') j++;
      blank(i, Math.min(j + 2, src.length)); i = j + 2; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) break;
        j++;
      }
      blank(i, j + 1); i = j + 1; prev = 'x'; continue;
    }
    if (c === '/' && (prev === '' || '(,=:[!&|?{};+*%~^<>'.includes(prev))) {
      let j = i + 1, inClass = false, closed = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) { closed = true; break; }
        j++;
      }
      if (closed) { blank(i, j + 1); i = j + 1; prev = 'x'; continue; }
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/** Balanced argument list starting at the `(` index. */
function argsAt(masked, open) {
  let depth = 0, start = open + 1;
  const args = [];
  for (let i = open; i < masked.length; i++) {
    const c = masked[i];
    if ('(['.includes(c) || c === '{') depth++;
    else if (')]'.includes(c) || c === '}') {
      depth--;
      if (depth === 0) { args.push({ a: start, b: i }); return { args, end: i }; }
    } else if (c === ',' && depth === 1) { args.push({ a: start, b: i }); start = i + 1; }
  }
  return { args, end: -1 };
}

/** The `{…}` block whose `{` is at or just after `from`. */
function blockAt(masked, from) {
  let i = from;
  while (i < masked.length && /\s/.test(masked[i])) i++;
  if (masked[i] !== '{') return null;
  let depth = 0;
  for (let j = i; j < masked.length; j++) {
    if (masked[j] === '{') depth++;
    else if (masked[j] === '}') { depth--; if (depth === 0) return { a: i, b: j }; }
  }
  return null;
}

/** Split a parameter list at depth-0 commas. */
function splitParams(s) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  if (s.trim()) out.push(s.slice(start));
  return out.map((p) => p.trim());
}

/**
 * Locally defined assertion helpers, and WHICH argument holds the condition.
 * Reading the signature rather than assuming it is not pedantry — the first
 * draft assumed `ok(cond, label)` everywhere and produced ten false findings
 * against verify-perf.mjs, whose `ok` is
 *
 *     const ok = (m) => console.log('✅ ' + m);
 *
 * a one-argument PRINTER whose partner `bad(m)` sets `fail`. Reported as
 * vacuous, those ten would have been ten reasons to distrust this gate. Three
 * signatures are live in the repo:
 *
 *     const ok = (cond, msg) => …                condition at 0   (~30 files)
 *     function assert(label, ok, detail = "") …  condition at 1   (4 files)
 *     const ok = (m) => …                        a logger, not an assertion
 *
 * A logger means the file asserts some other way and this screen cannot see
 * it. That is a HOLE, and §3 names it rather than counting the file clean.
 */
const COND_NAMES = /^(cond|ok|pass|passed|condition|result|value|test)$/;
function localHelpers(masked) {
  const found = new Map();
  const defs = [
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g,
  ];
  for (const re of defs) {
    for (const m of masked.matchAll(re)) {
      const name = m[1];
      if (!/^(ok|assert|check|expect)$/.test(name) || found.has(name)) continue;
      const params = splitParams(m[2]).map((p) => p.split('=')[0].trim());
      if (params.length < 2) { found.set(name, { cond: null }); continue; }
      const named = params.findIndex((p) => COND_NAMES.test(p));
      found.set(name, { cond: named >= 0 ? named : 0 });
    }
  }
  return found;
}

// ── collect and parse the gate files ──────────────────────────────────────
const files = [];
for (const dir of ['app', 'api']) {
  let names = [];
  try { names = readdirSync(join(REPO, dir)); } catch { continue; }
  for (const n of names.sort()) {
    if (!/^verify-.*\.mjs$/.test(n) || NOT_A_GATE.has(n)) continue;
    files.push({ rel: `${dir}/${n}`, base: n, abs: join(REPO, dir, n) });
  }
}

const scanned = [];
for (const f of files) {
  const src = readFileSync(f.abs, 'utf8');
  const masked = mask(src);

  const reps = new Set();
  for (const m of masked.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*makeReporter\s*\(/g)) reps.add(m[1]);
  const helpers = localHelpers(masked);

  const assert = [], soften = [];
  const record = (list, name, condIdx, idx) => {
    const open = masked.indexOf('(', idx);
    if (open < 0) return;
    const { args, end } = argsAt(masked, open);
    if (end < 0) return;
    list.push({ name, condIdx, idx, args, line: lineOf(src, idx) });
  };
  for (const rep of reps) {
    for (const m of masked.matchAll(new RegExp(`\\b${rep}\\s*\\.\\s*ok\\s*\\(`, 'g'))) record(assert, `${rep}.ok`, 0, m.index);
    for (const m of masked.matchAll(new RegExp(`\\b${rep}\\s*\\.\\s*(skip|fixture)\\s*\\(`, 'g'))) record(soften, `${rep}.${m[1]}`, null, m.index);
  }
  for (const [name, sig] of helpers) {
    if (sig.cond === null) continue;                       // a logger, not an assertion
    for (const m of masked.matchAll(new RegExp(`(^|[^.\\w$])${name}\\s*\\(`, 'gm'))) {
      const at = m.index + m[1].length;
      if (/\b(function|const|let|var)\s*$/.test(masked.slice(Math.max(0, at - 24), at))) continue;
      record(assert, name, sig.cond, at);
    }
  }
  for (const kind of ['skip', 'fixture']) {
    if (!new RegExp(`\\b(?:const|let|var|function)\\s+${kind}\\b`).test(masked)) continue;
    for (const m of masked.matchAll(new RegExp(`(^|[^.\\w$])${kind}\\s*\\(`, 'gm'))) {
      const at = m.index + m[1].length;
      if (/\b(function|const|let|var)\s*$/.test(masked.slice(Math.max(0, at - 24), at))) continue;
      record(soften, kind, null, at);
    }
  }
  scanned.push({ ...f, src, masked, reps, helpers, assert, soften, loggerOnly: [...helpers.values()].some((h) => h.cond === null) });
}

const allowed = (f, text) => ALLOW.some((e) => e.file === f.base && text.includes(e.match));
const inlineOk = (src, idx) => {
  const lineStart = src.lastIndexOf('\n', idx - 1);
  const prevStart = src.lastIndexOf('\n', lineStart - 1);
  return /VACUITY-OK/.test(src.slice(prevStart + 1, idx));
};

// ============================================================================
// §1 · `|| true` / `&& false` inside an assertion condition
// ============================================================================
R.group('§1 · no assertion condition is defeated by a constant operand');

/* Flagged wherever they appear in a condition, not only at the top level.
 * `(a || true) && b` is not strictly vacuous, but `a` is then dead code inside
 * an assertion, which is a defect in its own right. `?? true` is the same
 * species — it fires on nothing today and is here so it cannot arrive quietly.
 * The inline `// VACUITY-OK: <reason>` escape exists for the case that proves
 * me wrong. */
/* BOTH OPERAND ORDERS. The first version of this list held only `|| true` and
 * `&& false`, matching F1's shape exactly — and break-testing it with
 * `R.ok(true || false, …)` came back GREEN. `true || X` is every bit as
 * constant as `X || true`; I had encoded the one example I had rather than the
 * property. Writing the break test to a DIFFERENT shape than the bug is what
 * exposed it, which is the argument for planting more than one. */
const CONSTANTS = [
  { re: /\|\|\s*true\b/, why: '`X || true` is always true' },
  { re: /\btrue\s*\|\|/, why: '`true || X` is always true' },
  { re: /&&\s*false\b/, why: '`X && false` is always false' },
  { re: /\bfalse\s*&&/, why: '`false && X` is always false' },
  { re: /\?\?\s*true\b/, why: '`X ?? true` is true whenever X is null or undefined' },
];

let conds = 0, literalTrue = 0;
const defeated = [];
for (const f of scanned) {
  for (const c of f.assert) {
    const slot = c.args[c.condIdx];
    if (!slot) continue;
    conds++;
    const raw = f.src.slice(slot.a, slot.b).trim();
    const flat = f.masked.slice(slot.a, slot.b).replace(/\s+/g, ' ').trim();
    if (/^!*true$/.test(flat)) literalTrue++;             // legitimate here — see header
    if (allowed(f, raw) || inlineOk(f.src, c.idx)) continue;
    for (const k of CONSTANTS) if (k.re.test(flat)) defeated.push({ f, c, raw, why: k.why });
  }
}
for (const d of defeated) {
  R.info(`${d.f.rel}:${d.c.line}  ${d.c.name}(${d.raw.slice(0, 76)}${d.raw.length > 76 ? '…' : ''})  — ${d.why}`);
}
R.ok(defeated.length === 0,
  defeated.length === 0
    ? `${conds} assertion conditions, none defeated by a constant operand`
    : `${defeated.length} assertion(s) cannot fail (of ${conds} scanned)`);
R.info(`${literalTrue} condition(s) are a literal \`true\` — NOT failed here; all verified as control-flow-guarded idioms (see header)`);

// ============================================================================
// §2 · a catch path whose only outcome is a skip
// ============================================================================
R.group('§2 · no catch path launders a broken artifact into a skip');

/* `skip` and `fixture` mean "this environment cannot check it" — no browser,
 * no upstream, no API. Neither sets `failed`. When a catch that means that
 * wraps real assertions, any fault in the artifact under test — a syntax
 * error, a bad import, a renamed export — is laundered into a non-failure and
 * the gate prints a tally with the assertions simply absent from it. Nobody
 * reads a tally for absences.
 *
 * The fix at a real site is `R.ok(false, …)`: the environment is fine, the
 * thing under test is broken. A catch that genuinely guards an environment
 * probe should hold the PROBE only, with no assertions inside its try. */
let tryBlocks = 0;
const launderers = [];
for (const f of scanned) {
  for (const m of f.masked.matchAll(/\btry\s*\{/g)) {
    const tryBlk = blockAt(f.masked, m.index + 3);
    if (!tryBlk) continue;
    tryBlocks++;
    const cm = f.masked.slice(tryBlk.b + 1).match(/^\s*catch\s*(\([^)]*\))?\s*/);
    if (!cm) continue;
    const catchBlk = blockAt(f.masked, tryBlk.b + 1 + cm[0].length);
    if (!catchBlk) continue;
    const inTry = f.assert.filter((c) => c.idx > tryBlk.a && c.idx < tryBlk.b);
    const soft = f.soften.filter((c) => c.idx > catchBlk.a && c.idx < catchBlk.b);
    const hard = f.assert.filter((c) => c.idx > catchBlk.a && c.idx < catchBlk.b);
    if (!inTry.length || !soft.length || hard.length) continue;
    if (inlineOk(f.src, catchBlk.a)) continue;
    launderers.push({ f, line: lineOf(f.src, catchBlk.a), n: inTry.length, via: soft[0].name, how: 'catch →' });
  }
}

/* The `.catch()` variant, which is the same species wearing a promise. A
 * rejection swallowed to an EMPTY VALUE — `[]`, `{}`, `null` — is then
 * indistinguishable from a healthy surface that legitimately had nothing, and
 * the emptiness check downstream skips. Found in the wild at
 * verify-resilience-dom.mjs:136 on §A, the assertion that caught POOL_ATTR_H,
 * i.e. the one that could least afford to vanish quietly.
 *
 * Deliberately NOT flagged: `.catch(() => {})` on a wait — `waitForFunction(…)
 * .catch(() => {})`, `goto(…).catch(() => {})`. That is an empty BLOCK, not an
 * empty value; nothing is substituted into the assertion path and the check
 * below still decides. Nineteen such sites exist and every one is correct.
 *
 * The window is a heuristic: a `skip` within 12 lines of the swallow. Precise
 * for the shape as it occurs here, and it would miss a swallow whose skip is
 * further away — stated so nobody reads a pass as proof of absence. */
for (const f of scanned) {
  for (const m of f.masked.matchAll(/\.\s*catch\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*(\[\s*\]|\(\s*\{\s*\}\s*\)|null|undefined|0|''|"")\s*\)/g)) {
    const line = lineOf(f.src, m.index);
    const raw = f.src.slice(m.index, m.index + m[0].length);
    if (allowed(f, raw) || inlineOk(f.src, m.index)) continue;
    const near = f.soften.find((s) => s.line > line && s.line <= line + 12);
    if (!near) continue;
    launderers.push({ f, line, n: 0, via: near.name, how: `.catch(() => ${m[1]}) →` });
  }
}

for (const l of launderers) {
  R.info(`${l.f.rel}:${l.line}  ${l.how} ${l.via}()` +
    (l.n ? `, wrapping ${l.n} assertion(s) that then never report` : ', a rejection and an empty result are indistinguishable'));
}
R.ok(launderers.length === 0,
  launderers.length === 0
    ? `${tryBlocks} try blocks + every .catch() swallow checked; none launder a fault into a skip`
    : `${launderers.length} catch path(s) turn a broken artifact into a non-failure`);

// ============================================================================
// §3 · coverage census — the screen must prove it looked at something
// ============================================================================
R.group('§3 · the screen itself is not silently covering nothing');

/* Both checks above are `count === 0` assertions, and those pass just as
 * cheerfully over an empty set. verify-vitals shipped exactly that shape this
 * same batch: its budget table was keyed by string literals, so a renamed
 * route meant neither branch ran and the gate reported a clean pass over zero
 * routes. A meta-gate repeating it would be beyond parody, so the census is an
 * assertion, not an info line. */
const withAsserts = scanned.filter((f) => f.assert.length > 0);
const unscreened = scanned.filter((f) => f.assert.length === 0);

R.info(`${scanned.length} gate files scanned · ${conds} assertion conditions parsed · ${tryBlocks} try blocks`);
R.ok(scanned.length >= 55, `${scanned.length} gate files found (>= 55 expected)`);
R.ok(conds >= 350, `${conds} conditions parsed (>= 350 expected — a parser that stopped early reads as a clean suite)`);
R.ok(withAsserts.length >= 50, `${withAsserts.length} files yielded at least one assertion`);

if (unscreened.length) {
  R.info(`no assertion helper recognised in: ${unscreened.map((f) => f.base).join(', ')}`);
  R.info('These assert with bare `if (…) fail = true`, or via a one-arg logger. They are UNSCREENED, not clean.');
}
R.ok(unscreened.length <= 6,
  `${unscreened.length} file(s) unscreened (<= 6 tolerated; each is a hole in this gate, not a pass)`);

process.exit(R.finish());
