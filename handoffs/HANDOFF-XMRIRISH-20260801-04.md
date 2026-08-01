---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260801-04
branch: claude/motion-transition-foundation-4452ip
status: in_progress        # open -> in_progress -> done | blocked
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

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run verify:static` passes
- [ ] `npm run verify:e2e` passes
- [ ] `grep -rn "Math.random" app/src --include=*.tsx --include=*.ts` returns hits only under `app/src/protocols/`
- [ ] The PRNG determinism + distribution gate exists, runs in CI, and passes
- [ ] PRNG-only checkpoint sweep is byte-identical to `origin/main` (classic)
- [ ] Full-branch sweep: every diff enumerated by route with a cause; the `unexplained` bucket is empty
- [ ] `verify-shots.mjs` reports compared / no-baseline / **skipped-by-filter** as separate numbers
- [ ] The acyclicity assertion exists, runs, is named correctly by `verify-legibility.mjs`, and goes red when a role is deliberately cycled
- [ ] Zero ad-hoc durations left in `app/src` (each remaining literal justified in a comment)
- [ ] All 27 surfaces enumerated below with three separate counts
- [ ] CI grep for layout-property animation returns zero hits under `mempool/` and `protocols/`
- [ ] Route changes morph in Chromium and cut cleanly without View Transition support
- [ ] Back-navigation restores scroll on `/mempool` and `/simulate`
- [ ] `/mempool?v=terminal` deep-links; `grep -rn 'HashRouter' app/src` returns nothing
- [ ] Focus lands in the new view's main region; the route is announced
- [ ] Theme toggle crossfades, and swaps instantly under reduced motion
- [ ] design-reviewer returned APPROVE
- [ ] Branch pushed · PR opened (ready, not draft) · `mergeable_state: clean` · CI green

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

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

### 7.1 · Reduced-motion audit — 27 surfaces

**Counts (never merged): already compliant 19 · fixed 3 · not applicable 5.** (19+3+5 = 27.)
5 of the 19 "already compliant" rows carry a found defect (motion that keeps running under
reduce despite losing no information) — flagged inline and repeated under "Defects found."

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
| dandelion | SVG sim | Stem→fluff propagation; per-hop obscurity growth; embargo timer | Stat grid (STEM PROB 0.90, FLUFF PROB 0.10, EMBARGO 39s, OBSCURITY ∞) and the "STEM PHASE"/"FLUFF PHASE" headers render unconditionally; panel's 5-step lifecycle is prose. Frozen tick=0 lands at hop 0 (origin only, before the fluff burst) — an incomplete diagram but not a false one. | already compliant *(defect found — see below)* | R+A / R+C |
| viewtags | SVG sim | 256× wallet-scan speedup from a 1-byte view-tag prefilter | `ScannerWall`'s `frozen` prop parks BOTH scanners at the COMPLETED scan (256/256) instead of `t=0`, so the Stat grid reads the real 256 ms vs 4 ms rather than both panes reporting "1 ms" (the fix this session; see §2 model). | fixed | R+C |
| ringct | SVG sim | 5-station confidential-tx assembly line; final tx byte layout | Every station's formula/label renders unconditionally regardless of phase; the "FINAL TX RECORD" `<pre>` block and Stat grid are static text. Frozen tick=0 shows station 1 active/none done — an accurate snapshot of the line's start, not a false one. | already compliant *(defect found — see below)* | R+A |
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
| reactor (mempool) | Mixed DOM/SVG | Mempool as hex-density lattice; 16-decoy ring-signature fan; confirmation-track progress | `MemViewShell`'s `table` slot (CSS-forced visible under reduce, `styles.css:1091-92`) lists the same real txs as rows; block heights/CONF counts are static per-block text. | already compliant *(defect found — see below)* | R+A |
| bridge (mempool) | Mixed DOM/SVG | 12-pane mission-control telemetry: gauges, block-cadence countdown | `BrgGauge`'s rAF loop stops and snaps straight to the target value under reduce; the block-cadence ring is a genuine elapsed-time clock (`useTick(…,{motion:false})`) deliberately exempt from freezing ("a countdown that freezes is a clock that lies"), with its own dash-offset transition set `reduced ? "none" : …`. `table` slot present. | already compliant | R+A |
| sediment (mempool) | Mixed DOM/SVG | Mempool as a vertical core-sample tube; ring-fan; tracked-tx highlight | `table` slot gives the same real txs as rows under reduce. | already compliant *(defect found — see below)* | R+A |
| constellation (mempool) | Mixed DOM/SVG | Mempool as a luminous network sphere; fee-tier distribution; bytes-by-tier donut | `table` slot; fee-tier bars' `transition: reduced ? "none" : …` (fixed this session, see §2 findings); sphere-node pulses are `{!reduced ? <animate/> : null}`-gated. | already compliant | R+A |
| terminal (mempool) | DOM (CLI-style) | Live tail of mempool events + daemon panel | `table` slot; this view's own dense telemetry (`stats={false}`) stays mounted in the body regardless of reduce. | already compliant *(defect found — see below)* | R+A |
| classic (mempool) | DOM, reflow | Explorer-style tx/block inspectors; fee-tier segmented bar; block ribbon | `reflow:true` (no fixed canvas — reflows natively) plus the `table` slot; every transform/transition in the file is `reduceMotion`-gated (fee bar, hover lift, entering-row class). `verify-glide.mjs` scenario 4 asserts the block ribbon still renders under reduce. | already compliant | R+A |

**Defects found** (reported here per role instructions — not fixed in this file; all are
"motion never stops," not "information lost," so none flip the verdict above, but all
violate the CLAUDE.md invariant "every animation ships a `prefers-reduced-motion` path"):

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

(filled during the checkpoint and Wave 3J)

## 8 · LOOP FEEDBACK

<!-- cowork appends here when verify fails -->
