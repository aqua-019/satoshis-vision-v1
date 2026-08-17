---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260817-44
branch: claude/prompt-attached-devzvd
status: done               # open -> in_progress -> done | blocked
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

- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0
- [x] `npm run verify:static` exits 0 — clean, 0 reds
- [x] `npm run verify:e2e` exits 0 — 0 reds across all 34 members, including verify-vitals
- [x] `node verify-bundle.mjs` 28 passed · 0 failed. lazyJsRaw 900,000 → 904,000 (built
      900,457) and totalJsRaw 1,162,000 → 1,167,000 (built 1,163,009), both red-then-green
      on the FINAL tree; CHUNK_COUNT re-centred 66 → 67. Figures re-derived after the LAST
      src commit — the maxHeight change moved the build 3 B and the first comments were stale
- [x] all 7 moved gates exit 0 from `api/_tests/`; ci.yml, scripts/verify-all.mjs and every
      in-file `Run:` path repointed
- [x] measured 13 → 8
- [x] `verify-releases-pipe.mjs` 79 assertions, 0 failed — rev+source on all four store
      states AND on the 400; both Cache-Control literals and their relation
- [x] §8, both polarities, plus the payload-is-DISCARDED half. Break test M1: 8 reds
- [x] §9 asserts the tiers are contiguous and ordered (`/^r+c+$/`); §10 bounds the box and
      measures CLS at 0.00000; hScroll 0 at 1440 and 390
- [x] `verify-mobile` 47 passed · 1 skipped · 0 failed
- [x] SITE_PR 191, logMax 190 → 190 <= 191 <= 191
- [x] script controlled against THREE commits (e5eae16, bda0491, 543a8d8), all reproduced
      exactly; measured 84 / 80 / 22 / 34 / 70 / 6
- [x] 5 captured and looked at. The fixed-height void was found BY LOOKING and fixed
- [~] Branch pushed (`47ff9f3`). **PR NOT OPENED — BLOCKED**: API writes are not
      authorized for this session (see REPORT). `mergeable_state` therefore not reported.

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

## 7 · REPORT

status: done
pr: NOT OPENED — BLOCKED. Branch `claude/prompt-attached-devzvd` @ `47ff9f3` is pushed.
  Three distinct attempts, same authorization wall:
    1. GitHub MCP `create_pull_request` -> `Authentication Failed: Bad credentials`
    2. same, retried                    -> `Authentication Failed: Bad credentials`
    3. REST API with the session's GITHUB_TOKEN (api.github.com/user answers 200, so the
       token authenticates) -> `HTTP 403 — GitHub access is not enabled for this session.
       An org admin must connect the Claude GitHub App for this organization.`
  `git push` succeeds because it goes through the git proxy; API WRITES are a separate grant.
  This is an org/session permission, not a repo or branch problem, and no retry will clear it.
  Open in one click:
    https://github.com/aqua-019/satoshis-vision-v1/compare/main...claude/prompt-attached-devzvd
  The prepared draft PR body is in the session transcript and was written to /tmp/pr-body.md.
commits: 5 — the gate move · the pipe · the ledger UI · the polledAt discriminator ·
  the maxHeight correction with its budget raises
deps added: NONE. The store is plain `fetch` against the Upstash REST API rather than
  `@upstash/redis`, which would have added the first dependency in `api/` and would have
  arrived as ESM into a directory where mixing module systems has broken this project before.

deviations from spec:
  1. **Tier 2 does not reuse `mapCommits`.** §0.2 said to reactivate `src=commits`' serving
     path because that transform "exists and is unit-gated". It does — and it is a
     VERSION-STAMP FILTER, not a commit lister. Measured on this tree: ZERO of the last 80
     commit subjects parse, `git tag` empty. Reusing it ships an empty tier that looks
     broken. Built `mapAllCommits`; kept `mapCommits` and asserted it agrees with feeds.js.
  2. **A twin gate, not an extension of `verify-feeds.mjs`.** §0.1(b) allowed either. A gate
     named "feeds" asserting the releases pipe is the subject/name mismatch this repo
     records against itself, so `api/_tests/verify-releases-pipe.mjs` is a new FILE and the
     full wiring protocol was applied (npm via verify-all, a named ci.yml step, census
     recounted).
  3. **`_releases-core.js` does not import `feeds.js`.** §0.2 said `mapPulls` "gains the
     field"; the Subject line said feeds.js stays untouched. Resolved toward untouched: an
     import edge is the one thing that could carry a deployment artifact across a
     quarantine. Duplication is a GATED invariant — the pipe gate asserts the copies agree.
  4. **Only the release surface migrated off `/api/feeds`.** The getmonero/mrl/x widgets and
     `useRepoPulse` stay. §0.1 allowed deciding by diff size, out loud: migrating ghrepo
     needs a second store schema for caller-supplied repos. `useRepoPulse` also gains no
     echo check, because its existing shape guard already rejects a cross-served payload, so
     the check would change no rendered state without a copy change on two pages out of scope.
  5. **The scroll box is `maxHeight`, not the fixed height §0.3 implies.** Measured: CLS is
     0.00000 either way (the section is the last content on the page), while the fixed
     height left ~374px of void in two of four states.

notes for ARCHITECTURE.md patch:
  - `api/_tests/` is now the home for api-side gates. Underscore paths are not deployed as
    functions; a counting script keyed on `api/verify-*.mjs` finds nothing — count at depth.
  - `api/_releases-core.js` is a non-deployed CommonJS core shared by two functions and one
    gate. Its transforms are deliberately duplicated from feeds.js and the duplication is
    asserted, not assumed.
  - Provenance/vocabulary unchanged. No new route. CSP untouched.

open questions:
  - The store env vars were treated as a HYPOTHESIS and never verified from here (no egress).
    If absent at runtime the function reports `store: "unconfigured"` and the page says so.
  - `CRON_SECRET` must be added by the operator; the handler fails closed without it.
  - Whether the deployed `/api/releases` is the code in this repo is the question `rev` makes
    ASKABLE and only a live probe answers. The sandbox cannot reach production.

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
