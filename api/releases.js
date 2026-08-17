/**
 * api/releases.js — `/api/releases`, the release ledger's serving path.
 *
 * Contract:
 *   GET /api/releases?src=ledger
 *     → { rev, source, repo, fetchedAt, polledAt, store, bodyCap, counts,
 *         pulls: [{ v, note, date, url, body, bodyTruncated }],
 *         commits: [{ sha, short, note, date, url }] }
 *
 * ── WHY THIS IS A NEW FILE AT A NEW ROUTE INSTEAD OF A BRANCH IN feeds.js ─
 * Production serves an `/api/feeds` that no commit in this repo can produce.
 * Probed 2026-08-17: it honours `n`, does not know `src` AT ALL — `mrl`,
 * `pulls` and bogus values all come back as `getmonero` — and reports a
 * second-old `fetchedAt`, so it is executing FRESH, not serving a stale cache.
 * That behaviour is older than feeds.js's own first commit, which was born
 * with `src` support. It survived a cache-unticked redeploy whose build log
 * shows a clean full build of the correct commit. No shadow files, no ignore
 * files, no deleted variants, no sibling-project domain claims.
 *
 * The cause was never found on the repo side, so the ledger does not ship on
 * that path. `api/feeds.js` is left untouched in-repo as the tombstone the
 * support ticket references; deleting it is the operator's later call.
 *
 * ── WHAT `rev` IS FOR, AND WHY IT IS HAND-BUMPED ─────────────────────────
 * The defect above was undetectable from the browser for weeks, because
 * nothing ever checked that the answer matched the question. Two echoes fix
 * that, and both are in EVERY response including the failures:
 *
 *   `source` — the `src` the caller asked for. A deployment answering a
 *              different source is now a named client state, not a silent
 *              empty list.
 *   `rev`    — a hand-bumped integer in `_releases-core.js`. Derived version
 *              identity (a git sha, a build stamp) would have been prettier
 *              and would have proved nothing here: the haunted deployment
 *              reports a perfectly fresh `fetchedAt`. What was missing is a
 *              value an OPERATOR controls and can recognise, so that
 *              "the deployment is not running this code" becomes a question
 *              with a one-request answer.
 *
 * ── THE REQUEST PATH MAKES NO UPSTREAM CALL ──────────────────────────────
 * It reads the store and nothing else. GitHub's unauthenticated limit is 60
 * requests/hour PER IP, and Vercel functions run from shared egress — which is
 * why a per-visitor fetch is not merely wasteful but genuinely unreliable, and
 * why it made every region disagree. `api/cron/releases.js` is the only thing
 * that talks to GitHub, at a schedule the operator sets.
 *
 * A lazy "refresh if stale" fallback in this path was considered and REFUSED:
 * it would reintroduce exactly the per-visitor variance the store removes, and
 * it would do so only on the unlucky visitor who happens to arrive first.
 * A cold store renders honestly instead — see the `empty` state.
 *
 * CommonJS, matching xmr.js / feeds.js / _nodes.js. See _releases-core.js.
 */

const {
  SOURCE,
  buildEnvelope,
  storeRead,
} = require('./_releases-core.js');

/* The store IS the cache, so the edge TTL is short on purpose: it exists to
   collapse a burst of visitors into one store read, not to hold data. A long
   TTL here would stack on top of the poll interval and make "checked N min
   ago" a number the page could not honour — the edge would serve a polledAt
   from before the last two polls. 300s against a 10-minute poll means the
   worst case a reader sees is one poll behind, which the rendered `polledAt`
   states exactly rather than approximating.

   `stale-while-revalidate` is deliberately NOT set. It would let the edge
   serve a known-old envelope while refreshing behind it, and the whole point
   of the `polledAt` line on the page is that its freshness claim is true at
   the moment it is read. */
const CACHE_CONTROL = 's-maxage=300';

/* A degraded answer must not be cached as long as a good one. Caching an
   `unconfigured` or `error` envelope for five minutes would outlive the
   operator's fix by five minutes, on every edge, which is the failure
   `api/feeds.js` already records against itself for the ghrepo path. */
const CACHE_CONTROL_DEGRADED = 's-maxage=30';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const src = String(req.query?.src || SOURCE).toLowerCase();

  /* Unknown src is a 400 — and it still carries `rev` and the requested
     `source`. An error envelope that drops the echoes is useless for exactly
     the diagnosis this endpoint exists to support: a caller getting a 400 from
     something that is not this function looks identical to a caller getting a
     400 from this function, unless the 400 says which revision refused it. */
  if (src !== SOURCE) {
    res.statusCode = 400;
    res.setHeader('Cache-Control', CACHE_CONTROL_DEGRADED);
    return res.end(
      JSON.stringify({
        ...buildEnvelope({ store: 'error', note: `unknown src "${src}"` }),
        source: src,
        error: 'unknown src',
        allowed: [SOURCE],
      }),
    );
  }

  const hit = await storeRead();

  if (hit.state === 'live') {
    const v = hit.value || {};
    res.statusCode = 200;
    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.end(
      JSON.stringify(
        buildEnvelope({
          store: 'live',
          polledAt: typeof v.polledAt === 'string' ? v.polledAt : null,
          pulls: Array.isArray(v.pulls) ? v.pulls : [],
          commits: Array.isArray(v.commits) ? v.commits : [],
        }),
      ),
    );
  }

  /* THE THREE UNHAPPY STATES ARE KEPT APART, and each names the operator
     action it implies. Collapsing them into one "no data" would be the same
     defect this whole PR exists to fix, one level down: a state that cannot
     tell you what to do about it.

       empty        — the store answered, and holds nothing. The cron has not
                      run yet (first deploy), or its writes are failing.
       unconfigured — KV_REST_API_URL / token absent from this environment.
       error        — the store was reachable and answered badly.

     200, not 5xx, and that is deliberate: the function is working correctly
     and reporting a true fact about its inputs. A 5xx would make the client's
     transport layer treat a correct answer as a network failure, which is
     precisely how "the feed is empty" and "the feed is broken" got confused
     in the first place. The `store` field carries the bad news. */
  const note =
    hit.state === 'empty'
      ? 'the store holds no ledger yet — /api/cron/releases has not written one'
      : hit.state === 'unconfigured'
        ? 'this deployment has no store credentials (KV_REST_API_URL / KV_REST_API_TOKEN)'
        : `the store did not answer usefully: ${hit.detail || 'unknown'}`;

  res.statusCode = 200;
  res.setHeader('Cache-Control', CACHE_CONTROL_DEGRADED);
  return res.end(JSON.stringify(buildEnvelope({ store: hit.state, note })));
};

/* Exported for the offline gate. The handler above is the only thing Vercel
   invokes; these are the seams a unit test needs. */
module.exports.CACHE_CONTROL = CACHE_CONTROL;
module.exports.CACHE_CONTROL_DEGRADED = CACHE_CONTROL_DEGRADED;
