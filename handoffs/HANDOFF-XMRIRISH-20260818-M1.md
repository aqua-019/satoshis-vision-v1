---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260818-M1
branch: claude/cold-boot-splash-mobile-jtj7n1
status: done
written_by: cowork
owner: claude-code
---

# HANDOFF — p4·M1 · THE COLD BOOT ON A PHONE (mobile hotfix)

## 1 · GOAL
The cold-boot splash renders usably on phones (360/390/430) instead of a
wall of overprinted glyphs. The stacked console's three panes stop
overlapping; the console fits the viewport and scrolls cleanly; the version
literal `v6.1.8` stops rendering. A cold-boot gate asserts the phone band and
goes RED against the unfixed tree.

## 2 · CONTEXT
- Base: 2eb4e26 (#195, p4·07 — the TRUE latest main). Prompt said 0f00d26/#194,
  written pre-p4·07; p4·07 did NOT touch coldboot, so the layout is byte-identical.
- SITE_PR at base = 195 → this PR is #196, bump 195→196.
- Subject: src/coldboot/ColdBootConsole.tsx, field.ts, ColdBoot.tsx, verify-coldboot.mjs.

### MEASURED at base (390x844, real splash, no bypass):
- coldboot overlay = 844 (viewport, position:fixed inset:0) — innocent.
- console root = 796px (0.94x viewport) — IT FITS. (✓-block's "2919" NOT reproducible.)
- grid clientH 738, scrollH 1234; panes NATURAL sum 2184.
- **OVERLAP total = 1288px** (360: 1389, 430: 1103) ← THE DEFECT = the overprint.
- Mechanism: stacked grid (display:grid, 1 col, flex:1, overflowY:auto) resolves 3
  implicit rows to EQUAL fractions (236.67px x3) filling its definite 738px height;
  panes have min-height:0 so they're crushed to 237px rows while their content
  (861/590/733) overflows and overprints the panes below.
- The ✓-block claim "narrowest viewport ever tested is 1100" is FALSE: verify-coldboot
  §6/§7/§8 already render at 390 AND 1100. The real blind spot: no assertion forbids
  PANE OVERLAP; §7 accepts "scrolls" as reachable so 1288px of overprint passes green.
- Field canvas (390x844 full-viewport) innocent — NOT the overprint source.

## 3 · SCOPE
IN: stacked-mode overprint fix (grid-auto-rows), optional phone orb compaction,
    the v6.1.8 literals, phone-band assertions in verify-coldboot.mjs.
OUT: desktop splash (1100-2560 untouched); the orb/field internals; the CLS budget;
    any new gate FILE (extend the existing one — it's already bypass-audit-exempt);
    reordering panes.

## 4 · CONSTRAINTS
- Zero new stylesheet rules (this file ships inline styles + matchMedia by design).
- / must stay 0.0000 CLS; verify-vitals green at CI-calibrated numbers.
- cb-pending must still FAIL OPEN (three removers stay).
- Desktop cold-boot gates (1100-2560) stay green.
- NEVER pkill -f. Kill servers by PID (lsof -tiTCP), browsers by browser.close().

## 5 · DONE-CRITERIA  — the gate reads ONLY this section
- [ ] verify-coldboot.mjs asserts NO pane overlap at 360/390/430; RED on unfixed tree, GREEN after.
- [ ] no horizontal overflow at 360/390/430.
- [ ] console root within a small multiple of viewport at 360/390/430.
- [ ] splash completes (clears within bounded time; #root visible).
- [ ] reduced-motion: content reachable, no rAF loop.
- [ ] v6.1.8 no longer renders; label derived from SITE_PR or dropped; gated.
- [ ] the four cold-boot gates green (cbpending, degraded, coldboot, coldboot-live).
- [ ] verify-vitals green; CLS on / unchanged.
- [ ] census recounted; budgets within ceilings.
- [ ] npm run build exits 0; typecheck clean.
- [ ] Branch pushed · draft PR opened.

## 6 · VERIFY COMMANDS
```
cd app && npx tsc --noEmit
npm run build
npm run verify:coldboot
node verify-cbpending.mjs && node verify-degraded.mjs
node verify-vitals.mjs
```

## 7 · REPORT
status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/196
commits: fd1361f (fix) · 9e60db5 (gate)

Root cause: stacked grid resolved 3 implicit rows to equal fractions (~237px),
crushing minHeight:0 panes whose content (861/590/733px) overflowed and
overprinted the panes below — 1288px overlap at 390. Fix: gridAutoRows:max-content
in the stacked branch only (one property). Overlap 1389/1288/1103 -> 0/0/0 at
360/390/430; console fits (0.94x vh); grid scrolls cleanly; scroll holds 60fps
under 6x throttle. v6.1.8 frozen stamp -> derived SITE_VERSION (v6 · #196),
SITE_PR 195->196, gated by §9d. New gate section §9 in verify-coldboot.mjs
(no new file; census unchanged 88/84/22/38/74/6). Two-polarity: unfixed 97/4,
fixed 103/0. verify-cbpending 27/0, verify-coldboot-live 22/0 (bypass audit
intact), verify-degraded pass, verify-cls 20/0, verify-vitals 17/2skip/0,
verify-bundle 32/0 (chunk count 76==base 76, minted nothing).
Proved innocent: the field (viewport-sized, forms wordmark, fades; ~6fps under
6x is its pre-existing per-frame cost) and MATRIX_COLS (wrong axis).

## 8 · LOOP FEEDBACK
- ✓-block premises corrected at base: "never tested <1100" (false), "2919 container"
  (unreproducible), SITE_PR 194→195 (actually 195→196), census 87→88 baseline.
