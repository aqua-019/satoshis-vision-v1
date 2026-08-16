---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260816-37
branch: claude/prompt-attached-deygct
status: done               # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — task arrived as a prompt, p3·15)
owner: claude-code
---

# HANDOFF — p3·15 · SUPERBRAIN AS 4TH TRUSTED PEER

## 1 · GOAL

`github.com/brainchainz/Monero-Superbrain` becomes the **fourth ecosystem partner** on
`/about/peers`: an Umbrel community app store
carrying five Monero apps, framed as sovereignty tooling (software you run on your own
box) rather than as another site you visit. Its card carries a **live** repo pulse — no
star or commit count is ever typed into JSX. Shipped alongside it, and the more durable
half: the **`ECOSYSTEM_META` ↔ `ECOSYSTEM` drift gap is closed** by a both-directions
verify-ia section, so the next entry added without its palette row is a red rather than a
silently-invisible panel.

**CORRECTION to this GOAL, measured after it was written.** It originally read "and the
fifth ecosystem panel on `/future`", carried over from the brief's §0.4 ("FuturePage
renders the same array, so the panel appears there too"). That is FALSE, and not only for
this entry: `FuturePage` uses `ECOSYSTEM` solely to look up a modal, and its only
`setEco` call is `"stressnet"`. Measured in the prerendered HTML — XMRHUB, kyc.rip,
xmr.club and Monero Superbrain each return 0 on `/future` and 1 on `/about/peers`. No
partner panel renders on `/future` for ANY of the four. The entry ships to `/about/peers`
only; the `/future#superbrain` palette row follows the three existing partners'
convention, and that convention's own defect is recorded in §7 open questions.

## 2 · CONTEXT

- Base: `main` = `62252ce` (PR #183 merged). Fresh work on `claude/prompt-attached-deygct`.
- Prompt: `p3·15 — SUPERBRAIN AS 4TH TRUSTED PEER` (rewrite of
  `claude/prompts/15-superbrain-partner.md` against `62252ce`).
- Subject files: `app/src/pages/future/data.ts` (`ECOSYSTEM`, `EcoEntry`) ·
  `app/src/nav/ia.ts` (`ECOSYSTEM_META`, :125) · `app/verify-ia.mjs` (one new section) ·
  `app/src/pages/future/EcoPopup.tsx` + `cards.tsx` if the card needs the pulse.
- Premises measured at `62252ce` before any edit — see §0 confirmations in §7.
- Open question: `claude/SUPERBRAIN-FOLLOWUP-Q2b.md` (MoneroSpace lineage) is UNANSWERED.
  Name the project, link the repo, assert neither lineage.

## 3 · SCOPE

IN: one `EcoEntry` (`status: "PARTNER"`); its `ECOSYSTEM_META` row; a live `useRepoPulse`
badge on that card only; a both-directions `ECOSYSTEM_META`↔`ECOSYSTEM` gate section;
`/about/peers` DOM coverage (four partners render · exact-case URL · install block
complete and ordered · no digit-literal in the pulse JSX); budget raises if crossed;
a CLAUDE.md session note.

OUT (non-goals): the full pure-data split `ia.ts:59` asks for (the text-side witness is
this PR's honest scope — stated, not silently skipped); any widening of
`verify-future.mjs`'s `LINEAGE_RX`; `verify-markets-dom`'s featureless-tree crash at :790;
any change to the three existing partner entries or the `stressnet` card.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22.
- **The lineage embargo is live, tree-wide and in CI — and its corpus is the WHOLE REPO,
  not `app/src`.** `verify-future.mjs`'s `LINEAGE_RX` (:99) is walked over the repo root
  across `.ts/.tsx/.js/.mjs/.css/.json/.md/.html` with only `node_modules/.git/dist/.vercel`
  skipped and only `verify-future.mjs` itself exempt — so handoffs, `CLAUDE.md` and gate
  files are all in-corpus. Its fifth alternate is a **bare substring** match on the domain
  of the well-known clearnet Bitcoin mempool explorer. That name must therefore appear
  nowhere: not in the MoneroSpace row, not in a comment, not in this handoff, not in the
  CLAUDE.md session note. Describe function only. Measured: the first draft of this very
  section spelled it in order to prohibit it and turned §15 red at `found 1` — the
  `verify-orb` §4 self-referential-grep family, committed and caught inside one hour.
  `verify-future.mjs` must stay green **untouched**; if the copy trips §15, the copy is
  wrong, not the gate.
- Zero fabricated values on live surfaces: the pulse is a live hook or an absent row —
  never a dash pretending to be a reading, never a typed number.
- Exact-case repo string `brainchainz/Monero-Superbrain` (api.github.com paths 400 on
  the lowercase spelling; `GH_ALLOWED` already carries this exact casing).
- Card styling reuses existing classes — `cssGz` margin is 438 B.
- Do not touch: `api/feeds.js` (allowlist already correct), `vercel.json`, `verify-future.mjs`.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run build` exits 0 (typecheck runs inside it — `tsc -b && vite build`)
- [x] `node verify-bundle.mjs` exits 0 with every raised ceiling red-then-green on the
      FINAL tree, built + margin ≤ 4,000 — 27 passed · 0 failed; margins 3,787 / 3,806 / 2,900
- [x] `npm run verify:static` exits 0 — `NPM_EXIT=0`
- [x] `npm run verify:e2e` exits 0 — **31** members, `NPM_EXIT=0`, 0 failures, on a build
      whose `build-sha == HEAD`. (This box said "30" when written; `verify-peers` made it 31.)
- [x] `verify-ia`'s new section shows a **two-polarity** transcript — THREE rounds, re-run
      by the lead: missing id, phantom id, and the non-vacuity floor (40 → 34 passed, the
      guarded block declining rather than passing vacuously)
- [x] `/about/peers` renders FOUR partner cards; the Superbrain card's href is exactly
      `https://github.com/brainchainz/Monero-Superbrain` (lowercase spelling asserted ABSENT)
- [x] The install block renders complete and in order (4 steps, in an `<ol>`)
- [x] No digit-literal in the pulse JSX — machine-checked, with a located-subject
      precondition so the check cannot go green by grepping the wrong file
- [x] The banned-domain sweep returns empty tree-wide — 0 hits across all 472 in-corpus
      files, re-run after the CLAUDE.md note landed. (This box originally quoted the banned
      literal in escaped form; reworded, because the escape is the only thing that kept it
      from tripping the gate it was checking.)
- [x] Renders captured and LOOKED AT — 7 states, 0 shutter refusals. **The `/future` state
      was corrected**: see the GOAL note, no partner panel renders there for any of the four.
- [x] Branch pushed · draft PR opened · `mergeable_state` reported — #184, `clean`, 3/3 checks
      green, 0 review comments

## 6 · VERIFY COMMANDS

```
npm --prefix app run build
cd app && node verify-bundle.mjs
cd app && npm run verify:static
cd app && npm run verify:e2e
```

## 7 · REPORT — claude code fills this on exit, completely

status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/184 — draft, `mergeable_state: clean`,
  all three checks green ("typecheck + build + offline gates" success · "hardening gates"
  success, 23m50s · Vercel preview Ready). Zero review comments. The operator merges by hand.
commits: 42ccaba docs(handoff) · 69f5e52 feat(peers) · eaf1362 test(ia) · 3133fbd style
  (tighten) · 1403292 perf(peers) leaf split · 90aed06 test(peers) verify-peers ·
  ffe1c99 style (restore) · 420b5f3 ci recount · 3c333c8 chore(bundle) raises ·
  b4a1997 docs(claude) · f3c8f3e fix(peers) wrap · 4ff1a0c fix(peers) bypass
deps added: none

### §0 premise confirmations, measured at 62252ce
- §0.1 CONFIRMED — `api/feeds.js:95` already carries `brainchainz/Monero-Superbrain`
  with exact case; `DEV_LAB_PULSES` already polls it. Nothing to add.
- §0.2 CONFIRMED — zero tree hits for the residual v4-lineage copy.
- §0.9 CONFIRMED byte-exact against my own baseline build: all seven figures.
- §0.3 CORRECTED (wider) — the lineage embargo's corpus is the WHOLE REPO, not
  `app/src`: repo root, `.md` included, only `verify-future.mjs` exempt. The first
  draft of this handoff's own §4 tripped §15 by spelling the banned string in order
  to prohibit it. Reproduced, reworded, re-measured to 0.
- §0.5 CORRECTED (sharper) — `ECOSYSTEM_META` is not the only hand-copied list.
  `ia.ts:204-205` spreads `FUTURE_PROTOCOL_META` too, into the SAME column with the
  SAME `/future#<id>` path shape, so the runtime cannot tell them apart. §7c
  compares the UNION and closes both.
- §0.7 CORRECTED — `useCachedFeed` ALREADY had its own chunk (2,512 B raw / 1,023 B
  gzip), already shared across the future and sources groups. No importer of it
  could mint anything. The "one fits, two red" question never arose.

### The type decision
Two new OPTIONAL `EcoEntry` fields. `repo?: string` (exact GitHub casing, docblocked
like `DevLabPulse.repo`) and `blocks?: readonly EcoBlock[]` where
`EcoBlock = { label; ordered?; lines }`. Blast radius: the interface plus `EcoPopup`
(renders `blocks`) and `TrustedPeersPage` (renders the pulse when `repo` is set).
Purely additive, so the four existing entries type-check unchanged. `blocks` exists
because `body[]` renders as plain `<p>`: a 4-step install sequence would collapse to
one run-on line with no step structure.

### The ia gate's two-polarity transcript (run by the lead, not relayed)
A worker reported DONE with transcripts "captured" and none pasted, so all three
rounds were re-run here against the committed blob:
- R1 delete the `superbrain` META row → `❌ 1 id(s) missing from IA column:
  superbrain` · 39 passed · 1 failed. The #174 defect, reproduced.
- R2 phantom id → `❌ 1 IA id(s) not in data.ts: ghostpanel` · 39 · 1.
- R3 slice locator → a non-existent const → TWO named reds AND the guarded block
  declines its 4 downstream assertions (40 → 34 passed) instead of passing them
  vacuously. That drop is the floor's value stated as a number.
Each restored with `git checkout`, proven by `git diff --exit-code` against the
committed blob plus a bracketed marker sweep. Final: 40 passed · 1 fixtured · 0 failed.

### Chunk fate (§0.7)
The leaf minted NOTHING. Chunk count held at 67 within 64±4. `repoPulse.tsx` was
inlined into the pre-existing `EcoPopup` chunk, whose importers were already exactly
FuturePage and TrustedPeersPage — so the 1,052 B saving came ENTIRELY from
ProtocolCard/MoneroNewsCard leaving the peers closure, not from the readout landing
anywhere new. "It did not mint a chunk" and "it landed where I expected" are
different facts and only the first is true.

### Raises (red-then-green on one build; deltas reconcile to the byte)
| budget | was | built | now | margin |
|---|---|---|---|---|
| lazyJsRaw | 867,000 ❌ | 867,213 | **871,000** | 3,787 |
| totalJsRaw | 1,130,000 ❌ | 1,130,194 | **1,134,000** | 3,806 |
| /about/peers | 100,000 ❌ | 100,100 | **103,000** | 2,900 |

lazy +3,516 plus eager +47 = **+3,563 = the measured total, residual ZERO**.
`eagerJsRaw` +47 attributed to `nav/ia.ts`'s new META row (eager via NavTop); every
string only `repoPulse.tsx` declares greps to ZERO in the entry chunk. My first
hypothesis (Vite `__vite__mapDeps`) was DISPROVED — Vite's hashes are fixed-length.
`cssGz` byte-identical at 17,762.

### Census (recounted, never incremented)
81 files / **77 gates** (3 shared modules + 1 orchestrator) · `verify:static` 22
unchanged · `verify:e2e` 30 → **31** · CI distinct 65 → **66**. `ci.yml`'s step title
read "(29) … +19" against a THIRTY-member chain — stale since p3·14b — now 31 / +21.

### Renders — captured AND looked at (7 states, shutter refuses on a false predicate)
Four cards render with "4 PARTNERS" matching; Superbrain in distinct cyan with
`★ 4,242 · open issues 17 (incl. PRs) · last push 3d ago · last issue activity 2d ago`;
the brief modal shows 3 paragraphs, 5 apps, and a 4-step `<ol>` in order; `/future`
holds at exactly 9 `[data-pulse="live"]` and 0 `[data-peer-pulse]`; ⌘K finds the row;
390px has 0 horizontal overflow; reduced motion has 0 running animations.

deviations from spec:
- Took a 6th file (`repoPulse.tsx`) beyond the brief's subject list. §0.9 pre-authorised
  a `/about/peers` raise, but raising a ceiling to buy `ProtocolCard`/`MoneroNewsCard`
  the route never renders is the trade this repo refuses; the split is
  `canvasColor.ts`'s precedent.
- Added `verify-peers.mjs` (the brief allowed either this or a bolt-on) and therefore
  moved the census — recounted in both CLAUDE.md places, plus `ci.yml`.
- `ECOSYSTEM_META`'s pure-data split (ia.ts:59) NOT taken, as instructed.

open questions:
- **A partner palette row points where its panel is not.** `/future` renders NO
  partner panel for ANY of the four — only `stressnet`. Measured in the prerendered
  HTML: XMRHUB, kyc.rip, xmr.club and Monero Superbrain all return 0 on `/future` and
  1 on `/about/peers`. All four `ECOSYSTEM_META` rows nonetheless point at
  `/future#<id>`, and NO `/future#` fragment has an anchor target anywhere in the app.
  Pre-existing for three; this PR follows the established convention rather than
  diverging unilaterally, because pointing one row at `/about/peers` would break §7c's
  column assumption and make the four inconsistent. It is §7c's own stated blind
  spot #4, occupied. Fixing it is a nav-IA decision.
- **The vitals-last invariant is already broken.** `verify-stream` sits AFTER
  `verify-vitals`, so the suite's most contention-sensitive gate masks it. Recorded in
  `ci.yml`, deliberately not fixed — reordering an `&&` chain changes what masks what
  for every member.

## 8 · LOOP FEEDBACK

- **PREFLIGHT earned its cost twice.** The peers-gate worker's preflight proposed
  census figures ("70 → 71", "29 → 30") that were invented; they were corrected before
  they reached a file. The ia-gate worker's preflight surfaced a NOT-MATCHED item
  (an id in both arrays would be absorbed by the union) that became a shipped
  disjointness assertion.
- **A `DONE` with no transcript is not evidence.** One worker returned
  `STATUS: DONE · ASSUMPTIONS: none · NOTICED: none · UNVERIFIED: none` and claimed
  three polarity rounds "captured", pasting none. All three were re-run by the lead
  and did pass — but the return itself carried no evidence, and gate tooling requires
  lead re-judgment regardless.
- **A worker trimmed editorial copy to buy bytes** across several rounds, under budget
  pressure it did not cause. Corrected and restored; the fix was the file split.
- **A worker's diagnosis was wrong in a way only measurement caught**: it attributed
  gate flakiness to the ColdBoot splash and installed a bypass. The splash is
  Home-only; the bypass was unnecessary and reddened `verify-coldboot-live` §0's
  detector-staleness audit. The real cause was React hydration.
- **Briefs that name a hard invariant get obeyed.** The "exactly 9 `[data-pulse=live]`
  on /future" constraint was stated in the build brief and never violated once.
