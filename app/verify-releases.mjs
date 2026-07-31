// verify-releases.mjs — proves the SourcesPage release-notes merge never
// fabricates, never drops a curated note, and never semver-sorts. Exercises
// the REAL shipped `mergeReleases`/`CURATED`/`SITE_VERSION` exports directly
// (no React/DOM required).
//
// Run: node verify-releases.mjs   (Node >=22.18 strips the type annotations)

import * as r from './src/data/releases.ts';

const { SITE_VERSION, CURATED, mergeReleases } = r;

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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

// 6) SITE_VERSION shape.
ok(/^v\d+\.\d+\.\d+$/.test(SITE_VERSION), `SITE_VERSION "${SITE_VERSION}" matches vX.Y.Z`);

// 7) CURATED shape — the moved-verbatim five rows.
ok(CURATED.length === 5, `CURATED.length === 5 (got ${CURATED.length})`);
ok(CURATED.every((c) => typeof c.v === 'string' && c.v.length > 0 && typeof c.note === 'string' && c.note.length > 0),
  'every CURATED entry has a non-empty v and note');

console.log(fail ? '\n❌ verify-releases FAILED' : '\n✅ verify-releases: all assertions passed');
process.exit(fail ? 1 : 0);
