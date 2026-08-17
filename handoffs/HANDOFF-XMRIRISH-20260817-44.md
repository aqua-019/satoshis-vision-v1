---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260817-44
branch: claude/prompt-attached-devzvd
status: in_progress        # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — task arrived as a prompt, p4·03)
owner: claude-code
---

# HANDOFF — p4·03 "THE RELEASE LEDGER": a feeds envelope that can prove its own vintage, on a path that is not haunted

## 1 · GOAL

`/about/sources` carries the project's whole release history — every merged PR with its
title AND its body as the head-to-toe summary, plus the commit work-log beneath it — in a
bounded scroll region, served by a NEW store-backed serverless path that can prove which
revision of itself answered.

The prerequisite is the correctness layer, and it comes first. Production currently serves
a `/api/feeds` whose behaviour no commit in this repo can produce: it honours `n`, does not
know `src` at all, and answers every source as `getmonero`. The verifier proved that past
every repo-side cause. Nothing client-side could SEE it, because the client never checked
that the answer matched the question. So: the ledger ships on a NEW function file at a NEW
route (`api/releases.js` → `/api/releases`), carrying a hand-bumped `rev` constant and a
`source` echo in every envelope from birth; and the client treats an envelope that answers
as a different source as its OWN named state, rendered in the house dead-feed vocabulary,
never as a silent empty.

Second prerequisite, same PR: the seven `api/verify-*.mjs` files currently deploy as
publicly invocable serverless functions — 13 lambdas where 6 are intended, including
`/api/verify-nodehealth`, which probes remote Monero nodes on anyone's GET. They move to
`api/_tests/` (underscore paths are not built into functions; `_nodes.js`/`_fixtures/` are
the in-directory precedent).

## 2 · CONTEXT

- Base: `main` = `543a8d8` (the p4·02 merge). Branch cut from it.
- Prompt: p4·03 release ledger (attached, `c3326d06-p403releaseledger.md`).
- Relevant files: `api/feeds.js` (UNTOUCHED — tombstone), NEW `api/releases.js`,
  NEW `api/cron/releases.js`, `app/src/data/useCachedFeed.ts`,
  `app/src/pages/SourcesPage.tsx`, `app/src/data/releases.ts`,
  `app/src/design/Disclosure.tsx`, `app/verify-releases.mjs`,
  `app/verify-releases-dom.mjs`, `api/verify-feeds.mjs`, `app/verify-bundle.mjs`,
  `vercel.json`.
- Premise re-confirmed at `543a8d8` on this machine (not carried from the prompt):
  13 top-level `api/` entries → 13 lambdas (6 real + 7 gates); `api/releases.js` and
  `api/cron/` are collision-free; `SITE_PR = 190` and `handoffs/LOG.md` max = 190, so this
  PR bumps to 191 (`logMax <= SITE_PR <= logMax + 1`).
- Budgets re-measured at `543a8d8` on this machine, reproducing the verifier EXACTLY:
  `/about/sources` 95,056 / 98,000 (margin 2,944) · `lazyJsRaw` 896,138 / 900,000
  (margin 3,862) · `totalJsRaw` 1,158,652 / 1,162,000 (margin 3,348) · `cssGz`
  18,150 / 18,600 (margin 450) · `eagerJsRaw` 262,514 / 280,000 · `eagerJsGz`
  87,936 / 96,000 · CHUNK_COUNT 69 within 66±4.
- Platform fact, measured not assumed: the project (`satoshis-vision-v1`,
  `prj_xs4rLItZCzfgnJwke5sU4Hbf435h`) lives under a Vercel **team** (`aquatic`). Teams are
  a paid-plan feature, so sub-daily cron schedules are available.
- Store: Upstash Redis (`upstash-kv-blue-garden`, iad1) with `KV_REST_API_URL` /
  `KV_REST_API_TOKEN` — carried from the operator's 2026-08-17-night record and treated as
  a HYPOTHESIS. Grep confirms no store wiring exists in-repo today. A missing env var must
  be reported in the envelope, never crash the function.

## 3 · SCOPE

IN: the `rev`/`source` envelope and its client mismatch state · `api/releases.js` (store
read only) · `api/cron/releases.js` (GitHub poll → store write, `CRON_SECRET`-guarded) ·
`crons` + `functions` entries in `vercel.json` · PR body as the per-entry summary, size-
bound with an honest truncation marker · commit tier reactivated · the two tiers rendered
distinctly with a seam · the bounded scroll region · the `api/_tests/` move and every
runner path that names those files · gate extensions in existing members · budget raises
if crossed · `SITE_PR` 190 → 191.

OUT (non-goals): `api/feeds.js` itself (stays untouched as the tombstone the support ticket
references; deleting it is the operator's later call) · the `/api/status` panel on
SourcesPage (prompt 05's) · the curated v5 archive's bytes (gate already pins them) · the
topbar label derivation · CSP · any new route · the `getmonero`/`mrl`/`x` widget migration
unless the diff stays small (decide out loud) · the vitals-last `verify:e2e` tail ordering
p4·01 fixed.

## 4 · CONSTRAINTS

- `api/` is MIXED module systems. `feeds.js` is CommonJS; a new file that must reuse its
  transforms has to be CommonJS too. Match the file, never a rule.
- No SDK for the store — plain `fetch` against the Upstash REST API, so no module-system
  mixing and no dependency added.
- Zero fabricated values on live surfaces. Store-empty, cron-never-run, missing-env and
  cross-served all render honestly; none of them synthesises a list.
- `connect-src 'self'` — the browser reaches only xmr.irish. No new origin.
- Underscore paths in `api/` are not deployed as functions. That is the whole mechanism of
  the `_tests/` move; verify it rather than assume it.
- Two-polarity execution transcript per new/modified assertion, restores proven against the
  COMMITTED BLOB with a bracketed marker sweep, rebuilt between restore and re-measure.
- Budget comments re-derived after the LAST src commit, never mid-flight.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run verify:static` exits 0
- [ ] `npm run verify:e2e` exits 0 (environmental reds paired against the base and named)
- [ ] `node verify-bundle.mjs` exits 0, every raise red-then-green on the FINAL tree
- [ ] `node ../api/_tests/verify-feeds.mjs` exits 0 from its new home, and all 7 moved
      gates run green from `api/_tests/` with every runner path updated
- [ ] `ls api/ | grep -v '^_' | wc -l` reports 8 (6 kept + releases + cron), down from 13
- [ ] `/api/releases` envelope carries `rev` and echoes `source`; the api-side gate asserts
      both, and asserts the Cache-Control literal
- [ ] a mocked cross-served envelope renders the named mismatch state; a matching envelope
      renders the ledger (two-polarity, in `verify-releases-dom.mjs`)
- [ ] both tiers render with a seam between them; the scroll region is bounded at 1440 and
      390 with no page-level horizontal scroll
- [ ] `node verify-mobile.mjs` exits 0 (p4·02's gate stays green)
- [ ] `SITE_PR === 191` and `verify-releases.mjs`'s staleness invariant passes
- [ ] census RECOUNTED (never incremented) with the counting script CONTROLLED against a
      historical commit first
- [ ] renders captured and LOOKED AT ×4: fed-both-tiers · store-empty · cross-served · 390
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck
npm run build
npm run verify:static
node verify-bundle.mjs
node verify-mobile.mjs
node ../api/_tests/verify-feeds.mjs
npm run verify:e2e
```

## 7 · REPORT — filled on exit

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK

- Recon worker `recon-gates` returned a `ROUTES_FIRST_LOAD` budget table that was
  FABRICATED: it reported `/` at 45,800 gzip and a 12-row table labelled "14 routes", where
  `verify-bundle` itself measures `/` at 87,936 across 14 rows including
  `/live/markets/thesis` and `/future/outlook`. Caught only because the instrument had
  already been run by the lead. Brief said "VERBATIM, do not paraphrase" and the worker
  paraphrased into invention. Disposition: REJECTED, re-read at source.
- Recon worker `recon-client` returned prose where the brief asked for verbatim source.
  Structurally useful, not editable-against. Disposition: ACCEPTED as orientation only;
  every file re-read by the lead before modification.
