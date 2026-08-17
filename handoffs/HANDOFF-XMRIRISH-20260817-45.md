---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260817-45
branch: claude/prompt-attached-1nimvw
status: in_progress        # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — task arrived as a prompt, p4·04)
owner: claude-code
---

# HANDOFF — p4·04 "HOW TO MINE": RandomX, the CPU thesis, and four honest walkthroughs

## 1 · GOAL

A FIFTEENTH static route, `/operate/mine`, sitting beside "Run a node" in the OPERATE
section: why Monero mining is CPU-first and hyper-decentralized, and how to actually do it
on Windows, Linux, macOS and Android — each walkthrough complete on its own, every command
line through the in-repo `Cmd` copy component, every claim inside the honest-data doctrine.

The operator's thesis is the page's spine: **CPU-focused mining with RandomX is simple,
hyper-decentralized, and open to almost any practical device with a CPU — forever.** The
page argues it in plain language, states the solo / p2pool / hosted-pool decentralization
gradient honestly (hosted pools centralize; the page recommends P2Pool and says why), and
carries a house-style decentralization visual — many small equal nodes, no privileged
centre — with a reduced-motion still that loses no information.

A new route is the expensive half. The settled registration sweep is TEN-plus surfaces,
four of which are hand-copied lists no gate derives; p3·16 found a tenth only because
TypeScript refused to compile. This handoff treats the sweep as the deliverable and the
page as the payload.

## 2 · CONTEXT

- Base: `main` = `origin/main` = **`fdb105e`** (the p4·03 merge). Branch cut from it,
  tree clean at start.
- Prompt: p4·04 how-to-mine (attached, `d69c16c1-p404mineguide.md`).
- Relevant files: NEW `app/src/pages/OperateMinePage.tsx` · `app/scripts/routes.mjs` +
  `routes.d.mts` · `app/src/App.tsx` · `app/src/nav/ia.ts` · `app/index.html`
  (`#boot-fallback`) · `app/verify-lib.mjs` · `app/verify-nojs.mjs` ·
  `app/verify-pageshell.mjs` · `app/verify-ia.mjs` · `app/verify-bundle.mjs` ·
  `app/src/data/siteVersion.ts` · `handoffs/LOG.md`.
- Prior art to AGREE with, never fork: `NodePage.tsx`'s `Cmd`; `SuperstressPage.tsx`'s
  `MINER_CMD`, itself derived from `pages/future/data.ts`'s Superbrain `blocks[]`;
  the legality matrix's `mine` axis (`pages/monero/legality/data.ts`); every existing
  RandomX sentence in the tree.
- CLAUDE.md rules that bear directly: honest-data doctrine (a live number is real or it is
  an em-dash); `Math.random()` only in `src/protocols/`; the p4·02 touch type floor
  (≤720px is a 12px hard minimum); device-neutral copy; lazy-leaf chunking.

## 3 · SCOPE

IN: the new route and its full registration sweep; the page; the visual; the budget
raises the mint forces; the gate edits the sweep implies; two-polarity break tests on every
new or modified assertion; SITE_PR bump; session note; LOG line; draft PR.

OUT (non-goals): any change to `/operate/node`, `/operate/superstress`, or the legality
matrix beyond adding a link TO them; restating the RandomX protocol explainer that already
lives in `mempool/tx-detail.tsx`; any earnings estimate or invented hashrate; any RandomX
2.0 parameter, date or performance claim (link the upstream repo, assert nothing); any new
third-party network egress (CSP is `connect-src 'self'`); the standing open items this PR
does not own (the vitals-last e2e question is untouched; the ten hollow `/future#<id>`
anchors; `verify-sims`' orphan status).

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict. Edit `app/src/**`; no hand-edited HTML except
  `app/index.html`'s `#boot-fallback` list, which is hand-kept by design.
- Zero fabricated values on any live surface. If the page shows network hashrate it comes
  from the EXISTING `/api/xmr` pipe with its provenance badge, or it does not ship.
- `Math.random()` is banned outside `src/protocols/` — the visual's randomness is
  `design/prng.ts`, seeded, and is strictly VISUAL, never rendered as a number.
- `prefers-reduced-motion` gets a static frame that loses no information; reserved
  dimensions, zero CLS; ≥12px rendered text at 390.
- No new dependency. No new stylesheet rule unless `cssGz`'s 450 B margin allows it,
  measured.
- Do not touch: `api/**`, `vercel.json` (no redirect source — the URL has never existed),
  `relay/**`.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `/operate/mine` is in `R`, in `ROUTES`, in `routes.d.mts`'s `RouteMap`, and served
      by an `App.tsx` `<Route>` — and `dist/operate/mine/index.html` exists after build
- [ ] `dist/sitemap.xml` carries exactly **15** `<url>` entries
- [ ] `ia.ts`'s OPERATE column holds 3 items, "Run a node" still first
- [ ] `app/index.html`'s `#boot-fallback` lists the new route
- [ ] `npm run verify:static` exits 0 (22 members)
- [ ] `npm run verify:e2e` exits 0 (34 members) against `scripts/serve-dist.mjs`
- [ ] `node verify-bundle.mjs` exits 0, with a NEW `/operate/mine` row set from the
      measured first-load + a 2–4k margin, and every raised ceiling red-then-green
      demonstrated on the FINAL tree
- [ ] `node verify-mobile.mjs` exits 0 — the new route included automatically via its
      ROUTES import — with 0 sub-12px rendered text and 0 overflow at 390
- [ ] `node verify-ia.mjs` §1's count/order assertions proven TWO-POLARITY: dropping the
      ia entry REDS with a named failure; restoring it GREENS
- [ ] `node verify-nojs.mjs` exits 0 with `/operate/mine` in its path list
- [ ] `node verify-prng.mjs` exits 0 (no `Math.random()` in the new page or its visual)
- [ ] `node verify-legibility.mjs` exits 0 (no sub-14px inline `fontSize` literal)
- [ ] `node verify-reduce.mjs` exits 0 — 0 running animations and 0 SMIL under
      `prefers-reduced-motion` on the new route
- [ ] Census RECOUNTED (never incremented) with the counting script CONTROLLED against at
      least two historical commits that reproduce their recorded figures EXACTLY
- [ ] `SITE_PR` = 192 and `verify-releases.mjs` exits 0
- [ ] Renders captured and LOOKED AT: 1440, 390, and reduced-motion — all four platform
      blocks, the visual, the cross-links
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npx tsc --noEmit
npm run build
node verify-bundle.mjs
npm run verify:static
node scripts/serve-dist.mjs &        # one port, one build — never race dist/
npm run verify:e2e
node verify-mobile.mjs
node verify-ia.mjs
node verify-nojs.mjs
node verify-prng.mjs
node verify-legibility.mjs
node verify-reduce.mjs
node verify-releases.mjs
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

<none yet>
