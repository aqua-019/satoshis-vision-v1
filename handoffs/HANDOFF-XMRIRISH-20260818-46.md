---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260818-46
branch: claude/xmr-irish-about-page-6upd6q
status: in_progress
written_by: claude-code (manual mode — the task arrived as a prompt)
owner: claude-code
---

# HANDOFF — p4·05 "ABOUT XMR.IRISH": /about/site, the clover overlay, the ethos brief

## 1 · GOAL
The About section gains the site's page about itself at `/about/site` — the
sixteenth route. Opening it plays a foreground glyph animation that coalesces
into a four-leaf clover, holds, and degenerates back into the stream, laid OVER
the normal page rather than cutting to another screen. Beneath it: the mission,
an overview derived from `nav/ia.ts`, the v4/v5/v6 lineage drawn only on the
repository's own records, the ethos brief with every claim cited to the
mechanism that enforces it, and the support section with the XMR IRISH Fund
link.

## 2 · CONTEXT
- Base: `768ba13` (the p4·04 merge).
- The registration sweep, the animation stack, the budget model and the
  phrasing embargo in `verify-future.mjs` §15 are the four premises this work
  had to re-measure rather than inherit.
- Relevant files: `app/scripts/routes.mjs`, `app/src/nav/ia.ts`,
  `app/src/pages/SitePage.tsx`, `app/src/pages/about/*`, `app/verify-site.mjs`,
  `app/verify-bundle.mjs`, `vercel.json`.

## 3 · SCOPE
IN: the new route and its full registration sweep; the overlay (field module +
host); the page and its six sections; a new DOM gate and its wiring; budgets;
the census recount.

OUT (non-goals): the operator's X handle (the brief's bracket arrived unfilled —
shipped as an honest null, never guessed); any edit to `verify-future.mjs`'s
embargo; the pre-existing hardcoded "6 sections" literal on HomePage; the
vitals-last e2e ordering.

## 4 · CONSTRAINTS
- React 18 · Vite 5 · TS strict · Node 22.
- Monero orange means crypto data, never decoration — the clover is `--g-50`.
- `Math.random()` only inside `src/protocols/**` — the field uses seeded `h3`.
- Zero new stylesheet rules (cssGz margin was 450 B at base).
- No third-party browser request, ever. The fundraiser is an ANCHOR.
- Do not touch: `verify-future.mjs`, `api/`, `relay/`.

## 5 · DONE-CRITERIA
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0 · 16 routes prerendered · sitemap 16 urls
- [x] `npm run verify:static` exits 0
- [x] `node verify-future.mjs` exits 0 — the phrasing embargo is intact
- [x] `node verify-bundle.mjs` exits 0 with the new route row set from measurement
- [x] `node verify-site.mjs` exits 0
- [x] `npm run verify:e2e` exits 0 across all 36 members
- [x] `node verify-mobile.mjs` exits 0 (the new route is swept automatically)
- [x] Ten break tests, each red where intended, each restore proven against the
      COMMITTED BLOB
- [x] Renders captured and READ at 1440, 390, mid-animation, formed, dissolved
      and under reduced motion
- [ ] Branch pushed · draft PR opened

## 6 · VERIFY COMMANDS
```
cd app
npx tsc --noEmit
npm run build
npm run verify:static
node scripts/serve-dist.mjs &            # confirm the holder with lsof, not ps
node verify-site.mjs
node verify-future.mjs
npm run verify:e2e
node verify-mobile.mjs
node verify-bundle.mjs
```

## 7 · REPORT
See the session note added to CLAUDE.md under 2026-08-18 (p4·05), and the PR
body. Headline findings recorded there: the sweep is THIRTEEN surfaces and the
settled list names twelve; three count literals were already stale at the base
commit; the overlay's one-constant import of the splash cost the route 40 KB
raw and five chunks; the overlay was being emitted into all sixteen prerendered
files; and break test M4 found a gate assertion whose subject was narrower than
its own label.

## 8 · LOOP FEEDBACK
- The brief's "ten carry a path literal, two do not" split does not match the
  tree: the sibling-literal grep reaches only SEVEN of the surfaces. The
  instrument that reaches the rest is a grep on the sibling ROUTE CONSTANT.
- The brief's premise that the curated release notes are byte-pinned by a gate
  is false — the gate pins their count and shape. The page's copy was corrected
  rather than the claim repeated.
- The brief's `verify-origins` claim ("fails the build if any route contacts a
  third party") overstated the browser phase, which drove seven routes. The
  copy was corrected AND the route was added to that gate.
- DEFERRED: the operator's X handle. One line (`OPERATOR_X`) when it arrives.
