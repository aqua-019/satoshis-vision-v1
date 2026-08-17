---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260817-41
branch: claude/prompt-attached-scgolz
status: in_progress        # open -> in_progress -> done | blocked
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

- [ ] `npx tsc --noEmit` (app/) exits 0
- [ ] `npm run build` (app/) exits 0
- [ ] Diff sweep: every `18081|18083|18089` occurrence in `git diff` carries an
      attribution naming the **Monero node addon** — zero unattributed, zero ascribed to
      Superstress's own daemon
- [ ] Bracketed absence-grep over the RENDERED `/operate/superstress` and `/future` DOM:
      `telemetry endpoint`, `landing soon`, `awaiting`, `open question with the maintainer`,
      `not wired`, `to be wired` → **0 hits** on betanet-endpoint copy
- [ ] `node verify-superstress.mjs` exits 0 with §6 rewritten; **two-polarity transcript
      per new/modified assertion** (a state that passes, a state that fails, actuals for
      both)
- [ ] `node verify-future.mjs` exits 0 (§15 lineage embargo green; §8 partner object green)
- [ ] `npm run verify:static` exits 0
- [ ] `npm run verify:e2e` exits 0
- [ ] `node verify-bundle.mjs` exits 0; every ceiling raise is red-then-green **on the
      FINAL tree** and its comment re-derived AFTER the last src commit
- [ ] Census RECOUNTED (never incremented) with the counting script CONTROLLED against a
      prior commit first; expected UNCHANGED at 83 / 79 / CI 69 / static 22 / e2e 34
- [ ] `SITE_PR` = 188 in the PR-opening commit; `verify-releases.mjs` staleness gate green
- [ ] Renders captured and LOOKED AT: hub top-to-bottom (§5 region especially), Future
      band, eco popup, 390px, greyscale spot, reduced motion
- [ ] Branch pushed · draft PR opened via GitHub MCP · `mergeable_state` reported

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

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
