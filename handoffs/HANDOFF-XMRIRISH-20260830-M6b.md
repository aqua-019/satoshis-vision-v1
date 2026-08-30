---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260830-M6b
branch: claude/new-session-5b7hz3
status: in_progress
written_by: claude-code (manual mode — prompt-driven)
owner: claude-code
---

# HANDOFF — p4·M6b: the remaining tail (peers routing, placeholders, prose ledger)

## 1 · GOAL

Every trusted-peer brief has its own shareable address, opening a brief no longer
throws the reader off-site on the first click, no blank screenshot placeholder
ships anywhere, a seventh peer joins, and three prose figures that are measurably
wrong stop being wrong. Four items the prompt asks for are BLOCKED on assets that
do not exist; they are reported to the operator with the measurement rather than
guessed at.

## 2 · CONTEXT

- Base: `ce87559`, the merge of PR #202 (p4·M5). Tree clean, working branch
  `claude/new-session-5b7hz3`.
- Prompt: `p4M6b-remaining-fixes.md` (operator, uploaded this session).
- Relevant files: `app/src/pages/future/data.ts`, `EcoPopup.tsx`,
  `app/src/pages/**/TrustedPeersPage.tsx`, `app/verify-peers.mjs`,
  `app/verify-bundle.mjs`, `CLAUDE.md`, `LICENSE`.
- Precedent to copy: `/future/protocol?p=<id>`, landed p4·06.

### PREMISES THAT DID NOT SURVIVE MEASUREMENT (recorded before any code)

1. **All three delivered assets are absent.** `xmr-club-grade-a.svg` (§1), the
   xmr.irish medallion (§1b) and `peer-kathie` artwork (§4c) are in neither the
   tree, the git history, nor this session's uploads. The only upload present is
   the prompt itself.
2. **`INDEX-AND-ORDER.md` does not exist**, in any branch. §0, §4b and §5 all
   cite it as the authority for open ledger items.
3. **`claude/mockups/peers-grid-3x3.html` does not exist** — the same absence
   p4·06 already recorded against the same filename.
4. **§4b's hard dependency is FALSE.** All 7 `ECOSYSTEM` entries carry a
   non-empty `body[]` and a real dated `shot`. Popup coverage is 7/7, not 4/7.
   kyc.rip, Superbrain and XMRHUB all have full briefs.
5. **§4e's scope is exactly 2 slots on 1 entry** — Superbrain's. Every other
   entry is already `slots: []`.

## 3 · SCOPE

IN:
- §4d addressable peer briefs `/operate/peers?p=<slug>` (REQUIRED by the prompt)
- §4b popup-first panel click, now unblocked by the coverage measurement
- §4e blank-placeholder sweep, deletion, and a gate
- §4c seventh peer (Kathie) — entry and brief, sourced from the verified links
- §4 three prose-ledger corrections
- §5 four ledger entries recorded in CLAUDE.md, no code
- §2 LICENSE quoted with drafted replacements in the PR body, file untouched
- §3 X handle left as the honest null unless the operator supplies it

OUT (non-goals):
- Any asset that was not delivered (§1 badge, §1b medallion, §4c artwork)
- `LICENSE` edits — operator's decision
- The nav mark, favicons, the README ASCII clover
- Guessing the X handle
- Any new route registration (the query param is chosen precisely to avoid it)

## 4 · CONSTRAINTS

- CSP is `connect-src 'self'` / `img-src 'self' data:`. No third-party
  subresource, ever. `verify-origins` must stay at zero.
- No fabricated values on live surfaces. A claim is sourced or it is an em-dash.
- `cssGz` margin is 414 B. Reuse existing classes; state anything that moves.
- Census is RECOUNTED, never incremented, with `ci.yml` decommented first.
- Two-polarity transcript for every new or modified assertion.
- Never `pkill -f` / `pgrep -f | kill`.

## 5 · DONE-CRITERIA

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `?p=<slug>` opens the matching brief on FIRST PAINT in a new tab, for all 7 peers
- [ ] Opening a brief changes the URL; closing it removes the param
- [ ] An unknown slug renders the peers index with no popup and no error
- [ ] Clicking a peer panel opens its brief rather than navigating off-site
- [ ] The external anchor survives inside the popup with `rel`/`target` unchanged
- [ ] Zero rendered screenshot-slot labels with no image inside them, site-wide
- [ ] A gate asserts that, break-tested to red and restored from the committed blob
- [ ] `verify-peers` re-derived (recounted, literal not edited to fit) and green
- [ ] `verify-site`, `verify-origins`, `verify-legibility`, `verify-bundle` green
- [ ] `verify-origins` third-party request count quoted as a number and equal to 0
- [ ] Budgets attributed to residual zero; every ceiling stated with its margin
- [ ] Census recounted with `ci.yml` decommented
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npx tsc --noEmit
npm run build
npm run verify:static
npm run verify:e2e
node verify-bundle.mjs
```

## 7 · REPORT

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
