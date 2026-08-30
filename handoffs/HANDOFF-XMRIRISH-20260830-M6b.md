---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260830-M6b
branch: claude/new-session-5b7hz3
status: done
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

status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/203 (draft)
commits: 8 on `claude/new-session-5b7hz3`, base `ce87559`
deps added: none

verification (shipping tree):
  · `npx tsc --noEmit` exit 0
  · `npm run build` exit 0
  · `npm run verify:static` exit 0, no reds
  · `npm run verify:e2e` **E2E_EXIT=0, 39 of 39 gates, zero reds** — read off the
    log's own recorded exit, not the wrapper's
  · `node verify-bundle.mjs` 32 passed · 0 failed
  · verify-peers 44 → 64 · verify-future §8 6 → 12 · verify-origins +3 ·
    verify-protocol 61 → 62
  · six break tests (M1-M6), every one red where intended; M4 exposed a defect in
    this release's own gate and M4b then reds 16 across five sections
  · census RECOUNTED and UNCHANGED — 89 / 85 / 22 / 39 / 75 / 6 — instrument
    controlled against six commits
  · budgets residual ZERO on both halves; cssGz byte-identical; 76 = 76 chunks

deviations from spec:
  · §1 (badge) and §1b (medallion) NOT STARTED — neither asset exists in the
    tree, the history or this session's uploads. Reported, not guessed.
  · §4b's three options were moot: coverage measured 7/7, not the 4/7 the brief
    asserted, so the click changed uniformly.
  · §4e's sweep found SEVEN reservations, not two. The five on
    /operate/superstress are NOT deleted: verify-superstress §6b asserts
    `shotSlots >= 1` on them as a deliberate paired control.
  · Kathie ships with NO screenshot (artwork undelivered) and no box claiming one.
  · §2 LICENSE and §3 the X handle: reported in the PR, files untouched.

notes for ARCHITECTURE.md patch: none — no new route, no new module, no new
stylesheet rule.

open questions (all in the PR body):
  · LICENSE item 3 — two drafted replacements, operator's choice
  · the canonical host (both apex and www answer; no <link rel="canonical"> exists)
  · the X handle
  · whether to delete the five /operate/superstress reservations in a follow-up

## 8 · LOOP FEEDBACK

- 2026-08-30 · The brief's §4b named a hard dependency ("kyc.rip has NO EcoPopup,
  Superbrain + XMRHUB are blank placeholders") that measurement refuted in one
  command. Three of its options existed only to route around it.
- 2026-08-30 · Three delivered assets and two cited documents (`INDEX-AND-ORDER.md`,
  `claude/mockups/peers-grid-3x3.html`) were absent. p4·06 recorded the same
  absence against the same mockup filename. A brief that says "the operator
  approved X, read it" must carry X into the repo.
- 2026-08-30 · Eight parallel readers missed the one gate that would have HUNG,
  because the reader enumerating click-dependent gates never stated its grep
  scope. A completeness critic found it. Keep the critic.
- 2026-08-30 · The full 39-gate chain caught two defects that the single relevant
  gate did not: a self-referential hex literal (verify-explorer, position 17) and
  a hardcoded row count (verify-protocol, position 20). Run the whole chain.
- 2026-08-30 · The pre-merge adversarial audit found a REAL regression this
  release introduced that all 39 green gates missed — closing a brief wrote
  history and raced the in-app navigation. Worth its cost.
