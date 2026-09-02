---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260901-M6cshot
branch: claude/new-session-czzwi0
status: in_progress
written_by: claude-code (manual mode — task arrived as a prompt)
owner: claude-code
---

# p4·M6c-shot — THE EIGHTH PEER'S IMAGE, WHICH #205 COULD NOT FETCH

## 1 · GOAL
The Cake Wallet brief on `/operate/peers` renders Cupcake's own published
integration diagram as a same-origin `/peers/peer-cakewallet.webp`, with its
alpha channel preserved and PROVEN preserved, at a byte size inside the register
the other seven shots set, declared `kind: "artwork"` with no `captured` date.
One key added to one record; no stylesheet rule; no gate logic changed.

## 2 · CONTEXT
- Base: `1c5425e` = `main`, the merge of #205. The branch is at that commit.
- The source arrived as a conversation upload at 21:10, two minutes AFTER the
  session's first sweep of the uploads directory found only the brief. That is
  the time-axis lesson p4·M6b recorded, reproduced: an absence is scoped to
  when it was measured. Copied to the scratchpad as
  `cake-cupcake-two-phones-ORIGINAL.webp`, 285,558 B,
  sha256 `12165bace522c55c0b0656e34d59b9ed44d2a4920dca5fc6df57db9a2a42cf97`.
- Brief's own measurement of the source: 1289×1787 RGBA, 19.6% fully
  transparent, 6.2% partial, 74.2% opaque, all four corners (0,0,0,0).
  Re-measured here through Chromium before anything was converted (§7).
- `EcoShot` is a discriminated union (`data.ts:186`); `kind: "artwork"` carries
  no `captured` and a date on it is TS2353. `w`/`h` are required intrinsic
  pixels and must come from the SHIPPED file, not the original.
- `EcoPopup.tsx:312` gives the `<img>` an explicit `background: var(--bg-2)`
  and a 1px `--rule` border, so a transparent image sits inside a bordered
  dark box rather than floating on the panel — relevant to the judgement the
  brief asks for at 1440 and 390.
- No image library exists in this sandbox (no PIL, numpy, cwebp, ImageMagick).
  Conversion is Chromium canvas + `toDataURL("image/webp", q)` via Playwright,
  the path p4·M6c used for Kathie's artwork. A default 2d canvas is
  alpha-enabled; nothing pre-fills it.
- Relevant files: `app/src/pages/future/data.ts` (cakewallet record at ~:1454),
  `app/public/peers/`, `app/verify-peers.mjs` §1 §9 §11 §11b,
  `app/verify-origins.mjs` §2, `app/verify-bundle.mjs`, `app/src/data/siteVersion.ts`.

## 3 · SCOPE
IN: `app/public/peers/peer-cakewallet.webp` (new) · `app/src/pages/future/data.ts`
(ONE key on the `cakewallet` record) · `app/src/data/siteVersion.ts` (SITE_PR) ·
`handoffs/LOG.md` · this handoff · `app/verify-bundle.mjs` comments ONLY if a
ceiling is crossed (not expected).
OUT (non-goals): `EcoPopup.tsx`, any stylesheet, any gate's assertions, any other
`ECOSYSTEM` entry, any fetch attempt against the Cake Wallet hosts (the brief
forbids re-attempting; the file is supplied).

## 4 · CONSTRAINTS
- Stack: React 18 / Vite 5 / TS strict; gates are Playwright + Chromium at
  `/opt/pw-browsers`. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` — never `playwright install`.
- Alpha MUST survive the conversion: no JPEG intermediate, no RGB convert, no
  pre-filled canvas. Proven by decoding the SHIPPED bytes and reading alpha.
- `kind: "artwork"`, NO `captured` key. `src` under `/peers/peer-<id>.webp`
  (verify-peers §9 keys the caption's kind on the src stem = entry id).
- No stylesheet rule (cssGz margin 414 B). No change to `EcoPopup`.
- `logMax ≤ SITE_PR ≤ logMax + 1` against `handoffs/LOG.md` (verify-releases).
- Budgets: `public/` assets are in no chunk closure; only the `alt` string
  lands in `data.ts` → the `repoPulse` chunk → lazy/total and three routes.

## 5 · DONE-CRITERIA  — the gate reads ONLY this section
- [ ] `app/public/peers/peer-cakewallet.webp` exists, is WebP, ≤ 100,000 B, and
      decoding it through Chromium reads alpha 0 at all four corners with a
      reported transparent-pixel percentage
- [ ] `data.ts`'s `cakewallet` record gains exactly one key (`shot`) with
      `kind: "artwork"`, no `captured`, and `w`/`h` equal to the shipped file's
      decoded `naturalWidth`/`naturalHeight`; `npm run typecheck` exits 0
- [ ] `node verify-peers.mjs` against the served build: 0 failed, with §1's
      nine-PARTNER assertion, §9's biconditional (7→8 briefs declaring a shot)
      and §11/§11b all green
- [ ] `node verify-origins.mjs`: 0 failed, "declares a screenshot for 8 of the 9"
- [ ] `npm run verify:static` exit 0 · `npm run verify:e2e` all 39 members run
      (recorded exit read, not the pipeline's), 0 failed
- [ ] `node verify-bundle.mjs` 0 failed; the five figures reported with the
      `alt` string's cost attributed byte-exactly against the isolated base build
- [ ] `SITE_PR` = logMax + 1 at commit time; the LOG line is in the same commit
- [ ] Break test recorded: alpha flattened onto white → which gates notice (or none)
- [ ] Judgement recorded: cut-out beside seven rectangles at 1440 and 390
- [ ] Branch pushed · draft PR opened via the GitHub MCP

## 6 · VERIFY COMMANDS
```
cd app && npm run typecheck
cd app && npm run build
cd app && node scripts/serve-dist.mjs 4173 &   # then:
cd app && node verify-peers.mjs && node verify-origins.mjs && node verify-bundle.mjs
cd app && npm run verify:static
cd app && set -o pipefail; npm run verify:e2e 2>&1 | tee ../e2e.log; echo E2E_EXIT=$?
```

## 7 · REPORT  — claude code fills this on exit, completely
status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK  — cowork appends here when verify (step 04) fails
