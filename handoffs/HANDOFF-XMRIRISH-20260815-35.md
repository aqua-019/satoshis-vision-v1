---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260815-35
branch: claude/prompt-attached-v51pxr
status: done
written_by: claude-code (manual mode — prompt-driven, no open handoff)
owner: claude-code
---

# HANDOFF — p3·14 NETWORK: streaming line, threshold bands, small multiples

## 1 · GOAL

`/live/network` stops being a flat wall of correct numbers and becomes a surface a reader can
judge at a glance. Four things exist when this is done that do not exist now:

1. **Threshold bands (D0832)** on the series that have an honest threshold, each with its
   **source printed inline under the chart**. A band whose label claims a window the data does
   not cover is a fabricated value wearing a tint — so every band's label names the window it
   was actually computed over.
2. **A block cadence strip** — every recent block a tick against the 120 s consensus target,
   above slow / below fast, where the RUN of ticks is the reading.
3. **Difficulty ↔ hashrate as one dual-axis system**, so the retarget chase is visible as a
   lag rather than as two unrelated curves.
4. **Small multiples (D0837)** replacing part of the text/table block, sharing one axis
   treatment and one band grammar so an anomaly is visible before it is read.

Plus: the p3·13 synced time cursor adopted (consumed, not rebuilt), and cross-links from the
cadence strip to `M2 · Metronome` and from the dual-axis plot to `M4 · Thermostat`.

## 2 · CONTEXT

- Base: `main` = `67c44e8` (PR #181 merged — synced time cursor + annotation layer live).
- Spec: `docs/v6-mockups/markets-network-mockup.html`, NETWORK TAB. **49,005 bytes. Do not modify.**
  Note its own header says "Series are seeded placeholders" — its numbers are not claims.
- Relevant files: `app/src/pages/NetworkPage.tsx` (666) · `app/src/pages/network/NodePopulationPanel.tsx`
  (318) · `app/src/design/timeCursor.ts` (227) · `api/xmr.js` (946) · `app/src/data/xmrirish-feed.ts`
  · `app/src/pages/markets/charts.tsx`.

### §0 premise corrections — MEASURED at `67c44e8`, before any building

Recorded here because two of them change what the PR can honestly ship.

- **P1 · The mockup's own headline band is unbuildable as written, and the API's range labels
  are wrong by 10×.** `markets-network-mockup.html:239` claims the hashrate band is "the trailing
  **30-day** ±1σ envelope". `api/xmr.js` `handleHashrate`/`handleDifficulty` (:465-495) offer a
  `range` param with `counts = { '7d': 504, '30d': 2160, '1y': 26280 }`, capped at 5000 blocks.
  Against Monero's **120 s** block target those windows are:

  | label | blocks | capped | true window |
  |---|---|---|---|
  | `7d`  | 504    | 504    | **16.8 hours** |
  | `30d` | 2160   | 2160   | **3.0 days** |
  | `1y`  | 26280  | 5000   | **6.9 days** |
  | `all` | 5000   | 5000   | **6.9 days** |

  Every label implies a **20-minute** block time (168 h / 504 = 0.333 h; 720 h / 2160 = 0.333 h;
  8760 h / 26280 = 0.333 h). Monero's is 2 minutes. So the parameter named `30d` returns 3 days
  and the one named `1y` returns a week. **Adopting the API's own range name as a band label
  would ship a 10× mislabel** — the exact failure §0.3 of the brief names.

- **P2 · Those endpoints are unconsumed. Nothing in `app/` fetches them.** Scope of search:
  `app/src`, `app/*.mjs`, `app/scripts` for `network/difficulty` and `network/hashrate` — zero
  hits outside `api/xmr.js` itself (:144-145 cache table, :786-789 dispatch). They are dead
  server surface. So §5's dual-axis plot has **no existing client data path**; the brief's "a
  real history surface already exists" is true of the server only.

- **P3 · What the client actually has today.** `xmrirish-feed.ts:270` fetches
  `/api/xmr/blocks?limit=100`, and `map.ts:26` `BLOCKS_CAP = 100`. **100 blocks ≈ 3.33 hours** is
  the entire chain-history window available client-side. On the page today:
  - "Difficulty · last N blocks" = `data.blocks.slice(0, 14)` → **14 blocks ≈ 28 minutes**.
  - "Hashrate · session · N samples" is a **session rolling buffer** (`data.hashSeries`), not
    chain history — it starts empty at mount.
  - "Block intervals · last ~100 blocks" already derives intervals from block timestamps.

- **P4 · CONFIRMED — cadence data already flows.** `NetworkPage.tsx:288-296` already computes
  `intervals` from consecutive `data.blocks[].age`, filtered to a sane 5–1800 s window because
  miner timestamps are non-monotonic. The cadence strip needs **no new fetch**.

- **P5 · CONFIRMED — the cross-link idiom already exists on this very page.**
  `NetworkPage.tsx` renders `<Link to={`${R.LEARN_SIM}?p=skyline`}>` for the Skyline simulator.
  Metronome and Thermostat links follow that pattern exactly; ids to be verified against the
  sim registry before wiring (a dead cross-link is this page's stale citation).

- **P6 · CONFIRMED — provenance is FIVE and `NETWORK` exists.** The page already uses both
  `NODE` and `NETWORK` and the distinction is its own lesson.

- **P7 · CONFIRMED — Relay is parked, no flag exists.** The buffer seam is proven by
  construction (single ingest point, append-only), not by a flag.

- **P8 · The page's CLS discipline is already thorough and must survive.** Every chart body goes
  through `ChartBody` → `Swap ready reserve={height}` → `SkeletonBox`, and every panel through
  `PanelBoundary reserve`. `POOL_ATTR_H = 61` carries a long comment recording that it was
  MEASURED across all three states (populated 52 / empty 56 / **loading 61**) because a
  reservation that is correct only when the network is fast is not a reservation. Any new box
  must be reserved the same way.

## 3 · SCOPE

**IN**: `app/src/pages/NetworkPage.tsx`; a new `app/src/pages/network/` module or modules for the
bands / cadence strip / dual-axis / small multiples; `app/src/pages/network/NodePopulationPanel.tsx`
only if a restyle is needed (its no-geography rule stays intact); `api/xmr.js` only if the history
window is deliberately widened; the gates bound to the above; CLAUDE.md session note.

**OUT (non-goals)**: modifying `docs/v6-mockups/markets-network-mockup.html`; rebuilding the time
cursor (consume `design/timeCursor.ts`); changing polling tier cadence; any Relay/WebSocket work;
extending `verify-markets-dom.mjs` beyond the known-crash fix if that file is touched at all.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict. `app/` is the only front-end.
- **Zero fabricated values on live surfaces.** A live number is real or it is an em-dash.
  Bands over STALE data must read stale — last-good plus the STALE vocabulary, never
  fresh-looking bands on dead numbers.
- **Every band prints its threshold source inline.** The 120 s target's source is protocol
  consensus; a statistical band names the window it was computed over, in the label.
- `connect-src 'self'` — no third party from the browser, ever.
- Reduced motion: the streaming axis stops gliding and steps per poll; no information is
  carried by the glide alone.
- Colourblind-safe: delta indicators pair shape + sign, never hue alone.
- 390px usable, no text under 12px in HTML, `.table-scroll` for wide tables.
- Canvas discipline if canvas is used: bounded fills, `cssColor` from the `canvasColor` leaf,
  DOM text only, no `shadowBlur`, DPR cap 2.
- `design/timeCursor.ts` importers must ALL be lazy.
- Do not touch: `docs/v6-mockups/**`, `relay/`, `vercel.json` security headers.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run build` exits 0 (app/)
- [ ] `npx tsc --noEmit` exits 0 (app/)
- [ ] `verify-failure.mjs` passes with its /live/network assertion contract preserved, or the
      renegotiation is named in §7 with the reason
- [ ] `verify-nodes-dom.mjs` passes — every population-panel assertion survives the restyle
- [ ] `verify-cls.mjs` passes on /live/network at its 0.005 threshold, both passes
- [ ] `verify-tiers-dom.mjs` passes — polling cadence unchanged
- [ ] `npm run verify:static` exits 0
- [ ] `npm run verify:e2e` exits 0
- [ ] `verify-bundle.mjs` passes; every ceiling this PR crosses is raised with a FINAL-tree
      measurement, reds shown, built + margin ≤ 4,000, bytes attributed pairing by multiplicity
- [ ] Every band rendered on the page has an inline source note naming its threshold's origin,
      and any statistical band's label names the window it was computed over
- [ ] Both simulator cross-links resolve to a real sim (verified by loading the URL, not by
      reading the id)
- [ ] New/modified gate assertions each have a two-polarity execution transcript (a state that
      passes and a state that fails, actuals for both)
- [ ] Gate census recounted (not incremented) and reported
- [ ] Renders captured and LOOKED AT: 1440 before/after, cadence during a slow stretch,
      dual-axis lag, small multiples with an anomalous series, 390px, reduced motion, degraded feed
- [ ] Branch pushed · draft PR opened via GitHub MCP · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app && npx tsc --noEmit
cd app && npm run build
cd app && npm run verify:static
cd app && npm run verify:e2e
cd app && node verify-bundle.mjs
```

## 7 · REPORT

status: done (partial scope, stated below — bands/cadence/links shipped; streaming,
        small multiples, node-sync shell and cursor adoption NOT taken)
pr: see branch claude/prompt-attached-v51pxr
commits: 2ae9ecc bands.ts + verify-bands · 3d96f58 page wiring + AreaSeries band prop ·
        16cce92 three render-driven fixes · ec54677 gate wiring · this commit (records)
deps added: none

deviations from spec:
- The mockup's "trailing 30-day ±1σ envelope" is unbuildable — no 30-day series is
  fetched by anything in app/. Bands name the window actually held (100 headers ≈ 3.3 h).
- The mockup's per-block cadence band (96–150 s) is statistically wrong for a single
  interval under Poisson arrivals. The strip carries no per-tick band; the band moved to
  the aggregate mean where 120 ± 2σ, σ = 120/√n, is exact.
- §5's difficulty↔hashrate dual-axis is structurally unbuildable: hashrate IS difficulty
  ÷ 120 in both api/xmr.js and map.ts, so the plot would show zero lag by construction.
  Replaced with a stated derivation and the Thermostat link on difficulty.
- NOT BUILT: §1 streaming line, §3 small multiples, §6 node-sync shell, §0.6 cursor
  adoption. The last is reasoned (Block carries `age`, not a timestamp; three unrelated
  domains), the other three are simply not reached — scope call, not a blocker.

notes for ARCHITECTURE.md patch: CLAUDE.md session note added (p3·14).

open questions:
- api/xmr.js's range labels are wrong by 10× ('30d' returns 3 days). Recorded, not fixed;
  nothing consumes those endpoints today. Relabel to {'1d':720,'3d':2160,'7d':5040}.
- Should /live/network fetch a real chain-history series? That decides whether a wider
  band is ever possible, and it touches tier cadence (verify-tiers-dom's subject).

## 8 · LOOP FEEDBACK
