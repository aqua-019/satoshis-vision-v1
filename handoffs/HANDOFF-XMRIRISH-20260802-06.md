---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-06
branch: claude/v6-1-4-loading-failure-language
status: done            # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — v6.1.4 Loading, failure and freshness language (PR B · items 0–4, PARTIAL)

## 1 · GOAL

PR A made the bad states unrepresentable and changed no pixels. This closes the
gap that left: the model could express the truth and the screen still did not
tell it. When this is done a cold load with every node down says so instead of
spinning forever, each `/network` panel dims on the endpoint its own numbers
come from, the COINGECKO badge stops blaming the node cascade, and every clock
reads the endpoint it reports on — freezing at last-good during an outage
rather than ticking over numbers nobody refreshed.

**Delivered as a PARTIAL at the operator's explicit request.** Item 5 (the
loading/skeleton/status-page surface) is not started; §3 names every deferred
piece and §8 carries what the next session needs.

## 2 · CONTEXT

- Source: the v6.1.4 prompt (block D2000 C, D0851–0900), prompt 05 of 19, PR B of two.
- Branched fresh from `origin/main` at `07fb3e0`, which contains PR A (#151).
- Prior art: PR A's `app/src/data/feed-status.ts` — `FeedPhase`, `FeedKey`,
  `hasData`/`isStale`/`isDown`, `feedDegraded`'s pair-AND, `chromePhase`.

## 3 · SCOPE

IN: items 0–4 — gate infrastructure and the CLS harness; the `error` copy; the
seven `/network` per-key sites; `HomePage.tsx`'s COINGECKO mis-attribution;
`lastUpdate` → per-endpoint.

OUT — item 5, itemised so it can be reconstructed without this conversation:

1. `<NodeProvenance>` wrapper + the **18** blind `fresh="live"` badges, each
   with its real `FeedKey`s, delivered with a table of site → keys cited →
   any genuinely ambiguous case.
2. `ProvFreshness` gaining an `error` member, landing in the SAME commit as the
   badge copy, plus the fifth-phase guard sweep (§8).
3. Per-panel last-updated timestamps (D0859) and synced/stale/error glyphs
   (D1698/D1700).
4. Structure-aware skeletons across the four surfaces — Markets panels, Network
   charts, the mempool stat strip, `/sources` (D0851), stale-while-revalidate
   (D0858), skeleton→content crossfade (D0612).
5. `PanelBoundary` + inline retry (D0864 / D1615 / D0869) — one crashing
   mempool view must not take down `/mempool`.
6. Degraded-mode banner (D0888).
7. Offline badge UI (D0870) — the *signal* shipped here, the badge did not.
8. Jittered retry backoff (D0868), without `Math.random()`.
9. Zero-results and filter-too-narrow states (D0861 / D0862).
10. `api/status.js` + the `/sources` status page + `api/verify-status.mjs` (D0891).

## 4 · CONSTRAINTS

- Stack: React 18 / Vite 5 / TS strict / Node 22. `api/` is CommonJS for
  `xmr.js`/`monero.js`/`feeds.js`; `markets.js` and `coingecko.js` are ESM.
- `Math.random()` only inside `app/src/protocols/`. Zero fabricated values.
- CSP `connect-src 'self'`; no third-party browser requests.
- Usable at 390px; no text under 12px; reduced-motion loses no information.
- New dependencies: none.

## 5 · DONE-CRITERIA

Ticked only where items 0–4 actually met them. **Unticked boxes are the
condition on which this partial was granted** — they are not oversights.

- [x] `npm run typecheck` exits 0
- [x] `npm run lint` — **N/A, no such script**
- [x] `npm run test` — **N/A, no such script**; the verify gates are this repo's tests
- [x] `npm run build` exits 0
- [x] `npm run verify:static` exits 0 (15 gates)
- [x] `npm run verify:e2e` exits 0 (22 gates, incl. new `verify-cls`, `verify-failure`)
- [x] `node verify-tiers.mjs` and the four `api/verify-*.mjs` exit 0
- [x] A settled total outage says `NO NODE RESPONSE`, names the endpoint, and stops saying CONNECTING
- [x] Killing ONE endpoint degrades exactly the panels it feeds; the rest stay live — **without the retry half of that bullet**
- [x] CLS is measured on every CI run and the number printed
- [x] Every clock reads the endpoint it reports on and freezes at last-good in an outage
- [ ] Every panel shows a **last-updated time** — only staleness is flagged, not freshness time
- [ ] Throwing inside one mempool view leaves the others working
- [ ] Offline → **badge** appears (the signal exists; no badge)
- [ ] `/sources` status page reflects real check results
- [ ] Inline **retry** on a degraded panel
- [x] Working tree clean; `grep -rn "MUTATION\|BREAK TEST" app/src app/*.mjs` empty
- [x] Branch pushed · PR opened, titled `PARTIAL:`, body names every unmet item

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck && npm run build
npm run verify:static
node verify-tiers.mjs
node ../api/verify-nodehealth.mjs && node ../api/verify-tx-parse.mjs && node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs
node scripts/serve-dist.mjs &
npm run wait-preview
npm run verify:e2e
```

## 7 · REPORT

**status:** done as a PARTIAL, at the operator's explicit request after I
surfaced the scope shortfall *before* opening rather than after.

**pr:** see `handoffs/LOG.md`

**commits:** 6 — gate infrastructure + CLS; the `error` copy; the `/network`
per-key rewiring; a gate hardening; the COINGECKO fix; the clock migration.

**deps added:** none.

### Two facts I have previously stated wrongly, re-checked against the tree

- **`makeReporter` `skip()`/`fixture()`.** I asserted twice after PR A that
  these existed. They did not. They exist now (`verify-lib.mjs:157`, `:162`,
  counters at `:158`, `:163`) — but only `skip()` has a caller
  (`verify-cls.mjs:101`, the WebKit branch). **`fixture()` has zero callers**,
  so by this repo's own standard (`verify-govern.mjs:275-280`, "a hook nobody
  calls is not a shipped feature") it is not shipped. It exists for
  `api/verify-status.mjs` in item 5, where every node probe must count as
  fixtured because the sandbox cannot reach a real node.
- **"CLS measured".** This is a gate that **re-measures on every CI run**, not
  a number taken once. `verify-cls.mjs` is in `verify:e2e` (`package.json:15`),
  which CI's `verify` job runs, and it prints the measured value each run
  whether it passes or fails. The *threshold*, separately, came from a one-off
  session of 8 runs per route on the unmodified tree.

### A figure carried in from the instruction that was wrong

"26 of 46 `<Provenance>` hardcode `fresh=\"live\"`" — measured twice
independently, it is **18**. 48 JSX call sites; 20 literal `fresh="live"`, two
of which sit inside status-driven ternaries. 14 of the 18 are in the six
mempool views plus `NetRail`. **Carry 18 forward.**

### What the gates found that I did not

- `verify-failure` first measured **0 of 5** blocks-fed panels degrading. The
  chain tier only re-pulls `/blocks` when the tip *moves*, so a constant tip
  fixture meant the feed correctly stopped asking and the outage was invisible.
  The feed behaving as designed; the same trap `verify-glide` hit.
- Then **3 of 5**. Pool attribution and Recent blocks are a stat-plus-bar and a
  table with nowhere to draw the chart watermark, and had **no staleness
  treatment at all** — last-good numbers formatted exactly like live ones.
  Fixed the panels, not the assertion.
- Break-testing `verify-failure` revealed the gate itself was blind: pointing a
  chart's `stale` prop at the wrong endpoint left every assertion green,
  because nothing compared the panel's `data-stale` against what the chart was
  drawing. Now asserted.
- Break-testing `verify-cls` measured **0.0841** for the documented
  unreserved-fallback regression — *below* the Web Vitals 0.1 "good" bound. A
  0.1 threshold would have passed a real, documented regression. The
  loose-threshold option is disproven empirically, not argued.

### Deviations

- Item 1 said "the four `chromePhase` consumers". There are **five** — `tsc`
  found HomePage's pill during item 3, still collapsing `error` onto CONNECTING.
- `MoneroLive.lastUpdate` is retained but now has **zero UI readers**;
  `verify-feedstatus` asserts that so the migration cannot drift back.

**open questions:** none blocking item 5.

## 8 · LOOP FEEDBACK — what item 5 needs, in writing

Item 5 starts with none of this conversation. These are the things that will
cost time if they have to be rediscovered.

### The guard hazard — read before touching `ProvFreshness`

**Widening `ProvFreshness` silently disarms any component whose props type
incidentally narrows a union it does not own.** Item 5 adds `error` to
`ProvFreshness`, which is exactly that change.

This is proven, not theorised. Before PR A converted them, MarketsPage's
`freshProps` and `GroupBadge` *appeared* protected against a new `FeedPhase` —
but only because `ProvFreshness` happened to lack the new member. Checking out
the pre-PR-A `MarketsPage` and widening **both** unions together, it **compiled
clean** and `GroupBadge`'s if-chain fell through to its stale branch silently.
A guard that disarms itself exactly when the next PR lands reads as coverage
right up until it stops being.

So, when widening `ProvFreshness`:

1. Add a **sixth** `FeedPhase` member.
2. Widen `ProvFreshness` alongside it.
3. `npx tsc --noEmit`, and confirm **every** phase-rendering site fails **at its
   own guard** (`assertNever` / `satisfies`), not at a neighbour's prop type.
4. **Report the site count and where each one failed.** A site that only fails
   because another type has not caught up is borrowing protection it does not
   control — treat it as unprotected.
5. Revert both.

At the last sweep there were **six** such sites: `NavTop`, `Footer`,
`NetworkPage`, `HomePage` and both `MarketsPage` badges use `switch` +
`assertNever`; `mempool-shared` uses `phase satisfies "live"` (TS1360).

### Three binding requirements on `<NodeProvenance>`

1. **It must not call `feedDegraded`.** That is the pair-AND global PR A
   deliberately preserved. A panel with `keys={["mempool"]}` must go stale when
   `mempool` alone fails, even though `feedDegraded` says healthy — that
   difference *is* the per-endpoint claim.
2. **Multi-key rule, defined once: worst-of.** If a panel renders `mempool` and
   `fees` and either is stale, the panel is stale.
3. **The `FeedPhase → ProvFreshness` switch is exhaustive with `assertNever`**,
   and is included in the sweep above.

### Traps still live

- **`SUSPENDED_RE`** = `/loading(\s+[a-z]+)?[….]|does not support Suspense/i`
  is a substring test over the whole prerendered document.
  `provenance.tsx`'s `" · loading"` is safe *only* because it has no trailing
  punctuation; adding an ellipsis breaks the build on every route, and the error
  says "still suspended", pointing at Suspense rather than at the copy.
- **`.prov` must stay `display: inline`** or `innerText` reads `COINGECKO` and
  `· stale` on separate lines and `verify-allreal-dom` breaks with identical copy.
- **`verify-govern` pins the literal JSX `{showPending ? (`** and the exact
  `import { usePendingDelay }` text. Do not reformat.
- **`EmptyBox` must keep its ref-attached `div.chart-box` root in both branches**
  or the never-measured `useChartMetrics` bug returns.
- **CLS is reserved-space-sensitive.** `/mempool` reads 0 only because its
  Suspense fallback has a `minHeight`; without it, 0.0841 measured here.
  `App.tsx`'s two fallbacks have none — a new boundary fallback must reserve space.
- **New CSS must sit in `@layer components`**; only `@keyframes` is exempt. A
  new stylesheet must be registered in `verify-legibility`'s `STYLESHEETS` list.
- **`@keyframes sweep` is dead** — a ready-made translateX shimmer with zero
  consumers. Looping cadences here use literal durations in
  `calc(… / var(--tk-anim, 1))`, **not** `var(--d-*)`, which reduced motion
  zeroes to `0ms`.
- **`isNodeCold` mutates**; use `_healthSnapshot()` for read-only status. And
  probing all six nodes marks health, reordering the cascade for the real
  endpoints on the same warm Lambda — decide that deliberately.
- **`mockFeeds` aborts every other `/api/*`**, so `/api/status` is unmocked
  until that helper is extended.

### Three latent defects, still unfixed

1. `styles.css`'s reduce kill-list omits `.prov-fresh--stale`, so the gold stale
   suffix blinks for readers who asked it not to.
2. `verify-tiers-dom` uses a bare `/\$0\.00/` where `verify-allreal-dom`
   documents the `(?!\d)` lookahead as necessary.
3. `fixture()` has no caller (see §7).

### Process notes

- **Commit before break-testing.** `git checkout -- <file>` destroys
  uncommitted work when the reverted file also carries the fix under test. It
  cost a re-do in PR A; the sequence in CLAUDE.md assumes a committed baseline
  and does not say so.
- `.claude/hooks/stop-gate.sh` still does not exist (recorded in PR A's
  handoff). The loopflow's deterministic backstop has never run.
