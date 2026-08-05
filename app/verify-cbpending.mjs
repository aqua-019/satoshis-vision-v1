#!/usr/bin/env node
/**
 * verify-cbpending.mjs — the cold-boot anti-flash floor's STATIC contract.
 *
 * v6.1.9 added a pre-paint floor to `index.html`: an inline script stamps
 * `cb-pending` on <html> when the splash is going to run, and an inline style
 * hides #root behind an opaque #050505 until ColdBoot takes over. It exists so
 * a JS-enabled visitor opens on black — `/` is prerendered and main.tsx uses
 * createRoot, so without it the real Main Home paints for as long as the bundle
 * takes to download and parse, and is then replaced by the splash.
 *
 * ── THE INVARIANT THIS FILE OWNS, AND WHY IT NEEDS ONE ────────────────────
 * The gating condition is now encoded TWICE — once in TypeScript
 * (`src/coldboot/gate.ts#coldBootWillRender`, which `ColdBoot.tsx` calls) and
 * once as an inline copy in `index.html`, because a pre-paint script cannot
 * import and has to answer before the bundle exists. That is the `NODE_REASONS`
 * shape this repo has been bitten by: two copies of one rule, kept in step by
 * nothing, where the next edit to the condition fixes one path and silently
 * leaves the flash on the other.
 *
 * So this gate does not compare the two as STRINGS. It extracts the inline
 * body between its markers, compiles it, and evaluates BOTH implementations
 * over a truth table of every (flag, pathname) pair worth distinguishing —
 * an equivalence proof, which stays true through a rewrite of either side that
 * preserves behaviour and fails the moment one changes meaning.
 *
 * OFFLINE by construction: no browser, no server, no dist. It is wired into
 * `verify:static` and into the CI `build` job's offline-gate list, so it can
 * fail before anything is built or served. It is deliberately NOT mirrored into
 * verify-coldboot-live — a second home for an invariant is the thing this file
 * exists to prevent.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeReporter } from './verify-reporter.mjs';
import {
  CB_FLOOR, CB_HOLD_GLOBAL, CB_HOLD_MS, CB_PENDING_CLASS, CB_T0_GLOBAL,
  COLDBOOT_FLAG, COLDBOOT_OFF, coldBootWillRender,
} from './src/coldboot/gate.ts';

const APP = dirname(fileURLToPath(import.meta.url));
const R = makeReporter('verify-cbpending');

const read = (p) => {
  try { return readFileSync(join(APP, p), 'utf8'); } catch { return null; }
};
const HTML = read('index.html');
const COLDBOOT_TSX = read('src/coldboot/ColdBoot.tsx');
const MAIN_TSX = read('src/main.tsx');

R.ok(HTML !== null && COLDBOOT_TSX !== null && MAIN_TSX !== null,
  'precondition: index.html, ColdBoot.tsx and main.tsx all read',
  'one of the three files could not be read — every assertion below would run against null');

/* ══════════════════════════════════════════════════════════════════════
 * §1 · the two predicates agree, over a truth table
 * ══════════════════════════════════════════════════════════════════════ */
R.group('── 1 · index.html\'s inline predicate === gate.ts#coldBootWillRender ──');

const MARKED = /\/\* cb-pending:predicate:start \*\/([\s\S]*?)\/\* cb-pending:predicate:end \*\//;
const marked = MARKED.exec(HTML ?? '');

R.ok(marked !== null,
  'precondition: the marked inline predicate region was extracted from index.html',
  marked ? `${marked[1].trim().length} bytes` :
    'Markers not found. Every truth-table row below would compare against nothing — and an empty ' +
    'extraction agrees with anything, so this would pass while proving zero.');

/* A region that mentions only one of the two clauses cannot implement the
 * predicate however it happens to score on the table — a body of
 * `return false;` agrees on 24 of 36 rows and could look convincing in a
 * partial table. Assert the SHAPE as well as the behaviour. */
R.ok(marked !== null && marked[1].includes(COLDBOOT_OFF) && /pathname/.test(marked[1]),
  `precondition: the extracted region references both clauses (the "${COLDBOOT_OFF}" flag value and pathname)`,
  marked === null ? '' :
    `got: ${JSON.stringify(marked[1].trim())} — a region missing one clause cannot implement the predicate`);

if (marked) {
  /* eslint-disable-next-line no-new-func */
  const inline = new Function('flag', 'pathname', marked[1]);

  const FLAGS = [undefined, COLDBOOT_OFF, 'on', '', 'OFF', 'Off', null];
  const PATHS = ['/', '', '/index.html', '/live/mempool', '/learn/sim', '//', '/monero', '/about/sources'];
  const rows = [];
  for (const f of FLAGS) {
    for (const p of PATHS) {
      const a = !!inline(f, p);
      const b = coldBootWillRender(f, p);
      rows.push({ f, p, a, b, agree: a === b });
    }
  }

  R.ok(rows.length === FLAGS.length * PATHS.length,
    `precondition: the truth table is complete — ${rows.length} of ${FLAGS.length * PATHS.length} rows evaluated`);

  /* An all-false table agrees trivially. Both polarities must be represented,
   * or "they agree" is a statement about nothing. */
  const tCount = rows.filter((r) => r.b).length;
  R.ok(tCount > 0 && tCount < rows.length,
    `precondition: the table exercises BOTH polarities — ${tCount} rows render the splash, ${rows.length - tCount} do not`,
    'a table whose expected answer never varies is satisfied by a constant function');

  const bad = rows.filter((r) => !r.agree);
  R.ok(bad.length === 0,
    `index.html's inline predicate agrees with gate.ts on all ${rows.length} rows`,
    bad.length
      ? bad.map((r) => `flag=${JSON.stringify(r.f)} pathname=${JSON.stringify(r.p)}: inline=${r.a} gate.ts=${r.b}`).join('\n     ')
      : '');

  /* SELF-CHECK — throwaway in-memory function, nothing on disk changes. Same
   * idiom as verify-orb §4's mutatedShellSrc. Drops the flag clause, which is
   * the single most likely real-world drift: someone edits gate.ts to add a
   * condition and forgets the copy that runs before the bundle. */
  const mutated = new Function('flag', 'pathname', 'return pathname === "/";');
  const caughtRows = [];
  for (const f of FLAGS) {
    for (const p of PATHS) {
      if (!!mutated(f, p) !== coldBootWillRender(f, p)) caughtRows.push({ f, p });
    }
  }
  R.ok(caughtRows.length > 0,
    `SELF-CHECK: an inline body with the "${COLDBOOT_OFF}" clause dropped is caught on ${caughtRows.length} row(s) ` +
    '— proves the comparison is falsifiable rather than two copies of one tautology',
    caughtRows.length === 0
      ? 'the mutated predicate agreed everywhere, so the table cannot discriminate and §1 proves nothing'
      : '');
}

/* ══════════════════════════════════════════════════════════════════════
 * §2 · the floor itself — colour, mechanism, and ordering
 * ══════════════════════════════════════════════════════════════════════ */
R.group('── 2 · the pre-paint floor: one colour, visibility not display ──');

/* The colour must equal the colour ColdBoot's own root paints, NOT the
 * per-theme --amb-floor. If they differ, indigo and phosphor visitors get a
 * colour STEP between frame zero and frame one — the flash moved, not removed. */
const floorRule = /html\.cb-pending\s*\{[^}]*background-color:\s*(#[0-9a-f]{3,8})/i.exec(HTML ?? '');
R.ok(floorRule !== null, 'precondition: the html.cb-pending floor rule was found in index.html',
  floorRule ? '' : 'no `html.cb-pending { background-color: … }` rule — §2\'s colour comparison has no subject');
R.ok(floorRule !== null && floorRule[1].toLowerCase() === CB_FLOOR.toLowerCase(),
  `frame zero's colour === gate.ts#CB_FLOOR (${CB_FLOOR}) — got ${floorRule?.[1] ?? 'no match'}`,
  floorRule && floorRule[1].toLowerCase() !== CB_FLOOR.toLowerCase()
    ? `index.html paints ${floorRule[1]} and ColdBoot.tsx's ROOT_STYLE paints ${CB_FLOOR}. Those are ` +
      'consecutive frames of one sequence; a mismatch is a visible step exactly where this mechanism ' +
      'exists to remove one.'
    : '');

/* ColdBoot.tsx must read the same constant rather than restating the hex. */
R.ok(/CB_FLOOR/.test(COLDBOOT_TSX ?? ''),
  'ColdBoot.tsx paints its root from CB_FLOOR rather than a second literal',
  'ROOT_STYLE carries its own hex again — the two frames can now drift apart one edit at a time');

const visRule = /html\.cb-pending\s+#root\s*\{[^}]*visibility:\s*hidden/i.test(HTML ?? '');
R.ok(visRule,
  'the floor hides #root with visibility:hidden',
  'not found. This must not become display:none: the prerendered box has to keep its geometry, or ' +
  'un-hiding it reflows the page and spends `/`\'s measured 0.0000 CLS.');
R.ok(!/html\.cb-pending\s+#root\s*\{[^}]*display:\s*none/i.test(HTML ?? ''),
  'the floor does NOT use display:none on #root',
  'display:none removes the box from layout, so revealing it is a reflow — a layout shift traded for a flash');

/* Ordering: the floor has to exist before the browser can paint #root. */
const styleIdx = (HTML ?? '').indexOf('html.cb-pending');
const rootIdx = (HTML ?? '').indexOf('<div id="root"');
R.ok(styleIdx !== -1 && rootIdx !== -1 && styleIdx < rootIdx,
  'the cb-pending style precedes <div id="root"> in the document',
  `style at ${styleIdx}, #root at ${rootIdx} — a floor declared after the element it hides cannot beat first paint`);

/* The critical-floor block must stay first and untouched — verify-degraded §0
 * slices index.html at the FIRST <style> and asserts things about that block
 * only. Adding cb-pending to it would silently change what that gate reads. */
const firstStyle = (HTML ?? '').slice((HTML ?? '').indexOf('<style'), (HTML ?? '').indexOf('</style>'));
R.ok(!firstStyle.includes('cb-pending'),
  'the cb-pending rules live in their OWN <style>, not the first (critical-floor) block',
  'verify-degraded §0 slices the FIRST <style> block and asserts it contains no var() and that its bare ' +
  'html{} rule is #050505. Merging into it changes that gate\'s subject without changing its text.');

/* ══════════════════════════════════════════════════════════════════════
 * §3 · three removers, and the watchdog one is unconditional
 * ══════════════════════════════════════════════════════════════════════ */
R.group('── 3 · the floor is released on every path that can strand it ────');

R.ok(new RegExp(`classList\\.remove\\(["']${CB_PENDING_CLASS}["']\\)`).test(HTML ?? ''),
  `index.html's boot watchdog removes .${CB_PENDING_CLASS}`,
  'If ColdBoot\'s lazy chunk never arrives (Shields, a chunk 404 over Tor, a CSP refusal) nothing else ' +
  'releases the floor and the page is black until the tab is closed.');

R.ok(new RegExp(`classList\\.remove\\(${'CB_PENDING_CLASS'}\\)`).test(COLDBOOT_TSX ?? '') ||
     new RegExp(`classList\\.remove\\(["']${CB_PENDING_CLASS}["']\\)`).test(COLDBOOT_TSX ?? ''),
  'ColdBoot.tsx removes it on mount (the ordinary path)',
  'the splash would render behind a floor that hides #root, which contains the splash');

R.ok(/useLayoutEffect/.test(COLDBOOT_TSX ?? ''),
  'ColdBoot.tsx releases it in a LAYOUT effect, not a passive one',
  'A passive effect runs after paint, so the frame that reveals #root can land before the splash is in ' +
  'it — the flash re-introduced at the other end.');

R.ok(new RegExp(`classList\\.remove\\(["']${CB_PENDING_CLASS}["']\\)`).test(MAIN_TSX ?? ''),
  'main.tsx releases it on its boot-failure paths',
  '#boot-fallback is revealed on those paths and is useless behind an opaque floor over #root');

/* THE ONE THAT WOULD LOOK WIRED UP AND NEVER FIRE.
 * index.html's watchdog reveals #boot-fallback only `if (r.childElementCount
 * === 0)`, and since v6.0.9 prerendering means #root is NEVER empty — so
 * anything placed inside that branch is unreachable in production. The removal
 * must sit outside it. Checked by position, because the two are three lines
 * apart and a future edit could tuck one into the other without ceremony. */
/* Matched against the BRANCH STATEMENT, not the bare phrase. The first draft
 * searched for `childElementCount === 0` and found it in the comment written
 * three lines above the removal explaining why the removal is not inside that
 * branch — so the gate reported the removal came second and went red against a
 * correct file. Same shape as verify-orb §4's naive lat/lon grep, which finds
 * six hits inside the prose that exists to prevent the thing it checks for.
 * The `if (` prefix appears only in the executable form. */
const removeIdx = (HTML ?? '').search(new RegExp(`classList\\.remove\\(["']${CB_PENDING_CLASS}["']\\)`));
const branchIdx = (HTML ?? '').search(/if\s*\([^)]*childElementCount\s*===\s*0\s*\)/);
R.ok(removeIdx !== -1 && branchIdx !== -1 && removeIdx < branchIdx,
  'the watchdog removal is UNCONDITIONAL — it precedes the `childElementCount === 0` branch',
  `removal at ${removeIdx}, branch at ${branchIdx}. Every route is prerendered, so #root is never empty and ` +
  'that branch never runs in production. A removal inside it is dead code that reads as a safety net.');

/* The test override token must still exist, or verify-degraded's B4 has to
 * sleep 10s per scenario instead of 400ms. */
R.ok(/__xmriBootTimeoutMs/.test(HTML ?? ''),
  'the watchdog timeout is still overridable for tests (__xmriBootTimeoutMs)',
  'without it the dead-bundle scenarios cannot be driven in bounded time');

/* ══════════════════════════════════════════════════════════════════════
 * §4 · fail open
 * ══════════════════════════════════════════════════════════════════════ */
R.group('── 4 · a throw shows the prerender, never a blank page ──────────');

const applyBlock = /__xmriColdBootWillRender\([\s\S]{0,1200}?catch\s*\(/.test(HTML ?? '');
R.ok(applyBlock,
  'the class is applied inside a try/catch that fails open',
  'A hardened browser can throw on globals this touches. On a throw the class must stay unset and the ' +
  'visitor gets the prerendered page — the outcome this mechanism trades a flash to avoid, but strictly ' +
  'better than a blank one.');

R.ok(!new RegExp(`classList\\.add\\(["']${CB_PENDING_CLASS}["']\\)[\\s\\S]{0,80}sessionStorage`).test(HTML ?? '') &&
     !/sessionStorage[\s\S]{0,200}cb-pending/.test(HTML ?? ''),
  'the pre-paint predicate does NOT consult sessionStorage',
  'xmrirish.coldboot gates whether a repeat visitor SKIPS THE DECRYPT, not whether the splash renders. ' +
  'Gating the floor on it would leave the flash in place on every visit after the first.');

/* ══════════════════════════════════════════════════════════════════════
 * §5 · the hold is a MINIMUM, and the watchdog is exempt from it
 * ══════════════════════════════════════════════════════════════════════ */
R.group('── 5 · frame zero holds, as a floor rather than an addition ─────');

R.ok(Number.isFinite(CB_HOLD_MS) && CB_HOLD_MS > 0,
  `gate.ts declares a hold of ${CB_HOLD_MS}ms`,
  'without it the floor ends whenever React mounts — measured 212-1017ms unthrottled, i.e. no beat at all');

R.ok(new RegExp(`${CB_T0_GLOBAL}\\s*=\\s*performance\\.now\\(\\)`).test(HTML ?? ''),
  `index.html stamps ${CB_T0_GLOBAL} with performance.now() when the floor goes up`,
  'The hold has to be measured from FIRST PAINT. Measuring it from React mounting instead would add the ' +
  'full hold on top of the bundle time rather than absorbing it, which is the difference between a floor ' +
  'and a delay.');

/* The arithmetic is what makes it a minimum. Assert the SHAPE in ColdBoot,
 * because `hold - elapsed` without the clamp is the bug that turns this into
 * a fixed addition on every load including the slowest, rather than a floor. */
R.ok(/Math\.max\(0,\s*hold\s*-\s*\(performance\.now\(\)\s*-\s*t0\)\)/.test(COLDBOOT_TSX ?? ''),
  'ColdBoot waits max(0, hold - elapsed) — a floor, never an addition',
  'Measured: under 6x CPU + Slow-4G a cold / reaches LCP at ~4048ms, where this must contribute exactly 0. ' +
  'Without the clamp every slow load would pay the full hold on top.');

/* ColdBoot reads it through the imported CB_HOLD_GLOBAL constant rather than a
 * second string literal, which is the point — so accept either spelling and
 * require that gate.ts is where the name is defined. */
R.ok(/CB_HOLD_GLOBAL/.test(COLDBOOT_TSX ?? '') || new RegExp(CB_HOLD_GLOBAL).test(COLDBOOT_TSX ?? ''),
  `the hold is overridable for tests (${CB_HOLD_GLOBAL}, read via the shared constant)`,
  `else every scenario touching the splash sleeps the full ${CB_HOLD_MS}ms`);

/* The watchdog must NOT wait out the hold. A dead bundle recovering more slowly
 * than it does today would be a regression introduced by a cosmetic feature. */
const wdSlice = (HTML ?? '').slice((HTML ?? '').indexOf('setTimeout(function ()'));
R.ok(wdSlice.length > 0 && !new RegExp(CB_HOLD_GLOBAL).test(wdSlice.slice(0, 900)),
  'the boot watchdog removes the floor WITHOUT consulting the hold',
  'A dead bundle must not recover more slowly than it did before frame zero existed. Measured: the ' +
  `watchdog path releases at 453ms with __xmriBootTimeoutMs=400, ignoring the ${CB_HOLD_MS}ms hold.`);

R.info(`flag global "${COLDBOOT_FLAG}", off value "${COLDBOOT_OFF}", class ".${CB_PENDING_CLASS}", floor ${CB_FLOOR}, hold ${CB_HOLD_MS}ms`);

process.exit(R.finish());
