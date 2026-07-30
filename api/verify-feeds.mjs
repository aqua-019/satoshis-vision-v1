/* verify-feeds.mjs — offline unit test for api/feeds.js.
   Run: node api/verify-feeds.mjs
   The sandbox proxy returns CONNECT 403 for getmonero.org and
   api.github.com, so we verify the pure parseAtom / parseRepoParam /
   mapRepo / mapIssues helpers against a committed Atom fixture and inline
   JSON fixtures that mirror real getmonero.org / GitHub API shapes.
   Live-network verification (real feed.xml, real GitHub responses) is
   deferred to a post-deploy curl pass, same as verify-tx-parse.mjs does
   for monerod. */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const { parseAtom, parseRepoParam, mapRepo, mapIssues, GH_ALLOWED } = require('./feeds.js');

const __dirname = dirname(fileURLToPath(import.meta.url));

let failed = 0;
function ok(cond, msg) {
  if (cond) {
    console.log(`✅ ${msg}`);
  } else {
    console.log(`❌ ${msg}`);
    failed++;
  }
}

/* ── parseAtom ─────────────────────────────────────────────────────── */

const fixture = readFileSync(join(__dirname, '_fixtures', 'getmonero-feed.xml'), 'utf8');

const items = parseAtom(fixture, 5);

/* 4 <entry> elements in the fixture, but the 4th has no <link> and must
   be skipped — so 3 items, in feed order. */
ok(items.length === 3, 'parseAtom(fixture, 5) returns 3 items (4th entry has no <link>, skipped)');

ok(items[0]?.title === 'Monero Missions #7', 'item[0] title is plain text, unescaped');
ok(items[0]?.url === 'https://www.getmonero.org/2026/07/20/monero-missions-7.html', 'item[0] url from <link href>');
ok(items[0]?.date === '2026-07-20T00:00:00+00:00', 'item[0] date from <published>');

ok(items[1]?.title === "Community member's guide to CCS & funding",
  'item[1] title decodes &#39; and &amp; entities');
ok(items[1]?.url === 'https://www.getmonero.org/2026/06/15/ccs-funding-guide.html', 'item[1] url correct');
ok(items[1]?.date === '2026-06-15T00:00:00+00:00', 'item[1] date from <published>');

ok(items[2]?.title === 'Hard fork scheduled: FCMP++ activation window',
  'item[2] title decodes from CDATA wrapper');
ok(items[2]?.url === 'https://www.getmonero.org/2026/05/01/fcmp-hard-fork.html', 'item[2] url correct');
ok(items[2]?.date === '2026-05-01T12:30:00+00:00',
  'item[2] date falls back to <updated> (no <published> present)');

ok(!items.some((i) => i.title.includes('Malformed')), 'entry with no <link> is skipped, not emitted with empty url');
ok(!items.some((i) => i.url === ''), 'no item has an empty url');

/* Loud-failure path: format change / empty feed → []. The caller (feeds.js
   handler) is responsible for turning [] into a 502, not this function. */
ok(Array.isArray(parseAtom('<feed></feed>', 5)) && parseAtom('<feed></feed>', 5).length === 0,
  'parseAtom("<feed></feed>", 5) returns [] — loud-failure path, no throw');

/* n is respected. */
ok(parseAtom(fixture, 2).length === 2, 'parseAtom respects n (n=2 returns 2)');
ok(parseAtom(fixture, 1).length === 1, 'parseAtom respects n (n=1 returns 1)');

/* ── parseRepoParam ────────────────────────────────────────────────── */

ok(parseRepoParam('monero-project/monero') === 'monero-project/monero', 'parseRepoParam accepts owner/name');
ok(parseRepoParam('') === null, 'parseRepoParam rejects empty string');
ok(parseRepoParam('../etc') === null, 'parseRepoParam rejects ".." traversal');
ok(parseRepoParam('a/b/c') === null, 'parseRepoParam rejects more than one slash');
ok(parseRepoParam('/monero') === null, 'parseRepoParam rejects leading slash');
ok(parseRepoParam('monero/') === null, 'parseRepoParam rejects trailing slash');
ok(parseRepoParam('https://api.github.com/x/y') === null, 'parseRepoParam rejects a scheme/URL');
ok(parseRepoParam('a'.repeat(100) + '/' + 'b'.repeat(100)) === null, 'parseRepoParam rejects a 200-char string');
ok(parseRepoParam(null) === null, 'parseRepoParam rejects non-string input');
ok(parseRepoParam(undefined) === null, 'parseRepoParam rejects undefined');

/* Every allowlisted repo must itself pass validation — otherwise the
   allowlist would be dead code no caller could ever reach. */
for (const repo of GH_ALLOWED) {
  ok(parseRepoParam(repo) === repo, `GH_ALLOWED entry "${repo}" passes parseRepoParam`);
}
ok(GH_ALLOWED.length === 7, 'GH_ALLOWED has exactly the 7 repos from the brief');

/* ── mapIssues ─────────────────────────────────────────────────────── */

const issuesFixture = [
  { number: 101, title: 'Real issue one', updated_at: '2026-07-01T00:00:00Z', html_url: 'https://github.com/monero-project/research-lab/issues/101', comments: 3 },
  { number: 102, title: 'This is actually a PR', updated_at: '2026-07-02T00:00:00Z', html_url: 'https://github.com/monero-project/research-lab/pull/102', comments: 1, pull_request: { url: 'https://api.github.com/...' } },
  { number: 103, title: 'Real issue two', updated_at: '2026-06-30T00:00:00Z', html_url: 'https://github.com/monero-project/research-lab/issues/103', comments: 0 },
];

const mappedIssues = mapIssues(issuesFixture);
ok(mappedIssues.length === 2, 'mapIssues drops the entry carrying a pull_request key');
ok(mappedIssues.every((i) => !('pull_request' in i)), 'no mapped issue carries a pull_request key');
ok(mappedIssues[0].n === 101 && mappedIssues[0].t === 'Real issue one'
  && mappedIssues[0].u === '2026-07-01T00:00:00Z'
  && mappedIssues[0].url === 'https://github.com/monero-project/research-lab/issues/101'
  && mappedIssues[0].c === 3,
  'mapIssues maps {n,t,u,url,c} correctly for issue #101');
ok(mappedIssues[1].n === 103, 'mapIssues preserves order, skipping only the PR');
ok(mapIssues([]).length === 0, 'mapIssues([]) returns []');
ok(mapIssues(null).length === 0, 'mapIssues(null) returns [] (defensive, does not throw)');

/* ── mapRepo ───────────────────────────────────────────────────────── */

const repoFixture = {
  full_name: 'monero-project/monero',
  stargazers_count: 9876,
  pushed_at: '2026-07-29T10:00:00Z',
  open_issues_count: 234,
  forks_count: 5555, // present in real payloads, ignored by mapRepo
};
const mappedRepo = mapRepo(repoFixture);
ok(mappedRepo.stars === 9876, 'mapRepo maps stargazers_count -> stars');
ok(mappedRepo.pushed === '2026-07-29T10:00:00Z', 'mapRepo maps pushed_at -> pushed');
ok(mappedRepo.issues === 234, 'mapRepo maps open_issues_count -> issues');

if (failed > 0) {
  console.log(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed ✅');
