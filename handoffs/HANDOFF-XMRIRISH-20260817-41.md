---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260817-41
branch: claude/prompt-attached-scgolz
status: done                # open -> in_progress -> done | blocked
written_by: claude-code    # manual mode — task arrived as an attached prompt
owner: claude-code
---

# HANDOFF — p3·19 THE BETANET GUIDE: the question was asked and answered

## 1 · GOAL

`/operate/superstress` stops promising a telemetry endpoint that is never coming, and
becomes the guide the maintainer's answers make possible. Three things exist when this is
done that do not exist now:

1. **A from-zero guide** on the existing hub structure — the prerequisite's verified
   identity, the install order enriched, the reachability model in the maintainer's own
   words, and what a reader HAS at the end: their own node on the FCMP++ beta chain.
   Every port number carries an attribution sentence naming whose port it is; every
   undocumented chain parameter stays undocumented.
2. **§5 becomes the answer, not the reservation.** The question was asked and answered:
   there is no public telemetry endpoint, self-hosted is the design, and self-hosted-only
   is BETTER than a public endpoint would have been. Plus a two-sentence
   why-no-live-panel that is an argument rather than an apology, so nobody re-asks in v7.
3. **Every mirror of the pending-endpoint claim dies in the same PR**, and
   `verify-superstress` §6 — which currently pins the placeholder and reds the moment it
   lands — gates the NEW state with assertions at least as sharp, including a bracketed
   absence-grep that makes the historical copy unrepresentable.

## 2 · CONTEXT

- Attached prompt: `p3·19 — THE BETANET GUIDE` (prompt 19 of 19, P11 rewrite). It is
  itself a REWRITE of `claude/prompts/19-betanet-guide.md` — **that file does not exist in
  this tree** (`ls claude/prompts/` returns nothing; the directory is absent). Its
  load-bearing facts are quoted verbatim inside the attached prompt's §0.1 and §0.5 and
  are used as recorded, per instruction, not re-derived.
- Base: `origin/main` = **`c6b518e`** (PR #187 merged). `HEAD` == `origin/main` ==
  the designated branch `claude/prompt-attached-scgolz`, all three at `c6b518e`.
  **Trap, recurring for the third recorded release:** the LOCAL `main` ref is stale at
  `088a6e8`. `git log main` misleads; `origin/main` is the authority in this clone.
- **The clone arrived SHALLOW** (443 commits) — p3·18's recorded artefact, unchanged.
  `git fetch --unshallow` → **882** commits. Run
  `git rev-parse --is-shallow-repository` before any archaeology.
- **The maintainer's three verbatim replies** (recorded in the base, cited as read there —
  the sandbox has no egress to re-confirm): superstress is self-hosted; the Monero node
  addon exposes the quoted ports and is reachable from lan/tor/tailscale; superstress has
  its own monerod; it is the FCMP++ stressnet/testnet. **Path C** — no public endpoint
  exists and none is coming.
- Relevant files: `app/src/pages/SuperstressPage.tsx` (440) ·
  `app/src/pages/future/data.ts` (552) · `app/src/pages/FuturePage.tsx` (190) ·
  `app/verify-superstress.mjs` (647) · `app/verify-bundle.mjs` (1694) ·
  `app/src/data/siteVersion.ts` · `CLAUDE.md` (two census places) · `handoffs/LOG.md`.

## 3 · SCOPE

**IN:** the guide prose on the existing hub structure; §5's replacement; every
pending-endpoint mirror in `data.ts` / `FuturePage.tsx` / `SuperstressPage.tsx` (source
AND comments AND the file-header docblock); `verify-superstress` §6's rewrite with
two-polarity per assertion; `verify-bundle` ceiling raises **only if crossed**;
`SITE_PR` 187 → 188 in the PR-opening commit; the census recount; CLAUDE.md session note
and LOG.md line.

**OUT (non-goals):** no new route (none of the p3·16 ten-surface sweep); not a 12th
mempool view; no `MemViewShell`; no `/api/betanet`, no new serverless function, no new
outbound origin; no mainnet surface changes; provenance stays FIVE members and the guide
gets no live badge — it is editorial; `verify-sims` stays an orphan and is NOT wired here;
`verify-markets-dom:790` is not touched; the vitals-last `verify:e2e` inversion is not
deepened (this PR adds **no** e2e member — §6 is an in-file rewrite).

## 4 · CONSTRAINTS

- **The chain-parameter embargo HOLDS.** Genesis, address format, `nettype`, Superstress's
  own RPC ports, FCMP++ transaction structure: none may be stated. *"not documented here"*
  and `null` links are correct answers. `["Beta-chain explorer", null]` stays null.
- **`LINEAGE_RX` (`verify-future.mjs` §15) is tree-wide** over
  `.ts/.tsx/.js/.mjs/.css/.json/.md/.html` from the repo ROOT, exempting only itself —
  **this handoff file is inside its corpus.** Write around the banned phrases; never touch
  the gate. "The FCMP++ stressnet" is confirmed and fine.
- **Every `18081|18083|18089` in the diff is attributed-or-absent** — as *the Monero node
  addon's ports, per the maintainer*, NEVER as Superstress's own. A reader who copies a
  config that cannot connect is the failure mode.
- Any link the base did not verify is published as unverified or not at all. **Tor bundled,
  I2P NOT** — never list I2P as a transport.
- Zero new stylesheet rules preferred (`cssGz` margin is **300 B**); reuse `.kicker`,
  `.mono`, `.dim`, `.acc`, `.v6-res`, `Card`, `Pill`.
- Rendered-text assertions use `textContent` or are case-insensitive — the
  `.kicker`/`text-transform` family has three recorded instances plus one probe.

## 5 · DONE-CRITERIA  — the gate reads ONLY this section

- [x] `npx tsc --noEmit` (app/) exits 0
- [x] `npm run build` (app/) exits 0
- [x] Diff sweep: every `18081|18083|18089` occurrence in `git diff` carries an
      attribution naming the **Monero node addon** — zero unattributed, zero ascribed to
      Superstress's own daemon
- [x] Bracketed absence-grep over the RENDERED `/operate/superstress` and `/future` DOM:
      `telemetry endpoint`, `landing soon`, `awaiting`, `open question with the maintainer`,
      `not wired`, `to be wired` → **0 hits** on betanet-endpoint copy
- [x] `node verify-superstress.mjs` exits 0 with §6 rewritten; **two-polarity transcript
      per new/modified assertion** (a state that passes, a state that fails, actuals for
      both)
- [x] `node verify-future.mjs` exits 0 (§15 lineage embargo green; §8 partner object green)
- [x] `npm run verify:static` exits 0
- [x] `npm run verify:e2e` exits 0
- [x] `node verify-bundle.mjs` exits 0; every ceiling raise is red-then-green **on the
      FINAL tree** and its comment re-derived AFTER the last src commit
- [x] Census RECOUNTED (never incremented) with the counting script CONTROLLED against a
      prior commit first; expected UNCHANGED at 83 / 79 / CI 69 / static 22 / e2e 34
- [x] `SITE_PR` = 188 in the PR-opening commit; `verify-releases.mjs` staleness gate green
- [x] Renders captured and LOOKED AT: hub top-to-bottom (§5 region especially), Future
      band, eco popup, 390px, greyscale spot, reduced motion
- [x] Branch pushed · draft PR opened via GitHub MCP · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npx tsc --noEmit
npm run build
node verify-bundle.mjs
node verify-superstress.mjs
node verify-future.mjs
npm run verify:static
npm run verify:e2e
```

## 7 · REPORT  — filled on exit, completely

**status:** done

**pr:** https://github.com/aqua-019/satoshis-vision-v1/pull/188 (draft)

**commits:** `8926c94` the page + every mirror · `384509b` §6 rewritten to gate the answered
state · `dd69866` two §6 defects found by break tests refusing to go red · `b908d35` the inert
route path in the eco popup, and the scratch probe `git add -A` swept in · plus the budget
raise, the SITE_PR bump and the records.

**deps added:** none.

### §0 confirmations, measured

| premise | verdict |
|---|---|
| base `c6b518e`, branch at it | CONFIRMED — `HEAD` == `origin/main` == branch |
| clone SHALLOW | CONFIRMED (443) → `--unshallow` → **882** |
| `18083` appears nowhere in tree | CONFIRMED |
| existing `18081/18089` hits are "NodePage + verify-nodehealth" | **CORRECTED — 7 files, not 2** (adds `verify-fixtures`, `verify-orb`, `api/_nodes.js`, `api/_fixtures/`, `relay/`). All mainnet/cascade contexts, so the characterisation holds. |
| the 7 baseline budget figures | **all CONFIRMED exactly** |
| census 83/79/69/22/34 | **all CONFIRMED**, instrument controlled against `bda0491` AND `e5eae16` |
| CSP `connect-src 'self'` at vercel.json:17 | CONFIRMED |
| §0.8 mirror list is complete | **REFUTED — see below** |

### The mirror sweep — the brief's list was incomplete

| hit | new copy |
|---|---|
| `data.ts:415` telemetry slot | **deleted** (2 screenshot slots stay — still honest) |
| `data.ts:405` "Screenshots, endpoints … as they're provided" | "endpoints" dropped; new `body[2]` states the answer |
| `data.ts:549` `mode` "still pending" | "repo pulse live · no public endpoint, by design — the chain is self-hosted"; `tone` decided out loud |
| `data.ts:536-537` ("Genuinely still pending") | **brief said 535-536; it is 536-537** — stressnet clause removed, other two kept |
| `FuturePage.tsx:151` "landing soon" | "The chain is self-hosted — every node on it is somebody's own box." |
| `SuperstressPage.tsx:419-437` §5 | replaced by the answer |
| `SuperstressPage.tsx:28-33` docblock | rewritten + a new port-attribution invariant |
| **`protocols/stressnet.tsx:229`** — MISSED BY BRIEF | rendered copy on `/learn/sim?p=stressnet`, a route the hub cross-links to. Fixed; re-probed `pendingClaim: false`. |
| **`protocols/stressnet.tsx:11-13`** — MISSED BY BRIEF | the stated reason that file never reads `data`; now says permanent, not pending |

### Port attribution — every number in the diff

7 occurrences added: `18081` ×3, `18080` ×2, `18083` ×1, `18089` ×1. **Two are source comments
(render nowhere); the other five all render inside `[data-ports]`**, which holds the quote and
its attribution in one box. §6g proves it at runtime per port
(`count(page) === count(inside)`), paired with a control that ports render at all.

**deviations from spec:** three, each decided out loud.
1. **`protocols/stressnet.tsx` was edited** though the brief's subject list omits it — §0.8's
   instruction ("every pending-endpoint phrase dies in the same PR") governs, and its list was
   a hypothesis. Its `/future` link was **kept** rather than retargeted at the hub: the prompt
   header says *correctness, not enhancement*, and that link is not false.
2. **No third `tone` value.** Amber is right for a row that is not wired end-to-end and never
   will be; a third state would put a verbal distinction in a hue. The type comment's "yet" was
   already false for the X row and was corrected instead.
3. **No new section.** §3 absorbed the prerequisite identity and reachability; §5 became the
   coda + answer. The measured structure carried it.

**notes for ARCHITECTURE.md patch:** none — no new route, no new module, no new chunk
(`CHUNK_COUNT` 69 unchanged), no new stylesheet rule (`cssGz` byte-identical), provenance
still five members. CLAUDE.md's census stands UNCHANGED; its "71 invocations" figure was
arithmetically impossible and is corrected to 75.

**open questions:**
- The chain-parameter embargo still holds — genesis, nettype and Superstress's own daemon
  ports remain undocumented. Only the ENDPOINT question closed.
- `verify-sims` is red on `origin/main` (stale `/simulate` literal at `:151`, reproduced on a
  clean `c6b518e` worktree). Out of scope here; wiring it would fix 12 stale literals.
- **No human has seen the rendered result in a browser** — read from screenshots.

## 8 · LOOP FEEDBACK

- **An enumeration in a brief is a hypothesis, not a measurement.** §0.8 listed six mirrors and
  said "the full set, measured". A wider sweep found a seventh and eighth on a third route the
  brief never considered — rendered copy that contradicted the page linking to it. The sweep
  cost one grep. Future briefs should say "believed complete; verify" rather than "measured".
- **`INFERRED` from the recon dispatch**: the brief named `cards.tsx` for `EcoPopup` (it is
  `EcoPopup.tsx`), gave `535-536` for a `536-537` range, and said the stressnet object "serves
  both surfaces" when the hub reads `blurb` only. None was load-bearing alone; together they
  would have produced a fix that left the hub lying.
- **Do not dispatch a recon sweep over files you are concurrently editing.** One probe read
  in-flight edits as pre-existing and opened its report by "correcting" the premise. Every fact
  true; every fact about the wrong tree. Pin such a probe to a base worktree.
- The two gate defects here were both found by mutations REFUSING to go red, not by review.
  That is the third release running. Break tests that only confirm expected reds are the
  cheap half.
