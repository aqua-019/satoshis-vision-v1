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

- **2026-08-03 · SIX stranded break-test mutations, FIVE distinct mechanisms, across BOTH sessions —
  and the conclusion is a method, not a warning to be careful.**
  Mechanisms observed: `cd` drift twice (paths resolved against the wrong directory, so mutate and
  restore both no-oped) · **`git checkout -- <file>` silently does nothing for an UNTRACKED file**,
  so the printed "restored" line was simply false · a killed wrapper that never reached its restore ·
  **an interrupted tool call** — the patch had already written, the revert line never ran (the
  verifier's, on its own worktree) · and one where the mutation **never applied at all**
  (`substring not found`), so a green run would have been offered as proof of a break test that did
  not happen.
  Every one failed **silently**, and in every case the tree was believed clean because a line had
  been *printed*, not because anything was checked. Discipline does not fix this: the verifier had
  the revert on the same command line as the mutation and it still stranded, because the failure
  mode is *the revert not executing*.
  **METHOD ADOPTED — where a state the code already produces can demonstrate the polarity, probe it
  instead of mutating source.** No source touched, no revert step to fail, and it is cheaper to
  write. Two assertions this session were proven that way and both are strictly better than the
  mutation they replaced: `verify-cls`'s mock-reach guard (probe the unmocked state) and
  `verify-nodes-dom`'s 12px rule (inject a 9px span into the live page).
  **COROLLARY — verify the revert by `git status` / grep, never by the line you printed saying you
  reverted.** This is the "read the actual error, not the last line" rule from the serve-dist false
  alarm, applied to writes instead of reads.
  (Related, minor: `pkill -f serve-dist` matches its own shell's command line and kills the caller.
  Both sessions hit it.)

- **2026-08-03 · AN ASSERTION OVER A SELECTED SET IS STRUCTURALLY BLIND TO ITS OWN EMPTINESS.**
  `verify-nodes-dom`'s 12px check selected `[class*="grid"]`, matching **0** elements (the panel's
  grid is inline `display:grid`, not a class), so `rows.length === 0` passed on every input forever
  while the panel carried three 11px lines. The fix added a guard requiring ≥8 leaf nodes measured.
  The verifier then restored the broken selector on a throwaway copy and ran it — **the measure
  assertion still passed, vacuously, on zero elements; only the guard failed.** That is the strongest
  available form of the claim: the defect is still present inside the assertion the guard protects,
  and the guard catches it anyway.
  **GENERALISED RULE: any assertion whose subject is a selected set needs a companion asserting the
  set is non-empty.** The assertion cannot detect its own emptiness — that is structural, not an
  oversight, and no amount of care in writing the predicate fixes it.

- **2026-08-03 · the reviewer's value was the INSTRUMENT, not the diligence.** `design-reviewer`
  found that vacuous assertion. The gate's author and the lead both missed it — in a correction the
  lead had personally specified, during the round whose entire subject was vacuity. Neither missed it
  through carelessness: both were **reading the assertion**, and the reviewer **measured the page**.
  The argument for keeping an independent review step is therefore not "a second pair of eyes is more
  careful" but "a different instrument sees a different failure class". Worth preserving when the
  review step looks like overhead.

- **2026-08-03 · two strand-free break-test techniques, for different targets.** Both avoid the
  revert-never-executes failure that stranded six mutations.
  **INJECTION** — drive a state the code already produces (inject a 9px span into the live page,
  serve an unmocked route). Proves **application** behaviour. No source touched at all.
  **THROWAWAY COPY** — copy the gate, mutate the copy, run it, delete it. Proves **gate** behaviour,
  which injection cannot: the guard test above had the *selector* under test, not the page. Tracked
  source is never modified; the artifact is a new file that is deleted rather than reverted.
  Pick by what is under test, not by habit.

- **2026-08-03 · the claim-kind rule fired in a THIRD direction: lead → itself, unprompted.** The
  lead asserted that a prerender assertion "passes even if the panel is entirely absent", went to
  prove it by cross-route comparison, saw the comparison did not isolate the claim, and narrowed the
  statement to what reading had actually established — with the fix already correct and nobody having
  challenged it. Previously observed worker→lead (a polarity table with fiction on its fail rows) and
  verifier→lead (the origin-guard reversal). **This third form needs no second party present, which
  makes it the most durable of the three** and the one worth teaching.

- **2026-08-03 · a break test that breaks nothing reports success identically to one that does.**
  The `kind`-only polarity for the ENDPOINTS parity assertion passed green on first attempt because
  the mutation hit the first `kind: 'network'` in the file — which was inside the explanatory
  comment written in that same commit, not the fixture data. Re-run against the data at `:79`, it
  reds correctly. The lesson is not "be careful with sed": it is that a break test's *negative*
  result is only evidence if you confirm the mutation landed where you aimed it.

- **2026-08-03 · PILOT-WATCH (v4.1) — the `test-engineer` flip rule has its evidence, and the axis
  matters more than the count.** Threshold was *two or more across prompts 08–10 flips
  `test-engineer` to Sonnet for gate authoring*. It was met inside prompt 08 alone, and **both hits
  are the same failure mode**: U4 returned a two-polarity table with `Executed ✅` on its pass rows
  and prose on its fail rows — the fail side had never been run; U7 returned `STATUS: DONE` with
  `UNVERIFIED: none` and **no** two-polarity transcript at all, despite the brief requiring one per
  assertion. Both are *fail-side evidence that was never produced*. Two hits on one axis is a
  stronger signal than two unrelated defects, because it names the thing to fix rather than the tier.
  Full count of gate defects reaching lead review this prompt: **11**. Notably the last several were
  the lead's own, not a worker's — a fixture-spec that disagreed with its code, a mock that
  reconstructed an envelope instead of producing it, a comment surviving the code it justified, and
  an unguarded precondition. Once workers are briefed off measured findings, the remaining risk
  concentrates upstream.
- **2026-08-03 · `NOT-MATCHED:` returned non-empty on 2 of 3 dispatches that used it**, and both were
  actionable rather than decorative: U2's named two cases its `/api/monero` pattern could not catch
  (longer paths like `/api/monero-stats`, module-level path constants) — both were then **closed by
  execution** rather than left as caveats; U1's flagged that `excluded` had no witness in the
  fixture, which turned out to share a root cause with the spec-parity defect.
- **2026-08-03 · one `UNVERIFIED` label stopped a stale claim reaching a report.** U3 marked its
  `SourcesPage` provenance prose UNVERIFIED because it had written the copy from the brief without
  reading `api/nodes.js`. That converted an assumed-correct claim into a checkable one.
