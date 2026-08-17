/**
 * api/_releases-core.js — the release ledger's pure core: transforms, the
 * envelope shape, and the store client. Shared by the two functions that make
 * up the pipe (`api/releases.js` serves, `api/cron/releases.js` polls) and by
 * the offline gate (`api/_tests/verify-releases-pipe.mjs`).
 *
 * UNDERSCORE-PREFIXED ON PURPOSE. Vercel does not build `api/_*` into
 * serverless functions, so this module is importable by the two real functions
 * without itself becoming a publicly invocable endpoint. `api/_nodes.js` and
 * `api/_fixtures/` are the precedent already in this directory.
 *
 * CommonJS, like `api/xmr.js`, `api/feeds.js` and `api/_nodes.js`. This
 * directory is MIXED (`coingecko.js` and `markets.js` are ESM) and mixing has
 * bitten this project before — the rule recorded in CLAUDE.md is to match the
 * file you are editing, and a module that must be `require`d by two CommonJS
 * handlers has to be CommonJS.
 *
 * ── WHY THIS DUPLICATES TRANSFORMS THAT ALREADY EXIST IN feeds.js ────────
 * `api/feeds.js` already has `mapPulls` and `mapCommits`, and they are already
 * unit-gated. Requiring them from here would be the obvious move and it is
 * DELIBERATELY NOT TAKEN.
 *
 * The reason is the whole premise of this pipe. Production serves an
 * `/api/feeds` whose behaviour no commit in this repo can produce: it honours
 * `n`, does not know `src` at all, and answers every source as `getmonero` —
 * including for `src` values that postdate the file's own first commit. That
 * survived a cache-unticked redeploy whose build log shows a clean full build
 * of the correct commit. The cause was never found on the repo side, so the
 * ledger ships at a NEW route on a NEW file, and a new path can only stay
 * uncontaminated if it does not import the contaminated one. The quarantine is
 * of the deployment artifact, not of the source text — but an import edge is
 * exactly the thing that could carry an artifact across, and the cost of
 * refusing it is ~60 lines.
 *
 * DRIFT IS NOT LEFT TO HOPE. `verify-releases-pipe.mjs` asserts that this
 * module's `mapCommits` and `feeds.js`'s `mapCommits` produce IDENTICAL output
 * from the same fixture, and that this module's `mapPulls` agrees with
 * `feeds.js`'s on every field they share. So the duplication is a gated
 * invariant rather than two copies quietly diverging.
 *
 * ── TIER 2 IS `mapAllCommits`, NOT `mapCommits`, AND THAT IS A CORRECTION ─
 * The brief said to reactivate `src=commits`' serving path because
 * `getSelfCommits` + `mapCommits` "exist and are unit-gated". They do, and
 * reusing them would have shipped an EMPTY tier 2.
 *
 * `mapCommits` is not a commit lister — it is a VERSION-STAMP FILTER. It keeps
 * only subjects matching `^vX.Y.Z — note`, which is the convention this repo
 * abandoned after v6.1.9. Measured on this tree at `543a8d8`: ZERO of the last
 * 80 commit subjects parse, and `git tag` is empty. That is precisely why the
 * path was marked dormant in the first place.
 *
 * The operator asked for "every commit". So tier 2 uses `mapAllCommits`, which
 * filters nothing and keeps merge commits out only because they are noise the
 * PR spine above already states better. `mapCommits` is still carried here,
 * unchanged, because the parity assertion against feeds.js needs it and
 * because the version convention may one day return.
 */

/** Envelope revision. HAND-BUMPED, and the whole point of this constant is
 *  that it is not derived: it is echoed in every response so an operator can
 *  ask a deployment which build of this file answered them. A deployment
 *  serving a stale artifact reports a stale `rev`, which is the one signal
 *  that separates "the feed is empty" from "the feed is not the code". Bump
 *  it whenever the envelope's SHAPE changes. */
const REV = 1;

/** This site's own repo. A fixed module constant, never caller-supplied —
 *  this endpoint takes no `repo` param and must never become a GitHub proxy. */
const SELF_REPO = 'aqua-019/satoshis-vision-v1';

/** The one `src` this endpoint serves. Echoed back in `source` so a client can
 *  tell "answered my question" from "answered someone else's". */
const SOURCE = 'ledger';

/** Store key. Versioned: a payload SHAPE change orphans the old entry rather
 *  than serving it into a reader that expects new fields — the same rule
 *  `useCachedFeed`'s cache ids follow on the client. */
const STORE_KEY = 'xmri:ledger:v1';

/** PR bodies in this repo run long — several thousand characters is normal.
 *  Bounded SERVER-side so the cap is one number in one place and the client
 *  cannot be handed a payload it then has to trim (a client-side trim would
 *  mean the bytes were paid for and thrown away). Echoed in the envelope as
 *  `bodyCap` so the truncation is a stated fact, not a silent edit. */
const BODY_CAP = 2000;

/** How much history the store holds. Deliberately larger than any one render:
 *  the scroll region shows everything it is given, and re-polling is cheap
 *  while re-fetching deep history is not. */
const PULLS_CAP = 60;
const COMMITS_CAP = 150;

/** Backstop only — `getAllCommits` stops as soon as it has COMMITS_CAP. A
 *  pathological history must not be able to spin the function forever. */
const MAX_COMMIT_PAGES = 3;

/** GitHub rejects requests with no User-Agent. */
const GH_HEADERS = {
  'User-Agent': 'xmr.irish/6.0 (+https://xmr.irish)',
  Accept: 'application/vnd.github+json',
};

/* Matches `v6.0.2 — type pass: …`. Anchored at ^ on purpose: real
   non-matching subjects include "Merge pull request #125 from …" and version
   numbers mentioned mid-sentence. Carried from feeds.js so the parity
   assertion has something to compare. */
const VERSION_RX = /^(v\d+\.\d+\.\d+)\s*[—–-]\s*(.+)$/;

/* ── text helpers ──────────────────────────────────────────────────── */

/** The five XML/HTML entities. GitHub's JSON API returns real characters, so
 *  this is defensive rather than load-bearing — but PR titles in this repo
 *  contain `&`, `<` and quotes routinely, and a title that round-trips through
 *  any entity-encoding layer must not reach a reader as `&amp;`. */
function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Normalize a PR body to the stored form.
 *
 * Returns `{ body, truncated }` where `truncated` is a BOOLEAN FACT about this
 * particular body, not a formatting choice. The caller renders the marker; the
 * transform only reports. That split matters because the marker is user-facing
 * copy and this module has no business owning it — and because a gate can
 * assert the boolean without depending on a string.
 *
 * CRLF is normalized to LF so the character budget means the same thing
 * whatever the author's editor did, and trailing whitespace is dropped so a
 * body that is entirely blank lines reports as absent rather than as content.
 */
function normalizeBody(raw, cap = BODY_CAP) {
  const s = typeof raw === 'string' ? decodeEntities(raw).replace(/\r\n/g, '\n').trim() : '';
  if (!s) return { body: '', truncated: false };
  const limit = Number.isInteger(cap) && cap > 0 ? cap : BODY_CAP;
  if (s.length <= limit) return { body: s, truncated: false };
  /* Cut on a whitespace boundary when one is reasonably near the limit, so the
     body does not end mid-word. `lastIndexOf` over the already-cut slice, and
     only accepted if it keeps at least 80% of the budget — otherwise a body
     with no spaces in its last 400 chars (a URL, a base64 blob, a table row)
     would be cut far shorter than the cap the envelope advertises. */
  const cut = s.slice(0, limit);
  const sp = cut.lastIndexOf(' ');
  const body = sp > limit * 0.8 ? cut.slice(0, sp) : cut;
  return { body: body.replace(/\s+$/, ''), truncated: true };
}

/** First line of a commit message — the subject. */
function commitSubject(c) {
  return String(c?.commit?.message || '').split('\n', 1)[0].trim();
}

/** `v6.0.2 — note` → `{ v, note }`, else null. */
function parseCommitVersion(subject) {
  const m = VERSION_RX.exec(String(subject || '').trim());
  return m ? { v: m[1], note: m[2].trim() } : null;
}

/* ── tier 1 · the PR spine ─────────────────────────────────────────── */

/**
 * GitHub's closed-pulls list → the release spine.
 *
 * KEYED ON `merged_at`, NEVER ON `merged`. Measured against this repo and
 * recorded in feeds.js: the pulls LIST endpoint reports `"merged": false` on
 * PRs that are demonstrably merged and carry a real `merged_at`. A transform
 * keyed on `merged` returns [] against a perfectly healthy upstream — an
 * honest-LOOKING empty produced by a wrong predicate, which is worse than a
 * loud failure because nothing distinguishes it from "nothing has shipped".
 *
 * The one field this adds over feeds.js's `mapPulls` is `body` (+ its
 * `bodyTruncated` flag) — the head-to-toe summary the ledger renders. Every
 * other field is identical by construction, and the gate asserts it.
 */
function mapPulls(json, cap = PULLS_CAP, bodyCap = BODY_CAP) {
  const arr = Array.isArray(json) ? json : [];
  const limit = Number.isInteger(cap) && cap > 0 ? cap : PULLS_CAP;
  const items = [];
  const seen = new Set();

  for (const p of arr) {
    if (items.length >= limit) break;

    const mergedAt = typeof p?.merged_at === 'string' ? p.merged_at : '';
    if (!mergedAt) continue; // open, or closed without merging — shipped nothing

    const n = Number(p?.number);
    if (!Number.isInteger(n) || n <= 0) continue;

    const v = '#' + n;
    if (seen.has(v)) continue; // defensive — GitHub does not repeat numbers
    seen.add(v);

    const note = decodeEntities(String(p?.title || '')).trim();
    if (!note) continue; // a titleless release note is not a release note

    const { body, truncated } = normalizeBody(p?.body, bodyCap);

    items.push({
      v,
      note,
      date: mergedAt.slice(0, 10),
      url: typeof p?.html_url === 'string' ? p.html_url : '',
      body,
      bodyTruncated: truncated,
    });
  }

  /* Newest-merged first. The upstream is sorted by UPDATED, not by merge date,
     so a PR edited long after it shipped would otherwise jump the queue and
     the spine would not be chronological. Sorting here rather than trusting
     the query is the difference between "usually right" and "right". */
  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return items;
}

/* ── tier 2 · the commit work log ──────────────────────────────────── */

/**
 * Every commit, newest first — the work log beneath the PR spine.
 *
 * Merge commits are dropped, and that is the only filter. They carry no
 * information the tier above does not state better ("Merge pull request #190
 * from aqua-019/claude/prompt-attached-d9y8cj" is a slug, and #190's real
 * title is already the spine entry directly above it). Detected by PARENT
 * COUNT — a merge has two or more parents — which is a structural fact rather
 * than a string match on the subject, so a hand-written commit that happens to
 * start with the word "Merge" is kept.
 */
function mapAllCommits(json, cap = COMMITS_CAP) {
  const arr = Array.isArray(json) ? json : [];
  const limit = Number.isInteger(cap) && cap > 0 ? cap : COMMITS_CAP;
  const items = [];
  const seen = new Set();

  for (const c of arr) {
    if (items.length >= limit) break;

    const sha = typeof c?.sha === 'string' ? c.sha : '';
    if (!sha || seen.has(sha)) continue;

    const note = commitSubject(c);
    if (!note) continue; // an empty subject is not a work-log line

    if (Array.isArray(c?.parents) && c.parents.length > 1) continue; // merge

    seen.add(sha);
    items.push({
      sha,
      short: sha.slice(0, 7),
      note: decodeEntities(note),
      date: String(c?.commit?.author?.date || '').slice(0, 10),
      url: typeof c?.html_url === 'string' ? c.html_url : '',
    });
  }

  return items;
}

/**
 * The version-stamp filter, carried UNCHANGED from feeds.js.
 *
 * Returns [] on this repo today and has since July — see this file's header.
 * It is kept for two reasons: `verify-releases-pipe.mjs` asserts it agrees
 * byte-for-byte with feeds.js's copy, which is what makes the duplication in
 * this file a gated invariant instead of a fork; and it is the path that
 * lights up again if `vX.Y.Z — subject` stamps ever return.
 */
function mapCommits(json, cap = 12) {
  const arr = Array.isArray(json) ? json : [];
  const limit = Number.isInteger(cap) && cap > 0 ? cap : 12;
  const items = [];
  const byVersion = new Map();

  for (const c of arr) {
    const parsed = parseCommitVersion(commitSubject(c));
    if (!parsed) continue;

    const existing = byVersion.get(parsed.v);
    if (existing) {
      existing.also = (existing.also || 0) + 1;
      continue;
    }
    if (items.length >= limit) continue; // cap reached; keep scanning for dups

    const item = {
      v: parsed.v,
      note: parsed.note,
      date: String(c?.commit?.author?.date || '').slice(0, 10),
      sha: c?.sha || '',
      url: c?.html_url || '',
    };
    items.push(item);
    byVersion.set(parsed.v, item);
  }

  return items;
}

/* ── the envelope ──────────────────────────────────────────────────── */

/**
 * The one place the response shape is built, used by the serving function for
 * every outcome including the failures.
 *
 * `rev` and `source` are ALWAYS present, on every branch, including errors —
 * that is the entire detectability mechanism and it is worthless if the
 * unhappy paths drop it. A client that cannot read `rev` off a response is
 * looking at something that is not this function.
 *
 * `store` is a four-value discriminated state rather than a boolean, because
 * "the cron has never run" (empty), "the env vars are absent" (unconfigured)
 * and "the store answered badly" (error) are three different operator actions
 * and collapsing them into `ok: false` would throw away which one to take.
 */
function buildEnvelope({ store, polledAt = null, pulls = [], commits = [], note = null }) {
  return {
    rev: REV,
    source: SOURCE,
    repo: SELF_REPO,
    fetchedAt: new Date().toISOString(),
    polledAt,
    store,
    bodyCap: BODY_CAP,
    counts: { pulls: pulls.length, commits: commits.length },
    pulls,
    commits,
    ...(note ? { note } : {}),
  };
}

/* ── store client (Upstash Redis REST) ─────────────────────────────── */

/**
 * Plain `fetch` against the Upstash REST API — no SDK, deliberately.
 *
 * An SDK here would add a dependency to a repo that has none in `api/`, and
 * `@upstash/redis` ships as ESM, which would mean mixing module systems in a
 * directory where that has broken this project before. The REST surface is two
 * calls (`GET /get/<key>`, `POST /set/<key>`) and needs no client.
 *
 * READ uses the read-only token when one is present. That is not decoration:
 * the serving function is public and must not hold a credential that can write.
 */
function storeConfig(write) {
  const url = process.env.KV_REST_API_URL;
  const token = write
    ? process.env.KV_REST_API_TOKEN
    : process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

/** Read the ledger. Never throws — resolves to a discriminated result so the
 *  caller renders a state rather than a stack trace. */
async function storeRead(key = STORE_KEY, timeoutMs = 5000) {
  const cfg = storeConfig(false);
  if (!cfg) return { state: 'unconfigured', value: null };
  try {
    const r = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return { state: 'error', value: null, detail: `store HTTP ${r.status}` };
    const j = await r.json();
    /* Upstash answers `{"result": null}` for a key that does not exist. That is
       EMPTY (the cron has not run yet), not an error — a distinction the
       operator acts on differently, so it must survive to the envelope. */
    if (j?.result == null) return { state: 'empty', value: null };
    const parsed = typeof j.result === 'string' ? JSON.parse(j.result) : j.result;
    return { state: 'live', value: parsed };
  } catch (e) {
    return { state: 'error', value: null, detail: String(e?.message || e) };
  }
}

/** Write the ledger. Returns `{ ok, detail }`; never throws. */
async function storeWrite(value, key = STORE_KEY, timeoutMs = 8000) {
  const cfg = storeConfig(true);
  if (!cfg) return { ok: false, detail: 'KV_REST_API_URL / KV_REST_API_TOKEN not set' };
  try {
    const r = await fetch(`${cfg.url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return { ok: false, detail: `store HTTP ${r.status}` };
    return { ok: true, detail: null };
  } catch (e) {
    return { ok: false, detail: String(e?.message || e) };
  }
}

/* ── upstream (used by the cron only; the serving path never calls these) ── */

async function fetchSelfPulls(timeoutMs = 8000) {
  const r = await fetch(
    `https://api.github.com/repos/${SELF_REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=100`,
    { headers: GH_HEADERS, signal: AbortSignal.timeout(timeoutMs) },
  );
  if (!r.ok) throw new Error('github pulls HTTP ' + r.status);
  return r.json();
}

/** Pages until COMMITS_CAP is satisfied or the upstream is exhausted, whichever
 *  comes first — MAX_COMMIT_PAGES is only a backstop. */
async function fetchSelfCommits(cap = COMMITS_CAP, timeoutMs = 8000) {
  let all = [];
  for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
    const r = await fetch(
      `https://api.github.com/repos/${SELF_REPO}/commits?per_page=100&page=${page}`,
      { headers: GH_HEADERS, signal: AbortSignal.timeout(timeoutMs) },
    );
    if (!r.ok) throw new Error('github commits HTTP ' + r.status);
    const batch = await r.json();
    const batchArr = Array.isArray(batch) ? batch : [];
    all = all.concat(batchArr);
    if (mapAllCommits(all, cap).length >= cap) break;
    if (batchArr.length < 100) break; // upstream exhausted
  }
  return all;
}

module.exports = {
  REV,
  SELF_REPO,
  SOURCE,
  STORE_KEY,
  BODY_CAP,
  PULLS_CAP,
  COMMITS_CAP,
  MAX_COMMIT_PAGES,
  VERSION_RX,
  decodeEntities,
  normalizeBody,
  commitSubject,
  parseCommitVersion,
  mapPulls,
  mapAllCommits,
  mapCommits,
  buildEnvelope,
  storeRead,
  storeWrite,
  fetchSelfPulls,
  fetchSelfCommits,
};
