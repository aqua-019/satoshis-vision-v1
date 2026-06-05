# xmr.irish v5 — integration handoff

A self-contained package for taking the **xmr.irish v5.0 design** into
claude.ai / Claude Code and **migrating the live site to it** (React 18 + Vite +
TypeScript), all seven surfaces, on the existing data backend.

> **New here? Open [`START_HERE.md`](START_HERE.md) first.** It has the
> paste-ready kickoff prompt for claude.ai.

---

## Read in this order

1. **[`START_HERE.md`](START_HERE.md)** — how to use this bundle + the kickoff prompt.
2. **[`INTEGRATION_BRIEF.md`](INTEGRATION_BRIEF.md)** — the v4→v5 migration plan, phased, all 7 surfaces.
3. **[`DATA_LAYER.md`](DATA_LAYER.md)** — reuse v4's API/proxy/relay + optimized v5 data design.

## Contents

```
handoff_xmrirish_v5/
├── START_HERE.md            ← read first — kickoff prompt for claude.ai
├── INTEGRATION_BRIEF.md     ← full migration plan (phases, surfaces, git flow)
├── DATA_LAYER.md            ← data backend: reuse v4 + optimize for v5
├── README.md               ← this file
│
├── design-reference/        ← VISUAL + BEHAVIORAL GROUND TRUTH
│   ├── index.html              the runnable v5 0.1 UI (all 7 surfaces, hash-routed)
│   ├── design-hub.html         pan/zoom design canvas (mempool dirs + protocol sims)
│   └── five01/                 the actual source the HTML loads (design system, views, data hook)
│
├── repo/                    ← DESTINATION SCAFFOLD
│   └── (Vite + React 18 + TS skeleton — routes, data seam, typed tokens, porter)
│
└── screenshots/             ← 11 pixel targets, one per major surface
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
