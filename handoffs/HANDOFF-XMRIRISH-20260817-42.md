---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260817-42
branch: claude/phase-4-hygiene-ledger-1r92bh
status: in_progress    # open -> in_progress -> done | blocked
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

- [ ] `npm run build` exits 0
- [ ] Item 1 — `app/index.html` carries no rotting version claim; `verify-releases`
      asserts the agreement/absence against the built `dist/index.html`; the
      stale-title mutation reds BY NAME (two-polarity transcript recorded)
- [ ] Item 2 — `verify-markets-dom` on a tree with `.mk-syncbox` absent produces a
      NAMED red and a printed tally instead of a crash; BEFORE (crash) and AFTER
      (named red) transcripts both recorded; healthy-tree assertions unchanged
- [ ] Item 3 — `verify:e2e` ends `… verify-orb verify-stream verify-vitals`;
      `ci.yml`'s comment records the inversion as CLOSED and dated; every e2e count
      literal in `ci.yml` re-checked; `verify-vitals` green ×2 post-reorder with
      LCP numbers reported
- [ ] Item 4 — `verify-legality` §B asserts `https:` scheme hard plus hostname
      shape; #187's M3 mutation (an `http://` deep-path href) reds BY NAME; the
      shipped hrefs stay green (two-polarity transcript)
- [ ] Item 5 — `verify-peers` §6b asserts the SPECIFIC degraded rendering; a
      fabricated count under a 500 reds (two-polarity transcript); §7 untouched
      and carrying a dated comment saying why
- [ ] Item 6 — `verify-releases` survives a resolvable-but-broken leaf with a named
      red; clean tree yields an identical green tally (two-polarity transcript)
- [ ] Item 7 — the provenance count claim is resolved against a measurement, and
      the file is edited ONLY if a real discrepancy exists
- [ ] `SITE_PR` = 189, `verify-releases` staleness invariant green
- [ ] `verify-bundle` green with all-zero JS deltas stated
- [ ] Census RECOUNTED (not incremented) with the counting script CONTROLLED
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
status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
<appended on verify failure>
