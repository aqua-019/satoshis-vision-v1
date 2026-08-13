---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260812-28
branch: claude/orbital-nav-visibility-uh011f
status: done
written_by: claude-code (manual mode — task arrived as a prompt p2·7b, no mockup)
owner: claude-code
---

# HANDOFF — p2·7b NAV: one authoritative mempool view list

## 1 · GOAL

`orbital` — the seventh mempool view, shipped in #174 — is reachable from every
nav surface, and the mechanism that hid it cannot recur. Today it appears in
NONE of them: the LIVE mega-menu reads "MEMPOOL · 6 VIEWS" and lists six, the
⌘K palette lists six, and the same is true of the tab bar, prefetch and
breadcrumbs, because all of them read `src/nav/ia.ts` — which carried a
HAND-COPIED list of six view ids plus a second literal, `h: "Mempool · 6
views"`. The view was reachable only from the on-page switcher (which derives
from the registry, and was therefore correct) and from a typed `?v=orbital`
URL.

The fix is structural, not a seventh entry: one authoritative list, derived
everywhere, with a gate that pins it in both directions — so the four
remaining Phase 2 views inherit the fix instead of quadrupling the defect.

## 2 · CONTEXT

- `main` = `0f52a21` (PR #174 merged: Orbital, `verify-tracking`,
  `verify-memstats`, a loud budget raise).
- Defect sites: `src/nav/ia.ts:87-94` (the copy) and `:126` (the count).
  `ia.ts`'s own header at `:39-41` warned the copy "can drift if the source
  changes without this file being updated too". It drifted on the first view
  added after that warning was written.
- The wall that forced the copy is real and documented at `ia.ts:31-33`:
  `views/index.tsx` is a `.tsx`, and Node's native TS type-stripping does not
  support that extension AT ALL. `verify-ia.mjs` imports `ia.ts` under bare
  Node, so `ia.ts` structurally cannot import the registry.
- The repo already owns the cure: `views/protocol-meta.ts` is pure metadata
  split from a component registry, re-exported for bare-Node reach through
  `nav/registries.mjs`.
- No gate saw it: `verify-ia` checks ia against ROUTES, and every view leaf
  strips to the same `/live/mempool`; `verify-nav` §6 checks the on-page
  switcher, which derives from the registry.

## 3 · SCOPE

IN: extract the component-free view metadata to a bare-Node-importable
module; derive `MEMPOOL_VIEWS`, ia's list and ia's count from it; a
both-directions parity gate in `verify-ia.mjs`; re-point the gates that parse
the old location; a decommented `src/`-wide sweep for other hand-kept view
lists and count literals; budget quoted at both endpoints; rendered proof.

OUT (non-goals): `ia.ts`'s `FUTURE_PROTOCOL_META` / `ECOSYSTEM_META`
hand-copies (same class, no drift yet — curing them means giving
`pages/future/data.ts` the same split, its own change); the four remaining
Phase 2 views; any budget-ceiling change; stale PROSE counts outside the files
restructured here (reported, not fixed).

## 4 · CONSTRAINTS

- The new module MUST load under bare Node: no `@/` aliases, no `.tsx`
  imports transitively, no React.
- Vite needs a static string literal in each `import()` or the seven engines
  collapse into one glob chunk, undoing v6.0.8's code-splitting.
- All three budget ceilings stay untouched: eager 280,000 · lazy 736,000 ·
  total 1,000,000. Lazy had **2,228 B** of margin at `0f52a21`.
- Zero fabricated values; the count is derived or it is not shipped.

## 5 · DONE-CRITERIA

- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0
- [x] Exactly ONE list of mempool view ids exists in `src/` (decommented,
      exact-token sweep, scope stated)
- [x] `ia.ts` contains no view id literal and no view count literal
- [x] `verify-ia` asserts registry↔ia parity in BOTH directions, exactly-once,
      the header count against the registry side, and the component binding
- [x] Two-polarity transcript per new/modified assertion, mutation proven
      applied AND effective, trap-owned restore verified clean
- [x] Three budget lines quoted at both endpoints; any eager delta attributed
      to the byte
- [x] `npm run verify:static` exits 0 (21 gates)
- [x] `npm run verify:e2e` exits 0 (29 gates)
- [x] `verify:fit` · `verify:mobile` · `verify:perf-runtime` ·
      `verify:tracking` · `verify:memstats` exit 0
- [x] Rendered proof: mega-menu and ⌘K palette each showing seven views
      including Orbital, header reading 7, LOOKED AT
- [x] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npx tsc --noEmit
npm run build && node verify-bundle.mjs
npm run verify:static
node scripts/serve-dist.mjs &
npm run verify:e2e
npm run verify:fit && npm run verify:mobile && npm run verify:perf-runtime
npm run verify:tracking && npm run verify:memstats
```

## 7 · REPORT

status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/175 (draft)
commits: f3ec828 (extraction + §7b + six gates) · 3c96afa (census recount +
  architecture row + styles.css reflow comment) · b9fd98b (home/sections prose)
  · e857ad1 (vacuity claim corrected to what was measured) · 90ce2c7 (§7/§8/LOG)
  · 91404b3 (RIDER: scenario 7 settles on a derived scale)
deps added: none
deviations from spec:
  - The brief's break test ("remove one view from the metadata -> verify-ia
    reds item and count") does not apply to a DERIVED design. Removing a view
    from the metadata keeps ia and the registry in sync, so those two stay
    green and the COMPONENT-BINDING leg reds instead (M2). The mutation that
    reds item + count is re-hardcoding ia's list (M1) — the actual #174 defect.
    Both measured; the full six-mutation matrix is in the PR body.
  - The brief said `home/sections.ts` "imports the registry so it should be
    derived already". It derives from IA, not the registry, so it was
    transitively wrong (rendering 6) and self-corrects with no code edit.
  - Scope grew by six gate files, unavoidably: all six parse the view list out
    of `views/index.tsx` with one shared regex, so extraction forces a
    re-point. Four sweep the list and needed non-vacuity floors.
  - RIDER TAKEN (operator-approved, out of the original brief's scope):
    verify-memviews scenario 7's settle poll. PR-172 filed a sentinel to ride
    the next verify-memviews change; this was that change, and the flake
    recurred on the verifier's clone as `canvas scale 0.9999`. Poll now takes
    verify-fit:199's 120ms pre-wait, PR-172 §5's give-up sentinel, and
    converges on a DERIVED expectation, min(1, canvasW/naturalW), instead of
    on two agreeing reads. Gate-only; no src/ file touched, so no byte moves.
notes for ARCHITECTURE.md patch:
  - CLAUDE.md Architecture Notes gained a "Mempool views (canonical list)" row:
    `app/src/views/mempool-meta.ts`, pure data, imports nothing; index.tsx binds
    components via `Record<MempoolViewId, ViewComponent>`; ia.ts derives list
    AND count through `nav/registries.mjs`; SIX gates parse its source text.
  - Census recounted: 75/71 -> 77/73 files/gates; CI-reached 62 of 73; 4
    npm-only; 7 true orphans.
open questions:
  - `ia.ts`'s `FUTURE_PROTOCOL_META` (5) and `ECOSYSTEM_META` (4) are the same
    defect class, undrifted. Curing them means giving `pages/future/data.ts` the
    same pure-data split — its own change, named in the PR body.
  - 11 stale PROSE view-counts remain across 8 files (listed in the PR body),
    deliberately unfixed to keep this single-subject.
  - `verify-memviews` indexes `VIEWS[0]` outside its sweep loop; on an empty
    list that crashes with `data-mem-view="undefined"` instead of asserting.
    The floor now names the real cause, but the out-of-loop index is still there.
  - The scenario-7 comment's historical numbers are all UNSETTLED values —
    passes at 0.8326/0.9768/0.9999 and fails at 0.9135-0.9139 against a settled
    0.359756. The old poll never distinguished settled from unsettled; it
    distinguished "unsettled where the click still landed" from "unsettled
    where it did not". Recorded in the gate; no further action taken.
  - verify-memviews' assertion count still varies run to run (211/211/210 on
    three runs of one tree tonight), the variance CLAUDE.md already notes.

## 8 · LOOP FEEDBACK

- 2026-08-12 · QUESTION the brief could not answer from its own text: which
  file is "the registry side" for the parity assertion, once the registry is
  split? Resolved by measurement — six gates already parse `views/index.tsx`,
  so the answer had to be the file that keeps the id literals.
- 2026-08-12 · INFERRED (not stated by the brief): that extraction is a
  SIX-GATE change; that four of those gates sweep the list and so fail OPEN
  rather than closed; that `home/sections.ts` derives from IA rather than the
  registry; that the LIVE section badge is a fourth silently-wrong consumer.
- 2026-08-12 · SPEC-WAS-AMBIGUOUS: the brief's prescribed break test presumed a
  non-derived design. Reported rather than silently substituted.
- 2026-08-12 · MY OWN OVERSTATEMENT, caught by running it: I claimed all four
  sweeping gates would go vacuously green. Measured: two do (memperf, tracking),
  memstats has an independent guard, memviews crashes. Corrected in e857ad1.
  The lesson is the PR's own subject — a claim whose subject was wider than
  what was measured — and it was written into a commit message before it was
  checked.
- 2026-08-12 · MY OWN SWEEP'S BLIND SPOT: the first count-literal regex required
  the numeral adjacent to "views" and missed "5 switchable views". Widened.
- 2026-08-12 · Gate rounds: 0. No GATE: FAIL round was needed; every gate was
  green on first full run after the change.
- 2026-08-12 · MY OWN BREAK-TEST METHOD FAILED ONCE, and the repo's own rule is
  what it violated: I ran the rider's two-polarity script with a trap-owned
  `git checkout --` restore while the rider itself was still UNCOMMITTED, so
  the restore wiped the work and the "+ polarity" run measured the PRE-rider
  gate. Caught because the settled-line grep came back empty on a run that
  should have printed it. Re-applied, COMMITTED FIRST, then re-tested. The rule
  is in CLAUDE.md already ("restoring is not done until the tree proves it");
  the corollary it did not spell out is that a trap-owned restore is only safe
  once the thing under test is in a commit.
- 2026-08-12 · A FIRST CUT OF THE RIDER WAS WRONG AND MEASUREMENT CAUGHT IT: it
  compared the canvas rect/clientWidth ratio, which LAGS the transform and is
  not exact, so it needed eps 0.005 — and the run then settled 0.0002 inside
  that bound. A tolerance a correct run barely clears is a red waiting for a
  slower machine, and a loose eps on a lagging quantity is an early exit by
  another name. Switched to `.mp-fit`'s DOMMatrix.a, which measures EXACT.
