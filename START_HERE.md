# START HERE — xmr.irish v5 integration

This bundle takes the **xmr.irish v5.0 design** and hands it to Claude (claude.ai
or Claude Code) to **migrate the live site to the new React / Vite / TypeScript
stack** and ship it as v5.

You are the human in the loop. Do this:

1. Upload this whole folder to a **claude.ai Project** (Project knowledge), or
   open it in **Claude Code** at the repo root.
2. Paste the **kickoff prompt** below as your first message.
3. Work through the phases in `INTEGRATION_BRIEF.md` one at a time. Don't let
   the model do all seven surfaces in one shot — review each phase.

---

## What's in the box

| Path | What it is | Treat it as |
|---|---|---|
| `START_HERE.md` | this file | read first |
| `INTEGRATION_BRIEF.md` | the full v4 → v5 migration plan, all 7 surfaces, phased | the build plan |
| `DATA_LAYER.md` | reuse v4's API/proxy/relay + an optimized v5 data design | the data plan |
| `design-reference/index.html` | the v5 **0.1 UI** — runnable, all 7 surfaces, hash-routed | **visual ground truth** |
| `design-reference/design-hub.html` | the pan/zoom design canvas (5 mempool dirs + protocol sims) | option review |
| `design-reference/five01/` | the **actual source** the HTML loads (JSX, design system, data hook) | **source of truth for design + behavior** |
| `repo/` | a Vite + React 18 + TS **skeleton** already scaffolding the migration | the starting codebase |
| `screenshots/` | 11 captured surfaces | pixel targets |

> **Important:** the `design-reference/five01/` JSX is **ahead of** the `repo/`
> skeleton (it has the classic mempool, tx-detail, markets, network, and the
> education pages that the skeleton stubs out). When the two disagree, **five01
> wins** — it is what actually renders the screenshots. The `repo/` is the
> destination scaffold, not the design itself.

---

## Kickoff prompt — paste this as your first message

> You are helping migrate **xmr.irish** from its current vanilla-JS v4 site to
> the **v5 design**, which is a React 18 + Vite + TypeScript app.
>
> **Current site (v4):** `github.com/aqua-019/satoshis-vision-v1` — vanilla JS,
> no build step, Canvas 2D visualizations, the "d10" design system, deployed on
> Vercel with serverless API proxies in `api/` and an optional Node.js relay in
> `relay/` that bridges a `monerod` ZMQ feed to a WebSocket. This data layer
> **works and stays** — we are reusing it.
>
> **Target (v5):** the design in this bundle. `design-reference/index.html` is
> the runnable ground truth; `design-reference/five01/` is its source; `repo/`
> is a Vite + React + TS skeleton already scaffolding the migration.
>
> **Goal:** convert the site to the v5 React/Vite/TS stack — all seven surfaces
> (Home, Mempool, Education, Dashboard/Markets/Network, Monero, Simulate, Run a
> Node) — while keeping v4's privacy properties and reusing its data backend
> through a single `useMoneroLive()` hook.
>
> Read `INTEGRATION_BRIEF.md` and `DATA_LAYER.md` in full before writing any
> code. Then propose a phase-by-phase plan and **stop for my approval before
> Phase 1.** Do not attempt all seven surfaces at once.
>
> Constraints that are non-negotiable:
> - No third-party analytics, no trackers, no external embeds.
> - The browser never talks to a Monero RPC node directly — always through our
>   own proxy/relay (preserve the v4 `api/` + `relay/` pattern).
> - Static-export friendly (Tor / I2P / IPFS / .onion mirror must still work).
> - Keep the existing CSP, security headers, and `cleanUrls` behavior from
>   `vercel.json`.
>
> Start by reading the files and giving me your migration plan.

---

## A note on the repo target

The integration target is **`aqua-019/satoshis-vision-v1`** (the current source
repo). Recommended git flow:

- Branch off `main` as `v5-migration`.
- Land each phase as its own PR against that branch.
- Keep the v4 vanilla pages deployable until v5 reaches parity, then cut over.

See `INTEGRATION_BRIEF.md` → "Git & rollout strategy" for the full sequence.
