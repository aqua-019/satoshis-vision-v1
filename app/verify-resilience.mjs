/* verify-resilience.mjs — SOURCE-level invariants for the v6.1.4 resilience UI.
   Run: node verify-resilience.mjs      (offline; no browser, no server)

   Its DOM twin is verify-resilience-dom.mjs, which drives a real browser. The
   split is the repo's standing one: verify:static must run without a server, so
   anything grep-able lives here and anything requiring layout lives there.

   What this exists to stop, in order of how much each has already cost:

     1. A new loading string containing the word "loading". SUSPENDED_RE is
        substring-tested against all 11 prerendered documents and a match FAILS
        THE BUILD with "still suspended", blaming Suspense rather than the copy.
        #153 burned a break test rediscovering that.
     2. PanelBoundary reaching for a CSS variable. A boundary styled with
        var(--x) is useless in precisely the case where the stylesheet is what
        failed. That rule was prose in RootBoundary.tsx and enforced nowhere.
     3. verify-reporter.mjs growing a dependency. It was split out of
        verify-lib.mjs so an offline api/ gate could use fixture() without
        pulling playwright's module graph; one convenience import undoes that
        and nothing would notice.
     4. The in-flight boolean being mirrored onto MoneroLive, which would
        re-render ~40 prop-drilled sites twice per 3s tier on /mempool.
     5. feedDegraded — the pair-AND GLOBAL — acquiring a call site that should
        have been per-endpoint. */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { makeReporter } from './verify-reporter.mjs';

const R = makeReporter('verify-resilience');
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const readOr = (p) => { try { return read(p); } catch { return null; } };

/** Strip block comments and LINE-START `//`, matching verify-prng.mjs's filter.
 *  Note the same sharp edge: a TRAILING `//` on a code line is NOT removed. */
const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

/* ── 1 · the copy constraint, against the REAL regex ───────────────────────
   Extracted from entry-ssr.tsx rather than re-typed, using verify-motion.mjs's
   self-checking idiom: a botched lift would make every assertion below pass
   vacuously, so the extraction THROWS rather than reporting green. */
R.group('1 · new copy cannot trip SUSPENDED_RE');

const SUSPENDED_RE = (() => {
  const src = read('./src/entry-ssr.tsx');
  const m = src.match(/export const SUSPENDED_RE\s*=\s*\/(.+)\/([a-z]*);/);
  if (!m) throw new Error('verify-resilience: could not extract SUSPENDED_RE from src/entry-ssr.tsx');
  const re = new RegExp(m[1], m[2]);
  if (!re.test('loading simulators…') || re.test('COINGECKO · loading')) {
    throw new Error('verify-resilience: extracted SUSPENDED_RE does not behave as expected');
  }
  return re;
})();
R.info(`extracted SUSPENDED_RE = ${SUSPENDED_RE}`);

/** Every string literal in a file, crudely but adequately. */
const literals = (src) => [
  ...(src.match(/"[^"\n]*"/g) || []),
  ...(src.match(/'[^'\n]*'/g) || []),
  ...(src.match(/>[^<>{}\n]{4,}</g) || []),   // JSX text nodes
];

const COPY_FILES = [
  'src/design/Skeleton.tsx',
  'src/design/ChromeStatus.tsx',
  'src/design/PanelBoundary.tsx',
  'src/pages/NetworkPage.tsx',
  'src/pages/MarketsPage.tsx',
  'src/pages/SourcesPage.tsx',
  'src/mempool/mem-stats.tsx',
];
{
  const offenders = [];
  for (const f of COPY_FILES) {
    const src = readOr('./' + f);
    if (src === null) { R.info(`(${f} absent — skipped)`); continue; }
    for (const lit of literals(strip(src))) {
      if (SUSPENDED_RE.test(lit)) offenders.push(`${f}  ${lit.trim().slice(0, 60)}`);
    }
  }
  R.ok(offenders.length === 0,
    `no rendered string on a resilience surface matches SUSPENDED_RE (${COPY_FILES.length} files)`,
    offenders.join('\n     '));
}

/* ── 2 · PanelBoundary is styled with literal hex, never var() ─────────────── */
R.group('2 · the boundary survives a failed stylesheet');
{
  const src = readOr('./src/design/PanelBoundary.tsx');
  if (src === null) {
    R.ok(false, 'src/design/PanelBoundary.tsx exists');
  } else {
    // Comment-stripped: the header legitimately NAMES var(--ui-accent) while
    // explaining the ban, and a raw grep flags the documentation as the offence.
    // Second time this shape has come up in this PR; see verify-prng's header.
    R.ok(!/var\(--/.test(strip(src)),
      'PanelBoundary.tsx uses literal hex, no var(--…) — it must render when the palette is what failed');
    R.ok(/getDerivedStateFromError/.test(src) && /componentDidCatch/.test(src),
      'it is a real error boundary, not a try/catch wrapper');
    R.ok(!/fetch\(|analytics|telemetry/.test(strip(src)),
      'it reports to the console only — no telemetry, per the privacy rule');
    R.ok(/FEED_ENDPOINT\[/.test(src),
      'the failure message names its endpoint from FEED_ENDPOINT, not from a hand-typed path');
    R.ok(/minHeight/.test(src) && !/\bheight:\s*(props\.)?reserve/.test(src),
      'the fallback reserves with minHeight, never height — a TALLER fallback shifts just as badly');
  }
}

/* ── 3 · the reporter stayed dependency-free ───────────────────────────────
   This is the assertion the makeReporter extraction was committed owing. */
R.group('3 · verify-reporter.mjs imports nothing but node: builtins');
{
  const src = readOr('./verify-reporter.mjs');
  if (src === null) {
    R.ok(false, 'verify-reporter.mjs exists');
  } else {
    const specs = [...src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    const foreign = specs.filter((x) => !x.startsWith('node:'));
    R.ok(foreign.length === 0,
      `verify-reporter.mjs imports only node: builtins (${specs.length} import(s))`,
      foreign.join(', '));
    R.ok(/export function makeReporter/.test(src), 'it still owns makeReporter');
    const lib = read('./verify-lib.mjs');
    R.ok(/export \{ makeReporter \} from '\.\/verify-reporter\.mjs'/.test(lib),
      'verify-lib.mjs re-exports it, so all existing importers are unchanged');
    R.ok(!/export function makeReporter/.test(lib),
      'verify-lib.mjs does NOT keep a second copy — one home for the four-counter invariant');
  }
}

/* ── 3b · the measurement profile has ONE home ─────────────────────────────
   v6.1.5 added verify-vitals.mjs beside verify-cls.mjs. Both measure under
   "PERF-BASELINE.md's documented profile", and before the extraction each
   would have owned its own copy of the throttle literals. Two copies of an
   invariant drift apart with nothing failing — the same reasoning that split
   makeReporter out in §3 above. The literals now live in verify-lib.mjs and
   this asserts neither gate re-declares them locally, because a local
   redeclaration would silently win and the two gates would be measuring
   different conditions while both claiming the documented one. */
R.group('3b · SLOW_4G / CPU_THROTTLE / PHONE are declared once, in verify-lib.mjs');
{
  const lib = readOr('./verify-lib.mjs');
  R.ok(lib !== null && /export const SLOW_4G = \{/.test(lib) && /export const CPU_THROTTLE =/.test(lib)
    && /export const PHONE = \{/.test(lib) && /export async function throttle\(/.test(lib),
    'verify-lib.mjs owns SLOW_4G, CPU_THROTTLE, PHONE and throttle()');

  for (const gate of ['./verify-cls.mjs', './verify-vitals.mjs']) {
    const src = readOr(gate);
    if (src === null) { R.ok(false, `${gate} exists`); continue; }
    // Strip comments first: both files legitimately DISCUSS these names in
    // their headers, and three assertions in v6.1.4 failed on comment prose
    // for exactly this reason.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const redeclared = ['SLOW_4G', 'CPU_THROTTLE', 'PHONE']
      .filter((n) => new RegExp(`(const|let|var)\\s+${n}\\s*=`).test(code));
    R.ok(redeclared.length === 0,
      `${gate} imports the profile rather than re-declaring it`,
      `re-declared locally: ${redeclared.join(', ')} — delete them and import from verify-lib.mjs`);
    R.ok(/from '\.\/verify-lib\.mjs'/.test(code) && /CPU_THROTTLE/.test(code),
      `${gate} imports CPU_THROTTLE from verify-lib.mjs`);
  }
}

/* ── 4 · in-flight stayed off MoneroLive ───────────────────────────────────── */
R.group('4 · the in-flight axis did not leak into the feed snapshot');
{
  const types = read('./src/data/types.ts');
  R.ok(!/^\s*(refreshing|inFlight|busy)\??:/m.test(types),
    'MoneroLive declares no refreshing/inFlight/busy field — it stays out of the Context value');

  const act = readOr('./src/data/feed-activity.ts');
  if (act === null) {
    R.ok(false, 'src/data/feed-activity.ts exists');
  } else {
    const specs = [...act.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    const bad = specs.filter((x) => x !== 'react' && x !== './feed-status');
    R.ok(bad.length === 0,
      `feed-activity.ts imports only react + a type from feed-status (${specs.join(', ')})`,
      bad.join(', '));
    R.ok(/import type \{ FeedKey \}/.test(act),
      'it takes FeedKey as a TYPE import, so feed-status.ts stays untouched at runtime');
    R.ok(/useSyncExternalStore/.test(act),
      'it is an external store, not Context — only subscribers re-render');
  }

  const feed = read('./src/data/feed-status.ts');
  R.ok(/export type FeedPhase = "loading" \| "live" \| "stale" \| "error";/.test(feed),
    'FeedPhase still has exactly its four members — in-flight did not become a fifth');
}

/* ── 5 · feedDegraded's call sites, both directions ────────────────────────
   The brief said "use it here and only here". That was wrong: it already had
   two legitimate callers. The rule that IS enforced elsewhere is narrower —
   provenance.tsx must never call it (verify-provenance.mjs). This allowlist
   makes the remaining set explicit so a fourth caller is a decision, not a
   drift. Bidirectional, in the shape verify-provenance.mjs:172-182 uses. */
R.group('5 · feedDegraded — the pair-AND global — has only reasoned callers');
{
  const ALLOW = [
    {
      file: 'src/data/feed-status.ts',
      reason: 'its own definition, plus chromePhase which is the chrome-level roll-up the pair-AND was written for.',
    },
    {
      file: 'src/data/useFeedEvents.ts',
      reason: 'the event ticker\'s global stale flag. verify-effects.mjs:88 pins this exact line by regex, so it must not be refactored away.',
    },
    {
      file: 'src/design/ChromeStatus.tsx',
      reason: 'the degraded banner. A page-wide banner is exactly the claim the pair-AND global expresses, which is why this is the one new consumer.',
    },
  ];

  const SRC = new URL('./src/', import.meta.url).pathname;
  const files = [];
  (function walk(d) {
    for (const n of readdirSync(d)) {
      const full = join(d, n);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(n)) files.push(full);
    }
  })(SRC);

  const callers = files
    .filter((f) => /\bfeedDegraded\s*\(/.test(strip(readFileSync(f, 'utf8'))))
    .map((f) => 'src/' + f.slice(SRC.length));

  const orphans = callers.filter((c) => !ALLOW.some((a) => a.file === c));
  R.ok(orphans.length === 0,
    `every feedDegraded call site is in the reasoned allowlist (${callers.length} found)`,
    orphans.join(', '));

  for (const a of ALLOW) {
    R.ok(callers.includes(a.file), `allowlist entry ${a.file} still calls it — a stale entry is not coverage`);
    R.ok(a.reason.length >= 40, `allowlist entry ${a.file} carries a real reason, not a shrug`);
  }

  const prov = read('./src/design/provenance.tsx');
  R.ok(!/\bfeedDegraded\s*\(/.test(strip(prov)),
    'provenance.tsx STILL does not call it — a panel keyed on one endpoint must go stale on that endpoint alone');
}

/* ── 6 · the skeleton's CSS lives where it can be reached ──────────────────── */
R.group('6 · skeleton CSS placement and the reduce contract');
{
  // Strip CSS comments before any structural check. Three assertions in this
  // PR have now failed on prose rather than on code (Math.random in a header,
  // var(-- in a header, and this one) — the comment is always the trap.
  const css = read('./src/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const bigBlock = css.indexOf('@layer components {', css.indexOf('@keyframes sweep'));
  const skIdx = css.indexOf('.sk-swap {');
  R.ok(skIdx > 0, '.sk-swap is declared');
  R.ok(skIdx > 0 && bigBlock > 0 && skIdx < bigBlock,
    'skeleton CSS sits BEFORE the giant @layer components block that carries every @media query — appending after it would nest these rules inside a breakpoint');

  R.ok(/@keyframes sk-shimmer/.test(css), 'the shimmer keyframe exists');
  R.ok(/animation:\s*sk-shimmer\s*calc\([^)]*var\(--tk-anim/.test(css),
    'the shimmer is a LOOP driven by --tk-anim, not var(--d-*) — reduce zeroes --d-* and a zeroed loop is a stopped loop frozen mid-sweep');
  R.ok(!/animation:\s*sk-shimmer[^;]*var\(--d-/.test(css),
    'the shimmer does not read a duration token');

  // The reduce kill-list must name it, or the loop keeps running for readers
  // who asked it not to — the defect #153 found in .prov-fresh--stale.
  const reduceBlocks = css.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\n\}/g) || [];
  R.ok(reduceBlocks.some((b) => /\.sk-box\b[^{]*\{[^}]*animation:\s*none/.test(b)),
    '.sk-box is in a prefers-reduced-motion kill-list — the shimmer stops, the reserved box stays');

  R.ok(/\.sk-swap > \.sk-body \{[^}]*transition:\s*opacity var\(--d-3\)/.test(css),
    'the crossfade uses var(--d-3), which reduce zeroes to a hard cut — arrival stays visible');
  R.ok(/\.shell \{[\s\S]{0,400}?position: relative;/.test(css),
    '.shell is a containing block, so the banner anchors to the topbar\'s bottom edge without naming its height');
  R.ok(/\.degraded-banner \{[^}]*position: absolute/.test(css),
    'the degraded banner is out of flow — in flow it would be ~0.038 CLS, ~4x the gate ceiling');
  R.ok(!/\.degraded-banner[^{]*\{[^}]*transform:/.test(css),
    'the banner does not slide — it appears. Movement would shift content perceptually even out of flow');
}

/* ── 7 · Swap mounts content immediately ───────────────────────────────────
   The structural half of the CLS claim. A measured delta can pass because
   nothing arrived; this cannot. */
R.group('7 · the swap overlays, it does not replace');
{
  const src = readOr('./src/design/Skeleton.tsx');
  if (src === null) {
    R.ok(false, 'src/design/Skeleton.tsx exists');
  } else {
    const body = src.slice(src.indexOf('export function Swap'));
    R.ok(/<div className="sk-body">\{children\}<\/div>/.test(body),
      'Swap renders {children} UNCONDITIONALLY — a skeleton that replaced them would leave useChartMetrics\' ref null forever and never render the svg');
    R.ok(!/ready \?[\s\S]{0,80}children/.test(body),
      'children are not behind a ready ternary');
    R.ok(/minHeight: reserve/.test(body),
      'Swap reserves with minHeight from the caller\'s constant');
  }
}

/* ── 8 · `also=` cannot invent an endpoint ───────────────────────────────────
   WIDENED in p3·14b, because the matcher could not see the thing it claimed
   to cover. It was:

       /\balso=\{?"(\/api\/[a-z0-9-]+)"/g

   `[a-z0-9-]` excludes `/`, and the closing quote is required immediately
   after — so a SUB-PATH never matched AT ALL. Not counted, not resolved, not
   checked, under a message reading "every literal also=… has a real handler
   behind it (4 found)". A true statement about a subject narrower than its
   claim: this repo's standing family, sitting inside a gate.

   Measured before the widening, injecting one file into src/:
     also="/api/nonexistent"        → ❌ red,   5 found   (correct)
     also="/api/nonexistent/thing"  → ✅ GREEN, 4 found   (invisible)
     also="/api/xmr/network/…"      → ✅ green, 4 found   (never counted)
   The count staying at 4 with a fifth literal physically present is the tell.

   Two changes, and the second is the one with teeth.

   (a) CAPTURE BROADLY, JUDGE EXPLICITLY. The path group is `[^"]*`, so ANY
       literal beginning `/api/` is captured and then judged on its shape. An
       unmatched literal is invisible; a captured-but-malformed one is a
       reportable failure. Re-narrowing the character class would only move
       the blind spot (to a query string, to an uppercase segment) rather
       than remove it. The `also="session"` ProvSource form shares the prop
       name and must still NOT be captured — fixtured below, both ways.

   (b) A SUB-PATH NEEDS A REWRITE, NOT JUST A HANDLER. Vercel serves
       `api/<seg>.js` at `/api/<seg>` and nothing beneath it, and there is no
       catch-all in api/ (verified: no `[...slug]` file exists, and
       vercel.json's SPA catch-all explicitly excludes `/api/`). So
       `also="/api/markets/history"` resolves to a real api/markets.js under a
       first-segment rule and still 404s in production. It is reachable only
       where vercel.json rewrites `/api/<seg>/:path*` — today exactly one
       segment, `xmr`, whose `?_p=` api/xmr.js:704-709 parses. Checking the
       handler alone would be the same narrower-subject defect one level down.

   The fixture table below is the falsifiability pair, and it runs on every CI
   run rather than living in a transcript. It uses REAL segment names against
   the REAL api/ and vercel.json — no fakes — so it cannot drift from the tree
   it is describing. Its own non-vacuity is asserted: the table must exercise
   both polarities and `judge` must actually return both. */
R.group('8 · PanelBoundary\'s `also` escape hatch stays honest');
{
  const SRC = new URL('./src/', import.meta.url).pathname;
  const API = new URL('../api/', import.meta.url).pathname;
  const VERCEL = new URL('../vercel.json', import.meta.url).pathname;

  /** First segments vercel.json rewrites into a function with `:path*`. */
  const rewritten = new Set(
    (JSON.parse(readFileSync(VERCEL, 'utf8')).rewrites || [])
      .map((r) => /^\/api\/([a-z0-9-]+)\/:path\*$/.exec(String(r.source || '')))
      .filter(Boolean)
      .map((m) => m[1]),
  );
  R.info(`vercel.json rewrites these /api/<seg>/:path* segments: ${[...rewritten].join(', ') || '(none)'}`);

  const ALSO_SRC = '\\balso=\\{?"(\\/api\\/[^"]*)"';
  const captures = (text) => [...text.matchAll(new RegExp(ALSO_SRC, 'g'))].map((m) => m[1]);

  /** null when the literal is honest, else the reason it is not. */
  const judge = (raw) => {
    const path = raw.split(/[?#]/)[0];
    const segs = path.slice('/api/'.length).split('/').filter(Boolean);
    if (segs.length === 0) return 'no segment after /api/';
    const seg = segs[0];
    if (!/^[a-z0-9-]+$/.test(seg)) return `first segment "${seg}" is not a plain lowercase segment`;
    if (!existsSync(join(API, `${seg}.js`))) return `no api/${seg}.js`;
    if (segs.length > 1 && !rewritten.has(seg)) {
      return `sub-path, but vercel.json has no "/api/${seg}/:path*" rewrite — this 404s in production`;
    }
    return null;
  };

  /* -- 8a · the matcher sees sub-paths and still ignores `also="session"` -- */
  const CAP = [
    ['also="/api/markets"', ['/api/markets'], 'single segment, the pre-existing shape'],
    ['also="/api/xmr/network/difficulty"', ['/api/xmr/network/difficulty'], 'THE HISTORICAL BLIND SPOT'],
    ['also={"/api/xmr/tip"}', ['/api/xmr/tip'], 'brace form'],
    ['also="/api/xmr?range=7d"', ['/api/xmr?range=7d'], 'query string is captured, not skipped'],
    ['also="session"', [], 'the ProvSource form must NOT be captured'],
  ];
  const capBad = CAP
    .map(([text, want, why]) => {
      const got = captures(text);
      return JSON.stringify(got) === JSON.stringify(want) ? null : `${why}: ${text} → ${JSON.stringify(got)}, want ${JSON.stringify(want)}`;
    })
    .filter(Boolean);
  R.ok(capBad.length === 0, `8a matcher fixtures: ${CAP.length} capture cases, sub-paths included, "session" excluded`, capBad.join(' | '));
  R.ok(CAP.some(([, w]) => w.length > 0) && CAP.some(([, w]) => w.length === 0),
    '8a exercises both polarities — a capture table of only-matches would pass a matcher that matches everything');

  /* -- 8b · the resolver, against the real api/ and the real vercel.json -- */
  const JUDGE = [
    ['/api/markets', true, 'single segment with a real handler'],
    ['/api/xmr/network/difficulty', true, 'sub-path under the one rewritten segment'],
    ['/api/xmr?range=7d', true, 'query is stripped before resolution'],
    ['/api/nonexistent', false, 'no handler — the case the old matcher DID catch'],
    ['/api/nonexistent/thing', false, 'no handler, sub-path — the case it did NOT'],
    ['/api/markets/history', false, 'real handler, but no rewrite: 404 in production'],
    ['/api/', false, 'no segment at all'],
    ['/api/XMR/tip', false, 'not a plain lowercase segment'],
  ];
  const judgeBad = JUDGE
    .map(([p, wantOk, why]) => {
      const r = judge(p);
      return (r === null) === wantOk ? null : `${why}: ${p} → ${r === null ? 'accepted' : `rejected (${r})`}, want ${wantOk ? 'accepted' : 'rejected'}`;
    })
    .filter(Boolean);
  R.ok(judgeBad.length === 0, `8b resolver fixtures: ${JUDGE.length} cases over the real api/ + vercel.json`, judgeBad.join(' | '));
  R.ok(JUDGE.some(([p]) => judge(p) === null) && JUDGE.some(([p]) => judge(p) !== null),
    '8b exercises both polarities — judge() returns an accept AND a reject on this table');

  /* -- 8c · the real tree -- */
  const files = [];
  (function walk(d) {
    for (const n of readdirSync(d)) {
      const full = join(d, n);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(n)) files.push(full);
    }
  })(SRC);

  const bad = [];
  let found = 0;
  let subPaths = 0;
  for (const f of files) {
    for (const p of captures(strip(readFileSync(f, 'utf8')))) {
      found++;
      if (p.split(/[?#]/)[0].slice('/api/'.length).split('/').filter(Boolean).length > 1) subPaths++;
      const why = judge(p);
      if (why) bad.push(`${p} in ${f.slice(SRC.length)} (${why})`);
    }
  }
  R.ok(bad.length === 0,
    `every literal also="/api/…" resolves to a reachable handler (${found} found, of which ${subPaths} sub-path${subPaths === 1 ? '' : 's'})`,
    bad.join(' | '));
}

process.exit(R.finish());
