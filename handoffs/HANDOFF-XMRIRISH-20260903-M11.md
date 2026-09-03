---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260903-M11
branch: claude/monero-thesis-mockup-y78sb8
status: done
written_by: claude-code (manual mode — task arrived as a prompt)
owner: claude-code
---

# HANDOFF — p4·M11 "/monero/thesis · the eighth tab"

## 1 · GOAL
`/monero` gains an eighth tab, `thesis`, between `attacks` and `bottomline`: a demand
thesis for Monero built as seven sourced pressures with a closing argument, ported from
the operator-approved mockup `p4-M11-thesis-MOCKUP.html`. Every figure names a source with
a publication date and every source is an openable permalink; every inference is labelled
as ours. The content returns an argument moved out of `/monero` in v6.1.6, rebuilt from
re-sourced measurement rather than restored — four figures in the original failed
verification and are cut or corrected.

## 2 · CONTEXT
- Base: `9847dfe` (merge of #210), clean tree, shallow clone (419 commits), branch already checked out.
- Spec: the attached mockup IS the spec. Port it; do not redesign it. Repo wins on conflict, and each conflict is recorded.
- `SITE_PR` 210 · `logMax` 210 → bump to **211**.
- Prior art: `pages/monero/MarketsThesisTab.tsx` (414 lines) stays where it is at `/live/markets/thesis` — this tab takes only its DEMAND_DRIVERS argument.

### 2.1 · MEASURED ON THE UNTOUCHED BASE — the brief's budget table is one release stale and its central premise is REFUTED

`npm run build && node verify-bundle.mjs` on `9847dfe`, 32 passed · 0 failed:

| budget | ceiling | brief said | **measured** | margin | brief error |
|---|---|---|---|---|---|
| eagerJsGz | 96,000 | — | 88,983 | 7,017 | — |
| eagerJsRaw | 280,000 | 264,457 | **265,706** | 14,294 | 1,249 |
| lazyJsRaw | 1,001,000 | 997,403 | **998,229** | 2,771 | 826 |
| totalJsRaw | 1,266,000 | 1,263,109 | **1,263,935** | 2,065 | 826 |
| cssGz | 19,500 | 19,011 | **19,011** | **489** | 0 ✓ |
| `/monero` | 115,000 | 104,154 | **113,862** | **1,138** | **9,708** |
| `/live/mempool` | 107,000 | 106,038 | **106,318** | 682 | 280 |
| CHUNK_COUNT | 74±4 → [70,78] | — | **77** | 1 rung | — |

**THE BRIEF'S §0′ ASYMMETRY DOES NOT EXIST.** It states: *"`/monero` has real room and `cssGz`
has almost none. That asymmetry decides the whole implementation: this page is allowed to be
heavy in JS and prose, and is not allowed to be heavy in stylesheet rules."* Measured,
`/monero`'s margin is **1,138 B**, not ~10,846 — and ranked against all 18 route rows it is the
**7th tightest**, not the roomiest. The roomiest is `/` at 8,017 B. Both halves of the framing
are wrong, and neither budget can absorb this page as written.

### 2.2 · THE CONTENT WEIGHS AN ORDER OF MAGNITUDE MORE THAN EITHER MARGIN

Extracted from the mockup and measured with `gzipSync(level:9)` — the compressor
`verify-bundle` judges with, per this repo's own recorded three-implementations warning:

| block | raw | gzip standalone | against margin |
|---|---|---|---|
| data (`S`+`P`+`WHY`+`TH`/`THUE`/`HUEBY`, mockup 256–460) | 33,968 | **13,303** | **11.7× `/monero`'s 1,138 B** |
| stylesheet (mockup 3–187) | 13,614 | **3,455** | **7.0× cssGz's 489 B** |

Standalone gzip is a lower bound for the CSS (appending to a larger corpus compresses better)
and roughly right for the JS. Either way the conclusion is not marginal: this is not a
coin-flip like p4·M9b's 344-against-401, it is an order of magnitude on both axes.

## 3 · SCOPE
IN — `app/src/pages/monero/thesisData.ts` (new, the data module), `app/src/pages/monero/ThesisTab.tsx`
(new, the component), `app/src/pages/monero/tabs.ts` (one row), `app/src/pages/MoneroPage.tsx`
(one case arm), a scoped stylesheet block, `app/verify-origins.mjs` (route + the stale sentence),
a gate proving the derivable invariants, `app/verify-bundle.mjs` (ceilings, with arithmetic),
`app/src/data/siteVersion.ts` (SITE_PR 211), `CLAUDE.md`, `handoffs/LOG.md`.

OUT — `MarketsThesisTab.tsx` and `/live/markets/thesis` (untouched; not moved, not deleted).
`scripts/routes.mjs` (a `:tab` path is deliberately not a static route — verified, see §4).
Any change to `V6Modal`'s behaviour. Any new dependency. Any `!important`. Any `:not()` added
to an existing selector to dodge the type floor.

## 4 · CONSTRAINTS
- The mockup is the spec. Every deviation is a recorded finding, resolved toward the repo.
- **Fonts**: delete the Google Fonts `<link>`. `--f-mono`/`--f-disp`/`--f-body` are repo tokens; the README's zero-third-party-request claim is gated at zero.
- **Tokens**: the mockup's `:root` re-declares names the repo already owns (`--bg-0..3`, `--rule`, `--ink-100/60/40/20`) with different values. Delete the mockup's `:root` and both light-mode blocks outright — the names then resolve to the repo's palette with no mapping layer.
- **Type floor**: `.th`, `.ours b`, `.corr-h`, `.corr-shared`, `.tag` declare 9.5px in the mockup. Take `var(--fs-label)`. No class exemption, no `:not()`.
- **Sources**: 21, every one an absolute https permalink, `target="_blank" rel="noopener noreferrer"`, no `<img>`, no favicon, no embed. CSP is `connect-src 'self'` / `img-src 'self' data:` with no `frame-src`.
- **Briefs reuse `V6Modal` whole**, `variant="thesis"`. Both base classes stay on the element so `verify-discrete`'s bare `.v6-modal` queries are untouched, and every pre-existing caller must render byte-identically.
- No `Math.random()` (this is not `src/protocols/`). No fabricated figure; a number is sourced or it is absent.

## 5 · DONE-CRITERIA — the gate reads ONLY this section
- [ ] Base `9847dfe` quoted; `verify-bundle` run on the untouched base and all six globals + the `/monero` row recorded (§2.1). **DONE**
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `MONERO_TABS.length === 8`, ids printed, `thesis` sits between `attacks` and `bottomline`
- [ ] `/monero/thesis` resolves to the Thesis tab (and `resolveTab` still falls back for an unknown id)
- [ ] 21 sources render, 21 distinct absolute https permalinks, 21 carry `rel="noopener noreferrer"`; count printed
- [ ] `WHY` has exactly 21 keys, every one a sorted pair over ORD; asserted in a gate that derives the 21 rather than restating them
- [ ] Every `P[].srcs` key exists in `SOURCES`; every `SOURCES` key is referenced at least once (no orphan, no unused)
- [ ] Rendered font-size at 1440 AND 390 reported for `.th`, `.ours b`, `.tag`, `.corr-h`, `.corr-shared`; none below 12px at 390
- [ ] `verify-mobile` green with NO new exemption and no `:not()` added to an existing selector
- [ ] `verify-origins` green with `/monero/thesis` in the Phase-2 list, and the "most outbound anchors" sentence corrected
- [ ] `verify-discrete` green; every pre-existing `V6Modal` caller renders byte-identically (negative control run, not reasoned)
- [ ] Zero off-origin requests on `/monero/thesis`; zero Google Fonts `<link>`; zero `<img>` with an off-origin src
- [ ] `verify:static` exits 0
- [ ] `verify:e2e` runs ALL 39 members; any red PAIRED against a base build on its own port, interleaved, with the holder confirmed by `/proc/<pid>/cwd`
- [ ] Every budget re-derived on the FINAL tree after the LAST src commit; each raise red-then-green with the arithmetic recorded in the file
- [ ] Chunk delta attributed to residual ZERO, paired per chunk STEM by multiset (the `index` stem holds two chunks; split by `dist/index.html`'s own `<script src>`, never by basename)
- [ ] Break tests, each restored against the COMMITTED BLOB with a bracketed marker sweep and a rebuild between restore and re-measure:
      (a) drop one `WHY` key → the 21-key assertion reds NAMING the missing pair
      (b) a source `href` set to a relative path → record whether `verify-origins` notices, and if not, say exactly what would
      (c) `variant="thesis"` removed → the brief still renders (proving the variant is geometry, not behaviour) and `verify-discrete` stays green
- [ ] `SITE_PR` → 211 and the `LOG.md` line, in the same commit
- [ ] Screenshots at 1440 and 390 read beside the mockup; every visible difference is either a named §4 case or a defect
- [ ] Branch pushed · draft PR opened · `subscribe_pr_activity` called

## 6 · VERIFY COMMANDS
```
cd app
npx tsc --noEmit
npm run build
node verify-bundle.mjs
npm run verify:static
npm run verify:e2e
node verify-mobile.mjs
node verify-origins.mjs
node verify-discrete.mjs
```

## 7 · REPORT — filled on exit
status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/211
commits: 33591ac (feature) · c4d71e5 (record) · + the LOG/PR-URL commit

**Shipped**: `/monero/thesis` as the eighth Monero tab — 7 pressure panels, 28 sourced
permalinks (26 cited), 21 pairwise overlap sentences, a closing box, theme tracing, and a
ported flow overlay whose endpoints were measured rather than assumed (10/10 land on panels).

**The brief's central premise was refuted by the first measurement**: `/monero`'s margin is
1,138 B (7th tightest of 18), not ~10,846, and the content is 11.7x that. `React.lazy` — the
same shape as `/live/mempool`'s ten view engines — held the route at +296 B and needed no raise.

**The mockup's `grid-template-areas` is invalid CSS** (a non-rectangular area) and the browser
discards it, in the mockup too: all seven panels stacked at one position. Repaired minimally.

**The palette is the repo's own, rediscovered** — 7 of 8 hues inside the recorded 4.35
calibration gap, 3 at exactly 0.00. One re-hue forced by the Monero-orange rule.

**Gates**: new `verify-thesis.mjs` (62 assertions) covering two measured gaps — no Monero tab
has ever been in `verify-mobile`'s type sweep, and `verify-reduce` never visits `/monero`.
`verify-palette` §4 re-anchored on the mechanism after this release falsified its "unique
word-start hit" premise. Census 90 / 86 / 22 / 40 / 76 / 6, instrument controlled against six
commits. Budgets residual zero; cssGz / lazyJsRaw / totalJsRaw raised, CHUNK_COUNT re-centred.

**Three break tests**, each restored against the committed blob behind four guards; M3 is the
sharpest — exactly one red while the brief still opens, is labelled, renders its sources and
unmounts, proving the variant is geometry and not behaviour.

## 8 · LOOP FEEDBACK
- The brief's budget table was one release stale on 4 of 6 globals and **9,708 B stale on the
  one row it built its whole implementation argument on**. Found in the first ten minutes by
  running the gate rather than reading the table — which is the third consecutive release this
  has happened (p4·M9b: 8,952 B; p4·M10: 9,203 B). The brief itself says "re-measure and quote
  your own", and that instruction is now the only part of a brief's budget table worth reading.
