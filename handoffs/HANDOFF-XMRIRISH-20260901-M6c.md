---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260901-M6c
branch: claude/peers-ceilings-baseline-xfx33y
status: in_progress
written_by: claude-code (manual mode — task arrived as a prompt)
owner: claude-code
---

# p4·M6c — PEERS EIGHT AND NINE, AND TWO CEILINGS

## 1 · GOAL
Add an eighth trusted peer (Cake Wallet) and a ninth (Monero Arts Culture, the
operator's own, disclosed as such) to `/operate/peers`, raise the two route
ceilings the shared `data.ts` module pushes over budget, and correct one false
stylesheet comment about what gold means.

## 2 · CONTEXT
Base `9f9e176`, verified four ways (parents `fa5e518`+`fc028df`, two-dot diff
empty, tree object identical `85bd6a2…`).

BASELINE MEASURED, not quoted. The brief's two starred figures were derived by
arithmetic on #204's report; both reproduce exactly. Two route rows in the
brief's table do NOT:

| row | brief said | MEASURED on 9f9e176 | brief margin | real margin |
|---|---|---|---|---|
| lazyJsRaw | 990,587 (derived) | **990,587** | 2,413 | 2,413 ✓ |
| totalJsRaw | 1,255,044 (derived) | **1,255,044** | 2,956 | 2,956 ✓ |
| /operate/peers | 105,343 (#203) | **105,513** | 657 | **487** |
| /operate/superstress | 106,539 (p4·M3) | **108,244** | 3,461 | **1,756** |

The brief flagged superstress as stale and did not flag peers, which is also
stale — by 170 B, so the margin handed to me was 35% too generous.

## 3 · SCOPE
`app/src/pages/future/data.ts` · `app/src/pages/future/EcoPopup.tsx` ·
`app/src/styles.css` (comment only) · `app/verify-bundle.mjs` ·
`app/verify-peers.mjs` · `app/src/data/siteVersion.ts` · `handoffs/LOG.md`.
NOT in scope: `README.md`, and the `data.ts` PARTNER-array split (owed, third
release running).

## 4 · CONSTRAINTS
- Zero new stylesheet rules — `cssGz` margin is 414 B.
- Mint no chunk: count is 76 in a 73±4 band, so the ceiling is 77.
- No fabricated claim, no unsourced superlative, no user count.
- An image that cannot be fetched does not ship, and there is no placeholder
  type to fall back to (`EcoShot` header).

## 5 · DONE-CRITERIA  — the gate reads ONLY this section
- [ ] Base is `9f9e176`, quoted, verified four ways
- [ ] Baseline `verify-bundle` run and reported; starred figures confirmed or refuted
- [ ] Cake Wallet entry ships; asset question resolved and the resolution stated
- [ ] MAC entry ships with no `url` and no `links`; all three hazards MEASURED
- [ ] `PEER_IDS` has exactly 9 members; `?p=` resolves for all nine
- [ ] Both route ceilings raised from measured figures; both stale comments re-baselined
- [ ] `cssGz` unchanged; no stylesheet rule added
- [ ] chunk count 76 → 76
- [ ] `SITE_PR` 205 + LOG.md line in the same commit
- [ ] Four break tests run, each restored from the committed blob
- [ ] `verify:static` and `verify:e2e` green on the shipping tree

## 6 · VERIFY COMMANDS
```
cd app && npm run build && node verify-bundle.mjs
cd app && npm run verify:static
cd app && npm run verify:e2e
```

## 7 · REPORT  — filled on exit
status:
pr:
commits:

## 8 · LOOP FEEDBACK
