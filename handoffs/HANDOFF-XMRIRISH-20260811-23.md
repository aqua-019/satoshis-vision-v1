---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260811-23
branch: claude/prompt-in-file-j9auvc
status: in_progress       # open -> in_progress -> done | blocked
written_by: claude-code    # manual mode — task arrived as a prompt (v2·3 Terminal v2)
owner: claude-code
---

# HANDOFF — v2·3 Terminal v2 · chart-kit charts, density, and two gate corrections

## 1 · GOAL

`app/src/mempool/terminal.tsx` gains 3–5× the information it renders today and a set of
higher-fidelity charts built on `design/chart-kit.tsx`, without losing the three properties that
make Terminal structurally different from the other v2 views: it is **outside `FitView`**, it
**must pan at 390px**, and it carries `stats={false}` plus its **own nested `.rail`**.

Two corrections ship alongside, because the work cannot be verified without them:

1. `claude/V2-VIEW-CONFORMANCE.md` §6 says "390px usable, no horizontal scroll". For Terminal
   that is false and `verify-mobile.mjs:36-44` asserts the opposite. Rev 3 gains a named
   exception for pan-mode views.
2. `styles.css:2643` declares a **bare** `.rail { display: none }` in the 769–1199px band, which
   defeats the deliberate child-combinator at `:2157` and hides Terminal's nested rail. This is
   why `verify-pageshell`'s Terminal nested-rail assertion is **already red on `260c99f`**.

## 2 · CONTEXT

- Contract: `claude/V2-VIEW-CONFORMANCE.md` (Rev 3) — read with this handoff's §1, which
  overrides its §6 for Terminal.
- Base: `main` = `260c99f` (PR #169 merged), 2026-08-11. Branch is at `origin/main`, 0 ahead / 0 behind.
- Subject: `app/src/mempool/terminal.tsx` — **470 by `wc -l` / 471 by `split("\n").length`**.
- Shell consumed: `mempool-shared.tsx` (`MemViewShell`, `MemTxTable`, `useMempoolTracking`),
  `design/primitives.tsx` (`PanelFrame`, `NodeProvenance`), `design/chart-kit.tsx`,
  `mempool/mem-stats.tsx` (`useMemStats`, `BlockEta`, `fmtMMSS`).
- Terminal is registered `fit: false, reflow: false` (`src/views/index.tsx`) — it is
  rendered directly by `MempoolPage` in a plain `.mp-view`, per `FitView.tsx:11`.
- **Nine gates name `terminal`**: bundle · chartkit · memdetail · memshell · memviews ·
  mobile · nav · pageshell · reduce.

### Binding constraints, measured on `260c99f` rather than assumed

| constraint | source | value | headroom |
|---|---|---|---|
| view file line band | `verify-memshell.mjs:90-91` | `BAND_LO 200 · BAND_HI 1084` | 470 → 614 lines |
| all-JS raw ceiling | `verify-bundle.mjs:293` | `totalJsRaw 960_000` | 948,435 → **11,565 B** |
| `/live/mempool` gz | `verify-bundle.mjs:320` | `107_000` | 96,835 → 10,165 B |
| SVG-text expectation | `verify-memviews.mjs:647` | `terminal: [1440, 2560]` | bidirectional |
| pan at 390 | `verify-mobile.mjs:40` | `clientW<=420 && scrollW>=850 && left>50` | measured 900 |
| nested rail @1024 | `verify-pageshell.mjs:219` | non-`.shell`-child `.rail` visible, `w>0` | **RED on main** |

## 3 · SCOPE

**IN:** `app/src/mempool/terminal.tsx` (the subject) · `claude/V2-VIEW-CONFORMANCE.md` (§6
exception) · `app/src/styles.css` (the one over-reaching `.rail` selector at `:2643`) ·
`app/verify-memviews.mjs` (`EXPECT_SVG_TEXT.terminal` + a new information-density scenario) ·
this handoff · `handoffs/LOG.md`.

**OUT (non-goals):**
- Wiring `verify-mobile` / `verify-pageshell` / `verify-fit` / `verify-perf` into npm or CI.
  Four orphan gates are now recorded; wiring them is its own task.
- Fixing `verify-perf`'s three pre-existing failures.
- `useChartMetrics`' inert `k`/`u`/`minWidth` inflation (19 call sites).
- Any other mempool view. Any file in `api/`.
- The 11px-vs-12px type-floor standards conflict.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict. `npm run build` runs `tsc --noEmit` first.
- Tokens only — no literal hex/hsl/rgb in the view. Spacing from `--sp-1..7`.
- Charts on `chart-kit`: `VB_W`, `AXIS`, `GRID`, `useSvgCursor`, `ChartCrosshair`, `ChartTip`,
  `useGradientId`. **Cursor math is never re-derived** — `verify-chartkit.mjs` greps
  `/clientX\s*-\s*rect\.left/` tree-wide with no allowlist outside `chart-kit.tsx`.
- Zero `Math.random()`. Zero fabricated values — a live number is real or it is an em-dash.
- **No peer readouts.** The restricted public pool reports 0 and the repo does not publish
  peer zeros at all.
- Reduced motion suppresses ANIMATION, not CONTENT. The body stays; the table is an addition.
- Keep `stats={false}`, the nested `<aside className="rail">`, and `id="terminal"`.
- Do not touch: `api/`, `vercel.json`, `package.json`, any other `src/mempool/*.tsx`.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run build` exits 0 (includes `tsc --noEmit`)
- [ ] `npm run verify:static` — all 21 gates green
- [ ] `verify-memviews` completes (summary line present) and is green
- [ ] `verify-memdetail` completes and is green
- [ ] `verify-reduce` completes and is green
- [ ] `verify-nav` completes and is green
- [ ] `verify-mobile` completes and is green (Terminal still pans at 390)
- [ ] `verify-pageshell` completes and is green — **including** the Terminal nested-rail
      assertion that is red on `260c99f`
- [ ] `verify-chartkit` green with no new `clientX - rect.left` hit outside `chart-kit.tsx`
- [ ] `verify-bundle` green, or the `totalJsRaw` arithmetic explicitly argued with in §7
- [ ] `terminal.tsx` line count inside `verify-memshell`'s `200..1084` band
- [ ] Information-density countable measured by ONE instrument on BOTH endpoints, before and
      after stated, and asserted with a floor so a regression reds
- [ ] Five break tests run, each asserting its mutation APPLIED and reporting its effect size,
      each restored by an owner that survives the mutator's death, tree verified clean after
- [ ] Branch pushed · PR opened **ready for review, not draft** · `mergeable` /
      `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npm run build
npm run verify:static
node scripts/serve-dist.mjs 4173 &          # own port; identify holder with lsof, never ps
node verify-memviews.mjs
node verify-memdetail.mjs
node verify-reduce.mjs
node verify-nav.mjs
node verify-mobile.mjs
node verify-pageshell.mjs
node verify-bundle.mjs
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
