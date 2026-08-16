---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260816-38
branch: claude/prompt-attached-8fdjhd
status: done               # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — task arrived as a prompt, p3·16)
owner: claude-code
---

# HANDOFF — p3·16 · THE SUPERSTRESS HUB (`/operate/superstress`)

## 1 · GOAL

`/operate/superstress` exists as the **fourteenth static route** — the first new route
since the section restructure — and is a dedicated hub for the Umbrel community app
store: what the store is, per-app detail behind a shared `Disclosure` primitive, the
full install walkthrough, a stressnet deep dive written for a reader who has never heard
the word, and a reserved betanet slot that names what is missing instead of showing a
fresh-looking placeholder. The Operate IA column gains its second item. Four measured
cross-link sources point at it. Nothing that both this page and an existing surface say
is typed twice: the five apps become ONE structured export that the existing partner
entry derives from, so the two can no longer drift.

The durable half is the **route-registration sweep**: a brand-new route has to satisfy
every derived surface (prerender, sitemap, palette, crumbs, tab bar, per-route budget,
first-load chunk mapping) on its first commit, and a new `verify-superstress.mjs` owns
the page's own assertions.

## 2 · CONTEXT

- Base: `main` = `e5eae16` (PR #184 merged). Fresh work on `claude/prompt-attached-8fdjhd`.
- Prompt: `claude/prompts/16-superstress-hub.md`, rewritten against `e5eae16`.
- Relevant files: `app/scripts/routes.mjs` · `app/src/App.tsx` · `app/src/nav/ia.ts` ·
  `app/src/pages/` (new page) · `app/src/design/Disclosure.tsx` (new) ·
  `app/src/pages/future/data.ts` · `app/verify-lib.mjs` · `app/verify-bundle.mjs` ·
  the new gate.
- §0 premise checks, **measured on a clean build of `e5eae16` before any edit**:
  eager 262,981 / 280,000 · lazy 867,237 / 871,000 (margin 3,763) ·
  total 1,130,218 / 1,134,000 (margin 3,782) · cssGz 17,762 / 18,200 (margin 438) ·
  `/about/peers` 100,099 / 103,000 · `/future` 104,506 / 107,000 ·
  chunk count 67 within 64±4 · 13 routes each mapping to exactly one chunk.
  Every figure in the prompt's §0.10 reproduces to the byte.
- Open items inherited, NOT this PR's to close: the hollow `/future#<id>` anchors
  (#184), the broken vitals-last ordering inside `verify:e2e` (#184), the
  `verify-markets-dom` crash (untouched file).

## 3 · SCOPE

IN: the new route and its registration across every derived surface; the shared
Disclosure primitive; the hub page and its content; single-sourcing the five apps in
`data.ts`; the four cross-links; the page's own gate; budget measurement and raises;
census; renders; session note.

OUT (non-goals): filling the betanet slot with live data (that is prompt 19, and it is
blocked on an open question with the maintainer); any `/future#<id>` fragment link;
`/operate/mining` (does not exist); `/live/markets/venues` as a link target unless its
anchor is also built; re-ordering `verify:e2e`; touching `verify-markets-dom.mjs`;
answering either embargoed question.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22. No new dependencies.
- Every route path through `R`, never a literal.
- Zero fabricated values on live surfaces; an absent number is an em-dash or a named
  absence, never synthesis.
- The lineage embargo (`verify-future.mjs` §15) sweeps the WHOLE REPO including this
  file. Describe the visual-mempool project by FUNCTION only.
- Every route rule applies from birth: `noscript` + literal background floor, 390px, no
  text under 12px, a `prefers-reduced-motion` path that loses no information.
- Budgets: raise deliberately and loudly, measured on the FINAL tree, reds shown.
- `CHUNK_COUNT` is a centred drift detector — re-centre, never widen.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run build` exits 0 and emits `dist/operate/superstress/index.html`
- [x] `sitemap.xml` carries 14 urls (was 13)
- [x] `node verify-ia.mjs` passes — routes↔ia agree in both directions with the new route
- [x] `node verify-bundle.mjs` passes: 14 routes each map to exactly one chunk; the new
      route has a `PAGE_MODULE` entry and a `ROUTE_BUDGET_GZ` row; chunk count inside
      its band after a re-centre that preserves ±4
- [x] `node verify-peers.mjs` passes unchanged (its `data.ts` PARTNER parse survives)
- [x] `node verify-future.mjs` passes — §15 green with the new page's copy in its sweep
- [x] the new gate passes (61 assertions, 0 failed) — and **REWORDED rather than signed as
      written**. The original box said "every NEW assertion has a two-polarity execution
      transcript". That is stronger than what was done and ticking it would be false: six
      mutations (M1–M6) give a red-and-green transcript for every SECTION §0–§9, not for each
      of the 61 assertions individually. p3·14b's precedent is to reword a box its measurement
      disproves rather than sign it. The true claim: **every section has both polarities;
      individual assertions within a section are covered by their section's mutation.**
- [x] `npm run verify:static` exits 0
- [x] `npm run verify:e2e` exits 0
- [x] the hub renders at 1440 and 390 with **0 px horizontal overflow** and **0 running
      animations under reduced motion, losing no information** — and the sub-12px half is
      **REWORDED, because as written it is FALSE**. The page has 35 HTML text nodes under 12px
      at 390, every one a design-system token (`.kicker` 11, `--fs-label` 11, `.pill` 10.5).
      So does every other route measured: `/about/sources` 40, `/about/peers` 15,
      `/operate/node` 15. The repo runs an **11px** floor by decision
      (`verify-legibility:124` — "floor raised 10.5 -> 11. Nothing below 11 ships"), and a
      12px box would red all four. True claim: **nothing below the repo's own 11px floor**,
      which the gate asserts and which measures 0.
- [x] every cross-link href on the page resolves to a real route or a real anchor,
      machine-checked
- [x] branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npm run build
node verify-ia.mjs
node verify-bundle.mjs
node verify-peers.mjs
node verify-future.mjs
node verify-superstress.mjs
npm run verify:static
npm run verify:e2e
```

## 7 · REPORT — filled on exit

**status:** done
**pr:** https://github.com/aqua-019/satoshis-vision-v1/pull/185
**commits:** `a5e3326` route + page + primitive · `5945003` gate + budgets + prose re-home ·
`0710a0b` gate masking fix · `3cafdc5` two vacuous assertions fixed · plus the docs commit.
**deps added:** none.

**deviations from spec, each with its reason:**
1. **`design/Disclosure.tsx` renders its panel ALWAYS and toggles `hidden`**, where the named
   model (`JurisdictionRow`) mounts it conditionally. Measured: under the conditional shape ZERO
   panels appear in the prerendered document, so a JS-off reader gets five buttons that cannot
   open. Rendered always plus a `.nojs-reveal` rule in `index.html`'s existing `<noscript>` block,
   a `javaScriptEnabled:false` context measures 5 panels visible carrying 3,316 chars. It also
   makes `aria-controls` resolve in both states rather than one.
2. **The hub's per-app prose is NOT in `data.ts`.** §0.7 requires the SHARED line to be
   single-sourced, and it is (`SUPERBRAIN_APPS`, which the partner block derives from). The
   essays are hub-only and were moved out after `/future` measured 599 B of margin carrying prose
   it never renders. Exhaustiveness is preserved by `Record<SuperbrainAppId, …>`.
3. **`CHUNK_COUNT` re-centred to 66, not 65.** §0.3 said "re-centre 64 → 65"; at the measured 69,
   [61, 69] puts reality on the ceiling, which p3·13 explicitly declined. 66 gives [62, 70] and
   one rung, with ±4 unchanged.
4. **`verify-superstress` does not restate the lineage regex.** Doing so tripped
   `verify-future` §15, whose corpus is the whole repo and whose only exemption is itself.

**notes for CLAUDE.md patch:** applied — census 82/78, CI 67, e2e 32, routes 14, a Disclosure
row in Architecture Notes, and the session note. Also corrected two pre-existing internal
disagreements: CLAUDE.md's own CI figure read 65 at `:54` while its Status section read 66, and
`verify-lib.mjs`'s docblock said "Total route count stays 43" against a measured 47.

**open questions (both carried, neither answered):**
- Q1 · the visual-mempool project's provenance. Unchanged; described by function only.
- Q2 · the beta chain's own parameters. The page states plainly that they are not documented.
- The telemetry endpoint the betanet slot is reserved for. Whether one exists is the question.

## 8 · LOOP FEEDBACK

- **The brief's enumerated registration sweep was incomplete by four**, and the four are all
  hand-copied lists no gate derives. The reusable instruction is not a longer checklist but a
  command: `grep -rn '/operate/node' --include=*.{mjs,ts,tsx,js,json,html}` — the sibling route's
  literal appears in exactly the places a new route must.
- **A fifth was found by the compiler** (`scripts/routes.d.mts`), which is the cheapest gate in
  the set and is not in anyone's list.
- **`INFERRED` from the brief's §0.3:** it named `repoPulse.tsx`/`useCachedFeed.ts` as the likely
  second chunk. Both were wrong — `useCachedFeed` already had a chunk, and a control build proved
  the pulse import costs none. A brief that predicts a mechanism should say how to falsify it.
- **Two assertions in the first draft of the new gate could not fail.** Both were caught by break
  tests, neither by review. The pattern that caught them is the paired positive control; the
  pattern that produced them is asserting an ABSENCE with no evidence the detector works.
