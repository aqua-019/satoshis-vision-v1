---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260801-04
branch: claude/motion-transition-foundation-4452ip
status: done               # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — v6.1.3 Motion & transition foundation

## 1 · GOAL

The site has a motion vocabulary: four duration tokens and four easings declared once,
consumed everywhere, and zeroed as a set under `prefers-reduced-motion`. Route changes morph
rather than cut where the browser supports it and fall through to today's behaviour where it
does not. Back-navigation restores the scroll offset you left, focus lands in the new page's
main region, and a screen reader is told the route changed. Animation is confined to
`transform` and `opacity` on the two directories where a layout-property animation is most
expensive, gated so it stays that way. Underneath, two carried defects close: `design/` no
longer calls `Math.random()`, and the acyclicity assertion that three files claim exists is
actually written.

Before this: 37 `transition:` declarations and 59+ timing literals with two cubic-beziers
between them, hard cuts on every navigation, no scroll restoration, no route announcement,
no focus move, and a standing rule (`Math.random()` only inside `app/src/protocols/`) that
was false site-wide.

## 2 · CONTEXT

- Prompt 04 of 19 (v6.1.3), D2000 blocks A (D0651–0700) and B (D0701–0750).
  Prompts 01–03 shipped: layers + `@property` roles + three themes (PR #148).
- Must land **before prompt 07**, which restructures the nav. Doing that restructure
  without View Transitions means touching every route twice.
- Plan of record: the approved plan for this task, including the two-point sweep staging
  and the decision to keep `React.lazy`.

### Premises in the prompt that did not survive contact with the repo

The prompt says not to trust its own counts. **Six failed.**

| Prompt claim | Reality |
|---|---|
| "`verify:e2e` (9)" | **12** (`app/package.json:15`) |
| "~43 gates, only about half wired" | 43 gates + `verify-lib.mjs`; **30 wired** (27 CI + 3 npm-only), 13 orphaned |
| "the 12 simulators in `app/src/protocols/`" | **21 registered views** across 16 `.tsx` (`views/protocols.tsx:38-59`) |
| "18 surfaces" for the reduced-motion audit | **27** (21 simulators + 6 mempool views) |
| "13 `Math.random()` call sites" | 13 *lines*, **15 calls**; 3 of those lines (`:237-239`) are the per-frame stream respawn path, not `seed()` |
| "`classic.tsx:411` and `:460`" | Stale by +6 — real lines **417** and **466**. The behaviour claim is correct. |

True as stated: `verify:static` (11), nine gates named in `ci.yml`, `react-router-dom ^6.26`
(lockfile resolves 6.30.4), and the prompt's own self-correction that `PageShell` is *not*
already a persistent shell.

### Findings the prompt could not have known

1. **`react-router` is on the JSX `<Routes>` API, not `createBrowserRouter`** — so
   `<ScrollRestoration>` and the router's view-transition support are unavailable at *any*
   version. Hand-rolling is forced, not merely preferred.
2. **Three of the surfaces the prompt asks to URL-sync do not exist**: a Markets "brush"
   (`chart-kit.tsx:48` is a transient hover crosshair), a Network "metric selection"
   (`NetworkPage` renders all charts unconditionally), and a command palette
   (`terminal.tsx:368`'s ⌘K is a decorative legend).
3. **`mempool/useMemCanvas.ts` (327 lines) has zero consumers** and there is no `<canvas>`
   in `app/src/mempool/`. Staged infrastructure; not touched.
4. **Six of the 21 simulators are visited by no gate at all** — `verify-lib.mjs:54-56` walks
   15 `?p=` ids, omitting `seraphis`, `jamtis`, `carrot`, `cuprate`, `stressnet`, `ospead`.
   `carrot.tsx` is one of the five bar fills this task rewrites, so that rewrite would have
   been unobserved. Added to `ROUTES`.
5. **`verify-shots.mjs:59-72`'s recorded diagnosis is wrong.** It blames ParticleField's
   `Math.random()` for the 1440 byte instability, but `verify-shots.mjs:73` calls
   `page.emulateMedia({reducedMotion:'reduce'})`, `deviceTier.ts:121` demotes to `low` under
   reduced motion, and `ArtBackground.tsx:40` does not mount ParticleField on `low`.
   `git blame`: the `emulateMedia` call landed in `bd8d5c2` (v6.0.10), the comment in
   `0344b3d` (prompt 03) — the emulation was already there when the diff was attributed.
   See §7 for what the cause actually turned out to be.

## 3 · SCOPE

IN: duration/easing tokens + migration · reduced-motion contract across 27 surfaces ·
GPU-only property discipline + gate · seeded PRNG in `design/` · the acyclicity gate ·
View Transitions (route, theme, one shared-element pair) · scroll restoration · focus
handoff + route announcement · `useUrlState` · frame-budget governor · `@starting-style`.

OUT (non-goals, each stated in the PR as a decision rather than an omission):
- **D0721 persistent layout shell** → prompt 07. The shell is per-page; hoisting it means
  converting all 13 pages and moving shell props into a route table, which is 07's job.
- **D0723 speculation rules / D0724 hover prefetch** → prompt 07, with the route table.
- **Mempool tile → view morph** — dropped on merit; see §7.
- `useMemCanvas.ts`, the 13 orphaned gates, and the four-copy route list.

## 4 · CONSTRAINTS

- CSP `connect-src 'self'`; no third-party browser requests, ever; fonts self-hosted.
- `Math.random()` only inside `app/src/protocols/`. This task makes that true again.
- `api/` is CommonJS and is not touched.
- Every route keeps its `noscript` block and literal background floor; usable at 390px;
  no text under 12px; every animation ships a reduced-motion path that loses no information.
- No new runtime dependencies.
- New CSS must sit inside a `@layer` block — `verify-legibility.mjs` fails otherwise.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0
- [x] `npm run verify:static` passes
- [x] `npm run verify:e2e` passes
- [x] `grep -rn "Math.random" app/src --include=*.tsx --include=*.ts` returns hits only under `app/src/protocols/`
- [x] The PRNG determinism + distribution gate exists, runs in CI, and passes
- [x] PRNG-only checkpoint sweep is byte-identical to `origin/main` (classic)
- [~] Full-branch sweep: every diff enumerated by route with a cause — **the `unexplained` bucket is NOT empty**: `/monero/markets` @1440 is reproducible, sub-perceptual (every delta exactly ±1 channel on background), and its cause is unproven. Recorded as unproven rather than given a plausible story; see §7.2
- [x] `verify-shots.mjs` reports compared / no-baseline / **skipped-by-filter** as separate numbers
- [x] The acyclicity assertion exists, runs, is named correctly by `verify-legibility.mjs`, and goes red when a role is deliberately cycled
- [x] Zero ad-hoc durations left in `app/src` (each remaining literal justified in a comment)
- [x] All 27 surfaces enumerated below with three separate counts
- [x] CI grep for layout-property animation returns zero hits under `mempool/` and `protocols/`
- [x] Route changes morph in Chromium and cut cleanly without View Transition support
- [x] Back-navigation restores scroll on `/mempool` and `/simulate`
- [x] `/mempool?v=terminal` deep-links; `grep -rn 'HashRouter' app/src` returns nothing
- [x] Focus lands in the new view's main region; the route is announced
- [x] Theme toggle crossfades, and swaps instantly under reduced motion
- [x] design-reviewer returned APPROVE
- [x] Branch pushed · PR opened (ready, not draft) · `mergeable_state: clean` · CI green

## 6 · VERIFY COMMANDS

```
cd app
npm ci
npm run typecheck
npm run build
npm run verify:static
npx playwright install --with-deps chromium
node scripts/serve-dist.mjs &
npm run wait-preview
npm run verify:e2e
node verify-roles.mjs
node verify-motion.mjs
node verify-prng.mjs
node verify-shots.mjs --theme classic --baseline <baseline-tree>
```

## 7 · REPORT — filled on exit

status: done

pr: https://github.com/aqua-019/satoshis-vision-v1/pull/150 (ready, not draft)

commits (6, on top of `2ca475c`, the merge of PR #149):
  d5f99e0  fix(view-tags): 175,397px document at 390px, and a scanner that ran under reduce
  84774ed  feat(motion): D0673 — transform-only bar fills, and the gate that was missing
  eb08e28  wip(motion): navigation semantics + discrete transitions — NOT verified, two gates red
  5e58ef5  feat(motion): frame-budget governor, micro-delay, and the paused-until-visible gate
  e8aa610  feat(motion): navigation semantics, discrete transitions, and a JS-off fix for 2 routes
  978e53d  fix(motion): close the 5 reduced-motion defects, and gate the 27-surface contract

deps added: none. No runtime dependency, and nothing in `api/` changed, so the CommonJS
  boundary is untouched.

deviations from spec:
  · **D0721 persistent shell, D0723 speculation rules, D0724 hover prefetch are DEFERRED to
    prompt 07**, on the record rather than omitted. The shell is per-page (`PageShell` →
    `AppShell`, below `<Routes>`); hoisting it means converting 13 pages and moving per-page
    `width`/`rail`/`bg` into a route table, which is prompt 07's job. View Transitions
    cross-fade correctly without it.
  · **The mempool tile → view shared-element morph was dropped**, flagged not skipped. The
    tile is ~200×46px and `sediment` is 2279×2495, so the morph is a 12× scale that fights
    `FitView`'s own inline `transform` and `transition: transform .25s`
    (`styles.css:862`) plus the zoom reset at `MempoolPage.tsx:54-55`. A label chip is not
    the thing it labels. The Future card `<h3>` → `ProtoPopup` `<h2>` morph shipped.
  · **Three features the prompt asked to URL-sync do not exist** and were not invented: a
    Markets "brush" (there is only a transient hover crosshair, `chart-kit.tsx:48`), a
    Network metric selection (`NetworkPage` renders every chart unconditionally), and a
    command palette (the ⌘K in `terminal.tsx:368` is a decorative legend).
  · `React.lazy` was **kept**, not replaced — see §2's model and the CLAUDE.md note.

notes for ARCHITECTURE.md patch: the `Concern → where it lives` table gains
  `Motion tokens → styles.css @layer base :root (--d-*, --e-*)`,
  `View transitions → design/viewTransition.ts (sole branch point)` and
  `Route chrome (scroll/focus/announce) → routes/useRouteChrome.ts + routes/RouteAnnouncer.tsx`.

open questions:
  · Real assistive-technology behaviour is unverified — there is none in this sandbox. The
    gate proves the DOM contract (a persistent polite/atomic `role="status"` region outside
    the routed subtree, empty on first render, naming the route after a nav; focus landing
    on a labelled `<main>`). Whether NVDA/VoiceOver/Orca voice it, and whether the region
    and the focus move read as complementary rather than duplicated, needs a human.
  · Everything requiring egress is unverified: no route to Monero nodes, CoinGecko, or
    xmr.irish. Every gate here runs against skeleton/degraded data.
  · `verify-shots.mjs` navigates with `waitUntil: 'networkidle'` against a 3s FAST polling
    tier — the anti-pattern every other gate carries a comment about. See §7.4.

### 7.1 · Reduced-motion audit — 27 surfaces

**Counts (never merged): already compliant 19 · fixed 3 · not applicable 5.** (19+3+5 = 27.)
5 of the 19 "already compliant" rows carried a motion defect — animation that keeps running
under reduce despite losing no information. Those are a SEPARATE axis from the three counts
and are deliberately not folded into them: "already compliant" answers *does the surface
still say what it means when frozen*, which was true of all five before any fix. The counts
would have been the same had the defects never been found, and blurring the two is how a
count stops meaning anything. All five are now closed (see "Defects found, and closed"), and
`verify-reduce.mjs` gates the whole 27 against their return.

Method: every row was read in source; every one of the 21 `/simulate?p=` ids and all 6
`/mempool?v=` ids was then driven headless (Chromium via `verify-lib.mjs`'s `launch()`,
two contexts — `reducedMotion:'reduce'` vs `'no-preference'`) and checked for (a) residual
`document.getAnimations()`/SMIL `<animate>` activity under reduce, and (b) for the six rows
where a frozen value could plausibly be *wrong* rather than merely *absent*, the actual
rendered text. "Verified by" below: **R** = source read only, confirmed no ambiguity;
**R+A** = read + runtime animation census (confirms nothing keeps moving, or catches a
defect that does); **R+C** = read + runtime content check (confirms the frozen numbers/text
themselves, not just motion state).

| Surface | Kind | Conveys | Static equivalent when frozen | Verdict | Verified by |
|---|---|---|---|---|---|
| decoy | SVG sim | Sampling-density wave (gamma/log-age); which of 16 ring members is the true spender | Axis labels, day ticks, "↓ TRUE SPENDER" marker and buoy `#NN` labels are unconditional SVG text; buoy y-position is set by `yWave`, not by the tick-driven `bob` (a 3px decorative wobble). `useTick(60)` self-freezes to 0. | already compliant | R+A |
| dandelion | SVG sim | Stem→fluff propagation; per-hop obscurity growth; embargo timer | Stat grid (STEM PROB 0.90, FLUFF PROB 0.10, EMBARGO 39s, OBSCURITY ∞) and the "STEM PHASE"/"FLUFF PHASE" headers render unconditionally; panel's 5-step lifecycle is prose. Frozen tick=0 lands at hop 0 (origin only, before the fluff burst) — an incomplete diagram but not a false one. | already compliant *(motion defect found AND closed — see below)* | R+A / R+C |
| viewtags | SVG sim | 256× wallet-scan speedup from a 1-byte view-tag prefilter | `ScannerWall`'s `frozen` prop parks BOTH scanners at the COMPLETED scan (256/256) instead of `t=0`, so the Stat grid reads the real 256 ms vs 4 ms rather than both panes reporting "1 ms" (the fix this session; see §2 model). | fixed | R+C |
| ringct | SVG sim | 5-station confidential-tx assembly line; final tx byte layout | Every station's formula/label renders unconditionally regardless of phase; the "FINAL TX RECORD" `<pre>` block and Stat grid are static text. Frozen tick=0 shows station 1 active/none done — an accurate snapshot of the line's start, not a false one. | already compliant *(motion defect found AND closed — see below)* | R+A |
| stealth | SVG sim | Diffie-Hellman derivation landing both parties on the same secret | `phase = reduced ? 4 : …` freezes at the COMPLETED derivation (✓ SAME SECRET, green ≡) instead of phase 0's "computing…" — same fix pattern as viewtags, documented in-file. | fixed | R+C |
| fcmp | SVG sim | Anonymity set growing from ring-16 to the full 150M+ output set | `t = reduced ? 1 : animT` freezes the murmuration at the LANDED state; Before/After panels are static text (16 vs 150,824,007) in every motion state, and freezing at t=1 also renders the swarm itself instead of an empty stage. | fixed | R+C |
| seraphis | SVG, click-driven | Grootle vs FCMP++ membership-proof backend swap | No autoplay/tick motion exists — `backend`/`tier` are click-set `useState`; nothing to freeze. | not applicable | R+A |
| jamtis | SVG, click-driven | Address-encoding mutation demo (75 vs 95 chars) | Click-driven `useState` only; no ambient animation. | not applicable | R+A |
| carrot | SVG, click-driven | Incoming-only disclosure toggle | Two `transition:` bars ride `var(--d-4)`, zeroed globally under reduce by the sitewide token rule — no autoplay motion of its own. | not applicable | R+A |
| cuprate | Canvas sim | Two independent implementations (monerod/Cuprate) cross-checking block hashes; a divergence being caught | `useProtoCanvas` paints ONE static frame at a fixed representative tip (both engines already agreeing); "inject divergence"/"reset" buttons force an immediate repaint via a `canvasKey` remount, so the demo stays fully interactive with nothing moving. | already compliant | R+A |
| stressnet | SVG, slider-driven | Block-weight penalty / fee multiplier vs network load | Slider-set `useState` (`intensity`); no autoplay animation. | not applicable | R+A |
| ospead | SVG, toggle-driven | Decoy-sampling attack success rate, with/without refit | Toggle-set `useState` (`refit`); no autoplay animation. | not applicable | R+A |
| hearth | SVG sim (metaphors) | Subsidy taper to a permanent 0.6 XMR tail emission | Stat grid is static; frozen at the non-zero constant `tick=80` (year≈20.6) shows a representative mid-transition flame with both reward-composition bars at real percentages; particles unmount (`!reduce &&`). | already compliant | R+A |
| metronome | SVG sim (metaphors) | 120s block-time target held constant vs BTC/ETH/SOL | Stat grid + "CADENCE COMPARISON" bars are tick-independent; frozen at `tick=25` shows the arm mid-swing (not resting dead-center) — a representative "this moves" frame. | already compliant | R+A |
| silo | SVG sim (metaphors) | BTC hard cap vs XMR asymptotic/tail supply curve | Frozen at `tick=100` (year=50, past the year-8 crossover) so the caption correctly reads "XMR tail = constant" — the lesson — not "both faucets pouring." | already compliant | R+A |
| thermostat | SVG sim (metaphors) | Difficulty tracking hashrate to hold block time constant | Frozen at `tick=0` puts every `sin()` term at 0, landing all three dials at their range MIDPOINT — a genuinely representative steady-state reading, not a degenerate one; dial values read from live `data.hashrate`/`data.difficulty`, not tick. | already compliant | R+A |
| lighthouse | SVG sim | Constant beam-sweep cadence regardless of hashrate/difficulty | Beam length/opacity/lamp size are driven by live `data.hashrate`/`data.difficulty`, not tick; only the sweep angle is tick-driven and purely decorative — the constant-cadence claim is stated in prose/Stat ("SWEEP 120s/rev held constant") in every motion state. | already compliant | R+A |
| auction | SVG sim (metaphors) | Per-block fee auction; top ~80 paddles seated | Frozen at `tick=0` shows a fresh 100%-remaining window; every paddle's fee figure comes from live mempool data, not tick. Stat grid is static. | already compliant | R+A |
| skyline | SVG sim (metaphors) | Mining-pool "skyline"; HHI concentration index | Building heights, HHI value and labels come from the static `POOLS` table, not tick; only window-sparkle and star parallax are tick-driven decoration, and particles unmount under reduce. | already compliant | R+A |
| bloodhound | SVG sim (metaphors) | 6 privacy primitives, each defeating one tracing dimension | Frozen at the non-zero constant `tick=200` → stage=5: 5 of 6 stations render label + "defeat" caption. The 6th (FCMP++) shows only its label at that exact frame (the animation's own modulo cycle never marks it "passed"), but its defeat text ("hides everything in a sea of 150M+ outputs") is ordinary panel prose regardless, and the closing SVG caption is unconditional. | already compliant | R+C |
| balance | SVG sim (metaphors) | Pedersen-commitment balance, verifiable without revealing amounts | "Σ inputs = Σ outputs + fee", "verifiable by anyone", and "✓ commitment balance verified" are tick-independent text; only the beam's tilt and particles (unmounted under reduce) are motion. | already compliant | R+A |
| reactor (mempool) | Mixed DOM/SVG | Mempool as hex-density lattice; 16-decoy ring-signature fan; confirmation-track progress | `MemViewShell`'s `table` slot (CSS-forced visible under reduce, `styles.css:1091-92`) lists the same real txs as rows; block heights/CONF counts are static per-block text. | already compliant *(motion defect found AND closed — see below)* | R+A |
| bridge (mempool) | Mixed DOM/SVG | 12-pane mission-control telemetry: gauges, block-cadence countdown | `BrgGauge`'s rAF loop stops and snaps straight to the target value under reduce; the block-cadence ring is a genuine elapsed-time clock (`useTick(…,{motion:false})`) deliberately exempt from freezing ("a countdown that freezes is a clock that lies"), with its own dash-offset transition set `reduced ? "none" : …`. `table` slot present. | already compliant | R+A |
| sediment (mempool) | Mixed DOM/SVG | Mempool as a vertical core-sample tube; ring-fan; tracked-tx highlight | `table` slot gives the same real txs as rows under reduce. | already compliant *(motion defect found AND closed — see below)* | R+A |
| constellation (mempool) | Mixed DOM/SVG | Mempool as a luminous network sphere; fee-tier distribution; bytes-by-tier donut | `table` slot; fee-tier bars' `transition: reduced ? "none" : …` (fixed this session, see §2 findings); sphere-node pulses are `{!reduced ? <animate/> : null}`-gated. | already compliant | R+A |
| terminal (mempool) | DOM (CLI-style) | Live tail of mempool events + daemon panel | `table` slot; this view's own dense telemetry (`stats={false}`) stays mounted in the body regardless of reduce. | already compliant *(motion defect found AND closed — see below)* | R+A |
| classic (mempool) | DOM, reflow | Explorer-style tx/block inspectors; fee-tier segmented bar; block ribbon | `reflow:true` (no fixed canvas — reflows natively) plus the `table` slot; every transform/transition in the file is `reduceMotion`-gated (fee bar, hover lift, entering-row class). `verify-glide.mjs` scenario 4 asserts the block ribbon still renders under reduce. | already compliant | R+A |

**Defects found, and closed.** All are "motion never stops," not "information lost," so
none flips a verdict above — but all violate CLAUDE.md's "every animation ships a
`prefers-reduced-motion` path," and every one predates this change. Each is now gated, and
`verify-reduce.mjs` (new, wired into `verify:e2e`) asserts zero running animations and zero
SMIL elements across all 27 surfaces so they cannot come back. It was break-tested by
reverting one CSS fix and one SMIL fix: red on exactly those two surfaces, green on the
other 25. The census on the final tree reads **0 of 27 surfaces still animate under
reduce**, with a control section proving those zeroes were measured against a live page:

1. **`app/src/mempool/reactor.tsx`** never imports `useReducedMotion`. Three ambient
   animations run unconditionally under reduce, confirmed at runtime (1 CSS animation + 2
   SMIL `<animate>` elements still `running`/present): the confirmation-track glow
   (`animation: "flow 6s linear infinite"`, ~line 384), `RingSigFan`'s ring-pulse and
   real-node opacity pulse (`<animate>` at ~lines 225, 244), and the hex-cell `hexpulse`
   gated only on `intensity > 0.75` (~lines 89-91), not on `reduced`.
2. **`app/src/mempool/sediment.tsx`** imports `useReducedMotion` and correctly gates
   `sed-track-pulse` (line 135), but leaves `sed-stream` (line 105), `sed-bob` (lines 127,
   162) and a ring-fan `<animate>` pair (lines 265, 275) ungated — confirmed at runtime (13
   CSS animations + 2 SMIL `<animate>` elements running under reduce). Inconsistent
   application within one file, not a missing import.
3. **`app/src/mempool/terminal.tsx`** never imports `useReducedMotion`. The cursor blink
   `term-blink` (lines 98, 339) and the "newest entry" highlight `term-flash` (line 143)
   use literal durations with no gate — confirmed 2 running CSS animations under reduce.
   (`term-slidein`/`term-logslide` are fine: they ride `var(--d-3)`, zeroed globally.)
   **A sixth defect in the same file, which the animation census could not see at all**:
   `TermPalette`'s typewriter is a `setTimeout` chain, not a CSS animation or a SMIL
   element, so it appears in neither `getAnimations()` nor a `querySelectorAll('animate')`.
   It was typing and erasing forever under reduce. Gating it needed the freeze-point care
   view-tags established rather than a plain `if (reduced) return`: the natural still frame
   is `typed=""`, `phase="typing"`, which renders an empty prompt over "querying daemon…" —
   a terminal that never answers. The reduce path parks on the full command echoed plus its
   real daemon rows. Worth carrying forward: an animation census is a floor, not a ceiling,
   and JS-driven motion is invisible to it.
4. **`app/src/protocols/ringct.tsx`** — the CLSAG station's wax-seal ring sets
   `animation: "spin 14s linear infinite"` inline (~line 134), unconditional. The file's own
   comment invokes the sitewide "ambient spin" exemption (`.spin-slow`/`.spin-med`, gated
   `!important` in `styles-ambient.css:328`), but this usage is inline rather than through
   either class, so it never reaches that gate — confirmed 1 CSS animation running under
   reduce.
5. **`app/src/protocols/dandelion.tsx`** — the "pulse ring on current hop" `<animate>` pair
   (~lines 114-117) is gated only by `isCurrent` (derived from tick/hop, not from
   `reduced`); at the frozen (hop-0) frame it fires on the origin node — confirmed 2 SMIL
   `<animate>` elements present under reduce.

### 7.2 · Sweep results

#### Point 1 — PRNG-only checkpoint (`54aa9db` vs `origin/main`, `--theme classic`)

**Byte-identical across all 129 compared shots** (43 routes × 3 widths). This is the number
that discharges Part 0a's visual-neutrality claim for the seeding change, and it is clean
for a reason worth stating rather than celebrating: `verify-shots.mjs:73` emulates
`prefers-reduced-motion: reduce`, `deviceTier.ts:121` demotes to `low` under it, and
`ArtBackground.tsx:40` renders `null` instead of `<ParticleField>` on `low` — so **no sweep
at any width can see the particle field at all.** What point 1 actually proves is that
nothing ELSE moved in that commit. The field itself was checked by eye in a real browser at
`?tier=high`, and its distribution is gated offline by `verify-prng.mjs`. Three separate
numbers, and the recorded diagnosis this replaces (prompt 03's "the field is why 1440 is
unstable") was wrong — see §7.4.

#### Point 2 — full branch (`978e53d` vs `origin/main`, `--theme classic`)

**Prediction, written before the run** (a prediction that misses is itself a finding):

| Route | Widths | Cause |
|---|---|---|
| `/mempool` | 3 | D0673 — `classic.tsx`'s two fee bars are `translateX+scaleX` now, not `width` |
| `/no-such-route` | 1 | `NotFoundPage`'s heading div became an `<h1>`; `margin: 0` should make this zero-pixel, so a diff at one width and not three is itself worth explaining |
| `/simulate?p=fcmp` | 3 | reduce now freezes at `t=1` (full swarm, 150,824,007) instead of `t=0` |
| `/simulate?p=stealth` | 3 | reduce now freezes at phase 4 (✓ SAME SECRET) instead of phase 0 |
| `/simulate?p=ringct` | 3 | the inline `spin 14s` and the sealing `<animate>` are gone under reduce — this route's shot becomes deterministic where it was previously captured at whatever phase the loop happened to be in |
| `/simulate?p=dandelion` | 3 | the current-hop pulse ring no longer renders under reduce |

Predicted total: **16 differing shots across 6 routes.** Anything else is unexplained and is
the finding.

**Amendment, written before the run and after re-deriving from the diff rather than from
memory — and the reason for it is the first finding of this sweep.** The table above was
anchored to the *previous* sweep's result set and extended with what changed since. That is
the wrong derivation: `origin/main` moved to `2ca475c` when PR #149 merged, so the baseline
is the merge commit and the diff set is everything in the six commits *after* it — not
"last time's diffs plus today's". Anchoring a prediction to a prior run rather than to the
actual baseline is exactly how an expected-diff list quietly stops matching the change it
claims to describe. Four routes were missing:

| Route | Widths | Cause |
|---|---|---|
| `/simulate?p=viewtags` | 3 | `d5f99e0` — `ScannerWall` produced a **175,397px document at 390px**, and its `frozen` prop now parks both scanners at the completed 256/256 scan instead of `t=0`. The largest single diff in this set, and at 390 the baseline shot is of a broken page. |
| `/simulate?p=carrot` | 0–3 | `84774ed` rewrote its two bar fills to `translateX+scaleX`. The values are hardcoded 25%/100% constants, so the geometry should reproduce exactly; a 1–2px antialiasing delta between a scaled box and a width-set box is the plausible miss. |
| `/peers` | 0–3 | `.v6-stagger` wrappers (D0661). The wrapper is `display: grid` and becomes the grid item, so the card should stretch inside it unchanged — but this is a real layout insertion and predicting zero is a claim, not a certainty. |
| `/future` | 0–3 | Same `.v6-stagger` wrap, plus `V6Modal`'s `@starting-style`/`allow-discrete` exit frame. Closed state should be identical. |

Revised prediction: **19–28 differing shots across 8–10 routes.** The band is deliberate —
`carrot`, `/peers` and `/future` are predicted-zero-but-not-certain, and stating a single
number I do not believe would be worse than stating the uncertainty. `/mempool` at 3 and
`/no-such-route` at 1 stay as first written.

Deliberately NOT predicted, because the sweep cannot see them: the reactor / sediment /
terminal reduced-motion fixes. `verify-lib.mjs`'s `ROUTES` carries `/mempool` once, at its
default `?v=classic`; the other five mempool views are never swept. That is a real coverage
hole in the shot matrix and it is why `verify-reduce.mjs` drives `?v=` explicitly.

**Result** — `978e53d` vs a freshly built `origin/main` (`2ca475c`) worktree, both captured
with the branch's own `verify-shots.mjs` so only the served build differs. 129 compared ·
0 without a baseline · 258 of 387 full-matrix shots skipped by `--theme classic` and
reported as skipped, not silently dropped.

**Non-`/simulate` diffs: 5 shots.**

| Route · width | Bucket | Cause |
|---|---|---|
| `/mempool` @390, @768, @1440 | bar fill rewritten | D0673 — `classic.tsx`'s two fee bars are `translateX+scaleX`. Predicted, exact. |
| `/no-such-route` @390 | heading added | `NotFoundPage`'s `<div class="serif">` → `<h1 style="margin:0">`. Predicted at one width, exact — 768 and 1440 are byte-identical, so `margin: 0` did hold. |
| `/monero/markets` @1440 | **unexplained** | See below. Not predicted. |

**`/simulate` diffs: 29 shots**, of which the ones this change *caused* are `viewtags`,
`stealth`, `fcmp` and `dandelion` (all ×3) — every one predicted. The rest are the noise
floor.

**Prediction scorecard.** Hit: `/mempool` ×3, `/no-such-route` ×1, `viewtags`, `stealth`,
`fcmp`, `dandelion`. Correctly predicted-zero: `carrot`, `/peers`, `/future` — all
byte-identical. **Missed in the other direction: `ringct`**, predicted ×3, actually
byte-identical — and the reason is finding 1 in §7.4: `freezeAmbient()` kills every CSS
animation before the shutter opens, so the removal of an inline `spin 14s` is invisible to
this instrument. A live probe on the two builds confirms the change is real (baseline
`spin` running at `matrix(0.427, 0.904, …)`; branch `animation-name: none`). The sweep did
not disagree with the fix — it could not see it.

**`/monero/markets` @1440 — CAUSE UNPROVEN. The bucket is left non-empty deliberately.**

What is established:
- **Reproducible, not noise.** Baseline 309,511 B on two independent full sweeps; branch
  309,534 B on two. Four runs, two stable values.
- **Order-dependent.** Sweep either tree *alone* (`--route /monero/markets`) and both
  produce 309,511 B — identical. The difference exists only inside the 43-route run, where
  one browser context carries `localStorage` (`mh:v1:`), HTTP and font caches from
  `/markets`, swept earlier, into `/monero/markets`.
- **Sub-perceptual, and not a content change.** 1,330 differing pixels in a ~100×33 box at
  (340,545)–(440,578). **Every single delta is exactly ±1 on one or two channels**
  (`maxChannelDelta: 1`), symmetric — +1 in 376 pixels, −1 in 364 — over near-black
  background around RGB (10,9,7). Cropped at 4× and reviewed by eye: the two are
  indistinguishable, the paragraph (`p.serif`, "This is not hyperbole. This is
  cryptographic fact.") occupies **byte-identical geometry** on both builds
  (x 103, y 546.64, 702.59×28.05, Newsreader 17px/400, `document.fonts.status: "loaded"`).

The hypothesis offered — that a value or timestamp rendered as a placeholder when cold and
as a value when warm — is **refuted by that pixel data, not merely unconfirmed**: a
placeholder→value swap changes glyphs, and no glyph changed. Every differing pixel is
background dither. What actually produces a ±1 dither shift on a dark gradient in one build
and not the other, only after a warm context, I could not prove. So it is recorded as
unproven rather than given a second story — prompt 03 substituted a plausible mechanism for
a measured one and cost this prompt a day of re-derivation.

Both structural limitations this exposed are written into **`verify-shots.mjs`'s own
header**, not only here, because a handoff is read once and a tool header is read by
whoever next believes the word "pixel-identical".

**Noise floor, stated as its own permanent number.** Two back-to-back full sweeps of ONE
unchanged tree differ on **18 of 129 classic shots** — 17 `/simulate` (the `Math.random()`
exemption CLAUDE.md grants `src/protocols/**`) and `/peers` @390, which is *not* a simulate
route. So the gate's previous claim that "every non-simulate route is now byte-identical
between sweeps" was false on the current 43-route matrix; it is corrected in the file.
`verify-shots.mjs` now prints a `NOISE FLOOR:` line on **every** run, clean or not, counting
the compared shots that are uncomparable in principle rather than folding them into a pass.
**Logged for a later prompt, not done here:** `src/design/prng.ts` now exists, so threading a
fixed seed into `src/protocols/sim-random.ts` behind the repo's existing `window.__XMRI_*`
test-flag idiom would make the whole matrix deterministic and turn those 17 shots from
uncomparable into compared. Out of scope — it changes what 21 educational simulators render.

### 7.3 · Runbook — how to run these gates so the result means something

**1 · Revert break-test mutations, then prove the tree is clean, THEN run the chain.**
A `verify-govern` break test left `ArtBackground.tsx:265` reading the frame-governor dial
and discarding it (`// MUTATION: dial read but not applied`), uncommitted, in the working
tree. The governor shed nothing — exactly the behaviour its gate exists to prove. It never
reached a commit, but every "verified green" run taken while it sat there measured a tree
that no longer existed, and it was caught only by reading `git status` before the final
chain rather than trusting the last green run. The sequence, in order, every time:

```
git checkout -- <file>            # restore
git status --short                # must show only what you meant to change
grep -rn "MUTATION\|BREAK TEST" app/src app/*.mjs   # must be empty
npm run typecheck && npm run build && npm run verify:static && npm run verify:e2e
```

**2 · Run `verify:e2e` with nothing else competing for CPU. Contention is not flake.**
One `verify:e2e` run overlapped a concurrent `npm run build` in a second worktree.
`verify-nav` came back with **7 failures** — `/mempool → 0 #page-title`, a dangling
`aria-labelledby`, `.mp-canvas-scroll` restoring to 0, `?block=` not surviving a view
change, and three `?range=` history assertions. Every one looked like a real behavioural
regression. **Three consecutive isolated re-runs: zero failures**, and a direct probe found
`#page-title` present and `.mp-canvas-scroll` mounted on the same build. The mechanism is
mundane — `verify-nav` waits up to 12s for a lazy route's heading and the parallel build
starved it past that — but the failure text is indistinguishable from a genuine defect, and
"it's flaky, ignore it" is the wrong lesson. It is **contention**. Name it, re-run in
isolation, and only then decide.

**3 · The preview server needs supervising.** `vite build` empties `dist/`, and
`scripts/serve-dist.mjs` has no guard, so a build started while a gate is running kills the
server mid-request and fakes gate failures with `ERR_CONNECTION_REFUSED`. Run it under a
restart loop (`while true; do node scripts/serve-dist.mjs; sleep 1; done`) for any long
session.

**4 · Two servers for a sweep comparison.** Build `origin/main` in a `git worktree` with a
symlinked `node_modules`, serve it on 4174, and drive both with the BRANCH's
`verify-shots.mjs` under `VERIFY_BASE` so the capture procedure is identical and only the
served build differs.

### 7.4 · Findings the work produced that were not on the task list

**1 · The shot matrix is structurally blind to CSS animation.** `verify-lib.mjs:95-99`'s
`freezeAmbient()` injects `*, *::before, *::after { animation: none !important;
transition: none !important; }` into every captured page. That is the right call for shot
stability, but it means **no CSS-animation change can ever show up in a sweep** — `ringct`'s
inline `spin 14s` and `carrot`'s `scaleX` bar rewrite are both byte-identical to the
baseline for exactly this reason, not because nothing changed. SMIL is *not* covered by that
rule, which is why `dandelion`'s `<animate>` removal *does* show. Practical consequence: a
clean sweep says nothing whatsoever about motion behaviour, and `verify-reduce.mjs` is not
redundant with it.

**2 · `verify-shots.mjs:190` navigates with `waitUntil: 'networkidle'`.** Against a 3s FAST
polling tier the network is never durably idle, so when the promise resolves depends on
where in the poll cycle the navigation landed. This is the same anti-pattern
`verify-contrast.mjs:103-106` carries an explicit comment about and that `verify-future`,
`verify-contrast` and `verify-ground` were each de-networkidled to remove in v6.1.1/v6.1.2 —
the shot gate was missed. It is the most likely source of the residual per-route capture
jitter documented in §7.2 and it is **not fixed here**: changing the sweep's navigation
timing invalidates every baseline tree, which is its own change with its own re-baselining.
Logged rather than done.

**3 · The prompt-03 diagnosis of the 1440 instability was wrong, and its replacement is
proven.** `verify-shots.mjs:59-72` blamed ParticleField's unseeded `Math.random()`.
ParticleField never renders in a screenshot at all: `verify-shots.mjs:73` emulates
`prefers-reduced-motion`, `deviceTier.ts:121` demotes to `low` under it, and
`ArtBackground.tsx:40` returns `null` on `low`. `git blame` settles the ordering — the
`emulateMedia` call landed in `bd8d5c2` (v6.0.10), the comment in `0344b3d` (prompt 03), so
the emulation was already in place when the 135,366 B vs 135,439 B diff was measured and
attributed. The real cause was `Footer.tsx:12,22`: a live seconds-resolution UTC clock on
every route, proven by pixel diff (84 px, `elementFromPoint` → `span.footer-tele`) and fixed
with Playwright's Clock API.

**4 · An animation census is a floor, not a ceiling.** The 27-surface audit drove every
surface headless and counted `document.getAnimations()` plus SMIL elements. It scored
`terminal` clean while its typewriter — a `setTimeout` chain — was typing and erasing
forever under reduce. JS-driven motion appears in neither census, and only a source read
finds it. `verify-reduce.mjs`'s header says so, because the next person will trust the
number.

**5 · "`Math.random()` only inside `app/src/protocols/`" was enforced in two directories and
nowhere else.** `verify-prng.mjs` §6 walked `src/design/`; `verify-memshell.mjs` walks
`src/mempool/`. An adversarial injection into `src/routes/useUrlState.ts` passed the entire
`verify:static` chain green. CLAUDE.md flags this exact invariant as having "regressed once
already". §6 now walks all of `src/` with `protocols/` exempt, plus an assertion that the
exemption is load-bearing so emptying `protocols/` fails loudly instead of passing silently.

**6 · One `verify-govern` break-test mutation was left in the working tree** and was caught
only by reading `git status` before the final chain. `ArtBackground.tsx:265` read the
governor dial and discarded it (`// MUTATION: dial read but not applied`), so the frame
governor shed nothing — precisely the behaviour its gate exists to prove. Uncommitted, so it
would not have reached the PR through `git`, but every "verified green" run taken while it
was present measured a tree that no longer existed. The rule it earns: after a break test,
`git status` is part of restoring, not an optional check.

## 8 · LOOP FEEDBACK

<!-- cowork appends here when verify fails -->
