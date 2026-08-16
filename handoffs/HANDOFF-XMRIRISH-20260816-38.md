---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260816-38
branch: claude/prompt-attached-8fdjhd
status: in_progress        # open -> in_progress -> done | blocked
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

- [ ] `npm run build` exits 0 and emits `dist/operate/superstress/index.html`
- [ ] `sitemap.xml` carries 14 urls (was 13)
- [ ] `node verify-ia.mjs` passes — routes↔ia agree in both directions with the new route
- [ ] `node verify-bundle.mjs` passes: 14 routes each map to exactly one chunk; the new
      route has a `PAGE_MODULE` entry and a `ROUTE_BUDGET_GZ` row; chunk count inside
      its band after a re-centre that preserves ±4
- [ ] `node verify-peers.mjs` passes unchanged (its `data.ts` PARTNER parse survives)
- [ ] `node verify-future.mjs` passes — §15 green with the new page's copy in its sweep
- [ ] the new gate passes, and every NEW assertion in it has a two-polarity execution
      transcript (a state that passes and a state that fails, actuals for both)
- [ ] `npm run verify:static` exits 0
- [ ] `npm run verify:e2e` exits 0
- [ ] the hub renders at 1440 and 390 with 0 px horizontal overflow and 0 sub-12px HTML
      text nodes; reduced motion shows 0 running animations and loses no information
- [ ] every cross-link href on the page resolves to a real route or a real anchor,
      machine-checked
- [ ] branch pushed · draft PR opened · `mergeable_state` reported

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

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
