---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260901-M6c
branch: claude/peers-ceilings-baseline-xfx33y
status: done
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

## 7 · REPORT
status: done
pr: https://github.com/aqua-019/satoshis-vision-v1/pull/205
commits: c606c23 · 796fffd · a846d47

**THE ASSET IS UNREACHABLE AND THE EIGHTH PEER SHIPS WITHOUT IT.** Measured on
three independent routes: cupcakewallet.com answers 403 to CONNECT with the
proxy logging `connect_rejected` by name; cakewallet.com, monero.com and
docs.cakewallet.com all read 000; api.github.com resolves but is bound to this
repository so it cannot reach a mirror. Per `EcoShot`'s own header a slot
without an image does not exist, so there is no `shot` key rather than a
placeholder — p4·M6b's medallion precedent. This session read none of the four
Cake Wallet hosts and the entry says so.

**TWO OF THE THREE PREDICTED HAZARDS WERE ALREADY CORRECT.** `primary` has one
consumer, inside the `e.url ?` branch that never runs for a url-less entry, and
the `else` beside it renders `open panel →` — unreachable until now because all
seven previous partners carry a url. `EcoPopup` already guards its VISIT anchor.
Measured on the render: `borderColor rgba(203,213,225,0.267)`, `textShadow
rgba(203,213,225,0.333) 0 0 16px`, footer `our brief open panel →`, 0 anchors,
0 hrefless anchors, `visitControls: 0`.

**THE THIRD WAS REAL:** EcoPopup rendered its "Links" rule and heading
unconditionally above a map over an empty array. Guarded here, and gated —
BT5 reverted the guard and all 70 assertions stayed GREEN, the same
no-witness shape p4·M6b's `col-2` change was found in. New §11b is a
biconditional inside §11's existing sweep; both arms carry live subjects.

**THE BRIEF NAMED TWO CEILING ROWS AND THE BUILD FOUND THREE.** `/future` went
red at 112,326 of 112,000 on the first build and renders NEITHER new peer, so
two of the three routes charged render none of what they are charged for. All
four budget comments touched were stale: /operate/peers 103,330 vs 105,513,
/operate/superstress 106,539 vs 108,244, /future 108,502 vs 111,152.

**THE BRIEF'S §4 POINT 3 IS A RIGHT NUMBER ON A WRONG NOUN** — `c: "#ffd400"`
occurs exactly twice and neither occurrence is a peer (cuprate's protocol card,
the v20 roadmap stop). Points 1 and 2 stand; the sentence is scoped to the
provenance vocabulary.

Budgets: eagerJsRaw BYTE-IDENTICAL 264,457 · cssGz BYTE-IDENTICAL 18,586 (no
stylesheet rule) · lazy and total both +3,256 so the eager delta is exactly
zero · chunks 76 = 76 · SITE_PR 204→205 costs 0 raw bytes.

## 8 · LOOP FEEDBACK

- **DEFERRED** — the `data.ts` PARTNER-array split. Third release running that
  this rent is paid instead of the fix. Both raised route rows would get
  CHEAPER under it rather than dearer.
- **DEFERRED** — the Cake Wallet image, until an environment that can reach
  cupcakewallet.com fetches it. It arrives as `kind: "artwork"`, no `captured`.
- **NOT FIXED, named** — BT1: the ownership disclosure is convention, not
  structure; nothing reads `kind` for it. A gate would pin prose to prose,
  which p4·M6's §3 precedent deliberately removed rather than added.
- **NOT FIXED, named** — BT2: a `var()` token in `c` is caught by nothing, and
  it is SHARPER than the brief predicted. Not "silently dropped": the
  declaration is RETAINED in the CSSOM as a pending-substitution value and the
  computed border becomes `rgb(201,198,216)`, an unrelated colour. So a check
  that the declaration is present passes, and so does a check that the computed
  colour is non-default.
- **BRIEF DEFECT** — §5's third break test ("give the ninth cell an `id` and
  push it into ECOSYSTEM") presupposes a design this PR did not take: MAC is a
  real ECOSYSTEM entry from the start, so `PEER_IDS` is 9 and `?p=mac` is
  reachable by construction, both proven by verify-peers §10 rather than by a
  mutation. The test as written has no subject.
- **BRIEF DEFECT** — the ceiling table named two rows where a build finds
  three, and quoted /operate/peers as current when it was stale by 170 B.
