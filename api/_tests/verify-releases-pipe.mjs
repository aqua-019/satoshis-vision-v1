/* verify-releases-pipe.mjs — offline unit gate for the release ledger pipe:
   api/_releases-core.js, api/releases.js and api/cron/releases.js.
   Run: node api/_tests/verify-releases-pipe.mjs

   ── WHY THIS IS A TWIN AND NOT A SECTION OF verify-feeds.mjs ─────────────
   The brief allowed either. A twin is correct because `verify-feeds.mjs`'s
   subject is `api/feeds.js`, and this file's subject is three different
   modules that deliberately do NOT import it. Folding these assertions into
   that gate would give it a name that no longer states what it runs — the
   defect CLAUDE.md records against ci.yml's old e2e step title ("A STEP OR
   SUITE NAME MUST NAME WHAT IT RUNS"), reproduced inside a gate file.

   ── WHAT THIS GATE IS FOR ────────────────────────────────────────────────
   The pipe exists because production served an /api/feeds whose behaviour no
   commit in this repo can produce, and NOTHING COULD SEE IT: the client never
   checked that the answer matched the question. So the load-bearing
   assertions here are not about data shaping — they are about the two echoes
   (`rev`, `source`) surviving on EVERY branch, including the unhappy ones,
   because an error envelope that drops them is exactly as undiagnosable as
   the state that caused all this.

   No network. Every upstream and every store call is stubbed by replacing
   globalThis.fetch, and section 9 proves the stub is actually in force rather
   than assuming it. */

import { createRequire } from 'module';
import { makeReporter } from '../../app/verify-reporter.mjs';

const require = createRequire(import.meta.url);
const core = require('../_releases-core.js');
const releases = require('../releases.js');
const cron = require('../cron/releases.js');
const feeds = require('../feeds.js');

const R = makeReporter('verify-releases-pipe');

/* ── harness ───────────────────────────────────────────────────────── */

/** Minimal (req,res) pair. `res.end` captures the body; headers are recorded
 *  case-insensitively because the assertions read them by name. */
function mkRes() {
  const rec = { statusCode: 200, headers: {}, body: '' };
  return {
    rec,
    setHeader(k, v) { rec.headers[String(k).toLowerCase()] = v; },
    get statusCode() { return rec.statusCode; },
    set statusCode(v) { rec.statusCode = v; },
    end(b) { rec.body = b == null ? '' : String(b); return rec; },
  };
}

async function callReleases(query = {}) {
  const res = mkRes();
  await releases({ query, headers: {} }, res);
  let json = null;
  try { json = JSON.parse(res.rec.body); } catch { /* leave null — asserted */ }
  return { ...res.rec, json };
}

async function callCron(headers = {}) {
  const res = mkRes();
  await cron({ query: {}, headers }, res);
  let json = null;
  try { json = JSON.parse(res.rec.body); } catch { /* leave null */ }
  return { ...res.rec, json };
}

const realFetch = globalThis.fetch;
let fetchCalls = [];
/** Replace fetch with a router over [urlSubstring, responder] pairs. Any URL
 *  the router does not know THROWS — an unstubbed call must fail loudly rather
 *  than silently reaching the network from a gate that claims to be offline. */
function stubFetch(routes) {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    fetchCalls.push(u);
    for (const [needle, responder] of routes) {
      if (u.includes(needle)) return responder(u, init);
    }
    throw new Error('UNSTUBBED FETCH: ' + u);
  };
}
function restoreFetch() { globalThis.fetch = realFetch; }
function jsonRes(obj, ok = true, status = 200) {
  return { ok, status, json: async () => obj };
}

/* ── fixtures ──────────────────────────────────────────────────────── */

/* Mirrors the real GitHub pulls LIST shape, including the `merged: false`
   lie this repo measured on genuinely-merged PRs. */
const PULLS_FIXTURE = [
  { number: 190, title: 'p4·02 the mobile foundation', merged: false, merged_at: '2026-08-17T10:00:00Z', html_url: 'https://github.com/x/y/pull/190', body: 'Body one.' },
  { number: 188, title: 'p4·01 the hygiene close',     merged: false, merged_at: '2026-08-16T10:00:00Z', html_url: 'https://github.com/x/y/pull/188', body: '' },
  { number: 999, title: 'still open',                  merged: false, merged_at: null,                   html_url: 'https://github.com/x/y/pull/999', body: 'nope' },
  { number: 187, title: '',                            merged: true,  merged_at: '2026-08-15T10:00:00Z', html_url: 'https://github.com/x/y/pull/187', body: 'titleless' },
  /* Merged EARLIER but updated LATER — upstream sorts by `updated`, so this
     arrives before #190 and must be re-sorted below it. */
  { number: 150, title: 'an old PR edited yesterday',  merged: false, merged_at: '2026-01-01T10:00:00Z', html_url: 'https://github.com/x/y/pull/150', body: 'old' },
];

const COMMITS_FIXTURE = [
  { sha: 'aaaaaaaaaaaa1', html_url: 'u1', parents: [{ sha: 'p' }],               commit: { message: 'feat(x): a real commit\n\nbody', author: { date: '2026-08-17T10:00:00Z' } } },
  { sha: 'bbbbbbbbbbbb2', html_url: 'u2', parents: [{ sha: 'p' }, { sha: 'q' }], commit: { message: 'Merge pull request #190 from aqua-019/claude/x', author: { date: '2026-08-17T09:00:00Z' } } },
  { sha: 'cccccccccccc3', html_url: 'u3', parents: [{ sha: 'p' }],               commit: { message: 'v6.1.9 — a versioned one', author: { date: '2026-08-16T10:00:00Z' } } },
  { sha: 'dddddddddddd4', html_url: 'u4', parents: [{ sha: 'p' }],               commit: { message: '   ', author: { date: '2026-08-15T10:00:00Z' } } },
  { sha: 'eeeeeeeeeeee5', html_url: 'u5', parents: [{ sha: 'p' }],               commit: { message: 'Merge branches by hand — not a merge commit', author: { date: '2026-08-14T10:00:00Z' } } },
];

/* ══ 1 · the two echoes survive on every branch ═══════════════════════ */
R.group('1 · rev + source echo — the detectability mechanism');
{
  /* The happy path. */
  stubFetch([['/get/', () => jsonRes({ result: JSON.stringify({ polledAt: '2026-08-17T12:00:00Z', pulls: [{ v: '#190', note: 'n', date: '2026-08-17', url: 'u', body: 'b', bodyTruncated: false }], commits: [] }) })]]);
  process.env.KV_REST_API_URL = 'https://stub.upstash.io';
  process.env.KV_REST_API_TOKEN = 'stub-token';

  const live = await callReleases({ src: 'ledger' });
  R.ok(live.json?.rev === core.REV, `live envelope carries rev (${live.json?.rev})`);
  R.ok(live.json?.source === 'ledger', `live envelope echoes source=ledger (got ${live.json?.source})`);
  R.ok(live.json?.store === 'live', `live envelope reports store=live (got ${live.json?.store})`);
  R.ok(live.json?.polledAt === '2026-08-17T12:00:00Z', 'live envelope surfaces the stored polledAt');
  R.ok(live.json?.counts?.pulls === 1, `counts.pulls reflects the payload (${live.json?.counts?.pulls})`);

  /* THE LOAD-BEARING HALF: the unhappy branches must not drop the echoes.
     Each is asserted separately because they are produced by different code
     paths — a single "some error branch keeps rev" would pass while another
     dropped it. */
  stubFetch([['/get/', () => jsonRes({ result: null })]]);
  const empty = await callReleases({ src: 'ledger' });
  R.ok(empty.json?.rev === core.REV, 'EMPTY store: envelope still carries rev');
  R.ok(empty.json?.source === 'ledger', 'EMPTY store: envelope still echoes source');
  R.ok(empty.json?.store === 'empty', `EMPTY store: named state is "empty" (got ${empty.json?.store})`);
  R.ok(empty.statusCode === 200, `EMPTY store answers 200, not 5xx (got ${empty.statusCode})`);
  R.ok(/cron/.test(empty.json?.note || ''), 'EMPTY store names the operator action (the cron has not written)');

  stubFetch([['/get/', () => jsonRes({}, false, 500)]]);
  const err = await callReleases({ src: 'ledger' });
  R.ok(err.json?.rev === core.REV, 'store ERROR: envelope still carries rev');
  R.ok(err.json?.source === 'ledger', 'store ERROR: envelope still echoes source');
  R.ok(err.json?.store === 'error', `store ERROR: named state is "error" (got ${err.json?.store})`);

  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.KV_REST_API_READ_ONLY_TOKEN;
  const unconf = await callReleases({ src: 'ledger' });
  R.ok(unconf.json?.rev === core.REV, 'UNCONFIGURED: envelope still carries rev');
  R.ok(unconf.json?.store === 'unconfigured', `UNCONFIGURED: named state (got ${unconf.json?.store})`);
  R.ok(/KV_REST_API/.test(unconf.json?.note || ''), 'UNCONFIGURED: note names the missing env vars');

  /* The four store states must be MUTUALLY DISTINCT, or the client cannot act
     on them differently — the same reasoning verify-nodes applies to its four
     reason codes. */
  const states = [live.json?.store, empty.json?.store, err.json?.store, unconf.json?.store];
  R.ok(new Set(states).size === 4, `the four store states are mutually distinct (${states.join(', ')})`);
  restoreFetch();
}

/* ══ 2 · the unknown-src 400 is still diagnosable ═════════════════════ */
R.group('2 · unknown src');
{
  const bad = await callReleases({ src: 'getmonero' });
  R.ok(bad.statusCode === 400, `unknown src is a 400 (got ${bad.statusCode})`);
  R.ok(bad.json?.rev === core.REV, '400 still carries rev — a refusal must say which revision refused');
  R.ok(bad.json?.source === 'getmonero', `400 echoes the REQUESTED src, not the served one (got ${bad.json?.source})`);
  R.ok(Array.isArray(bad.json?.allowed) && bad.json.allowed.includes('ledger'), '400 names what is allowed');

  /* The default. A caller that sends no src at all gets the ledger, so the
     client's omission cannot be mistaken for a cross-served answer. */
  process.env.KV_REST_API_URL = 'https://stub.upstash.io';
  process.env.KV_REST_API_TOKEN = 'stub-token';
  stubFetch([['/get/', () => jsonRes({ result: null })]]);
  const dflt = await callReleases({});
  R.ok(dflt.statusCode === 200 && dflt.json?.source === 'ledger', 'no src defaults to ledger and answers 200');
  restoreFetch();
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

/* ══ 3 · the Cache-Control literals ══════════════════════════════════ */
R.group('3 · cache headers — a silent TTL change is a red');
{
  process.env.KV_REST_API_URL = 'https://stub.upstash.io';
  process.env.KV_REST_API_TOKEN = 'stub-token';
  stubFetch([['/get/', () => jsonRes({ result: JSON.stringify({ polledAt: 'x', pulls: [], commits: [] }) })]]);
  const good = await callReleases({ src: 'ledger' });
  R.ok(good.headers['cache-control'] === 's-maxage=300',
    `a good answer caches at s-maxage=300 (got ${good.headers['cache-control']})`);
  R.ok(!/stale-while-revalidate/.test(good.headers['cache-control'] || ''),
    'no stale-while-revalidate — the polledAt freshness claim must be true when read');

  stubFetch([['/get/', () => jsonRes({ result: null })]]);
  const degraded = await callReleases({ src: 'ledger' });
  R.ok(degraded.headers['cache-control'] === 's-maxage=30',
    `a DEGRADED answer caches shorter (got ${degraded.headers['cache-control']})`);
  /* The relation, not just the two literals: a degraded payload cached as long
     as a good one outlives the operator's fix on every edge. */
  const g = Number(/(\d+)/.exec(good.headers['cache-control'])[1]);
  const d = Number(/(\d+)/.exec(degraded.headers['cache-control'])[1]);
  R.ok(d < g, `degraded TTL is strictly shorter than the good one (${d} < ${g})`);
  restoreFetch();
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

/* ══ 4 · mapPulls ════════════════════════════════════════════════════ */
R.group('4 · mapPulls — merged_at, bodies, order');
{
  const out = core.mapPulls(PULLS_FIXTURE, 10, 2000);
  R.ok(out.length === 3, `keeps only merged, titled PRs (${out.length}: ${out.map((r) => r.v).join(',')})`);
  R.ok(!out.some((r) => r.v === '#999'), 'drops the un-merged PR (#999)');
  R.ok(!out.some((r) => r.v === '#187'), 'drops the titleless PR (#187)');

  /* THE MEASURED LIE, asserted CONSTRUCTIVELY rather than by describing the
     fixture. GitHub's pulls LIST endpoint reports `merged: false` on PRs that
     are demonstrably merged; keying on it returns an honest-LOOKING empty from
     a wrong predicate, which is worse than a loud failure. So: run the wrong
     predicate over the same fixture and show it recovers strictly fewer rows.
     (An earlier version of this assertion claimed "every fixture row says
     merged:false" — false of row #187, which is `merged: true`. It went red
     against correct code because the ASSERTION was wrong, not the transform.) */
  const wrongPredicate = PULLS_FIXTURE.filter((p) => p.merged === true).length;
  R.ok(out.length > wrongPredicate,
    `keyed on merged_at, NOT merged — merged_at recovers ${out.length} rows where \`merged\` recovers ${wrongPredicate}`);
  R.ok(out.every((r) => {
    const src = PULLS_FIXTURE.find((p) => '#' + p.number === r.v);
    return src && src.merged === false;
  }), 'and every row it recovered is one the `merged` flag would have discarded');

  R.ok(out[0].v === '#190' && out[out.length - 1].v === '#150',
    `sorted by MERGE date desc, not upstream "updated" order (${out.map((r) => r.v).join(' > ')})`);
  R.ok(out[0].body === 'Body one.', 'captures the PR body as the summary');
  R.ok(out[0].bodyTruncated === false, 'a short body is not flagged truncated');
  const empty188 = out.find((r) => r.v === '#188');
  R.ok(empty188 && empty188.body === '' && empty188.bodyTruncated === false,
    'an empty body is empty and honest, never a placeholder');
}

/* ══ 5 · normalizeBody ═══════════════════════════════════════════════ */
R.group('5 · normalizeBody — the cap is a stated fact');
{
  const long = 'w '.repeat(3000);
  const n = core.normalizeBody(long, 2000);
  R.ok(n.truncated === true, 'a body over the cap reports truncated:true');
  R.ok(n.body.length <= 2000, `truncated body respects the cap (${n.body.length} <= 2000)`);
  R.ok(n.body.length > 2000 * 0.8, `word-boundary cut does not overshoot the budget (${n.body.length} > 1600)`);

  /* A body with no whitespace near the limit must still reach ~the cap — the
     0.8 floor exists so a URL or base64 blob is not cut far shorter than the
     envelope advertises. */
  const nospace = 'x'.repeat(3000);
  const n2 = core.normalizeBody(nospace, 2000);
  R.ok(n2.body.length === 2000, `a body with no spaces cuts exactly at the cap (${n2.body.length})`);

  R.ok(core.normalizeBody('', 2000).body === '' && core.normalizeBody('', 2000).truncated === false,
    'an absent body is absent, not truncated');
  R.ok(core.normalizeBody('   \n\n  ', 2000).body === '', 'a whitespace-only body normalizes to absent');
  R.ok(core.normalizeBody('a\r\nb', 2000).body === 'a\nb', 'CRLF normalizes to LF so the budget means one thing');
  R.ok(core.normalizeBody('Tom &amp; Jerry &lt;3', 2000).body === 'Tom & Jerry <3', 'entities are decoded');
}

/* ══ 6 · mapAllCommits ═══════════════════════════════════════════════ */
R.group('6 · mapAllCommits — the work log, not a version filter');
{
  const out = core.mapAllCommits(COMMITS_FIXTURE, 50);
  R.ok(out.length === 3, `keeps every non-merge commit with a subject (${out.length})`);
  R.ok(!out.some((c) => c.sha === 'bbbbbbbbbbbb2'), 'drops the merge commit (2 parents)');
  R.ok(out.some((c) => c.note.startsWith('Merge branches by hand')),
    'keeps a 1-parent commit whose subject merely STARTS with "Merge" — parent count, not string match');
  R.ok(!out.some((c) => c.sha === 'dddddddddddd4'), 'drops the whitespace-only subject');
  R.ok(out[0].short === 'aaaaaaa' && out[0].short.length === 7, `short sha is 7 chars (${out[0].short})`);
  R.ok(out.some((c) => c.note === 'v6.1.9 — a versioned one'),
    'a versioned subject is kept as an ordinary work-log line, not specially parsed');

  /* THE CORRECTION THIS GATE EXISTS TO PIN. mapCommits is a version-stamp
     FILTER; on this repo it returns nothing, which is why tier 2 could not be
     built on it. Both facts asserted against ONE fixture so they cannot drift
     apart. */
  const versioned = core.mapCommits(COMMITS_FIXTURE, 50);
  R.ok(versioned.length === 1, `mapCommits keeps ONLY version-stamped subjects (${versioned.length} of 5)`);
  R.ok(core.mapAllCommits(COMMITS_FIXTURE, 50).length > versioned.length,
    'mapAllCommits is strictly wider than mapCommits — the reason tier 2 does not use the latter');
}

/* ══ 7 · parity with feeds.js — the duplication is gated ══════════════ */
R.group('7 · parity — this module does not import feeds.js, so prove they agree');
{
  /* _releases-core.js deliberately does NOT require feeds.js (the quarantine;
     see that file's header). That is only safe if the copies cannot drift, so
     the drift is asserted rather than hoped for. */
  const mine = core.mapCommits(COMMITS_FIXTURE, 50);
  const theirs = feeds.mapCommits(COMMITS_FIXTURE, 50);
  R.ok(JSON.stringify(mine) === JSON.stringify(theirs),
    `mapCommits is byte-identical to feeds.js's (${mine.length} items)`);

  const minePulls = core.mapPulls(PULLS_FIXTURE, 10, 2000);
  const theirPulls = feeds.mapPulls(PULLS_FIXTURE, 10);
  /* feeds.js does not sort and does not carry a body, so compare the SHARED
     fields over the SHARED set, order-independently. */
  const key = (r) => [r.v, r.note, r.date, r.url].join('|');
  const mineSet = new Set(minePulls.map(key));
  const theirSet = new Set(theirPulls.map(key));
  R.ok(mineSet.size === theirSet.size && [...theirSet].every((k) => mineSet.has(k)),
    `mapPulls agrees with feeds.js on every shared field (${mineSet.size} rows)`);
  R.ok(minePulls.every((r) => 'body' in r && 'bodyTruncated' in r),
    'and adds exactly the two fields the ledger needs');
  R.ok(theirPulls.every((r) => !('body' in r)),
    'feeds.js is UNTOUCHED — it still carries no body field');

  /* Version parsing agrees, asserted over INPUTS rather than by comparing
     regex text. (An earlier line here read `R.ok(a === b ? true : true, …)`,
     which is `R.ok(true)` however the comparison lands — an assertion that
     could not fail, in the section whose whole job is catching drift.) */
  const probes = ['v6.1.9 — a note', 'v1.2.3 - dash', 'Merge pull request #1 from x', 'fix(x): not a version', 'v6.1.9'];
  const mineParse = probes.map((s) => JSON.stringify(core.parseCommitVersion(s)));
  const theirParse = probes.map((s) => JSON.stringify(feeds.parseCommitVersion(s)));
  R.ok(mineParse.join('|') === theirParse.join('|'),
    `parseCommitVersion agrees with feeds.js on ${probes.length} probes including 2 non-matches`);
  R.ok(mineParse.filter((r) => r !== 'null').length === 2,
    'and the probe set is discriminating — 2 of 5 parse, so agreement is not agreement-on-nothing');
}

/* ══ 8 · the cron guard ══════════════════════════════════════════════ */
R.group('8 · cron auth — it protects GitHub quota, and it fails closed');
{
  const saved = process.env.CRON_SECRET;

  delete process.env.CRON_SECRET;
  const noSecret = await callCron({ authorization: 'Bearer anything' });
  R.ok(noSecret.statusCode === 401, `with CRON_SECRET unset the handler refuses everything (${noSecret.statusCode})`);
  R.ok(/CRON_SECRET/.test(noSecret.json?.error || ''), 'and says which variable is missing');

  process.env.CRON_SECRET = 's3cret';
  const noAuth = await callCron({});
  R.ok(noAuth.statusCode === 401, `no Authorization header is refused (${noAuth.statusCode})`);
  const wrong = await callCron({ authorization: 'Bearer wrong' });
  R.ok(wrong.statusCode === 401, `a wrong bearer is refused (${wrong.statusCode})`);
  const bare = await callCron({ authorization: 's3cret' });
  R.ok(bare.statusCode === 401, 'the secret without the "Bearer " prefix is refused');

  /* POSITIVE CONTROL. Without it, "401 on every bad input" is satisfied just as
     well by a handler that 401s unconditionally — the guard would be
     unfalsifiable and this whole section would prove nothing. */
  fetchCalls = [];
  stubFetch([
    ['/pulls?', () => jsonRes(PULLS_FIXTURE)],
    ['/commits?', () => jsonRes(COMMITS_FIXTURE)],
    ['/set/', () => jsonRes({ result: 'OK' })],
  ]);
  process.env.KV_REST_API_URL = 'https://stub.upstash.io';
  process.env.KV_REST_API_TOKEN = 'stub-token';
  const good = await callCron({ authorization: 'Bearer s3cret' });
  R.ok(good.statusCode === 200, `the CORRECT bearer is accepted (${good.statusCode}) — the guard is falsifiable`);
  R.ok(good.json?.ok === true && good.json?.counts?.pulls === 3, `and it writes a ledger (${JSON.stringify(good.json?.counts)})`);
  R.ok(typeof good.json?.polledAt === 'string', 'the run stamps polledAt');

  /* Rate-limit arithmetic, asserted rather than only claimed in a comment: one
     run must cost at most 4 GitHub calls, which is what makes the 10-minute
     cadence fit inside 60/hour. */
  const ghCalls = fetchCalls.filter((u) => u.includes('api.github.com')).length;
  R.ok(ghCalls <= 4, `one poll costs <= 4 GitHub calls (measured ${ghCalls}) — 6 runs/hr = ${ghCalls * 6}/hr vs the 60/hr ceiling`);

  restoreFetch();
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
}

/* ══ 9 · partial failure carries a tier forward ═══════════════════════ */
R.group('9 · partial upstream failure must not blank a tier');
{
  process.env.CRON_SECRET = 's3cret';
  process.env.KV_REST_API_URL = 'https://stub.upstash.io';
  process.env.KV_REST_API_TOKEN = 'stub-token';

  let written = null;
  stubFetch([
    ['/pulls?', () => jsonRes(PULLS_FIXTURE)],
    ['/commits?', () => { throw new Error('github commits HTTP 503'); }],
    ['/get/', () => jsonRes({ result: JSON.stringify({ polledAt: 'old', pulls: [], commits: [{ sha: 'kept', short: 'kept', note: 'previously stored', date: '2026-08-01', url: 'u' }] }) })],
    ['/set/', (_u, init) => { written = JSON.parse(init.body); return jsonRes({ result: 'OK' }); }],
  ]);

  const partial = await callCron({ authorization: 'Bearer s3cret' });
  R.ok(partial.statusCode === 200, `a partial failure still writes (${partial.statusCode})`);
  R.ok(written && written.pulls.length === 3, 'the tier that SUCCEEDED is written fresh');
  R.ok(written && written.commits.length === 1 && written.commits[0].sha === 'kept',
    'the tier that FAILED is carried forward from the store, never blanked');
  R.ok(Array.isArray(partial.json?.carriedForward) && partial.json.carriedForward.includes('commits'),
    'and the response says which tier was carried');

  /* Total failure writes NOTHING — the previous blob keeps serving. */
  written = null;
  stubFetch([
    ['/pulls?', () => { throw new Error('github pulls HTTP 503'); }],
    ['/commits?', () => { throw new Error('github commits HTTP 503'); }],
    ['/set/', (_u, init) => { written = JSON.parse(init.body); return jsonRes({ result: 'OK' }); }],
  ]);
  const dead = await callCron({ authorization: 'Bearer s3cret' });
  R.ok(dead.statusCode === 500, `a total failure reports 500 (${dead.statusCode})`);
  R.ok(written === null, 'and writes NOTHING — last-good survives, never overwritten with empty');

  restoreFetch();
  delete process.env.CRON_SECRET;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

/* ══ 10 · the serving path makes no upstream call ═════════════════════ */
R.group('10 · /api/releases never talks to GitHub');
{
  process.env.KV_REST_API_URL = 'https://stub.upstash.io';
  process.env.KV_REST_API_TOKEN = 'stub-token';
  fetchCalls = [];
  stubFetch([['/get/', () => jsonRes({ result: JSON.stringify({ polledAt: 'x', pulls: [], commits: [] }) })]]);
  await callReleases({ src: 'ledger' });
  const gh = fetchCalls.filter((u) => u.includes('api.github.com'));
  R.ok(gh.length === 0, `the request path made 0 GitHub calls (${fetchCalls.length} total, all store)`);
  R.ok(fetchCalls.length === 1, `exactly one store read per request (${fetchCalls.length})`);

  /* NON-VACUITY: prove the stub is in force. If globalThis.fetch had not been
     replaced, every assertion above would be measuring the real network — or
     nothing at all — and this section's zero would be meaningless. */
  R.ok(fetchCalls.length > 0, 'the fetch stub is actually in force (it recorded calls)');
  restoreFetch();
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

/* ══ 11 · rev is a real, recognisable constant ════════════════════════ */
R.group('11 · rev');
{
  R.ok(Number.isInteger(core.REV) && core.REV >= 1, `REV is a positive integer (${core.REV})`);
  R.ok(core.SOURCE === 'ledger', `SOURCE is the served src (${core.SOURCE})`);
  R.ok(core.STORE_KEY.includes(':v'), `the store key is versioned (${core.STORE_KEY})`);
  R.ok(core.BODY_CAP === 2000, `BODY_CAP is the advertised cap (${core.BODY_CAP})`);
}

process.exit(R.finish());
