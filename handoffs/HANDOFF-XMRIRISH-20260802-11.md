---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-11
branch: claude/v6-1-5-pr-b-cls-v7cqnj
status: in_progress      # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, self-authored)
owner: claude-code
---

# HANDOFF — v6.1.5 PR B: the optimisation (the thing the ruler measures)

## 1 · GOAL

PR A built the ruler and deliberately changed nothing the site does. When this is done, the
defect that ruler found is fixed at its cause rather than accommodated by its ceiling; every
optimisation item carries a before/after number produced by a committed gate; items where
measurement says "no change needed" are reported as results rather than dropped; and every budget in
`verify-bundle.mjs` is re-baselined against the tree this PR actually ships, each stamped with the
harness and commit that produced it.

## 2 · CONTEXT

- Branched from `origin/main` at **4be3003** (the merge of #156, prompt 06's PR A).
- Source of this task: prompt 06 of 19, second and final PR. Its *Verify* list is §5 below, verbatim.
- Prior handoff: `handoffs/HANDOFF-XMRIRISH-20260802-10.md` (PR A). Pointer only — that file is an
  immutable dated record and is not rewritten by this work.
- Relevant files: `app/verify-cls.mjs`, `app/verify-bundle.mjs`, `app/verify-vitals.mjs`,
  `app/verify-reduce.mjs`, `app/src/styles.css`, `app/src/App.tsx`, `app/src/pages/HomePage.tsx`,
  `app/src/pages/NetworkPage.tsx`, `app/src/pages/MarketsPage.tsx`, `app/src/views/protocols.tsx`,
  `app/src/pages/SimulatePage.tsx`, `app/PERF-BASELINE.md`.
- Plan: `/root/.claude/plans/v6-1-5-pr-spicy-plum.md`, approved after three operator review rounds.

**Baseline-of-record.** `npm ci` + `npm run build` on `4be3003`, Node 22.22.2, then
`node verify-bundle.mjs`. It reproduces PR A's `5fca6ba` figures **exactly** — eager 79,919 B gzip,
CSS 14,863, total JS 849,267 raw, largest chunk `SimulatePage` 180,572 raw, 35 chunks, 23 passed /
0 failed. That equality is what makes this machine a fair "before".

## 3 · SCOPE

**IN:** the `/` healthy-pass CLS defect, fixed at its cause; reserves for the two unreserved Suspense
fallbacks (`App.tsx:76`, `:105`); items 5–9 of the prompt (INP, component-level code splitting,
`content-visibility`, CSS containment, passive listeners/throttling), each with a measured
before/after or a measured no-change report; a full re-baseline of `verify-bundle.mjs`; `/simulate`
added to `verify-cls` and `verify-vitals` route tables, baselined before any optimisation lands.

**OUT (non-goals):**
- **`/monero` gate rows.** After the containment redirect (§4) `/monero` is a target of nothing here.
  A row for a route this PR does not change is permanent CI cost for no signal.
- **Within-tab sectioning** on `/monero` and `/simulate` — what those pages would actually need for
  `content-visibility` to do anything. Named, not built.
- **Populating the Markets chart fixture.** Both CLS passes render those charts empty
  (`{groups:{}}`); their shift behaviour stays unmeasured, as PR A recorded.
- **`MarketsPage:291`'s source mis-attribution** and **`styles.css:997`'s hardcoded
  `.mp-switcher { top: 60px }`** — the latter belongs with prompt 07's nav rewrite.
- **The three non-rAF-deferred `ResizeObserver` callbacks** (`useMemCanvas.ts:203`,
  `use-proto-canvas.tsx:96`, `FutureMini.tsx:75`). Real, but no committed gate can produce a
  before/after for them, and landing an unmeasurable change violates this PR's own rule.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22. `api/` is **mixed** CJS/ESM — match the file.
- `Math.random()` only inside `app/src/protocols/`. `verify-prng` §6 strips block comments and
  line-start `//` but **not a trailing `//`** — a banned literal in a trailing comment trips the gate.
- New CSS goes in `@layer components`; only `@keyframes` is exempt. A new stylesheet must be
  registered in `verify-legibility.mjs`'s `STYLESHEETS` list or it is unexamined, not passing.
- CSP `connect-src 'self'`; zero third-party browser requests, ever. Used over Tor.
- Every route keeps its `noscript` block and literal background floor. Usable at 390px. No text
  under 12px. Every animation ships a `prefers-reduced-motion` path that loses no information.
- Suspense fallback **copy** must not change — `entry-ssr.tsx:34`'s `SUSPENDED_RE` is shared with
  `scripts/prerender.mjs` and a prerendered document containing that text fails the build.
- Commit **before** break-testing; revert with `git checkout <sha> -- <file>` and prove with
  `git diff <pre-break-sha> HEAD -- <file>` empty. Bare `git checkout -- <file>` reads the INDEX and
  silently no-ops on a committed break.
- `BUNDLE_INFLATE_KB` and `CLS_INFLATE` unset in the final run — `grep` reads files and is blind to
  an environment variable, as is `git status`.
- A failing `build` job silently skips every hardening gate (`verify: needs: build`). Red build ⇒ no
  CLS or vitals result at all; do not read that silence as green.
- Do **not** append a per-prompt session note to `CLAUDE.md`.
- `gh` is not installed — use the GitHub MCP tools. PR ready for review, **not** draft.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `/`'s healthy-pass CLS is fixed **at the cause, not the ceiling**: the fix lands, the ceiling
      drops to the new measured worst-of-8, and both the before (0.3482) and the after are stated.
- [ ] `App.tsx:76` and `:105` reserve space; the measured effect is reported.
- [ ] Every item 5–9 carries a **before/after number** from `verify-bundle`, `verify-vitals` or
      `verify-cls`. Items where measurement said "no change needed" are reported as such.
- [ ] **Route-level splitting is reported as pre-existing**, with what it already covers, before any
      new splitting is proposed.
- [ ] Every budget in `verify-bundle.mjs` is re-baselined, each stamped with harness and commit, and
      the expected-direction table is compared against what happened.
- [ ] `content-visibility` and containment ship with a reduced-motion path and a 390px check, and CLS
      is re-measured on every route they touch.
- [ ] No route loses its `noscript` block or background floor.
- [ ] `verify-prng` passes; no `Math.random()` outside `protocols/`; no banned literal in a trailing
      comment.
- [ ] `npm run typecheck`, `npm run build`, `verify:static`, `verify:e2e`, `verify:bundle`,
      `verify:all` and every `api/verify-*.mjs` exit 0. Counts and consolidated tally reported with
      `passed · fixtured · skipped · failed` kept separate.
- [ ] Working tree clean · `grep -rn "MUTATION\|BREAK TEST" app/src app/*.mjs` empty ·
      `BUNDLE_INFLATE_KB` and `CLS_INFLATE` unset — all three **before** the final chain run.
- [ ] PR ready for review, `mergeable: true`, `mergeable_state: clean`, every check concluded green.

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck
npm run build
node verify-bundle.mjs
npm run verify:static
node scripts/serve-dist.mjs &   # then: npm run wait-preview
npm run verify:e2e
npm run verify:all
node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs && node ../api/verify-nodehealth.mjs \
  && node ../api/verify-status.mjs && node ../api/verify-tx-parse.mjs
```

## 7 · REPORT — claude code fills this on exit, completely

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

### The recorded `/` CLS diagnosis is wrong, and the way it got there is the batch's signature failure

PR A recorded `MEASURED_MOCKED['/'] = 0.36` against a measured 0.3482, diagnosed as:
`DIV.ticker-strip` grows h25→h38 when the first market tick lands and displaces `.shell` — 746px on
an 844px viewport — by 3px.

**Separate the magnitude from the attribution; they have different standing.**

- **The number stands.** The committed gate measures 0.3475–0.3482 every run, 8 of 8, and only in the
  mocked pass; degraded reads 0.0006. Something genuinely shifts when data arrives at 390px and every
  cold visitor to the live site pays it. "The diagnosis is unverified" must not be allowed to collapse
  into "there is no defect."
- **Only the story is prose.** The observer at `verify-cls.mjs:262-267` observes
  `{type:'layout-shift', buffered:true}` and accumulates `entry.value`; it **never reads
  `entry.sources`**. Every `sources` hit in that file is either the `/sources` route (`:129`, `:139`,
  `:165`) or the prose diagnosis itself (`:176`). So the attribution came from ad-hoc instrumentation
  during PR A that was never committed — **precisely the defect PR A found at `PERF-BASELINE.md:17`
  (a documented measurement whose harness does not exist), committed in the same PR that flagged it.**

**Three independent disproofs of h25→h38, in order of force.**

1. **Arithmetic.** A layout-shift score is impact fraction × distance fraction, where the distance
   fraction is the greatest movement divided by the viewport's largest dimension. 3 / 844 = 0.00355,
   so one such entry caps at **0.0036** even at impact 1.0. 0.3482 requires ~294px of movement.
   **The recorded mechanism cannot produce the recorded number.**
2. **Polarity.** In the degraded pass every `/api/*` 501s, so `chromePhase(["network","market"])`
   resolves to `error` and the pill renders `NO NODE RESPONSE` — the **longest** of the five labels,
   and exactly the 152px pill / 245px strip state `design/useOnline.ts:89-92` measured. That pass
   reads **0.0006**. The healthy pass lands on `LIVE`, the **shortest** label, and reads **0.3482**.
   If label-driven ticker geometry were the cause, degraded would be the worse pass. It is the better
   one by 580×.
3. **Layout.** `styles.css:1876` hides `.tk--btc` at ≤768px and `:2347` hides every
   `.ticker-strip > .tk` below 480px. At the 390px harness viewport there is no price element left
   for a market tick to grow — the laid-out children are only the status pill and the `⌘ DESIGN`
   trigger.

Note the two in-tree records do **not** strictly contradict each other: `useOnline.ts:89-92` measured
a *chrome label* change, `verify-cls:177` describes *market data* arriving — different mutations of
one element. It is disproof 3 that makes the story untenable, and disproofs 1 and 2 that make it
impossible.

**CLS is a sum, and that changes the diagnosis.** 0.3482 is equally consistent with **one ~294px
shift** or **~98 repeats of a 3px shift**. Those have opposite fixes: a large shift is cured by
reserving the box that moved; ~98 small ones mean something relayouts repeatedly — a poll re-rendering
every tick, a font swap cascading, a chart re-measuring — and a reserve does nothing for it. The gate
window is `load + 3000ms` and the MARKET tier is 60s, so at most one market tick lands; but the chain
tier polls faster, so a repeating small shift is live rather than hypothetical. The instrumentation
therefore records **per-entry** values and each entry's own top source, never an aggregate.

### What the instrument found, and what the superseded diagnosis would have cost

`0.3483 → 0.0012`, worst of 16 readings across two independent `CLS_RUNS=8` runs.

The capture shows the dominant entry carries **four** sources. PR A's two observations are both
**confirmed exactly** — `.ticker-strip` really does go `202x25 → 159x38`, `.shell` really is displaced
`749 → 746` at +3px. What was never recorded is `BUTTON.navtop-toggle` moving **Δx−314**. The cause is
a `flex-wrap` bistability: `.topbar` wraps, `.ticker-strip` carries `margin-left: auto`, and when
`CONNECTING` (202px) becomes `LIVE` (159px) the auto margin eats the freed space, pulls the strip up
beside the brand, and evicts the hamburger to a second row 314px away.

**The prediction and the measurement meet.** The arithmetic disproof, derived from the spec alone, said
~294px of movement was required. The instrument measured 314px at impact ~0.93 — and 314 × 0.93 = 292.
Forward: 314/844 = 0.372 distance fraction × 0.93 impact = 0.346, against a measured 0.3475. A number
derived from the spec and a number derived from the instrument landing on each other is the strongest
evidence either could have.

**Candidates, measured by stylesheet injection before a single source file was edited:**

```
baseline                        0.3483
min-height reserve on .topbar   0.0304   ← what the superseded diagnosis implied
flex-wrap: nowrap variants      0.1018 – 0.1020   (+824px vertical shift)
pin the pill's min-width        0.0008
```

**The conclusion, stated rather than left for the reader:** the fix the original note pointed at —
reserve the ticker strip's populated height — reaches only **0.0304, 6× the ceiling**, and it would
have *looked* like a fix: a 91% reduction, a plausible mechanism, a green-ish number. An unverified
diagnosis was on track to produce an unverified fix that measurably did not work. **That is the case
for capturing `entry.sources` in the gate**, and it is worth more than any description of what the
property does.

**Method, kept because the method is the transferable part:** candidates were tested by injecting
stylesheets into the running gate harness and re-measuring, so four mechanisms were ranked before any
file changed. And the `min-width` constant was set by **measuring all five rendered label widths**
(LIVE 67px · OFFLINE 88 · CONNECTING 110 · NO NODE RESPONSE 153 · STALE · reconnecting 181, at
1ch = 6.3125px) rather than by accepting a proposed constant.

**A recorded error of the reviewer's, kept because of where it happened.** The advisory constant was
`21ch`. It is wrong: 21 × 6.3125 = 132.56px, so `NO NODE RESPONSE` (153px) and `STALE · reconnecting`
(181px) would both still have shifted. It was derived by counting characters in the longest label
rather than measuring its rendered width — the §6 failure this project keeps relearning, and the same
shape as the badge-census error in the §8 log: **a number taken from a count instead of a
measurement.** It belongs in the record because of where it landed — in a fix for a defect whose entire
cause was a diagnosis recorded without measurement, the advisory number was also produced without
measurement. Measuring the five labels instead of taking the constant is what caught it. Shipped value:
`29ch` = 183.06px, clearing the widest at 181px.

**Two smaller results, reported rather than smoothed over.** Degraded `/` reads 0.0009 against PR A's
recorded 0.0006 — **runner variance, not drift**, stated rather than silently adopted as a new number.
And its distribution improved as a side effect of the fix (from mostly-0.0009 to mostly-0.0002), which
is consistent: the same bistability exists in the degraded pass across `CONNECTING → NO NODE RESPONSE`,
just narrower. Geometry is stable and marginally *more* compact, not taller — the topbar holds h95 in
both states where it previously went 95 → 98.

### An unplanned defect, found by chasing a skip

`verify-vitals` reported `/ · interaction — SKIPPED` while the same row printed `worstInt 160.0` from
the first click — a skip that reads like a measurement. Chasing it found a **real, shipped mobile
defect**: `.topnav` is a fixed drawer at `z-index: 200` spanning x86–390 at a 390px viewport, and
`.navtop-toggle` sits at x330–374 with no z-index of its own, so opening the drawer painted over its
own close button at 97% opacity. `elementFromPoint` at the button's centre returned the NAV — a real
tap hit the drawer. The affordance was already correct (`NavTop.tsx:153` swaps to `✕`/`Close menu`);
only the stacking was missing.

It survived because Escape closes the drawer (`NavTop.tsx:45`) and a nav link closes it (`:76`) — but
the rule lives inside `@media (max-width: 768px)`, **where there is no Escape key and no backdrop**. A
touch user who opened the drawer and did not want to navigate had no way to close it.

**Two wrong diagnoses were written before the right one**, and both were disproved by probe rather
than by argument: first inter-click timing (disproved — a 3s `waitFor` still skipped), then a
feed-driven remount of `NavTop` (disproved — the menu stays open under the mocked feed for 6s). The
timing explanation had already been committed into a code comment; it is **corrected in the file**
rather than quietly dropped. Writing an assumed cause into the tree is the exact failure this PR
exists to fix, and it recurred inside the PR.

Scope note: this is a defect fix in an optimisation PR. It is here because it stood between item 5 and
a measured `/` interaction number, and shipping a mobile-CLS PR while knowingly leaving a dead close
button on the same bar would be indefensible.

### `/simulate`'s vitals baseline is bimodal, and the budget says so

`LCP 2292 median · block 253.5`, taken **before** items 5 and 6 touched anything. But the eight runs
were 2248, 2268, 2268, 2276, 2308, 2312 — then **5504, 5520**. Six in a 64ms band and two at 2.4×:
two modes, not spread. Assert mode runs 3, so a ~25% slow mode takes the median ~15% of the time; a
budget near 2292 would flake, which is the gate that teaches people to ignore red. It ships at
6000/500 with the second mode named in-file as **unexplained**, to be re-tightened once item 6 either
fixes or explains it. That is a different claim from the other three rows ("measured, with runner
headroom") and is labelled differently.

### Item 6 — component-level splitting of the 21 simulators

Not a new idiom: `views/index.tsx:65`'s `lazyView` already did this for the six mempool surfaces, and
its own header describes the separation "`protocol-meta.ts` already makes for the simulators". The
split was designed for and never taken. `lazyView` is now exported and `views/protocols.tsx` uses it;
`metaphors.tsx` exports 8 of the 21, so those 8 share one importer — splitting a single source file
into 8 chunks would be worse, and opening one metaphor legitimately loads its siblings.

| metric | before | after | delta |
|---|--:|--:|--|
| `/simulate` first load (gzip) | 133,680 | 84,934 | **−48,746 B (−36.5%)** |
| `/simulate` chunks on first load | 7 | 6 | −1 |
| largest chunk (raw) | `SimulatePage` 180,572 | `vendor` 164,505 | dethroned |
| total JS (raw) | 849,267 | 855,706 | **+6,439 (+0.8%)** |
| eager JS (gzip) | 79,919 | 79,947 | +28 |
| chunk count | 35 | 53 | +18 |

**The cost is stated, not buried:** total JS goes *up* 6,439 B in per-chunk overhead, and the count
budget moves 35 → 53. A count budget is not a size budget — 53 chunks is not worse than 35, it is
48,742 fewer gzip bytes on the route that pays for them — but the number that governs is the
per-route "first load ∪ static closure" row, and that went *down* in both bytes and requests.
`CHUNK_BAND` deliberately stays 4 rather than widening with the count: the band exists to catch a
chunking-strategy change, and that signal does not weaken because there are more chunks.

**No reserve was needed for the new Suspense boundary, and that is a measured claim.** It sits inside
`SimulatePage`'s `1fr` grid row, whose height comes from the grid rather than its content, so
fallback→simulator cannot move anything around it. The fallback copy deliberately **matches**
`entry-ssr.tsx:34`'s `SUSPENDED_RE` — not a hazard here but the mechanism: prerender re-renders until
nothing matches, which is what forces the real simulator into `dist/simulate/index.html`. Confirmed
against the built artefact: 0 occurrences of the loading copy, 1 of `art proto`.

**`verify-reduce` §1 would have gone green and vacuous.** It waits for `main` + 1500ms, which after
this change resolves while the simulator's chunk is still in flight — censusing a Suspense fallback
finds zero animations and zero SMIL for all 21 surfaces it exists to check. §2's control probe would
**not** have caught it: it drives two fixed URLs and would have kept finding motion. A `.art.proto`
mount assertion lands in the same commit, break-tested to red on all 21 surfaces, and reported before
the motion result because it qualifies it. `verify-reduce` 30 → 31 assertions, §2 still passing.

### Two structural admissions worth keeping

- **`verify-cls` never scrolls.** So a wrong `contain-intrinsic-size` on the containment work is
  invisible to every committed gate. The scroll-CLS evidence is a non-committed probe, labelled as
  such.
- **`content-visibility: auto` implies `contain: layout style paint`.** Item 7 therefore brings paint
  containment to every section it touches, before item 8 adds anything. Paint containment clips
  overflow, which is why item 8 uses `contain: layout style` and never `paint`/`content`/`strict`, and
  why tooltip and crosshair rendering at section boundaries needs checking by hand. **Prompt 13 (P7
  crosshair annotations) inherits this**: a crosshair synced *across* panels or sections is
  constrained by section-level paint containment. Better inherited as a written constraint than
  rediscovered as a clipped line nobody can explain.

## 8 · LOOP FEEDBACK

*(none — prompt-driven, no cowork loop)*
