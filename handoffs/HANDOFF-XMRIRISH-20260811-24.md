---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260811-24
branch: claude/orphan-gates-wiring-xmle82
status: in_progress       # open -> in_progress -> done | blocked
written_by: claude-code    # manual mode — task arrived as a prompt (v2·3b The Orphan Gates)
owner: claude-code
---

# HANDOFF — v2·3b The Orphan Gates: wire four, fix the one that is red

## 1 · GOAL
Four `verify-*.mjs` gates that exist, run, and assert real things are in no npm
script and no CI step, so nothing has run them in months. PR #170 removed the
byte-budget veto that let 62 correctness gates be silenced; that fix only pays
off if the gates are wired. When this is done, `verify-pageshell`,
`verify-fit`, `verify-mobile` and `verify-perf` each have their own npm script
and their own named CI step in the `verify` job, and `verify-perf` — currently
red for three reasons, two of them defects in the gate rather than in the code —
is green on a correct tree.

## 2 · CONTEXT
- Base: `main` = `5537976` (PR #170: Terminal v2, eager/lazy split, CI un-veto).
- Prompt: v2·3b, supplied in full by the operator.
- Relevant files: `app/verify-perf.mjs`, `app/verify-mobile.mjs`,
  `app/verify-fit.mjs`, `app/verify-pageshell.mjs`, `app/package.json`,
  `.github/workflows/ci.yml`, `app/src/coldboot/ColdBoot.tsx`,
  `app/styles.css`.
- CLAUDE.md records these gates among the "orphaned gates" and among the "68
  stale route literals sit in orphaned gates, knowingly" — `verify-perf` is
  listed there at 11 literals. That entry is load-bearing for this task: wiring
  a gate makes its stale literals matter for the first time.

## 3 · SCOPE
IN: the four gates' correctness and wiring; the three `verify-perf` failures;
`verify-mobile`'s missing terminal summary; the stale `styles.css:1207`
comment; the `ColdBoot.tsx` rAF scheduling defect the perf gate found.
OUT (non-goals): Reactor v2·4, any view redesign, `V2-VIEW-CONFORMANCE` work,
any new component, the remaining 7 orphaned gates.

## 4 · CONSTRAINTS
- Stack: React 18 · Vite 5 · TS strict · Node 22. `app/` only plus `.github/`.
- Exact-token search, never substring, when mapping a filename to a script or
  CI step (`verify:perf` runs `verify-perf-classic.mjs`, a different gate).
- Two-polarity break test per new or modified assertion; actuals reported for
  both polarities.
- Patches via `git diff`; a mutation's restore must survive the mutator's death
  and must cover derived artifacts (`dist/`).
- A completion marker is emitted by the thing that completed.
- State what was measured, not what was inferred from it.
- Wire LAST: never wire a red gate.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `node verify-perf.mjs` exits 0 with 0 ❌
- [ ] `node verify-fit.mjs` exits 0
- [ ] `node verify-mobile.mjs` exits 0 AND prints a terminal summary line
      naming its own assertion count
- [ ] `node verify-pageshell.mjs` exits 0
- [ ] `npm run verify:static` exits 0 (no regression)
- [ ] `npm run verify:bundle` exits 0 (ColdBoot.tsx is touched)
- [ ] Each of the four gates has its own npm script, found by exact-token
      search of `app/package.json`
- [ ] Each of the four gates has its own named step in `.github/workflows/ci.yml`
      in the `verify` job, one step per gate, no `&&` chaining
- [ ] Two-polarity break test recorded for every changed assertion, with the
      actual counts for both polarities
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS
```
npm run typecheck
npm run build
node scripts/serve-dist.mjs &      # port 4173
npm run wait-preview
node verify-pageshell.mjs
node verify-fit.mjs
node verify-mobile.mjs
node verify-perf.mjs
npm run verify:static
npm run verify:bundle
```

## 7 · REPORT — filled on exit
status: done
pr: see LOG.md entry
commits: 5 (ColdBoot fix · verify-perf · the other three gates · records · wiring last)
deps added: none

**The three `verify-perf` failures, diagnosed and fixed.**
1. *"un-gated setInterval"* — the predicate tested ALLOWLIST MEMBERSHIP, not gating, and
   the message claimed behaviour. Both named files gate correctly, by two different
   mechanisms. Now a mechanism test with comments stripped (`verify-memshell`'s
   `stripComments`), message reworded to what is measured. `GATED` ships EMPTY: all four
   real call sites pass on their own merits, and the third historical entry
   (`xmrirish-feed.ts`) had no timer at all — its only `setInterval` is a past-tense
   docblock, so the waiver existed to suppress a false positive the predicate made.
   A `unnecessary` check now fails any waiver that is not load-bearing.
   Two-polarity: delete `useNodePopulation.ts:316`'s guard → **24/0 GREEN before
   stripping** (rescued by the word `document.visibilityState` in a comment at `:28`),
   **23/1 RED after**, naming the file. Restore byte-identical `f151838…`.
2. *"pre-paint stamp wrong: hydrated=true"* — the probe read `#root.childElementCount`
   as "React has hydrated". Prerendering made that true from the first byte, so the
   assertion could only pass if prerendering were REMOVED: a dead assertion that fails.
   Replaced with `documentElement.dataset.boot === "ok"` (`main.tsx:77`, whose own comment
   already says "Proof that the MODULE bundle executed"), asserted at BOTH polarities —
   false at `commit`, true after `load`. Two-polarity: stamp `data-boot` pre-paint in
   index.html → **RED**, "booted=true at commit". Restore byte-identical.
3. *"/ still animating while hidden — 181 rAF in 3s"* — real. `ColdBoot.tsx` froze the
   CLOCK while hidden but kept SCHEDULING, so `t` never reached 1, the `t >= 1` exit
   became unreachable, and the same frame repainted forever. Fixed with
   `useMemCanvas.ts`'s start/stop/`last = null` shape, in both loops. Two-polarity:
   **179 rAF under mutation → 0 with the fix**. No battery claim is made — a real
   background tab is rescued by the browser; what was wrong is that `/` depended on that
   rescue.

**Final counts.** verify-perf 18✅/3❌ → **21✅ · 0❌ · 3 skips**;
verify-pageshell 368 → **369**; verify-fit 21 → **22**; verify-mobile 2 (silent) →
**3 ✅ · 0 ❌ · 1 skip, with a terminal summary it never had**.
CI-reached files **57 → 61**; orphan gates **11 → 7**.

**Bundle, both endpoints built (not quoted).** eagerJsRaw 261,392 → 261,392 (**0 B** —
ColdBoot is in the lazy chunk since v6.1.9's split); lazyJsRaw 702,654 → **703,054
(+400 B)**; eagerJsGz 87,544 → 87,539 (−5 B, same raw bytes, different ColdBoot chunk
hash inside the eager chunk, so it compresses differently).

deviations from spec:
- **`GATED` ships empty**, against the brief's "the three current entries stay". Keeping
  them would exempt two files by MEMBERSHIP that the mechanism test already covers —
  reintroducing the defect being fixed — and the third is a suppressed comment. The
  operator reached the same conclusion independently mid-run.
- **Routes fixed in all four gates, not just `verify-perf`** (46 of the 68 recorded stale
  literals), plus landing assertions. The stale names were NOT producing wrong answers —
  measured, every one resolved to its canonical target with the query intact. What was
  wrong: an unstated dependency on `verify-redirects`' contract whose failure mode is a
  silent green, a harness/production split (serve-dist has no 301s; in production the
  301 fires first and query survival through it is a declared unknown at
  `verify-redirects.mjs:174-175`), and a race the gate did not know it was running.
- **Positive controls added to the overflow assertions** — not in the brief. Below 769px
  `html, body { overflow-x: clip }` makes `documentElement.scrollWidth` structurally
  unable to exceed the viewport, so three of `verify-perf` §4's widths and the whole of
  `verify-mobile`'s sweep were vacuous. They now report reasoned skips.

notes for ARCHITECTURE.md patch: CLAUDE.md's orphan census (11 → 7), stale-literal entry
(46 of 68 cleared, plus three files the quote-anchored sweep could not see), CI file count
(57 → 61) and the `verify:perf` → `verify:perf-classic` rename are all patched in place.
Contract §9's orphan-rot section gains the closing note and the two new defect classes.

open questions:
- `/future@1440` measures `main.scrollWidth - main.clientWidth == 17`, invisible to the
  document metric because `.main` is `overflow-x:hidden`. Exactly a scrollbar width, so
  the likely cause is the `overflow-y:auto` artifact — hypothesis, not established. Not
  fixed here; characterising it is what a `main`-box instrument would need first.
- `verify-sims` (12 stale literals) and `verify-v508` (4, self-declared HISTORICAL) remain
  orphaned and stale. Absent from CLAUDE.md's per-file list for the same reason
  `verify-fit` was: the original sweep was quote-anchored and they are template-only.
- `verify-memviews` scenario 7 red once during this run (the known sediment intermittent,
  1-in-6, recorded in v2·2). Not touched by this PR.

## 8 · LOOP FEEDBACK
- **The brief's §0 enumerated four gates and read as the orphan set; the census is 14
  files / 11 gates and was already written down at `CLAUDE.md:442`.** Re-derivation is not
  independent verification when the original was measured and annotated — that entry even
  records having been wrong once before, in the other direction. Read the repo's record
  before writing a brief about the repo.
- **A route-literal sweep that anchors on a quote cannot see `` `${base}/path` ``.** It
  reported `verify-fit` CLEAN while the file is four-for-four legacy. The same blind spot
  is why `CLAUDE.md:429`'s per-file list omits three files. Confirmed by prediction: a
  quote-anchored count reproduces that list exactly for all four untouched files.
- **A break test must prove the mutation had an EFFECT, not just that the file changed.**
  BT4's first two attempts applied cleanly and the gate stayed green because the page is
  horizontally clipped by design. Verified-applied is necessary and not sufficient.
- `SPEC-WAS-AMBIGUOUS` on §1: "the three entries stay" was incompatible with "convert the
  predicate to a gating test" — following both would have exempted two files from the new
  test by membership.
