---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260804-16
branch: claude/post-merge-defects-v6-u1rns4
status: in_progress          # open -> in_progress -> done | blocked
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

## 7 · REPORT — filled on exit, completely

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

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

### Process note for the next revolution

Rule 7 ("never rebuild while `serve-dist` is serving") was violated once. The
PID captured from `$!` was a wrapper, `ss -ltnp | grep -oP 'pid=\K[0-9]+'`
returned empty on this box, and the kill silently hit nothing — so a rebuild ran
against a live server. Recovered without loss because `serve-dist` reads from
disk per request, and **verified rather than assumed**: the §0b idiom (entry
chunk resolved from `dist/index.html`, bytes compared against the wire) confirmed
identical. Use `ps -eo pid,cmd | grep 'scripts/serve-dist.mjs'` to get the PID;
`$!` and `ss -ltnp` both proved unreliable here.
