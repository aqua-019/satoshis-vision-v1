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
- [ ] The api gate covering `api/xmr.js` exits 0 and contains new assertions that go
      RED against the pre-fix handler (two-polarity transcript shown)
- [ ] `?range=<every key>` returns the SAME point count from both history handlers —
      asserted, with the failing pre-fix transcript quoted
- [ ] Every range label's implied window equals the window the handler serves at the
      120 s target, asserted in the gate
- [ ] The streaming buffer appends without a React re-render — asserted by a page gate
      that counts renders, red under a mutation that re-renders per tick
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

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
