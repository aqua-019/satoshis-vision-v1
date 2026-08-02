---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-09
branch: claude/resilience-ui-failing-feed-euwiwt
status: done             # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, self-authored)
owner: claude-code
---

# HANDOFF — v6.1.4 PR D · Resilience UI (prompt 05, fourth and final)

## 1 · GOAL

The UI a failing feed actually needs. PR A made the bad states unrepresentable,
B stopped the chrome lying, C made every badge derive its freshness from a real
endpoint — none of them built the surface. When this is done there are
structure-aware skeletons on four surfaces, a panel-level error boundary with an
inline retry that names its endpoint, a degraded banner and an offline badge with
precedence decided once, jittered backoff with no `Math.random()`, zero-results
copy distinct from failure copy, and `/api/status` surfaced on `/sources`.
Prompt 05 closes.

## 2 · CONTEXT

- Source: the v6.1.4 prompt, block 05d of 19. Scope fixed in
  `HANDOFF-XMRIRISH-20260802-07.md` §3 OUT, carried verbatim.
- Branched from `origin/main` at **659688a** (two commits past the prompt's
  `c86899b` baseline — PR #154, docs only).
- Prior art: PR A's `feed-status.ts`, PR B's `verify-cls`/`verify-failure`,
  PR C's `NodeProvenance`/`verify-provenance`.

## 3 · SCOPE

IN — the ten fixed items: structure-aware skeletons (Markets · Network ·
mempool strip · `/sources`), stale-while-revalidate vocabulary, skeleton→content
crossfade, `PanelBoundary` + inline retry, degraded banner, offline badge,
jittered backoff without `Math.random()`, zero-results states, `api/status.js` +
`/sources` panel + `api/verify-status.mjs`, and `mockFeeds` for `/api/status`.

OUT — `MarketsPage:291`'s source mis-attribution (recorded in #153 with both
readings and a `DataLegend` knock-on); `.mp-switcher`'s hardcoded `top: 60px`
(prompt 07's, with numbers below).

## 4 · CONSTRAINTS

Stack React 18 / Vite 5 / TS strict / Node 22. `Math.random()` only in
`src/protocols/`. CSP `connect-src 'self'`. 390px usable, no text under 12px,
reduced motion loses no information. New deps: **none**.

## 5 · DONE-CRITERIA

- [x] `npm run typecheck` exits 0
- [x] `npm run lint` — **N/A, no such script**
- [x] `npm run test` — **N/A**; the verify gates are this repo's tests
- [x] `npm run build` exits 0 — 11/11 routes prerender
- [x] `npm run verify:static` exits 0 (**17**, incl. new `verify-resilience`)
- [x] `npm run verify:e2e` exits 0 (**23**, incl. new `verify-resilience-dom`)
- [x] `node verify-tiers.mjs` exits 0
- [x] the five `api/verify-*.mjs` exit 0 (incl. new `verify-status`)
- [x] Four surfaces show a structure-aware skeleton reserving its box
- [x] CLS re-measured and printed per route
- [x] Crossfade ships a reduced-motion path that still communicates arrival
- [x] `PanelBoundary` catches a thrown render without taking the route
- [x] The inline retry names its endpoint from the `feed-status` vocabulary
- [x] The banner uses `feedDegraded`; `NodeProvenance` still does not
- [x] Offline badge renders from `useOnline` and outranks every chrome state
- [x] Jittered backoff has no `Math.random()`; `verify-prng` passes
- [x] Zero-results copy distinct from failure copy; `EmptyBox` untouched
- [x] `api/status.js` is CommonJS and is surfaced on `/sources`
- [x] `api/verify-status.mjs` counts node probes as `fixture()`
- [x] `mockFeeds` handles `/api/status`
- [x] New copy checked against an **extracted** `SUSPENDED_RE`
- [x] No new stylesheet, so `verify-legibility`'s `STYLESHEETS` is unchanged
- [ ] Branch pushed · PR ready for review · CI green

## 6 · VERIFY COMMANDS

```
cd app && npm ci
npm run typecheck && npm run build
npm run verify:static
node verify-tiers.mjs
node ../api/verify-nodehealth.mjs && node ../api/verify-tx-parse.mjs \
  && node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs \
  && node ../api/verify-status.mjs
node scripts/serve-dist.mjs & npm run wait-preview
npm run verify:e2e
CLS_RUNS=3 node verify-cls.mjs
```

## 7 · REPORT

**Measured CLS**, 3 runs each, after every change:
`/` **0.0002** · `/mempool` **0.0000** · `/markets` **0.0000** · `/network`
**0.0000**, against ceilings 0.01 / 0.01 / 0.02 / 0.01. No route regressed.

**Gate count: 42 → 45 reached by CI**, three new, all reached (not merely wired):
`verify-resilience.mjs` in `verify:static` (16→17), `verify-resilience-dom.mjs`
in `verify:e2e` (22→23), `api/verify-status.mjs` as its own named step in the
`build` job. My own earlier table said 45 while listing only two — the operator
caught the arithmetic; the fix was to keep Q3's agreed three-gate shape rather
than silently drop the static gate.

### Things found that the instruction did not predict

1. **Ten of the 22 `verify:e2e` gates call `.route()` zero times** — `nojs`,
   `contrast`, `roles`, `ground`, `motion`, `nav`, `discrete`, `govern`,
   `reduce`, `cls`. Combined with `serve-dist` answering `/api/*` with **200
   `text/html`**, all ten were measuring a totally degraded feed and none said
   so. Their assertions stay valid (layout, colour, motion do not depend on
   data) but a "skeleton → content" assertion written that way would assert
   something the harness cannot produce.
2. **`serve-dist.mjs` returned the SPA shell for unmatched `/api/*`.** Fixed to
   501 JSON. One change makes every gate honest instead of patching them one at
   a time — and it is why `/api/status` fell through unrouted.
3. **`_healthSnapshot()` is unusable from `api/status.js`.** Vercel gives each
   `api/*.js` its own serverless runtime, so its `health` Map is
   **structurally, permanently empty** — not a cold-start transient. Reporting
   it as node health would fabricate a live value. The endpoint reports
   configuration only, `probed:false`, and `/sources` gets real liveness from the
   browser's own observations instead.
4. **`feedDegraded` was never "here and only here"** — it already had two
   legitimate callers, one of them (`useFeedEvents.ts:42`) pinned VERBATIM by
   `verify-effects.mjs:88`. The rule that matters is the mechanised, narrower
   one: `provenance.tsx` must never call it.
5. **`useTickers`' `pendingDelay` value is never read**, only its nullness, so
   the comment at `:111-116` claiming a resume "honours the retry backoff" does
   not describe the code — the resume runs immediately regardless. Reported, not
   fixed; out of scope.
6. **`verify-memstats.mjs` does not exist** though `mem-stats.tsx:167` cites it.

### Two real bugs the new gates caught, both mine

- **`feed-activity.ts` cached its snapshot in one module-level slot.** Two
  components subscribing with different keys thrashed it, every `getSnapshot()`
  returned a fresh object, and React threw **#185** — the whole route blanked
  through `RootBoundary`. Ten unmocked e2e gates would have rendered that same
  blank page and still passed.
- **Pool attribution reserved 52px** derived from the populated state while the
  empty state renders 56, so the reserve never dominated and the panel shifted
  4px on arrival.

### Three assertions failed on comment PROSE, not code

`Math.random(` in a header, `var(--` in a header, and a `.shell` regex spanning
one. Every structural check now strips comments first, and `verify-prng`'s header
carries the four-case table: block ✅ · line-start ✅ · indented line-start ✅ ·
**trailing ❌**.

### Deviations

- **`makeReporter` extracted** to `app/verify-reporter.mjs` — shared gate
  infrastructure refactored inside a UI prompt, named here rather than left as an
  incidental diff. My original justification was **wrong in mechanism**:
  playwright is a devDependency and `npm ci` runs in CI's `build` job, so the
  import would have resolved. The real reasons are the job's stated
  "no browser, no network" contract, and not giving the four-counter invariant a
  second home. `verify-lib.mjs` re-exports; all 16 importers unchanged.
- **`window.__XMR_PANEL_THROW__`** — a documented test-only global following
  `__XMR_TIER_MS__`'s precedent, so boundary containment is provable repeatably
  in CI rather than by a mutation that must be reverted by hand.
- **`/sources` was NOT added to `verify-cls`'s `MEASURED`.** Planned, not done —
  it needs its own 8-run `--measure` baseline and the four required routes are
  covered. Named here rather than left to read as complete.
- **`useApiStatus` is an external store, not an effect**, because
  `verify-effects.mjs` keeps a hardcoded ledger of every `src/data/*` file
  containing `useEffect(`.

### For prompt 07, with numbers rather than a pointer

`styles.css:997` — `.mp-switcher { position: fixed; top: 60px }` is a hardcoded
topbar height, already in the tree and unguarded. `.topbar`'s box is declared
three ways: `:474` desktop grid `padding: 12px 24px`; `:1782` ≤768px flex
`padding: 10px 16px` **plus `env(safe-area-inset-top)`**; `:1883`
`flex-wrap: wrap; row-gap: 8px` (two rows). No constant satisfies all three.
The banner solved this by anchoring to `.shell`, whose top edge IS the topbar's
bottom edge by construction — the same fix is available to `.mp-switcher`.

**deps added:** none.

## 8 · LOOP FEEDBACK

`verify-shots` proves NOTHING about the crossfade: `freezeAmbient()` injects
`animation: none !important`, so it is structurally blind to it. Section B of
`verify-resilience-dom` is the actual proof. Do not let a green shots run read as
corroboration.
