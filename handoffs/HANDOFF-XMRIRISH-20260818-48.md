---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260818-48
branch: claude/stressnet-explorer-prompt-m8hnza
status: done
written_by: claude-code (manual mode — task arrived as an attached prompt, p4·07)
owner: claude-code
---

# HANDOFF — p4·07 THE STRESSNET EXPLORER, SIMULATED MODE

## 1 · GOAL

The site gains an EIGHTEENTH route: a beta-chain block explorer for the Umbrel
Superstress Net, laid out in the idiom of the classic mempool view (tiles,
confirmations, fee structure) and driven **entirely by the wind-tunnel model** in
`src/protocols/stressnet.tsx`. It is not a chain reading and every pixel of it says
so — a persistent `BETANET · NOT MAINNET · TEST FUNDS ONLY` banner, the word
**SIMULATED**, a `MODEL` provenance badge, and patently-synthetic transaction ids.
The null `["Beta-chain explorer", null]` placeholder in `pages/future/data.ts`
closes onto the new route, and the Superstress hub gains the crosslink. A dedicated
gate proves the honesty contract cannot be silently removed.

## 2 · CONTEXT

- Prompt: p4·07, base `main` = `0f00d26` (the p4·06 merge).
- Operator decisions recorded 2026-08-17: **no real endpoint for now**, and **ship
  the classic-style beta-chain explorer anyway, in SIMULATED mode.**
- CLAUDE.md — the honest-data doctrine, the registration-sweep method, the census
  recount rule, the break-test protocol, the budget re-measure rule.
- `src/protocols/stressnet.tsx` — the model. Its docblock calls the unread `data`
  prop a PERMANENT property; this task amends that docblock consciously.
- `src/mempool/mempool-shared.tsx` + `src/mempool/classic.tsx` — the layout to reuse.
- `src/pages/future/data.ts:497` — the null link that closes.

**Prompt premise corrections established before work began (§0 of the report):**
1. The verifier block's correction #1 is FALSE. `MemViewShell` **does** exist —
   `src/mempool/mempool-shared.tsx:372`, imported by ten view files.
2. Corrections #2 (model at `src/protocols/stressnet.tsx`) and #3 (the docblock's
   PERMANENT claim) are CONFIRMED.

## 3 · SCOPE

IN: the new route and its page; the model extended into a source-switchable data
layer; the honesty banner/badge/txid-marking contract; the `data.ts` link closure
and the hub crosslink; the full route registration sweep; a dedicated gate, wired
mid-chain; budgets; census recount; the two sanctioned hygiene fixes
(`index.html` stale route counts, `verify-bundle.mjs` stale per-route comments) in
files this sweep already opens.

OUT (non-goals): any real `/api/betanet` endpoint or dead config for one; feature
flags or "live coming soon" copy; a 12th `/live/mempool?v=` view; edits to the eco
popup body or the hub's answered-state copy; the `verify-protocol` intermittency;
the crashed `verify-sims` orphan; any chain parameter (genesis, nettype, ports,
addresses).

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict. Edit `app/src/**`; no hand-edited HTML.
- CSP `connect-src 'self'`; zero third-party browser requests.
- `Math.random()` only inside `app/src/protocols/`.
- No invented chain parameters. The lineage embargo and the chain-parameter
  embargo are untouched by simulation.
- No new provenance type — `MODEL` is an existing member.
- `cssGz` has ~416 B of margin: reuse view styles, do not mint.
- Never wire a red gate. Never the tail of `verify:e2e` (that is
  `verify-orb` then `verify-stream` then `verify-vitals`).

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run build` exits 0 (includes `tsc --noEmit`)
- [ ] `npm run verify:static` exits 0
- [ ] `npm run verify:e2e` exits 0, every member green, exit read from the
      recorded status and never from a wrapper or a pipe
- [ ] `node verify-bundle.mjs` exits 0 with the new route row and all ceilings green
- [ ] `node verify-mobile.mjs` exits 0 with the new route swept
- [ ] The new gate exists, is wired to npm AND ci.yml mid-chain, and passes
- [ ] Two-polarity transcript per NEW assertion: banner stripped then red; unmarked
      txid then red; MODEL badge swapped for a node badge then red; each mutation
      proven APPLIED before its red is trusted, each restore proven against the
      COMMITTED BLOB, rebuilt between restore and re-measure
- [ ] Route registered across every surface the three-instrument union finds
- [ ] Census RECOUNTED (never incremented) with the counting script CONTROLLED
      against historical commits first
- [ ] Budgets re-derived after the LAST src commit; chunk-band decision argued
      explicitly, not asserted
- [ ] Renders captured and LOOKED AT: 1440 top scroll, 1440 bottom scroll, 390,
      reduced-motion, badge legibility
- [ ] Branch pushed, draft PR opened, `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npm run build
npm run verify:static
npm run verify:e2e
node verify-bundle.mjs
node verify-mobile.mjs
```

## 7 · REPORT

status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/195 (draft)
commits: 93a341c model leaf + seeded chain · 0ce374d the route and page · 3ef92a0 the gate,
  wired e2e 16/38 · 4020840 budgets · 842cc2b the port-pattern fix M5 found · plus the notes
deps added: none

deviations from spec:
- The ✓-block's §0.1 was FALSE and I built against my own measurement instead. `MemViewShell`
  exists (`mempool-shared.tsx:372`, 12 files). The operator retracted it mid-flight; my check
  had already passed it.
- The reuse decision is per-component rather than wholesale, and the ledger is in the PR body:
  the IDIOM taken, every liveness-or-NODE component left. `MemViewShell` mounts
  `MempoolHeartbeat` unconditionally, which prints "LIVE · updated Ns ago".
- The chain is SEEDED, not `Math.random`, though `protocols/` licenses it. Determinism is what
  makes "reduced motion loses no information" checkable rather than asserted.

notes for ARCHITECTURE.md patch: the CLAUDE.md session note carries the full account — the
  eighth application of the lazy-leaf rule, the A/A control method, and the chunk-band
  falsifying test.

open questions:
- `/live/mempool` vitals on THIS sandbox. The A/A control settles it for this PR: two
  byte-identical builds of `0f00d26` read 4356 RED and 4300 GREEN across the same 4350
  ceiling. The instrument's spread on identical trees is the same order as the observed A/B
  delta, so the A/B result carries no information about this branch at this sample count.
  Ledgered separately: the ceiling is CI-CALIBRATED against a recorded sandbox baseline of
  3010, and this sandbox reads 4280-4364 unmodified — so a LOCAL vitals red on that route is
  not evidence. CI is the calibrated environment.
- 30fps under 6x throttle was not measured.

## 8 · LOOP FEEDBACK

- A prompt block labelled "measured" is still a REPORT until reproduced — the ✓-block's own
  correction was wrong in the slot declared to override the prose.
- An uncontrolled A/B is the same class of error as an uncontrolled recount. Control the
  instrument (A/A) BEFORE sampling harder; more samples cannot reveal a noise floor you never
  measured.
- Piping `pgrep -f` into `kill` is `pkill -f` in different clothes: the subshell carries the
  pattern and returns its own PID. READ the PIDs. Fifth and sixth instances, same session.
- Green suites are not the deliverable. The PR is.
