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
const { parseAtom, parseRepoParam, mapRepo, mapIssues, latestIssueAt, GH_ALLOWED, canonicalRepo, SELF_REPO, parseCommitVersion, mapCommits } = require('./feeds.js');

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
/* An exact SET check, not just a count — a count alone would let a swapped
   entry through, and the casing of the two v6.1.1 additions is load-bearing
   (api.github.com paths are case-sensitive where github.com redirects). */
const EXPECTED_ALLOWED = [
  'kayabaNerve/fcmp-plus-plus',
  'seraphis-migration/wallet3',
  'UkoeHB/Seraphis',
  'jeffro256/carrot',
  'Cuprate/cuprate',
  'monero-project/monero',
  'monero-project/research-lab',
  'aqua-019/satoshis-vision-v1',
  'brainchainz/Monero-Superbrain',
];
ok(GH_ALLOWED.length === 9, 'GH_ALLOWED has exactly 9 repos (7 original + this site + Monero-Superbrain)');
ok(JSON.stringify([...GH_ALLOWED].sort()) === JSON.stringify([...EXPECTED_ALLOWED].sort()),
  'GH_ALLOWED is exactly the expected set — no silent additions or swaps');
ok(GH_ALLOWED.includes('brainchainz/Monero-Superbrain'),
  'Monero-Superbrain is stored with GitHub\'s exact casing');
ok(canonicalRepo('brainchainz/monero-superbrain') === 'brainchainz/Monero-Superbrain',
  'canonicalRepo repairs a lowercase caller into the canonical casing sent upstream');

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

/* ── latestIssueAt ─────────────────────────────────────────────────────
   The repo pulse reports push age and issue age as two separate signals, so
   a repo nobody pushes to (monero-project/research-lab) is not reported as
   dead while its issues are busy. issuesFixture is the adversarial case: its
   PR at index 1 carries the NEWEST updated_at, so a naive "take [0] of the
   raw list" would return the PR's date. */
ok(latestIssueAt(issuesFixture) === '2026-07-01T00:00:00Z',
  'latestIssueAt skips the newer PR and returns the newest real issue\'s updated_at');
ok(latestIssueAt([]) === null,
  'latestIssueAt([]) -> null (a repo with no issues, e.g. this site\'s own)');
ok(latestIssueAt(null) === null, 'latestIssueAt(null) -> null (defensive, does not throw)');
ok(latestIssueAt([{ number: 9, pull_request: {}, updated_at: '2026-07-09T00:00:00Z' }]) === null,
  'a window containing only PRs -> null, never the PR\'s date');
ok(latestIssueAt([{ number: 9, title: 'x', html_url: 'u', comments: 0 }]) === null,
  'an issue with no updated_at -> null, never undefined leaking into the payload');

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
/* issueAt comes from a DIFFERENT endpoint and is merged in getGhRepo. Pinning
   its absence here keeps mapRepo a single-payload pure transform. */
ok(!('issueAt' in mappedRepo),
  'mapRepo emits no issueAt — the issue timestamp is a second call, merged in getGhRepo');

/* ── parseCommitVersion ────────────────────────────────────────────── */

ok(
  JSON.stringify(parseCommitVersion('v6.0.2 — type pass: monero tabs, education, layout'))
    === JSON.stringify({ v: 'v6.0.2', note: 'type pass: monero tabs, education, layout' }),
  'parseCommitVersion parses "vX.Y.Z — note" (em dash) into { v, note }'
);

ok(parseCommitVersion('Merge pull request #125 from aqua-019/foo') === null,
  'parseCommitVersion rejects a merge-commit subject');
ok(parseCommitVersion('chore: arm AQUA v3 stack') === null,
  'parseCommitVersion rejects a chore subject mentioning a bare "v3"');
ok(parseCommitVersion('fix(mempool): tighten pan (v5.0.11)') === null,
  'parseCommitVersion rejects a version mentioned mid-sentence, not anchored at start');
ok(parseCommitVersion('Mobile hotfix (v5.0.2): layout') === null,
  'parseCommitVersion rejects another mid-sentence version mention');
ok(parseCommitVersion('') === null, 'parseCommitVersion rejects an empty subject');

ok(
  JSON.stringify(parseCommitVersion('v1.2.3 — note')) === JSON.stringify({ v: 'v1.2.3', note: 'note' }),
  'parseCommitVersion accepts the em-dash (—) form'
);
ok(
  JSON.stringify(parseCommitVersion('v1.2.3 – note')) === JSON.stringify({ v: 'v1.2.3', note: 'note' }),
  'parseCommitVersion accepts the en-dash (–) form'
);
ok(
  JSON.stringify(parseCommitVersion('v1.2.3 - note')) === JSON.stringify({ v: 'v1.2.3', note: 'note' }),
  'parseCommitVersion accepts the plain-hyphen (-) form'
);

/* ── mapCommits ────────────────────────────────────────────────────── */
/* Fixture mirrors the GitHub commits-list API shape:
   { sha, commit: { message, author: { date } }, html_url }.
   Ordered newest-first, as GitHub returns it. Built inline rather than as
   a committed fixture file — this is the only test that needs it. */

const commitsFixture = [
  { sha: '7e668de1111111111111111111111111111111',
    commit: { message: 'v6.0.2 — type pass: monero tabs, education, layout', author: { date: '2026-07-30T10:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/7e668de1111111111111111111111111111111' },
  { sha: 'mergeabc2222222222222222222222222222222',
    commit: { message: 'Merge pull request #125 from aqua-019/foo\n\nSome merge body text', author: { date: '2026-07-29T09:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/mergeabc2222222222222222222222222222222' },
  { sha: '7dc05503333333333333333333333333333333',
    commit: { message: 'v6.0.2 — fix mempool pan on mobile', author: { date: '2026-07-28T08:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/7dc05503333333333333333333333333333333' },
  { sha: 'choreabc4444444444444444444444444444444',
    commit: { message: 'chore: arm AQUA v3 stack', author: { date: '2026-07-27T07:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/choreabc4444444444444444444444444444444' },
  { sha: '1bc8f06555555555555555555555555555555',
    commit: { message: 'v6.0.2 — polish layout details', author: { date: '2026-07-26T06:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/1bc8f06555555555555555555555555555555' },
  { sha: 'fixmempool666666666666666666666666666',
    commit: { message: 'fix(mempool): tighten pan (v5.0.11)', author: { date: '2026-07-25T05:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/fixmempool666666666666666666666666666' },
  { sha: '4f97c21777777777777777777777777777777',
    commit: { message: 'v6.0.2 — initial type pass', author: { date: '2026-07-24T04:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/4f97c21777777777777777777777777777777' },
  { sha: 'mobilehotfix88888888888888888888888888',
    commit: { message: 'Mobile hotfix (v5.0.2): layout', author: { date: '2026-07-23T03:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/mobilehotfix88888888888888888888888888' },
  { sha: 'multiline999999999999999999999999999999',
    commit: { message: 'v9.9.9 — multiline note first line\n\nBody text mentions v1.2.3 — should not matter\nAnd more body', author: { date: '2026-07-01T00:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/multiline999999999999999999999999999999' },
  { sha: 'emptymsg000000000000000000000000000000',
    commit: { message: '', author: { date: '2026-06-20T00:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/emptymsg000000000000000000000000000000' },
  { sha: 'v509sha0000000000000000000000000000000',
    commit: { message: 'v5.0.9 — mempool tuning', author: { date: '2026-06-10T00:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/v509sha0000000000000000000000000000000' },
  { sha: 'v510sha1111111111111111111111111111111',
    commit: { message: 'v5.1.0 — research lab sync', author: { date: '2026-06-07T00:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/v510sha1111111111111111111111111111111' },
  { sha: 'v508sha2222222222222222222222222222222',
    commit: { message: 'v5.0.8 — minor fixes', author: { date: '2026-06-01T00:00:00Z' } },
    html_url: 'https://github.com/aqua-019/satoshis-vision-v1/commit/v508sha2222222222222222222222222222222' },
];

/* 8 of the 13 fixture commits match; 5 unique versions
   (v6.0.2, v9.9.9, v5.0.9, v5.1.0, v5.0.8) — well under the default cap
   of 12, so every unique version survives. */
const mappedCommits = mapCommits(commitsFixture);
ok(mappedCommits.length === 5, 'mapCommits collapses the fixture to 5 unique-version items under the default cap');

const v602 = mappedCommits.find((i) => i.v === 'v6.0.2');
ok(!!v602, 'mapCommits produces an item for v6.0.2');
ok(v602?.also === 3, 'mapCommits folds the 3 duplicate v6.0.2 commits into also === 3 on the kept item');
ok(v602?.sha === '7e668de1111111111111111111111111111111',
  'mapCommits keeps the newest of the 4 duplicate v6.0.2 commits (7e668de), not a later one');
ok(v602?.note === 'type pass: monero tabs, education, layout',
  'mapCommits keeps the note from the newest v6.0.2 commit, not a duplicate\'s');
ok(v602?.date === '2026-07-30', 'mapCommits derives date as YYYY-MM-DD from commit.author.date');
ok(v602?.url === 'https://github.com/aqua-019/satoshis-vision-v1/commit/7e668de1111111111111111111111111111111',
  'mapCommits maps commit.html_url -> url');

const multilineItem = mappedCommits.find((i) => i.v === 'v9.9.9');
ok(multilineItem?.note === 'multiline note first line',
  'mapCommits reads only the first line of a multi-line commit message');
ok(!mappedCommits.some((i) => i.v === 'v1.2.3'),
  'mapCommits does not pick up a version mentioned on a later line of the message body');

/* Order preservation: v5.1.0 is chronologically between v5.0.9 and v5.0.8
   in the fixture (as it is in real history) — mapCommits must never sort,
   so that relative order must survive verbatim. */
const idx509 = mappedCommits.findIndex((i) => i.v === 'v5.0.9');
const idx510 = mappedCommits.findIndex((i) => i.v === 'v5.1.0');
const idx508 = mappedCommits.findIndex((i) => i.v === 'v5.0.8');
ok(idx509 >= 0 && idx510 >= 0 && idx508 >= 0 && idx509 < idx510 && idx510 < idx508,
  'mapCommits preserves GitHub order — v5.1.0 stays between v5.0.9 and v5.0.8, no semver sort');

/* Cap: with cap=2, only the first 2 *unique* versions are kept as items,
   but scanning continues so a later duplicate of an already-kept version
   (v6.0.2) is still folded into also — not silently lost at the cap edge. */
const capped = mapCommits(commitsFixture, 2);
ok(capped.length === 2, 'mapCommits respects a cap of 2 (2 unique-version items, not 2 input rows)');
ok(capped.find((i) => i.v === 'v6.0.2')?.also === 3,
  'mapCommits still folds duplicates of an already-kept version after the cap is reached');
ok(!capped.some((i) => i.v === 'v5.0.9'),
  'mapCommits does not add a 3rd unique version once the cap of 2 is reached');

/* Non-matching input. */
const nonMatching = commitsFixture.filter((c) => parseCommitVersion(String(c.commit.message).split('\n', 1)[0].trim()) === null);
ok(nonMatching.length === 5, 'sanity: fixture has exactly 5 non-matching commits (merge/chore/fix/hotfix/empty)');
ok(mapCommits(nonMatching).length === 0, 'mapCommits on an all-non-matching input returns []');
ok(mapCommits([]).length === 0, 'mapCommits([]) returns []');
ok(mapCommits(null).length === 0, 'mapCommits(null) returns [] (defensive, does not throw)');

/* ── the site's own repo, and why it is now allowlisted ───────────────
   This block used to assert the OPPOSITE — that GH_ALLOWED must not contain
   this site's own repo — on the reasoning that src=commits accepts no
   caller-supplied repo param and therefore needs no allowlist entry. That
   reasoning still holds for src=commits, and is asserted below. What changed
   in v6.1.1 is that a DIFFERENT caller appeared: src=ghrepo does take a
   caller-supplied repo, and the Future tab's "This site" pulse row asks for
   this repo by name. The entry exists for that caller alone. */
ok(SELF_REPO === 'aqua-019/satoshis-vision-v1', 'SELF_REPO is this site\'s repo');
ok(GH_ALLOWED.filter((r) => r === SELF_REPO).length === 1,
  'SELF_REPO appears exactly once in GH_ALLOWED — reachable via src=ghrepo, listed once');
ok(canonicalRepo(SELF_REPO) === SELF_REPO, 'src=ghrepo can resolve this site\'s own repo');
/* The invariant the old assertion was really protecting: src=commits reads
   SELF_REPO directly and never consults the allowlist, so allowlisting the
   repo cannot widen what src=commits will serve. */
ok(!/GH_ALLOWED/.test(
  readFileSync(new URL('./feeds.js', import.meta.url), 'utf8')
    .split('if (src === "commits")')[1].split('if (src ===')[0]),
  'the src=commits branch never consults GH_ALLOWED');

if (failed > 0) {
  console.log(`\n${failed} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed ✅');
