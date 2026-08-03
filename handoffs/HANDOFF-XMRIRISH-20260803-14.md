---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260803-14
branch: claude/v6-1-7-network-nodes-336pwp
status: in_progress    # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, self-authored)
owner: claude-code
---

# HANDOFF — v6.1.7 · Network node population via monero.fail

## 1 · GOAL

`/live/network` gains a live **public node population** panel — reachable count with a
clearnet/Tor/I2P split, an availability distribution from the rolling check history, and **height
agreement with the lagging set surfaced**, which nothing on the site shows today. It is fed by a new
same-origin `/api/nodes` CommonJS proxy over `https://monero.fail/health.json` (the browser cannot
reach it: CSP is `connect-src 'self'`), and badged with a fifth `NETWORK` provenance source distinct
from `NODE`. The paused "Connections · peer telemetry" panel is restated as the *"your node"* half of
a two-part shell, so the v7 self-hosted-node path slots in beside *"the network"* without a redesign.
The orphaned `api/monero.js` is settled by deletion, in this same PR, because `status.js`'s
`ENDPOINTS`, `verify-lib.mjs`'s `STATUS_FIXTURE.endpoints` and the new parity assertion form one
consistency triangle.

Labelling discipline, non-negotiable: **"public node population, sampled by monero.fail"** — never
implied to be this site's own peer list.

## 2 · CONTEXT

- Source: prompt 08 of 19 (v6.1.7), plus `SPEC-v6.1.7-node-population.md` and Addenda 1–3 from the
  operator. Baseline `main` = `09c35c7` (merge of PR #160, AQUA v4.1).
- Plan of record: `/root/.claude/plans/v6-1-7-network-node-frolicking-kay.md` (approved).
- Design reference: `docs/v6-mockups/coldboot-splash.html:520-551` — readout structure lifted, its
  `Propagation` row (self-labelled *Illustrative — not observable from a node*) and all its numbers
  deliberately not lifted.
- Key files: `api/status.js` (CJS handler + leak precedent), `api/markets.js` (quality→TTL),
  `api/verify-status.mjs` (offline gate template), `app/src/data/useApiStatus.ts` (store pattern),
  `app/src/pages/NetworkPage.tsx:552-575` (the slot), `app/src/design/provenance.tsx`.

## 3 · SCOPE

**IN:** `api/nodes.js` + fixtures · `api/verify-nodes.mjs` · `app/verify-nodes-dom.mjs` ·
`app/verify-fixtures.mjs` (shared) + the ENDPOINTS parity assertion · `useNodePopulation.ts` ·
the node-population panel + the two-part shell on `/live/network` · the fifth `NETWORK` ProvSource ·
the `api/monero.js` deletion sweep · doc corrections this PR makes necessary.

**OUT (non-goals):** the D0837 per-node sparkline grid (deferred — see §7) · any globe, map or
coordinate treatment · publishing node hostnames on the wire · a seventh `FeedKey` · widening
`PanelBoundary` · fixing the `--c-50`/SESSION contrast gap · resolving the 11px/12px floor conflict ·
adding `/live/network` to `verify-vitals.mjs`'s budgets · touching the three orphaned gates.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node ≥22.18. `api/` is **mixed** — `_nodes.js`, `feeds.js`,
  `monero.js`, `status.js`, `xmr.js` are CommonJS; `coingecko.js`, `markets.js` are ESM. Match the
  file you are next to; never convert one in passing. `api/nodes.js` is **CommonJS**.
- CSP `connect-src 'self'`; zero third-party browser requests; fonts self-hosted.
- `Math.random()` only in `app/src/protocols/`. Zero fabricated values on live surfaces.
- 390px usable; every animation ships a `prefers-reduced-motion` path that loses no information;
  every route keeps its `noscript` block and background floor.
- Do not touch: `.claude/settings.json`, `.claude/hooks/`, dated records in `handoffs/` other than
  this file and `LOG.md`. No per-prompt session note appended to `CLAUDE.md`.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

From the prompt's Verify list plus spec §5.

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run lint` — **N/A, script does not exist in `app/package.json`**
- [ ] `npm run test` — **N/A, script does not exist**; the `verify-*.mjs` suite is the test layer
- [ ] `/api/monero` settled — `api/monero.js` deleted, no unreferenced serverless function left in
      `api/`, and no stale `vercel.json` `functions` key (a key naming a missing file is a hard
      Vercel build error)
- [ ] Tor / I2P split present and correct — asserted against the committed fixture
- [ ] Height-disagreement clusters surface correctly — asserted against a fixture with a constructed
      lagging set, with the `> 2` boundary asserted on **both** sides
- [ ] No zeros rendered as peer data anywhere on `/live/network`
- [ ] monero.fail unreachable → honest empty state, no invented values, endpoint named
- [ ] `NETWORK` badge present and distinct from `NODE`
- [ ] `/api/nodes` cached; the `Cache-Control` header verified locally for full and degraded
- [ ] node count matches monero.fail's own page ± sampling — **BLOCKED, not checkable here**
      (sandbox egress to monero.fail is 403 on CONNECT). Recorded via `R.skip()`, counted
      separately, never folded into a pass, and named as blocked in the PR body.
- [ ] `node ../api/verify-nodes.mjs` passes
- [ ] `node ../api/verify-status.mjs` passes (ENDPOINTS parity after the deletion)
- [ ] `npm run verify:static` passes
- [ ] `npm run verify:bundle` passes
- [ ] `npm run verify:e2e` passes
- [ ] Two-polarity execution transcript recorded per new or modified assertion
- [ ] Break-test mutations reverted; `git status --short` clean and the MUTATION/BREAK-TEST sweep
      empty **before** the final chain runs
- [ ] design-reviewer returned APPROVE (UI change)
- [ ] Branch pushed · ready (non-draft) PR opened via the GitHub MCP · `mergeable: true` ·
      `mergeable_state: clean` · every check concluded green on the final head SHA

## 6 · VERIFY COMMANDS

Run from `app/`, in order. Reported in the PR body **named individually, never as `verify:*`**.

```
npm run typecheck
npm run build
node ../api/verify-nodes.mjs
node ../api/verify-status.mjs
npm run verify:static
npm run verify:bundle
node scripts/serve-dist.mjs &
npm run wait-preview
npm run verify:e2e
npm run verify:all
```

## 7 · REPORT — filled on exit, completely

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

**Must name (spec §7):** the deferred D0837 sparkline grid with its reasoning · the `--c-50`/SESSION
contrast gap as pre-existing · the 11px vs 12px floor conflict · the blocked live-count comparison ·
the orphaned-gate mocks left alone deliberately · the no-hosts-on-the-wire decision.

## 8 · LOOP FEEDBACK

- **2026-08-03 · UNVERIFIED-class catch, firing upward.** The verifier session asserted that nothing
  in the gate suite proved the browser makes zero third-party requests, having read
  `verify-origins.mjs` phase 1's named guards (`:109` fonts.bunny.net, `:110` JS CDNs, `:116` pool
  APIs) and presented that conclusion as a measurement. The build session measured phase 2 — which
  collects every non-`base` request URL across seven routes including `/live/network` and asserts
  `offOrigin.length === 0`, generically by origin — and reversed it. Recorded because this is the
  claim-kind rule firing **upward against an instruction** rather than downward against a worker's
  return: the direction nobody designed it for, and the one where an unchallenged bad premise costs
  most, because it arrives with authority attached. The rule is not "workers must cite their reads";
  it is "claims must carry their kind", and it binds whoever made the claim.
- **2026-08-03 · spec mis-citation, tree wins.** `SPEC-v6.1.7` §2.7 justified a `vercel.json`
  `functions` entry with *"`feeds.js`, also a single-upstream proxy, is already 15."* Measured:
  `api/feeds.js` carries **seven** `fetch(` sites (`:238, :251, :282, :287, :326, :354, :362`),
  including a deliberately concurrent `Promise.allSettled` pair at `:281-290`, and its own comment at
  `:262-266` states the 15 is headroom against chained 8s timeouts. Found by re-testing the reversal
  accepted with the least scrutiny. Standing rule adopted: where a spec citation and the tree
  disagree, the tree wins and the disagreement is recorded here.
- **2026-08-03 · `CLAUDE.md:31` count is one short, by a depth trap.** It reads "66 `verify-*.mjs`
  files (`app/` ×61, `api/` ×5)". Measured at full depth: 61 + 5 + **1** = 67; the missing file is
  `app/scripts/verify-all.mjs`, one directory deeper than an `app/verify-*.mjs` glob reaches. Same
  trap that once produced 63 where the answer was 64.
- **2026-08-03 · `verify-vitals.mjs` blind spot, named not fixed.** `/live/network` is budgeted in
  `verify-cls.mjs` (`0.005`) but absent from `verify-vitals.mjs`'s `BUDGETS`, so layout shift on the
  new panel is caught and CPU/vitals regression is not.

- **2026-08-03 · PATTERN, three instances, all three layers: a conclusion drawn from an artifact
  without checking whether the wall was real.**
  (1) A worker (U6) hit `npx playwright install` → HTTP 403 and concluded e2e was impossible here,
  shipping a stack of UNVERIFIED items. The 403 is real; the conclusion was not. Chromium is
  pre-installed and the repo's own `launchChromium()` finds it — every one of those items was
  measurable, and measuring them closed the panel's biggest open risk (CLS 0.0000 live).
  (2) The verifier session asserted a coverage gap in `verify-origins.mjs` after reading phase 1's
  named guards, without reading phase 2 — which already held the invariant generically.
  (3) The verifier session ran six gates that printed `Node.js v22.22.2` and nothing else, and was
  one step from reporting that U8 had broken four gates. The real error was
  `ERR_CONNECTION_REFUSED`: its own `serve-dist` had died. Nothing to do with the commit.
  The remedy is identical in all three and costs nothing: **read the actual error, not the last
  line.** Worth carrying into 09–10 because it has now bitten a worker, the build session and the
  verifier — it is not a tier property.

- **2026-08-03 · break-test reverts fail silently, four mechanisms, so the revert needs its own
  verification.** Four break tests this session left a mutation in the tree: `cd` drift twice (paths
  resolved against the wrong directory, so both mutate and restore no-oped — harmless), once because
  **`git checkout -- <file>` silently does nothing for an UNTRACKED file** (a brand-new gate, so the
  printed "restored" line was false), and once because a killed wrapper never reached its restore.
  In every case the tree was known-clean because it was checked, never because the revert was
  trusted. Two consequences adopted: new files need a real backup copy, not `git checkout`; and
  **where a failing polarity can be produced by driving a state the code already reaches, prefer
  that over mutating source** — there is no revert step to fail. The `verify-cls` mock-reach
  assertion was proven that way, by probing the unmocked state directly.
  (Related, minor: `pkill -f serve-dist` matches its own shell's command line and kills the caller.
  Both sessions hit it.)

- **2026-08-03 · a break test that breaks nothing reports success identically to one that does.**
  The `kind`-only polarity for the ENDPOINTS parity assertion passed green on first attempt because
  the mutation hit the first `kind: 'network'` in the file — which was inside the explanatory
  comment written in that same commit, not the fixture data. Re-run against the data at `:79`, it
  reds correctly. The lesson is not "be careful with sed": it is that a break test's *negative*
  result is only evidence if you confirm the mutation landed where you aimed it.
