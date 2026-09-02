---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260902-M9b
branch: claude/new-session-mxn17f
status: done
written_by: claude-code (manual mode — task arrived as a prompt)
owner: claude-code
---

# HANDOFF — p4·M9b "MOBILE 2.0: nav reachability and a phone layout for classic"

## 1 · GOAL
Two things exist that do not exist now. (a) Every one of the 17 IA leaf items is
reachable from the phone tab bar in at most two taps — today eleven routes are
reachable only by typing a URL or using ⌘K, because a tab navigates to
`cols[0].items[0].p` and nothing reaches the rest. (b) `/live/mempool?v=classic`
— the default view on the flagship surface, so the page a phone lands on — is
LAID OUT for a phone rather than being desktop markup narrowed by a reflow sheet.

## 2 · CONTEXT
- Base **`8dc7a56`** (merge of #207, p4·M9a). Verified four ways: parents
  `76f54fb` + `89ac501` ✓, base is an ancestor of `origin/main` ✓,
  `origin/main` == base ✓, working tree clean ✓.
- `SITE_PR` on the base is **209**; `logMax` is **208**.
- Brief: `/root/.claude/uploads/.../p4M9bmobile2.md`.

### 2a · THE BRIEF'S BASELINE IS TWO RELEASES STALE AND ONE FIGURE IS DANGEROUS
Measured with `node verify-bundle.mjs` on the untouched base (build stamped
`8dc7a56c`, 32 passed · 0 failed):

| budget | ceiling | brief said | **MEASURED base** | margin |
|---|---|---|---|---|
| eagerJsRaw | 280,000 | 264,457 | **264,970** | 15,030 |
| eagerJsGz | 96,000 | — | **88,743** | 7,257 |
| lazyJsRaw | 997,000 | 993,843 | **995,963** | **1,037** |
| totalJsRaw | 1,262,000 | 1,258,300 | **1,260,933** | **1,067** |
| cssGz | 19,000 | 18,586 | **18,599** | **401** |
| maxChunkRaw | 500,000 | — | 162,915 (vendor) | — |
| /live/mempool | 107,000 | 96,835 "ANCIENT" | **105,787** | **1,213** |
| /operate/peers | 109,000 | 106,687 | **107,143** | 1,857 |
| /operate/superstress | 112,000 | 109,404 | **109,865** | 2,135 |
| /future | 115,000 | 112,326 | **112,783** | 2,217 |
| chunks | 73±4 | — | **76** | at +3 of +4 |

The brief calls `/live/mempool` "ANCIENT" at 96,835 and treats it as roomy. It
is **1,213 B from its ceiling** — the tightest route on the board and the one
this release exists to change. The brief planned ONE raise (`cssGz`); this
release needs **four** (`cssGz`, `/live/mempool`, `lazyJsRaw`, `totalJsRaw`),
and `CHUNK_COUNT` is one mint from its band edge.

### 2b · cssGz RAISE, PLANNED BEFORE THE FIRST RULE (the brief's §0′ ask)
Measured, not estimated: a realistic candidate block — the bottom sheet plus a
phone layout for all four classic sub-components, 1,447 raw bytes written the
way the build emits — appended to `dist/assets/*.css` and re-gzipped with
`gzipSync(level: 9)` (the compressor `verify-bundle` itself judges with, per its
own three-implementations warning at :273) costs **+344 B gzip**: 18,599 →
18,943. That fits under 19,000 by 57 B, which is not a margin. The finished
block will exceed the sketch. Ceiling goes to **19,600** — built + ~2.5%, the
proportion `cssGz`'s own comment says that budget is deliberately run at, and
p4·M8's precedent for raising it while green.

## 3 · SCOPE
IN:
- A bottom sheet in the mobile nav, sourced from `IA`, below 720px only.
- A phone layout for the four classic sub-components: stat strip, block ladder,
  fee/tier cards, transaction table.
- Gate extensions: route reachability, one gutter, site-wide 44px, no clipped text.
- The budget raises above, red-then-green on the FINAL tree.

OUT (non-goals):
- The other nine mempool views. Orbital, Abyss, Pulse, Circuit and the rest keep
  the reflow sheet exactly as it is. **A choice, not an oversight.**
- The desktop composition at any width above 720px.
- `verify-reduce`'s hand-copied `MEM` array (standing finding, needs its own
  break tests — widening it here repeats what its own comment forbids).
- The topbar's own sub-44px targets in shared chrome, unless measurement shows
  the sheet makes them worse.

## 4 · CONSTRAINTS
- React 18 · Vite 5 · TS strict. Edit `app/src/**`; no hand-edited HTML.
- **No new dependency.** Reuse `V6Modal`'s mount model or record why not.
- Below 720px only, by the existing `@container navshell (max-width: 720px)`.
- Never `window.innerWidth` at render — a render-time width branch emits one
  viewport's composition into all 18 prerendered files.
- Reduced motion must lose no information, and the surface list must be DERIVED.
- Every phone assertion runs at dpr 1, 2 AND 3 (p4·M7's defect did not exist at dpr 1).

## 5 · DONE-CRITERIA — the gate reads ONLY this section
- [ ] `npm run build` exits 0 (includes `tsc --noEmit`)
- [ ] All 17 IA items reachable in ≤2 taps at 390 AND 320; 17 lines printed
- [ ] Sheet: opens for multi-item sections; current item marked; rows ≥44px;
      focus trapped; focus returns to the opening tab; Esc, backdrop and
      route-change each dismiss; reduced motion proven, derived not hand-copied
- [ ] `node verify-memphone.mjs` green at all 15 stages, with §2 and §5 numbers
      quoted before and after
- [ ] `node verify-mobile.mjs` green, with the three new sections each carrying
      a planted positive control
- [ ] `npm run verify:static` exits 0
- [ ] `npm run verify:e2e` exits 0 (or every red paired against the base build)
- [ ] `node verify-bundle.mjs` exits 0; every raise red-then-green on the final
      tree; per-chunk attribution with residual ZERO
- [ ] Break tests: tab-bar revert reds reachability with 11 names; ladder
      scroll-padding removal reds the clipped-card assertion while §5 STAYS
      GREEN; a 40px sheet row reds the 44px assertion
- [ ] `SITE_PR` == logMax+1 at commit; LOG.md line in the same commit
- [ ] Branch pushed · draft PR opened

## 6 · VERIFY COMMANDS
```
cd app
npm run build
node verify-bundle.mjs
npm run verify:static
node scripts/serve-dist.mjs 4173 &   # then:
node verify-memphone.mjs
node verify-mobile.mjs
npm run verify:e2e
```

## 7 · REPORT
status: **done**
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/209 (draft)
commits: `0b5e61d` the sheet + classic · `8e0c55b` §10f/§10g · `9e781d7` reduce polarity
+ four ceilings · plus the records commit

### What shipped
- `layout/SectionSheet.tsx` (new, lazy) + `BottomTabBar` wiring + one optional `variant`
  prop on `V6Modal`. All **68** IA items reachable in ≤2 taps at 390 and 320.
- Classic: the tier footer stacks its two readings and drops the separator; ≤360 goes
  one-up; the ladder's cut edge is faded rather than sliced.
- `verify-mobile` §10 (reachability, tap floor, reduced-motion polarity) and
  `verify-memphone` 5f.

### Numbers
| | base | head |
|---|---|---|
| verify-mobile | 59 | **74** |
| verify-memphone | 436 | **451** |
| verify-bundle | 32 | **32** |
| short-string wraps in classic @390 | 7 | **0** |
| short-string wraps in classic @320 | 7 | **2** (both long captions, accepted) |
| tier footer lines, all 15 stages | 2–3 | **1** |
| §5 divider frac / scrollLeft | 0.499 / 96·61·41 | **identical** |
| chunks | 76 | 77 |

### The four raises, red-then-green on the final tree
`cssGz` 19,000 → 19,500 (built 19,011) · `lazyJsRaw` 997,000 → 1,001,000 (997,403) ·
`totalJsRaw` 1,262,000 → 1,266,000 (1,263,109) · `CHUNK_COUNT` re-centred 73 → 74.
Attribution residual **zero** on both halves. `/live/mempool` held at 106,038 of 107,000.

### What the brief got wrong, with the measurement
1. Budget table two releases stale; `/live/mempool` had 1,213 B, not ~10,000.
2. "The only phone-specific classic rule on this tree" — measured **29**.
3. §2.2.3 stat-strip tiles "cannot hold their values" — every tile is one line, unclipped.
4. §2.2.5 "topbar is two rows at 390" — it is 91 px at 390 and 360, 121 px at 320.
5. §2.3's mandatory scroll-snap conflicts with `verify-memphone` §5 at 430 (0.324 vs 1/3).

### What I got wrong
1. A reachability probe that read landings at `domcontentloaded` printed a plausible,
   entirely false "27" — `a.tabbar-item` is 0 at DCL and 6 at idle.
2. A line-count instrument that divided height by line-height counted 5 px of cell
   padding as a second line and flagged every table cell.
3. The first tier-footer rule was inert (an inline `letterSpacing` beat it) and passed
   anyway, because the 390 column is exactly the string's width — a 0.0 px pass.
4. The ≤360 one-up rule was placed before the 2-up rule and lost on source order while
   looking correct in the sheet.
5. Break test M2's first mutation removed only the `-webkit-` mask declaration.
6. I read a mid-transition screenshot as a transparency defect; settled, the box is
   opaque `rgb(10,9,7)` with zero running animations.

## 8 · LOOP FEEDBACK
- The brief's §0′ budget table was two releases stale and its `/live/mempool`
  row was ~9,000 B optimistic on the one route the release targets. A brief that
  hands over budget figures should hand over the command that produced them and
  the commit they were taken at.
- CLAUDE.md's p4·M9a note and `handoffs/LOG.md` both state M9b is "built and
  gated on `p4-m9b-preserved`". **That branch does not exist**: `git ls-remote`
  returns 401 refs, none matching `m9b` or `preserv` case-insensitively, and
  zero tags. Scope of the search stated because an absence is only evidence once
  its scope is. The work is therefore rebuilt from the brief, not recovered.
