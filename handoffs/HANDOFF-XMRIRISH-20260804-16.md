---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260804-16
branch: claude/post-merge-defects-v6-u1rns4
status: done                 # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff existed)
owner: claude-code
---

# HANDOFF — v6.1.9 cold boot: three post-merge defects, one of them shipping

## 1 · GOAL

After this task the cold-boot network orb actually renders a globe in the
console (it currently draws into a 300×150 default backing store and is
invisible), a cold tab on `/` opens on black rather than flashing prerendered
Main Home before the sequence starts, and the console is a viewport-aware panel
rather than a hard 1200px island. Two new gate sections make the orb's *drawing*
machine-checkable — presence, geometry, provenance and copy were all already
asserted and the thing the component exists to do was not — and a new
`verify-degraded` scenario covers the non-bypassed dead-bundle path that no
existing gate can reach.

## 2 · CONTEXT

- Base: `origin/main` at `95316a3` (PR #162, v6.1.8, cold boot + Main Home).
- Prompt: v6.1.9, pasted into this session. Operator answered three design
  questions and corrected one of their own prompt's claims (see §8).
- Relevant files: `app/src/coldboot/{Orb,ColdBoot,ColdBootConsole}.tsx`,
  `app/src/coldboot/orb.ts`, `app/index.html`, `app/src/main.tsx`,
  `app/verify-{orb,coldboot,coldboot-live,degraded,cls,nojs}.mjs`.
- Approved plan: `/root/.claude/plans/prompt-v6-1-9-logical-hanrahan.md`.

**Premise verification (§2 rule): three of the prompt's stated facts were wrong
and were corrected against source before building on them.**

1. The prompt's two candidate causes for the orb defect are both wrong — see §7.
2. The prompt's inline-script snippet gated on `sessionStorage`; `computeInitial`
   (`ColdBoot.tsx:302-309`) shows that key only sets `skipDecrypt`.
3. The prompt pointed at `verify-shots.mjs` for pixel-diff machinery; that file
   is a `Buffer.compare` byte comparator. The real differ is
   `verify-ground.mjs:66-104`.

Plus one the operator self-corrected: a wider console cap gives three *wider*
columns, not four — `auto-fit` collapses empty tracks and there are three panes.

## 3 · SCOPE

IN:
- Orb canvas collapse — console slot height **and** a canvas-wrap floor.
- Console `maxWidth` → `clamp(1200px, 92vw, 1600px)`.
- Frame zero: black before the sequence, never Main Home first.
- Gates for all three, each break-tested.

OUT (non-goals), explicitly:
- Persisting the decrypt field behind the console — deferred to its own prompt
  with its reduced-motion path and §2 determinism assertion designed, not bolted on.
- The desktop ENTER-handoff CLS (measured, recorded, operator's call).
- `/live/mempool` LCP at 97% of budget (pre-existing, passing).
- The `assemble` value that is computed and never read, and the one-commit
  `display:none` after the handoff (both found while diagnosing, both recorded).
- Layering the orb's captions over the canvas — rejected: it creates a surface
  whose contrast no gate in this repo can grade.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22. `app/` only plus `handoffs/`
  and `CLAUDE.md`; nothing in `api/`.
- Zero new dependencies.
- Zero fabricated values on live surfaces; `Math.random()` only in `src/protocols/`.
- `verify-degraded.mjs:68-90` slices the **first** `<style>` block in
  `index.html` and asserts it carries no `var(`, all three theme hexes literally,
  and a bare `html {}` rule of `#050505`. New CSS goes in a separate later block.
- Build → serve → run. Never rebuild while `serve-dist` is serving. Kill by PID,
  never `pkill -f`. Real exit codes recorded before any pipe.
- After any break test: `git checkout -- <file>` → `git status --short` clean →
  `grep -rn "MUTATION\|BREAK TEST" app/src app/*.mjs` empty → *then* run the chain.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run verify:static` exits 0 (20 gates)
- [ ] `npm run verify:bundle` exits 0
- [ ] All six `api/verify-*.mjs` exit 0
- [ ] `npm run verify:e2e` exits 0 — 29/29 gates, 0 failed
- [ ] `verify-coldboot-live` reports **0 skips** (its own end-of-file assertion)
- [ ] Orb backing store is sized to its box in all four contexts (bypassed Home
      and live splash console, each at 1440×900 and PHONE) — never 300×150, and
      above a stated floor
- [ ] Orb is asserted to PAINT by pixel count and a centred painted bounding box,
      in the same four contexts
- [ ] Both new orb assertions break-tested to a real non-zero exit (transcripts in §7)
- [ ] `cb-pending` arms on `/`, does not arm off-`/` or with the flag off
- [ ] Dead-bundle path: bundle blocked, splash NOT bypassed → `cb-pending` torn
      down and prerendered content readable (new `verify-degraded` B4)
- [ ] Inline predicate and `gate.ts` predicate agree on all 9 truth-table cases
- [ ] `/` CLS still 0.0000 healthy and degraded
- [ ] `verify-coldboot` §4 ENTER travel re-measured at the new cap and recorded
- [ ] Branch pushed · draft PR opened · `mergeable_state: clean`

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck
npm run build
node scripts/serve-dist.mjs &        # record the PID
npm run wait-preview
npm run verify:static
npm run verify:bundle
node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs \
  && node ../api/verify-nodehealth.mjs && node ../api/verify-nodes.mjs \
  && node ../api/verify-status.mjs && node ../api/verify-tx-parse.mjs
npm run verify:e2e
```

## 7 · REPORT

status: done
pr: (draft, opened against `main` — see LOG.md)
commits: `29039f0` orb fix · `842e33b` orb gates · `7d4618d` console cap ·
  `6c3a709` frame zero · `f326aa7` docs · `704c0bc` hold + fit-to-screen + CLS
deps added: none

### What the diagnosis found that the brief did not

**The brief's two candidate causes for the orb were both wrong.** `clientHeight`
is permanently ~0 by flex math — the overlay is `flex:"0 0 auto"` and the canvas
wrap was `minHeight:0`, so in a 160px slot the overlay took all of it. An
instrumented build logged **3 `resize()` calls and 3 early returns**: it never
once completed. The early return was CORRECT behaviour given a zero-height box.
**Diagnosing before fixing is the only reason this landed on the real cause** —
a fix aimed at either named candidate would have changed nothing and measured
green against a still-broken console.

**A third cause neither of us had.** `[data-orb]` is a `position:fixed` sibling
of ColdBoot's root at `z-index:auto`, and that root is `z-index:1000` with an
opaque `#050505`. The orb was painted UNDER it for the whole console phase, so
geometry alone would have shipped a correctly-sized invisible orb.

### Measurements

    context              box        wrap     backing store
    console 1440    160 -> 400   0 -> 238.5   300x150 -> 357x239
    console 390     160 -> 400   0 -> 211.9   300x150 -> 288x212
    home    1440    468 (same)  363 (same)    539x363 (unchanged)

Console geometry after fit-to-screen:

    viewport   1280     1440     1920     2560    390
    wrapper    1203.2   1353.6   1804.8   2100    342
    pane       362.4    410      552.8    646.2   312
    orb slot   526.5    526.5    551      551     400
    console    852      852      852      852     796      (all FIT)

· ENTER handoff CLS **0.0386/0.0391/0.0402 -> 0.0000/0.0000/0.0000**, zero sources.
· §4 travel 135.4 -> 147.8 -> **144.5px** (runtime output; threshold is `moved > 1`).
· Frame zero holds **1780ms** default, **350ms** at `__xmriCbHoldMs=0`, **453ms**
  on the dead-bundle path (watchdog ignores the hold).
· Mobile console **2282.6 -> 796px** in an 844px viewport. 63% was unreachable.

### The LCP finding — pre-existing, not introduced here, and unfixed

`verify-vitals` bypasses the splash (`coldBootOffBrowser` :305, asserted :353).
Under its own harness: a real cold `/` measures LCP **3992/4048/4260ms** while
the gate measures **2104/2128/2156ms**, against a 2500ms budget. **~1920ms of
real cold-visit LCP that no gate can see.** The 1.5s hold does not cause this and
barely adds to it — being a floor, it contributes 0ms on that profile. Recorded
for a decision; not absorbed silently.

### verify-vitals is RED, and it is red on the base commit too

Three blocking budgets failed. Rather than assume, the same gate was run against
`origin/main` at 95316a3 — same box, same conditions, separate build:

    /                baseline 537ms ❌   this branch 518 / 436ms ❌   (budget 400)
    /live/mempool    baseline 297ms ✅   this branch 334 / 314ms     (budget 300)
    /live/markets    baseline SKIPPED (87.4% spread)  this branch 413ms / SKIPPED

`/` fails on the unchanged base and this branch measures FASTER than it. Two
routes self-skip as UNVERIFIABLE at 80-94% run spread. This is the machine, not
the tree — the same conclusion CLAUDE.md already records from v6.1.8, where a
479ms figure "was my own chain running beside the measurement" and the correct
outcome was to not change the app. **No app change and no budget change was made.**

### Final chain, per gate — `verify:e2e` real exit code **1**

29 declared. **26 ran and passed · 1 red · 2 never ran.**

`verify-charts` (#3) and `verify-memdetail` (#5) print no summary line in this
format, but both PASSED: the chain is a single `&&` sequence, so #4 and #6
reporting is structural proof that #3 and #5 exited 0.

`verify-coldboot` (#28) and `verify-orb` (#29) DID NOT RUN — the chain aborted at
#27. Their verdicts are therefore not from the chain; both were run separately
against the same dist: **verify-coldboot 29 passed · 0 skipped · exit 0** and
**verify-orb 104 passed · 0 skipped · exit 0**. Stated as a separate measurement
rather than folded into a chain tally they were not part of.

The single red is `verify-vitals`: **11 passed · 0 fixtured · 2 skipped · 1
failed**, the failure being `/` median blocking 522ms against a 400ms budget.

**The contention story confirmed itself inside this run.** `/live/mempool`
measured **271ms and PASSED** here, having measured 334ms and 314ms in earlier
runs against the same 300ms budget — the same route crossing its own ceiling in
both directions on one machine with no code change between. Two other routes
self-skipped as UNVERIFIABLE at 93.8% and 79.8% spread while the CPU probe read
268-271ms and flagged nothing.

### The structural finding under that red, and the one-line fix

The red matters less than where it sat. Measured from `package.json` before the
change:

    #27 verify-vitals     <- the noisiest measurement in the suite
    #28 verify-coldboot
    #29 verify-orb

`verify:e2e` is a single `&&` sequence, so **the only two gates downstream of
`verify-vitals` were the two this PR exists to add.** While vitals was red for
ANY reason — including a contention red already shown to reproduce on base —
this PR's own feature gates could not run in the chain at all. That is not
hypothetical: on the final run they never executed, which is why their green
results are reported here as separate runs rather than folded into a chain tally
they were not part of.

Same shape as the `verify-coldboot` §1 dependency hole from #162 — position
deciding whether a load-bearing gate reports at all — and the same remedy the
repo already wrote down: **order by what depends on what, not by age.**

`verify-vitals` is neither a precondition nor a feature assertion. It has zero
dependents and zero dependencies, and it is the most contention-sensitive gate in
the suite, so its failure is both the least informative and the most likely —
which is precisely what belongs last. Moved to #29; `verify-coldboot` #27 and
`verify-orb` #28 now report before it.

One line in `package.json`, and nothing else: `scripts/verify-all.mjs:48` DERIVES
the chain from `pkg.scripts`, and `ci.yml:186` runs `npm run verify:e2e` as one
step, so the orchestrator and CI both follow.

The counter-consideration, stated rather than glossed: v6.1.8 put
`verify-coldboot` last deliberately as "the likeliest flake in the suite", so a
coldboot flake can now mask vitals. That is the correct trade — masking an
environmental measurement costs nothing; masking the subject under test costs the
result.

### `/live/mempool` is an UNCALIBRATED budget, not a flaky one

Across runs on one machine with no code change between, it measured **334ms,
314ms and 271ms against a 300ms ceiling** — crossing its own budget in BOTH
directions. That is not flake. A flaky gate invites a retry; an uncalibrated one
invites a decision, and this budget has not been calibrated for this class of
hardware. The same applies to `/` at 400ms, which reds at 522ms here and 537ms on
the unchanged base commit.

Recorded in these terms deliberately, because the wording determines what the
next person does about it.

### Deviations from spec

· The brief named `coldbootsplash_6.html`; no such file exists. The mockup is
  `docs/v6-mockups/coldboot-splash.html` and carries every rule described.
· Its `.net-stage{min-height:240px}` is a NARROW-viewport rule (inside
  `@media (max-width:1100px)`), not a wider one. Base is 190px.
· `.con-grid`'s own ceiling is `max-width: 2100px`, so the cap landed there
  rather than at the 1800px minimum the brief set.
· A z-index fix was added beyond the approved plan, and reported at the time
  rather than folded in silently — without it the orb is invisible regardless.

### Notes for ARCHITECTURE.md / CLAUDE.md

Patched: gate inventory recounted (75 files / 71 gates / 57 CI-reached), v6.1.9
session note, and four Known Issues entries. Three of those four are now FIXED by
the follow-up block (mobile clipping, handoff CLS, `assemble` unread, the
post-handoff blink) and want removing at the next pass.

### Open questions

1. The ~1920ms cold-visit LCP blind spot — worth its own gate, since
   `verify-vitals` and `verify-cls` both bypass the splash by design.
2. Persisting the decrypt field behind the console — deferred by the operator to
   its own change.
3. `verify-vitals`' blocking budgets are not measurable on this class of runner.

## 8 · LOOP FEEDBACK

### The standing family — two new instances

**Instance ten · the orb defect itself, and the first to reach users.**
`verify-orb` shipped 26 green assertions covering what the orb SAYS — no
hostname, honest empty state, ILLUSTRATIVE badge, no geographic placement — and
none covering whether it drew. The gate-side cause is the family INVERTED:
`openHome()` is the file's only context factory and it calls `coldBootOff(ctx)`,
so the SUBJECT was the bypassed Main Home while the CLAIM read as "the orb".
Home draws correctly at 538.9×468; the console, the one surface the gate never
rendered, is where it was broken. **A subject narrower than its claim passes for
reasons outside the claim, exactly as a wider one does.** Nine prior instances
were all "wider"; this is the first recorded "narrower", and the distinction is
worth keeping because the tell is different — a wider subject fails
intermittently for unrelated reasons, a narrower one is permanently, quietly
green.

**Instance eleven · in the brief itself.** The prompt asserted that raising the
console cap would give "four columns instead of three" from
`repeat(auto-fit, minmax(300px,1fr))`. There are exactly three panes and
`auto-fit` collapses empty tracks, so the count is pinned at three at every cap
— measured at 1280/1440/1920/2560/390, all three. The claim was reasoned rather
than measured. The operator caught it themselves on being shown the measurement
and asked for it recorded here.

### INFERRED — things the brief did not say, discovered by measurement

- **The prompt's two candidate causes were both wrong.** It proposed a zero box
  at mount that the ResizeObserver never recovers from, or a canvas node
  replaced on a phase change. The truth is a permanent flex collapse: the
  overlay is unshrinkable and the wrap is not, so `clientHeight` is 0 forever
  and `resize()`'s early return is CORRECT behaviour. Diagnosing before fixing
  is the only reason this landed on the real cause — a fix aimed at either
  named candidate would have changed nothing and measured green against a
  still-broken console.
- **A third cause the brief did not contemplate**: the orb painted beneath
  ColdBoot's opaque `z-index:1000` root. Geometry alone would have shipped a
  correctly-sized invisible orb.
- **The prompt's inline-script snippet had a third clause that would have
  preserved the bug.** `sessionStorage` gates `skipDecrypt`, not whether the
  splash renders.
- **The prompt pointed at `verify-shots.mjs` for pixel-diff machinery.** That
  file is a `Buffer.compare`. The real differ is `verify-ground.mjs:66-104` —
  and in the event neither was the right tool, because a screenshot measures the
  compositor and the claim is about the backing store.
- **`135.4px` is runtime output**, not a literal in `verify-coldboot.mjs`; the
  asserted threshold is only `moved > 1`. Nothing in code needed editing.

### QUESTION — raised to the operator mid-flight rather than assumed

- Whether to grow the console slot or layer the captions over the canvas
  (answered: grow, plus the floor — layering would create a surface no gate in
  this repo can grade for contrast).
- Whether to persist the decrypt field behind the console (answered: no, defer
  to its own change).
- The cap formula (answered: `clamp(1200px, 92vw, 1600px)`, because
  `min(1600px, 92vw)` regresses 1280px laptops by 22px).
- The z-index scope addition was **reported, not folded in silently**, since it
  went beyond the approved plan.

### Gate rounds

No convergence loop was needed — no `GATE: FAIL` round occurred. Three
assertion defects were found and fixed **while writing the gates**, before any
of them reached a chain run:

1. A self-check injected an inline `height`; `Orb.tsx` rewrites that inline
   style on its 24fps tick, so the injection was reverted within ~42ms and the
   check failed for a reason unrelated to its claim. Now a stylesheet rule.
2. The same self-check then used a fixed 120px box, which collapses nothing on
   Home (97px overlay). The height is now derived from the overlay actually
   rendered in whichever context it runs.
3. `verify-cbpending`'s placement check searched for `childElementCount === 0`
   and matched the comment written three lines above the removal explaining why
   the removal is not inside that branch — red against a correct file. Same
   shape as `verify-orb` §4's naive lat/lon grep. Now matches the `if (` form.

**All three are the same lesson**: an assertion can be textually correct and
still measure the wrong thing, and the only way to find out is to run it against
a state you know should fail.

**Instance twelve · `verify-vitals` has never measured the page a first-time
visitor loads.** It calls `coldBootOffBrowser` at `:305`, so its SUBJECT is the
bypassed Home while its CLAIM is `/`. The gate reads **2128ms**; a real cold
visit reads **4048ms** against a 2500ms budget. Same shape as the orb — a check
that could not fail for the reason it was written — and pre-existing, so a
finding rather than a regression.

**And this is why the 1.5s hold is "free", which must be recorded honestly.**
The hold looks costless because on the throttled profile the bundle already
exceeds 1500ms, so `max(0, 1500 - elapsed)` contributes 0. That is true. But the
budget it is measured against was never pointed at the real page. A future reader
must not conclude the hold was *proven cheap* when what was proven is that **the
instrument was aimed elsewhere.** The hold is still correct as built — a minimum,
not an addition; 1780 / 350 / 453ms measured; the watchdog ignores it; reduced
motion stated in `gate.ts` rather than implied — but its cheapness rests on an
instrument with a known blind spot.

**The control that made "it's the machine" a finding rather than an excuse.**
`verify-vitals` reds on three blocking budgets here. The only thing separating
that from a convenient story is that the UNCHANGED BASE COMMIT was measured and
reds too — `/` at **537ms on 95316a3** against **518 / 436ms** on this branch,
i.e. the base is SLOWER than the change. Neither the CPU probe (265-274ms, which
read healthy throughout) nor intuition could have established that.

**Timing of that control, because it decides how much the control is worth:**
both runs were back to back in the SAME container and the same shell session,
with no restart between them — the branch run, then `git checkout 95316a3`, a
~40s rebuild, the baseline run, then the checkout back. Roughly two minutes
apart on one machine. Had they straddled a container restart they would be two
environments and the comparison would be far weaker than it reads.

Reinforcing it: two routes self-skipped as UNVERIFIABLE at **80-94% run spread**,
8-9x past the 10% threshold — the mechanism catching contention that the CPU
probe reports as absent, on its first real outing. **No app code and no budget
was changed.** Widening a ceiling to clear a red already shown to be
environmental would spend the budget's meaning to buy a green badge.

**What CI should be expected to do.** CI is a third machine. If `verify-vitals`
reds there, that is consistent with this diagnosis. If it goes green, that is
*also* consistent — it would mean a quieter runner, which is the same claim seen
from the other side. Either outcome leaves the diagnosis standing; what would
refute it is the base commit passing on a machine where this branch fails. The
operator should not be surprised by a red check on a PR described as clean.

### The break test that proved nothing, and was caught

Forcing the console to 2300px to red-test the new reachability assertion, the
injected `height: 2300px !important` **lost to `flex: 1`** on a flex item: the
console stayed 796px and the predicate reported ✅. Banking that as "break-tested"
would have shipped an assertion whose falsifiability had never been demonstrated
— the exact vacuity this whole task is about, one level up, in the tool built to
detect it. `min-height` is what actually reproduces the state; with it the
predicate reds at exit 1. **A break test that does not go red has not passed; it
has failed to run.**

### Process note for the next revolution

Rule 7 ("never rebuild while `serve-dist` is serving") was violated once. The
PID captured from `$!` was a wrapper, `ss -ltnp | grep -oP 'pid=\K[0-9]+'`
returned empty on this box, and the kill silently hit nothing — so a rebuild ran
against a live server. Recovered without loss because `serve-dist` reads from
disk per request, and **verified rather than assumed**: the §0b idiom (entry
chunk resolved from `dist/index.html`, bytes compared against the wire) confirmed
identical. Use `ps -eo pid,cmd | grep 'scripts/serve-dist.mjs'` to get the PID;
`$!` and `ss -ltnp` both proved unreliable here.
