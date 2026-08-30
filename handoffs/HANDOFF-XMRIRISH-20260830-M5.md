---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260830-M5
branch: claude/new-session-d2mu40
status: done
written_by: claude-code (manual mode — task arrived as a prompt)
owner: claude-code
---

# HANDOFF — p4·M5 "THE FUTURE PAGE, CURRENT AND REORGANISED"

## 1 · GOAL

`/future` currently renders five protocol cards as a flat grid of equals, a Carrot card
whose status and eta predate the published schedule, a stressnet popup with two empty
dashed reservation boxes, and no trace anywhere on the page of the security review that
is the single most consequential thing to have happened to FCMP++. When this is done the
page reads as a sequence rather than a scatter: what is landing now, what is live to try,
what is further out, and how the page stays current — with the audit result rendered as
CONTENT rather than as another link, Carrot's schedule re-derived from its own published
plan and cited, one reserved screenshot satisfied by an artifact that actually exists, and
the reserved box that has no artifact deleted rather than left implying a failed load.

## 2 · CONTEXT

**The brief is `p4M5futurecontentREFRESHED.md` (operator-supplied), carrying its own §0′
rebase header written 2026-08-23 against a prompt written 2026-08-18.** Its base
(`e0c87ad`, #196) is five merges stale; the §0′ header says so and instructs a re-derive
of every budget, the census, and `SITE_PR`.

**Measured base: `9fcc24a`** — the merge of PR #201 (p4·M8, the mobile classic mempool).
`git rev-parse --is-shallow-repository` → **true** (443-commit clone), which bounds what
archaeology is available and must be stated before any `git log --follow` claim.

Relevant files: `app/src/pages/future/data.ts` (883 lines) · `app/src/pages/FuturePage.tsx`
(195) · `app/src/pages/future/EcoPopup.tsx` (234) · `app/src/pages/future/cards.tsx` ·
`ProtoPopup.tsx` · `ProtocolDetail.tsx` · `app/public/peers/peer-superbrain.webp` ·
`app/verify-future.mjs` · `app/verify-ia.mjs` · `app/verify-origins.mjs` ·
`app/verify-superstress.mjs` · `app/verify-bundle.mjs`.

**Premises checked before planning, and two do not survive:**

1. **The brief's description of `peer-superbrain.webp` is wrong about what is in it.**
   §3 says the capture shows "FCMP++ · v0.19.0.0-beta.2.0 · Tor only · TESTNET · block
   height · sync bar · Tor connections". Read directly: it shows `SUPERSTRESS` ·
   `.19.0.0-BETA.2.0 · TOR ONLY` (the `v0` is cropped off the left edge), a MONITOR tab,
   and `NETWORK TESTNET` · `DIFFICULTY 0` · `TX COUNT 0` · `DB SIZE 0 B`, with `Top Block`,
   `Free Disk`, `Busy Syncing` and `TX Pool Size` all **blank** and every connection count
   **0**. There is no FCMP++ string, no block height, and no sync reading. The node in the
   capture has synced nothing. Whatever this release does with the image, the caption must
   say that, or the page claims a busy beta chain over a picture of an empty one.

2. **The explorer link the operator asks for as a new button already exists as a link
   chip.** `data.ts:541` already carries
   `["Beta-chain explorer · simulated · on this site", R.OPERATE_SUPERSTRESS_EXPLORER]`
   in the stressnet entry's `links[]`. The ask is therefore a PROMOTION — chip (`.v6-res`)
   to primary control (`.proto-btn`, beside the simulator CTA) — not an addition, and
   shipping both would duplicate one destination in one dialog.

**Constraints established by reading, not by the brief:**

- `verify-future.mjs:338`, `:251` and `:348` each hardcode **9** repo pulses (5 protocol
  cards + 4 registry). Two of those are `waitForFunction` calls with a 15s timeout, so a
  changed pulse count does not red the gate — it **hangs** it. Adding a repo to the
  server-side allowlist is therefore expensive on three literals and inherits
  `/api/feeds`'s current production failure.
- `verify-future.mjs:99-104` walks the **repo root** over `.ts/.tsx/.js/.mjs/.css/.json/
  .md/.html`, exempting exactly one file. **This handoff and the session note are in
  corpus.** Write around the ban; never restate it.
- `verify-superstress.mjs:582` scopes its endpoint/pending sentence sweep to `hubText`
  (`/operate/superstress`), not `/future`. It is not this release's subject — but the same
  doctrine binds the copy written here regardless of what is gated where.
- `EcoPopup.tsx:194-228` already splits `links[]` on a leading `/` into in-app `<Link>` vs
  external `<a>`; a second primary CTA has to be a real mechanism, not a hardcoded branch.

## 3 · SCOPE

**IN:** the ToB audit finding rendered as content on the fcmp surfaces · Carrot's `status`
and `eta` re-derived from the published plan and cited · the verified new source rows ·
the stressnet popup's screenshot, deleted reservation and promoted explorer control · the
`/future` section reorganisation · the gates that pin all of the above · budgets, census,
`SITE_PR`, LOG, session note.

**OUT (non-goals):** editing the LINEAGE_RX ban · touching `/operate/superstress`'s own
copy · adding any repo to the pulse allowlist unless §2's arithmetic forces it ·
restoring any `/future#<id>` fragment anchor · fixing `/api/feeds`'s production failure ·
any claim about ToB's "fix review" glyph (p4·07 declined it; the reasoning stands).

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict. Edit `app/src/**`; no hand-edited HTML.
- **Zero fabricated values on live surfaces.** Every number is real or an em-dash. A
  screenshot is dated or it silently claims to be current.
- CSP is `connect-src 'self'`; `img-src 'self' data:`. No third-party request, ever.
- New dependencies: none.
- Do not touch: `verify-future.mjs`'s LINEAGE_RX; `vercel.json`'s redirect table unless a
  route moves (none does).
- **Derive every threshold from the tree and say where it came from** (#201's lesson: a
  13px floor invented in a brief against a settled 12px minimum cost four CI rounds).
- **Report measured slack, not "green"** — a gate passing by 0.4px and one passing by 24px
  render identically.

## 5 · DONE-CRITERIA

- [ ] The shipped audit sentence quotes neither "mainnet" nor "exploits", is dated, and is
      rendered as content on an fcmp surface — asserted by a gate, in both polarities.
- [ ] Carrot's `status` and `eta` are re-derived from the published plan, cited in
      `resources[]`, and the roadmap rail's derived text agrees (it reads through
      `roadmapStatus()`, so v19's line moves with the card).
- [ ] The stressnet entry renders one real dated `<img>` with a caption that describes what
      is actually in the capture; the unsatisfiable second reservation is gone; the explorer
      is one primary control and appears exactly once in the dialog.
- [ ] `/future`'s section order is pinned in document order by a gate (`verify-site` §12's
      `data-site-section` idiom is the precedent), so the reorg cannot silently revert.
- [ ] `node verify-future.mjs` exit 0 — including `:338`'s repo count and `:361`'s
      zero-direct-github-requests.
- [ ] `verify-ia`, `verify-origins`, `verify-superstress`, `verify-peers`, `verify-mobile`,
      `verify-nav`, `verify-protocol` all exit 0, with counts RE-DERIVED not edited to fit.
- [ ] `npm run verify:static` and `npm run verify:e2e` both exit 0 (read the recorded exit,
      never a wrapper's).
- [ ] `node verify-bundle.mjs` exit 0 with every raise's arithmetic stated and `lazyJsRaw`
      and `totalJsRaw` moved together.
- [ ] Census RECOUNTED with the counting instrument CONTROLLED against reachable historical
      commits first; `ci.yml` decommented before counting.
- [ ] `SITE_PR` and the LOG line land in one commit; `logMax <= SITE_PR <= logMax + 1`.
- [ ] Renders looked at: `/future` at 1440 and 390, before and after, at dpr 1, 2 and 3.

## 6 · VERIFY COMMANDS

```
cd app
npm run build
node scripts/serve-dist.mjs 4173 &        # kill by PID from lsof, never pkill -f
node verify-future.mjs
node verify-ia.mjs && node verify-origins.mjs && node verify-superstress.mjs
node verify-peers.mjs && node verify-mobile.mjs && node verify-protocol.mjs
npm run verify:static ; echo "STATIC_EXIT=$?"
npm run verify:e2e    ; echo "E2E_EXIT=$?"
node verify-bundle.mjs
```

## 7 · REPORT

Base **`9fcc24a`** (merge of #201), not the prompt's `e0c87ad`. Shallow clone confirmed.

**Seven of the brief's premises did not survive measurement** — the audit's scope (1a AND
1b, not 1a), its resolution count (five resolved AND one partially, not "five of six"), the
Gantt's end date (March 4 2027, not Feb 23 — corroborated twice inside that repo), the §3
capture's contents (no block height, no sync reading, every connection 0), which gate holds
the endpoint/pending proximity rule (`verify-explorer:362`, not `verify-superstress` §6),
whether the explorer button needed adding (it existed as a chip — the ask was a promotion),
and whether reusing the capture would duplicate an image on one page (it would not: the two
popups are on two different pages, measured).

**Delivered:** the audit finding as content with its scope and date; Carrot's status and eta
re-derived and cited; the `v19` rail stop deleted because it asserted a fork nobody is
shipping; Cuprate's release surfaced inside the operator's precision fence; ten stale
fork-date literals corrected and gated tree-wide; the stressnet screenshot, the deleted
reservation and the promoted explorer control; the three-band reorg with its order pinned;
and the repo pulse stating the age of its own reading instead of a refresh policy.

**Declined / removed:** the `api/feeds.js` edge-TTL change (written, measured, reverted —
production runs a pre-`pulls` build so it would be inert; ledgered in CLAUDE.md). No repo
joined the pulse allowlist: that costs six literals across two files and two hard-waits that
HANG rather than red, and inherits `/api/feeds`'s current production failure. No PR or issue
STATE is printed anywhere: `api.github.com` answers 403 for `monero-project/monero` and
`seraphis-migration/monero`, anonymously and with a token, and `github.com` is 403 throughout.
The 403 is REPO-SCOPED, not host-wide — the same host answers 200 for this repo — and an
earlier draft of this report said "api.github.com answers 403 here", which is the
scope-of-a-premise defect stated one section above.

**M6b constraints honoured:** `EcoEntry.id` values are untouched; the only shape change is
two optional additive fields (`ctaLink`/`ctaLabel`), ledgered in the PR body; slot deletion
applies the general rule to the entry this PR touches and does NOT sweep Superbrain's two;
no placeholder added anywhere; no seventh peer.

## 8 · LOOP FEEDBACK

- **A brief that says "the operator has approved X, read it" must carry X into the repo.**
  Not applicable here, but the sibling failure was: §3 described a screenshot's contents
  without opening the file, and four of the six details it listed are not in the image.
  Read the artifact before describing it.
- **`waitForFunction(count === N)` is a hang, not an assertion.** It burns its timeout and
  kills the run, so a real regression reports nothing and a grep for the red marker returns
  empty. Converted six waits; the pattern is `waitCount()` — wait with a budget, then assert
  expected vs actual.
- **Make every red print what it saw.** Three of this release's own assertions were wrong,
  and all three were diagnosed from the message rather than by re-reading the code.
- **A break test that refuses to go red is a finding.** M6 refused twice and both refusals
  were true statements about the page: two, then three, independently sufficient defences.
  Extending the scenario to the width where the subject is NOT inert found a real defect.
- **A plausible mechanism is not a measurement, even inside a correction.** I explained a
  gate defect with "two dialogs are mounted", which measurement refutes (max is one).
- **A reachability result is scoped to what it was measured on.** I wrote "api.github.com
  answers 403 here" from two third-party repo probes, in a session that was itself opening a
  PR through that host. Measured properly: 200 for this repo, 403 for the two source repos,
  anonymously and authenticated alike. The conclusion survived; the premise did not.
