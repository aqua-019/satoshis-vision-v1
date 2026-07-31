# CLAUDE.md — Project Memory for Claude Code

This file is automatically read by Claude Code at the start of every session.
It serves as persistent memory so context, decisions, and progress carry forward.

---

## Project Overview

**Satoshi's Vision Archive** — An educational static website exploring the evolution
from Bitcoin to Monero, documenting Satoshi Nakamoto's writings on privacy and the
divergent paths of transparent vs. private cryptocurrency.

- **Type**: Static HTML site (no build step, no framework)
- **Hosting**: Netlify / Vercel / GitHub Pages
- **License**: MIT

## Tech Stack

- Pure HTML/CSS/JS (no frameworks, no bundler)
- Netlify config: `netlify.toml`
- Vercel config: `vercel.json`
- No `package.json` — no npm dependencies

## Site Pages

| File                    | Purpose                                      |
|-------------------------|----------------------------------------------|
| `index.html`            | Splash page — privacy evolution overview     |
| `bottom-line.html`      | Full BTC/XMR analysis, timeline, bounties    |
| `hold-monero.html`      | Exchange widget demo (Wagyu + ChangeNOW)     |
| `btc-xmr-education.html` | Visual infographics comparing BTC vs XMR   |
| `quotes.html`           | Interactive Satoshi quote explorer (18 quotes)|
| `secrets.html`          | Deep dive into Satoshi's privacy writings    |
| `timeline.html`         | Historical milestones visualization          |

## Development Conventions

- All pages are self-contained HTML files with inline CSS and JS
- No build process — edit HTML files directly
- Security headers configured in `netlify.toml` and `vercel.json`
- Keep pages consistent in styling and navigation

## Dynamic Features

### PriceService (index.html)
- Shared pub/sub price service: `PriceService.subscribe(fn)` pattern
- Fetches BTC/USD, XMR/USD from CoinGecko, calculates BTC/XMR ratio
- 30-minute refresh interval (was 60s — reduced to respect rate limits)
- Any component can subscribe to price updates via `PriceService.subscribe()`

### WidgetLoader (hold-monero.html)
- IntersectionObserver-based lazy loading for all exchange iframes
- ChangeNOW and Wagyu iframes only load when scrolled into view
- Tracks loaded state to prevent duplicate loads

### SwapTracker (hold-monero.html)
- Users can check ChangeNOW swap status by pasting transaction ID
- Uses ChangeNOW public API (`/api/v1/transactions/{id}/`)
- Color-coded status display with support link
- Clear disclaimer that ChangeNOW handles all swap operations

### LiveRate (hold-monero.html)
- Shows live BTC→XMR conversion rate on swap page
- 30-minute refresh, same CoinGecko source

## Key Decisions Log

<!-- Add decisions here as they are made, newest first -->
- **2026-07-31**: v6.0.11 — mempool view hardening, built ON TOP of the shell
  that landed in main while this was in flight.
  **Read this before starting mempool work**: two streams independently built a
  mempool shell from the same brief. Main's won (it merged first, and its six
  views were already retrofitted); this branch was rebuilt on top of it rather
  than resolving nine conflicting files in its own favour. If you are handed a
  brief that says a prototype or a helper "already exists", verify it against
  the tree *and* against `origin/main` before building — the brief for this work
  named `six-new-a.jsx`, `MemViewShell`, `useMemCanvas`, `MemStatStrip` and
  `ConfirmationLineage` as existing, and at the time none of them did.
  **Correction to an earlier note**: tiered polling DOES now exist.
  `xmrirish-feed.ts` runs three tiers — FAST 3s (mempool + fee estimate), CHAIN
  15s (tip watch, full pull only when the tip moves), MARKET 60s. An earlier
  entry said it didn't; that was true of the pre-v6.0.9 base only. Practical
  consequence for tests: a confirmation count cannot advance faster than the
  15s chain tier, so any gate asserting 0→10 depth needs a timeout above that —
  12s measures the poll schedule, not the tracking.
  What this change adds on top of main's shell: `useMemCanvas.ts` (elapsed-time
  rAF, DPR-capped, visibility AND intersection gated as one predicate, memoised
  glow sprites — `ctx.shadowBlur` is banned and gated, being a full blur per
  draw call); `MemTxTable` + a `table` slot on `MemViewShell`, CSS-gated to
  reduced-motion and ≤768px; `id` → `data-mem-view` and `data-mem-track-phase` /
  `data-mem-track-conf` on TrackChip, which is what makes per-view deep links
  and 0→10 depth machine-checkable at all; the last two `Math.random()` sites
  (`terminal` typing jitter, `reactor` hex pulse) and the last three fabricated
  strings (`reactor` "in ~4 min"/"in ~2 min", `terminal` "target=2:00"); an
  honest overdue ETA (`nextBlockEtaSec` no longer floors at 0 — Poisson arrivals
  make overdue the ordinary case, and a countdown parked on "0:00" is a
  fabricated reading); and a scoped 12px mobile type floor for `.mem-view`.
  **Three constraints that will bite again**:
  (1) `verify-glide.mjs` scenario 4 loads `?v=classic` under
  `prefers-reduced-motion` and asserts the block ribbon STILL renders — so
  reduced motion must suppress *animation*, not *content*. Hiding the view body
  and swapping in a table breaks it.
  (2) `verify-fit.mjs` bounds Reactor's desktop vertical scroll at 200px and it
  already uses ~84px. Anything added below the body eats that headroom; the
  table is `display:none` on desktop for exactly this reason.
  (3) A `<canvas>` is a replaced element AND `.mp-view` is `width: max-content`
  on desktop, so an in-flow `width:100%` canvas is a layout feedback loop — it
  reached 658,432px wide in testing. `.mem-canvas` is `position:absolute` and
  `useMemCanvas` carries a `MAX_DIM` clamp plus a one-shot console warning,
  because nothing errors; it just gets mysteriously slow.
  Also: canvas cannot resolve `var(--x)` — `cssColor()` unwraps it, and
  `glowSprite()` re-resolves defensively, because an exception inside a rAF loop
  unmounts the whole view rather than degrading one particle.
  New gates: `verify-memshell.mjs` (static; prints the line-count table; strips
  comments before grepping, since the code legitimately names the banned
  patterns in its own docs; the useTick check is scoped to canvas paths per §5
  item 7 and REPORTS the four DOM/SVG views that still tick as standing debt),
  `verify-memviews.mjs` (Playwright, every registered view: deep links, cross-view
  stat parity off the raw `data-memstat-value`, tracked-tx idiom, 0→10 depth,
  390px, reduced motion, canvas count), `verify-memperf.mjs` (CDP 6× throttle,
  240 txs, 5th-percentile fps — reports `n/a — DOM/SVG` while no canvas view
  exists). npm: `verify:mem`, `verify:mem:dom`, `verify:mem:perf`.
  **Known gap**: SVG `<text>` inside views still renders below 12px on mobile
  (sediment worst, ~30 nodes at ~4px). `verify-legibility.mjs` excludes SVG
  presentation attributes by design, so `verify-memviews.mjs` reports the count
  rather than failing. HTML text is clean everywhere.
- **2026-03-11**: ChangeNOW custom swap — decided to keep widget approach (not custom API)
  to avoid money transmitter liability. Added swap status tracker as value-add.
  Custom API integration would create shared liability; widget keeps ChangeNOW as
  sole service provider. Site clearly disclaims it does not custody funds.
- **2026-03-11**: CoinGecko API reduced from 60s to 30min interval to respect free-tier
  rate limits and reduce unnecessary calls. Added BTC/XMR ratio pair.
- **2026-03-11**: Iframe widgets now lazy-loaded via IntersectionObserver for performance.
- **2026-03-11**: Established CLAUDE.md memory system for cross-session persistence

## Current Status / Progress

<!-- Update this section as work progresses -->
- Memory system established (CLAUDE.md)
- All 7 pages present and functional
- PriceService dynamic layer added (index.html) — BTC/USD, XMR/USD, BTC/XMR
- WidgetLoader + SwapTracker + LiveRate added (hold-monero.html)
- Exchange iframes now lazy-loaded

## Known Issues / TODOs

<!-- Track open items here -->
- **Cake Wallet integration**: Research deep-linking / URI schemes for direct wallet connection
- **Backend evaluation**: Needed if adding charts/tickers, image/video hosting, multi-ticker dashboards
- **Railway + PostgreSQL**: Evaluate for future dynamic data (historical prices, chart data)
- **Custom ChangeNOW API swap**: Possible but creates regulatory risk — keep as widget for now
- **Wagyu API**: Docs at docs.wagyu.xyz — evaluate for custom DEX UI if widget insufficient

## Architecture Notes — Backend Evaluation

If the project grows beyond static content, here's the recommended path:

| Need | Solution | Hosting |
|------|----------|---------|
| Historical price charts | Node.js + CoinGecko historical API → PostgreSQL cache | Railway |
| Multi-ticker dashboard | Backend cron fetches prices, frontend polls `/api/prices` | Railway |
| Image/video hosting | Cloudflare R2 or Backblaze B2 (cheap object storage) | External CDN |
| Cake Wallet integration | Deep-link URIs (`monero:address?amount=X`) + QR codes | Static (no backend) |
| Custom ChangeNOW swap | Node.js proxy with API key (hides key from client) | Railway |
| Analytics (privacy-respecting) | Plausible or Umami self-hosted | Railway |

**Recommended stack if backend added:** Node.js + Fastify + PostgreSQL on Railway.
Keep current static pages as-is; add `/api` endpoints only for features that need server logic.

## Session Notes

<!--
  Use this section to leave notes for future sessions.
  Format: **YYYY-MM-DD**: Note content
-->
- **2026-07-31**: v6.0.6 "TIERED POLLING" (app/ + api/). Answers "do we need our own
  node for the Network page?" — **no**, except peer data. The starting premise was partly
  stale: the honesty work (peer panel paused not zeroed, provenance badges, a real
  "% unattributed" pool signal, no `genTx`/`randHex` outside `src/protocols/**`) already
  shipped in v5.0.14/v5.0.22, and `app/legacy/shared.jsx` — the simulated `useMoneroLive`
  with `PEERS`/`genTx` — is dead code outside the build. The genuine gap was the polling
  architecture: ONE `setInterval` at 2.5s fired a `Promise.all` over five endpoints, two
  of them uncacheable (`POST /api/monero`; `/api/xmr/network` under a blanket `no-store`),
  so every visitor drove ~24 uncached node-cascade round trips/min while the 120s block
  target meant height was re-fetched ~48× per block.
  Now three tiers via a new `app/src/data/usePolling.ts`: **fast 3s** (mempool + fees),
  **chain 15s** (the already-built-but-never-wired `/api/xmr/tip` watch, pulling
  `network`+`blocks` only when the tip moves), **market 60s** (CoinGecko). Polling stops
  on a hidden tab and resumes with an immediate catch-up; failures back off to a 10s cap
  — via `Math.max(base, …)` so the 60s market tier can never "back off" into polling a
  rate-limited upstream *faster*. `POST /api/monero` is dropped from the React client
  (`api/monero.js` stays — the legacy static site's `js/monero-network.js` still uses it).
  Three traps handled: `hashSeries` now advances only under a `pushHash` flag set by the
  chain tier (a 3s push would fake sparkline resolution); `/api/xmr/tip` returns
  `height - 1` (tip block) vs `/api/xmr/network`'s raw block *count*, so tip is used
  **only as a change detector** — folding it into `height` would sit one block behind
  every explorer; peer zeros are no longer mapped or published at all.
  Server: `api/_nodes.js` gains warm-Lambda cold-marking (exponential 30s→5min cooldown,
  cold nodes **reordered not dropped**, so an all-cold false positive can't blank the
  page); `api/xmr.js` resolves the cascade per-request (was frozen at module scope),
  marks transport failures down but NOT RPC-level errors (a node answering "Method not
  found" is alive), and bounds a cascade walk at 12s — 6 nodes × 6s exceeded the 30s
  `maxDuration`. One `CACHE_CONTROL` table replaces the blanket `no-store`, with
  `s-maxage` matched to each tier so the CDN collapses all visitors into ~1 upstream
  request per interval. Removed every invented fallback (`'0.18.3.4'` daemon version —
  rendered as "Daemon" on /network — the `[20000,80000,320000,4000000]` fee table,
  `|| 300000` block weights, `|| 3200000` emission height, `|| 'mainnet'` nettype);
  these now report null and the client carries last-good.
  New gates: `app/verify-tiers.mjs` (pure backoff maths + static assertions that tier
  cadence and proxy `s-maxage` can't drift apart), `api/verify-nodehealth.mjs`, and
  `app/verify-tiers-dom.mjs` (Playwright, counts requests per URL: cadence ratio, tip
  gating, visibility pause/resume, degrade-to-last-good). `verify-glide.mjs` needed its
  `/api/xmr/tip` fixture driven by the block head, else its blocks-only discriminator
  could never trigger a re-pull; the DOM gates compress tiers via the documented
  `window.__XMR_TIER_MS__` override. CI now runs on PRs to `main` (it only ran on
  `v5-migration`, so PRs to main had NO CI) and executes the 8 offline gates.
  **Not verifiable in-sandbox** (egress to Monero nodes and to xmr.irish is blocked —
  the preview proxy returns 403): height-vs-explorer, hashrate == difficulty/120, live
  mempool movement, and the ~100-vs-300 upstream request count. Check those on a deploy
  preview. `verify-v510.mjs` does zero route mocking so it cannot pass here either —
  pre-existing environmental limit, not a regression.
- **2026-07-30**: v6.0.2 "THREE-LAYER VISUAL SYSTEM" (app/): styling split into
  three CSS layers, imported from main.tsx in this load-bearing order — base
  styles.css, then L3 `styles-ambient.css` (aurora/dust/grain background,
  always on, intensity-scaled), then L2 `styles-theme.css` (chrome palette,
  scoped to `:root[data-theme="indigo"]` + a classic-identity `:root` block),
  then L1 `styles-legibility.css` LAST so no palette rule can ever override a
  readability rule. L1 raises the body-text floor from 11.5px to a 14px-based
  fluid scale (`--fs-hero/h1/h2/body/mono/label`) and fixes two structural
  bugs: `.art-canvas` (a `<canvas>` is a replaced element, so `inset:0` alone
  never stretched it — every particle field was seeding into a 300×150
  top-left corner) and topbar ticker overflow (was silently clipped, not
  scrolled, ~769–1430px). Governing palette rule, enforced by construction:
  Monero orange (`--tk-accent`) means crypto data, never decoration — it
  stays orange in both themes across 32 CSS rules + 235 TSX inline sites;
  chrome instead reads `--ui-accent`/`--ui-primary`, which L2 rebinds per
  theme. That indirection is why the indigo theme toggle didn't require
  touching any of the 235 data call sites. New user-facing surface: a minimal
  two-knob Design panel (Theme: indigo/classic · Ambient: calm/busy/chaotic)
  behind a `⌘ DESIGN` control in the topbar — this is a deliberate *partial*
  reversal of the earlier "tweaks panel is design-time-only" decision; the
  full Accent/Type/Glow/Density tweaks system stays out of the app. New gate:
  `app/verify-legibility.mjs` (static-source-assertion style, matching
  verify-sediment.mjs) — asserts the six-step scale is declared exactly once
  verbatim, no sub-14 inline `fontSize:` object-style survives in
  `app/src/**/*.tsx` (SVG `fontSize="9"` presentation attributes deliberately
  excluded), `.art-canvas` declares both `width:100%` and `height:100%`, L1/L3
  carry zero `[data-theme=` selectors, every non-`@keyframes`/non-classic-`:root`
  rule in L2 is theme-scoped, and L3 doesn't redeclare the `sweep`/`drift`/
  `streamY`/`bg-pulse`/`bg-pulse-soft` keyframe names already in styles.css.
  As of this session the sub-14-fontSize migration across `src/**/*.tsx` is
  still in flight (ui-builder et al.) — the gate correctly fails on it and
  will pass once that work lands.
- **2026-06-12**: v5.0.14 "ALL-REAL DATA" (app/ + api/): removed every simulated/illustrative
  data surface outside `app/src/protocols/**` (the educational simulators, now code-split into
  their own lazy chunk via /simulate). Deleted `app/src/data/simulated.ts`; the feed boots with
  skeletons ("CONNECTING"), shows only node/CoinGecko numbers, and degrades to last-good +
  "STALE · reconnecting" (never synthesis). Peer panels removed (restricted public RPC can't
  see peers) and replaced with real panels: fee tiers, remote-node meta, block intervals,
  block weight, chain totals. Markets: synthetic candle fallback → localStorage stale-cache;
  real per-exchange volume/spread via new CG tickers proxy path; mock order book → real
  liquidity-by-venue. New guards: verify-stale.mjs, verify-allreal-dom.mjs (Playwright,
  mocked-network boot/stale/cache scenarios). Live-origin checks run externally (sandbox
  egress blocks xmr.irish).
- **2026-03-11**: Added dynamic layers — PriceService, WidgetLoader, SwapTracker, LiveRate.
  ChangeNOW widget kept (not custom API) due to liability concerns. Iframes now lazy-loaded.
  Backend evaluation documented: Railway + PostgreSQL recommended if dynamic features expand.
  Cake Wallet integration research started — open-source, uses ChangeNOW/SideShift internally.
  Next steps: Cake Wallet deep-link integration, chart system if backend approved.
- **2026-03-11**: Initial CLAUDE.md created. Repo is a static HTML site with 7 pages,
  deployed via Netlify/Vercel. No build tools or dependencies.


# Per-repo CLAUDE.md — AQUA Stack L3: Orchestrator + Worker Roster

This file assumes the universal LOOPFLOW block (AQUA reference, Appendix C) is installed at `~/.claude/CLAUDE.md`. That block defines the task source (`/handoffs/`), the gate, manual/mobile mode, and the exit (branch → `gh pr create`). This file adds what's new: the agent roster and delegation rules that run *inside* the closed loop.

## Role

You are the L3 lead. Your job is planning, delegation, synthesis, and the gate — not implementation. The economics depend on you not doing token-heavy work in your own context ("plan big, execute small").

## Model & effort policy — v3 hierarchy (2026-07-30)

- **Lead**: Opus 5 (`claude-opus-5`) by default at maximum effort — near-Fable capability at half the rate, no per-model ceiling on Max. **Opus 4.8 is the automatic fallback**; Fable 5 remains an explicit, user-chosen escalation (it bills usage credits). Launch via `./scripts/aqua-lead.sh`. Headless/outer loops: `claude -p --model claude-opus-5 --fallback-model claude-opus-4-8`.
- **Directors**: two Opus 5 agents form the middle tier — `director-build` and `director-quality`. Spawn them **as teammates** (agent teams), because teammates can delegate to their own subagents while plain subagents cannot. Windows note: teammates run in-process in the agent panel.
- **Effort**: the user runs `/effort` (max/ultracode) at session start; teammates inherit the lead's effort, so the whole hierarchy follows. If effort drops mid-session, flag it before a complex handoff.
- **Workers**: all Sonnet 5 (pinned in frontmatter). If Sonnet is degraded, tell the user rather than silently substituting.

## Hierarchy — who directs whom

Lead (Opus 5) owns the handoff and the gate. On multi-surface handoffs, it splits the work into a **build mandate** → `director-build` teammate (directs ui-builder, motion-designer, chain-integrator, backend-api, test-engineer) and a **quality mandate** → `director-quality` teammate (directs design-reviewer, security-auditor, devops-deployer, docs-scribe; returns `GATE: PASS/FAIL` with evidence). Spawn line: *"Spawn two teammates using the director-build and director-quality agent types; build mandate: …; quality mandate: gate the result against §5."*

Small tasks skip the middle tier — the lead delegates workers directly. Directors earn their overhead only when parallel supervision of multiple workers per branch is real; never spawn them reflexively.

## Roster (subagents in .claude/agents/)

| Agent | Model | Owns |
|---|---|---|
| ui-builder | Sonnet 5 | components, pages, styling (AQUA design system) |
| motion-designer | Sonnet 5 | animation, micro-interactions, canvas/WebGL/R3F, generative UI |
| chain-integrator | Sonnet 5 | BTC/XMR/LTC payment flows, wallet RPC, validation |
| backend-api | Sonnet 5 | API routes, websocket services, data layer, contracts |
| test-engineer | Sonnet 5 | unit/integration/e2e tests, machine-checkable §5 criteria |
| design-reviewer | Sonnet 5 | adversarial review: UI, accessibility, payment security |
| security-auditor | Sonnet 5 | secrets, deps, headers/CSP, RPC exposure — codebase-wide |
| devops-deployer | Sonnet 5 | Vercel config, CI pipelines, build failures, perf budgets |
| docs-scribe | Sonnet 5 | ARCHITECTURE patches, §7 REPORTs, LOG.md, manual-mode handoffs |
| researcher | Sonnet 5 | ALL heavy reading: docs, changelogs, RPC references |

Ten workers exist; a task uses the **minimal team that covers it** — typically 2–4 plus a reviewer. Delegation has a floor cost, so never fan out to the full roster reflexively. Typical build chain: researcher → (ui-builder ∥ backend-api ∥ chain-integrator) → test-engineer → design-reviewer → security-auditor (release-adjacent work) → docs-scribe at write-back.

## One revolution of the inner loop

1. **Pick up the task** per the universal block: newest open `HANDOFF-*.md`, flip to `in_progress`. If `§8 LOOP FEEDBACK` has entries, they are highest-priority context.
2. **Verify the premise.** If `§2 CONTEXT` cites external facts (endpoint shapes, library versions), spend one researcher delegation confirming them before building on them.
3. **Decompose** `§1 GOAL` within `§3 SCOPE` into worker tasks. Assign one owner per file — no two agents edit the same file. Launch independent subagents in a single message so they run in parallel. Brief precisely: workers see nothing of this conversation, so each brief carries the goal, owned files, relevant `§4 CONSTRAINTS`, and what done means.
4. **Build** via ui-builder / chain-integrator. You never write feature code yourself; you review interfaces between workers.
5. **Review is mandatory.** Any UI or payment-flow change requires a design-reviewer pass returning APPROVE before the gate. Builder and reviewer must be different agents.
6. **Gate** exactly as the loopflow defines: run `§6 VERIFY COMMANDS`; only `§5 DONE-CRITERIA` counts; the Stop hook (`stop-gate.sh`) blocks exit while boxes remain unchecked.
7. **Exit** per the universal block: branch, PR via `gh`, fill `§7 REPORT` completely.

## Loops (official primitives, mapped to this stack)

- Prefer `/goal` when starting handoff work: criteria = the `§5` boxes, with an explicit cap — e.g. `/goal every DONE-CRITERIA box in the active handoff passes its verify command; stop after 5 tries`. `/goal`'s evaluator is the model-judged layer; `stop-gate.sh` remains the deterministic backstop. Keep both.
- `/loop <interval>` for post-PR babysitting (CI, review comments, Vercel build results).
- `/schedule` for recurring cloud routines. See LOOPS-CHEATSHEET.md for recipes.

## Security invariants (enforce on every delegation)

- No private keys or seed phrases generated, stored, or logged anywhere. Receive-only: xpubs, view keys, wallet-RPC.
- Testnet/stagenet by default; mainnet only on explicit user instruction.
- Payment state is server-confirmed; escalate anything that weakens this.
- Production promotion stays a human click. Never approve or promote a deployment.

## Agent teams (opt-in escalation)

Subagents are the default. Propose an agent team only when workers need to talk to *each other* — competing-hypothesis debugging, multi-angle design exploration. Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (set in `.claude/settings.json` here). Windows note: teammates run in-process in the agent panel (split panes need tmux/iTerm2, unsupported in Git Bash/Windows Terminal). Keep 5–6 tasks per teammate; require plan approval for risky changes; wait for teammates before synthesizing.

## Environment notes (this machine)

Git Bash on Windows 10: launch with `winpty claude` in standalone Git Bash; plain `claude` works in the VS Code integrated terminal.
