---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260816-37
branch: claude/prompt-attached-deygct
status: in_progress        # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — task arrived as a prompt, p3·15)
owner: claude-code
---

# HANDOFF — p3·15 · SUPERBRAIN AS 4TH TRUSTED PEER

## 1 · GOAL

`github.com/brainchainz/Monero-Superbrain` becomes the **fourth ecosystem partner** on
`/about/peers` and the fifth ecosystem panel on `/future`: an Umbrel community app store
carrying five Monero apps, framed as sovereignty tooling (software you run on your own
box) rather than as another site you visit. Its card carries a **live** repo pulse — no
star or commit count is ever typed into JSX. Shipped alongside it, and the more durable
half: the **`ECOSYSTEM_META` ↔ `ECOSYSTEM` drift gap is closed** by a both-directions
verify-ia section, so the next entry added without its palette row is a red rather than a
silently-invisible panel.

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

- [ ] `npm run build` exits 0 (typecheck runs inside it — `tsc -b && vite build`)
- [ ] `node verify-bundle.mjs` exits 0 with every raised ceiling red-then-green on the
      FINAL tree, built + margin ≤ 4,000
- [ ] `npm run verify:static` exits 0
- [ ] `npm run verify:e2e` exits 0 (all 30 members, `verify-future` and `verify-ia` among them)
- [ ] `verify-ia`'s new section shows a **two-polarity** transcript: a scratch state with
      the new `ECOSYSTEM_META` row deleted goes RED naming the missing id, and a scratch
      state with a phantom META id goes RED in the reverse direction
- [ ] `/about/peers` renders FOUR partner cards; the Superbrain card's href is exactly
      `https://github.com/brainchainz/Monero-Superbrain`
- [ ] The install block renders complete and in order (4 steps)
- [ ] No digit-literal in the pulse JSX — machine-checked
- [ ] `grep -rn "mempool\.space" app/src` returns empty (bracketed)
- [ ] Renders captured and LOOKED AT: /about/peers (pulse live + pulse absent), the
      EcoPopup brief open, /future with the fifth panel, ⌘K finding it, 390px, reduced motion
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
npm --prefix app run build
cd app && node verify-bundle.mjs
cd app && npm run verify:static
cd app && npm run verify:e2e
```

## 7 · REPORT — claude code fills this on exit, completely

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK

<appended at write-back>
