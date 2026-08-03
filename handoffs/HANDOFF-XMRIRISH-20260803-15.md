---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260803-15
branch: claude/v6-1-8-cold-boot-main-home-5diiu5
status: in_progress        # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, self-authored per CLAUDE.md loopflow)
owner: claude-code
---

# HANDOFF — v6.1.8 Cold Boot splash + Main Home

**Source: prompt 09 of 19 (v6.1.8 · Cold Boot splash + Main Home).** Its *Verify* section is
§5 below; its commands are §6.

## 1 · GOAL

`/` becomes a cold-boot experience ported from the approved mockup
`docs/v6-mockups/coldboot-splash.html`: a full-bleed seeded decrypt that resolves into a real
Monero transaction and closes on `signer_index ??? — NOT ENCODED IN THE PROTOCOL`; a HUD
console that **gates** on the user rather than timing out; and a rewritten Main Home that
expands out of that console — with a network orb that travels across the cut, un-blurred, so
the two screens read as one place. The mockup supplies mechanics; **this repo supplies the
data**, because every number in the mockup is a placeholder and this site ships no fabricated
values on live surfaces.

## 2 · CONTEXT

- Mockup (do not edit): `docs/v6-mockups/coldboot-splash.html` (1681 lines)
- Rewrite target: `app/src/pages/HomePage.tsx` (157 lines, **eager — the LCP route**)
- Consume, do not rebuild: themes + `ThemeToggle` (03), motion tokens + `viewTransition.ts`
  (04), loading language `useOnline.ts`/`Skeleton.tsx` (05), 6-item nav `nav/ia.ts` +
  `NavTop` (07), `/api/nodes` + `useNodePopulation.ts` + `NETWORK` `ProvSource` (08)
- Base: `origin/main` = `f1dc296`

### Measured baselines — captured on the **unmodified** tree at `f1dc296`, executed

```
CLS  /  degraded  0.0006  (0.0006, 0.0005, 0.0006)   ceiling 0.005
CLS  /  healthy   0.0016  (0.0012, 0.0016, 0.0009)   ceiling 0.005
     intercept set (healthy pass only, 6 patterns): **/api/xmr/**, **/api/coingecko*,
     **/api/markets* (deliberately EMPTY groups), **/api/feeds* (aborted),
     **/api/nodes* (real handler over api/_fixtures/monerofail-health.json), **/api/status*
eagerJsGz  83.07 KB / 85.94 KB  = 97% used   → 2.87 KB gzip headroom
cssGz      15.53 KB / 16.60 KB  = 94% used   → 1.07 KB gzip headroom
route /    83.07 KB / 86.91 KB  = 96%          (2 chunks)
chunk count 56 within 55±4                   → at most 3 new chunks before the band breaks
verify-bundle: 25 passed · 0 fixtured · 0 skipped · 0 failed
```

**This is the binding constraint of the task.** The splash, console and orb must be lazy and
share chunks; CSS must reuse existing tokens/classes rather than add a new sheet.

### Inventory — measured, not quoted

70 `verify-*.mjs` on disk (`api/` ×6, `app/` ×63, `app/scripts/` ×1) = 3 shared modules
(`verify-lib`, `verify-reporter`, `verify-fixtures`) + 1 orchestrator (`scripts/verify-all.mjs`)
+ 55 wired gates + 11 orphans. CI reaches **52 distinct** gate files.
`verify:static` 19 · `verify:e2e` 26 (one overlap: `verify-origins`).

## 3 · SCOPE

**IN**: the splash (decrypt · console · handoff), the orb wired to three distinct data tiers,
the `HomePage.tsx` rewrite, the cross-gate cold-boot bypass with precondition assertions, three
new gates, and the doc corrections this change forces.

**OUT (non-goals)**: no new route (so `.claude/hooks/session-start.sh`'s `R`-key count stays
13); no change to `api/`; no edit to the mockup; no resolution of the 11px/12px standing
conflict (report it); no consolidation of the four canvas-hook copies (named deferral); no
per-prompt session note in `CLAUDE.md`.

## 4 · CONSTRAINTS

- CSP `connect-src 'self'` — the browser reaches no third party; everything via `/api/`.
- `Math.random()` only in `app/src/protocols/`. Use `design/prng.ts` (`h3`, `mulberry32`);
  **add no new PRNG primitive**.
- Zero fabricated values on live surfaces. **Operative test**: *does this line assert something
  about the world that could be false right now?* CSP being `'self'` cannot be (compiled in);
  a chain tip can be. Build facts stay; network claims are real or an em-dash.
- `verify-provenance.mjs` bans literal `fresh="live"` **and** `phase="live"` — the orb badge
  uses `<NodeProvenance source="network" phase={computed}>`.
- `verify-effects.mjs` fails on un-ledgered `useEffect` in `src/data/`.
- Prerendered `/` must remain **Main Home** (JS off, crawlers). Splash renders `null` under SSR.
  No splash copy may match `SUSPENDED_RE` (`/loading(\s+[a-z]+)?[….]|does not support Suspense/i`).
- Reduced motion loses no information: instant resolve, no collapse, no blur, orb still present.
- 390px usable. No text under 12px, or the `--fs-label` token resolved at runtime via probe.
- New dependencies: **none** (recorded here if that changes).

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] decrypt is deterministic — same seed, same frames; screenshot-diff two runs
- [ ] `grep -rn "Math.random" app/src/` returns hits only inside `protocols/`
- [ ] once-per-session gating works — reload lands on the console with no decrypt; clearing the
      flag restores it
- [ ] orb population, transport split and height agreement come from `/api/nodes` **through
      `useNodePopulation`**, and degrade to an honest empty state on `status: "unavailable"`
      with **no numeric field rendered**
- [ ] no hostname appears anywhere in the orb or its DOM — asserted in **both** polarities
- [ ] Dandelion++ layer carries an `ILLUSTRATIVE` badge; no live badge on it anywhere
- [ ] no node is placed at a geographic location; Tor/I2P render in shells
- [ ] Enter handoff completes; the orb travels rather than collapsing
- [ ] rotating hero: **0px layout shift across all seven passages** — measured and reported
- [ ] `/` CLS **before and after**, both reported, with the route-intercept set named
- [ ] hero pauses on hover and focus; no auto-advance under reduced motion
- [ ] every hero passage matches its source file verbatim — **text and attribution**, diffed,
      with a companion assertion that all seven matched
- [ ] reduced motion: instant resolve, no collapse, no blur, page complete
- [ ] 390px usable throughout
- [ ] no text under 12px, or the `--fs-label` token resolved at runtime — standing conflict
      **reported, not resolved**
- [ ] prompt 06's budget gate (`verify-bundle`, `verify-vitals`) stays green
- [ ] every new assertion has a companion asserting its precondition held
- [ ] break tests done by probe or throwaway copy; `git status` clean and the mutation sweep
      empty before the final chain
- [ ] design-reviewer returned APPROVE
- [ ] Branch pushed · PR opened via GitHub MCP, ready for review

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck
npm run build
npm run verify:bundle
npm run verify:static
node scripts/serve-dist.mjs &          # port 4173; do NOT pkill -f by a self-matching pattern
npm run verify:e2e
node ../api/verify-nodehealth.mjs && node ../api/verify-tx-parse.mjs \
  && node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs \
  && node ../api/verify-status.mjs && node ../api/verify-nodes.mjs
node verify-tiers.mjs
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
