---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260901-M6cshot
branch: claude/new-session-czzwi0
status: done
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
- [x] `app/public/peers/peer-cakewallet.webp` exists, is WebP, ≤ 100,000 B, and
      decoding it through Chromium reads alpha 0 at all four corners with a
      reported transparent-pixel percentage
- [x] `data.ts`'s `cakewallet` record gains exactly one key (`shot`) with
      `kind: "artwork"`, no `captured`, and `w`/`h` equal to the shipped file's
      decoded `naturalWidth`/`naturalHeight`; `npm run typecheck` exits 0
- [x] `node verify-peers.mjs` against the served build: 0 failed, with §1's
      nine-PARTNER assertion, §9's biconditional (7→8 briefs declaring a shot)
      and §11/§11b all green
- [x] `node verify-origins.mjs`: 0 failed, "declares a screenshot for 8 of the 9"
- [x] `npm run verify:static` exit 0 · `npm run verify:e2e` all 39 members run
      (recorded exit read, not the pipeline's), 0 failed
- [x] `node verify-bundle.mjs` 0 failed; the five figures reported with the
      `alt` string's cost attributed byte-exactly against the isolated base build
- [x] `SITE_PR` = logMax + 1 at commit time; the LOG line is in the same commit
- [x] Break test recorded: alpha flattened onto white → which gates notice (or none)
- [x] Judgement recorded: cut-out beside seven rectangles at 1440 and 390
- [x] Branch pushed · draft PR opened — via api.github.com, because the GitHub MCP answered `Bad credentials` twice (its third recorded instance)

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
status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/206 (draft)
commits: `eba7ad4` feat(peers): the eighth peer's image, alpha preserved and proven ·
  the docs commit carrying this §7 and the LOG's real URL
deps added: none. No image library exists in the sandbox (no PIL, numpy, cwebp,
  ImageMagick); conversion and every measurement went through Chromium's canvas
  via Playwright, the path p4·M6c used for Kathie's artwork.

### The file
- Source: conversation upload, 285,558 B, 1289×1787 RGBA WebP, sha256
  `12165bace522c55c0b0656e34d59b9ed44d2a4920dca5fc6df57db9a2a42cf97`. It arrived at
  21:10, two minutes after the session's first sweep of the uploads directory
  found only the brief — p4·M6b's time-axis lesson, reproduced by the release
  that quotes it. The brief said "do not re-attempt the fetch"; none was made.
- Chromium's census of the original reproduces the brief's Pillow census TO THE
  PIXEL: 450,558 transparent / 143,748 partial / 1,709,137 opaque of 2,303,443,
  corners (0,0,0,0). Two decoders, one answer, before any conversion.
- Shipped: `app/public/peers/peer-cakewallet.webp`, **660×915, 55,488 B**, sha256
  `d2d55995e7ee46a7ee281372903e8ad8f667d3d0b38a135f2b3752f8bc3d9321`. Decoded
  through Chromium: **all four corners (0,0,0,0)**, 118,643 fully transparent
  (**19.65 %**) · 38,243 partial (6.33 %) · 447,014 opaque (74.02 %).
- Alpha survived the encoder at EVERY quality: across 33 (width, q) candidates the
  decoded alpha plane matched the lossless reference on every pixel (max diff 0).
  A default 2d canvas is alpha-enabled; nothing pre-fills it.
- "Downscale without re-encoding" does not exist. The nearest thing — a lossless
  downscale (`toDataURL("image/webp", 1)`, which Skia encodes lossless; verified
  pixel-identical) — weighs 163,050 B at 620 wide, 3× the register. Lossy it is.
- Loss, one decoder both sides, opaque region only: **mean 1.049/255, max 41**
  against a same-size lossless downscale; 4.492/255 upscaled back to the
  1289×1787 grid, of which 4.038 is the resampling floor (a lossless downscale
  upscaled back scores that); 3.54/255 at the dpr2 render width (996 px).

### Why 660×915 at q 0.84
My encoder is not the brief's. Chromium at nominal q lands ~12 % under the
Pillow/libwebp method=6 references (620×860 q0.86 → 49,072 B here vs 55,782 in
the brief), so equal q is not equal quality. The criterion was fidelity at the
dpr2 render width under the register ceiling (≤ 55,798 B): 660 wide is the most
pixels that ceiling buys and sits 310 B under Kathie's maximum. 620 wide reads
softer at dpr2 (MAD 5.07 vs 3.54); 800 wide would be 76,580 B, a new maximum by
37 %, one regeneration away if the operator prefers pixels to bytes.
**AN INSTRUMENT WAS WRONG AND THE CONTROL CAUGHT IT**: MAD at the dpr1 render
width (498 px) scored a 645-wide candidate 0.74 against a LOSSLESS 800-wide's
2.37 — a near-exact 2× intermediate agreeing with Chromium's own mip path, not
a quality fact. The edge-share column and the upsampled rows decided it.

### Gates on the final tree (`eba7ad4`, dist stamped, served == disk)
- `npm run typecheck` 0 · `verify-bundle` 32 passed · `verify-releases` green
  (logMax 206, SITE_PR 206).
- `verify-peers` **72 passed · 0 failed**: §1 nine PARTNERs; §9 "8 of 9 briefs
  declare a screenshot", decoded `1000x625, 1133x879, 660x915`, caption
  "artwork · Cake Wallet's own", no date rendered, own intrinsic box; §11
  "8 real captions, 0 reservations"; §11b green. PAIRED against the base build
  in an isolated worktree served on port 4174 through a port-substituted copy
  of the gate: **72 passed there too**, "7 of 9". Count unchanged, derived
  subject moved — the correct outcome for a release that adds a shot and no
  assertion.
- `verify-origins` green: "declares a screenshot for 8 of the 9 rendered
  briefs", all 8 loaded and decoded.
- `npm run verify:static` exit 0, 0 reds.
- `npm run verify:e2e`, RUN TWICE — once on `eba7ad4` and again on the FINAL
  tree `5582011` after the caption fix. Both ran all 39 members with the
  recorded exit read off `PIPESTATUS`, never the pipeline's.
  · **`eba7ad4`: exit 0, 0 reds.** verify-coldboot 220 · verify-orb 217 + 1
    reasoned skip · verify-stream 17 · verify-vitals 15 passed · 4 skipped ·
    0 failed · verify-memphone 436 · verify-peers 72 · verify-superstress 90 ·
    verify-explorer 82 · verify-nav 129.
  · **`5582011`: exit 1 — 38 of 39 green, `verify-vitals` 15 passed · 2 skipped
    · 2 failed** (`/` blocking 413ms ≤ 400 and `/live/markets` LCP 4392ms ≤
    2600; `/learn/sim` declined at a 71.5 % run spread). verify-peers 72 and
    every other member green.
  **THE VITALS RED IS THE MACHINE, AND IT IS PAIRED RATHER THAN WAVED AT.** The
  untouched base `1c5425e`, built in its own worktree and served on its own port
  with the holder's cwd confirmed by `/proc`, is **ALSO exit 1 with the IDENTICAL
  tally — 15 passed · 2 skipped · 2 failed** — and worse on every metric the two
  trees both judged:

  | route · metric | base `1c5425e` | head `5582011` |
  |---|---|---|
  | `/` blocking | **435ms ❌** | **413ms ❌** (−22) |
  | `/` LCP | 2304ms ✅ | 2276ms ✅ (−28) |
  | `/live/mempool` blocking | **303ms ❌** | 254ms ✅ (−49) |
  | `/live/mempool` LCP | 3984ms ✅ | 3960ms ✅ (−24) |
  | `/live/markets` LCP | 4656ms (declined, "WOULD HAVE FAILED") | **4392ms ❌** (−264) |
  | `/live/markets` blocking | 418ms (declined, "WOULD HAVE FAILED") | 400ms ✅ (−18) |

  The head is BETTER OR EQUAL on all six. What moves between runs is WHICH route
  the gate's own contention guard declines as UNVERIFIABLE, which is a property
  of the runner — CLAUDE.md's recorded finding, reproduced here across two trees
  in one session. **Neither red route is reachable from this diff**: it touches
  `siteVersion.ts`, `EcoPopup.tsx` and `data.ts`, i.e. the `repoPulse` and
  `EcoPopup` chunks, and `/` and `/live/markets` load neither; `eagerJsRaw` is
  byte-identical at 264,457.
  **AND CI SETTLES IT.** The `hardening gates` job runs this same 39-member
  chain and reports **success on `bc39ba9` AND on `5582011`**, the final tree.
  CI is the calibrated environment; this sandbox is not.

### verify-frontend-change (the repo's own skill), steps 1-5
1-2 · Served build opened, the brief opened by its own `?p=cakewallet` address,
  image decoded at 660x915, caption "artwork · Cake Wallet's own".
3 · Console: **7 errors on head, 7 on base, the identical set** — `/api/coingecko`,
  `/api/feeds`, `/api/xmr/{blocks,fees,mempool,network,tip}` answered 501 by
  `serve-dist`, the documented degraded feed state. Zero NEW errors, zero
  warnings, zero page errors, zero failed requests.
4 · Responsive: 360x800@2 image 326x451 stacked below the prose, brief scroll
  1,804 px · 768x1024@2 image 734x1,017 stacked, scroll 1,817 px · 1280x800@1
  two tracks 597.8/498.2 px, image 498x690, dialog 736 px in an 800 px
  viewport — **0 px horizontal overflow at every width**. Plus 1440 (dpr 1 and
  2) and 390 (dpr 3) above.
5 · No `lint` or `test` script exists in `app/package.json` and no eslint config
  is present — N/A with reason; `typecheck`, the 22-gate static chain and the
  39-gate e2e chain are the project's checks and all ran.
The Vercel preview for this branch deployed ("Ready"), but the egress proxy
answers 000 for `*.vercel.app` as it does for `xmr.irish`, so the deployed
asset could not be fetched from here; not claimed.

### Budgets (final tree vs isolated base build of `1c5425e`, paired per stem)
eagerJsRaw **264,457 BYTE-IDENTICAL** · eagerJsGz 88,511 → 88,507 (**−4**,
compressibility only, raw unmoved) · cssGz **18,586 BYTE-IDENTICAL** (no
stylesheet rule) · lazyJsRaw 993,843 → 994,445 (**+602**) · totalJsRaw
1,258,300 → 1,258,902 (**+602**) · chunks 76 = 76 · /operate/peers 106,687 →
106,915 (+228 gz) · /operate/superstress 109,404 → 109,628 (+224) · /future
112,326 → 112,547 (+221). **74 of 76 chunk slots size-identical; TWO terms:
`repoPulse` 30,917 → 31,525 = +608, whose minified `shot:{…}` literal measures
607 B + its comma = 608, and `EcoPopup` 5,022 → 5,016 = −6, which is the
caption template getting SHORTER ("artwork · supplied by " is 22 chars of
literal, "artwork · " + "'s own" is 16). +608 − 6 = +602 = lazy's whole delta
and total's. Residual zero.** No ceiling raised or crossed.
THE RE-MEASURE RULE FIRED TWICE. The three route rows read +249/+249/+248
before the SITE_PR bump and +236/+236/+235 after it; the caption fix then moved
every figure again, and this table is the FINAL tree's. A one-term attribution
was true of the tree that existed when it was written and false two commits
later, with every ceiling green throughout — which is the whole content of the
rule: re-derive after the LAST src commit, not after the last green run.

### The break test — the finding
Shipped alpha flattened onto white (0 % transparent, corners (255,255,255,255),
39,662 B), mutation proven landed, rebuilt (build stamp checked), served
(server proven to be serving the mutated bytes), then every browser gate that
reaches the route or its assets: **verify-peers 72 passed · verify-origins all
passed · verify-future all passed · verify-mobile 59 passed · 1 skipped ·
0 failed.** NOTHING NOTICED. No gate in this suite reads a pixel of any shot;
the property that makes this image right is held by a comment in `data.ts`,
the LOG line and this report. Restored from the shipped bytes in a `finally`
(sha verified), rebuilt, served hash re-verified.

### The judgement, made out loud
DELIBERATE, and the alpha stays. `EcoPopup.tsx:312` gives the `<img>` a 1 px
`--rule` border and `background: var(--bg-2)`, so the cut-out sits in the SAME
frame the seven captures use, with the panel's ground around the phones — a
dark-mode product shot in a card beside xmr.club's edge-to-edge screenshot,
not a missing background. White would be a bright block in a dark UI; baking
`--bg-2` would match one theme and mismatch two (indigo #201E29, phosphor
#0F1C0F), which preserved alpha handles for free. The tall image, measured:
the brief is the tallest on the page — 828 px at 1440 (xmr.club 578, Kathie
779), fitting a 900 px viewport without internal scroll — and at 390 a
1,734 px scroll with the 356×493 figure 1,188 px down, below the prose
(2.05 viewports against xmr.club's 0.98), zero overflow. Recorded, not changed.

deviations from spec:
- CORRECTED — the brief's alt ended "the instruction to restore from Cake
  Wallet"; the phone on screen says "navigate to Wallets → Restore from
  Cupcake", the pairing direction the #205 record itself corrected once (its
  refuted claim 1). The alt says what is visible and names the part the front
  phone hides rather than completing it.
- ANNOTATED — "one key and nothing else" applied literally would have left the
  paragraph above the record saying "there is no `shot` key at all" directly
  above the key: p4·M6c's own recorded defect. Annotated as a record of #205 on
  p4·01's rule, not rewritten.
- CORRECTED, on the operator's call after the first push — the caption template
  read "artwork · supplied by <name>", true of Kathie (she sent her file) and
  FALSE of Cake Wallet (theirs was downloaded from the page they publish it on).
  This release first raised it as a caveat and shipped the wrong string. It is
  now `artwork · <name>'s own`, true of both: the delivery route is not in
  `EcoShot` at all, so no template keyed on `kind` could distinguish them, and
  what the caption actually asserts is AUTHORSHIP. Three sites — the template,
  verify-peers §9's pattern (now anchored at BOTH ends, so a caption that merely
  starts right cannot pass) and its failure message, and the union docblock.
  Read back off the render: "artwork · Cake Wallet's own" / "artwork · Kathie's
  own"; the capture arm is untouched at "captured 2026-08-18". Break test: the
  template reverted → 2 of 8 captions red (the 6 captures still matching),
  restored clean at 72 passed.
  AND THE BREAK HARNESS WIPED THE UNCOMMITTED FIX ON ITS FIRST RUN — p4·01's
  recorded trap. Its guard correctly refused to start (the file was dirty
  against HEAD, so a HEAD-restore could not be a restore) and its `trap … EXIT`
  ran that restore ANYWAY on the way out, checking out the copy that still held
  the old string. Re-applied, then COMMITTED BEFORE re-running: p3·12d's rule,
  and the only thing that makes `git checkout` a restore rather than a revert.
- The GitHub MCP answered `Bad credentials` twice; the PR was opened through
  api.github.com with the environment's token, as p4·M5 did for #202.

notes for ARCHITECTURE.md patch: none — no module, import, route or stylesheet
  rule changed. CLAUDE.md gets this release's session note.

open questions:
- Caption wording for published-not-supplied artwork (above).
- Bytes vs pixels: 800×1109 at 76,580 B is one regeneration away if the
  operator would rather the dpr2 reader got 0.80 of the pixels than 0.66.
- `verify-peers.mjs:42` hardcodes `localhost:4173` and ignores `VERIFY_BASE`;
  a base-side run against 4174 measured the head's server with the base's data
  file and reddened §9's biconditional for exactly the disagreement it exists
  to catch. Instrument limit, pre-existing, named not fixed.
- No human has seen the rendered result in a browser — read from screenshots
  at 1440 (dpr 1 and 2) and 390 (dpr 3), beside xmr.club and Kathie.

## 8 · LOOP FEEDBACK  — cowork appends here when verify (step 04) fails
