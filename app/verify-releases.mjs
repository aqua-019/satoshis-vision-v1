// verify-releases.mjs — proves the SourcesPage release-notes merge never
// fabricates, never drops a curated note, and never semver-sorts. Exercises
// the REAL shipped `mergeReleases`/`CURATED`/`SITE_VERSION` exports directly
// (no React/DOM required).
//
// Run: node verify-releases.mjs   (Node >=22.18 strips the type annotations)

import { readFileSync, readdirSync } from 'fs';

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── THE SUBJECT, LOADED GUARDED (p4·01, closing #186) ───────────────────────
// These two were TOP-LEVEL `import` statements. A resolvable-but-broken edit to
// either leaf then killed this gate AT MODULE LOAD — node threw before the
// first assertion ran, so the run exited red having printed ZERO named failures
// and no summary line at all. That is the worst shape a red can take here:
// a `grep '❌'` over a crash returns EMPTY, which reads exactly like "no
// failures found". (Same family as p3·14b's `node --check` finding — a crash
// prints no marker, and a sweep for a marker cannot see one.)
//
// A dynamic import inside try/catch converts that into ONE NAMED red that says
// which leaf failed and why. It is deliberately FATAL rather than a skip: every
// assertion below reads these exports, so continuing would assert nothing while
// printing green — and a skip is neither a pass nor a failure, which are
// precisely the two states a reader needs told apart here.
const loadLeaf = async (spec) => {
  try {
    return await import(spec);
  } catch (err) {
    ok(false, `${spec} FAILED TO LOAD — ${err?.code ?? 'Error'}: ${String(err?.message ?? err).split('\n')[0]}`);
    return null;
  }
};
const r = await loadLeaf('./src/data/releases.ts');
const ver = await loadLeaf('./src/data/siteVersion.ts');
if (!r || !ver) {
  console.log('\n❌ verify-releases FAILED — the subject under test could not be loaded, so NONE of the assertions below were made. This is a load failure, not a green run.');
  process.exit(1);
}

const { CURATED, mergeReleases, isPrKeyed, prReleaseId, eraSeamIndex } = r;
const { SITE_VERSION, SITE_ERA, SITE_PR } = ver;

// 1) auto null/empty ⇒ CURATED verbatim (the GitHub-unreachable fallback —
//    the page must render exactly what it rendered before this feed existed).
ok(deepEq(mergeReleases(null), CURATED), 'mergeReleases(null) deep-equals CURATED');
ok(deepEq(mergeReleases([]), CURATED), 'mergeReleases([]) deep-equals CURATED');

// 2) curated prose overrides a commit subject for a version present in both,
//    and that entry is flagged curated: true.
{
  const auto = [
    { v: 'v6.0.2', note: 'type pass: monero tabs, education, layout', date: '2026-07-30', sha: '7e668de', url: 'https://example/commit/7e668de' },
    { v: 'v5.0.20', note: 'raw commit subject that should be overridden', date: '2026-03-11' },
  ];
  const merged = mergeReleases(auto);
  const v20 = merged.find((x) => x.v === 'v5.0.20');
  ok(!!v20, 'v5.0.20 present in merged output');
  ok(v20?.note === CURATED.find((c) => c.v === 'v5.0.20').note, 'curated prose wins on note for a shared version');
  ok(v20?.curated === true, 'shared-version entry is flagged curated: true');
  const v202 = merged.find((x) => x.v === 'v6.0.2');
  ok(v202?.note === 'type pass: monero tabs, education, layout', 'auto-only version keeps its own note');
  ok(v202?.curated !== true, 'auto-only version is not flagged curated');
}

// 3) a curated-only version outside the fetched window is appended, never dropped.
{
  const auto = [{ v: 'v6.0.2', note: 'newest commit', date: '2026-07-30' }];
  const merged = mergeReleases(auto);
  const tail = CURATED.map((c) => c.v);
  ok(merged.length === 1 + CURATED.length, 'curated-only versions are all appended after the auto list');
  ok(deepEq(merged.slice(1).map((x) => x.v), tail), 'appended curated versions keep CURATED\'s own order');
  ok(merged.slice(1).every((x) => x.curated === true), 'appended curated-only entries are flagged curated: true');
}

// 4) input order is preserved — never semver-sorted. A v5.1.0 placed between
//    v5.0.9 and v5.0.8 (chronologically legitimate) stays exactly there.
{
  const auto = [
    { v: 'v5.1.0', note: 'a', date: '2026-01-03' },
    { v: 'v5.0.9', note: 'b', date: '2026-01-02' },
    { v: 'v5.0.8', note: 'c', date: '2026-01-01' },
  ];
  const merged = mergeReleases(auto, []);
  ok(deepEq(merged.map((x) => x.v), ['v5.1.0', 'v5.0.9', 'v5.0.8']), 'auto order preserved verbatim (v5.1.0 between v5.0.9/v5.0.8, not semver-sorted)');
}

// 5) no two output entries share `v`, even if `auto` itself has a duplicate.
{
  const auto = [
    { v: 'v6.0.2', note: 'first' },
    { v: 'v6.0.2', note: 'duplicate, should be dropped' },
  ];
  const merged = mergeReleases(auto, []);
  const vs = merged.map((x) => x.v);
  ok(new Set(vs).size === vs.length, 'no two output entries share v');
  ok(merged.length === 1 && merged[0].note === 'first', 'first occurrence wins on a duplicate v in auto');
}

// 6) SITE_VERSION shape — PR-KEYED since p3·17.
//
//    This assertion used to read /^v\d+\.\d+\.\d+$/ and it passed, every day,
//    for the twenty-two releases the label was WRONG. That is the whole lesson
//    of this section: a shape check proves the label is well-formed and says
//    nothing at all about whether it is TRUE. Section 8 is the one with content.
ok(/^v\d+ · #\d+$/.test(SITE_VERSION), `SITE_VERSION "${SITE_VERSION}" matches "vN · #NNN"`);
ok(SITE_VERSION === `${SITE_ERA} · #${SITE_PR}`,
  'SITE_VERSION is DERIVED from SITE_ERA/SITE_PR, so the label and the number cannot disagree');
ok(Number.isInteger(SITE_PR) && SITE_PR > 0, `SITE_PR is a positive integer (got ${SITE_PR})`);

// 6b) the era predicate and the id builder agree with each other and with the
//     two shapes actually in the list. One definition, three consumers (the
//     server transform, the render's seam, this gate).
ok(isPrKeyed(prReleaseId(SITE_PR)), 'prReleaseId output is recognised by isPrKeyed');
ok(isPrKeyed('#185') && !isPrKeyed('v5.0.20') && !isPrKeyed('#') && !isPrKeyed('185'),
  'isPrKeyed accepts "#185" and rejects "v5.0.20", "#" and a bare number');
ok(CURATED.every((c) => !isPrKeyed(c.v)),
  'every CURATED entry is version-keyed — the two eras are disjoint, so rule 2 can never mis-fire across them');

// 6c) eraSeamIndex — the divider is a CLAIM about a discontinuity, so it must
//     not render when there is only one era present.
ok(eraSeamIndex([]) === -1, 'eraSeamIndex([]) is -1');
ok(eraSeamIndex(CURATED) === -1, 'eraSeamIndex over a curated-only list is -1 — no seam is drawn when the feed is empty');
ok(eraSeamIndex([{ v: '#186' }, { v: '#185' }]) === -1, 'eraSeamIndex over a PR-only list is -1');
ok(eraSeamIndex([{ v: '#186' }, { v: 'v5.0.20' }, { v: 'v5.0.19' }]) === 1,
  'eraSeamIndex returns the index of the FIRST version-keyed entry after a PR-keyed one');
ok(eraSeamIndex(mergeReleases([{ v: '#186', note: 'x', date: '2026-08-16' }])) === 1,
  'a real merged list seams immediately after the auto entries');

// ── 7) the split that keeps the curated prose out of first paint ────────
//
// `SITE_VERSION` moved to `data/siteVersion.ts` because `NavTop` is EAGER:
// importing it from `data/releases.ts` put all five curated notes into the
// entry chunk on every route (measured at bda0491 — each prose string grepped
// to exactly 1 in the served `dist/assets/index-*.js`).
//
// Nothing else in this repo enforces that kind of invariant — CLAUDE.md records
// the same rule for `design/canvasColor.ts` with the note that it "has no gate".
// This is that gate, for this leaf. It is a SOURCE assertion rather than a
// bundle one on purpose: verify-bundle measures bytes and would only notice
// once a ceiling was crossed, and the tightest margin in that table is 429 B.
{
  const SRC = new URL('./src/', import.meta.url);
  const files = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const u = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
      if (e.isDirectory()) walk(u);
      else if (/\.tsx?$/.test(e.name)) files.push(u);
    }
  })(SRC);
  ok(files.length > 100, `source scan found ${files.length} .ts/.tsx files (non-vacuity floor)`);

  // Strip block and line comments before matching — this file's own siblings
  // NAME `@/data/releases` in prose explaining why they must not import it, and
  // a comment-blind grep would count those as importers. (CLAUDE.md records
  // this exact failure: "a grep that counts mentions is not a grep that counts
  // imports".)
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  // Two objects, same source. `.test()` on a /g regex ADVANCES lastIndex, so
  // sharing one instance between matchAll() and test() makes the second call's
  // answer depend on the first's — a stateful predicate masquerading as a pure
  // one. Cheap to avoid, invisible when it bites.
  const RELEASES_SRC = String.raw`import\s+(type\s+)?[^;]*?from\s+["'](?:@\/data\/releases|\.\/releases|\.\.\/data\/releases)["']`;
  const RELEASES_FROM = new RegExp(RELEASES_SRC, 'g');
  const RELEASES_ONCE = new RegExp(RELEASES_SRC);

  const valueImporters = [];
  const typeImporters = [];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(RELEASES_FROM)) {
      const rel = f.pathname.split('/src/')[1];
      (m[1] ? typeImporters : valueImporters).push(rel);
    }
  }

  // A `import type` is erased at build time and creates no runtime edge, so it
  // cannot drag the prose anywhere — useCachedFeed.ts legitimately does this
  // for `ReleaseNote`. Counting it as an importer would fail a correct tree.
  ok(typeImporters.includes('data/useCachedFeed.ts'),
    'useCachedFeed.ts imports ReleaseNote as a TYPE — erased at build, no runtime edge (control: the scan can see type imports)');
  ok(valueImporters.length === 1 && valueImporters[0] === 'pages/SourcesPage.tsx',
    `data/releases.ts has exactly ONE value importer and it is the lazy SourcesPage (got: ${valueImporters.join(', ') || 'none'})`);

  const navTop = strip(readFileSync(new URL('./src/layout/NavTop.tsx', import.meta.url), 'utf8'));
  ok(/from\s+["']@\/data\/siteVersion["']/.test(navTop),
    'NavTop imports SITE_VERSION from the leaf @/data/siteVersion');
  ok(!RELEASES_ONCE.test(navTop),
    'NavTop does NOT import from @/data/releases — this is what keeps the curated prose out of the entry chunk');

  // THE LEAF PROPERTY. siteVersion.ts is reachable from the eager entry, so the
  // invariant that actually protects first paint is that it imports NOTHING —
  // a module with no edges can never drag anything in behind it, whatever is
  // added to it later. Asserted structurally rather than by byte count.
  const leaf = strip(readFileSync(new URL('./src/data/siteVersion.ts', import.meta.url), 'utf8'));
  ok(!/\bimport\s/.test(leaf) && !/\bfrom\s+["']/.test(leaf),
    'data/siteVersion.ts is a true LEAF — it imports nothing, so nothing rides into the entry chunk behind it');
  ok(!/CURATED|mergeReleases/.test(leaf),
    'the version leaf carries no release PROSE — that is what moved out of first paint');
  // And the other direction: releases.ts must not re-export the leaf, because
  // Node's loader (which runs this gate) does not resolve the extensionless
  // specifier that Vite accepts.
  const relSrc = strip(readFileSync(new URL('./src/data/releases.ts', import.meta.url), 'utf8'));
  ok(!/from\s+["']\.\/siteVersion["']/.test(relSrc),
    'releases.ts does not import ./siteVersion extensionless — that edge builds under Vite but breaks this gate under Node');
}

// ── 8) THE STALENESS GATE ───────────────────────────────────────────────
//
// The defect this section exists for: the topbar said v6.0.5 through PRs
// #164-#185 and nothing noticed, because nothing compared it to anything that
// MOVES.
//
// AN EQUALITY GATE BETWEEN TWO HAND-MAINTAINED CONSTANTS DETECTS DISAGREEMENT,
// NOT STALENESS. Pinning SITE_VERSION to package.json's `version` would have
// been green for all twenty-two of those releases — both sides simply sit
// still together. So the authority has to move on its own, and `handoffs/LOG.md`
// does: one line per completed task, each carrying its PR URL.
//
// It also has to be a committed FILE, not git history: ci.yml uses
// actions/checkout@v4 with no fetch-depth, which defaults to depth 1, so a
// `git log`-derived authority is unreadable in CI.
{
  const log = readFileSync(new URL('../handoffs/LOG.md', import.meta.url), 'utf8');
  // Scoped to THIS repo's PR URLs. An unscoped /pull\/(\d+)/ would also match a
  // link to any other repository's pull request, and the max of that set is not
  // this site's release number.
  const prs = [...log.matchAll(/github\.com\/aqua-019\/satoshis-vision-v1\/pull\/(\d+)/g)]
    .map((m) => Number(m[1]));

  // NON-VACUITY FLOOR, FIRST. Without it a wrong path or a changed URL shape
  // yields an empty set, Math.max() returns -Infinity, and the comparison below
  // becomes an assertion about nothing. This must fail LOUDLY, not skip.
  ok(prs.length >= 20,
    `handoffs/LOG.md yields ${prs.length} PR references (floor 20) — the authority is readable`);

  const logMax = Math.max(...prs);
  ok(Number.isFinite(logMax), `newest PR recorded in handoffs/LOG.md is #${logMax}`);

  // THE INVARIANT: the label may LEAD by one, never LAG.
  //
  // Lead-by-one is deliberate. You bump SITE_PR in the commit that opens the
  // PR, before that PR's own LOG line exists (it is written at write-back), so
  // plain equality would be red for most of every PR's life — and this repo has
  // already recorded where that leads: "a red a re-run clears is a red people
  // learn to click through".
  //
  // The upper bound is what closes the loophole in the other direction. Without
  // it, "never behind" is satisfied forever by SITE_PR = 99999.
  ok(SITE_PR >= logMax,
    `SITE_PR #${SITE_PR} is not BEHIND the newest LOG entry #${logMax} — the staleness check`);
  ok(SITE_PR <= logMax + 1,
    `SITE_PR #${SITE_PR} is at most one ahead of #${logMax} — the label names the PR being shipped, not an arbitrary future one`);
}

// 7) CURATED shape — the moved-verbatim five rows.
ok(CURATED.length === 5, `CURATED.length === 5 (got ${CURATED.length})`);
ok(CURATED.every((c) => typeof c.v === 'string' && c.v.length > 0 && typeof c.note === 'string' && c.note.length > 0),
  'every CURATED entry has a non-empty v and note');

// 8) THE SHELL CARRIES NO VERSION CLAIM (p4·01).
//
// `app/index.html` shipped `<title>xmr.irish · v5.0</title>` and a matching
// meta description for ~25 PRs after the era became v6, so the browser tab
// contradicted the gated `v6 · #188` in the topbar on every route. It had no
// gate at all — which is why it rotted for twenty-five releases while five
// other version surfaces were being pinned.
//
// WHY THIS READS THE SOURCE AND NOT `dist/index.html`. `ci.yml` records the
// reason in its own comment at :86-88: in the `verify` job, `npm run
// verify:static` — where this gate runs — executes BEFORE that job's Build
// step, "so a dist-reading gate placed there would fail on every single run".
// A dist assertion here would also pass LOCALLY off a stale build and fail only
// in CI, which is the stale-`dist` trap this repo has recorded three times.
// The source is the authority in any case: measured at `81fafca`, all fourteen
// prerendered `dist/**/index.html` carried the shell's title BYTE-IDENTICALLY.
{
  const shell = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const title = shell.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? null;
  const desc = shell.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1] ?? null;

  // POSITIVE CONTROLS FIRST. Without these, "carries no version" is satisfied
  // by a DELETED title, an empty one, or a changed tag shape the regex stops
  // matching — an absence that holds for a reason unrelated to the claim is the
  // single most-recorded gate defect in this repo.
  ok(title !== null && title.trim().length > 0,
    `app/index.html declares a non-empty <title> — ${JSON.stringify(title)}`);
  ok(desc !== null && desc.trim().length > 0,
    'app/index.html declares a non-empty meta description');
  ok(!!title && title.includes('xmr.irish'), 'the <title> still names the site');
  ok(!!desc && desc.includes('xmr.irish'), 'the meta description still names the site');

  // THE ASSERTION. Both spellings are checked because this repo's own identity
  // uses both: `SITE_ERA` is "v6" and `SITE_VERSION` is "v6 · #188".
  const VERSION_RX = /\bv\d+(?:\.\d+)*\b|#\d+/i;
  for (const [what, s] of [['<title>', title], ['meta description', desc]]) {
    const hit = s?.match(VERSION_RX)?.[0] ?? null;
    ok(!hit, `the ${what} carries NO version claim`
      + (hit ? ` — found ${JSON.stringify(hit)} in ${JSON.stringify(s)}` : ''));
  }

  // The source is authoritative ONLY because prerender copies the shell's
  // <head> through untouched — it replaces the <html> tag and the root element
  // and nothing else. Pin that premise structurally rather than in prose: if a
  // future change starts emitting a per-route title, this reds and says so,
  // instead of the assertions above silently becoming insufficient.
  // BLIND SPOT, stated: this catches a title EMITTED by prerender. It could not
  // see one injected by a Vite plugin from vite.config.ts.
  const pre = readFileSync(new URL('./scripts/prerender.mjs', import.meta.url), 'utf8');
  ok(!/<title/i.test(pre),
    'scripts/prerender.mjs emits no <title> — the shell is the single authority for all 18 routes');
}

console.log(fail ? '\n❌ verify-releases FAILED' : '\n✅ verify-releases: all assertions passed');
process.exit(fail ? 1 : 0);
