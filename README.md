# xmr.irish v5 — integration handoff

A self-contained package for taking the **xmr.irish v5.0 design** into
claude.ai / Claude Code and **migrating the live site to it** (React 18 + Vite +
TypeScript), all seven surfaces, on the existing data backend.

> **New here? Open [`START_HERE.md`](START_HERE.md) first.** It has the
> paste-ready kickoff prompt for claude.ai.

---

## Read in this order

1. **[`START_HERE.md`](START_HERE.md)** — how to use this bundle + the kickoff prompt.
2. **[`V5_FULL_AUDIT.md`](V5_FULL_AUDIT.md)** — ⚠ **read this if you already started.** A deep, surface-by-surface diff: what the shipped build has vs the `repo/` skeleton, and how to close every gap.
3. **[`UPDATED-additions/SUPPLEMENTARY_DETAIL.md`](UPDATED-additions/SUPPLEMENTARY_DETAIL.md)** — the expansive, component-by-component breakdown of every surface (Home, all 6 mempool views, Markets, Network, Monero, Education, Simulate, Run-a-node).
4. **[`UPDATED-additions/MISSING_IN_V5.md`](UPDATED-additions/MISSING_IN_V5.md)** — the focused "what's missing from the skeleton + the code to add it" guide.
5. **[`INTEGRATION_BRIEF.md`](INTEGRATION_BRIEF.md)** — the v4→v5 migration plan, phased.
6. **[`DATA_LAYER.md`](DATA_LAYER.md)** — reuse v4's API/proxy/relay + optimized v5 data design.

## Contents

```
handoff_xmrirish_v5/
├── START_HERE.md            ← read first — kickoff prompt for claude.ai
├── V5_FULL_AUDIT.md         ← ⚠ deep gap analysis: shipped build vs skeleton
├── INTEGRATION_BRIEF.md     ← full migration plan (phases, surfaces, git flow)
├── DATA_LAYER.md            ← data backend: reuse v4 + optimize for v5
├── README.md               ← this file
│
├── UPDATED-additions/        ← ★ THE FIX for the under-specified first handoff
│   ├── SUPPLEMENTARY_DETAIL.md    expansive per-surface component breakdown
│   ├── MISSING_IN_V5.md           what the skeleton lacks + how to add it
│   ├── full-source/               1:1 copy of the shipped source, by surface
│   ├── legacy-dropin/             the JSX missing from repo/legacy/ (port these)
│   ├── app01-source/              the entire content layer (Monero/Education/…)
│   └── to-add/                    NET-NEW TypeScript (App.tsx, data hook, pages, registry)
│
├── design-reference/        ← VISUAL + BEHAVIORAL GROUND TRUTH
│   ├── index.html              the runnable v5 0.1 UI (all surfaces, hash-routed)
│   ├── design-hub.html         pan/zoom design canvas (mempool dirs + protocol sims)
│   └── five01/                 the actual source the HTML loads
│
├── repo/                    ← DESTINATION SCAFFOLD (Vite + React 18 + TS, behind five01)
└── screenshots/             ← 11 pixel targets, one per surface
```

## The one thing to remember

- **`design-reference/five01/` is the spec.** It's what renders the screenshots.
- **`repo/` is the destination.** It's a skeleton, deliberately behind five01.
- **When they disagree, five01 wins.** Port *from* five01 *into* repo's structure.

## How to preview the design locally

Open `design-reference/index.html` in a browser — no build, no install. It runs
the full 0.1 UI on a simulated feed (live XMR/BTC price via CoinGecko if the
network allows). Navigate the top nav to see every surface.

## Target

- **Repo:** `github.com/aqua-019/satoshis-vision-v1`, branch `v5-migration`.
- **Stack move:** vanilla JS / no-build  →  React 18 + Vite + TypeScript.
- **Data:** unchanged backend — v4's `/api/*` proxies + optional Node relay,
  reached through one `useMoneroLive()` hook. (Upgrades in `DATA_LAYER.md` §C.)
- **Must preserve:** no analytics/trackers, no direct RPC from the browser, the
  CSP + security headers in `vercel.json`, and static-export / `.onion` support.
