---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-07
branch: claude/provenance-freshness-truth-6ddexw
status: in_progress    # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — v6.1.4 Provenance freshness truth (PR C · item 5)

## 1 · GOAL

The badges tell the truth. Today 18 `<Provenance>` badges pulse a green "live"
dot that is a hardcoded string literal — they pulse through a total node outage,
and on `/network` two of them pulse directly beside the literal text `· stale`
rendered by their own panel header. When this is done the freshness of a badge is
*derived* from the endpoints its panel actually reads, `ProvFreshness` can express
`error` and is guarded by an exhaustive switch, a static gate makes a hardcoded
live dot fail CI rather than fail review, every live-data panel shows when its own
endpoint last answered (frozen at last-good during an outage, with the age still
counting up), and the gold stale suffix stops blinking at readers who asked it not
to.

## 2 · CONTEXT

- Source: the v6.1.4 prompt, block 05c of 19 — PR C, the third of prompt 05.
- Scope source of truth: `handoffs/HANDOFF-XMRIRISH-20260802-06.md` §3 OUT item 5
  and §8 LOOP FEEDBACK. That handoff, not the prompt, defines scope; where they
  disagree the handoff wins and the disagreement is reported.
- Branched fresh from `origin/main` at `9820966`, which contains PR A (#151) and
  PR B (#152).
- Prior art: PR A's `app/src/data/feed-status.ts` (`FeedPhase`, `FeedKey`,
  `hasData`/`isStale`/`isDown`, `feedDegraded`'s pair-AND, `chromePhase`,
  `freshAt`, `assertNever`); PR B's per-endpoint clocks and `PanelFrame`'s
  `dataKey`/`stale`.

## 3 · SCOPE

IN — item 5's first three sub-items plus the two defects that land on this surface:

1. `ProvFreshness` gains `error`; the badge renders a distinct treatment; the
   header documents all five; the render gains its first exhaustiveness guard.
2. `<NodeProvenance>` to the handoff's three binding requirements, and the
   rewiring of every blind `fresh="live"` site to it.
3. A static gate that fails on a literal `fresh="live"` outside a reasoned
   allowlist.
4. Per-panel last-updated timestamps from `freshAt(status[key])` across all 32
   live-data panels.
5. `.prov-fresh--stale` into the reduced-motion kill-list (handoff §8 latent
   defect 1), with the new error suffix in it from the start.
6. Triage of the no-prop sites into live-and-unmarked vs correctly-silent.

OUT — deferred, carried forward from handoff 06 §3:

- Structure-aware skeletons, stale-while-revalidate, skeleton→content crossfade
  (item 5.4).
- `PanelBoundary` + inline retry (5.5), degraded-mode banner (5.6), offline badge
  UI (5.7), jittered retry backoff (5.8), zero-results states (5.9).
- `api/status.js` + the `/sources` status page + `api/verify-status.mjs` (5.10) —
  still the reserved first caller for `makeReporter`'s unshipped `fixture()`.
- `MarketsPage:291`'s source mis-attribution — recorded in §7, deliberately not
  fixed; it is an attribution question with a `DataLegend` knock-on, not freshness.

## 4 · CONSTRAINTS

- Stack: React 18 / Vite 5 / TS strict / Node 22. `api/` untouched by this change.
- `Math.random()` only inside `app/src/protocols/`. Zero fabricated values.
- CSP `connect-src 'self'`; no third-party browser requests.
- Usable at 390px; no text under 12px; reduced motion loses no information.
- New CSS sits in `@layer components`; only `@keyframes` is exempt.
- New dependencies: none.
- Commit before break-testing — `git checkout -- <file>` destroys uncommitted work
  when the reverted file also carries the fix under test.

## 5 · DONE-CRITERIA

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` — N/A, no such script
- [ ] `npm run test` — N/A, no such script; the verify gates are this repo's tests
- [ ] `npm run build` exits 0
- [ ] `npm run verify:static` exits 0 (16 gates after this PR)
- [ ] `npm run verify:e2e` exits 0 (22 gates)
- [ ] `node verify-tiers.mjs` and the four `api/verify-*.mjs` exit 0
- [ ] `ProvFreshness` includes `error`; the badge renders a distinct error
      treatment; the header documents all five
- [ ] The error copy is checked against the real `SUSPENDED_RE` and does not match
      it; the string and the check are named in the PR body
- [ ] `.prov` and the new suffix span are still `display: inline`
- [ ] The guard sweep ran per handoff 06 §8's five steps; site count, where each
      failed, and any site failing only at a neighbour's type are reported
- [ ] The temporary phase member is reverted; `git status` clean and
      `grep -rn "MUTATION" app/src` empty **before** the final chain run
- [ ] `<NodeProvenance>` does not call `feedDegraded`; multi-key resolves worst-of;
      the `FeedPhase → ProvFreshness` switch ends in `assertNever`
- [ ] Zero blind `fresh="live"` on live-data surfaces; every remaining literal is
      allowlisted with a reason; the ternary exceptions are named
- [ ] The gate goes red on a literal added to a live surface — proven, then reverted
- [ ] The no-prop sites are triaged: how many gained freshness, how many are
      correctly silent, why
- [ ] Killing one endpoint changes that panel's badge and timestamp and no other's
- [ ] During an outage every visible timestamp freezes at last-good and its
      relative age keeps counting up
- [ ] `.prov-fresh--stale` and the new error suffix are both in the reduce kill-list
- [ ] Working tree clean; `grep -rn "MUTATION\|BREAK TEST" app/src app/*.mjs` empty
- [ ] Branch pushed · PR opened ready for review (not draft) · `mergeable: true`,
      `mergeable_state: clean`, every CI check concluded green

## 6 · VERIFY COMMANDS

```
cd app
npm ci
npm run typecheck && npm run build
npm run verify:static
node verify-tiers.mjs
node ../api/verify-nodehealth.mjs && node ../api/verify-tx-parse.mjs && node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs
node scripts/serve-dist.mjs &
npm run wait-preview
npm run verify:e2e
```

## 7 · REPORT

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
