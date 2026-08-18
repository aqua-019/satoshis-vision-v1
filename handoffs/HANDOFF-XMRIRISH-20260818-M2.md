---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260818-M2
branch: claude/readme-about-redesign-4aqutw
status: done
written_by: claude-code (manual mode — prompt-driven, self-authored)
owner: claude-code
---

# HANDOFF — p4·M2 "THE README REDESIGN, AND THE ABOUT PAGE'S CENTRE OF GRAVITY"

## 1 · GOAL
Three independent operator asks, kept apart in three commits on one PR.
**A** — `README.md` stops being a contributor's map and becomes a statement of
how the site treats its readers, with every claim naming the mechanism that
enforces it. **B** — `/about/site` puts the support section second instead of
fifth and gives the fundraiser link real visual weight without begging.
**C** — the theme toggle leaves Main Home and lives only in ⌘ DESIGN.

## 2 · CONTEXT
- Base: `e0c87ad` (post-#196). The prompt named `0f00d26`; #195 and #196 had
  merged since, so the stated base was two merges stale.
- Files: `README.md` · `app/src/pages/SitePage.tsx` · `app/src/pages/HomePage.tsx`
  · `app/src/design/ThemeToggle.tsx` · `app/verify-site.mjs` ·
  `app/verify-contrast.mjs` (comment only) · `app/verify-bundle.mjs` (own row).
- Parallel work: p4·M3 may run concurrently. Page files are disjoint; the
  shared bookkeeping files are `siteVersion.ts`, `handoffs/LOG.md`, `CLAUDE.md`
  and `verify-bundle.mjs` (different rows).

## 3 · SCOPE
IN: the three parts above, their gates, budgets, census, renders.
OUT: the phosphor theme's green-overlay feel (operator decision, flagged not
actioned); `LICENSE`'s stale ADDITIONAL DISCLAIMERS (reported, not edited —
a legal document needs operator sign-off); every non-`/about/site` budget-row
comment (owned by a concurrent PR or out of scope).

## 4 · CONSTRAINTS
- Kuno stays a LINK: zero browser requests to `kuno.anne.media`, no figures,
  no modal/banner/sticky bar. Reuse existing classes — cssGz margin is thin.
- Part A touches nothing under `app/` or `api/`.
- Part C is a mount removal only: VisualContext, the `ThemeKey` union, the
  index.html pre-paint stamp and `styles-theme.css` stay untouched.

## 5 · DONE-CRITERIA
- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0, 18 routes prerendered
- [x] Part A's commit diff contains no file under `app/` or `api/`
- [x] The clover is byte-identical to the delivered file (round-trip diff)
- [x] Every claim in the README's mechanism table verified against the tree
- [x] `verify-site` green, with §12 pinning section ORDER and CTA shape
- [x] Five break tests on §12/§8, each red where intended, mutation proven
      applied and each restore proven against the committed blob
- [x] `verify-contrast` green (Part C's dropdown instance still works)
- [x] `verify-origins` green — zero off-origin requests, fundraiser untouched
- [x] `verify-mobile` green — `/about/site` 0 elements below 12px
- [x] `verify-nojs`, `verify-ia`, `verify-releases`, `verify-bundle` green
- [x] Part C two-polarity: 0 theme toggles on `/`, all three themes still
      selectable and applying from the ⌘ DESIGN dropdown on `/` itself
- [x] Budgets attributed with residual ZERO against an isolated base build
- [x] Census recounted with the instrument controlled against three commits
- [x] Renders captured and LOOKED AT at 1440 and 390, before and after

## 6 · VERIFY COMMANDS
```
cd app
npm run typecheck && npm run build
node scripts/serve-dist.mjs 4173 &
node verify-site.mjs && node verify-contrast.mjs && node verify-origins.mjs
node verify-nojs.mjs && node verify-ia.mjs && node verify-mobile.mjs
node verify-releases.mjs && node verify-bundle.mjs
```

## 7 · REPORT
See the PR body and the CLAUDE.md session note for p4·M2.

## 8 · LOOP FEEDBACK
- **The brief's §0.1 was a false positive and it was in the authority slot.**
  It reported `Math.random()` in nine files outside `app/src/protocols/` and
  instructed that the README's claim be rewritten around them. All nine are
  COMMENTS, and every one says `Math.random` is *not* used there. A grep that
  counts mentions is not a grep that counts call sites — the same family this
  repo already records. `verify-prng` §6 strips comments and reports zero.
- **The brief's own scope hid the real call sites.** Its grep covered
  `app/src`; the two genuine call sites are in `api/`, and `app/legacy/` holds
  dozens more. A premise's SCOPE needs stating alongside its result.
- **`clover.txt` was not in the tree when work began** — the same
  "the operator approved X, read it" gap p4·06 recorded. It arrived mid-task.
- **The prompt's base commit was two merges stale.** Read `git log`, not the
  brief, for what `main` is.

---
## 9 · POST-MERGE ADVERSARIAL REVIEW — 26 findings, RECORDED NOT FIXED

Run AFTER #197 merged, on the merged diff `e0c87ad..d41f37a`, across five
independent lanes (README facts · README legal · SitePage · gate quality ·
residue), each lane's findings then put through an adversarial refutation pass
whose default position was that every finding is wrong.

**26 survived refutation. 23 were refuted.**

The operator's decision on 2026-08-18 was **record, do not fix**. Nothing below
is fixed. Three figures in CLAUDE.md's p4·M2 session note were corrected in
place because they were simply wrong (`+71`→`+66`, `96,519`→`96,514`,
`−8 to −23`→`14-31`); everything else stands as shipped.

**The process finding matters more than any single item.** The review ran after
the work was reported green and after the operator merged on that report. Ten
gates were green, five break tests were red where intended, budgets reconciled
to residual zero, and the census was controlled against three commits — and
none of that could see any of the 26, because every one is a CLAIM rather than
a computation. Run the adversarial pass BEFORE reporting.

Findings marked **[reproduced]** were re-verified by hand before being written
down, per this repo's rule that a worker's report is a report until the lead
reproduces it.

### 1. `CLAUDE.md:838, 840` — medium **[reproduced]**
**Defect.** CLAUDE.md records /about/site "re-derived to 96,519" and "grew, by +71"; the shipping tree measures 96,514 and +66. CLAUDE.md and verify-bundle.mjs:1686 disagree by 5 B inside one PR.
**Suggested fix.** In CLAUDE.md, change :838 `grew, by **+71**` to `grew, by **+66**` and :840 `re-derived to 96,519` to `re-derived to 96,514`. Both figures are already correct in verify-bundle.mjs:1671/1686; this is a one-line-each sync of the note to the commit that fixed the gate file.

### 2. `README.md:142-144` — medium
**Defect.** README §Purpose ("Nothing on it is an offer, a solicitation, or an inducement to do anything") is contradicted by the Kuno donate CTA this same PR promotes to the house primary affordance, and the README never mentions the fundraiser at all.
**Suggested fix.** Either qualify README:144 to the term of art it means — e.g. "Nothing on it is an offer or solicitation to buy, sell or invest in any asset" — or add a short §Donations clause under Legal naming the Kuno fundraiser: that it is an uncontrolled third-party platform, that XMR sent there is final and unrecoverable, and that a contribution confers nothing and is not tax-deductible.

### 3. `README.md:148-162` — medium
**Defect.** README §No endorsement / §Not advice ("not a recommendation to use any wallet, node, pool, exchange, service") is contradicted by /learn's shipped Wagyu advocacy chapter, including an unsourced misconduct allegation about competitors and uncited numerals.
**Suggested fix.** Reword README:158 from "Naming a project ... is documentation, not endorsement" to acknowledge advocacy — e.g. "Where this site argues that one tool or venue is better than another, that is the author's editorial opinion and not a recommendation to you" — and either cite or delete the unsourced competitor-conduct sentence at app/src/pages/_education/Journey.tsx:249.

### 4. `README.md:174-187` — medium
**Defect.** §"The simulators are simulated" scopes to `/learn`, and §"Live data may be wrong" says all figures come from third-party sources — so /operate/superstress/explorer, which renders an entirely invented chain, falls into neither clause and is affirmatively misdescribed by the second.
**Suggested fix.** Rescope README:184 from "under `/learn`" to the provenance property — e.g. "Any surface badged `MODEL` (the protocol demonstrations, and the stressnet explorer at /operate/superstress/explorer) renders invented values by design" — and soften README:174 to "Live figures on this site come from third-party sources".

### 5. `README.md:184` — medium **[reproduced]**
**Defect.** README:184 scopes the invented-values disclaimer to `/learn`, excluding /operate/superstress/explorer, which renders an entirely invented chain.
**Suggested fix.** Widen the sentence to name the second location: "The interactive protocol demonstrations under `/learn`, and the beta-chain explorer at `/operate/superstress/explorer`, render **invented values by design**, in order to illustrate a mechanism. They are labelled as such throughout — the explorer carries a persistent banner, its own accent used nowhere else on the site, and a `MODEL` provenance badge on every figure."

### 6. `README.md:63` — medium
**Defect.** "Your browser reaches no third party" / "The browser is forbidden to open a connection to another origin" is false for outbound navigation: CSP does not restrict top-level navigation and verify-origins deliberately exempts anchors.
**Suggested fix.** Scope the mechanism sentence at README:63 to what CSP governs: "The browser is forbidden to fetch or connect to another origin. Links you deliberately click still navigate away — see §No endorsement."

### 7. `README.md:70` — medium **[reproduced]**
**Defect.** README:70 cites verify-mobile.mjs, verify-legibility.mjs and verify-reduce.mjs as the mechanism for "Usable at 390px, nothing under 12px, and reduced motion loses no information" — none of the three gates makes that claim, and "nothing under 12px" is false by design.
**Suggested fix.** Split the row and state what each gate actually proves. e.g. `| **Usable at 390px.** | A 12px type floor below 720px with no class exemptions — `app/verify-mobile.mjs` §1, which also BOUNDS the 22 sub-12px SVG chart labels on /live/markets/thesis (§6) rather than fixing them; above 720px the floor is 11px by decision (`--fs-label` in `app/src/styles-legibility.css`). | **Reduced motion stops all motion.** | `app/verify-reduce.mjs` asserts zero running animations and zero SMIL on 27 surfaces. It deliberately does NOT check that the frozen frame keeps the information — see its own "FREEZE-POINT PROBLEM" note. |`

### 8. `README.md:70` — medium **[reproduced]**
**Defect.** README:70's "nothing under 12px" is falsified by the very gate it cites: verify-mobile.mjs bounds 22 sub-12px SVG nodes rather than failing them, and its 12px floor applies only at ≤720px.
**Suggested fix.** Change README:70 to state what the gate proves: "Usable at 390px, with a 12px HTML type floor below 720px (11px above it) and one bounded, ledgered SVG exception on /live/markets/thesis" — or drop the absolute and let the mechanism column carry it.

### 9. `README.md:79` — medium **[reproduced]**
**Defect.** README:79 "Randomness exists in exactly two places, and neither of them renders a value" is a non-exhaustive superlative and contradicts its own first bullet.
**Suggested fix.** Two edits. Narrow the lead to the banned call and drop the contradiction: "`Math.random()` exists in exactly two places, and neither of them puts a number on a live surface:". Then either add a third bullet — "**Client-side retry jitter** — `usePolling.ts` and `useMarketHistory.ts` seed one per-client spread from `crypto.getRandomValues`, so retries do not fire in lockstep. It is a millisecond count and never a displayed value." — or restate bullet 2 as "Retry backoff, server and client" and name all four files.

### 10. `README.md:79` — medium **[reproduced]**
**Defect.** "Randomness exists in exactly two places, and neither of them renders a value" is falsified by app/legacy/, which holds 58 Math.random() call sites that fabricate rendered values, and the cited gate is structurally blind to them.
**Suggested fix.** Scope the sentence: "In shipped code (`app/src/` and `api/`), randomness exists in exactly two places, and neither renders a value on a live surface" — and fix the internal contradiction by saying the simulators' invented values never appear on a live surface, rather than that they render no value.

### 11. `app/README.md:252-263 (sentence at 256-260)` — medium **[reproduced]**
**Defect.** PART C MISS. app/README.md still states the Theme control is mounted on Main Home and that "both toggles" render from one definition. Not in the diff; the author fixed ThemeToggle.tsx and verify-contrast.mjs and missed this file.
**Suggested fix.** Edit app/README.md:256-260 to match the two files already corrected, e.g.: "…and flipped the default from indigo to classic. The Theme control (`design/ThemeToggle.tsx`) is mounted ONCE, in the `⌘ DESIGN` dropdown, which rides the topbar on every route; it was also mounted on Main Home beside the hero CTAs until p4·M2, which removed that mount — themes are a display preference and belong with the other display preferences." One paragraph, no code change.

### 12. `app/src/pages/SitePage.tsx:257` — medium **[reproduced]**
**Defect.** The page's own one-line table of contents (sub) still enumerates the sections in the PRE-REORDER order, and the PR added §12 to pin the DOM order while leaving this sentence ungated.
**Suggested fix.** Rewrite the sub at SitePage.tsx:257 to follow the shipped sequence, e.g. sub="What this site is, how it stays up, where it came from, how it treats you, who runs it, and what is on it." — and, since §12 already reads the DOM order, consider having §12 additionally assert that the sub names the sections in the same sequence (or drop the ordering implication from the sentence entirely).

### 13. `app/verify-bundle.mjs:1679` — medium
**Defect.** "NET of a 13 B eager saving that reaches every route" is wrong; the eager saving is 33 B raw / 19 B gzip, and only 19 closes the decomposition.
**Suggested fix.** verify-bundle.mjs:1679: change "NET of a 13 B eager saving that reaches every route" to "NET of a 19 B gzip eager saving (−33 B raw) that reaches every route", so the decomposition reads 85 − 19 = 66 and closes.

### 14. `app/verify-site.mjs:599, 605-608, 627-629` — medium
**Defect.** verify-site.mjs:599,605-608,627-629 — the fixed/sticky check walks only the ancestors of the FIRST `[data-support-link]`, so a separate fixed donate bar leaves all nine §12 assertions green.
**Suggested fix.** Two lines inside the same `p.evaluate`: (a) `supportLinks: document.querySelectorAll('[data-support-link]').length` and assert it `=== 1`, so a second marker is a named red rather than a silent narrowing of the subject; (b) sweep the document rather than the ancestor chain — `stuckAnywhere: [...document.querySelectorAll('*')].filter(n => { const q = getComputedStyle(n).position; return (q==='fixed'||q==='sticky') && n.querySelector('a[href*="kuno.anne.media"]'); }).length` — and assert it is 0. Keep the ancestor walk as the named-detail path for M2.

### 15. `app/verify-site.mjs:609 (selector) / 637 (assertion)` — medium **[reproduced]**
**Defect.** §12's `cta.h > cta.maxSecondaryH` includes the CTA in its own comparison set whenever the CTA carries a secondary class, degenerating to `h > max(h, …)`. CLAUDE.md's M3 break-test evidence ("42px vs 42px … the weight assertion doing real work") is produced by that self-inclusion, not by measuring weight.
**Suggested fix.** Exclude the CTA from its own set at verify-site.mjs:609: `const secondary = [...document.querySelectorAll('a.v6-res, [data-support-link] ~ a')].filter((e) => e !== el).map(...)`. Then re-run M3 and correct CLAUDE.md:832-833, which currently cites a self-inclusion red as proof the weight comparison discriminates.

### 16. `app/verify-site.mjs:609, 637-638` — medium **[reproduced]**
**Defect.** verify-site.mjs:609,637-638 — `secondary` includes the CTA itself under mutation M3, so the height assertion self-compares; the CLAUDE.md break-test evidence ("42px vs 42px … the weight assertion doing real work") proves a selector collision, not discrimination.
**Suggested fix.** Exclude the subject from its own comparison set at :609: `document.querySelectorAll('a.v6-res:not([data-support-link]), [data-support-link] ~ a')`. Then re-run M3 — it will now red on the `proto-btn` class assertion only (1 red, not 2) — and add a mutation that actually exercises :637, e.g. delete the inline `style={{ padding: "12px 20px" }}` at SitePage.tsx:322, which takes the CTA to ~28px and reds `28px vs 28px` on its merits. Correct the CLAUDE.md M3 line from '2, the second reading 42px vs 42px, which is the weight assertion doing real work' to what actually happened.

### 17. `LICENSE:37-40` — low
**Defect.** LICENSE clause 3 asserts the project includes "Exchange widgets (ChangeNOW, Wagyu Wallet references)" — deleted in v6.1.0 — contradicting README:50-53 and :63; and README:220 calls the file plain "MIT" when it carries six appended non-MIT clauses.
**Suggested fix.** Delete LICENSE clause 3 (the widgets are gone) or rewrite it to cover outbound links generally, since README now points readers at that file as governing the site's content.

### 18. `README.md:138` — low
**Defect.** The entire ## Legal section exists only in the repo README; no route on xmr.irish renders any disclaimer, and this PR restructured /about/site without adding one.
**Suggested fix.** Add a seventh `<Section id="legal">` to app/src/pages/SitePage.tsx carrying a condensed version of README §Legal (or a one-line footer link to it), and extend verify-site.mjs §12's EXPECTED order array to include it so the placement is pinned.

### 19. `app/src/pages/SitePage.tsx:317` — low
**Defect.** `data-support-cta="primary"` is written and read by nothing — dead attribute residue.
**Suggested fix.** Delete SitePage.tsx:317. If it is meant as a future hook, assert it in §12 instead — e.g. `R.ok(cta.role === 'primary', '12 · the CTA declares itself the primary support control')` reading `el.getAttribute('data-support-cta')` — so the marker is load-bearing rather than decorative.

### 20. `app/src/pages/SitePage.tsx:323` — low
**Defect.** The new external CTA is labelled 'Donate XMR · Kuno →' — it uses →, this site's INTERNAL-navigation glyph, and is the only external anchor in the tree that does so.
**Suggested fix.** At SitePage.tsx:323 change the label to `Donate XMR · Kuno ↗` (matching the 13 other external anchors), or drop the glyph entirely to match the 6 unglyphed externals. If kept visible-only, wrap it as `<span aria-hidden="true">↗</span>` per JurisdictionRow.tsx:44.

### 21. `app/verify-bundle.mjs:1680` — low
**Defect.** "(see the eagerJsRaw note — p4·M2 also removed Main Home's ThemeToggle mount)" points at a note that does not exist; the eagerJsRaw block was not touched by this PR.
**Suggested fix.** Either drop the parenthetical at verify-bundle.mjs:1680, or append one dated line to the eagerJsRaw block just above `eagerJsRaw: 280_000,` (:805): "// p4·M2: entry 101,566 -> 101,533 raw (−33 B), 35,351 -> 35,332 gzip (−19 B) — Main Home's <ThemeToggle/> mount removed; the control remains in DesignPanel, which is eager either way, so this is the JSX call site only."

### 22. `app/verify-bundle.mjs:1682 (and CLAUDE.md:838)` — low
**Defect.** "Every OTHER route row's trailing figure is likewise ~13-23 B stale" — measured range is 14 to 31 B, seven of seventeen routes outside the band; CLAUDE.md:838 states the same quantity as "−8 to −23", where nothing measures −8.
**Suggested fix.** verify-bundle.mjs:1682: "Every OTHER route row's trailing figure is likewise 14-31 B stale — a uniform 19 B gzip eager saving plus each route chunk's own hash-rotation compressibility; they are deliberately left…". Mirror the same correction at CLAUDE.md:838, replacing "(−8 to −23 B)" with "(−14 to −31 B)".

### 23. `app/verify-site.mjs:572-643 (§12) vs 536-552 (§11)` — low
**Defect.** §12's CTA assertions run only at 1440x900, but the SitePage comment justifying the short label names a 390px failure mode as the reason. The property the comment calls load-bearing is never exercised by the gate.
**Suggested fix.** Add one 390 assertion to §12 (or extend §11): open a 390x844 context, read the CTA's rect and `scrollWidth`, and assert it does not shatter — e.g. `R.ok(r.height <= 2 * lineHeight && el.scrollWidth <= el.clientWidth + 1, '12 · the support CTA does not shatter at 390 (${r.width}x${r.height})')`. Break-test it by lengthening the label, which is the mutation SitePage.tsx:301-308 says to fear.

### 24. `app/verify-site.mjs:586` — low
**Defect.** verify-site.mjs:586 — the word 'six' is hardcoded in an assertion message whose value is derived from `EXPECTED.length`, so a seventh section prints 'all six sections … (7)' and stays green.
**Suggested fix.** At :586 replace the literal with the derived count: `` `12 · all ${EXPECTED.length} sections carry a data-site-section marker (${order.length})` ``.

### 25. `app/verify-site.mjs:609` — low **[reproduced]**
**Defect.** verify-site.mjs:609 — `[data-support-link] ~ a` matches zero elements and always will, so the only part of the selector expressing 'beside it' is inert and `secondary` is really a page-wide `a.v6-res` sweep.
**Suggested fix.** Either drop the inert `[data-support-link] ~ a` half and say what is really measured, or scope the set to the support section properly. Minimal version that keeps the stated claim honest: `const row = document.querySelector('[data-support-link]').closest('.chip-row').parentElement; const secondary = [...row.querySelectorAll('a.v6-res')]...` — and reword :633/:638 from 'beside it' / 'every secondary link' to whatever the selector actually covers.

### 26. `app/verify-site.mjs:609` — low **[reproduced]**
**Defect.** The `[data-support-link] ~ a` half of §12's secondary-link selector is dead — it matches 0 elements and structurally always will; the working half is a page-wide `a.v6-res` sweep, not "the secondary links beside it".
**Suggested fix.** Scope the sweep to the support section and drop the dead clause: `const sec = el.closest('[data-site-section="support"]')?.parentElement ?? document; const secondary = [...sec.querySelectorAll('a.v6-res')].filter((e) => e !== el)…`. That also closes the OPERATOR_X leak and the self-inclusion in finding 3 in one edit.
