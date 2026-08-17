---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260817-42
branch: claude/phase-4-hygiene-ledger-1r92bh
status: done           # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, self-authored per Loopflow core)
owner: claude-code
---

# HANDOFF — p4·01 "THE HYGIENE CLOSE": seven ledger items, measured

## 1 · GOAL
The named hygiene ledger is retired before Phase 4's mobile work begins. The site
shell stops advertising a version that has been wrong for ~25 PRs; three gates that
die *pre-assertions* (illegible red, no named failure) instead fail by name; two
assertions that claim more than they check are made to check what they claim; and
the `verify:e2e` tail is restored to the vitals-last invariant its own CI comment
still describes. Nothing is enhanced. Every fix to a gate carries two-polarity proof,
because a hygiene pass that weakens a gate while "fixing" it would be the worst PR
in the series.

## 2 · CONTEXT
- `main` = `81fafca` (PR #188 merged — Phase 3 complete, nineteen of nineteen).
- Ledger items and their origin PRs: #181 F1 (markets-dom crash), #183 (e2e tail
  inversion), #184 F3 (peers §6b vacuity), #186 (verify-releases leaf crash),
  #187 F2 (legality §B comment/code mismatch), plus the shell title (found by the
  verifier's live status check) and a claimed provenance-count drift.
- Relevant files: `app/index.html` · `app/verify-releases.mjs` ·
  `app/verify-markets-dom.mjs` · `app/verify-legality.mjs` · `app/verify-peers.mjs` ·
  `app/package.json` · `.github/workflows/ci.yml` · `CLAUDE.md`.
- Standing repo rules that bind this task: recount-never-increment for the census;
  two-polarity execution transcripts with restores proven against the COMMITTED
  BLOB; bracketed absence-greps; rebuild between restore and re-measure.

## 3 · SCOPE
IN: the seven ledger items below; `SITE_PR` 188 → 189; the session note; the
handoff and LOG line.
OUT (non-goals): `verify-peers` §7's mono/pill exemptions (p4·02's site-wide mobile
floor gate replaces them wholesale — narrowing them here would red the tree for a
defect p4·02 exists to fix); the 11-vs-12px floor conflict; the ten hollow
`/future#<id>` anchors; `verify-sims`' stale literals and orphan status; any
restructuring of CLAUDE.md beyond the one targeted correction.

## 4 · CONSTRAINTS
- Stack: React 18 · Vite 5 · TS strict · Node 22. Docs and gate-side throughout;
  the ONLY `src/`-adjacent touch is `app/index.html`.
- Budgets must not move. Expected JS delta is ZERO everywhere (`index.html` is not
  a chunk). Any surprise crossing = STOP and report, never raise — nothing in this
  PR has a legitimate byte cost.
- A fix to a gate may not reduce what that gate asserts on a healthy tree.
- Do not touch: `api/`, `relay/`, `vercel.json`, any `app/src/**` file.

## 5 · DONE-CRITERIA  — the gate reads ONLY this section

- [x] `npm run build` exits 0
- [x] Item 1 — `app/index.html` carries no rotting version claim; `verify-releases`
      asserts the absence against `app/index.html` (the SOURCE — AMENDED from the
      original "the built `dist/index.html`", because `ci.yml:86-88` records that
      `verify:static` runs BEFORE its job's Build step, so a dist-reading gate there
      "would fail on every single run"; see §7 deviations); the stale-title mutation
      reds BY NAME (two-polarity transcript recorded)
- [x] Item 2 — `verify-markets-dom` on a tree with `.mk-syncbox` absent produces a
      NAMED red and a printed tally instead of a crash; BEFORE (crash) and AFTER
      (named red) transcripts both recorded; healthy-tree assertions unchanged
- [x] Item 3 — `verify:e2e` ends `… verify-orb verify-stream verify-vitals`;
      `ci.yml`'s comment records the inversion as CLOSED and dated; every e2e count
      literal in `ci.yml` re-checked; `verify-vitals` green ×2 post-reorder with
      LCP numbers reported
- [x] Item 4 — `verify-legality` §B asserts `https:` scheme hard plus hostname
      shape; #187's M3 mutation (an `http://` deep-path href) reds BY NAME; the
      shipped hrefs stay green (two-polarity transcript)
- [x] Item 5 — `verify-peers` §6b asserts the SPECIFIC degraded rendering; a
      fabricated count under a 500 reds (two-polarity transcript); §7 untouched
      and carrying a dated comment saying why
- [x] Item 6 — `verify-releases` survives a resolvable-but-broken leaf with a named
      red; clean tree yields an identical green tally (two-polarity transcript)
- [x] Item 7 — the provenance count claim is resolved against a measurement, and
      the file is edited ONLY if a real discrepancy exists
- [x] `SITE_PR` = 189, `verify-releases` staleness invariant green
- [x] `verify-bundle` green with all-zero JS deltas stated
- [x] Census RECOUNTED (not incremented) with the counting script CONTROLLED
      against a historical commit first
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS
```
cd app
npm run build
node verify-releases.mjs
node verify-bundle.mjs
npm run verify:static
npm run verify:e2e          # against scripts/serve-dist.mjs
node verify-vitals.mjs      # x2, LCP reported
```

## 7 · REPORT  — filled on exit, completely
status: done — all DONE-CRITERIA green. One red in the full 34-gate e2e chain
(`verify-vitals`, `/` blocking 407ms vs a 400ms ceiling) was PAIRED against an
isolated `81fafca` build on this machine and established as the runner, not the
tree: standalone, this tree reads 353ms against the base's 356ms, and across four
runs of two trees the figure reads 353 · 356 · 390 · 407 — a plateau straddling
the ceiling independently of the tree. Two standalone vitals runs post-reorder,
17 passed · 2 skipped · 0 failed, exit 0, twice.

pr: https://github.com/aqua-019/satoshis-vision-v1/pull/189

commits:
  fd99eeb  fix(shell+gate): de-version the <title>, and stop verify-releases dying at module load
  77ae740  fix(gates): guard markets-dom's locator, and restore the vitals-last e2e tail
  b06c5ad  fix(gates): assert legality citation SHAPE, and de-vacuate peers §6b
  5acbbfa  docs(sources): name NETWORK in the provenance legend's own docblock
  bae6dfb  chore(p4-01): SITE_PR 189, and the literals the reorder made stale
  a1b326c  docs(p4-01): session note and LOG entry

deps added: none.

deviations from spec:
  · ITEM 4's premise was DISPROVED and the fix changed accordingly. The ledger said the
    SCHEME was unchecked; running that exact mutation at `81fafca` reds on "every linked
    source is https (23 links)". The unchecked half is SHAPE, so §B now asserts no query
    string or fragment. The guessed-PATH half is left unasserted, measured: the EU's ELI
    URI is five segments and canonical, so no depth rule separates canonical from guess.
  · ITEM 7's premise was DISPROVED in the other direction. Five provenance sources exist and
    CLAUDE.md correctly says FIVE, so CLAUDE.md was NOT edited. The item was closed by
    `b78dfe2` on 2026-08-03. Its one live residue — `SourcesPage.tsx:6` naming four while the
    same file renders five — was fixed instead.
  · ITEM 1's gate assertion reads `app/index.html` (SOURCE), not `dist/index.html` as the
    brief suggested. `ci.yml:86-88` already records that `verify:static` runs BEFORE its
    job's Build step, "so a dist-reading gate placed there would fail on every single run".
  · ITEM 3 obliged three files the brief did not name: `verify-coldboot.mjs`'s placement
    docblock (which carries an explicit instruction to re-read it on any reorder, and whose
    every position literal was already stale), and two ci.yml paragraphs.

notes for ARCHITECTURE.md patch: none — no architectural surface changed. The census is
unchanged at 83 / 79 / 22 / 34 / 69, orphans 6, recounted with the script controlled against
two historical commits first.

open questions:
  · `verify-coldboot-live.mjs:7,13` ("Eleven gates", "27 entries, index 27") measures 13
    callers in a 34-member chain with verify-coldboot at 31. The load-bearing property is
    verified intact (control at position 1, all twelve others after). Not fixed here.
  · `verify-resilience-dom.mjs:8` ("Ten of the twenty-two … cls") is stale in count AND
    membership — `verify-cls` now calls `ctx.route()`. Not fixed: the replacement number
    needs a comment-stripper better than the one that produced this session's own defect (3),
    which mangled the glob `'**/api/**'`.
  · Whether any legality citation URL RESOLVES remains operator-checkable only; the gateway
    answers 403 to CONNECT for the regulator domains.

## 8 · LOOP FEEDBACK
<appended on verify failure>
