---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260816-36
branch: claude/prompt-attached-p9vkqe
status: in_progress        # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — task arrived as a prompt, p3·14b)
owner: claude-code
---

# HANDOFF — p3·14b · NETWORK COMPLETION: honest window surface, streaming line, small multiples, node-sync shell

## 1 · GOAL

`/live/network` completes the five items PR #182 (`7589c50`) stated as not-reached or
deferred — but only after the API surface underneath them stops lying about its own
windows. When this is done: `api/xmr.js`'s two history handlers share ONE range table
whose labels name the windows they actually serve (the recorded 9.92× `?range=all`
split between `handleHashrate` and `handleDifficulty` is gone, and no label promises a
window 10× what it returns); the client consumes that surface for the first time
through the chain polling tier; the difficulty series renders as a windowed, appending
streaming line whose axis advances because time does and whose ingest is ONE seam a
future socket can replace; a small-multiples grid renders the new series beside the
existing session panels under one axis treatment and one band grammar; and a node-sync
shell reads height against the network tip, composed so a "your node" column slots in
beside "the network" without redesign.

## 2 · CONTEXT

- Base: `main` = `7589c50` (PR #182 merged). Fresh branch, draft PR, stop at
  "PR opened, `mergeable_state` reported."
- Spec for §2–§3 geometry: `docs/v6-mockups/markets-network-mockup.html` (read-only),
  Network tab — small multiples at :264-270 and :797-828, streaming at :838-851,
  bands at :229-262. D0993 (node-sync shell) has NO mockup; §1 has no mockup — its
  spec is the audit table produced in #182 and re-verified here.
- #182's standing findings that BIND this work:
  - The mockup's "trailing 30-day ±1σ" hashrate envelope is not drawable from this
    chain at any range the handlers serve. The band's window label must name the
    window actually held.
  - The mockup's "Difficulty ↔ hashrate ... plotted together the lag is the story"
    panel is structurally unbuildable: `api/xmr.js:438,:482` and `map.ts:166` all
    compute hashrate as difficulty ÷ target, so the two series are one measurement
    and the drawn "lag" would be exactly zero by construction. #182 replaced it with
    one sentence and a Thermostat cross-link on DIFFICULTY. That stands.
  - The cadence band is on the AGGREGATE, never per-tick (Poisson arrivals:
    P(>200s)=0.1889, P(>150)=0.2865, P(<96)=0.5507 on a healthy chain).
- Files expected in scope: `api/xmr.js`, `app/src/pages/network/**`,
  `app/src/data/{usePolling,xmrirish-feed,map}.ts`, `app/verify-*.mjs`,
  `api/verify-*.mjs`, `app/verify-bundle.mjs` (budget literals), CLAUDE.md.

### §0 RE-VERIFIED — one premise overturned, two defects added

Full measured contract: `scratchpad/S1-CONTRACT.md`. Headlines:

- **The recorded 9.92× `?range=all` split is real arithmetic and NOT the main
  defect.** `RESTRICTED_BLOCK_HEADER_RANGE = 1000` (monerod
  `src/rpc/core_rpc_server_commands_defs.h`) rejects any span over 1000 headers on
  a restricted node — which is every node in this site's cascade. `api/xmr.js:471`
  clamps to 5000, not 1000. So `30d` (2160), `1y` (26280→5000) and `all` (5000) all
  exceed it: monerod answers `"Too many block headers requested."`, `rpc()` returns
  `null` (`:68`/`:74`), and both handlers convert that to `[]` at `res?.headers || []`.
  **Three of the four documented range keys have never returned one data point on any
  node this site uses.** Only `7d` (504 → span 503) works, and it serves 16.8 h.
- **CLAUDE.md's own 10× figure is right for `7d`/`30d` and wrong for `1y`**: `1y` is
  clamped to 5000 before it reaches the node, so its label overstates by 52.6×, not 10×.
- **The downsampler drops the newest headers.** `filter((_,i) => i % step === 0)` keeps
  the last index only when `(len-1) % step === 0`; at 504/step 2 the tip is dropped. The
  series' right edge is not the tip — fatal for a line that appends at that edge.
- **A degraded payload is cached at the full TTL.** Both endpoints carry
  `s-maxage=300`; an RPC failure returns `[]` under that same header, so one transient
  error is served as "no history" for five minutes.
- **RPC cost is flat** — 2 calls at every range — so relabelling adds zero upstream load.
- **`map.ts:259` discards the block timestamp** the server already sends
  (`api/xmr.js:298`), keeping only `age` in seconds. Appending from `data.blocks` would
  therefore reconstruct time via `Date.now()` and drift against the seed's real
  block-header timestamps — two time bases on one axis.
- **`xmrirish-feed.ts` is eager** — measured: `dist/index.html` names
  `assets/index-DbWNS2XT.js`, which contains all three feed endpoint literals. So the
  new fetch is page-local via `usePolling`, not a new `FeedKey`.
- **Budget baseline at 7589c50** (isolated worktree, `verify-bundle` 27 passed):
  eagerJsRaw 262,875/280,000 · eagerJsGz 88,200/96,000 · cssGz 17,762/18,200 (438 B) ·
  lazyJsRaw 849,308/852,000 (2,692 B) · totalJsRaw 1,112,183/1,115,000 (2,817 B) ·
  `/live/network` 109,869/113,000 (3,131 B) · 67 chunks against 64±4 = [60,68].
- **`verify-resilience.mjs:316`'s `also=` regex captures `/api/<one-segment>` only**, so
  a sub-path `also=` is never matched and never checked, under a message that reads as
  coverage.

## 3 · SCOPE

IN:
- §1 One shared range table across `handleHashrate` / `handleDifficulty`, truthful
  labels, rounding decided out loud, no added RPC load without stated cache math.
- §2 Streaming difficulty line (D0828) + small-multiples grid (D0837).
- §3 Node-sync shell (D0993) with the v7 "your node" seam.
- §4 Gate work: api gate for §1, page assertions for the no-re-render claim and the
  shared-scale rule, `verify-bands` extension for any new band shape. Two-polarity
  transcripts per new/modified assertion.
- Budget raises with FINAL-tree re-measure and per-chunk attribution.

OUT (non-goals):
- Any change that adds upstream RPC load without its own stated cache arithmetic.
- Re-designing the bands, the cadence strip, or the health chip from #182.
- A real WebSocket. The seam is proven by construction; the transport is not built.
- Extending `DEEP_DAYS` / the markets request budget.
- `verify-markets-dom`'s featureless-tree crash guard UNLESS that file is touched.

## 4 · CONSTRAINTS

- `api/xmr.js` is CommonJS — match the file, do not convert it.
- Zero fabricated values on live surfaces. A live number is real or it is an em-dash.
  Degradation is last-good + "STALE · reconnecting", never synthesis.
- `Math.random()` only inside `app/src/protocols/`.
- CSP `connect-src 'self'` — the browser reaches no third party.
- Provenance: every displayed figure names its source from the five `ProvSource`
  members; freshness is DERIVED via `<NodeProvenance status=…>`, never a literal.
- Usable at 390px, no text under 12px, `prefers-reduced-motion` path loses no
  information (streaming steps per poll; it does not glide).
- `/live/network` is CLS-gated at 0.005 — every new box reserved.
- eager JS must not move (non-view PR).
- A new fetch obeys `usePolling`'s tier cadence and the s-maxage pairing rule.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run build` (in `app/`) exits 0
- [ ] `npm run verify:static` exits 0
- [ ] `npm run verify:e2e` exits 0
- [ ] `node verify-bundle.mjs` exits 0 on the FINAL tree, every raised ceiling
      red-then-green demonstrated and every moved chunk attributed by full filename
- [x] The api gate covering `api/xmr.js` exits 0 and every new assertion runs against a
      COMMITTED negative control reproducing the pre-fix handlers, per assertion
      **REWORDED, and the original wording was unsatisfiable.** It read "contains new
      assertions that go RED against the pre-fix handler". Measured by the quality
      director: running the gate against the real pre-fix `api/xmr.js` produces not one
      ❌ — it throws `TypeError: Cannot convert undefined or null to object`, because
      that module exported neither `HISTORY_RANGES` nor `resolveHistoryRange`. **A crash
      is not a red assertion**, and a `❌` grep over a crash returns empty, which reads
      exactly like "no failures". `api/_fixtures/xmr-history-prefix.mjs` is the
      substitution, and it is stronger than the original ask: the red polarity is a
      committed file rather than a mutation someone must remember to revert.
      `node api/verify-history.mjs` → 81/81.
- [ ] `?range=<every key>` returns the SAME point count from both history handlers —
      asserted, with the failing pre-fix transcript quoted
- [ ] Every range label's implied window equals the window the handler serves at the
      120 s target, asserted in the gate
- [ ] **REWORDED — the original was measured FALSE and I would not sign it.** It read
      "the streaming buffer appends without a React re-render". Measured: renders grew
      33 → 219 over 26 s, ~2 per fast-tier tick. The panel legitimately re-renders when
      a block arrives; what it must not do is re-render on commits it has no interest in.
      The true claim, and the one the gate must assert:
      **the streaming panel's render count tracks the chain tier's own full pulls
      (network + blocks) ONE-TO-ONE, and is provably insensitive to the 3 s fast tier
      and the 60 s market tier, which it does not read.**
      Measured over 24 s / 21 fast ticks / 3 chain full-pulls, reproduced 3× each:
      before — 48 renders, 2.29 per fast tick; after — 3 renders, **0 of 21 fast ticks
      caused a render, 1.00 render per chain full pull.** Gate assertion still owed.
- [ ] The small-multiples grid asserts ONE shared axis treatment and the stated scale
      rule, red under a mutation that gives one tile its own scale
- [ ] `verify-cls` still green for `/live/network` at its 0.005 ceiling
- [ ] `verify-failure` still green (any new charted panel carries its STALE watermark)
- [ ] `verify-provenance` green — every new figure names its source, no literal
      `fresh="live"` outside the reasoned allowlist
- [ ] Gate census RECOUNTED (not incremented) and written into CLAUDE.md
- [ ] Renders captured and LOOKED AT: stream mid-append, multiples with one anomalous
      series, sync shell fed AND empty, 390px, reduced motion, degraded feed
- [ ] design-reviewer returned APPROVE
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app && npm run build
cd app && npm run verify:static
cd app && npm run verify:e2e
cd app && node verify-bundle.mjs
cd api  && node verify-<the gate that owns xmr.js>.mjs
```

## 7 · REPORT — filled on exit

**status:** delivered, draft PR open. Stopped at "PR opened, `mergeable_state` reported"
per the brief; the operator merges by hand.

**pr:** https://github.com/aqua-019/satoshis-vision-v1/pull/183

**commits:** `38cdc66` §1 one honest range table + `api/verify-history.mjs` (81 assertions,
committed negative control) · `bef26f0` `also=` matcher saw only one path segment ·
`69e503d` §2/§3 components · `c8de288` + `9167de6` budget raises, re-measured on the final
tree · `31acc5e` identifier resolution + deterministic fixture · `ce3e3ef` three
re-judgment findings closed (R1/R2/R3) · `0199974` one copy of the seed path, and a
docblock that had stopped being true · `5bf493d` the mock that mapped history onto
`get_info` · `39e7d5e` memoised stream return · `ecc4da3` the caption that read as a
zero-width instant · `a6b74be` swallowed timeout separated slow from broken · `a956052`
`verify-stream.mjs` + the Tor bound that named the wrong five · `7857887` derive the
allowance from the list it allows · plus CLAUDE.md and handoff records.

**deps added:** none.

**deviations from spec:**
- §1's range table stops at `1d` (720 blocks) rather than reaching for a week. Paging is
  refused in-file with the reason: every range downsamples to ~200 points, so a deeper
  window buys span at the cost of resolution for the same pixels.
- The mockup's 30-day ±1σ envelope remains undrawable and is not drawn. The ceiling moved
  from 3.3 h to 24 h, not to 30 days.
- The DONE-CRITERIA box on re-renders was measured FALSE and was REWORDED rather than
  signed; the box on pre-fix reds was UNSATISFIABLE and was reworded to what the committed
  negative control actually proves.
- No security sweep, no independent CI pass, and no second reviewer on the gate edits —
  flat-mode absences, recorded as absences rather than as passes.

**notes for ARCHITECTURE.md patch:** the `/live/network` streaming path is page-local by
design — `usePolling("chain", …)` from a lazy route, with `PanelBoundary`'s `also=` and
`NodeProvenance`'s computed `phase` for a surface outside the `FeedKey` union. The reason
is measured and belongs in any future summary: `xmrirish-feed.ts` is EAGER, so a new
`FeedKey` would move eager bytes. `diffBuffer.ts` imports nothing at all, which is what
makes "a socket is a data-source swap" provable rather than asserted.

**open questions:**
- Live-node behaviour is unverifiable in-sandbox (no egress to Monero nodes). The range
  table, the span clamp and the degraded cache TTL are proven offline against a committed
  negative control; confirm on a deploy preview that `?range=1d` returns points where
  `?range=30d` used to return `[]`.
- `verify-effects`' ledger is scoped to `src/data/`, so the streaming hook's effect sits
  outside it — second release running that a data-fetching hook escaped it by living in a
  page directory. A scope decision someone should take deliberately.
- No human has seen the rendered result in a browser; the seven captures were read from
  screenshots.

## 8 · LOOP FEEDBACK

### CORRECTION — `5bf493d`'s commit message is WRONG and this is the record

That commit says "the seed is fetched and never merged" and calls it §2's headline
feature not working. **It is not established, and direct measurement contradicts it.**

Measured by the lead against the same HEAD build `verify-failure` ran on, with a route
mock replicating the gate's own router (`network/difficulty` matched before the bare
`network` arm), reading the exact attribute the gate reads:

```
t=1500ms   data-stream-points=200  renders=5   title="Difficulty · streaming · 24 h · 200 points"
t=4000ms   data-stream-points=200  renders=7   title="Difficulty · streaming · 24 h · 200 points"
t=8000ms   data-stream-points=200  renders=9   title="Difficulty · streaming · 24 h · 200 points"
t=12000ms  data-stream-points=200  renders=11  title="Difficulty · streaming · 24 h · 200 points"
```

200 points from a 40-entry blocks fixture plus a 200-point seed, and a SERVER-DERIVED
`24 h` window label. A rendered capture of the same build shows the panel header
`DIFFICULTY · STREAMING · 24 H · 200 POINTS` and the provenance strip
`SEEDED HISTORY + CHAIN TIER`. **The seed merges and the envelope meta reaches the panel.**

`verify-failure`'s two new assertions still red reproducibly, reporting 40 points. So two
honest measurements disagree, and the open question is **which one has the wrong subject**
— routed to the gate's owner. The prime suspect is the gate's own
`waitForFunction(… > 40, {timeout: 10000}).catch(() => {})`: **a swallowed timeout makes a
SLOW seed and a BROKEN seed indistinguishable at that call site.**

**The process failure is the lead's and it happened twice.** A subagent's red was relayed
as a settled defect and dispatched as a fix instruction, without the lead measuring it
first — once for the freshness defect (which a later commit had already fixed) and once
here. Both times the measurement said otherwise, and both times a builder was sent at
code that worked. The rule this leaves: **a red is a report until the lead has reproduced
it; the dispatch happens after the reproduction, not before.**

The commit message is left standing rather than rewritten, because the repo's history is
a record and a correction that erases what it corrects is worth less than one that does not.
