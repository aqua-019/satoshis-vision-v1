---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260818-M3
branch: claude/peers-screenshots-tap-target-478z7p
status: done
written_by: claude-code
owner: claude-code
---

# HANDOFF — p4·M3 · THE PEERS PAGE, MADE REAL

## 1 · GOAL
`/operate/peers` shows what it has been reserving. Every partner brief renders
a real, self-hosted, dated screenshot instead of a dashed placeholder; the
`our brief` control becomes a tap target a thumb can hit without being sent
off-site; two new partners join the grid; and each card carries its partner's
X handle. Content release — no new route, no new module, no new CSS rule.

## 2 · CONTEXT
- Files: `app/src/pages/future/data.ts`, `app/src/pages/future/EcoPopup.tsx`,
  `app/src/pages/TrustedPeersPage.tsx`, `app/public/peers/*.webp`
- Gates: `verify-peers`, `verify-mobile`, `verify-origins`, `verify-protocol`
- Base: `e0c87ad` (#196, p4·M1). Runs CONCURRENTLY with p4·M2 — see §4.
- The six captures arrived as conversation attachments, not as repo files;
  they were extracted from the session transcript and mapped to partners BY
  CONTENT (each read back and identified), never by attachment order.

## 3 · SCOPE
IN: the screenshot render path and its type; the two retired embed slots and
the sentence that promised one; the 44px tap target; Monerica and Privacy
Gateway; five X links; the gates for all of it; budget re-derivation.

OUT (non-goals): xmr.club's copy (done in p4·06, byte-untouched); any route
change; splitting `data.ts` (see §7 — measured, ledgered, deliberately not
taken while a second PR edits that file); a seventh partner.

## 4 · CONSTRAINTS
- CSP is `img-src 'self' data:` with no `frame-src`: screenshots must be
  self-hosted and no third-party embed is ever coming.
- `cssGz` margin is 416 B — no new stylesheet rule.
- Concurrent with p4·M2. Shared files: `siteVersion.ts`, `LOG.md`,
  `CLAUDE.md`, `verify-bundle.mjs` (different rows). Merge sequentially; the
  second to merge re-derives its budgets, because every route's first load
  includes the shared chunks.
- No live numbers off any capture. No counts in any directory description.

## 5 · DONE-CRITERIA
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0
- [x] Six `.webp` committed under `app/public/peers/`, each mapped by content
- [x] Every partner brief renders exactly one decoded screenshot with a
      rendered capture date (was: zero `<img>` in all four)
- [x] The `our brief` control measures ≥44×44 at 390 on every card (was
      52.8×16), and all six measure the same width
- [x] Zero off-origin requests with all six briefs OPENED
- [x] `verify-peers` recounted 4 → 6 partners, exits 0
- [x] `verify-mobile`, `verify-origins`, `verify-protocol` exit 0
- [x] `verify:static` and `verify:e2e` exit 0
- [x] Two-polarity transcript for every new assertion
- [x] Census recounted with the instrument controlled against four commits
- [x] Renders captured and looked at, 1440 / 390 / 320
- [x] Branch pushed · draft PR opened

## 6 · VERIFY COMMANDS
```
npx tsc --noEmit
npm run build
node verify-bundle.mjs
npm run verify:static
npm run verify:e2e
node verify-mobile.mjs
```

## 7 · REPORT
status: done
pr: see LOG.md
deps added: none
deviations from spec:
  · The prompt said `verify-peers` derives the partner count so new entries
    move it automatically. It derives it AND pins it to a literal `4`, which
    reds on the fifth partner. Recounted to 6.
  · Two embed slots retired, where the prompt named one. Same structural
    ground (no `frame-src`, so neither embed is coming); flagged for reversal
    in one line if the operator disagrees.
  · One clause added to kyc.rip's brief, sourced only from its own capture,
    because the screenshot shows an operating swap desk under copy that
    described a documentation surface. Additive; flagged for review.
  · Five route ceilings raised, not three. `/future` and
    `/operate/superstress` render none of the new content and pay for it —
    measured at +1,791 and +1,652 B gzip — because `data.ts` lands in a chunk
    they both download. The leaf split that fixes it is NOT taken here: a
    second PR is editing `data.ts` concurrently.
open questions:
  · Privacy Gateway's copy has no confirmed text source (the site answered
    403). Operator reviews it.
  · Monerica's "oldest directory" is operator-supplied and unverifiable here.

## 8 · LOOP FEEDBACK
- The six screenshots were attached to the conversation rather than committed
  to the repo. A brief that hands over binary artifacts should say where they
  land, or they are only recoverable from the session transcript.
- `verify-peers`'s partner count is BOTH derived and pinned; the ✓-block
  described only the derived half.
