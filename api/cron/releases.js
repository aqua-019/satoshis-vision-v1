/**
 * api/cron/releases.js — `/api/cron/releases`, the only thing in this project
 * that talks to GitHub about releases.
 *
 * Polls the two tiers, normalizes them, and writes one JSON blob to the store
 * with a `polledAt` stamp. `api/releases.js` then serves that blob and makes
 * no upstream call at all.
 *
 * ── THE RATE-LIMIT ARITHMETIC, STATED ────────────────────────────────────
 * Unauthenticated GitHub allows 60 requests/hour PER IP, and Vercel functions
 * share egress addresses — so the old per-visitor model was not merely
 * wasteful, it was unreliable in a way that varied by region and by who else
 * was deployed nearby.
 *
 * One run of this handler costs:
 *     1 call   `/pulls?state=closed&per_page=100`
 *   ≤ 3 calls  `/commits?per_page=100&page=N`   (MAX_COMMIT_PAGES backstop;
 *              it stops as soon as COMMITS_CAP=150 is satisfied, so 2 in
 *              practice)
 *   ─────────
 *   ≤ 4 calls per run.
 *
 * At the configured `*​/10 * * * *` that is 6 runs/hour → **≤24 calls/hour
 * against a 60/hour ceiling**, i.e. 40% utilisation with the whole remaining
 * budget free for the other `/api/feeds` GitHub surfaces. A 5-minute cadence
 * would be ≤48/hour, which leaves no room for anything else on the same
 * egress IP; a 15-minute cadence would be ≤16/hour and is the fallback if the
 * ceiling is ever hit. 10 minutes is the point where "as it occurs" is
 * honest and the budget is not spent.
 *
 * PLAN NOTE: sub-daily cron schedules require a paid Vercel plan. This project
 * lives under a Vercel *team* (`aquatic`), and teams are themselves a paid-plan
 * feature — so the schedule above is available. If the schedule is ever
 * downgraded, NOTHING here lies: the page renders the real `polledAt`, so a
 * daily poll simply reads "checked 7 h ago" instead of "checked 4 min ago".
 *
 * ── THE GUARD ────────────────────────────────────────────────────────────
 * `CRON_SECRET` per Vercel's documented pattern: reject anything without
 * `Authorization: Bearer <secret>`. It FAILS CLOSED — with the variable unset
 * the handler refuses every request, including Vercel's own trigger.
 *
 * What the secret protects is GITHUB QUOTA, not data. Everything this handler
 * reads is public and everything it writes is public, so an attacker who got
 * in would learn nothing; what they could do is burn the 60/hour budget with a
 * request loop and take the ledger down for everyone. That is the threat, and
 * it is why the guard is here even though the payload is not sensitive.
 *
 * ── PARTIAL SUCCESS DOES NOT BLANK A TIER ────────────────────────────────
 * The two fetches run concurrently and are settled independently. If commits
 * fail while pulls succeed, the previous commit tier is carried forward from
 * the store rather than written as `[]`. Writing an empty array would turn a
 * transient upstream blip into a page that says "no commits", which is the
 * "last-good, never synthesis" rule this repo applies to every live surface.
 * A run that recovers NOTHING writes nothing at all and reports 500, so the
 * previous good blob keeps serving.
 *
 * CommonJS, matching the rest of api/. See _releases-core.js.
 */

const {
  PULLS_CAP,
  COMMITS_CAP,
  BODY_CAP,
  mapPulls,
  mapAllCommits,
  storeRead,
  storeWrite,
  fetchSelfPulls,
  fetchSelfCommits,
} = require('../_releases-core.js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  /* No Access-Control-Allow-Origin. This is not a browser endpoint — it is
     triggered by the platform's scheduler and, occasionally, by an operator
     with the secret. Advertising it to cross-origin callers would be noise. */

  const secret = process.env.CRON_SECRET;
  const auth = req.headers?.authorization || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    res.statusCode = 401;
    return res.end(
      JSON.stringify({
        ok: false,
        error: secret ? 'unauthorized' : 'CRON_SECRET is not set on this deployment',
      }),
    );
  }

  const startedAt = new Date().toISOString();

  const [pullsR, commitsR] = await Promise.allSettled([
    fetchSelfPulls(),
    fetchSelfCommits(COMMITS_CAP),
  ]);

  const pulls = pullsR.status === 'fulfilled' ? mapPulls(pullsR.value, PULLS_CAP, BODY_CAP) : null;
  const commits = commitsR.status === 'fulfilled' ? mapAllCommits(commitsR.value, COMMITS_CAP) : null;

  const errors = [];
  if (pullsR.status === 'rejected') errors.push(`pulls: ${String(pullsR.reason?.message || pullsR.reason)}`);
  if (commitsR.status === 'rejected') errors.push(`commits: ${String(commitsR.reason?.message || commitsR.reason)}`);

  /* Nothing recovered — do not touch the store. The previous blob, however
     old, is strictly better than an empty one, and `polledAt` will show its
     real age rather than pretending this run succeeded. */
  if (pulls === null && commits === null) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, startedAt, errors }));
  }

  /* Carry forward whichever tier failed. Reading the store costs one round
     trip and only happens on a partial failure. */
  let keptPulls = pulls;
  let keptCommits = commits;
  let carried = [];
  if (pulls === null || commits === null) {
    const prev = await storeRead();
    const v = prev.state === 'live' && prev.value ? prev.value : {};
    if (pulls === null) {
      keptPulls = Array.isArray(v.pulls) ? v.pulls : [];
      carried.push('pulls');
    }
    if (commits === null) {
      keptCommits = Array.isArray(v.commits) ? v.commits : [];
      carried.push('commits');
    }
  }

  const blob = {
    polledAt: new Date().toISOString(),
    pulls: keptPulls,
    commits: keptCommits,
  };

  const w = await storeWrite(blob);
  if (!w.ok) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, startedAt, errors: errors.concat(`store: ${w.detail}`) }));
  }

  res.statusCode = 200;
  return res.end(
    JSON.stringify({
      ok: true,
      startedAt,
      polledAt: blob.polledAt,
      counts: { pulls: blob.pulls.length, commits: blob.commits.length },
      ...(carried.length ? { carriedForward: carried } : {}),
      ...(errors.length ? { errors } : {}),
    }),
  );
};
