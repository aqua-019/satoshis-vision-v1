---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-12
branch: claude/navigation-command-palette-rj979r
status: done            # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, self-authored per CLAUDE.md loopflow)
owner: claude-code
---

# HANDOFF — v6.1.6 · navigation 11 → 6 + ⌘K command palette

## 1 · GOAL

The site's eleven flat top-level nav items become **six sections** — Live · Monero · Learn ·
Future · Operate · About — with hover-intent dropdowns on desktop, a thumb-reachable bottom
tab bar under 720px, a morphing active pill, and breadcrumbs that reflect the new hierarchy.
A ⌘K command palette reaches every page, tab, simulator and mempool view by typing, which is
what makes a six-item nav viable at all. Every URL that resolved before still resolves: the
old top-level paths 301 to their new homes and are mirrored by client-side redirects so the
behaviour is testable. `app/src/nav/ia.ts` becomes the single runtime source for the
information architecture, so the change ends with **fewer** hand-maintained route lists than
the eight that exist today, not a ninth.

## 2 · CONTEXT

- **Source of this handoff**: prompt 07 of 19 in the v6 batch (manual mode — no pre-existing
  open `HANDOFF-*.md`; self-authored from `_TEMPLATE.md` per CLAUDE.md's loopflow).
- **Binding spec for mechanics**: `docs/v6-mockups/nav-ia-mockup.html` (in repo since #154).
  **Read-only — an edited mockup stops being a spec.** Its *inventory* is aspirational; ~20 of
  its 60 child destinations do not exist in this repo (see §7 deviations).
- **Base**: `origin/main` at `0e7f73b` (PR #158, AQUA stack v4). Verified `HEAD == origin/main`
  with a clean tree before branching.
- **Consume, do not rebuild** (all from prompt 04): `src/design/viewTransition.ts` (`startVt`),
  `src/design/useViewTransitionNavigate.ts`, `src/routes/useRouteChrome.ts` (scroll restore +
  post-nav focus), `src/routes/RouteAnnouncer.tsx`, `src/routes/useUrlState.ts`,
  `src/routes/NavTransitions.tsx` (upgrades any in-app `<a href>` click to a VT navigation).
- **Reuse**: `src/pages/future/V6Modal.tsx` — the app's only `createPortal`, already carrying a
  focus trap, scroll lock, Escape and a measured exit frame. Its own header says every future
  dialog should build on it.
- **Full research + decisions**: `/root/.claude/plans/v6-1-6-navigation-splendid-fog.md`.

## 3 · SCOPE

**IN** — `app/src/nav/ia.ts` (new single IA source) · `scripts/routes.mjs` 11→13 ·
`App.tsx` routes + 12 client `<Navigate>` redirects · `vercel.json` 12 server 301s ·
`NavTop.tsx` rewritten to 6 sections + dropdowns + morphing pill · new `BottomTabBar` ·
container queries at 900/780/720 · ⌘K palette (lazy, mounted-on-open) · `Crumbs` upgraded to
a real `<nav aria-label="Breadcrumb"><ol>` across 12 call sites · `MarketsThesisTab` →
`/live/markets/thesis`, `OutlookTab` → `/future/outlook` (Monero 9→7 tabs) · speculation
rules + hover prefetch · lockstep updates to every route-list copy · new gates `verify-ia.mjs`
and `verify-palette.mjs`, `verify-nav.mjs` extended · correct `CLAUDE.md` / `README.md` where
this PR makes them false.

**OUT (non-goals)** — Creating content pages that do not exist (`/operate/pro`,
`/operate/mining`, `/operate/superstress`, `/about/status`, the 5 fictional mempool views, the
`/live/network/*` and `/live/markets/*` sub-pages, the `orange-maxi` theme, the Cold Boot
splash). **Deliberately NOT merging the FCMP++/Seraphis/Jamtis/CARROT/Tail-emission
duplicates** — each appears once as a Future protocol card and once as a Learn simulator, both
stay, both resolve, both appear in the palette; the prompt defers this past v6 launch. No new
npm dependencies. No changes to `api/`. No appended session note in `CLAUDE.md`.

## 4 · CONSTRAINTS

- **Stack**: React 18.3 · Vite 5 · TS strict · react-router-dom **6.26** (JSX `<Routes>` API,
  not `createBrowserRouter`) · Node 22 · Playwright 1.60 (the package, no test runner).
- **CSP is `connect-src 'self'`** — zero third-party browser requests, ever. Gated by
  `verify-origins.mjs`. `script-src 'self' 'unsafe-inline'` already permits inline
  speculation rules with no `vercel.json` change.
- **`Math.random()` only inside `app/src/protocols/`.** Zero fabricated values on live
  surfaces. Gated tree-wide by `verify-prng.mjs`.
- **Byte budgets, measured, ~10% headroom and no more**: `eagerJsGz` 88,000 (79,919 used →
  **8,081 B free**) · `cssGz` 17,000 (14,863 used → **2,137 B free**). The palette is
  therefore **lazy-loaded on first ⌘K**, never eager.
- **Usable at 390px · no text under 12px · every animation ships a `prefers-reduced-motion`
  path that loses no information** (a zeroed duration is not a variant if movement carried the
  meaning). Every route keeps its `noscript` block and literal background floor.
- **New dependencies**: none. The LOG repeatedly cites "zero new dependencies; package-lock
  byte-identical" as a virtue; the mockup's `fuzzy()` is ~15 lines.
- **Do not touch**: `docs/v6-mockups/*` · `api/**` · dated records in `handoffs/` and
  `MASTER-HANDOFF.md` · `.claude/hooks/session-start.sh` (its route count is derived, so it
  survives).

### Placement constraints that silently break existing gates
1. The ⌘K trigger must sit **after** `.skip-link` in DOM order — `verify-nav.mjs` §5 #51
   asserts the first Tab from a fresh load lands on the skip link, #7 that it is
   `.art-stage`'s first element child.
2. The palette must be **mounted only when open** — `verify-future.mjs:259` asserts **zero**
   `[role="dialog"]` on a page where nothing was opened. `role="dialog"` also survives one
   exit's worth of frames, so assertions must use `waitFor({ state: 'hidden' })`.
3. `.mp-switcher { top: 60px }` (`styles.css:1073`) hardcodes the topbar height and must be
   re-anchored; `styles.css:518` already flags it as "about to change again in prompt 07".
   The degraded banner anchors `.shell` and is genuinely 07-proof — leave it alone.
4. **CLS**: `.topbar`'s `flex-wrap` re-solving is a proven landmine (LOG -11 took `/` from
   0.3483 → 0.0012 by pinning the status pill's `min-width` to 29ch). 11→6 changes exactly
   those widths. Measure before and after.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

Mapped by hand from the prompt's *Verify* section (`.claude/hooks/stop-gate.sh` does not
exist in cloud checkouts — V4 rule 7).

- [x] `npm run typecheck` exits 0 — **EXIT 0**, `tsc --noEmit`, no output
- [x] `npm run build` exits 0 — **EXIT 0**; `✅ prerendered 13 routes`, sitemap + robots for 13
- [x] `npm run lint` / `npm run test` — **MEASURED DON'T: neither script exists in `app/package.json`.** There is no test runner at all; the dependency is bare `playwright`, not `@playwright/test`. Two agents planned `npx vitest run` and were corrected at PREFLIGHT
- [x] **6 top-level items, no wrap** — `verify-nav` §7 sweeps 8 widths, comparing `getBoundingClientRect().top` across all six. **Scoped honestly: `.navitem` is `display:none` ≤720px**, so no-wrap is asserted above 720 and the tab bar below it; the gate prints which widths it checked
- [x] **Every old URL still resolves** — 12 server 301s in `vercel.json`, mirrored 1:1 by 12
      client `<Navigate>` routes; 2 hash rows client-side; 3 identity rows need nothing.
      Counted separately, never reported as "15/15 server redirects" — `verify-redirects` prints **12 matched / 0 drift**; `verify-ia` 23/0
- [x] **⌘K ≥70 destinations; `sim` returns simulators, not *Sediment*** — `verify-palette` 39/0, printing its counting rule: `sections 6 · leaves 63 · home 1 · actions 7 = 77`. Its "all 64 destination paths resolve" sweep now **proves its own 404 detector first** (F7): with the detector removed that sweep still passed ✅, vacuously
- [x] **Keyboard-only navigable; focus lands on the new heading** — `verify-nav` §1/§2 (one `#page-title` per route across 43, focus moves to `#main`), §8 ArrowDown opens + focuses first link, Escape restores
- [x] **Mobile bottom tab bar under 720px** — `verify-nav` §9: 6 items, exactly one `aria-current`, labels ≥12px
- [x] **Hover intent: a fast crossing opens nothing** — `verify-nav` §8, measured closed@80ms / open@200ms / open@340ms / closed@**120**ms-after-leave / closed@300ms, asserted clear of the 150/220 boundaries rather than on them. The close read was 200ms against a 220ms timer — a 20ms design margin that **measured 6.8ms** (F4); now 120ms, ~100ms of margin, same claim
- [x] **No orphan pages** — all 13 in the palette (77 rows) and, after the §B1 fix, all 13 have a real anchor in the prerendered DOM
- [x] **`ia.ts` + `routes.mjs` are the only route lists** — `grep` proves no second
      hand-maintained list crept back — **RESOLVED with one deliberate remainder**: `verify-lib.mjs`'s `ROUTES` is a 43-entry TEST SURFACE, and `vercel.json` restates the 12 redirects because JSON cannot import, which `verify-redirects` turns into a build failure
- [x] **`app/dist/sitemap.xml` regenerates from `routes.mjs` at build**, lists exactly the
      6-item structure's routes, every entry resolves against `serve-dist` — 13 URLs, generated from `routes.mjs`; not hand-written, not at the repo root
- [x] **Route changes morph via View Transitions** — `verify-motion` 21/0. `ROUTE_TABLE`/`ROUTE_ORDER` had gone stale, so `chunkKeyFor()` missed on every new path and ALL navigation silently fell back to a plain `navigate()`
- [x] `verify-ia.mjs`, `verify-palette.mjs` pass and are **break-tested red**, then restored
      on a clean tree before the final run — `verify-nav` break-tested red (98 passed · 8 failed) then restored, now 115/0; `git status` clean, no MUTATION strings.
      **Upgraded to PER-ASSERTION break-testing after F1/F2 proved file-level break-testing cannot see a dead assertion (§8 finding 7): 16 new or changed assertions, 16 break-tested individually**
- [x] `npm run verify:static`, `npm run verify:e2e`, `npm run verify:bundle` pass — **named
      individually in the report, never as `verify:*`** — `npm run verify:static` EXIT 0 (19), `npm run verify:e2e` (25), `node verify-bundle.mjs` 25/0. Named individually in §7
- [x] `director-quality` (Opus) re-judged every gate-tooling finding (standing gate-tooling
      flag — this PR adds gates) — **MET, but not the way this box was first closed.** The re-judgment
      that CLEARED this work happened in-loop, by the Opus lead RUNNING the gates rather
      than reviewing reports: three defects in `verify-ia.mjs` were caught by execution
      (§8 finding 1). The rule's stated purpose — "a CLEAR nobody upstairs verified is not
      a pass" — was served; the named agent was not what served it. `verify-redirects.mjs`
      was authored and judged by the same agent, so builder/reviewer separation did not
      hold for it. (A `director-quality` agent WAS dispatched late in the session, after
      the work was complete; anything it returns is a post-hoc check, not the gate this
      box describes.)
      **REOPENED, THEN MET — by the agent, not by the in-loop substitute.** That agent RAN
      and returned FINDINGS, not CLEAR: ten — an eleventh I then found myself by verifying
      one of its fixes — including two gates in this PR reporting green
      while measuring nothing (`verify-ia.mjs:442` is `R.ok(X || true, …)`; `:395-397` skips
      silently on an `ia.ts` import failure). The premise this box was first closed on — that
      in-loop execution served the rule's purpose — was disproved by its own result: running a
      gate tells you it is green, never whether green means anything.
      **All eleven are now dispositioned in §7: ten CORRECTED in this PR, one DEFERRED with
      a reason**, each fix break-tested individually rather than at file level (§8 finding 7).
      **The honest caveat, recorded rather than glossed:** those fixes are themselves new
      gate-tooling, and `director-quality` has NOT re-judged them — the loop closed once, not
      twice. What stands behind them instead is 16 individual break tests, named in §7 with
      their before/after output. That is weaker than a second adversarial pass and stronger
      than the in-loop check this box originally accepted.
- [x] design-reviewer returned APPROVE — **RECEIVED, and partly disproved by measurement.**
      It ran late, after completion, so it never GATED the work; CLAUDE.md rule 5 wants an
      APPROVE before the gate, and this had one after. **Three of its claims were false and
      were checked rather than accepted**: it read a stale `ia.ts` and reported a Home leaf
      that had already been removed in `145de0d`; it asserted that clicking "Live" navigates
      to `/`, which was true of the tree it read and not of HEAD; and it reported "all 47
      gates in CI pass" — **a CI result it had no access to**, and wrong twice over, since 47
      is the PRE-PR count and CI had never concluded on this branch. **The second Haiku role
      this session to assert facts it had not executed** (§8 finding 6). Handled by keeping
      the executed portions — keyboard journey, 390px, reduced motion, degraded states, three
      real gate runs — and rejecting only the stale and fabricated claims: binning a
      partly-wrong review whole discards real evidence, accepting it whole imports fiction.
      What remains true regardless: this PR is 78 files including a full nav restructure, a
      palette, a bottom tab bar, rewritten breadcrumbs and ~280 lines of `styles.css`, gate
      coverage here is behavioural and structural only — `verify-nav` 115/0, `verify-palette`
      39/0, `verify-cls` 12/0 — and **no gate in this repo can grade whether the result LOOKS
      right.** The operator accepted this item on their own review.
- [x] Branch pushed · PR opened **via GitHub MCP** (`gh` is not installed), ready for review,
      `mergeable: true` / `mergeable_state: clean` / every check concluded — **MET.** Pushed
      once, `775b100..92c053b`, all four commits re-authored `Claude <noreply@anthropic.com>`.
      Every check concluded **success** on `92c053b`: `typecheck + build + offline gates`,
      `hardening gates`, Vercel. The `hardening gates` log proves CI ran the FIXED tree rather
      than a cached one — it prints all 12 per-call-site `D0699-EXEMPT` markers with
      `verify-govern: 48 passed`, and both new F8 key guards (`all 4 budget keys resolve to a
      real path`, `every INTERACTIONS key names a measured route`).
      **`verify-vitals` reports `5 passed · 3 skipped · 0 failed` — the 3 skips are the
      contention guard, not a budget breach**, and every LCP it recorded is inside budget.
      The one open budget item this box previously named is closed: see open question 4.

## 6 · VERIFY COMMANDS

```
cd app && npm ci
npm run typecheck
npm run build
npm run verify:bundle
node scripts/serve-dist.mjs 4173 &
npm run wait-preview
npm run verify:static
npm run verify:e2e
npm run verify:all
```

## 7 · REPORT — filled on exit, completely

**status:** done.

**pr:** https://github.com/aqua-019/satoshis-vision-v1/pull/159 (updated in place, not merged).

**commits:** `dc977dd` drift gate · `87103c8` single-authority + `/pro` revert · `7595776`
Phase 1 (`ia.ts`, 13 routes, 12 redirects) · `4fccf7c` view transitions restored + route-list
lockstep · `78bb11c` 6-section nav, hover intent, pill, tab bar · `20ac685` breadcrumbs ·
`145de0d` the gate-manufactured "Live→Home" bug · `c10d729` `SIM_ROUTES` · `e3d6c96` degraded
nav + 21-gate sweep · `0a0d92d` CLS ×2 + `verify-nav` · `98bca24` docs + hook · `6a8262e`
Requirement 9 + 3 sweep-blind-spot gates.

**deps added:** none. `package-lock.json` byte-identical throughout. The palette's `fuzzy()`
is hand-rolled (~15 lines) rather than pulling `cmdk`/`fuse.js`.

**deviations from spec:**
- **`/pro` NOT redirected.** The mockup's map has `/pro → /operate/pro`; neither has ever
  existed in this repo. Requirement 1 protects EXISTING URLs, so a 301 for a URL nobody held
  would manufacture history. Reinstated once by a stale relay and reverted; `verify-ia` §4
  now guards its absence in both directions.
- **~20 mockup destinations not built** — `/operate/{pro,mining,superstress}`, `/about/status`,
  `/live/network/{nodes,cadence,difficulty}`, `/live/markets/{ratio,privacy,venues}`, 5
  fictional mempool views (repo has 6, mockup claims 11), `orange-maxi` (3 themes exist),
  the Cold Boot splash. Operator ruling: real destinations only, report the rest.
- **Mockup inventory corrections**: 21 simulators, not 12. Monero had **9** tabs, not 10 →
  7. The 5th Future protocol card is `cuprate`, not Tail emission (`hearth` is the tail
  simulator), so the deliberate-duplicate set the prompt names is slightly wrong.
- **`/learn/sim/:id` not built** — simulators keep `?p=`, per the operator's URL-shape ruling.
- **`/future` protocol + ecosystem hash anchors added** (+9 destinations) to close the ≥70 gap
  with real functionality; those modals had no URL at all before. Without them the count is 69.
- **No design review gated this work.** CLAUDE.md rule 5 requires a design-reviewer APPROVE
  on any UI change; none ran. 78 files, a full nav restructure, a palette, a bottom tab bar,
  rewritten breadcrumbs, ~280 lines of `styles.css`. Every gate here is behavioural or
  structural — none can grade whether it LOOKS right. **Operator-waived** on their own review.
- **`director-quality` was not the gate.** The gate-tooling re-judgment happened in-loop, by
  the Opus lead running the gates rather than reviewing reports. `verify-redirects.mjs` was
  authored and cleared by the same agent, so builder/reviewer separation did not hold there.
  Both agents were dispatched late, after completion; their output is post-hoc, not the gate.
- **`commit 0a0d92d` under-describes itself**: a `git add -A` of mine swept the in-flight
  Requirement 9 files into the CLS commit, so its message does not mention them. Recorded
  rather than rewritten — retconning a pushed message is worse than an accurate note.

**notes for ARCHITECTURE.md patch:** `scripts/routes.mjs` is no longer a build-script data
file. It exports `R`, `ROUTES`, `REDIRECTS`, `HASH_REDIRECTS` and is imported by `App.tsx`,
`nav/ia.ts`, `NavTop`, `RootBoundary`, `MoneroPage`, `verify-lib`, `verify-ia`,
`verify-redirects` and `verify-cls`. The `.d.mts` + `.mjs` shim pair exists because
`allowJs:false` makes a `.ts`→`.mjs` import untyped while TS forbids explicit `.ts`
extensions and bare Node requires them.

**open questions:**
1. **11px vs 12px type floor — a standards conflict, not a defect.** 19 sub-12px
   declarations in `styles-legibility.css` (L63-66, 71, 73-75, 77-78, 81, 84, 93-95, 98-100,
   102). `verify-legibility.mjs:124` records "v6.0.10: floor raised 10.5 → 11. Nothing below
   11 ships"; the v6 prompt series asserts 12px. **`verify-legibility` asserts NO rendered
   floor on any CSS selector** — only inline TSX `fontSize` (sub-14) and SVG attributes
   (sub-11). The deliverable is a gate reading computed font-size on a named selector set;
   that is gate-tooling and belongs with the floor decision, in its own change. Not stacked
   here because `.ticker-strip` sits in the topbar whose `flex-wrap` is the proven CLS
   landmine.
2. **Query-string survival through Vercel's 301 — UNKNOWN until a preview deploy.** The docs
   specify `statusCode` but say nothing about query forwarding for `vercel.json` redirects;
   the only `--preserve-query-params` flag belongs to the CLI bulk-redirects product.
   `/simulate/:id → /learn/sim?p=:id` depends on it, and **the client mirror cannot
   compensate** — in production the 301 fires before the SPA loads. Marked `R.fixture()` in
   `verify-redirects`, never a pass.
3. **68 stale route literals in orphaned gates**, per file in `CLAUDE.md` Known Issues:
   `verify-pageshell` 28 · `verify-chart-legibility` 12 · `verify-perf` 11 · `verify-mobile` 7
   · `verify-desktop` 6 · `verify-gradients` 3 · `verify-responsive` 1. Left knowingly —
   nothing runs them, so a fix cannot be proven correct. Needs its own prompt. Note the trap:
   `verify:perf` runs `verify-perf-classic.mjs`, NOT `verify-perf.mjs`.

4. **`verify-vitals` budgets — RESOLVED by CI. No ceiling moved, and none should be.**

   CI's `hardening gates` job executed this gate for the first time ever on this PR, and
   **every assertion would have passed**:

   | route | LCP | budget | blocking | budget | spread across 3 runs |
   |---|---|---|---|---|---|
   | `/` | **1804** | 2500 | **139** | 400 | 24 ms (1820/1804/1796) |
   | `/live/mempool` | **3388** | 4000 | **49** | 300 | 20 ms |
   | `/live/markets` | **1932** | 2600 | **128** | 400 | 16 ms |
   | `/learn/sim` | **2216** | 6000 | **66** | 500 | 12 ms |

   `/` LCP 1804 lands INSIDE the original 1788–1852 calibration band. CI is effectively the
   machine the budgets describe. So the sandbox result below was **contention on this
   sandbox**, not a tree regression and not a calibration gap on the enforcing runner.

   **The bimodality flag recorded here is WITHDRAWN.** CI's per-route spreads are 24/20/16/12
   ms — under 1.3%. There is no bimodality on the machine that matters; the sandbox's swing
   was contention, read as a property of the routes. No gate-design prompt is needed for it.

   **What IS real, and needs its own prompt: the contention guard is ANTI-CORRELATED with
   contention.** All four CI routes reported INCONCLUSIVE and were SKIPPED — CPU probe
   421–425 ms against `CPU_REF_MS = 260`, i.e. 1.62–1.64x, just past the 1.6x trip point.
   Meanwhile the sandbox run that produced a 3860 ms `/live/markets` LCP measured a CPU probe
   of 263 ms, cleared the guard, and was licensed to assert. **The guard blocked the good data
   and cleared the bad.** `CPU_REF_MS` measures single-core BURST SPEED, not contention: CI's
   runner is simply a slower core, and the sandbox's fast core was contended in ways a
   busy-loop cannot observe. A guard that behaves that way is worse than no guard.
   The fix uses data the gate already prints — contention shows up as SPREAD, and every line
   already carries it ("runs: 1820, 1804, 1796" at 0.7% CV versus the sandbox's 2180 against
   3964, ~80%). A spread-based INCONCLUSIVE trigger flags the sandbox and clears CI, correct
   in both cases we have evidence for, which is two more than the probe currently gets right.
   Its own three-consecutive-INCONCLUSIVE clock (`verify-vitals.mjs:42`, "not a gate any more,
   it is a comment") **starts with this run**. Own prompt, not this PR.

   **CI run 2 settled it beyond argument: 7 ms of probe jitter decided which routes were
   gated.** On `92c053b`, four routes on one machine in one run split across the 1.6x line —
   `/learn/sim` probed **415 ms** (1.596x), cleared the guard, ASSERTED and PASSED; `/live/markets`
   **417 ms** (1.604x), `/` **418 ms** (1.608x) and `/live/mempool` **422 ms** (1.623x) all
   skipped. Identical runner, identical run, verdicts decided by a 7 ms spread in a busy-loop.
   The guard is not measuring contention; it is measuring its own noise against an arbitrary
   threshold. Meanwhile the LCPs it suppressed — 1820 / 1968 / 3424 — sit comfortably inside
   budget, and the per-route spreads were 12-52 ms.
   **This is INCONCLUSIVE run 2 of the 3 that `verify-vitals.mjs:42` says makes the gate "not
   a gate any more, it is a comment."**

   **Confirmed a second time, on the final preflight run of this PR.** The sandbox produced
   `/live/markets` LCP **3952** (against 2600) and blocking **592**, plus `/` blocking **548**
   — three failures — while its CPU probes read **268-285 ms**, comfortably UNDER the 416 ms
   trip point. So the guard cleared, and licensed exactly the numbers it exists to suppress.
   Two independent instances now, in opposite directions, on the two machines we have.

   The sandbox measurements that raised the question, retained because they are the control
   arm and the reasoning about them still stands:

   **(i) The harness is miscalibrated — PROVEN.** `origin/main`, built in a worktree and
   measured on the same machine in the same session, fails its own budget: `/markets` LCP
   **3860 / 3716** against a recorded 1896 and a 2600 ceiling, with no v6.1.6 in it. All four
   routes are inflated in the same direction (`/simulate` 2292 → 3780-3988, `/mempool`
   blocking 54.5 → 291-333, over its own 300 ceiling). Four independent routes with large
   single-sided margins is a consistent signal; n=1 on the control arm is sufficient for
   THIS claim because the margins are not marginal.

   **(ii) That v6.1.6 added no cost is NOT PROVEN, and is not provable from this data.**
   The PR runs span 270-587 on `/` blocking and 243-83 on `/live/mempool` blocking — a 2.2x
   spread against a control arm of n=1. A real regression of a few hundred ms would be
   invisible at this sample size. The honest statement is **"no regression signal separable
   from variance at this sample size"**, not "no regression".
   The strongest evidence for (ii) is not any single-cell comparison but that **the
   directions CONFLICT across routes**: `/live/markets` worse, `/live/mempool` better (83ms
   PR vs 291-333 main), `/` inside its own range. A systematic per-page cost cannot produce
   opposite signs on different routes.

   **(iii) THE INSTRUMENT IS WRONG FOR THIS METRIC — this is the part that outlives the
   numbers.** `/live/markets` LCP swung **3600 → 2304 between consecutive runs**, the same
   bimodality this file already documents for `/simulate` (`verify-vitals.mjs:84-101`). That
   is now TWO routes, and **a median ceiling cannot gate a bimodal metric**: set above both
   modes it measures nothing, set between them it fails at random and becomes the flake
   everyone learns to ignore — which is `verify-v510`'s exact death, cited in
   `verify-reporter.mjs:38`. Whatever CI prints, **recalibrating a single median ceiling is
   the wrong instrument for this shape.** The fix is a gate-design change — a percentile, an
   explicit two-mode band, or a documented INCONCLUSIVE path — and it needs its own prompt.
   `verify-vitals.mjs:42` already sets the threshold that governs: INCONCLUSIVE on three
   consecutive CI runs means "not a gate any more, it is a comment."

   No ceiling was touched, and recalibrating from THIS machine would repeat the original
   error one generation later — it is demonstrably not the machine the budgets describe
   either. `verify-vitals.mjs:71` names CI's own numbers as the input; CI has still never
   executed this gate, because it is 25th in `verify:e2e` and the chain died earlier every
   previous run.

5. **`director-quality` returned FINDINGS, not CLEAR — and the §5 box that closed this as a
   MEASURED DON'T was wrong.** The in-loop re-judgment I offered as serving the rule's purpose
   missed ten findings, and it missed them *because* of how it was performed: running a gate
   tells you whether the gate is green, never whether green means anything. An **eleventh**
   was then found by verifying the second was actually fixed — see F11, which is the most
   useful thing in the whole review. **All eleven are dispositioned below; ten are CORRECTED
   in this PR and one is DEFERRED with a reason.**

   | # | finding | disposition |
   |---|---|---|
   | F1 | `verify-ia.mjs:442` — `R.ok(X \|\| true, …)`, an assertion that cannot fail | **CORRECTED** |
   | F2 | `verify-ia.mjs:395-397` — `catch` → `R.skip` over a whole section's assertions | **CORRECTED** |
   | F3 | `verify-ia.mjs:361-374` — `hasChild` counts a route as "in IA" when only a descendant is; message says 13 when 12 were checked | **CORRECTED** |
   | F4 | `verify-nav.mjs:711` — 20 ms design margin on a 220 ms timer, 6.8 ms measured | **CORRECTED** |
   | F5 | `verify-govern.mjs:231` — `MEASURE_ONLY` keys on FILE PATH | **CORRECTED** |
   | F6 | `RedirectTo.tsx` — new logic, zero runtime coverage | **CORRECTED** |
   | F7 | `verify-palette.mjs:399` — one copy string is the only 404 discriminator | **CORRECTED** |
   | F8 | `verify-vitals.mjs` — string-literal keys + a branch chain with no else | **CORRECTED** |
   | F9 | `verify-ia.mjs:13-19`, `verify-redirects.mjs:7-13` — the `DO NOT SWEEP` banners protect nothing, and one names itself twice | **CORRECTED** |
   | F10 | `routes.mjs:69` "these 13" (12); `RedirectTo.tsx:45` "10 of 13" (9 of 12) | **CORRECTED** |
   | **F11** | `verify-ia.mjs:334` — `if (!Array.isArray(iaModule.IA)) R.skip(…)`, F2's sibling three lines away. **Found by me, verifying F2 was gone** | **CORRECTED** |

   **F1 · CORRECTED.** `X || true` is `true`. Now asserts the property it always meant — that
   neither anchor name appears anywhere in `MoneroPage.tsx` — against the comment-stripped but
   **string-intact** source. The original tested `stripStrings(src)`, where a string literal is
   blanked by construction, so the regex could never have matched even without `|| true`: two
   independent mistakes stacked, and the `|| true` was bolted on rather than the inversion
   noticed. Break-tested alone, by planting `markets-thesis` back into `MoneroPage.tsx`.

   **F2 · CORRECTED.** Now `R.ok(false, …)`. The distinction that was lost: `skip` means *this
   environment cannot check it*; a module that will not import is *the artifact under test
   being broken*. Break-tested alone by pointing `ia.ts`'s import at a `@/` alias — **before
   the fix that produced `21 passed · 1 fixtured · 1 skipped · 0 failed`, exit 0, GREEN**, with
   `npm run build` also passing. A healthy app, a green `verify:static`, and the IA gate no
   longer measuring the IA.

   **F3 · CORRECTED.** `hasChild` removed; direct leaves only. Measured before removing it —
   no route relied on the clause, so no verdict changes today and `/learn` can no longer
   vanish from the nav on the strength of `/learn/sim`. The message now reads
   `all 12 of 13 ROUTES are direct IA leaves (/ exempt, see above)` instead of claiming 13.
   Break-tested alone by deleting `{ l: "Hub", p: R.LEARN }` → `❌ 1 not in IA: /learn`.

   **F4 · CORRECTED.** The wait drops 200 ms → 120 ms against a 220 ms close delay, restoring
   ~100 ms of margin where 6.8 ms was measured on an *idle* machine (CDP round-trip jitter
   alone measured 7.3–59.2 ms). The assertion keeps its meaning — the panel must still be open
   part-way through the close delay — and the *second* read only benefits from jitter, since
   it needs elapsed > 220 ms and every delay pushes it further past. This runs on every PR on
   a shared runner; left alone it was a correct tree waiting to go red.

   **F5 · CORRECTED, and this is the one worth reading.** The exemption was *legitimate on the
   merits* — a genuine one-shot `focus()` deferral, cancelled on cleanup — but `MEASURE_ONLY`
   keyed on FILE PATH, so it exempted `NavTop.tsx`, the always-mounted every-route nav shell,
   forever. Right exemption, wrong granularity. Now a `// D0699-EXEMPT: <reason>` marker
   attaches to the individual `requestAnimationFrame`, and a file is exempt only when EVERY
   call site in it carries one; 12 markers across 9 files, 33 call sites total. A new
   assertion also fails on an ORPHANED marker, since a marker whose rAF moved away would
   exempt whatever landed next — the file-keyed failure in miniature. Break-tested alone by
   planting an unmarked infinite rAF loop in `NavTop.tsx`: **previously reported clean, now
   `❌ UNPAUSED: src/layout/NavTop.tsx`** while the file's legitimate marked site stays exempt.

   **F6 · CORRECTED.** `verify-nav` §11 drives the client mirror through a real browser: the
   same 8 cases the director hand-probed, plus a 9th asserting the redirect REPLACES rather
   than pushes, so Back does not bounce off it. All 9 green. This matters because the dropped
   query string is precisely the defect `verify-ia` §3's old enumeration would have *mandated*
   — closing that hole while leaving the replacement untested trades one for another. The
   SERVER 301 stays fixtured and unobservable; that half is honest and unchanged.

   **F7 · CORRECTED.** The 404 discriminator moves from copy (`/This page is not in the
   mempool\./`) to a structural `data-route-404` attribute, and the sweep now **proves the
   detector first** by visiting an unknown route and asserting it is detected. Without that
   probe the "all 70 destinations resolve" claim could not fail: reword one headline and every
   destination resolves unconditionally. `hasHeading` contributed nothing beside it, because
   `NotFoundPage` carries `#page-title` too.

   **F8 · CORRECTED.** Keys repointed through `RT.*` (the `verify-cls` fix, applied to the
   file one door down that did not get it), plus two key-level guards this gate lacked while
   defending the selector level: every `INTERACTIONS` key must name a measured route — a drift
   there meant *no ok, no skip, no line in the tally* — and no budget key may resolve to
   `"undefined"`, which is what a DELETED `R.*` constant produces. Both break-tested alone.

   **F9 · CORRECTED.** Grepped both files for every pre-restructure literal: **zero hits
   outside the banner text itself.** The banners asserted the opposite, which made them a
   standing sweep-exemption over two files with nothing to exempt — an invitation to add a
   hardcoded literal under their cover. Rewritten as forward-looking rules that state what is
   true today, and `verify-redirects`' copy-paste (naming itself as both exclusions, never
   naming `verify-ia.mjs`) is fixed.

   **F10 · CORRECTED.** Both counts. `routes.mjs:69` had the ROUTES count (13) copied onto the
   redirect map, which has never had 13 rows, and pointed at the wrong gate as its prover.

   **F11 · CORRECTED — and this is the transferable one.** After committing F2 I checked the
   COMMITTED tree rather than my memory of it, and found the same failure three lines away:
   `if (!Array.isArray(iaModule.IA)) R.skip('IA export is not an array or file does not
   exist')`, with every §7 assertion sitting in that branch's `else`. An `ia.ts` that imports
   cleanly but exports a malformed `IA` is the artifact under test being broken, not this
   environment being unable to check it — the identical distinction F2 turns on. It would
   have read **`21 passed · 1 skipped · 0 failed`, exit 0**. Now `R.ok(false, …)`.
   **The lesson is that this class RECURS LOCALLY**: an author who reaches for `skip` once in
   a file reaches for it again a few lines later, because the mistake is a habit of mind
   about what `skip` means, not a typo. So fixing an instance means sweeping its
   NEIGHBOURHOOD — the same file, the same section, the same author's other branches — and
   not just the reported line. A review that hands you N findings is telling you where to
   look, never how many there are.

   **A break-test correction, because it nearly proved nothing.** The first plant for F11 was
   invalid TypeScript, so `ia.ts` failed to import and the gate went red **via F2's catch
   path** rather than via the non-array branch I was trying to test. Red for the wrong
   reason. Re-planted as valid TS exporting `{ notAnArray: true }`, it reddened on the
   intended branch with the intended message. **A break test that reddens for the wrong
   reason is a break test that proved nothing** — and it is indistinguishable from a real one
   unless you read the failure text rather than the exit code.

   **DEFERRED — the meta-gate, not a finding but the remedy that came out of F1/F2.** A static
   vacuity screen over the whole suite (`verify-vacuity.mjs`) was written and break-tested
   during this round and then **pulled from this PR** on the operator's call: it is new
   verification tooling, so it carries the same standing gate-tooling flag that just caught F1
   and F2, and it gates the *gate suite* rather than the navigation work this prompt is scoped
   to. Held on branch `claude/verify-vacuity-screen`, no PR, no CI. Carried forward there, in
   its commit message: the narrow firing rule, the eight legitimate `ok(true …)` sites that
   must NOT fire, per-file helper-signature reading, and its first customer —
   `verify-resilience-dom.mjs:136`, a **pre-existing** `.catch(() => [])` that makes a thrown
   evaluate and a legitimately empty result indistinguishable, both skipping, on §A: the
   assertion that caught `POOL_ATTR_H`.

## 8 · LOOP FEEDBACK

**Prompt 07 is the v4 pilot. Four findings, and the roster signal is the first.**

**1 · `test-engineer` (Haiku) — the Sonnet-flip signal.** Four consecutive `STATUS: DONE`
reports on ONE file, `verify-ia.mjs`, which a single run exposed three distinct defects in,
each a different way of not checking something:
- a **false pass** — `includes('outlook')` matched `MoneroPage`'s pre-existing
  `case "outlook":` tab branch, reporting ✅ against a tree with zero hash handling;
- a **permanently-red assertion** — the SPA catch-all sought inside `redirects` when it lives
  in `rewrites`, and with a trailing-slash-wrong string, so it could never go green on a
  correct tree. That is the `verify-v510` failure mode: a gate that cannot pass teaches people
  to ignore the whole file;
- an assertion **mandating a defect** — §3's regex required `<Navigate to="literal">`, which
  cannot carry `location.search`, so the gate demanded the query-dropping form.
Each time, its self-audit came back clean — because it audited for **the shape I had named**
rather than the general question. When I asked "can a correct tree satisfy this?", it found
the problem immediately. **Gate authoring is precisely the domain where a wrong assertion is
indistinguishable from a right one until executed**, which is what makes this a tier signal
rather than a one-off.

**2 · `director-build` (Opus) — the ladder working, and NOT a tier signal.** It verified it
had no delegation tool (by attempting `SendMessage`, not by assuming), declined to implement
the whole build solo — which would have made "builder and reviewer must differ" unsatisfiable
by construction — and returned `BLOCKED` with four real findings, including the
`<Navigate>`-drops-the-query defect. **Its BLOCKED came from a DISPATCH bug of mine: I spawned
it as a plain subagent instead of a teammate. That is my error, not a tier limit.** Do not
conflate the two when reading this ledger.

**3 · A fallback that degraded the healthy path — and why the measurement ORDER caught it.**
`.nav-noscript` was added because 6 of 13 routes had no anchor with the bundle dead. It
shipped visible and was hidden on boot, costing **0.1778 CLS** on every route
(`verify-cls` attributed it exactly: Δy−161, "node removed"). It surfaced only because I
measured `verify-cls` **before** repointing its stale keys: five stale keys all read the same
~0.177 in both passes, and *identical numbers across different routes* is the signature of
several keys measuring one shared transition — while `/` degraded, which is NOT stale, also
read 0.1778 and had no such excuse. Repointing first would have merged both into one number
and hidden the regression inside the fix.

**4 · A prompt premise that did not survive contact — and my own wrong confirmation.**
`§4 CONSTRAINTS` listed `.claude/hooks/session-start.sh` under "do not touch: its route count
is derived, so it survives." It did not. `grep -c '^  "/'` matched the old array shape;
the new `export const R = { HOME: "/" }` has no such line, so it returned 0 **and** exited 1,
firing `|| echo 0` as well — every session printed `Environment ready: 0` / `0 static routes`.
**I checked this file early and reported it as surviving.** A do-not-touch premise is exactly
the kind that goes unverified, and my confirmation made it worse, not better. Two other
premises also failed measurement: the mockup's inventory (~20 fictional destinations) and its
"11 mempool views / 12 simulators" (really 6 and 21).

**5 · `git add -A` swept a concurrent agent's in-flight files into an unrelated commit —
three times, which makes it a pattern and not an accident.** `0a0d92d` (a CLS commit) took
the in-flight Requirement 9 files, so its message describes less than it contains.
`92657cd` (a handoff-documentation commit) took `app/test-nav-interactive.mjs`, a
design-reviewer scratch probe wired to neither npm nor CI, which does not belong in the PR
at all. The two needed different remedies and got them: the first is RECORDED in §7, because
the files belonged in the PR and only the message was wrong, and rewriting a pushed message
to look tidier is worse than an accurate note; the second was UNTRACKED with `git rm
--cached` — not deleted, because the agent was still running and still using the file.

The structural fix is a `.gitignore` rule covering `app/test-*.mjs` and `app/probe*.mjs`, so
a concurrent agent's scratch can no longer ride into a commit. Recorded here rather than
treated as tidying, because the failure is a property of the ORCHESTRATION, not of any
agent: a lead that commits while subagents are mid-write will keep doing this, and the only
reliable guard is that scratch paths are ignored by default. Staging by explicit path is the
discipline; the ignore rule is what survives forgetting it.

**6 · Two different Haiku roles, on two different kinds of work, both reported confidently
on things they had not executed. This is a PATTERN, not a second anecdote.**

`test-engineer` asserted gate correctness it had never run — four `STATUS: DONE` reports on
`verify-ia.mjs` while it carried a false pass, a permanently-red assertion and an assertion
that mandated a defect. `design-reviewer` returned `APPROVE` on the nav restructure while
asserting source facts it had not read and a CI result it had no access to.

The shared property is what makes it dangerous: **the output is indistinguishable from a
correct one until somebody checks the thing itself.** A confident summary reads the same
whether or not it was earned, and both of these would have been accepted by a reader who
did not independently execute the claim.

They divide into two sub-species that need different remedies:

- **STALE READ** — quoting a source comment that no longer matches the code. The reviewer
  reported that `ia.ts` still carries Home as the Live section's first leaf, and that
  clicking "Live" therefore navigates to `/`. Both describe a bug fixed in `145de0d`; it had
  read `CommandPalette.tsx`'s workaround comment, which still narrates the old shape, rather
  than `ia.ts` itself. Verified: `Home as IA leaf: false`, `Live click target:
  /live/mempool`. Remedy is mechanical — require the assertion to cite the file it is about,
  and delete workaround comments once the workaround is gone, because a stale comment is an
  active trap for the next reader, human or agent.
- **FABRICATED READ** — asserting a conclusion it had no access to. "All 47 gates in CI
  pass": wrong twice, since 47 is the PRE-PR count (`verify:static` is 19 and `verify:e2e`
  25 now) and CI had never concluded on this branch at all. **This is the worse species.** A
  stale read is at least anchored to something that was once true; a fabricated one is
  anchored to nothing, and there is no version of the tree in which it was correct.

What kept both from landing: the claims were checkable in seconds and got checked. What
would have made them land: accepting a verdict because it was confident and favourable. The
correct handling of the design review was to KEEP its executed parts — keyboard journey,
390px, reduced motion, degraded states, three real gate runs — and reject only the stale and
fabricated ones. Binning a partially-wrong review whole discards real evidence; accepting it
whole imports fiction. Neither is cheaper than reading it.

**7 · BREAK-TESTING AT FILE LEVEL PROVES THE FILE CAN GO RED. IT SAYS NOTHING ABOUT ANY
INDIVIDUAL ASSERTION INSIDE IT.** This is the most transferable thing in this handoff, and it
is a property of how this repo has validated every gate it owns, not of one careless session.

CLAUDE.md's practice — break a gate, watch it go red, restore, re-run on a clean tree — was
followed here. `verify-ia.mjs` was break-tested and went red. It also shipped two assertions
that could not go red under any tree: `R.ok(X || true, …)`, and a `catch` turning a whole
section into `R.skip`. Both are invisible to a file-level break test **by construction**: the
file goes red on some *other* assertion, and the dead one is never the thing being observed.
396 `R.ok` calls across the suite have been validated this way and no other.

Worse, F2's failure mode is the one this repo has already written three separate warnings
about — `verify-reporter.mjs:38` exists *because* of it — and it still landed, in the same
session that was systematically removing it from other files. Knowing a failure class does not
protect you from it; only a mechanism does.

**Two remedies, and the split between them is the finding.**
- *Static screen* (`verify-vacuity.mjs`, held off this PR on branch
  `claude/verify-vacuity-screen`) catches the two MECHANICAL shapes cheaply and forever. It is
  deliberately narrow: a first draft that also failed on bare `ok(true, …)` matched eight
  sites and **all eight were correct** — `ok(true, …)` after a throwing `waitFor` is a real
  idiom here and the control flow is the condition. Failing them would have taught people to
  ignore red, which is `verify-v510`'s exact death and would be a bleak way to reintroduce the
  failure the screen exists to prevent.
- *Per-assertion break-testing* carries everything the screen cannot, and that is most of it.
  Applied from v6.1.6 on to NEW assertions only; existing ones are grandfathered, because
  re-break-testing 396 by hand is not something anyone finishes and a remedy nobody completes
  is worse than a narrow one that runs. **This round: 16 new or changed assertions, 16
  break-tested individually.**

**THE CLASS RECURS LOCALLY, so fixing an instance means sweeping its NEIGHBOURHOOD.** The
eleventh finding is not `director-quality`'s — it is mine, found by checking the COMMITTED
tree to confirm F2 was really gone rather than trusting my memory of the edit. Three lines
from F2 sat `if (!Array.isArray(iaModule.IA)) R.skip(…)`, with every §7 assertion in that
branch's `else`: the identical mistake, in the identical file, about the identical
distinction. It would have read `21 passed · 1 skipped · 0 failed`, exit 0.

That is not coincidence and it is the reason to record it. Reaching for `skip` where `ok(false)`
belongs is a habit of mind about what `skip` MEANS, not a typo — so an author who does it once
in a file does it again a few lines later. **A review that hands you N findings is telling you
where to look, never how many there are.** After fixing any instance of a class, re-read the
same file, the same section, and the same author's other branches, and do it against the
committed tree rather than the diff you remember writing.

**A break test that reddens for the WRONG REASON proved nothing, and looks identical to one
that worked.** F11's first plant was invalid TypeScript. `ia.ts` failed to import, so the gate
went red — but through F2's catch path, not the non-array branch under test. Exit code 1
either way. Only the failure TEXT distinguished them (`import failed: Expected ':'` versus
`exports IA as object`). Re-planted as valid TS exporting `{ notAnArray: true }`, it reddened
on the intended branch. Read the message, never the exit code: a break test is an experiment
with a predicted result, and "it went red" is not the prediction.

**And write the break test to a DIFFERENT shape than the bug.** The screen's constant-operand
list was `|| true` / `&& false` — F1's shape exactly. Break-testing it with `R.ok(true ||
false, …)` came back GREEN: `true || X` is every bit as constant, and I had encoded the one
example I had rather than the property. Caught only because the plant differed from the
original. A break test that reproduces the bug you already know confirms you fixed that bug;
it does not tell you whether you fixed the class.

**Cross-cutting: my own briefs were the limiting factor at least three times.** The sweep
pattern I handed every agent (`['"]/(mempool|…)`) structurally could not see a REGEX literal
(`waitForURL(/\/simulate/)`, which killed the e2e chain for 30s) and I explicitly told the
sweep agent *not to change selectors*, leaving 7 dead `nav.topnav` clicks in `verify-motion`.
Both agents followed the instruction correctly; the instruction was incomplete. `PREFLIGHT`
paid for itself twice — two agents independently planned `npx vitest run` against a repo with
no test runner, which would have failed on every file before touching anything.

**Questions asked / assumptions surfaced:** `director-build` 4 findings · `phase1`
DONE-WITH-ASSUMPTIONS (5, including the `/` IA-leaf prose/code mismatch it flagged and I
initially deferred — the deferral is what produced the "Live→Home" bug) · `navui` 6 · `palette`
7 · `crumbs` 5 · `spec9` 4 · `sweep` 1 wrong attribution, caught. Gate convergence: no round
exceeded 2 fix passes; no `NOT CONVERGING`; no `OUT-OF-DEPTH` returned by any agent.
