# CLAUDE.md — Project Memory for Claude Code

This file is automatically read by Claude Code at the start of every session.
It serves as persistent memory so context, decisions, and progress carry forward.

---

## Project Overview

**xmr.irish — Satoshi's Vision Archive** — An educational site on Bitcoin's
surveillance trajectory and Monero's privacy architecture, rendered from live
chain and market data.

- **Type**: React 18 + Vite + TypeScript SPA in `app/`, prerendered to static HTML at build
- **Hosting**: Vercel only (`vercel.json`), with serverless functions in `api/` (mixed CJS/ESM)
- **License**: MIT

## Tech Stack

- `app/` — React 18 · Vite 5 · TS strict. The only front-end. `app/package.json` is the
  only real package manifest (`relay/` has one; there is no root `package.json`).
- `api/` — Vercel serverless, and **mixed**: `_nodes.js`, `feeds.js`, `nodes.js`,
  `status.js` and `xmr.js` are CommonJS; `coingecko.js` and `markets.js` are ESM
  (`export default`). This entry said "CommonJS" until v6.1.5 measured it per file.
  Mixing module systems here has broken this project before, so match the file you are
  editing rather than a rule — and a NEW file that must `require('./_nodes.js')` has to
  be CommonJS, because the ESM ones cannot.
- `relay/` — an unrun Node/TypeScript websocket relay. Not deployed.
- Vercel config: `vercel.json` — `outputDirectory: app/dist`, and a
  `/((?!api/).*)` → `/index.html` SPA catch-all. **Nothing at the repo root is served.**
- Verification: **77** `verify-*.mjs` files (`app/` ×70, `app/scripts/` ×1, `api/` ×6) — **73 gates**
  plus `verify-lib.mjs`, `verify-reporter.mjs` and `verify-fixtures.mjs`, three shared modules,
  and `scripts/verify-all.mjs`, an orchestrator. (This entry read "66 (app/ ×61, api/ ×5)" until
  v6.1.7 counted at full depth: an `app/verify-*.mjs` glob cannot see `app/scripts/verify-all.mjs`,
  so the old figure was one short and a shallow recount reports 69 where the answer is 70.
  It then read 73/69 until v6.1.9 recounted — v6.1.8's own additions were never folded in, so
  the figure was two low before that release added `verify-cbpending.mjs`. It then read 75/71
  until p2·7b recounted: #174 added `verify-tracking.mjs` and `verify-memstats.mjs` and never
  folded them in, so the same drift recurred one release later. Recount, do not
  increment: `find . -name 'verify-*.mjs' -not -path '*/node_modules/*'`.)
  v6.1.4 split
  `makeReporter` out of the former so an offline `api/` gate could use
  `fixture()` without a browser-automation library in its module graph). Most drive headless Chromium via Playwright; the rest
  are offline source assertions. `.github/workflows/ci.yml` runs **62 distinct files** on
  PRs to `main` **and, since p3·12d, on every push to `main`** — the workflow had never
  judged `main` itself, so every "main" figure was a PR-head proxy and the wall-clock gates
  had no same-runner baseline to difference against; read the `on:` block for the cost
  accepted. In two jobs: **12** individually-named offline gates, then `verify:static`
  (**21** gates, no browser), `verify:e2e` (29 gates, against `scripts/serve-dist.mjs`) and
  **five individually-named browser gates** — `verify:fit`, `verify:mobile`,
  `verify:perf-runtime` (v2·3b) plus `verify:tracking` and `verify:memstats` (#174), one
  step each with `if: always()`, never an `&&`
  chain, so a red one cannot make the others unanswerable. (Recounted, not incremented:
  57 → 60 → 62. **Count from `run:` LINES ONLY, with YAML comments stripped, and allow the
  `node ../api/verify-*.mjs` prefix** — p2·7b's first two attempts read 64 and 56: one
  matched gate names inside CI comments, the other missed all six `api/` gates because its
  regex assumed `node verify-`. Neither was trustworthy and their disagreement is what
  caught them.) **`verify:pageshell` is the fourth and is npm-wired ONLY**, held back under
  v2·3b's own "never wire a red gate" rule: it is 369/0 locally and red on a CI runner with
  `/future@1600: .main no h-scroll … over 4`, a PRE-EXISTING defect measured by reverting
  to 5537976 and rebuilding (2px local, 4px runner, against the gate's TOL of 2).
  `/future`'s `.v6-proto-grid` lays 4 tracks of 354.5px at 1600 while a `.v6-stagger` child
  grid sizes its column to a panel's 426.375px min-content and will not shrink. Fixing that
  is a layout decision across /future's breakpoint ladder; wiring the step is a one-line
  follow-up after it.
  v6.1.8 added three, and the two cold-boot gates sit at OPPOSITE ends of `verify:e2e` on
  DIFFERENT axes — state both, because they look contradictory: `verify-coldboot-live` runs
  **FIRST**, and `verify-hero` (static) runs first in its own chain. **`verify-coldboot` no
  longer runs last** — v6.1.9 moved `verify-vitals` there and the tail is now
  `verify-coldboot` #27 · `verify-orb` #28 · `verify-vitals` #29. The reason is the same
  dependency axis, applied to a gate nobody had classified: vitals sat at #27 with the two
  cold-boot FEATURE gates as its only downstream, so a wall-clock red — which reproduces on
  `origin/main` and is environmental — made the suite's own subject-under-test structurally
  unreachable on any busy machine. Vitals has zero dependents AND zero dependencies, and is
  the most contention-sensitive thing in the suite, so its failure is both the least
  informative and the most likely: exactly what belongs last. `verify-coldboot` keeps every
  masking-cost property it had; it now masks only vitals, which costs nothing.
  Eleven gates install the cold-boot bypass and then assert an ABSENCE, which passes whether
  the bypass worked, the selector died, or the splash never rendered. `verify-coldboot-live`
  holds the only positive control separating those.
  **A previous version of this entry argued the opposite and its reasoning was wrong.** It
  said: "these are `&&` chains, so a §1 failure ABORTS the run and the thirteen never report
  at all; there is no window in which they pass vacuously behind a dead proof." That inverts
  the causality. With the control LAST, the dependents run *before* it — measured on that
  chain: 27 entries, control at index 27, eleven dependents, all before it, none after — so
  they had already run and already printed green when the abort landed. A failing run
  displayed eleven passing gates that had proved nothing. The abort protects only what comes
  *after* the failure, and the whole problem was that nothing did.
  So the axis is **what depends on what**, not masking cost and not gate age. A LOAD-BEARING
  PRECONDITION goes first: its failure *should* abort, because everything after it is
  uninterpretable, and this one is a single navigation plus a count, so fail-fast is nearly
  free. It also may never `skip` — a skip there is neither a pass nor a failure, so dependents
  would run against an unproven control with nothing red anywhere; the gate asserts its own
  skip count is 0, which makes the dependency structural rather than documented.
  FEATURE ASSERTIONS go last, where a failure masks nothing: `verify-coldboot` keeps §2-§6
  (decrypt determinism, session gating, Enter handoff, reduced motion, 390px) plus §L Main
  Home legibility. It drives a canvas decrypt on a timeline behind a click gate, so it is the
  likeliest flake in the suite, and last is where that costs no other gate its result. Both
  properties are real — masking cost still governs `verify-coldboot`; it just never governed
  the control. **`verify-all` is where you go when you want the chain to teach fastest.**
  Four gates appear in both the named list and `verify:static` (`verify-stale`,
  `verify-confirmations`, `verify-txdetail`, `verify-feedcache`), and `verify-origins` runs
  in both `verify:static` (with `--static`) and `verify:e2e` — so 11 + 20 + 27 plus
  `verify-bundle`'s own build-job step is 59 invocations of 54 distinct files, not 59 gates. v6.1.3 added eight — `verify-prng`, `verify-gpu` (static) and `verify-roles`,
  `verify-motion`, `verify-nav`, `verify-discrete`, `verify-govern`, `verify-reduce` (e2e).
  v6.1.4 added four more: `verify-feedstatus` and `verify-provenance` (static),
  `verify-cls` and `verify-failure` (e2e).
  v6.1.5 added the first two **cost** gates — every gate before them checked
  correctness and nothing checked bytes or timings: `verify-bundle` (a named step in
  the `build` job, after Build — it reads `dist/`, and `verify:static` runs *before*
  the build in the other job, so it cannot live there) and `verify-vitals` (e2e).
  `npm run verify:all` runs the whole CI-reached set locally in one command with one
  tally; it is an orchestrator, not a gate, and is deliberately not in CI.
  **Four** more are npm-wired but not in CI (`verify:shots`, `verify:perf-classic`,
  `verify:mem:perf` — a baseline shot tree and a framerate measurement are both things a
  shared runner cannot produce honestly; `verify:perf` was renamed to `verify:perf-classic`
  in v2·3b, see the stale-literals entry for why — plus `verify:pageshell`, held back for a
  pre-existing `/future` layout red, see the verification block above). The remaining **7**
  are wired to neither npm nor CI — several expect live upstreams.

## Site Routes

The 13 static routes live in **`app/scripts/routes.mjs`** — the single source consumed by
both `scripts/prerender.mjs` (emits `dist/<route>/index.html` so the site works with JS
off) and `scripts/gen-sitemap.mjs` (emits `dist/sitemap.xml` + `dist/robots.txt`).
Add or remove a route there and both follow.

`/` · `/live/mempool` · `/live/markets` · `/live/markets/thesis` · `/live/network` ·
`/learn` · `/learn/sim` · `/monero` · `/future` · `/future/outlook` ·
`/operate/node` · `/about/peers` · `/about/sources`

Not in that list, by design: `/live/mempool/tx/:txid` (unbounded param, falls through to
the SPA shell), the `:tab` paths (`/monero/:tab`, `/learn/:tab`), the `?v=` / `?p=` /
`?range=` query surfaces, and every REDIRECT SOURCE — v6.1.6 added 12 of those, each a
301 in `vercel.json` mirrored 1:1 by a client `<Navigate>`, plus 2 fragment redirects that
a server structurally cannot see. Listing a redirect source would advertise a URL that
never serves its own content; `verify-redirects.mjs` proves the two lists agree.

v6.1.6 folded the duplicates in: `routes.mjs` now also exports `R` (named path
constants), `REDIRECTS` and `HASH_REDIRECTS`, and `src/layout/NavTop.tsx`,
`src/design/RootBoundary.tsx`, `src/nav/ia.ts` and `src/App.tsx` all derive from it rather
than retyping paths. One hand-maintained list remains BY DESIGN: `verify-lib.mjs`'s
`ROUTES`, a test-surface list that expands tabs and query permutations into 43 entries.

## Development Conventions

- Edit `app/src/**`; there is no hand-edited HTML. `app/index.html` is the Vite entry and
  carries the v6.0.7 critical paint floor — read the comment before touching its `<head>`.
- Security headers live in `vercel.json` only. CSP is `connect-src 'self'`: the browser
  reaches no third party, ever. Everything goes through `/api/`.
- `Math.random()` only inside `app/src/protocols/` (the educational simulators). **Zero
  fabricated values on live surfaces** — this has regressed once already. A live number is
  real or it is an em-dash; degradation is last-good plus "STALE · reconnecting", never
  synthesis. Feed health is ONE per-endpoint discriminated union — `MoneroLive.status`,
  `loading | live | stale | error` per endpoint (`app/src/data/feed-status.ts`), derived
  during render, never stored. It replaced four booleans in v6.1.4; read it through
  `hasData()` / `feedDegraded()` rather than comparing phases by hand.
- Provenance vocabulary, used verbatim in the UI: `NODE` / `COINGECKO` / `NETWORK` /
  `SESSION` / `MODEL` — FIVE since v6.1.7, declared once as `ProvSource` in
  `app/src/design/provenance.tsx`. Every displayed figure names where it came from.
  `NODE` and `NETWORK` are adjacent and the distinction is the point: NODE is telemetry
  from the node this site reads, NETWORK is a census of the nodes it does not
  (`/api/nodes`, sampled by monero.fail). **Nothing pins the member count** — the two
  `Record<ProvSource, …>` maps are the entire exhaustiveness mechanism, and both are
  compile errors until filled; `verify-provenance.mjs` pins `ProvFreshness`, not this.
- **Freshness is the other axis, and it is DERIVED — never written by hand.**
  `ProvFreshness` is FIVE (`live | loading | stale | error | none`, v6.1.4 added `error`),
  rendered by an exhaustive `freshSuffix` switch in `provenance.tsx`. Reach for
  `<NodeProvenance keys={[…]} status={data.status}>`, which resolves worst-of across the
  endpoints a panel actually reads; a literal `fresh="live"` is a claim no call site can
  keep — it stays green through a total outage — and `verify-provenance.mjs` fails the
  build on one that is not in its reasoned allowlist. Panels report their own endpoint's
  last-success time via `oldestFreshAt(status, keys)` → `PanelFrame`'s `updatedAt`, never
  `lastUpdate` (that is the feed heartbeat, and a gate fails the build on any UI read).
- Fonts are self-hosted from `app/public/fonts/` (12 woff2: Geist, JetBrains Mono,
  Newsreader). No CDN, no `fonts.googleapis`, no `fonts.bunny.net`. The site is used over
  Tor and the count of third-party browser requests must stay at **zero** — gated by
  `verify-origins.mjs`.
- Every route keeps its `noscript` block and a literal background floor; no white flash on
  any route, throttled or not. Usable at 390px, no text under 12px, and every animation
  ships a `prefers-reduced-motion` path that loses no information.
- **After a break test, restoring is not done until the tree proves it.** Deliberately
  breaking a gate to check it goes red is required practice here, and v6.1.3 shipped a
  session in which the restore was skipped: `ArtBackground.tsx:265` sat in the working tree
  reading the frame-governor dial and discarding it, so the governor shed nothing — exactly
  what its gate exists to prove. It never reached a commit, but every "green" run taken
  while it was there measured a tree that no longer existed. The sequence, in order:
  `git checkout -- <file>` → `git status --short` shows only intended changes →
  `grep -rn "MUTATION\|BREAK TEST" app/src app/*.mjs` is empty → *then* run the chain.
  Trusting the last green run instead of re-checking a clean tree is how this ships.
- **THE HARNESS LIES TO ITSELF, and it has cost more near-misses here than the code has.**
  A distinct family from the code defects the rest of this file records: the measurement
  apparatus reports a true fact about the WRONG SUBJECT. Three instances, all found by
  measurement rather than review:
  1. **v2·0's injection count** — a break test whose mutation silently did not apply, read
     as "the gate cannot catch this".
  2. **The shared `dist/` race (v2·1)** — three workers on one tree, one `dist/`, one
     server. A concurrent `npm run build` wipes `dist/index.html` mid-request, so a gate
     reads a half-written tree. **A result produced inside the race window is VOID, not
     suspect**: its subject is "whatever was on disk at that instant", which is not the
     tree. Discard and re-run; do not reason about whether it looked plausible. v2·1's
     rider-2 worker reported a scenario-6 timeout as a "pre-existing environmental issue";
     re-run in an isolated worktree, the gate completed all seven scenarios.
     **Serialise builds with a lock, and give each worker its own port.**
  3. **A `200` proves SOMETHING is listening — not that it is your server, or your build
     (v2·1).** A gate run measured a stale `vite preview` holding `:4173` and serving a
     DIFFERENT tree's `dist/`, while the reachability check read as "my build is up".
     **CORRECTION, and the reason this entry is worth reading twice:** this was first
     diagnosed and written down here as "bare `curl` answers through the agent proxy and
     returns 200 from an unbound port". **That diagnosis was wrong**, and it was wrong in
     exactly the way this section is about — asserted from a plausible mechanism instead of
     measured. Measured afterwards: bare `curl` to unbound `127.0.0.1:65123` and
     `:65124` returns `000`, exit 7. The proxy fabricates nothing. The real cause was a
     process the search missed: `ps`/`pkill` keyed on `serve-dist.mjs` never matches
     `vite preview`, and `ss -ltnp | grep :4173` printed nothing while `lsof` showed the
     listener plainly. So: **identify a port's holder with `lsof -iTCP:<port> -sTCP:LISTEN
     -P -n` (or `/proc/net/tcp` inode → pid), never by grepping `ps` for the name you
     expect.** An empty `ss` result is not proof a port is free, and killing "the server"
     by script name does not free a port another tool is holding.
  Consequence worth holding: "server died / port busy / timeout" has more than one
  candidate cause here that is not the server. Before recording a symptom as
  environmental, reproduce it somewhere the harness cannot confound it — `git worktree`
  with its own `dist/`, its own port, and nothing else building.
  The shape all four share, including the mis-diagnosis: **the subject was the environment
  rather than the thing under test** — the tree instead of the mutation, whatever was on
  disk instead of the build, some listener instead of yours, a plausible mechanism instead
  of a measurement. That is the same sentence as the code-defect family above, with a
  different noun.
- **A TOLERANCE IS AN UPPER BOUND ON THE ERROR A TEST CAN DETECT, NOT A SAFETY
  MARGIN.** Any assertion carrying a tolerance has a defect class it structurally cannot
  see, and **the tolerance is the size of that class**. v2·1's live example: sediment's
  canvas hit-test uses `hitR = max(p.r + 3, 6)`, chosen for thumbs, and that generosity
  silently became the detection threshold for a coordinate-space bug — a passing hit-test
  does not distinguish "the spaces agree" from "the spaces disagree and the tolerance
  absorbed it". The DPR case is the sharp end: on a 1× CI runner `eff === 1` and a
  backing-store-vs-CSS-px mismatch is EXACTLY zero, so it ships green and is wrong on every
  retina phone. When an assertion has a tolerance, name the error it is blind to, and
  verify that class by construction (trace the units) rather than by the assertion.
- **A STEP OR SUITE NAME MUST NAME WHAT IT RUNS.** `ci.yml`'s e2e step was called
  "Degraded-mode, Tor and single-origin gates" while running all 29 `verify:e2e` gates —
  three named, twenty-six not, including every mempool-view gate. Same narrower-subject
  family as the assertions above, sitting in the CI config; and it is the first instance
  here where the defect caused a CORRECT claim to be withdrawn rather than a wrong one
  asserted, which is strictly worse because the retraction reads as rigour. If a name
  cannot list everything, give the count and the load-bearing members.
- **AN EMPTY SEARCH RESULT IS EVIDENCE ONLY AFTER ITS SCOPE IS VERIFIED.** Three instances
  in the v2 series, two of them load-bearing: "no view imports `labelStep`/`tickCount`"
  (the grep was scoped to `src/mempool/` and `src/views/` and the result generalised to
  "no view" — `pages/markets/charts.tsx:31` had imported them throughout); a
  `git grep -ln … -- 'app/src/**'` that returned nothing because the PATHSPEC did not match,
  one sentence away from reporting a component absent that exists; and a `ps`/`pkill`
  pattern of `serve-dist.mjs` that could not see the `vite preview` actually holding the
  port. Widen the scope and re-run before concluding an absence, and state the scope
  alongside the result.
- **WHICH SPACE IS THE ASSERTION IN? Non-overlap is scale-invariant; legibility is not.**
  `.mp-fit` (`FitView`) wraps every fit-enabled mempool view in
  `transform: scale(min(1, canvasW / naturalW))`, and `useChartMetrics` latches the
  PRE-TRANSFORM layout width — a CSS transform does not fire ResizeObserver, which reports
  border-box (layout) size. So a chart's geometry lives in layout space while the reader
  sees it scaled. Measured on v2·1's sediment:

  | viewport | `.mp-fit` scale | authored | rendered FONT | (em box) |
  |---|---|---|---|---|
  | 1440 | 0.359756 | 11px | **3.96px** | 5.04px |
  | 2560 | 0.650085 | 12px | 7.80px | 10.4px |
  | 390 | 0.121231 | 11px | **1.33px** | 1.70px |

  **Read the FONT column, not the box.** `getBoundingClientRect().height` on a `<text>` is
  the em/line box, ~1.27× the font size — quoting it overstates legibility by 27%. And the
  three rows are TWO series, not one: 1440 and 390 sample the SVG tick, while 2560 samples
  a DOM label (`--fs-label` reaching its 12px `clamp` ceiling), which is why its ratio is
  1.333 against the other two's 1.274/1.275. Do not compute a trend across it.
  The general rule: **any assertion about an ABSOLUTE RENDERED QUANTITY must be measured
  after every transform between the author and the reader; any assertion about a RELATION
  between elements may be measured before them.** Collision, ordering, containment and
  non-overlap survive a uniform scale — which is why `verify-memviews` scenario 6 is sound
  in layout space. Font size, contrast area and hit-target minimums survive no scaling at
  all.
  **Consequence, recorded and NOT fixed in v2·1**: the type floor is asserted in authored
  space while users read rendered space, across all nine fit-enabled views. The machinery
  built for exactly this — `useChartMetrics`'s `k`/`u`/`minWidth`, `DEFAULT_MAX_K = 1.7`,
  whose docblock is explicitly about inflating an artboard's type so it survives being
  scaled down — is INERT, because no caller anywhere passes `vbWidth`, so `k = 1` and `u`
  is the identity. And 1.7 was chosen to hold a floor against a scale near 0.59, which the
  measured 0.36 already passes. Fixing it changes `useChartMetrics`'s contract with every
  chart in the app and belongs in its own change.

## Key Decisions Log

<!-- Add decisions here as they are made, newest first -->
- **2026-07-31**: v6.0.11 — mempool view hardening, built ON TOP of the shell
  that landed in main while this was in flight.
  **Read this before starting mempool work**: two streams independently built a
  mempool shell from the same brief. Main's won (it merged first, and its six
  views were already retrofitted); this branch was rebuilt on top of it rather
  than resolving nine conflicting files in its own favour. If you are handed a
  brief that says a prototype or a helper "already exists", verify it against
  the tree *and* against `origin/main` before building — the brief for this work
  named `six-new-a.jsx`, `MemViewShell`, `useMemCanvas`, `MemStatStrip` and
  `ConfirmationLineage` as existing, and at the time none of them did.
  **Correction to an earlier note**: tiered polling DOES now exist.
  `xmrirish-feed.ts` runs three tiers — FAST 3s (mempool + fee estimate), CHAIN
  15s (tip watch, full pull only when the tip moves), MARKET 60s. An earlier
  entry said it didn't; that was true of the pre-v6.0.9 base only. Practical
  consequence for tests: a confirmation count cannot advance faster than the
  15s chain tier, so any gate asserting 0→10 depth needs a timeout above that —
  12s measures the poll schedule, not the tracking.
  What this change adds on top of main's shell: `useMemCanvas.ts` (elapsed-time
  rAF, DPR-capped, visibility AND intersection gated as one predicate, memoised
  glow sprites — `ctx.shadowBlur` is banned and gated, being a full blur per
  draw call); `MemTxTable` + a `table` slot on `MemViewShell`, CSS-gated to
  reduced-motion and ≤768px; `id` → `data-mem-view` and `data-mem-track-phase` /
  `data-mem-track-conf` on TrackChip, which is what makes per-view deep links
  and 0→10 depth machine-checkable at all; the last two `Math.random()` sites
  (`terminal` typing jitter, `reactor` hex pulse) and the last three fabricated
  strings (`reactor` "in ~4 min"/"in ~2 min", `terminal` "target=2:00"); an
  honest overdue ETA (`nextBlockEtaSec` no longer floors at 0 — Poisson arrivals
  make overdue the ordinary case, and a countdown parked on "0:00" is a
  fabricated reading); and a scoped 12px mobile type floor for `.mem-view`.
  **Three constraints that will bite again**:
  (1) `verify-glide.mjs` scenario 4 loads `?v=classic` under
  `prefers-reduced-motion` and asserts the block ribbon STILL renders — so
  reduced motion must suppress *animation*, not *content*. Hiding the view body
  and swapping in a table breaks it.
  (2) `verify-fit.mjs` bounds Reactor's desktop vertical scroll at 200px and it
  already uses ~84px. Anything added below the body eats that headroom; the
  table is `display:none` on desktop for exactly this reason.
  (3) A `<canvas>` is a replaced element AND `.mp-view` is `width: max-content`
  on desktop, so an in-flow `width:100%` canvas is a layout feedback loop — it
  reached 658,432px wide in testing. `.mem-canvas` is `position:absolute` and
  `useMemCanvas` carries a `MAX_DIM` clamp plus a one-shot console warning,
  because nothing errors; it just gets mysteriously slow.
  Also: canvas cannot resolve `var(--x)` — `cssColor()` unwraps it, and
  `glowSprite()` re-resolves defensively, because an exception inside a rAF loop
  unmounts the whole view rather than degrading one particle.
  New gates: `verify-memshell.mjs` (static; prints the line-count table; strips
  comments before grepping, since the code legitimately names the banned
  patterns in its own docs; the useTick check is scoped to canvas paths per §5
  item 7 and REPORTS the four DOM/SVG views that still tick as standing debt),
  `verify-memviews.mjs` (Playwright, every registered view: deep links, cross-view
  stat parity off the raw `data-memstat-value`, tracked-tx idiom, 0→10 depth,
  390px, reduced motion, canvas count), `verify-memperf.mjs` (CDP 6× throttle,
  240 txs, 5th-percentile fps — reports `n/a — DOM/SVG` while no canvas view
  exists). npm: `verify:mem`, `verify:mem:dom`, `verify:mem:perf`.
  **Known gap**: SVG `<text>` inside views still renders below 12px on mobile
  (sediment worst, ~30 nodes at ~4px). `verify-legibility.mjs` excludes SVG
  presentation attributes by design, so `verify-memviews.mjs` reports the count
  rather than failing. HTML text is clean everywhere.
- **2026-03-11 — SUPERSEDED by v6.1.0**: four decisions were recorded here about the v4
  static site's exchange-widget page, its price-service polling interval, and iframe lazy
  loading. Every surface they governed was deleted in v6.1.0, and the liability reasoning
  behind the widget decision no longer applies to anything in the tree — the site embeds
  no third-party iframe and custodies nothing. Retained only as a pointer: if an exchange
  or swap surface is ever proposed again, read that reasoning in git history
  (`git show 0a49c1d:CLAUDE.md`) before designing it.
- **2026-03-11**: Established CLAUDE.md memory system for cross-session persistence

## Current Status / Progress

<!-- Update this section as work progresses -->
- The React SPA in `app/` is the only front-end. The v4 static site was deleted in v6.1.0.
- 13 static routes, all prerendered to real HTML so the site works with JavaScript off.
- Live data throughout: tiered polling (3s / 15s / 60s) against `/api/xmr` and `/api/markets`,
  degrading to last-good + "STALE · reconnecting" rather than to synthesis.
- `sitemap.xml` and `robots.txt` generated into `dist/` at build from `app/scripts/routes.mjs`.
- CI runs **62 of the 73** gates on every PR to `main` and on every push to `main`
  (p3·12d added the push trigger); **4** more are npm-wired by hand
  (`verify-memperf` · `verify-pageshell` · `verify-perf-classic` · `verify-shots`) and **7**
  are wired to nothing. This line read "57 of the 71 … 3 … 11" until p2·7b measured it; the
  three numbers had drifted independently, and the 11 contradicted the Orphaned-gates entry
  below, which said 7 and listed exactly the 7 a measurement finds.

## Known Issues / TODOs

<!-- Track open items here -->
- **WHY MOBILE HAS NEVER LOOKED RIGHT — measured root cause, not a polish problem.**
  `.mp-fit` scales a mempool view by `min(1, canvasW / naturalW)`. Sediment's natural size
  is **2279×2495** (`styles.css:1207`), so at a 390px phone the wrapper squeezes a 2279px
  artboard into roughly **276px — a scale of 0.1212**, and EVERY glyph in the view renders
  at about **1.3px**. Measured on v2·1, and it applies to all nine fit-enabled views
  (`FitView.tsx:11-12` excludes only Classic and Terminal).
  This has been read as a composition/spacing problem for several rounds. It is not, and
  **no work inside a view can affect it** — the wrapper scales whatever the view produces.
  Re-read every previous mobile observation against that number.
  The mobile port therefore has a DECISION to make before any layout work:
  (a) **do phones get `FitView` at all?** `MempoolPage.tsx:24` applies it unconditionally,
  while `styles.css:1210`'s `@media (min-width: 769px)` already carves desktop out of the
  shrink-wrap rule — so a separate phone path is half-expressed in CSS but the wrapper is
  not conditioned on it, and Classic/Terminal's exclusion is the precedent for the shape of
  the answer. Or (b) **engage `minWidth`**: `useChartMetrics` computes
  `minWidth = ceil(vbWidth / maxK)` and its docblock says that below it "the container
  stops shrinking and the artboard pans instead" — pan-rather-than-shrink is exactly right
  at 390. Unreachable today because no caller passes `vbWidth`, so `k = 1` and `minWidth`
  is 0 app-wide. Note `maxK = 1.7` was chosen to hold a floor down to a scale of ~0.59;
  the measured 0.36 (desktop) and 0.12 (phone) are both past what it was built to rescue.
- **The cold-boot console is ~2.7× the viewport on a phone, and the orb is below
  the fold there.** Measured at 390×844: the console root is **2282.6px tall in
  an 844px viewport** (2042.6 before v6.1.9's orb-slot change added 240), the
  splash stage is `position:fixed; inset:0; overflow:hidden` and centres it, so
  roughly 700px is clipped off each end and the orb slot at y≈886 is never
  visible. Pre-existing and independent of the orb fix — but it means "feature
  the orb" is not delivered on a phone, and `verify-coldboot` §6 does not catch
  it because it asserts `scrollWidth - clientWidth <= 0`, i.e. **horizontal**
  overflow only, while its heading reads as "usable at 390px". `verify-orb` §7
  reports it as a reasoned `skip` (`elementFromPoint` is viewport-relative and
  cannot confirm the stacking order on an off-screen element) rather than
  passing quietly. Fixing it is a layout decision — let the stage scroll on
  phone, or give the console a phone-specific composition — and belongs in its
  own change.
- **The desktop ENTER handoff carries real CLS and no gate sees it.** Measured
  at 1440×900, pressing ENTER at the console phase and observing 2.5s: counted
  CLS **0.0232–0.0434**, of which only 0.0049 falls inside the 500ms post-input
  exclusion window; dominant source `HTML>BODY>DIV>DIV` at 0.0198. The same
  measurement at 390×844 reads **0.0000** with the handoff verified to have
  occurred (phase went decrypt → gone), so the zero is real rather than vacuous.
  That is 5–9× the repo's own 0.005 ceiling. `verify-cls` is PHONE-only and
  never presses ENTER, so the handoff is outside its coverage on two independent
  axes. It follows deliberate user input and the transition is wanted, so this
  is a decision rather than automatically a defect — recorded with numbers so it
  can be taken deliberately.
- **`ColdBoot.tsx` computes an `assemble` value every frame that nothing reads.**
  It is pushed into the orb store each handoff frame and documented in that
  file's header as the value `Orb.tsx` uses to gate its own alpha/scale, but
  `Orb.tsx` destructures only `rect` and `active`. The documented "orb assembles
  over the field's final 14%" does not happen — the orb is drawn at full
  strength from the moment the console reports its rect. Found while diagnosing
  v6.1.9; not fixed there, because it is a choreography change rather than a
  rendering defect.
- **The orb is `display:none` for at least one commit right after the handoff.**
  `ColdBoot.tsx` writes a final rect with `active:false`, and `Orb.tsx` computes
  `useHome = rect === null || !active`, so it ignores that rect and switches to
  `useHomeOrbRect`, whose effect sets `null` before it measures. `verify-coldboot`
  §4 sleeps 2500ms after ENTER and so cannot see the blink.
- **Four route lists, one truth — RESOLVED in v6.1.6, except one by design.** `NavTop.tsx`,
  `RootBoundary.tsx`, `index.html`'s `#boot-fallback`, `useViewTransitionNavigate.ts` and
  `App.tsx` all derive from `routes.mjs`'s `R` now. `verify-lib.mjs`'s `ROUTES` stays hand-
  maintained deliberately — it is a 43-entry TEST SURFACE that expands tabs and query
  permutations, not a route list. `vercel.json` also restates the 12 redirects because JSON
  cannot import; `verify-redirects.mjs` makes drift between those two a build failure.
- **`useChartMetrics` measures in a `useLayoutEffect` keyed on the ref object**, whose
  identity never changes — so a component that returns `null` before its box mounts never
  attaches its ResizeObserver. The durable fix is a callback ref inside the hook; it touches
  19 call sites. See the v6.0.12 note.
- **SVG `<text>` below 12px on mobile** inside mempool views (sediment worst, ~30 nodes at
  ~4px). Reported by `verify-memviews.mjs` rather than failed. HTML text is clean.
- **The shot matrix cannot see SIX OF THE TEN mempool views.** `verify-lib.mjs`'s `ROUTES`
  carries `/live/mempool` at its default `?v=classic`, plus `?v=orbital` (p2·7),
  `?v=abyss` (p2·8), `?v=pulse` (p2·9) and `?v=circuit` (p2·10) — the four NET-NEW views,
  each added by the PR that introduced it, which is now an established convention rather
  than a run of three.
  **The uncovered SET has not changed since #174** — it is the ORIGINAL six — so the
  count moves with the denominator only, and after p2·10 it can move only once more:
  Relay is the eleventh and it is parked, so this item's final form is "six of eleven"
  unless someone closes it deliberately.
  `reactor`, `bridge`, `sediment`, `constellation`, `terminal` and the implicit `classic`
  remain unscreenshotted at any width or theme. Found while predicting the v6.1.3 sweep.
  `verify-reduce.mjs` and `verify-memviews.mjs` drive `?v=` explicitly, so the views are not
  unverified — but no human ever sees them in a shot tree, and a `--route /live/mempool`
  sweep silently means "classic only". (This read "five of the six" until p2·8; the count had
  been stale since #174 added the first `?v=` entry. The convention now established is that a
  net-new view adds its own ROUTES entry, so the gap only ever covers the ORIGINAL six.)
- **Stale route literals in orphaned gates — 46 of 68 CLEARED in v2·3b, and the deferral's
  own reasoning is why.** v6.1.6 renamed every top-level route and swept the CI-reached and
  npm-wired gates. The gates wired to NEITHER npm nor CI were deliberately left, on this
  stated ground: "nothing runs them, so a fix there cannot be proven correct, and 68
  literals of unverifiable churn on an already-large PR is a bad trade." That was right,
  and **wiring the gate is exactly what dissolves it** — v2·3b wired four, so their
  literals became provable and were fixed in the same PR: `verify-pageshell` 28 ·
  `verify-perf` 11 · `verify-mobile` 7 = 46. Still stale, still orphaned, still correctly
  deferred: `verify-chart-legibility` 12 · `verify-desktop` 6 · `verify-gradients` 3 ·
  `verify-responsive` 1 = 22.
  **THIS PER-FILE LIST WAS INCOMPLETE, AND THE OMISSION HAS A MECHANISM.** It listed only
  files with QUOTE-ANCHORED paths (`'/mempool'`). Three orphans reference routes solely
  through template interpolation (`` `${base}/mempool?v=${v}` ``), where the `/` follows a
  `}`, and a quote-anchored matcher is structurally blind to them: `verify-fit` (2),
  `verify-sims` (12), `verify-v508` (4). Confirmed rather than assumed — a quote-anchored
  count reproduces this list's figures EXACTLY for all four files v2·3b did not touch
  (12/6/3/1), and every orphan it omits is template-only. `verify-fit`'s 2 were fixed in
  v2·3b; `verify-sims` and `verify-v508` remain.
  `verify:perf` **was renamed to `verify:perf-classic` in v2·3b.** It ran
  `verify-perf-classic.mjs` while `verify-perf.mjs` was orphaned, so
  `grep verify-perf package.json` matched and the orphan read as wired — a substring trap
  that cost real time twice, including to the brief that set out to catalogue it.
  `verify-perf.mjs` is now `verify:perf-runtime`.
- **19 sub-12px `font-size` declarations in `styles-legibility.css`** (L63-66, 71, 73-75,
  77-78, 81, 84, 93-95, 98-100, 102). This is a STANDARDS CONFLICT, not a defect:
  `verify-legibility.mjs:124` records "v6.0.10: floor raised 10.5 -> 11. Nothing below 11
  ships" and `--fs-label` is `clamp(11px, 0.74vw, 12px)`, so the repo deliberately runs an
  11px floor — while the v6 prompt series asserts 12px. `verify-legibility.mjs` asserts NO
  rendered floor on any CSS selector; it checks inline TSX `fontSize` (sub-14) and SVG
  `fontSize` attributes (sub-11) only. Deciding the floor, and writing a gate that reads
  computed font-size on a named selector set, belong together in their own change.
- **Orphaned gates**: **7** `verify-*.mjs` are wired to neither npm nor CI — v2·3b wired
  four (`verify-pageshell` to npm only; `verify-fit`, `verify-mobile`, `verify-perf` to npm
  AND CI), taking 11 → 7 — an orphan is a gate wired to NEITHER, so npm alone clears it.
  (This said 13 until v6.1.5 measured it, and `:184` in this same file already said 11;
  v6.1.2 wired in `verify-contrast.mjs`, `verify-ground.mjs` and, via a new `verify:shots`
  npm script, `verify-shots.mjs`.) `verify-shots.mjs` is npm-wired only, deliberately not
  CI: a `--baseline` diff needs a shot tree built from another commit, which CI has no way
  to produce, so it stays a by-hand comparison tool. The remaining 7 are
  `verify-chart-legibility` · `verify-desktop` · `verify-gradients` · `verify-legality` ·
  `verify-responsive` · `verify-sims` · `verify-v508`. Several expect live upstreams and
  one (`verify-v508`) declares itself HISTORICAL in its own header; auditing and wiring
  them is its own task.
  **COUNT THE RIGHT SUBJECT.** A token sweep of `verify-*.mjs` against `package.json` and
  `ci.yml` returns **14** unreferenced files, not 7 — because `verify-lib.mjs`,
  `verify-reporter.mjs` and `verify-fixtures.mjs` are SHARED MODULES, imported by 29, 8
  and 1 gates respectively. They are unreferenced by design and are the most-executed code
  in the suite. A v2·3b census reported 14 as "orphaned gates" and described ~2,000 lines
  that never run; ~600 of those lines run on every CI job. 14 files − 3 libraries = 11
  gates before that PR, 7 after.
- **MoneroSpace's lineage is an open question** with `brainchainz`. Its own repo
  (`brainchainz/Monero-Superbrain`) points at a different origin than the one this site's
  earlier copy asserted, and the maintainer has not answered. Neither account is
  confirmed, so `pages/future/data.ts`, `FuturePage.tsx` and `protocols/stressnet.tsx`
  name the project and link the repo and assert **neither** provenance.
  `verify-future.mjs` fails the build if a lineage claim reappears anywhere in the tree —
  do not "restore" one without an answer from the maintainer.

## Architecture Notes

| Concern | Where it lives |
|---|---|
| Routes (canonical list) | `app/scripts/routes.mjs` → `prerender.mjs` + `gen-sitemap.mjs` |
| Mempool views (canonical list) | `app/src/views/mempool-meta.ts` — pure data, imports NOTHING. `views/index.tsx` binds components via `Record<MempoolViewId, ViewComponent>` and derives `MEMPOOL_VIEWS`; `nav/ia.ts` derives its list AND its "· N views" count through `nav/registries.mjs`. **SIX gates parse this file's source text** with `/\{\s*id:\s*"([a-z]+)"/g` (memviews · tracking · memstats · memperf · memshell · nav) — keep each `id:` a plain double-quoted literal, and see the file header before moving it |
| Chain + market data | `api/xmr.js`, `api/markets.js`, `api/feeds.js` (CommonJS, node cascade in `api/_nodes.js`) |
| Client polling tiers | `app/src/data/usePolling.ts`, `xmrirish-feed.ts` |
| Markets hero (canvas) | `app/src/pages/markets/CandleCanvas.tsx` (canvas geometry + a DOM label layer + the brush + the D0847 table) over `markets/candle-data.ts` (the three bases, the bucket ladder, the date-axis format). Canvas draws NO text — every glyph is DOM, because canvas glyphs are invisible to `verify-legibility`, to collision sweeps, to find-in-page and to a screen reader |
| CSS custom property → canvas colour | `app/src/design/canvasColor.ts` — a leaf whose importers must ALL be lazy. It was homed in `chart-kit.tsx` first and cost **757 eager bytes**: `design/primitives.tsx` imports chart-kit and the entry chunk imports primitives. `useMemCanvas.ts` re-exports it so the FIVE views that call it (abyss · circuit · orbital · pulse · sediment) keep their import path — the other five mempool views never imported it. Seven lazy chunks import the leaf, which is what makes Rollup mint it a chunk. **CORRECTED in p3·13 — "the invariant has no gate; `eagerJsRaw`'s headroom would swallow a violation silently" is half wrong, and was asserted rather than measured.** Measured by importing a leaf from the eager `App.tsx`: `eagerJsRaw`, `eagerJsGz`, `lazyJsRaw`, `totalJsRaw` and the chunk-count detector ALL stay green (+12,941 B raw), and the last two move the *reassuring* way — lazy goes DOWN, and the leaf's own chunk is ABSORBED so the count falls back into band. What reds is the PER-ROUTE first-load table, as a side effect: eleven routes paying for something they never render. The three that do not notice are `/`, `/live/markets` and `/learn` — and `/` is the LCP route the rule exists to protect. It is a SIZE threshold, not a rule: the tightest route margin is 642 B gzip, so an eager leak under ~650 B gzip (~2 KB raw) clears every ceiling in the file. Full table beside `lazyJsRaw` in `verify-bundle.mjs` |
| Shared time cursor (D0834) | `app/src/design/timeCursor.ts` — a LAZY LEAF, and NOT `chart-kit.tsx`, which is eager-reachable (measured: chart-kit's `data-charttip` and its `rgba(8,7,5,0.94)` fill are both present in the entry chunk `dist/index.html` names in its own `<script src>`). Traffics in **TIMESTAMPS, never pixels** — each of the four `/live/markets` time-axis charts projects `t` through its OWN geometry, so `verify-chartkit`'s "cursor math lives only in chart-kit" stays satisfied by construction rather than by exemption. `containsT(t, from, to)` is the ONE domain predicate: a chart whose window excludes `t` draws NOTHING and must never clamp. Subscribers are called from one rAF and mutate canvas/DOM through refs, so a pointermove re-renders no chart it did not already re-render at `04006ff`. Rollup INLINED it into `charts-*.js` (both importers land in one chunk group) — so "a shared leaf costs a chunk" is really "a leaf shared ACROSS GROUPS costs a chunk", and only a build tells you which you wrote |
| Timeline events (canonical) | `app/src/data/timeline.ts` — 49 events, ONE source for `/learn/timeline` and the `/live/markets` annotation layer (D0833). A lazy leaf importing NOTHING; both importers (`EducationPage`, `MarketsPage`) are `React.lazy`, so Rollup mints it its own 12,973 B chunk. **`d` is the display string and the ONLY thing any surface may print as a date**; `iso`/`iso2`/`tent` are POSITION ONLY, `iso` is the interval's START never a midpoint, and `verify-markets-dom` re-derives all 49 from `d` so a hand-edited one fails the build. `slug` is a URL (`/learn/timeline?e=<slug>`) — change a title freely, a slug only deliberately. Parsed from SOURCE by the gate, `mempool-meta.ts`'s idiom: keep each event a one-line, plainly-double-quoted literal |
| Visual system | `styles.css` declares `@layer reset, base, theme, components, utilities;` once — layer order, not the `styles.css` → `styles-ambient.css` → `styles-theme.css` → `styles-motion.css` → `styles-legibility.css` import order in `main.tsx`, decides the cascade (v6.1.2; the fifth sheet landed in v6.1.3) |
| Device tiering | `app/src/design/deviceTier.ts` (`high\|mid\|low`, stamped pre-paint) |
| Educational simulators | `app/src/protocols/**` — the only place `Math.random()` is allowed |

**If a feature needs a third party**, it goes through a function in `api/`, never the browser:
CSP is `connect-src 'self'` and the site is used over Tor. Cache at the edge via `s-maxage`
matched to the client's polling tier, and never cache a degraded payload at the full TTL.

## Session Notes

- **2026-08-15**: p3·14 "NETWORK: THRESHOLD BANDS" (app/) — `/live/network` gets D0832 bands,
  a block cadence strip and both simulator cross-links. **Three of the brief's premises did not
  survive measurement, and two of them are about the SPEC rather than the code.**
  **THE MOCKUP ASKS FOR A BAND THIS CHAIN CANNOT HONESTLY DRAW, TWICE OVER.**
  `markets-network-mockup.html:239` says the hashrate band is "the trailing **30-day** ±1σ
  envelope". (a) Nothing in `app/` fetches a 30-day series — scope stated: `app/src`,
  `app/*.mjs`, `app/scripts`, zero hits for `network/difficulty` or `network/hashrate`, which
  exist in `api/xmr.js` (:786-789) and are **unconsumed server surface**. What the client holds
  is `/api/xmr/blocks?limit=100` (`map.ts:26 BLOCKS_CAP = 100`) — **100 headers ≈ 3.3 hours**.
  (b) **`api/xmr.js`'s own range labels are wrong by 10×**: `counts = {'7d':504, '30d':2160,
  '1y':26280}` capped at 5000, which at the 120 s target is **16.8 h / 3.0 days / 6.9 days**.
  Every label implies a **20-minute** block (168/504 = 720/2160 = 8760/26280 = 0.333 h). So the
  parameter named `30d` returns three days, and adopting the API's own range name as a band
  label would ship the mislabel the band rule exists to prevent. **NOT FIXED HERE** — relabelling
  to `{'1d':720,'3d':2160,'7d':5040}` is truthful at 120 s and adds no RPC load, but nothing
  consumes it, so it is a separate change and is recorded rather than smuggled in.
  **THE MOCKUP'S CADENCE BAND IS A CORRECT BAND FOR THE WRONG QUANTITY**, and this is the
  release's real finding. "Healthy 96–150s · warn 150–200 · critical >200" is sound for the MEAN
  of ~100 intervals and badly wrong per-block, because arrivals are **Poisson** — exponential
  inter-arrivals are memoryless, not clustered about their mean. Applied per-tick on a **healthy**
  chain: P(>200s) = e^(−200/120) = **0.1889**, P(>150) = **0.2865**, P(<96) = **0.5507**, so only
  **16.3%** of blocks land inside "healthy" and a fifth are painted critical. Meanwhile 96–144 is
  *exactly* 120 ± 2σ for the mean of 100, σ = τ/√n = 12 s. **So the strip draws NO per-tick band**
  and the band goes on the aggregate, where it is closed-form from the consensus target rather
  than from "observed variance". `verify-bands.mjs` pins all four probabilities so nobody
  re-derives the per-tick band from the mockup a second time.
  **AND §5's DUAL-AXIS IS STRUCTURALLY UNBUILDABLE: hashrate IS difficulty ÷ 120 here.**
  `api/xmr.js:438` and `:482` both compute `hashrate_ghs = difficulty / 120 / 1e9`, and
  `map.ts:166` computes `hashrate = difficulty / target`. There is no independent hashrate
  measurement anywhere in this stack — no node can observe one. Plotting the two "together to
  show the lag" would draw a feedback loop with **exactly zero lag by construction**, which is a
  fabricated insight on a live surface. The panel says so in one sentence instead, and the
  Thermostat link moves to DIFFICULTY, framed as the retarget controller's output against the
  cadence strip below as the process it controls — genuinely independent measurements.
  **`/live/network`'s BUDGET ROW WAS STALE BY 1,344 B**: the comment read 106,035 while the clean
  tree measured **107,379** against 108,000 — **621 B of slack**, not the ~2,000 the row implied.
  Raises, red-then-green on the FINAL tree: `lazyJsRaw` 845,000 → **852,000** (built 848,882) ·
  `totalJsRaw` 1,108,000 → **1,115,000** (built 1,111,757) · `/live/network` 108,000 →
  **113,000** (built 109,732). Delta **+6,872**, attributed whole and paired by multiplicity
  within each stem: **NetworkPage +6,120 · charts +752**, 64 of 67 stems byte-identical, **67
  chunks both sides so nothing was minted**, and the **eager entry is byte-identical** —
  `eagerJsRaw` did not move at all.
  **THREE DEFECTS FOUND BY LOOKING, one of which a gate caught first.** (1) The cadence strip is
  the SEVENTH charted panel and drew no STALE watermark — `verify-failure` went red at "7 charted"
  because it treats any `<svg>` in a panel body as a chart and requires the watermark to agree with
  `data-stale`. It dimmed on a dead endpoint while claiming nothing. (2) The band **widens the
  y-domain by design** (a band computed from a threshold can sit wholly outside the data, and a
  clipped band is worse than none), which compressed the series and pushed the high-marker label
  onto a y-tick: `420.00G` and `420.93G` overlapped, both unreadable. Markers are off whenever a
  band is drawn — they were the redundant half. (3) **PanelFrame's header is uppercased, and CSS
  `text-transform` maps σ → Σ** — not a styling wobble but a different operator, summation rather
  than standard deviation. The chip says "outside 3 SD"; the source note is body copy and keeps σ.
  **`fullPage` IS A NO-OP ON THIS LAYOUT above 768px** — `.art` is `height:100vh; overflow:hidden`
  and `main.main` is the scroller, so the first desktop captures silently returned only the first
  screen and could have been read as "the cadence strip does not render". Tall viewport instead.
  **NOT TAKEN, and said out loud**: §1's streaming line, §3's small multiples, §6's node-sync
  shell, and cursor adoption (§0.6). The last is a REASONED refusal rather than a shortfall:
  `AreaSeries` already takes `t[]` and `sync`, so it is a prop flip — but `Block` carries `age`
  in seconds, not a timestamp, so the axis would be `Date.now()`-derived and drift between
  renders, and the three network charts have three unrelated domains (14 blocks · 100 intervals ·
  a session buffer with no chain-time axis at all). Two of three would always draw nothing, which
  `containsT` handles correctly and which is not "one instrument".
  Gates: **78 files / 74 gates**, RECOUNTED — `verify-bands.mjs` is the one added (78 = 74 + 3
  shared modules + the orchestrator). `verify:static` 21 → **22**; CI distinct files 62 → **63**,
  since verify:static is a CI step (`ci.yml:238`). Four break tests, each restore proven against
  the COMMITTED BLOB: **M1** population σ → 1 red · **M2** cadence at 1σ → 3 · **M3b** an emptied
  source sentence → 3 · **M4** the sample floor removed → 1. **M3's first attempt was too weak**
  (it removed 22 chars from a 192-char sentence, so the >40-char check legitimately still passed)
  and an earlier anchor missed entirely — the mutator's own `assert n == 1` caught that one, and
  the green run printed after it is an UNMUTATED tree, not a failed detection.
  Bound gates green on the final tree: verify-failure **16** · verify-nodes-dom **22** ·
  verify-cls **20** (CLS held at the 0.005 ceiling — the strip reserves `CADENCE_H`) ·
  verify-tiers-dom all · verify-bands **48** · verify-bundle **27**.
  **No human has seen the rendered result in a browser** — the renders were read from screenshots.

- **2026-08-15**: p3·13 "MARKETS: SYNCED TIME CURSOR + THE ANNOTATION LAYER" (app/) —
  the four time-axis charts on `/live/markets` become one instrument, and the timeline
  the site already owned becomes something the price chart can point at.
  **TWO NEW LAZY LEAVES, AND THEIR CHUNK FATES DIFFER FOR A REASON NOTHING IN THE
  SOURCE PREDICTS.** `design/timeCursor.ts` (the shared cursor) and `data/timeline.ts`
  (the 49 events, lifted out of `pages/_education/Timeline.tsx`) are both leaves, both
  imported by two lazy modules. `timeline` got its own **12,973 B chunk**; `timeCursor`
  was **INLINED into `charts-*.js`**. The difference is chunk GROUPS, not importer count:
  `MarketsPage` and `charts` resolve into one group, `MarketsPage` and `EducationPage` do
  not. So the standing rule is not "a shared leaf costs a chunk" but **"a leaf shared
  ACROSS GROUPS costs a chunk"**, and only a build tells you which you wrote.
  **THE CURSOR TRAFFICS IN TIMESTAMPS AND THE LEAF CONTAINS NO PIXEL ARITHMETIC.** Four
  charts, four geometries, and — the part that matters — **four DOMAINS**: the hero shows
  the brushed window, the ratio chart follows it, the two `MultiLine` groups show the
  RANGE. A pixel or a fraction would look portable and silently mean a different moment in
  every chart. `containsT(t, from, to)` is the one predicate and **a chart whose domain
  excludes `t` draws NOTHING — never a clamp**, which is the honest-motion doctrine applied
  to a cursor. Because the write side still goes through chart-kit's `useSvgCursor` /
  `canvasCursor`, `verify-chartkit`'s "cursor math lives only in chart-kit" stays satisfied
  BY CONSTRUCTION rather than by an exemption.
  **THE RE-RENDER LEDGER, STATED PRECISELY BECAUSE THE NAIVE VERSION IS FOUR TIMES WORSE.**
  Subscribers are called from ONE rAF and mutate canvas/DOM through refs. The chart under
  the pointer re-renders exactly as often as it did at `04006ff` (`useSvgCursor` holds `vx`
  in React state); the other three re-render **zero** times. The hero is strictly better
  than before — its `cursorT` was `useState` and is now a ref, so a pointermove over the
  hero no longer rebuilds its label layer, its brush and the D0847 table's memo chain.
  Net renders added by the feature: **none**.
  **`eagerJsRaw` MOVED BY 23 BYTES AND EVERY ONE IS ACCOUNTED FOR.** A non-view PR under an
  explicit "eager must not move" instruction, so they were chased: **+30 B is one new string
  in Vite's `__vite__mapDeps` preload table** (`"assets/timeline-CWoXTI3v.js"`) and **−7 B**
  is the rest of the entry getting marginally shorter as the indices into that table shift.
  Measured, not inferred — the mapDeps array went 37 → 38 entries, that one addition, no
  removals, its block grew exactly 30 B and the entry grew 23. (An earlier draft of this
  note said +36/+6, true of a tree three commits old; the re-measure rule caught it for the
  THIRD time this session.) The **negative control** is the half that
  matters: `grep 'Bitcoin Whitepaper Published'` and `grep 'CryptoNote v1'` both return 0 in
  the entry chunk AND in vendor, so 13 KB of prose is provably not in first paint.
  **AND THE LAZY-LEAF RULE'S OWN CLAIM WAS WRONG — MINE, AND CLAUDE.md's.** Both said the
  invariant "has no gate" and that `eagerJsRaw`'s headroom "would swallow a violation
  silently". Asserted from a plausible mechanism, which is the family this file says has
  cost more near-misses than the code. Measured by importing `@/data/timeline` from the
  eager `App.tsx` with an unshakeable reference:

  | budget | clean | eager import | verdict |
  |---|---|---|---|
  | entry chunk | 99,973 | **112,914** | +12,941 |
  | `eagerJsRaw` | 262,888 | 275,829 ≤ 280,000 | ✅ PASSES |
  | `eagerJsGz` | 88,196 | 93,663 ≤ 96,000 | ✅ PASSES |
  | `lazyJsRaw` | 841,974 | 828,932 ≤ 845,000 | ✅ went DOWN |
  | `totalJsRaw` | 1,104,862 | 1,104,761 | ✅ PASSES |
  | chunk count | 67 | 66 within 64±4 | ✅ leaf's chunk ABSORBED |
  | per-route first load | — | — | ❌ **10 of 13 RED** |

  Every budget NAMED for eager weight passes, and the two detectors most likely to notice
  both move the *reassuring* way. What reds is the per-route table, as a side effect —
  eleven routes paying for something they never render. **The three that do not notice are
  `/`, `/live/markets` and `/learn`, and `/` is the LCP route the rule exists to protect.**
  It is also a SIZE threshold rather than a rule: the tightest route margin is
  **642 B gzip** (`/about/sources`), so an eager leak under ~650 B gzip (~2 KB raw) clears
  every ceiling in the file. 13 KB was loud; a helper function would be silent. The real
  assertion — "no eager chunk contains a string only this leaf declares" — is a small
  separate change and is **not** taken here.
  **THE TIMELINE'S DATES ARE POSITION-ONLY, AND THAT IS THE WHOLE HONESTY DESIGN.** The 49
  events are editorial and deliberately imprecise where the history is: "2013 – 2014",
  "Mid-2026 (tentative)", a bare "2026". `d` remains the ONLY string any surface may print
  as a date; `iso`/`iso2`/`tent` exist to place a flag and never become text. A day-precise
  event draws a point; anything wider draws a **BAND over the interval it denotes**, with
  the dot at the interval's START rather than a midpoint nobody wrote down. An interval
  wider than 60% of the window carries no position at all and is counted separately
  ("undated at this zoom") instead of smeared across the plot.
  **THE DEFAULT VIEW IS EMPTY AND THAT IS THE TRUE ANSWER, NOT A GAP.** `DEEP_DAYS` is 365
  and the timeline starts in 2008, so at the 30D preset there is genuinely nothing to mark:
  the note reads "4 undated at this zoom · 45 outside this window", and the BRUSH STRIP —
  which spans the whole fetched span rather than the window — still carries one flag. That
  is the entire argument for putting flags on the strip. At 1Y: 4 in view, 3 groups, one of
  them a cluster of 2. **Extending `DEEP_DAYS` to reach deeper history was NOT taken** — it
  is a request-budget and cache decision that the §1d request gate and the coingecko cache
  comment would own, and it is not this PR's to take silently.
  **FOUR THINGS THE GATE CAUGHT IN ITS OWN FIRST DRAFT, and three are the standing family.**
  (1) **A VACUOUS DOMAIN-MISMATCH PROOF.** The first version hovered a group chart at 2% of
  its width, watched the hero draw nothing, and passed. 2% is inside the y-axis GUTTER,
  where `MultiLine`'s own `cursorT` is null — nothing was ever published and the hero had
  nothing to refuse. Every mismatch assertion is now PAIRED with "the group chart is showing
  its own readout at this instant", which is proof a timestamp reached the store. Under M3
  (publishing disabled) that guard goes red at 0/12 rather than certifying silently.
  (2) **A PROBE THAT HOVERED NOTHING.** At 1440×900 the group panels sit at y≈1358, below
  the fold; `mouse.move` to an off-viewport point hits nothing, and the probe reported "the
  group charts do not sync" — a convincing false defect. Caught by `elementFromPoint`
  returning `none`, which is now an assertion in the gate ("every probe point landed on a
  real element"), not a comment.
  (3) **`\b17\b` DOES NOT MATCH `Jul 17XMR`.** The readout runs the date straight into the
  first series name, so a word-boundary check went red against four charts that agreed
  perfectly. Compared as a prefix now.
  (4) **AN ASSERTION THAT WAS THE WRONG STATEMENT.** "Only imprecise dates draw a band" went
  red against correct code: a day-precise event denotes a whole DAY, ~3px at a one-year
  zoom, so it bands too and honestly should. The band is driven by rendered EXTENT, not by a
  precision category. Replaced with the assertion that actually has content — a month reads
  **81.9px against a day's 2.6px at the same zoom** — which is what breaks if an interval is
  ever collapsed to a point.
  **`verify-hero` WENT RED ON THE EXTRACTION AND WAS RIGHT.** `pages/home/passages.ts`'s
  `monero-launch` record cites the file its quotation lives in; the quotation moved to
  `data/timeline.ts` and both halves of the record (text AND attribution) failed. A citation
  is a claim about WHERE a sentence is, and that claim had become false. Repointed; the text
  is byte-identical either side of the move.
  Budgets, all red-then-green on the FINAL tree, every byte paired by MULTIPLICITY (the
  `index` stem holds two chunks and the pairing asks `dist/index.html` which is the entry —
  a basename diff would file a LAZY delta under the EAGER budget): `cssGz` 17,600 →
  **18,200** (built 17,762) · `lazyJsRaw` 831,000 → **845,000** (built 842,010) ·
  `totalJsRaw` 1,094,000 → **1,108,000** (built 1,104,885) · `/live/markets` 112,000 →
  **121,000** (built 117,827) · `CHUNK_COUNT` 62 → **64** (67 chunks; ±4 unchanged, and 64
  rather than 63 so the band is [60, 68] and reality is not sitting on the ceiling — one
  rung of upward headroom, said here rather than left to be rediscovered).
  **FIVE chunks moved of 67; the other 62 are byte-identical**: timeline +12,973 ·
  EducationPage −9,218 · MarketsPage +5,899 · charts +3,931 · entry +23. Lazy +13,585 and
  total +13,608 reconcile to the byte. `eagerJsRaw` ceiling untouched.
  Built on the FINAL tree: cssGz 17,762 (margin 438) · lazyJsRaw 842,010 (2,990) ·
  totalJsRaw 1,104,885 (3,115) · /live/markets 117,827 (3,173) · eagerJsRaw 262,875.
  Gates: **77 files / 73 gates, RECOUNTED and unchanged** — no gate file added; 77 = 73
  gates + 3 shared modules + `scripts/verify-all.mjs`, the orchestrator. CI unchanged at
  **30 `run:` lines / 21 gate-invoking / 62 distinct files** (68 invocations − 6 duplicates).
  `verify-markets-dom` **74 → 118 assertions** in three new sections; `verify-hero` repointed.
  (That gate prints no numeric tally, so quote the instrument: `grep -c '✅'` bounded to the
  gate's own range reads 75 → 119 and one line of each is the summary. Bound it with an
  explicit end pattern — `awk '…,0'` runs to end-of-file and sweeps the 28 gates after it.)
  **`verify-effects`' ledger did NOT move and should not have** — its completeness sweep is
  scoped to `src/data/` only, so this PR's three new effects (two in `charts.tsx`, one in
  `CandleCanvas.tsx`) are outside it by design. Worth knowing before assuming that gate
  covers a hook you just wrote.
  **THREE DEFECTS FOUND BY LOOKING AT THE RENDER, none of which any gate could see, and
  the first is a defect the SYNC CREATED out of two correct pieces.**
  (1) **"Feb 26" IS FEBRUARY 2026.** `charts.tsx`'s `fmtDate` switches to
  `{month:"short", year:"2-digit"}` above 90 days, which is fine on an axis where
  neighbouring ticks disambiguate it. The synced cursor put it next to the hero's
  `2026-02-12`, so two charts reporting ONE moment printed two strings a reader compares
  and reads as two dates. Neither piece was wrong; the adjacency was new. The readout emits
  an ISO day now and the AXIS is untouched — changing `fmtDate` moves every tick on every
  chart in the app and is its own change.
  (2) **The layer toggles were BELOW THE FOLD**, because the page mounted them after
  `</CandleCanvas>` and the D0847 table lives INSIDE it: a control for marks at the top of
  the plot, reachable only by scrolling past a 210px table it does not govern. A `controls`
  slot puts them between the brush and the table.
  (3) **A 9px flag was the whole touch target.** The 26px cluster rule turns out to be
  load-bearing twice — WCAG 2.2 AA 2.5.8 has a SPACING exception that 26px already
  satisfies, so the layer conformed; a `::after` grows the hit area to 23px, which still
  fits inside that spacing so two flags cannot land under one thumb.
  **AND THE GATE'S OWN "one moment" ASSERTION WAS PHASE-DEPENDENT — p3·12b's lesson
  arriving from the other side.** It asserted the hero's date string EQUALS the synced one.
  That is true only when the cursor lands on a bucket boundary: at 390 the hero read
  `2026-02-18` (the 3-day candle it hovered) and the readouts `2026-02-20` (the moment),
  both correct. Replaced with two claims — the three synced readouts are byte-identical to
  each other, and the hero's BUCKET CONTAINS that moment, checked against the bucket width
  the page itself reports.
  **THE RENDER PROBE'S `shot()` WAS WRONG THREE TIMES, EACH THE SAME SPECIES**: the file
  was written, the name was confident, the content was of something else.
  `elementHandle.screenshot()` scrolls, and a scroll under a stationary pointer fires
  pointerleave — a `-flag-tip` with no tip. `page.screenshot({clip})` rejects a clip outside
  the viewport, so the 390 run stopped after one file. `{fullPage:true, clip}` accepts it
  and MIS-PLACES it, because `boundingBox()` is viewport-relative while a fullPage clip is
  in page coordinates — it cropped the header. Hover states are plain viewport captures now,
  and the shutter refuses to fire unless the thing the filename claims is measurably on
  screen.
  Pre-existing and NOT fixed, proven structurally rather than by a paired render: the
  hero's date axis **collides at 390 on the 1Y preset** ("Jul '2Oct '25"). `candle-data.ts`
  and `useChartMetrics.ts` are byte-identical to `04006ff`, so `axisTicks`, `fmtAxisDate`,
  `axisStepMs` and `fs.tick` are unchanged and the axis is a pure function of untouched
  inputs.
  **`git add -A` SWEPT A SCRATCH PROBE INTO A COMMIT.** `app/.render-p313.mjs` rode into the
  `verify-govern` commit and was removed in the next one. The bracketed
  "stray files" sweep is what found it, and only because it ran against `git ls-tree` rather
  than the working tree — a working-tree check says nothing about what is already committed.
  Six break tests, each restore proven by `git status`, by `diff` against the **committed
  blob**, and by a bracketed marker sweep: **M1** domain guard removed → the mismatch
  assertion reds while the vacuity guard stays green at 10/12 · **M2** tooltip prints `iso`
  → `"2025-10-03" === "Oct 3, 2025"` reds, education parity stays green · **M3** MultiLine
  stops publishing → sync 0/10 AND the vacuity guard 0/12 · **M4** one `iso` moved 10 days
  → `[["Oct 3, 2025","2025-10-13",null]]`, one assertion, everything else green · **M5**
  clustering off → no badge, min gap 13px · **M6** a truncated body → 0/49 render verbatim.
  **No human has seen the rendered result in a browser** — the renders were read from
  screenshots.

- **2026-08-15**: p3·12d "VITALS CALIBRATION" (app/ + .github/) — the instrument repair
  #179's red demanded. No `src/**` file is touched and the build is byte-identical; every
  defect here is in the measuring apparatus, which is the family this file says has cost
  more near-misses than the code has.
  **A CEILING THAT WAS NEVER SATISFIABLE, AND TWO GREEN RUNS THAT CARRIED THE PROOF.**
  `/live/mempool`'s 4,000 ms LCP ceiling has never been met on CI's runner class. Nine
  samples, three runs, **three different runners and TWO DIFFERENT TREES** — #159
  `f0fc8179` (circuit branch) 4092/4080/4076 · #160 `d3aa03e` 4132/4108/4108 · #161
  `690ead6` 4104/4084/4108 — spanning **4076–4132, a plateau 1.4% wide**. A plateau that
  tight across two trees and two runner states is a property of the RUNNER CLASS and of
  neither. Locally the same route reads 3,684–3,732.
  **THE BRIEF NAMED THE WRONG GUARD AND SO DID p3·12b's ENTRY.** Both attributed the
  abstentions to the spread guard. The spread guard has **never fired on that route** —
  1.4% against a 10% threshold. #159 and #160 were declined by the **CPU-probe** guard
  (503 ms and 512 ms against a 260 ms reference). The recorded blind spot is real; the
  guard credited with it was not, and a 1.4% number disproves it in one line.
  **DERIVED, NOT ADOPTED**: high-water single sample **4,132** × **1.05** — half of
  `LCP_SPREAD_UNSTABLE`'s own 10% band, so the headroom comes from the gate's own
  constant rather than from taste — = 4,338.6, rounded up to **4,350**. The full 10%
  (4,545) was the other candidate and is rejected in-file: the plateau's own width is
  1.4%, so a 10% ceiling would need a 7×-the-noise regression before it spoke. Margins
  242 ms (5.9%) over the highest observed median and 246 ms (6.0%) over the one a healthy
  runner judged. **A CALIBRATION TO THE JUDGING RUNNER, NOT A CONCESSION** — nothing got
  slower, and the printed per-run series still shows a local regression on the run that
  causes it. **Headroom is now quoted one way everywhere in that file** (as a percentage
  OF THE MEASURED VALUE), because the first draft mixed the two conventions inside one
  comment block: 4000 over 3010 is +33% of the measurement and +25% of the ceiling.
  **AN ABSTENTION THAT READ AS A PASS, AND THE INFORMATION WAS ALREADY ON SCREEN.**
  A decline printed its runs and threw the CONCLUSION away, so a reader had to hold the
  ceiling in their head. #159 declined `/live/mempool` at **4080** and #160 at **4108**,
  both against a 4,000 ceiling, both runs REPORTING GREEN — the gate exits 0 when every
  route declines, so `✅ verify-vitals: 6 passed · 4 skipped · 0 failed` is what CI showed
  for a run that judged nothing. Both decline paths now route through one `decline()` that
  prints the median, its ceiling, a would-have verdict and the spread, and shouts
  `VITALS_DECLINED_OVER_CEILING` when a declined median exceeds its ceiling.
  **THE DECISION IS WARN, NEVER FAIL, and it is taken out loud in the file**: failing on a
  number the gate has just called UNVERIFIABLE is this file's own header inverted — a red
  a re-run clears is a red people learn to click through, and two of three CI runs here
  were contended. **THREE THINGS MAKE THE WARNING COUNTABLE ANYWAY**, because a ⚠️ in no
  counter is the same invisibility one level up: one skip per UNMADE ASSERTION rather than
  one per route (a run declining four routes said "4 skipped" for EIGHT assertions never
  made — the skip count is not comparable to a pre-p3·12d one), the banner re-printed
  BELOW `R.finish()`'s tally where a reader's eye actually stops, and an offline
  falsifiability PAIR over CI #161's real numbers: 4104 fires against the retired 4,000
  and stays silent against the shipped 4,350. The second reads the SHIPPED literal, so it
  is not a tautology — it reds if anyone lowers the ceiling under 4104. The four-counter
  contract in `verify-reporter.mjs` (8 importers) was deliberately NOT grown.
  **TWO ASSERTIONS WERE WIDER THAN THE THING THEY COULD NOT JUDGE**, same family, found
  while writing the above: the `continue` on decline also discarded the structural "did
  the scripted click land" check (a contended runner answers that fine — measured cost:
  three assertions silently never made in #159 and #160), and the global interaction
  budget asserted `worst scripted interaction 112ms ≤ 400ms` ✅ over exactly the routes the
  same run had declared unverifiable. First moved above the declines; second excludes
  declined routes and skips loudly if none remain.
  **`main` HAD NEVER BEEN JUDGED — not once.** `ci.yml` fired on `pull_request` only, so
  every "main" figure was a PR-head proxy (#159's `f0fc8179` stood in for `84e2b77` only
  because the trees were identical, which took a separate manual check to establish).
  `push: branches: [main]` added, out loud, with the cost stated: the deterministic half
  IS duplicate signal on merge, ~25 runner-minutes, accepted because the wall-clock half
  cannot be — its subject is partly the machine — and because `pull_request` CI never
  judged a MERGED tree either, so two PRs green in isolation and red together had no gate.
  A schedule was the rejected alternative (it decouples the measurement from the commit).
  Verified event-agnostic rather than assumed: no step reads `github.event`, and "Wait for
  preview" polls `http://localhost:4173/` from the serve-dist started one step earlier —
  not a Vercel preview. And the new comment block was swept for `verify-*.mjs` FILENAMES,
  because `verify-coldboot-live`'s §0 decides wiredness by `wiredText.includes(f)` over
  package.json + **raw ci.yml with YAML comments unstripped** — naming an orphan in a
  comment would silently move it into wired-must-install-bypass. It names none. **The
  first sweep used `verify-[a-z-]+\.mjs` and would have missed `verify-v508.mjs`**; the
  digit-tolerant re-run is the one that counts.
  **THE RESTORE PROTOCOL FAILED TWICE, IN TWO DIFFERENT WAYS, AND BOTH GENERALISE.**
  (1) A break-test shell's `cd` did not survive, so `npm`, `grep` and
  `git checkout -- verify-vitals.mjs` all failed from the repo root — and the trailing
  "restore verified" grep printed EMPTY, which reads exactly like a clean restore, while
  the wrapper reported exit 0 because the last `echo` succeeded. (2) Worse: the mutation
  left by (1) was still in the working tree when the next edit landed on top of it, and
  `git commit --amend` **committed the mutation**. The `git status --short` I checked said
  `M verify-vitals.mjs`, which was true and answered a narrower question than the one I
  drew from it — I grepped for the new function and never re-grepped the markers.
  Caught by the mutator's own `assert n == 1` on the NEXT round, which found 0 matches for
  a string it had just replaced. **The rules: commit before EVERY break-test round, not
  once per session, so `git checkout` has a real target; verify the COMMITTED BLOB with
  `git show HEAD:<file> | grep`, never the working tree; and bracket every
  proves-an-absence grep with `<<<`/`>>>` so empty is distinguishable from crashed.**
  Gates: **77 files / 73 gates, RECOUNTED and unchanged** — editing a gate adds no file and
  a `push:` trigger adds no `run:` line. CI unchanged at **30 `run:` lines / 21
  gate-invoking / 62 distinct files** (12 named + 21 static + 29 e2e + 5 + bundle = 68
  invocations − 6 duplicates). **Found and NOT fixed, out of scope**: the entry above at
  `:73` says FOUR gates appear in both the named list and `verify:static`; it is FIVE —
  v6.1.9 added `verify-cbpending` to both and the sentence was never updated. The 62
  reconciles only with five.
  Runs on this runner, final tree: **verify-vitals 17 passed · 0 fixtured · 2 skipped ·
  0 failed** (`/live/mempool` 3684 ≤ 4350; `/learn/sim` declined at an 80.2% spread — the
  documented `/simulate` BIMODAL second mode, 2528/4520/2508 — printing both medians as
  "would have PASSED" with no warning, which is the no-warning polarity arriving without a
  mutation). Four break tests, each restore proven by tree state AND marker grep:
  **M1** forced decline + ceiling 1000 → all four declined, mempool `WOULD HAVE FAILED`
  with the banner, three others `would have PASSED` without it, interaction ✅ still made,
  global interaction budget skipped naming all four; **M2** ceiling 1000, guards normal →
  `❌ median LCP 3692ms ≤ 1000ms`; **M3** `CPU_REF_MS=1`, `VITALS_RUNS=1` → the OTHER
  decline path plus the `n/a (fewer than 2 LCP samples)` branch; **M4** the retired 4,000
  put back → the offline self-check reds **before a browser launches** while the local
  judged assertion `3676ms ≤ 4000ms` PASSES. M4 is the sharpest artifact in the set: on
  this machine the retired ceiling passes, and the gate still reds, because CI's own
  measured number does not clear it.
  **`verify-bundle` 27 passed · 0 failed with every literal untouched**, and the build
  inputs are provably unchanged (`git diff fc5cfc1 -- app/src app/index.html app/scripts …`
  is empty), so no byte moved. `-100%` appears in M1's transcript wherever the shipped code
  prints `10%` — that is `LCP_SPREAD_UNSTABLE = 0` showing through the mutation, not a
  defect. M2's third red (`/live/markets median blocking 402ms ≤ 400ms`, 2 ms over, on an
  untouched route) is this runner, not the mutation, and is stated rather than counted.

- **2026-08-14**: p3·12b "ONE CORRECTION COMMIT" (app/) — a wrong dollar figure, an
  axis that could not say which day, and eleven stale self-counts.
  **THE DEFECT: A BRUSHED WINDOW'S LAST CANDLE ABSORBED THE VOLUME OF EVERYTHING TO
  ITS RIGHT.** `attachVolume` closed its final bucket at `Infinity` — correct for
  the only case it was written for, an unbrushed view whose last candle really does
  run to the end of the data, and wrong the moment a brush pulls the right edge
  inward. Measured on the shipped build at a zoomed 4h window: **$9.7B in one
  bucket** where every true 4h bucket read $480M, in the table, in the hover tip,
  and as a full-height VOL bar that flattened every other bar through `maxV`.
  **No gate could have caught it: twenty-odd assertions on that page count bars,
  rows, labels, requests and pixels, and not one of them read a NUMBER the chart
  prints.** A live surface printing a fabricated-looking figure is the first rule
  in this repo, so the gate learned to read one.
  **THE FIRST FIX WAS WRONG IN THE OTHER DIRECTION, and an adversarial pass caught
  it before it shipped.** Bounding the bucket by its own width is right; ALSO
  clipping the samples to the drawn window looked symmetric and is not.
  `aggregateCandles` clips at CANDLE granularity — it keeps or drops a whole source
  candle on `c.t <= to` — and on the fine base the 4h rung is the only one a ≤30d
  window ever reaches, so the last drawn candle's OHLC describes a FULL four hours.
  Clipping its volume at a `to` one hour into that bucket left one bar's two halves
  describing different spans: whole-bucket high/low above, a quarter of its volume
  below. **Up to 4× under-reported, on the same cell the upper bound was watching.**
  **A THIRD DEFECT FROM THE SAME PASS, never rendered but reachable**: `mid ?? deep`
  can hand DAILY samples to 4h buckets — visit 1Y so the deep base is fetched, have
  the 90-day request fail (the hook's per-base catch blocks are independent), and
  every sixth bucket shows a whole DAY's volume while five show zero. A day cannot
  be split across six four-hour buckets without inventing the split, so
  `attachVolume` now refuses a source coarser than its bucket and the volume reads
  as an em-dash. Real or absent, never synthesised.
  **THE BREAK TEST FAILED TO GO RED FIRST TIME, AND THAT WAS THE FINDING.**
  Reintroducing the window clip left the gate GREEN: `win.to` had landed in the last
  quarter of its bucket, the one phase in four where the clip is a no-op. The
  assertion — a max, then a median — was not wrong so much as unproven, and a
  max-plus-median cannot see a single under-reported cell anyway. Replaced with
  **equality on EVERY cell** (the fixture's volumes are constant, so on the fine
  base every drawn bucket must carry exactly one bucket's worth), which reds under
  the mutation at `["480M","480M","480M","480M","120M"]`. **A gate driving a
  CONTINUOUS control has phases where a given mutation is invisible; the assertion
  must be universal over buckets even when the state that exercises it is not.**
  Restored per the standing protocol — revert, `grep -rn MUTATION` empty, `git
  status` clean, rebuild, re-run — and the marker was chosen so the grep could not
  match the prose describing the break test.
  **THE AXIS COULD NOT SAY WHICH DAY.** At 7D the tick step is ~21h, under a day, so
  the step rule emitted `05:00 · 02:00 · 23:00 …` — every label true, every tick on
  a different date, the sequence apparently running backwards, and two adjacent
  labels actually IDENTICAL (9 ticks, 8 distinct). p3·12 fixed "distinguish your
  neighbour" and this is its other half: **a tick must also be locatable.** A
  sub-daily label carries its day whenever the window spans more than one. At 390
  the two-pass tick solver converges to fewer, wider-spaced ticks and falls back to
  bare days, which is correct and is why that width needed its own assertion.
  **ELEVEN STALE SELF-COUNTS, and the instrument was wrong as often as the number.**
  Six were p3·12's own (eager +504/262,530/17,470 → **+826/262,852/17,148**; a lazy
  margin that was both stale AND misarithmetic — "1,688" where 831,000 − 828,312 is
  2,688; "six view chunks ±38 ea" where FIVE moved by 38, being exactly the five
  `cssColor` importers, and four others moved by amounts the row never mentioned;
  MarketsPage +15,813 → +15,926; the route row; `useMarketHistory`'s "21 → 12" where
  the gate measures 10). Five were PRE-EXISTING and two of those are **printed on
  every run**: the CSS source size (203,896 → **254,399**), `/mempool`'s "six view
  engines" (→ **ten**, stale since p2·7), and a `maxChunkRaw` comment naming
  SimulatePage at 180,572 as the largest chunk when it is 6,513 and the vendor chunk
  is 162,915.
  **"gzip -9" NAMES THREE DIFFERENT COMPRESSORS AND THEY DISAGREE.** On the entry
  chunk: `node:zlib` gzipSync({level:9}) **35,016** · the gzip(1) CLI **34,969** ·
  python3 `gzip.compress(…, 9)` **34,924**. `verify-bundle` judges with node:zlib, so
  every gzip figure p3·12 took from the CLI was a true measurement of a quantity the
  gate never computes — it put a ~100 B error inside a 432 B margin, and produced a
  phantom "≤50 B unattributed, which is vendor/index[0] rounding" on the route
  attribution. Measured with the right compressor over the closure the gate actually
  sums (read out of `.perf/bundle-graph.json`, 10 chunks, JS only), the route
  attributes to **residual ZERO**: MarketsPage +5,880 · charts −1,312 · canvasColor
  +278 · entry +376 · PanelBoundary +1 · Skeleton −1 = **+5,222** against a measured
  103,696 → 108,918. **Measure gzip with the thing that will judge it.**
  **AND THE COMMENT CORRECTING THE DIGITS HAD THREE WRONG DIGITS**: the first draft
  of that very table read "+5,220 against 103,698" and signed PanelBoundary
  backwards. Paste a measured table; do not retype one.
  **THREE MEASUREMENTS OF THE EAGER DELTA, ALL CORRECT, ALL DIFFERENT** — a
  reviewer's +826 at `d3aa03e`, this session's +849 mid-flight, and +826 again on the
  final tree — because the tree moved between them. Only the final tree's figures may
  ship, which is the whole content of the re-measure rule and is now the fourth
  release it has caught.
  **`verify-vitals` IS RED AND IT IS THE RUNNER — paired, not assumed.** The final
  tree and the PRE-p3·12b head were measured on the same machine minutes apart,
  serving from two ports with the holders confirmed: `/live/markets` LCP **4,216
  branch / 4,180 base**, blocking **433 / 406**, `/` blocking **404 / 441**, and
  the SAME THREE assertions red on both. A 36 ms difference (0.9%) on a
  measurement whose own run-to-run spread this file has recorded at 80-86%.
  **The same runner reported markets LCP at 2,280-2,296 ms two hours earlier**,
  which is the whole finding: the machine moved, the tree did not. p2·8 already
  recorded the shape — "in the full e2e chain markets LCP read 4460ms;
  standalone and idle it read 2240ms".
  **AND THE SPREAD GUARD DID NOT FIRE, which is its blind spot stated plainly.**
  It skips a route when the three runs DISAGREE by more than 10%; here they
  agreed closely with each other at a uniformly elevated level. The guard catches
  JITTER and cannot see a PLATEAU, so a sustained-load runner produces confident,
  reproducible, wrong numbers — and the only instrument that separates those from
  a real regression is a paired run against another tree on the same machine.
  **CORRECTION, p3·12d: the paired run is no longer the ONLY instrument, and this
  entry named the wrong one of the two guards for #179's own red.** `main` now
  carries its own same-runner baseline (`push: branches: [main]`), so the pairing
  a human had to construct by hand is produced on every merge. And measured
  across CI runs #159/#160/#161, `/live/mempool`'s nine LCP samples span **1.4%**
  — the spread guard has never fired on that route at all; both abstentions came
  from the **CPU-probe** guard. The blind spot recorded above is real and the
  plateau reading is right; the guard credited with it was not.
  Report-and-stop: no vitals budget moved, and none should be.
  Gates: **77 files / 73 gates, unchanged.** `verify-markets-dom` gained a volume
  section (upper bound, last-cell, and every-cell equality) plus 7D and 390 axis
  assertions with a falsifiability SELF-CHECK for the one predicate that has no
  natural red; `verify-stale` gained six `attachVolume` unit assertions, red on the
  pre-fix module at `[400,400,1600]` · `[800,1600]` · `[2400,0,2400]`. Budgets
  unchanged from p3·12's raises — every built figure moved, every ceiling held.

- **2026-08-14**: p3·12 "MARKETS: CANVAS CANDLES + BRUSH" (app/ + api/) — Phase 3
  opens. The hero is canvas, the range presets stop refetching, and the
  accessible table ships in the same PR because a canvas has no accessibility
  tree at all.
  **THE DISEASE WAS NOT WHERE THE BRIEF SAID, AND MEASURING IT FIRST CHANGED THE
  WHOLE DESIGN.** The brief opens "a daily series at 30D is 30 bars across
  ~1,600px". Counted on a build of `84e2b77` with the upstream mocked at
  CoinGecko's OWN documented granularity: **7D 42 · 30D 180 · 90D 22 · 1Y 91**.
  30D was already 180 four-hour bars. The sparse range is **90D**, where `/ohlc`
  switches to FOUR-DAY buckets and 22 bars carry a quarter of a year. A fix
  aimed at 30D would have improved nothing and reported success.
  **THE UPSTREAM IS THE CONSTRAINT AND IT BOUNDS THE WIN.** Two endpoints, two
  granularity tables, neither negotiable below Enterprise: `/ohlc` gives 30m/4h/4d
  by depth, `market_chart` gives 5m/hourly/daily. **There is no request that
  returns four-hour candles for a year** — which is what the mockup's synthetic
  base (13,200 4h candles over 2,200 days) assumes, and why this ships THREE
  bases rather than its one. After: **7D 43 · 30D 180 · 90D 361 · 1Y 122**. 90D
  is 16×; 7D and 30D are UNCHANGED because they already sat at the upstream's
  finest TRUE granularity and moving them would have traded real wicks for
  sampled ones.
  **TRUE vs DERIVED IS ON THE FACE OF THE CHART**: a FINE bar is CoinGecko's own
  OHLC and aggregating k of them is exact; a MID/DEEP bar is built here from a
  price series, so its high and low are the extremes of the SAMPLES. The badge
  says "4h OHLC" or "6h sampled" and the full label ("6h · hourly samples") is
  on `data-candle-gran` and in the table caption.
  **MIN_SAMPLES = 3 IS WHY A DERIVED LADDER DOES NOT START AT ITS SAMPLE
  INTERVAL.** One sample per bucket gives o=h=l=c — a doji, at every bar,
  forever. 365 daily dojis at 1Y would have been *denser* than the 91 bars it
  replaced and strictly less informative.
  **THE REQUEST BUDGET IS THE BRUSH'S PROOF.** History is fetched as three
  BASES, not per range, so the pair effect no longer sees `days` at all.
  Measured on `verify-markets-dom`: 30D cold **6 → 5**, all four ranges
  **21 → 10**, `/ohlc` calls **4 → 1**, and 7D and 90D issue **ZERO** CoinGecko
  requests. **`btcLine` was fetched on every range change and rendered by
  NOTHING** — four wasted round trips a visit against a 10,000-call month;
  confirmed repo-wide before deleting, and its absence is now the assertion
  (`chartIds === ['monero']`).
  **FIVE DEFECTS FOUND BY LOOKING, none of which any gate saw**, all after the
  gate chain was green: (1) at 90D the date axis read **"May '26 May '26 May '26
  Jun '26…"** — nine ticks, three distinct strings, an axis you cannot
  interpolate against. The format was keyed on the total SPAN; only the tick
  STEP knows whether "month" can separate neighbours, so it is keyed on the step
  now. (2) A **"$500" price tick escaped the panel** and rendered against the
  page background: `niceTicks` rounds outward past yMax, and in SVG the viewBox
  clipped it — a canvas label layer has no viewport to hide behind. (3) At 390
  the table headers broke **inside the words** ("Ope n", "Hig h", "Clo se").
  (4) The full granularity label wrapped `PanelFrame`'s header to three lines at
  390 — pre-existing shared behaviour, recorded three times before; only the
  string length was mine, so a compact form was added. (5) Gridlines and their
  labels computed their tick sets **independently** (painter: hardcoded 11px and
  5 ticks; labels: `fs.tick` and `tickCount`) — two derivations of "where the
  line goes" that agree only until someone touches either. One array now.
  **THE cssColor MOVE COST 757 EAGER BYTES AND THE MEASUREMENT IS THE LESSON.**
  The markets hero is the first canvas surface outside `src/mempool/`, so
  `cssColor` needed a shared home. `design/chart-kit.tsx` is the obvious one —
  it already hosts `canvasCursor` and imports only React — and it is EAGER, one
  hop: `design/primitives.tsx:19` imports chart-kit, and the entry imports
  primitives. Verified in the built artifact: the branch's entry chunk carried
  the `var(…)` regex and the `#ffffff` fallback; the baseline's did not. Re-homed
  in `design/canvasColor.ts`, whose importers are all lazy. **That invariant has
  NO GATE and `eagerJsRaw` has 17,148 B of headroom, so a future eager import
  would cost hundreds of bytes and never be noticed** — named in the leaf's
  header and in `verify-bundle`, not enforced.
  **A GREP THAT COUNTS MENTIONS IS NOT A GREP THAT COUNTS IMPORTS.** `grep -l
  cssColor src/` returned 12 files AT THE BASELINE; **five** imported it, all in `src/mempool/`,
  all lazy. The other six NAME it in docblocks that exist to say they carry a
  SIBLING implementation — `coldboot/field.ts:59` says "not an import of it" in
  as many words. Both a reviewer and this session read 12 as consumers before
  measuring; the predicted consequence (eager may move) came true through a
  mechanism that was impossible by the repo's own design. `verify-orb` **223
  passed · 1 skipped · 0 failed** as the negative control.
  **THE PERSISTED SCHEMA STAYS `mh:v1:`, DELIBERATELY.** No surviving key
  changed shape; the rewrite adds a KIND (`samples|…`) and retires two. Bumping
  to v2 orphans the caches that are still VALID — the fine base, every group
  series, both manifests, the meta — which is exactly what a returning visitor
  on a blocked upstream falls back to. The three dead kinds are pruned instead
  (`pruneLegacyCache`, gated both directions in `verify-stale`: everything doomed
  goes, everything else stays).
  **FIVE CEILINGS RAISED, all red-then-green on the FINAL tree**: `cssGz`
  17,000 → 17,600 · `lazyJsRaw` 820,000 → 831,000 · `totalJsRaw` 1,082,000 →
  1,094,000 · `/live/markets` 105,000 → 112,000 gzip · `CHUNK_COUNT` 61 → **62**
  (66 chunks; re-centred, not widened, exactly as that comment instructed the
  next PR). **The `/live/markets` row's `95,817` comment was stale by 7,879 B
  BEFORE this PR** — main measured 103,696 against 105,000, 1,304 B of slack.
  **The 66th chunk is a shared LEAF, not a view**, which that comment did not
  anticipate: it predicted Relay would spend the last rung. Nothing in the
  detector distinguishes the two.
  **THE SHARED-`dist` RACE BIT, and the fix was to discard rather than reason.**
  A full `verify:e2e` run was killed mid-chain by a `npm run build` started in
  another shell; it returned 40+ `ERR_CONNECTION_REFUSED`. Void, not suspect —
  discarded and re-run. `verify-coldboot-live`'s §0a build-SHA check then caught
  the same class from the other side: a dist built before the commit, serving
  `84e2b773` while HEAD was `31604c1b`.
  **DESCOPED, out loud**: §5's seven-line privacy-group rework. Hero + brush +
  table + the granularity ladder + five gate sections is a full PR, and the
  group panels keep their per-range aggregator fetch for a stated reason —
  `/api/markets?days=365` returns DAILY series, so windowing one deep fetch
  would hand the 7D peer chart seven points where it has 168 today. Also not
  built: D0836 wheel/pinch inertia (it must `preventDefault` a wheel over a tall
  scrolling page, and momentum would put a rAF loop on the one hero in this app
  that is otherwise completely motion-free) and any extension of `RANGE_DAYS`
  past four (the aggregator's cache-key space is those four values by design,
  and the brush now reaches every window between them).
  Gates: **77 files / 73 gates, RECOUNTED and unchanged** — no new gate file;
  `verify-markets-dom` grew a canvas-hero section and tightened three §1d
  literals, `verify-stale` gained the prune block, `verify-effects`' ledger for
  `useMarketHistory` went 2 → 3 effects (the split IS the feature: bases keyed
  `[wantDeep, retryNonce]`, aggregator `[days, retryNonce]`). Two-polarity for
  the whole set: **38 assertions red** against a `84e2b77` build in an isolated
  worktree, 0 red on the branch.
  **No human has seen the rendered result in a browser** — the renders were read
  from screenshots.

- **2026-08-14**: p2·10 "CIRCUIT" (app/ only) — the **tenth** mempool view, the fourth
  net-new one of the eleven, and the last buildable one: after this only Relay remains and
  it is parked. **Its coordinate is a SUM OVER OTHER TRANSACTIONS, and it is the only one in
  the suite that is.**
  **THE LANE IS A CATEGORY, NOT A COORDINATE**, which is the whole separation from the two
  views that already own a fee axis. Sediment encodes fee as a CONTINUOUS vertical stratum
  and orbital as a CONTINUOUS radius; a bus lane is neither — it is one of the node's own
  four `get_fee_estimate` tiers, and within a lane position encodes NOTHING about fee. The
  moment it did, this would be sediment with gaps. `CIR_LANES` is `FEE_TIER_LABELS.length`,
  so no literal 4 is written anywhere in the view.
  **THE ALONG-TRACE AXIS IS QUEUE DEPTH** — the cumulative weight AHEAD of a transaction in
  the fee-sorted fill, in bytes, right-to-left from 0 at the chip's pins, so moving toward
  the chip is moving toward inclusion and the die's left edge is the inferred cut.
  **A PACKET'S EXTENT ON THE AXIS IS ITS WEIGHT**, so the pool TILES the axis edge to edge
  and occlusion between packets is STRUCTURALLY IMPOSSIBLE rather than managed — the answer
  this view gives to the density problem every other canvas view solves by bucketing.
  **THE IDENTITY CLAIM NEEDED STATING PRECISELY, BECAUSE THE LOOSE VERSION IS FALSE.**
  Orbital, Abyss and Pulse all normalise a fee against the pool's own observed [lo, hi], so
  the rest of the pool does affect where a mark lands — but only as a SCALE, and under any
  renormalisation two transactions paying the same rate coincide. Here they cannot: their
  positions differ by the weight of everything between them. Cumulative, not rescaled.
  **THE STAIRCASE IS REAL AND IS STATED RATHER THAN DRESSED UP AS A DENSE SCATTER.**
  `feeTierIndex` is monotone in `perB` (data/map.ts:51-54) and the fill is fee-sorted, so a
  lane's traffic occupies exactly ONE contiguous stretch and three of the four lanes are
  bare copper at any given depth. Not a defect: those boundaries ARE the node's published
  tier floors expressed as a queue depth, drawn as vias, and no other view offers that
  reading.
  **MOTION IS HONEST, AND A PCB INVITES THE DISHONEST KIND.** A packet gliding between polls
  would assert positions the feed never reported, so every packet is STILL between polls and
  steps when the feed steps; the only moving thing is a dash-offset direction current that
  carries no reading and says so on the face of the view. **The clock is `useMemCanvas`'s
  elapsed `t`, NOT `Date.now()` — the one place this view deliberately inverts orbital's,
  abyss's and pulse's choice**, and the inversion is principled: those three derive a
  COORDINATE from wall-clock, so a frozen animation clock would resume drawing a stale
  reading as a live one. Nothing here is derived from time at all. **The reduced-motion twin
  therefore loses NOTHING** — not a number, not a position, not a click target — which is
  true of no other canvas view in the suite.
  Fluid FOURTH time, worked first try: all six `naturalW == canvasW` cells YES — 1440 →
  1180/1180, 1280 → 1020/1020, 390 → 366/366, in BOTH feed states — no `.mp-fit` anywhere,
  authored 11px rendering at 11px including at 390. Height derived from the measured width
  (`clamp(w × 0.48, 250, 420)` → 353 / 302 / 250-floor); c8 hero cell 596 against `canvasH`
  702, so the desktop composition needs no vertical scroll. **The EMPTY-feed face is an
  intact board** — lanes, copper rails, arrival pads and the depth ladder all drawn, no die
  (the node published no weight ceiling, so there is no next-block boundary to draw) and
  em-dashes in every panel.
  **NINE DEFECTS FOUND BY LOOKING, NONE OF WHICH ANY GATE SEES** — every one rendered,
  carried correct numbers and overflowed nothing:
  (1) **146 transactions in the dense lane rendered as ONE SOLID BAR** — the tiling is
  exact, so adjacent packets share an edge. Fixed with a 0.75px hairline, and **the gap is
  VISUAL, NEVER POSITIONAL**: it is subtracted from the drawn WIDTH with the rect anchored
  at `cirX(ahead)`, so nothing is displaced and the tiling stays exact in DATA space. A
  positional gap would accumulate to 180px of lie over 240 transactions and the axis would
  stop meaning bytes. Measured after the fix: drawn rightmost edge **721.328125 == g.right
  exactly**, leftmost 256.551 against `cirX(poolBytes)` 257.0 — 0.45px out, which is the
  floor's own documented bound and nothing else.
  (2) **The die was invisible** — a flat `--bg-2` wash was indistinguishable from the board,
  so the chip read as one dashed line. Now a lit slab with a package outline, a pin-1 notch
  and pins on both edges.
  (3) **The cut did not read IN THE TRAFFIC.** A lane's run crossed the die's edge
  unchanged. Packets now carry two alphas keyed on `fits`; the per-frame fill bound doubles
  from `CIR_LANES` to `2 × CIR_LANES` and is still a constant.
  (4) **`CIR_ASPECT` and `CIR_H_MAX` were INERT** — `useChartMetrics`'s dead `k` in
  miniature. At 0.40/300/430 the measured desktop stage (735px at 1440, 629 at 1280) gave
  294 and 252, both under the floor, so the height was 300 at every width the site is used
  at and the ceiling was unreachable. Re-set to 0.48/250/420.
  (5) **In the `dieFull` state every depth label sat on the package's warm substrate** — the
  die over-hung the lane stack by 8px at each end. Seen on the 3-tx render, where the die
  spans the whole board, so it was every label on the axis.
  (6) **"chip" was clipped by the panel edge** — the ladder walks outward from 0, so its
  first tick is ALWAYS at the exact right edge. Structural, not occasional.
  (7) **THE AXIS AT 390 WAS TWO LABELS.** `fmtBytes` renders "500.0 KB", ~53px at the 11px
  floor, so a 210px board forced a 500 KB step. An axis with two labels cannot be
  interpolated against, which is the only thing an axis is for. A compact `fmtDepth`
  ("500K") plus `TICK_MIN_PX` 66 → 44 gives four rungs.
  (8) **The tracked marker's opaque background covered the lane ABOVE at 390**, 6.5px into a
  band carrying packets. Every alternative inside the stack fails the same way, so the region
  above the lanes became TWO reserved rows — pulse's future-band argument applied to a row.
  (9) **Two c4 panel headers wrapped to three lines** beside the widest provenance badge —
  p2·8's and p2·9's lesson, third time; only the title length was mine.
  **ONE MORE FROM REASONING AND ONE FROM MEASUREMENT, same family.** `cirVias` walked
  ADJACENT tiers, so a pool with `fastest` and `normal` traffic but no `fast` would draw a
  route jumping two lanes with no connector — legal, since nothing requires all four tiers
  occupied, and invisible on the fixture because ITS empty lane is at the END of the order,
  where an adjacent walk gets the right answer for the wrong reason. It walks consecutive
  POPULATED lanes now. And **`CIR_PKT_MIN_W`'s docblock claimed the floor "does not bind at
  all"**, derived from a 1,010px board — that was the c8 CELL's width, not the board's
  (655.3px). Measured off the reduced-motion twin's DOM, which renders one `<rect>` per
  packet through the SAME `cirPacketRect`: **164 of 240 packets sit at the floor**, 60 of
  them drawn wider than their true extent, worst overlap **0.476px**. A plausible
  computation standing in for a measurement, in the docblock of the one constant whose job
  is to bound an error.
  **THREE BUDGET RAISES, NOT TWO, and the third is the brief's blind spot rather than
  mine.** `verify-bundle`'s CHUNK COUNT is a CENTRED ±4 drift detector; it stood at **64** on
  `d388754` — the top of its range — and **every net-new view adds EXACTLY one lazy chunk**,
  because `views/index.tsx` binds each engine through its own `React.lazy(import(...))`. So
  a chunk count is a VIEW-COUNT DERIVATIVE and this literal had been one view from firing
  since #177. Red at 65 against [56, 64], re-centred 60 → **61** per the file's own rule
  (widening loses sensitivity, moving keeps it), green against [57, 65] — and the upward
  half is spent again, said in the file rather than left to be rediscovered. **The
  four-layer sweep's second layer must now include counts DERIVED from the view count, one
  hop away**: it looks for view-id literals and count literals, and this one counts chunks.
  `lazyJsRaw` 790,000 → **820,000** (built 817,281, margin 2,719) and `totalJsRaw`
  1,052,000 → **1,082,000** (built 1,079,307, margin 2,693), both red-then-green on the
  FINAL tree. **The re-measurement rule earned its keep again**: the first reading was
  +29,460 and the final tree reads +29,468, 8 B of drift from three later source edits that
  would have sat inside the margin unseen. Delta paired BY MULTIPLICITY — the `index` stem's
  two chunks moved by DIFFERENT amounts for the SECOND consecutive release, one lazy and one
  eager, so the trap has stopped being hypothetical: circuit +29,241 lazy · index/mapDeps
  +146 lazy · index entry +81 eager. 3 chunks moved of 65; the other 62, including all nine
  pre-existing view chunks, byte-identical; each budget reconciles exactly.
  **THE BASELINE WAS BUILT IN AN ISOLATED `git worktree`** with its own `dist/` and its own
  `node_modules` rather than by stashing in place. `git stash -u` is correct and the three
  previous raises used it; it is also one command away from the shared-`dist` race, because
  a clean `git status` is not a clean SUBJECT while `dist/` still holds the other tree's
  output. A worktree makes that class impossible instead of avoided.
  **AND THE PROJECTION COLLAPSES HERE.** Ten-view mean recounted to **25,404** (span
  19,163–35,969). Every previous raise note projected "N views remain × the mean"; only
  Relay remains and no mean projects it — its own brief leaves it either protocol
  illustration or a "Soon" treatment, two shapes differing by more than the span of the
  whole set — and it is parked.
  **THREE HARNESS-LIES-TO-ITSELF INSTANCES IN ONE RUN, all closed STRUCTURALLY, and two are
  new mechanisms.** (a) **A FILENAME LIED**: a screenshot written to `-tracked.png` was
  captured without `TRACK=1`, so an artifact whose NAME claimed a state its content never
  carried read as "the tracked idiom does not render at 390" — a convincing false defect.
  The probe now `waitForSelector`s `[data-track-idiom="circuit"]` before the shutter, so an
  untracked render cannot produce a file called tracked. (b) **A SILENT NO-OP
  `str.replace`** — applied ≠ effective, tooling edition. A patch adding a DEGRADED branch
  to a probe did not match, python replaced nothing, and the script printed `ok` regardless,
  so an "empty feed" render was a fully live board. Same family as v2·0's mutation that
  never applied; the patch asserts its match count now and the probe asserts the feed is
  dead before it shoots. (c) **A cwd reset made a gate crash, and the grep over its output
  came back EMPTY — which reads exactly like "no failures"**. Caught only by checking the
  summary line rather than the exit code, which is §9's rule doing its job.
  **AND A FOURTH, INSIDE THE BREAK HARNESS ITSELF**: M2's and M3's extraction greps were
  narrower than their claim and `head -N` truncated before the evidence, so two mutations
  ran and their reds were never displayed. Re-run with exact assertion text, no truncation,
  and the summary line always printed. A break test whose output you cannot read is not a
  break test. **A fifth, cheapest of all:** an e2e chain was killed mid-run once its `dist/`
  was known to predate three later source edits — its output is VOID, not suspect, and was
  discarded rather than partially quoted.
  Registration fills the three existing per-view maps (`DENSITY_FLOOR` 135 measured → **118**
  at the documented ~12% · `EXPECT_SVG_TEXT` `[]` VERIFIED 0 at all four widths ·
  `EXPECT_MEMSTAT` five keys, one of which — `bytes` — is this view's AXIS, taken as a
  PARAMETER by `useCircuitField(data, stats.poolBytes)`; it is the first of the ten to anchor
  on that figure, where abyss anchors on `oldest`, pulse on `oldest`+`eta` and orbital on
  none) and one `ROUTES` entry (46 → **47**). **`FITS_AT_1440` correctly needs NO entry**,
  and for a stronger reason than "fluid": `verify-fit`'s `VIEWS` is a hardcoded fit-only list
  at `:113`, so circuit is never iterated there — confirmed at source rather than carried
  from p2·8's note. **The four-layer sweep is FOUR and a naive one finds five**:
  `verify-roles.mjs:204` has a `classic:` key that is the THEME id, not the view id — same
  token, two namespaces.
  Registration was otherwise free: `verify-tracking` **80 → 89** and `verify-memstats`
  **39 → 40** swept circuit with zero hand edits. **`verify-memviews` PRINTS NO NUMERIC
  TALLY** — it ends at `✅ verify-memviews: all assertions passed` with
  `process.exit(fail ? 1 : 0)` — so every "N" ever quoted for it is an EXTRACTION and the
  extraction's range is the load-bearing part. The 289 first recorded here came from an
  `awk '/^— scenario 1/,0'` range, and `,0` means to END OF FILE: on a combined suite log
  it swept the 29 gates that follow. Properly bounded to the gate's own output, this run
  reads **276 ✅ · 11 ⚠️ · 0 ❌**; the verifier's two runs read 276–277 ✅ · 12 ⚠️ · 0 ❌,
  so the warning population is run-variant and only the 0 failures is stable. Quote the
  failure count for this gate, never a total.
  **`verify-nav` stayed at 129 and should have** — it derives `N_VIEWS`, so a tenth view
  changes its SUBJECT (10 tiles) and not its assertion COUNT.
  **`verify-vitals` is red and it is PRE-EXISTING — measured against the baseline BUILD, not
  assumed from a precedent.** `d388754` was built in the isolated worktree, served on its own
  port with the holder confirmed by `lsof`, and the same gate run against it: `/` median
  blocking **435 branch / 424 base**, both over the 400ms ceiling, same route and same
  assertion; `/live/markets` and `/learn/sim` SKIPPED as UNVERIFIABLE on both (spreads
  77.2/87.3% and 76.2/79.8%) by the gate's own contention guard. **`/live/mempool`, the only
  route Circuit can touch, is GREEN on both and better on the branch** — blocking 253/272,
  LCP 3712/3724. Gates **77 files / 73 gates, RECOUNTED and unchanged** — this PR adds none.
  N/M pair: **N 135** (floor 118), **M 10** distinct `data.<field>` reads, the highest of the
  four net-new views (orbital 9, abyss 8, pulse 8).
  Files, CORRECTED at the verifier's head and worth the correction twice over:
  `circuit.tsx` **651** by the gate's own instrument (`src.split("\n").length`,
  verify-memshell item 3) and **650** by `wc -l` — both true, and the difference is the
  trailing newline. Quote the instrument, because the band is asserted against the first
  and a reviewer checks with the second.
  `circuit-instruments.tsx` is **1,265** (`wc -l`), NOT the 1,245 first recorded here.
  1,245 was measured before `18ba221`, the docs commit that added exactly 20 comment
  lines to that file — so the figure was a true measurement of a tree that no longer
  existed by the time it was written down. Same family as the budget near-miss two
  paragraphs up, which the re-measurement rule caught; this one it did not, because a
  line count is not a budget and nothing re-reads it. It stays under
  `pulse-instruments.tsx`'s 1,296 — second-largest in `src/mempool/`, not largest — and
  that is a soft ceiling rather than a licence; instruments files are unbanded and that
  blind spot stays open.
  **No human has seen the rendered result in a browser** — the renders were read from
  screenshots.

- **2026-08-13**: p2·9 "PULSE" (app/ only) — the **ninth** mempool view, the third
  net-new one of the eleven, and the first that draws the **FLOW** rather than the
  **STOCK**. Every other view arranges the pool's current contents by some pair of axes;
  this one plots how fast transactions are arriving, over real time. The stock is the
  integral of what it draws, which is how it can border all eight and duplicate none.
  **TIME IS THE HORIZONTAL AXIS — the first real one in the suite.** Against ORBITAL,
  the near miss, the separation is that its age is a BEARING (cyclic, no origin, no
  direction) where this is LINEAR and DIRECTED, and so has a **FUTURE**: the segment
  right of `now`, ending where the next block is due. Nothing else in the app has one.
  Against ABYSS the inversion is exact — abyss puts age on the VERTICAL axis and takes
  fee out of geometry into brightness; pulse puts time on the HORIZONTAL and puts fee
  BACK into geometry. **It shares fee-on-vertical with SEDIMENT and that is stated
  rather than dressed as a clean nine-way inversion**: the separations are that
  sediment's x is weight, and that its fee is a STRATUM (a position) where this is an
  AMPLITUDE (a magnitude hanging off a timeline).
  **THE HISTORY-SOURCE DECISION, taken and put on the face.** A rolling waveform needs
  a history and there are two places to get one. TAKEN: the pool's own age
  distribution — every pending tx's `age` IS its arrival time, so one snapshot yields
  the whole series instantly, **NODE**-provenanced. Its caveat is SURVIVOR BIAS and the
  stage caption says so in as many words: these are arrivals **still pending**, so the
  older end under-counts, and the fall-off is the mining process rather than a gap.
  NOT TAKEN: a session log (`useFeedEvents.ts`) — empty at load, and its own cap would
  flatten the signal. **The brief mis-stated that cap**: `:26` is
  `TX_EVENTS_PER_TICK = 8`, and the 40 one line below is the ring buffer's total size.
  Different quantities; the brief conflated them.
  **BOTH NAMED DEPENDENCIES ARE STRUCTURAL, not decorative** — `usePulseField(data,
  oldestAgeSec, etaSec, innerW)`, abyss's parameter discipline: `oldest` picks the
  window rung off a **block-target ladder** (rungs are multiples of the node's own
  `target_seconds`, so a literal 600 is never written), `eta` is the due marker.
  **COMPOSITION: two traces hinged on one time axis.** ABOVE — one equal segment per
  arrival, stacked per bin, so a column's height is exactly the arrival count and the
  ticks are honest integers; this is the half that makes "bursts read as spikes" true,
  and its colour composition is the burst's fee mix. BELOW — one mark per arrival at
  its own log fee/byte, where the inferred cut becomes a horizontal threshold the marks
  visibly cross (orbital's cut is a ring, abyss's a brightness, this one a floor).
  **Two compositions were discarded and one of them by measurement**: per-tx strokes
  alone make a cheap burst a dense band of SHORT strokes — a smudge, not a spike; and
  weighting height by fee fails the other way, since on the gate fixture one dear tx
  carries ~180× a cheap one, so a single whale out-spikes a thirty-tx burst.
  Per-frame cost is a constant — ≤4 fills for the whole rate stack and ≤4 for the whole
  fee scatter, batched by tier — so 240 txs is eight fills and 2,400 would also be eight.
  **Fluid worked first try**, orbital's and abyss's mechanism verbatim: all six
  `naturalW == canvasW` cells YES — 1440 → 1180/1180, 1280 → 1020/1020, 390 → 366/366,
  in BOTH feed states, no `.mp-fit` anywhere, authored 11px rendering at 11px at 390.
  **FIVE DEFECTS FOUND BY LOOKING, NONE OF WHICH ANY GATE SEES**, and this is the entry
  worth keeping — every one rendered, carried correct numbers, overflowed nothing:
  (1) **`tMax` was the live ETA, so the due marker sat at the axis maximum BY
  CONSTRUCTION** — it could never move, the "sweep" the view was designed around did not
  exist, and the whole domain rescaled every frame so every transaction drifted for a
  reason unrelated to it. Fixed at ONE BLOCK TARGET, which is exact rather than chosen:
  `eta = target − sinceTip` with `sinceTip ≥ 0`, so the marker is never off-axis.
  (2) **The window ladder's bottom rung was ¼ block target**, so a 3-tx pool got a 30s
  window against a 120s future — 80% empty future, two marks in the left fifth, and the
  ladder printing "+2m" three times running. Floored at one full block target: the
  sparse state now reads "one block of arrivals behind, one block of waiting ahead".
  (3) **`u` is 0 at the pool's cheapest and 1 at its dearest by construction**, so
  without an inset the cheapest mark was drawn ON the time axis and the dearest ON the
  floor rule, hidden under 1px lines. Not an edge case — every pool has both, so two
  marks were ALWAYS invisible, and at 3 tx it was two of the three.
  (4) **A rate ceiling of 1 made a single arrival a full-height bar**, and quartering a
  round ceiling is not round: 50 → "13 · 25 · 38 · 50". Floor of 4, and ticks now pick
  a 1/2/5 STEP and walk up.
  (5) **Both floating labels shared the top row and collided** the moment a recent tx
  was tracked — the common case, since the newest arrival and the due marker are both
  near the present — and the due label clipped off the right edge at 390, reading
  "block du". The due label moved into the FUTURE BAND, the one region where nothing is
  ever drawn, so it can occlude no data at any pool size.
  **One further fix came from reasoning, not looking, and is the same family**: `plsX`
  clamps to the box, so an arrival that rolled past the left edge between polls was
  PAINTED ON THE BORDER at a time it did not arrive. Guarded in the draw loop AND in the
  hit test, because a click must not resolve to a mark the stage has stopped painting.
  **TWO BUDGET RAISES, both red-then-green on the FINAL tree**: `lazyJsRaw`
  759,000 → **790,000** (built 787,894, margin 2,106) and `totalJsRaw` 1,021,000 →
  **1,052,000** (built 1,049,839, margin 2,161). `eagerJsRaw` moved +83 — STRUCTURAL,
  the meta row p2·7b put in an eagerly-bundled module — ceiling untouched at 280,000.
  **The multiplicity trap was LIVE in this delta rather than hypothetical**: the stem
  `index` really does hold two chunks, they moved by DIFFERENT amounts (+133 and +83),
  and **one is lazy while the other is eager** — so a basename-keyed diff does not
  merely lose a row, it attributes a lazy delta to the eager budget. Clean two-term lazy
  delta (pulse 30,952 + mapDeps 133); all eight pre-existing view chunks byte-identical.
  9-view mean **24,977**, recounted (span 19,163–35,969); Circuit is certain, Relay is
  parked and its shape unpredictable, so the projection is a floor for one and a guess
  for the other.
  **THE HARNESS LIED TO ITSELF AGAIN, and the mechanism is new: `| head -14` SIGPIPEs
  the producer.** The render probe was killed after printing its first table and before
  writing any screenshot, so a set of fixes was judged against PNGs from five minutes
  earlier and read as "the fix did not take". Caught by timestamping the artifacts
  against the build. The six-cell numbers in that same run WERE fresh — they print
  first — which is exactly what made it convincing. **Never pipe a probe that writes
  files into `head`.**
  Gates: **77 files / 73 gates, RECOUNTED and unchanged** — this PR adds no gate. It
  fills three existing per-view maps (`DENSITY_FLOOR` 154 measured → floor 135 ·
  `EXPECT_SVG_TEXT` `[]` verified at all four widths · `EXPECT_MEMSTAT` five keys) and
  one `ROUTES` entry (45 → 46). **`FITS_AT_1440` correctly needs NO entry** — it is a
  fit-only map and Pulse is `fit: false`; the absence is reasoned, not overlooked.
  Registration was otherwise free: `verify-tracking` **71 → 80** and `verify-memstats`
  **38 → 39** swept pulse with zero hand edits. `verify:mem:perf` p5 **24 fps** — FAIL
  against the 30 bar, reported not hidden, joint-best of the four canvas views
  (sediment 10, orbital 24, abyss 23); bar untouched, and the between-canvas ranking is
  runner noise. **Rider taken**: `verify-memshell`'s `NEW` had kept SHIPPED orbital and
  abyss since #174/#176, so their line-count bands ran as warnings — pruned, and both
  are now owned assertions (561 and 579 in the 200–1084 band). `pulse` stays in `NEW`
  until it ships, because promoting a view in its own PR would make its band owned by a
  number nobody has reviewed.
  **No human has seen the rendered result in a browser** — the renders were read from
  screenshots.

- **2026-08-13**: p2·8 "ABYSS" (app/ only) — the **eighth** mempool view and the second
  net-new one of the eleven. Fee is LUMINOSITY, age is DEPTH, and the tracked idiom is
  **SUBTRACTIVE**: the only view in the app that keeps one transaction lit and DIMS the rest.
  **The identity had to be designed against TWO adjacencies, not one** — sediment encodes fee
  as a vertical STRATUM, orbital as a RADIUS, so a third positional fee axis would have been
  one of those rotated. Fee left geometry entirely for the brightness channel, which makes
  the next-block cut a BRIGHTNESS THRESHOLD rather than a ring you can point at. The
  horizontal axis carries NOTHING and says so (`hashToUnit`, bridge's own idiom).
  **Per-frame cost is a constant, not a function of pool depth**: alpha and colour are both
  pure functions of an 8-step luminosity bucket, so the whole pool is ≤8 `fill()` calls —
  240 txs is eight, 2,400 would also be eight. `verify:mem:perf` p5 **18 fps** against a 30
  bar — FAIL, reported not hidden, and the BEST of the three canvas views (sediment 6,
  orbital 15). Bar untouched; it is an open decision.
  **Fluid worked first try**, orbital's mechanism verbatim: all six `naturalW == canvasW`
  cells YES — 1440 → 1180/1180, 1280 → 1020/1020, 390 → 366/366, in BOTH feed states, no
  `.mp-fit` anywhere, authored 11px rendering at 11px including at 390.
  **THREE DEFECTS FOUND BY LOOKING, NONE OF WHICH ANY GATE SEES**, which is the entry worth
  keeping: (1) the LOW-POOL state read as an EMPTY PLOT — at 3 txs the age ladder degenerated
  to `[now, 30s]` plus a floor tick 1s below it, and 1.4px dots were specks in a 735×574 box;
  fixed with four fine rungs (5/10/15/45s), a floor-tick suppression rule, and a dot-radius
  LEGIBILITY FLOOR (1.4 → 2.0, uniform so every size ordering is preserved). (2) The tracked
  marker sat exactly on top of the "5s" axis label AND drifted ~19px from its own dot between
  polls, because the particle sinks continuously while React re-renders every 3s — fixed by
  giving the draw loop the marker's DOM node (`Orb.tsx`'s pattern; contract §5's "mutate refs
  or DOM attributes" half). (3) A c4 panel header wrapped to three lines and ran the
  provenance badge off the panel edge — **checked against orbital before fixing, and orbital
  does exactly the same thing**, so the wrap is pre-existing shared `PanelFrame` behaviour and
  only the title length was mine.
  **The first floor-tick threshold was wrong in a way only the render showed.** 0.07 dropped
  the redundant "31s" at maxAge 31 — and also dropped "29m" at maxAge 1747, leaving the
  deepest 5% of the column unlabelled on the MAIN case. A rule tuned on the edge case broke
  the common one; 0.03 keeps both.
  **TWO BUDGET RAISES, both pre-authorised, both red-then-green on the FINAL tree**:
  `lazyJsRaw` 736,000 → **759,000** (built 756,809, margin 2,191) and `totalJsRaw`
  1,000,000 → **1,021,000** (built 1,018,671, margin 2,329). Every byte attributed by a
  file-by-file dist diff PAIRED BY MULTIPLICITY: abyss chunk +23,443 lazy · index/mapDeps
  +133 lazy · eager entry +80. A clean two-term lazy delta, unlike p2·7's four terms —
  `useMemCanvas`'s shared-chunk hoist already happened, and all seven pre-existing view
  chunks are byte-identical across the two builds.
  **THE NEAR-MISS WORTH READING: the first delta was measured, the ceilings were written from
  it, and then three more rounds of render-driven fixes landed.** The abyss chunk moved
  23,115 → 23,443 and both comments would have shipped describing a tree that no longer
  existed — a true measurement of the wrong subject, the standing family, caught only by
  re-measuring after the LAST src edit. The reds were then re-demonstrated on the final tree
  rather than quoted from the first.
  **`eagerJsRaw` MOVED, +80 B, and the brief said it must not** — but the move is STRUCTURAL,
  not drift: p2·7b deliberately put the view metadata in an eagerly-bundled module so
  `nav/ia.ts` could read it under bare Node, so every future view costs the eager bundle one
  row. The CEILING is untouched at 280,000.
  **`totalJsRaw`'s own stated construction is now broken, and was already broken before this
  PR.** Its comment says it is "set to the sum of the two real budgets"; that was exactly true
  at 280,000 + 720,000 = 1,000,000, and lapsed silently at #174 when lazy went to 736,000.
  1,021,000 does not restore it either (280,000 + 759,000 = 1,039,000), so a build can now sit
  inside BOTH real budgets and still red on the backstop. Raised to built+margin anyway per
  the operator's standing policy; the reconciliation is recorded in the file as its own
  decision.
  **`verify-vitals` is red and it is PRE-EXISTING — measured against `origin/main`, not
  assumed.** Both trees exceed the 400ms blocking ceiling on `/` and `/live/markets`; which
  route reports ❌ versus the gate's own `SKIPPED: UNVERIFIABLE` spread guard depends on the
  runner, not the tree. Per-route median blocking, branch vs base: `/` 414/413 · mempool
  **261/294** · markets **463/488** · sim **311/318** — the branch is no worse anywhere and
  better on three of four, and `/live/mempool`, the only route Abyss can touch, is green on
  both. In the full e2e chain markets LCP read 4460ms; standalone and idle it read 2240ms.
  Gates: **77 files / 73 gates, RECOUNTED and unchanged** — this PR adds no gate, it fills
  three existing per-view maps (`EXPECT_MEMSTAT` · `EXPECT_SVG_TEXT` · `DENSITY_FLOOR`, all
  three measured then written: five keys · `[]` at all four widths · 198 → floor 174) and one
  `ROUTES` entry (44 → 45). Three-way break test in ONE run, each red localised and none
  masking another; restored with the trap-owned sequence and re-run green at 233. Registration
  was otherwise free — `verify-tracking` **62 → 71** and `verify-memstats` **37 → 38** swept
  abyss with zero hand edits, which is what #175 bought. **`verify-nav` stayed at 129 and
  should have**: it derives `N_VIEWS` from the registry, so a new view changes its SUBJECT
  (8 tiles asserted, not 7) without changing its assertion COUNT — a rising count there would
  have meant a hardcoded list. Four-layer sweep clean: `verify-fit`'s `FITS_AT_1440` is a
  FOURTH per-view map the brief did not list, but it is keyed on a hand-kept fit-only list and
  Abyss is `fit: false`, so it correctly needs no entry. `verify-memshell` band: abyss.tsx
  **578** lines (+ abyss-instruments.tsx 839, split at the established seam). All 28 other
  e2e gates, verify:static, fit, mobile, perf-runtime, pageshell and bundle green.
  **No human has seen the rendered result in a browser** — the renders were read from
  screenshots.

- **2026-08-04**: v6.1.9 "COLD BOOT: THREE POST-MERGE DEFECTS" (app/ only). The
  headline is not the fix, it is the shape: **the cold-boot orb had never
  rendered in the console, and `verify-orb`'s 26 green assertions could not have
  caught it.** That gate's only context factory calls `coldBootOff(ctx)`, so its
  SUBJECT was the bypassed Main Home while its CLAIM read as "the orb". Home's
  box is 538.9×468 and the orb draws there correctly; the one surface where it
  was broken is the one surface the gate had never rendered. **A subject
  NARROWER than its claim fails exactly as a wider one does** — it passes for
  reasons outside the claim. Instance ten of the standing family, and the first
  to reach users.
  **Three causes, and the prompt's two candidates were both wrong.** (1) `Orb.tsx`
  lays out a fixed-height flex column where the canvas wrap is `flex:"1 1 auto";
  minHeight:0` (shrinkable) above a badge/caption overlay that is `flex:"0 0
  auto"` (not). The console reserved 160px; the overlay measured 153.5 at
  1440×900 and 180.1 at 390×844, so the canvas got **zero** height, `resize()` —
  the only writer of `canvas.width/height` — returned early every time, and the
  backing store kept the **300×150 HTML default**. An instrumented build logged
  three calls and three early returns; it never once completed. The early return
  was CORRECT given a zero-height box. The bug was the box, and the silence.
  (2) Consequently it painted into the wrong coordinate space. (3) **`[data-orb]`
  is a `position:fixed` sibling of ColdBoot's root at `z-index:auto`, and that
  root is `z-index:1000` with an OPAQUE `#050505` background** — so even a
  correctly sized, correctly painted orb was invisible for the whole console
  phase. `elementFromPoint` at the orb canvas's own centre returned a canvas
  inside `[data-coldboot]`. Fixing only the geometry would have shipped a
  perfect invisible orb.
  Fix: console slot `minHeight` 160 → **400** (derived: worst overlay 180.1 +
  8px gap + a canvas worth drawing; the canvas now gets 238.5px at 1440 and
  211.9 at 390), a hard `ORB_MIN_CANVAS_PX` floor of 120 on the canvas wrap
  which **never binds in any shipped layout** and is there to make the class of
  bug impossible rather than fixed, a one-shot `console.warn` when `resize()`
  bails, and `zIndex: COLDBOOT_Z + 1` scoped to `coldBootOrb.active` (a
  permanent raise would float the orb over NavTop's dropdown on Home).
  **The console did not get taller**: its grid is `alignItems:"start"` and the
  row is driven by the HUD pane at 870.8 against the Network pane's 430, so the
  240px spent came out of 440.8px of headroom. Console root 926.3 before, 926.3
  after.
  **The ordering hazard, measured rather than predicted.** Raising the console's
  `maxWidth` (an independent change in the same PR) widens the pane, shortens
  the caption block, and flips the backing store from `300×150` to **`490×25`**
  at 2560 — so an assertion of the form "the store is not the default" goes
  GREEN on a 25px letterbox strip. That is why `verify-orb` §5 leads with a
  parsed floor and a box-tracking check and keeps "not 300×150" **last and never
  alone**. The break test confirmed it: reverting the fix at runtime turns 4 of
  6 shipped assertions red, and the two that stay GREEN are precisely "not
  300×150" and "the canvas is painted", both satisfied by a stale buffer.
  **§6 predicts rather than remembers.** Every feature `drawOrb` emits
  unconditionally is a circle centred on the canvas, so the expected structural
  bounding box is `2 · ORB_RADIUS_FRAC · SHELL[2] · min(W,H)` — both constants
  PARSED out of `orb.ts`, not restated — and it lands within 2px in all six
  measured contexts. Dot-alpha (≥120) separates a live census from none by two
  orders of magnitude (94–99 px against ≤1), so the floor of 40 and ceiling of 5
  sit in an empty gap; each polarity is the other's vacuity guard. Pixels are
  read from the BACKING STORE via `getImageData`, never a screenshot — during
  the console phase a screenshot would have reported "does not paint" for a
  canvas painting correctly, because of cause (3).
  **Frame zero.** `/` is prerendered and `main.tsx` uses `createRoot`, so Main
  Home painted for the length of the bundle download before the splash replaced
  it. `index.html` now stamps `cb-pending` pre-paint and hides `#root` behind an
  opaque floor. **The floor's colour is `#050505` — ColdBoot's own hard literal,
  NOT the per-theme `--amb-floor`**; using the theme colour would step
  `#121218 → #050505` on indigo, moving the flash rather than removing it.
  **The predicate has TWO clauses, not three**: `xmrirish.coldboot` gates
  `skipDecrypt`, not whether the splash renders, so a sessionStorage term would
  have left the flash on every repeat visit. It is necessarily encoded twice
  (a pre-paint script cannot import), so `verify-cbpending.mjs` extracts the
  inline copy and evaluates BOTH over a 56-row truth table — an equivalence
  proof, not a text diff.
  **The most important assertion in the release is a placement.** The watchdog's
  removal sits OUTSIDE its `childElementCount === 0` branch, because prerendering
  means `#root` is never empty and anything inside that branch never runs. Moving
  it inside turns all three `verify-degraded` B4b assertions red with `#root`
  reading **0 chars** — a permanently blank page, far worse than the flash. B4c
  pins the timers and proves B4b measured a REMOVAL rather than an absence.
  **Two gate defects found while writing the gates, both worth knowing.** A
  self-check injected an inline `height` and reported the canvas had not
  collapsed — `Orb.tsx` rewrites that inline style on its 24fps tick, so the
  injection was reverted within ~42ms and the check failed for a reason
  unrelated to its claim; it now uses a stylesheet rule, which an inline
  declaration cannot beat. And `verify-cbpending`'s placement check first
  searched for `childElementCount === 0` and matched **the comment written three
  lines above the removal explaining why the removal is not inside that
  branch**, going red against a correct file — the same shape as `verify-orb`
  §4's naive lat/lon grep finding six hits inside the prose that exists to
  prevent it.
  This release adds exactly ONE gate (`verify-cbpending`), so gates went **70 →
  71** and CI-reached **56 → 57** — the entries above read 69 and 55 because
  v6.1.8's own additions were never folded in, and both were stale by one.
  Recount, never increment. `verify:static` 20 → 21. `verify-orb` 26 → 103
  passed + 1 reasoned skip. §4's ENTER travel re-measured at the new cap:
  **135.4px → 147.8px**.

- **2026-08-01**: v6.1.3 "MOTION & TRANSITION FOUNDATION" (app/ only; nothing in
  `api/` changed). The site had no motion vocabulary — 37 `transition:`
  declarations and 59+ timing literals across 4 stylesheets and 21 inline sites,
  two distinct cubic-beziers in the whole repo, durations spread over 9 ad-hoc
  values. Now four duration tokens (`--d-1` 75ms · `--d-2` 150 · `--d-3` 300 ·
  `--d-4` 500) and five easings (`--e-standard/decel/accel/expressive/spring`)
  declared once in `styles.css`'s `@layer base { :root }`, zeroed by the existing
  reduce block at `:221-223`. Long ambient loops (6s–260s) and the per-item
  desync offsets stay literal on purpose — they are not interaction timings, and
  collapsing an index-derived desync into a shared token puts 12 streamers back
  in lockstep. Every remaining literal carries a `// D0651:` comment saying why.
  **Six traps recorded, each of which cost real time:**
  (1) **`deviceTier.ts:121` folds `prefers-reduced-motion` into tier `low`.** Any
  gate written as `getDeviceTier() !== "low"` therefore also vetoes every
  reduced-motion visitor. `vtSupported()` shipped with exactly that bug and was
  caught only because `verify-motion.mjs` §3 asserts 0 animations *and* a working
  transition under reduce. If you reuse the tier as a capability check, say
  `tier === "low" && !prefersReducedMotion()`.
  (2) **`useTick` freezes to a literal `0`, so a tick-driven simulator's natural
  still frame is its FIRST frame** — and for three of them that frame was the
  "before" state the simulator exists to move past. `view-tags` reported "1 ms"
  for both scanner panes (the inverse of its own lesson), `fcmp` reported an
  anonymity set of 16, `stealth` parked Diffie-Hellman on "computing…". Freeze
  where the animation LANDS, not where it starts. Stopping motion is necessary
  and not sufficient; the frozen frame is a content claim.
  (3) **SMIL `<animate>` is invisible to CSS.** No `animation: none`, no
  `@media (prefers-reduced-motion)`, no global `transition-duration: 0ms` reaches
  it, and Chromium's `getAnimations()` does not report it either. The only way to
  honour reduce is to not render the element — which is why `verify-reduce.mjs`
  asserts SMIL **absence** rather than SMIL not-running. Four of the six defects
  it found were SMIL.
  (4) **An animation census is a floor, not a ceiling.** `terminal.tsx`'s
  typewriter is a `setTimeout` chain, so it appears in neither `getAnimations()`
  nor a `querySelectorAll('animate')` — it was typing and erasing forever under
  reduce and the runtime audit scored it clean. JS-driven motion needs a source
  read.
  (5) **An inline `animation:` never reaches a class-scoped reduce gate.**
  `styles-ambient.css:328` gates `.spin-slow`/`.spin-med` with `!important`;
  `ringct.tsx` invoked the same global `spin` keyframe from an inline style and
  sailed straight past it.
  (6) **`window.scrollTo(0, 0)` is a no-op on every desktop.** `.art` is
  `height:100vh; overflow:hidden` (`styles.css:347-359`), so the document never
  scrolls above 768px — `main.main` is the scroller. `EducationPage` and
  `MoneroPage` both carried one; both are deleted and subsumed by
  `routes/useRouteChrome.ts`, which targets `document.scrollingElement`,
  `main.main` and `.mp-canvas-scroll`, keyed on `location.key` in a module-level
  `Map` (in memory — a per-history-entry record of visited URLs does not belong
  on disk on a Monero privacy site, and could not restore `main.main` anyway
  since that element is recreated).
  **View Transitions are hand-rolled and feature-detected, and the fallback is
  the MAIN path**: Tor Browser is Firefox ESR and Firefox only shipped view
  transitions in 144, so the site's primary audience never receives them. That is
  the argument for keeping 100% of the branching in `design/viewTransition.ts`
  and 0% in components. `react-router` here is the JSX `<Routes>` API, not
  `createBrowserRouter`, so `<ScrollRestoration>` and the router's own VT support
  are unavailable at any version — hand-rolling is forced, not preferred.
  `React.lazy` is KEPT: `startViewTransition` would otherwise snapshot
  content→`loading…`, and there is no public API to warm a lazy payload
  (the initializer throws its thenable on first invocation even when the module
  is already in the registry). Instead each declaration in `App.tsx` gains a
  `.then()` that records its key in a module-level `Set`; a route in the Set
  transitions, one not in it navigates plainly. A route's first visit does not
  morph. **D0721 persistent shell, D0723 speculation rules and D0724 hover
  prefetch are deferred to prompt 07** with the route table, on the record.
  **Accessibility landed as part of this, not after it**: `<main>` gains
  `id="main" tabIndex={-1} aria-labelledby="page-title"` and `PageHeader`'s `<h1>`
  gains `id="page-title"` — one edit covering 9 pages — plus `.sr-only` h1s for
  the four pages that rendered none at all (`MempoolPage`, `MempoolTxPage`,
  `SimulatePage`, and `NotFoundPage`, whose heading-sized `<div>` became a real
  one). A persistent `RouteAnnouncer` reports the navigation; the focus move
  reports where you now are; they say different things, so there is no
  double-speak. A skip link was absent and is now present.
  **Two defects carried from prompt 03, both closed, and one recorded diagnosis
  disproved.** `design/ArtBackground.tsx` seeded 15 `Math.random()` calls, making
  the "only inside `app/src/protocols/`" rule false site-wide; they are now
  `h3(i, role, SEED)` from a shared `design/prng.ts`, substituted 1:1 so every
  marginal distribution is unchanged by construction. And the acyclicity
  assertion that `verify-legibility.mjs:542` said lived in `verify-contrast.mjs`
  did not exist anywhere; it is now `verify-roles.mjs`. **The disproved
  diagnosis**: prompt 03 recorded that the 1440 shot sweep was unstable because
  ParticleField seeds with `Math.random()`. ParticleField does not render in
  those screenshots at all — `verify-shots.mjs:73` emulates reduced motion, which
  demotes to `low`, on which `ArtBackground.tsx:40` renders `null`. The real
  cause was `Footer.tsx:12,22`: a live seconds-resolution UTC clock on every
  route, proven by pixel diff (84 px, `elementFromPoint` → `.footer-tele`) and
  fixed with Playwright's Clock API.
  **Also**: `/simulate` had been shipping an **empty `#root`** — `prerender.mjs`
  and `entry-ssr.tsx` each carried their own copy of a `/loading[….]/` regex that
  missed the nested "loading simulators…" fallback by one space, so the route
  broke out of the resolution loop still suspended. One exported `SUSPENDED_RE`
  now serves both. And `ScannerWall` produced a 175,397px document at 390px.
  **Eight new gates**, all break-tested: `verify-prng`, `verify-gpu` (static);
  `verify-roles`, `verify-motion`, `verify-nav`, `verify-discrete`,
  `verify-govern`, `verify-reduce` (e2e). `verify-prng` §6 also widened from
  `src/design/` to all of `src/` with `protocols/` exempt — an adversarial pass
  proved `Math.random()` in `src/routes/` passed the entire `verify:static` chain
  green, so the rule CLAUDE.md calls out as having "regressed once already" was
  enforced in two directories and nowhere else.
  **Two structural limits of the shot matrix, measured and written into
  `verify-shots.mjs`'s own header**: (a) `freezeAmbient()` injects
  `*, *::before, *::after { animation: none !important; transition: none
  !important }` before every capture, so **the sweep is incapable of seeing any
  CSS-animation change** — `ringct`'s inline `spin 14s` and `carrot`'s `scaleX`
  rewrite both came back byte-identical while a live probe showed the baseline
  spinning and the branch stopped. SMIL is not covered by that rule, which is
  why `dandelion` does show. A clean sweep is no evidence about motion; that is
  `verify-reduce.mjs`'s job. (b) The sweep is **order-dependent** — one browser
  context, so localStorage/HTTP/font caches carry between routes — and its noise
  floor is not zero and not confined to `/simulate`: two back-to-back sweeps of
  ONE unchanged tree differed on 18 of 129 classic shots, 17 `/simulate` plus
  `/peers` at 390. The gate's previous claim that non-simulate routes were
  byte-identical between sweeps is corrected. It now prints a `NOISE FLOOR:`
  line every run counting uncomparable shots instead of folding them into a
  pass, and `verify-shots.mjs:190` still uses `waitUntil: 'networkidle'` against
  the 3s tier — logged, not fixed, because changing it invalidates every
  baseline tree.

- **2026-07-31**: v6.0.12 — **Markets charts rendered nothing on a cold first
  visit**, and the fix is a pattern worth knowing before writing another chart.
  `verify-markets-dom.mjs` (added the same day) caught it the moment it ran
  against a build that included the v6.0.10 `useChartMetrics` migration: four
  `.chart-box` wrappers in the DOM, **zero `<svg>` inside them**. Reproduced on
  pristine `origin/main`, so it was never branch-local.
  Mechanism: `useChartMetrics` measures in a `useLayoutEffect` keyed on the ref
  OBJECT, whose identity never changes — so the effect runs exactly once, on
  first render. Every chart in `markets/charts.tsx` opened with
  `if (!data?.length) return null;`, and on a cold load history is still in
  flight at first render, so `ref.current` was null when the effect fired. It
  returned early, no ResizeObserver was ever attached, `ready` stayed false
  forever, and the `{ready ? <svg/> : null}` gate never opened. **Nothing
  recovered it** — the `window.resize` listener lives in that same skipped
  effect, so even a resize didn't help. Only a remount did, which is exactly why
  the charts appeared on a *second* visit (warm `mh:v1:` cache → box present on
  first render) and never on a first one. Confirmed by probe: cold `{box:4,
  svg:0}` → resize `{box:4, svg:0}` → navigate away and back `{box:4, svg:4}`.
  Fix: an `EmptyBox` helper, so the empty/loading branch mounts the SAME
  `div.chart-box` root as the populated branch. React then reuses one DOM node,
  the ref is attached from the first render, and filling the chart is an update
  rather than a remount.
  **The rule this leaves behind: never return `null` (or a different root) from
  a component whose ref is measured by `useChartMetrics`.** The hazard is
  generic, not Markets-specific — the seven `src/protocols/*` diagrams and
  `monero/TechTab.tsx` use the same hook and are only safe because they render
  their box unconditionally. The durable fix is a callback ref inside the hook;
  that touches 19 call sites and was deliberately left for its own change.
  Also worth knowing: charts no longer emit `viewBox="0 0 1000 H"` — the width
  is the MEASURED CSS width so one user unit is one CSS pixel. Any test that
  selects a chart by its full viewBox string silently matches nothing; match on
  the height half, which is the prop the page actually sets.

- **2026-07-31**: v6.0.5 "LIVE-RANKED MARKET GROUPS" (app/ + api/) — the note this
  work never got. The fabricated-price fix (v6.0.5/v6.0.6, PRs #131/#137) removed
  `genCandles6`, but the coin *membership* was still a frozen `CoinDef` list:
  ZEC/DASH/ARRR as "the privacy peers", BTC/ETH/SOL as "the majors". Same failure
  mode as the seeds, slower fuse — DASH had already dropped out of CoinGecko's
  `privacy-coins` top 10 while BCN/DCR/MWC/XVG/NOCK/FIRO all rank above ARRR, and
  ZEC leads XMR by cap. Membership now comes from a new `api/markets.js`
  aggregator: `GROUPS.peers` reads `category=privacy-coins&order=market_cap_desc`,
  `GROUPS.majors` reads plain `market_cap_desc`, `selectMembers()` pins `monero`
  at index 0 and drops rows for `pegged` / `derivative` / `no-rank` /
  `no-marketcap` / `invalid-price` into an `excluded[]` audit trail. **Stablecoins
  are filtered structurally, not by name list** — `isPegged` is a price/ath/atl
  band test, so a new peg is excluded the day it lists. `useMarketHistory.ts`
  consumes that envelope and never ranks anything itself.
  §3 legibility decision: **cap the chart, list the remainder as text** —
  `chartN` 6 peers / 9 majors against `listN` 10 / 9, with the uncharted tail in
  the "also in top N" row. Ten lines in a 300px panel is unreadable and no palette
  fixes that; hover isolation was not pursued. Colours are `seriesColor(group, i)`,
  a pure index-keyed lookup with XMR fixed to `--tk-accent` — that indirection is
  why refreshes never reshuffle the palette.
  Ragged history is rendered, never padded: `MultiLine` maps x by TIMESTAMP over
  a common domain and splits segments, so `bytecoin` (17 of 31 points at days=30)
  and `mimblewimblecoin` (25) simply start later on the axis. Padding is how the
  original bug started; there is a gate asserting the line starts differ.
  Layout swap: XMR/BTC + XMR-vs-Top-N now pair in the upper row and the privacy
  group takes the full-width slot below. `RATIO_CHART_HEIGHT = 318` vs
  `MAJORS_CHART_HEIGHT = 340` are **deliberately unequal chart props producing
  equal PANEL heights** (266px measured) — the ratio panel carries a caption line
  under its chart. Don't "fix" them to match.
  Request budget: the aggregator is the whole point. A cold load is **6 history
  requests** (1 `/api/markets` + XMR ohlc + XMR/usd + XMR/btc + BTC/usd + tickers)
  and **21 across all four ranges** — flat in group size, so 6+9 charted coins
  cost the same as 3+3. Edge cache `cacheSeconds` 900/1800/3600/3600 with
  `DEGRADED_S_MAXAGE = 45`, because caching a degraded payload at the full TTL is
  what turned a transient 429 into permanently-stale charts.
  Gates: `api/verify-markets.mjs` (aggregator, offline, fixtures) and new
  `app/verify-markets-dom.mjs` (29 assertions — membership, peg exclusion scoped
  to the majors panel, ragged-history line starts, panel geometry at 1440,
  colour stability across a reload, the request budget, and 390px overflow with
  `.table-scroll` correctly exempted since styles.css:370 makes wide tables swipe
  inside their own box by design). Both were written but wired into nothing; they
  now run in CI, alongside `verify-multiline.mjs` / `verify-releases.mjs`.
  **Not verifiable in-sandbox** (egress to api.coingecko.com is blocked): that the
  live category still ranks DASH out and BCN/DCR/MWC in. The gate proves the page
  renders whatever ranking it is handed — check the ranking itself on a preview.
  Also landed: Prompt D Part 2, Sources release notes generated from the commit
  log (`app/src/data/releases.ts` + `/api/feeds?src=commits`).

- **2026-07-31**: v6.0.8 "FRAMERATE & PERFORMANCE, MOBILE-FIRST" (app/): the app
  had no idea what device it was on. 43 animated compositor layers (8 plates up
  to 92vmax, 30 orbs, 2 dust, a 320%-translating sweep, a 170vmax conic ribbon)
  plus a rAF canvas rendered identically on a 4K desktop and a phone, and 21
  `useTick` setIntervals (down to 50ms) plus every network poll kept running in
  hidden tabs. New `design/deviceTier.ts` resolves `high|mid|low` once per load
  from hardwareConcurrency / deviceMemory / viewport area / coarse-pointer, with
  `prefers-reduced-motion` and `saveData` forcing `low` and a `?tier=` override
  on top (the gate needs a deterministic selector; Tor lands low/mid on its own
  spoofing). It is NOT a third ⌘ DESIGN knob — `tier` rides on `VisualState`
  read-only, is never persisted, and has no radio group; VisualContext's
  "two knobs" note stands. `data-tier` is stamped pre-paint by index.html's
  inline script (a smaller, deliberately more pessimistic heuristic) and
  re-stamped by VisualProvider, so a phone never composites 43 layers during
  the bundle download. New `design/usePageActive.ts` (visibility +
  IntersectionObserver, including a non-hook subscription so rAF drivers don't
  re-render to learn they should stop) and `design/useAnimationClock.ts` (one
  shared rAF fanned out per-subscriber at tier-scaled fps; `useAnimationSeconds`
  is the variant to prefer, because a frame counter changes meaning per tier
  while seconds don't). ParticleField gained a `dt` — it had none, so drift
  speed literally tracked refresh rate — plus a 50ms clamp, tier-aware DPR, and
  a pre-baked glow sprite replacing a per-particle `shadowBlur`. Measured on a
  390×844 / 6× CPU / Slow-4G emulation (which resolves to `low`): /mempool
  15.7 → 60.1 fps, /markets 13.7 → 46.4, / 14.5 → 50.0; long-task time down
  84–93%; background rAF 44/51/40 → **0/0/0**; entry chunk 560.72 → 45.67 kB
  (164.07 → 15.97 kB gzip, 58% less for first paint including the new vendor
  chunk). Breakpoints: the audit's "no mobile layout" claim was wrong —
  styles.css:849+ is a working 224-line phone layer under a documented
  single-breakpoint invariant. The real gap was 769–1199px (a 260px rail eating
  a third of a tablet), so that band plus a ≤479px band were ADDED rather than
  the existing layer refactored. New gate `app/verify-perf.mjs` (22 assertions:
  pre-hydration tier stamp, per-tier layer census, background quiescence,
  8 routes × 8 widths overflow, orientation flip, reduced-motion, timer census,
  static source checks). Before/after in `app/PERF-BASELINE.md`, including an
  explicit list of what real-device checks remain for a human.
  Corrections to the prompt's audit, verified against source: `useMemCanvas`
  does not exist in this repo; `reactor.tsx` has zero timers; orbs were already
  seeded via `.map()`, not 30 hardcoded spans; charts were already responsive
  (`viewBox` + `width="100%"`); React was already the production npm build, not
  a CDN dev bundle; fonts were already self-hosted, subset and `swap` (only
  preload was missing).

<!--
  Use this section to leave notes for future sessions.
  Format: **YYYY-MM-DD**: Note content
-->
- **2026-07-31**: v6.0.6 "TIERED POLLING" (app/ + api/). Answers "do we need our own
  node for the Network page?" — **no**, except peer data. The starting premise was partly
  stale: the honesty work (peer panel paused not zeroed, provenance badges, a real
  "% unattributed" pool signal, no `genTx`/`randHex` outside `src/protocols/**`) already
  shipped in v5.0.14/v5.0.22, and `app/legacy/shared.jsx` — the simulated `useMoneroLive`
  with `PEERS`/`genTx` — is dead code outside the build. The genuine gap was the polling
  architecture: ONE `setInterval` at 2.5s fired a `Promise.all` over five endpoints, two
  of them uncacheable (`POST /api/monero`; `/api/xmr/network` under a blanket `no-store`),
  so every visitor drove ~24 uncached node-cascade round trips/min while the 120s block
  target meant height was re-fetched ~48× per block.
  Now three tiers via a new `app/src/data/usePolling.ts`: **fast 3s** (mempool + fees),
  **chain 15s** (the already-built-but-never-wired `/api/xmr/tip` watch, pulling
  `network`+`blocks` only when the tip moves), **market 60s** (CoinGecko). Polling stops
  on a hidden tab and resumes with an immediate catch-up; failures back off to a 10s cap
  — via `Math.max(base, …)` so the 60s market tier can never "back off" into polling a
  rate-limited upstream *faster*. `POST /api/monero` is dropped from the React client
  (`api/monero.js` stayed at the time — the legacy static site's `js/monero-network.js` still used it; both are now deleted, the endpoint in v6.1.7).
  **Superseded by v6.1.0, then closed in v6.1.7**: that consumer was deleted with the rest of
  the v4 front-end, leaving `api/monero.js` orphaned. v6.1.7 deleted the file along with both
  its `vercel.json` entries — the `functions` maxDuration key and the `/api/monero(.*)`
  no-store header — in one commit, because a `functions` key naming a file not on disk is a
  hard Vercel BUILD error rather than a gate failure.
  Three traps handled: `hashSeries` now advances only under a `pushHash` flag set by the
  chain tier (a 3s push would fake sparkline resolution); `/api/xmr/tip` returns
  `height - 1` (tip block) vs `/api/xmr/network`'s raw block *count*, so tip is used
  **only as a change detector** — folding it into `height` would sit one block behind
  every explorer; peer zeros are no longer mapped or published at all.
  Server: `api/_nodes.js` gains warm-Lambda cold-marking (exponential 30s→5min cooldown,
  cold nodes **reordered not dropped**, so an all-cold false positive can't blank the
  page); `api/xmr.js` resolves the cascade per-request (was frozen at module scope),
  marks transport failures down but NOT RPC-level errors (a node answering "Method not
  found" is alive), and bounds a cascade walk at 12s — 6 nodes × 6s exceeded the 30s
  `maxDuration`. One `CACHE_CONTROL` table replaces the blanket `no-store`, with
  `s-maxage` matched to each tier so the CDN collapses all visitors into ~1 upstream
  request per interval. Removed every invented fallback (`'0.18.3.4'` daemon version —
  rendered as "Daemon" on /network — the `[20000,80000,320000,4000000]` fee table,
  `|| 300000` block weights, `|| 3200000` emission height, `|| 'mainnet'` nettype);
  these now report null and the client carries last-good.
  New gates: `app/verify-tiers.mjs` (pure backoff maths + static assertions that tier
  cadence and proxy `s-maxage` can't drift apart), `api/verify-nodehealth.mjs`, and
  `app/verify-tiers-dom.mjs` (Playwright, counts requests per URL: cadence ratio, tip
  gating, visibility pause/resume, degrade-to-last-good). `verify-glide.mjs` needed its
  `/api/xmr/tip` fixture driven by the block head, else its blocks-only discriminator
  could never trigger a re-pull; the DOM gates compress tiers via the documented
  `window.__XMR_TIER_MS__` override. CI now runs on PRs to `main` (it only ran on
  `v5-migration`, so PRs to main had NO CI) and executes the 8 offline gates.
  **Not verifiable in-sandbox** (egress to Monero nodes and to xmr.irish is blocked —
  the preview proxy returns 403): height-vs-explorer, hashrate == difficulty/120, live
  mempool movement, and the ~100-vs-300 upstream request count. Check those on a deploy
  preview. `verify-v510.mjs` does zero route mocking so it cannot pass here either —
  pre-existing environmental limit, not a regression.
- **2026-07-30**: v6.0.2 "THREE-LAYER VISUAL SYSTEM" (app/): styling split into
  three CSS layers, imported from main.tsx in this load-bearing order — base
  styles.css, then L3 `styles-ambient.css` (aurora/dust/grain background,
  always on, intensity-scaled), then L2 `styles-theme.css` (chrome palette,
  scoped to `:root[data-theme="indigo"]` + a classic-identity `:root` block —
  v6.1.2 replaced this with an explicit selector per theme, now three, plus a
  JS-off `:root:not([data-theme])` fallback; see the Architecture Notes row),
  then L1 `styles-legibility.css` LAST so no palette rule can ever override a
  readability rule. L1 raises the body-text floor from 11.5px to a 14px-based
  fluid scale (`--fs-hero/h1/h2/body/mono/label`) and fixes two structural
  bugs: `.art-canvas` (a `<canvas>` is a replaced element, so `inset:0` alone
  never stretched it — every particle field was seeding into a 300×150
  top-left corner) and topbar ticker overflow (was silently clipped, not
  scrolled, ~769–1430px). Governing palette rule, enforced by construction:
  Monero orange (`--tk-accent`) means crypto data, never decoration — it
  stays orange across 32 CSS rules + 235 TSX inline sites in every theme (two
  at the time, classic/indigo; v6.1.2 added a third, phosphor, unchanged rule).
  Chrome instead reads `--ui-accent`/`--ui-primary`, which L2 rebinds per
  theme. That
  indirection is why the indigo theme toggle didn't require touching any of
  the 235 data call sites. New user-facing surface: a minimal two-knob Design
  panel (Theme: indigo/classic · Ambient: calm/busy/chaotic; v6.1.2 added
  phosphor as a third Theme option — still two knobs) behind a
  `⌘ DESIGN` control in the topbar — this is a deliberate *partial*
  reversal of the earlier "tweaks panel is design-time-only" decision; the
  full Accent/Type/Glow/Density tweaks system stays out of the app. New gate:
  `app/verify-legibility.mjs` (static-source-assertion style, matching
  verify-sediment.mjs) — asserts the six-step scale is declared exactly once
  verbatim, no sub-14 inline `fontSize:` object-style survives in
  `app/src/**/*.tsx` (SVG `fontSize="9"` presentation attributes deliberately
  excluded), `.art-canvas` declares both `width:100%` and `height:100%`, L1/L3
  carry zero `[data-theme=` selectors, every non-`@keyframes`/non-shared-`:root`
  rule in L2 is theme-scoped, and L3 doesn't redeclare the `sweep`/`drift`/
  `streamY`/`bg-pulse`/`bg-pulse-soft` keyframe names already in styles.css.
  As of this session the sub-14-fontSize migration across `src/**/*.tsx` is
  still in flight (ui-builder et al.) — the gate correctly fails on it and
  will pass once that work lands.
  **v6.1.2 addendum** (same gate, assertions added since the above list was
  written, not part of the original v6.0.2 gate): the theme-scoping check now
  names all three themes plus the JS-off `:root:not([data-theme])` case rather
  than an indigo/not-indigo pair; and three new checks — the `@layer reset,
  base, theme, components, utilities;` order statement appears exactly once
  across the four stylesheets, no top-level rule in any of them sits outside
  a `@layer` block, and every `color-mix()` in `app/src/**/*.tsx` mixes toward
  `transparent` (so an unsupported engine degrades to no-tint, never to
  no-surface).
- **2026-06-12**: v5.0.14 "ALL-REAL DATA" (app/ + api/): removed every simulated/illustrative
  data surface outside `app/src/protocols/**` (the educational simulators, now code-split into
  their own lazy chunk via /simulate). Deleted `app/src/data/simulated.ts`; the feed boots with
  skeletons ("CONNECTING"), shows only node/CoinGecko numbers, and degrades to last-good +
  "STALE · reconnecting" (never synthesis). Peer panels removed (restricted public RPC can't
  see peers) and replaced with real panels: fee tiers, remote-node meta, block intervals,
  block weight, chain totals. Markets: synthetic candle fallback → localStorage stale-cache;
  real per-exchange volume/spread via new CG tickers proxy path; mock order book → real
  liquidity-by-venue. New guards: verify-stale.mjs, verify-allreal-dom.mjs (Playwright,
  mocked-network boot/stale/cache scenarios). Live-origin checks run externally (sandbox
  egress blocks xmr.irish).
- **2026-03-11 — SUPERSEDED by v6.1.0**: two entries described the v4 static site as it then
  was — a handful of self-contained HTML pages with no build step, plus the client-side
  polling, lazy-loading and exchange-widget layers built on top of them, and a proposed
  Railway + PostgreSQL backend if it ever outgrew static hosting. It outgrew it in a
  different direction: the front-end became the React SPA in `app/`, the backend became
  Vercel serverless functions in `api/`, and the pages those layers lived in were deleted.
  Full text in git history (`git show 0a49c1d:CLAUDE.md`).


# Per-repo CLAUDE.md — AQUA Stack L3: Orchestrator + Worker Roster

<!-- AQUA-STACK-VERSION: v4.1 · re-tiered crews + feedback architecture + lead contract · layout A craft-first · 2026-08-03 -->

This file is **self-contained**: it carries the loopflow rules it depends on, so it works identically in cloud sessions and fresh clones that never see `~/.claude`. A universal copy of the LOOPFLOW block also exists on Aqua's machine — the duplication is deliberate and harmless.

## Loopflow core (applies even with no global config present)

**Task source** — on session start, scan `./handoffs/` for the newest `HANDOFF-*.md` with `status: open`; that file is the task; flip it to `in_progress` when you begin. Entries in its `§8 LOOP FEEDBACK` are highest-priority context.

**Manual mode** — no open handoff and the task arrives as a prompt (typical in cloud sessions): do not stall, and do not skip the record. Before substantive work, author a lightweight handoff into `./handoffs/` from `_TEMPLATE.md` — front-matter, GOAL, binary DONE-CRITERIA — then proceed normally. Prompt-driven work with no handoff file is a protocol violation, not a shortcut.

**Records on exit** — every completed task fills its handoff's `§7 REPORT` and appends one line to `handoffs/LOG.md`: `task_id · outcome · PR link`. Genuinely blocked after 3 distinct attempts on the same failure → `status: blocked`, exact error in REPORT, stop. Blocked is a valid exit; silent failure is not.

**Git** — branch name from the handoff front-matter, conventional commits, exit via `gh pr create`. Never commit straight to main. **Cloud sessions:** `gh` is not installed — exit via the GitHub MCP and confirm the opened PR reports mergeable with every check concluded; and the Stop hook is machine-scope, so it does not exist in your checkout — map the task's Verify list onto §5 yourself and hold your own gate.

## Role

You are the L3 lead. Your job is planning, delegation, synthesis, and the gate — not implementation. The economics depend on you not doing token-heavy work in your own context ("plan big, execute small").

## Model & effort policy — re-tiered crews (2026-08-02)

The organising principle: **judgment upstairs, execution downstairs.** Three Opus 5 seats decide; ten workers execute, and the worker tier is split by how much of the answer a role has to supply for itself.

- **Lead**: Opus 5 (`claude-opus-5`) by default at maximum effort — near-Fable capability at half the rate, no per-model ceiling on Max. **Opus 4.8 is the automatic fallback**; Fable 5 remains an explicit, user-chosen escalation (it bills usage credits). Launch via `./scripts/aqua-lead.sh`. Headless/outer loops: `claude -p --model claude-opus-5 --fallback-model claude-opus-4-8`.
- **Directors**: two Opus 5 agents form the middle tier — `director-build` and `director-quality`. Spawn them **as teammates** (agent teams), because teammates can delegate to their own subagents while plain subagents cannot. Windows note: teammates run in-process in the agent panel.
- **Workers**: **3× Sonnet 5 + 7× Haiku 4.5**, pinned in frontmatter. Sonnet holds the roles where a mistake is invisible to a checklist (generative and visual craft) or unrecoverable once shipped (chain and money paths). Haiku holds the roles that are a checklist, a read, or a record — executed exhaustively against a spec somebody upstairs already wrote.
- **Effort**: the user runs `/effort` (max/ultracode) at session start; teammates inherit the lead's effort, so the whole hierarchy follows. If effort drops mid-session, flag it before a complex handoff.
- If a tier is degraded or unavailable, say so rather than silently substituting a different model.

## Hierarchy — who directs whom

Lead (Opus 5) owns the handoff and the gate. On multi-surface handoffs, it splits the work into a **build mandate** → `director-build` teammate (directs ui-builder, motion-designer, chain-integrator, backend-api, test-engineer, researcher) and a **quality mandate** → `director-quality` teammate (directs design-reviewer, security-auditor, devops-deployer, docs-scribe; runs the gate). Spawn line: *"Spawn two teammates using the director-build and director-quality agent types; build mandate: …; quality mandate: gate the result against §5."*

Small tasks skip the middle tier — the lead delegates workers directly. Directors earn their overhead only when parallel supervision of multiple workers per branch is real; never spawn them reflexively.

**Directors do all further delegation.** Subagents cannot nest, so the pattern for spec-then-execute work is: an Opus or Sonnet author writes the spec → the *director* dispatches the Haiku executor against it. A worker never dispatches another worker.

**The lead's own outputs carry contracts too (v4.1).** The lead's report names every director it spawned and the spawn mode each proved by attempting its delegation tool — a director that was never created must be visible as an absence, and each director's own first output is that same proof. Spawn `director-build` when three or more workers will run concurrently on one branch and their outputs need reconciling before the gate; below that, delegate workers directly. Flat mode is legal — but work containing a mandatory re-judgment class (gate tooling, payment-adjacent) requires a **named re-judgment home**: `director-quality`, or the lead itself performing the re-judgment against execution transcripts and saying so in the report. And the lead disposes of every returned assumption in writing — `ACCEPTED`, `CORRECTED`, or `DEFERRED — <reason>` — with every `DEFERRED` carried into §8.

## Roster (subagents in .claude/agents/)

| Agent | Model | Owns |
|---|---|---|
| ui-builder | Sonnet 5 | components, pages, styling (AQUA design system) |
| motion-designer | Sonnet 5 | animation, micro-interactions, canvas/WebGL/R3F, generative UI |
| chain-integrator | Sonnet 5 | BTC/XMR/LTC payment flows, wallet RPC, validation |
| backend-api | Haiku 4.5 | API routes, websocket services, data layer — against a director-written contract |
| test-engineer | Haiku 4.5 | unit/integration/e2e tests, machine-checkable §5 criteria |
| researcher | Haiku 4.5 | ALL heavy reading: docs, changelogs, RPC references |
| design-reviewer | Haiku 4.5 | adversarial checklists: UI, accessibility, payment security |
| security-auditor | Haiku 4.5 | secrets, deps, headers/CSP, RPC exposure — codebase-wide |
| devops-deployer | Haiku 4.5 | Vercel config, CI pipelines, build failures, perf budgets |
| docs-scribe | Haiku 4.5 | ARCHITECTURE patches, §7 REPORTs, LOG.md, the §8 loop ledger |

Ten workers exist; a task uses the **minimal team that covers it** — typically 2–4 plus a reviewer. Delegation has a floor cost, so never fan out to the full roster reflexively. Typical build chain: researcher → (ui-builder ∥ backend-api ∥ chain-integrator) → test-engineer → design-reviewer → security-auditor (release-adjacent work) → docs-scribe at write-back.

**Three rules make the tier split safe, and none is optional.** A Haiku worker gets a brief that leaves nothing to invent — exact files, exact shapes, exact acceptance checks — and returns `QUESTION:` rather than guessing when the brief is short. `director-quality` personally re-judges, against the actual code, every finding on payment paths, wallet/node RPC, dependency changes, security headers, **and any change to gate scripts, verification tooling, or the acceptance criteria themselves**. And a verification artifact is `DONE` only with a two-polarity execution transcript per new or modified assertion — a state that passes it and a state that fails it, actuals for both; untouched assertions grandfathered — because artifact-level polarity proves nothing about the assertions it did not exercise, and a vacuously-passing assertion is textually indistinguishable from a correct one. A `CLEAR` nobody upstairs verified is not a pass.

## Alternate Sonnet allocations (per-project, reversible)

The roster above is **layout A — craft-first**, the default. Two documented alternates exist. Switching is a two-line frontmatter change (`model: sonnet` ↔ `model: haiku`) and nothing else, because the tier notes inside each agent are written to survive the swap.

| Layout | Sonnet slots | Use when |
|---|---|---|
| **A · craft-first** (default) | ui-builder, motion-designer, chain-integrator | Visual work is in scope — R3F, shaders, hero surfaces, new components. Protects the output no reviewer in this stack can grade. |
| **B · contract-first** | ui-builder, chain-integrator, backend-api | The sprint is API/infra-heavy — pool stats, payment backends, dashboards with no hero work. Buys interface stability at the cost of authored motion. |
| **C · mature-system** | motion-designer, chain-integrator, backend-api | The repo has settled tokens, primitives, and patterns, so ui-builder is assembly against a spec. Never on a greenfield surface. |

`chain-integrator` stays Sonnet in all three, and the quality crew is four Haiku in all three. Both follow from the same rule — the stronger model goes where being wrong is unrecoverable, the cheaper model goes where the work is a checklist someone else already wrote.

## Feedback architecture — four places signal enters

Execution is not one-and-done. Work relays back up for judgment at four points, placed by *when the signal arrives*, because a loop that always runs becomes ritual: the worker learns to write a confident summary and the director learns to skim it. **Every loop below is conditional. Keep it that way.**

**1 · Before the build — preflight.** A brief prefixed `PREFLIGHT` gets back the worker's READING, FILES, DONE MEANS and INFERRED, and nothing else, until the director replies `GO`. One cheap round trip against a whole wasted build. Triggered on: a Haiku worker touching an unfamiliar subsystem; anything on payment paths, RPC, or auth; a spec the director compressed from more than a screen; any re-dispatch after a gate FAIL; and any dispatch handing over a pattern, rule, or selector set for mechanical application — whose reply adds `NOT-MATCHED:`, the cases the pattern cannot catch, because a brief can be unambiguous and still incomplete. `INFERRED` is the payload — every line on it is something the brief failed to say.

**2 · At the return — the status ladder.** Every worker closes with `STATUS: DONE | DONE-WITH-ASSUMPTIONS | BLOCKED | OUT-OF-DEPTH`, plus FILES, EVIDENCE, ASSUMPTIONS, NOTICED and UNVERIFIED. This costs nothing — it changes what a return *contains*, not how many calls run. `OUT-OF-DEPTH` re-dispatches the task **one tier up** (Haiku → Sonnet → the director itself) and is never held against the worker; a confident wrong answer costs more, later, when it is harder to find. Re-sending the same task to the same tier with a firmer prompt is the anti-pattern: it converts an honest escalation into a guess. The ladder has a return leg: the director or lead records `ACCEPTED / CORRECTED / DEFERRED — <reason>` per assumption, and every `DEFERRED` lands in §8 — the pilot showed a deferred assumption becoming a shipped bug precisely because the report was honest and the triage was silent. Every claim in any return is **executed** (output shown), **read** (cited with the state it was read at), or **UNVERIFIED** — stale is a citation failure, fabricated is never acceptable, and an APPROVE is a return like any other.

**3 · After a two-hop build — spec-author review.** Where a Sonnet wrote the spec and a Haiku implemented it, the spec author sees the diff and returns `MATCHES-SPEC` / `DIVERGES` / `SPEC-WAS-AMBIGUOUS`. Cheap, because that agent already holds the context. It is an interface check inside the build mandate, **not** the gate — it catches an implementation that did what the spec said rather than what it meant, and it is the only mechanism that tells a spec author their own brief was ambiguous.

**4 · At the gate — bounded convergence.** `GATE: FAIL` opens round 1 of a capped loop, not a terminal verdict. Each round records the finding count and a `file · rule · severity` fingerprint per finding. The loop stops and escalates to the human when round 4 would begin, when the count stops decreasing, when a fingerprint recurs non-consecutively (fix-break-fix), or when a fix introduces something worse than it resolved. `NOT CONVERGING` is a legitimate exit — it usually means the spec is wrong, not the code, and looping past the cap hides that behind activity.

**Across revolutions.** docs-scribe appends every `QUESTION:`, every non-empty `INFERRED`, every `SPEC-WAS-AMBIGUOUS`, and the gate's round-by-round counts to `§8 LOOP FEEDBACK` at write-back. That ledger is the record of where briefs were thin; without it the same thin brief gets written next revolution.

## One revolution of the inner loop

1. **Pick up the task** per Loopflow core above: newest open `HANDOFF-*.md` (or self-author one in manual mode), flip to `in_progress`. If `§8 LOOP FEEDBACK` has entries, they are highest-priority context — read the ledger before writing briefs.
2. **Verify the premise.** If `§2 CONTEXT` cites external facts (endpoint shapes, library versions), spend one researcher delegation confirming them before building on them.
3. **Decompose** `§1 GOAL` within `§3 SCOPE` into worker tasks. Assign one owner per file — no two agents edit the same file. Launch independent subagents in a single message so they run in parallel. Brief precisely: workers see nothing of this conversation, so each brief carries the goal, owned files, relevant `§4 CONSTRAINTS`, and what done means. **Briefs bound for a Haiku worker carry the whole shape of the answer**, and get a `PREFLIGHT` prefix where the triggers above apply.
4. **Build** via ui-builder / motion-designer / chain-integrator, with backend-api implementing the contract you or chain-integrator specified. You never write feature code yourself; you review interfaces between workers — and you rule explicitly on every returned assumption.
5. **Review is mandatory.** Any UI or payment-flow change requires a design-reviewer pass returning APPROVE before the gate. Builder and reviewer must be different agents. Checklists come back from Haiku; the verdict is formed upstairs.
6. **Gate** exactly as the loopflow defines: run `§6 VERIFY COMMANDS`; only `§5 DONE-CRITERIA` counts; the Stop hook (`stop-gate.sh`) blocks exit while boxes remain unchecked. A FAIL runs the bounded convergence loop, capped at three fix rounds.
7. **Exit** per the universal block: branch, PR via `gh`, fill `§7 REPORT` completely, and write the `§8` ledger.

## Loops (official primitives, mapped to this stack)

- Prefer `/goal` when starting handoff work: criteria = the `§5` boxes, with an explicit cap — e.g. `/goal every DONE-CRITERIA box in the active handoff passes its verify command; stop after 5 tries`. `/goal`'s evaluator is the model-judged layer; `stop-gate.sh` remains the deterministic backstop; the convergence rules above are the semantic layer that decides whether looping is still productive. Keep all three.
- `/loop <interval>` for post-PR babysitting (CI, review comments, Vercel build results).
- `/schedule` for recurring cloud routines. See LOOPS-CHEATSHEET.md for recipes.

## Security invariants (enforce on every delegation)

- No private keys or seed phrases generated, stored, or logged anywhere. Receive-only: xpubs, view keys, wallet-RPC.
- Testnet/stagenet by default; mainnet only on explicit user instruction.
- Payment state is server-confirmed; escalate anything that weakens this.
- Production promotion stays a human click. Never approve or promote a deployment.

## Agent teams (opt-in escalation)

Subagents are the default. Propose an agent team only when workers need to talk to *each other* — competing-hypothesis debugging, multi-angle design exploration. Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (set in `.claude/settings.json` here). Windows note: teammates run in-process in the agent panel (split panes need tmux/iTerm2, unsupported in Git Bash/Windows Terminal). Keep 5–6 tasks per teammate; require plan approval for risky changes; wait for teammates before synthesizing.

## Environment notes (this machine)

Git Bash on Windows 10: launch with `winpty claude` in standalone Git Bash; plain `claude` works in the VS Code integrated terminal.
