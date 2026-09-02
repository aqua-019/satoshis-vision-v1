---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260902-M10
branch: claude/new-session-iyr4hc
status: done                   # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, brief attached as p4M10txdeeplink.md)
owner: claude-code
---

# HANDOFF — p4·M10 · A TRACKED TRANSACTION GETS AN ADDRESS

## 1 · GOAL
A transaction tracked in any mempool view has a URL: `/live/mempool?v=<view>&tx=<64-hex>`.
Opening that URL cold opens the tracking panel on that transaction; a typed or clicked
track WRITES the parameter (functional form, PUSH, `?v=` untouched); untracking CLEARS it
(REPLACE); a malformed value is ABSENT (the plain mempool, no error surface); a well-formed
unknown value reaches the existing not-found panel; `?block=` and `?tx=` resolve by ONE
stated precedence in ONE expression; Back/Forward walk the tracked transactions in order;
and the record says in one sentence what a shared link carries.

## 2 · CONTEXT
- Base `cabab9c` (merge of #209), verified: parents `8dc7a56` + `35254a1`, tree clean.
- Brief: `p4M10txdeeplink.md` (uploaded). Its §2 privacy measurement holds on this tree:
  `mempool/live-detail.ts:99,115,130` already send every tracked txid to this origin as a
  path segment (`/api/xmr/tx/<txid>`), and `vercel.json:14` ships
  `Referrer-Policy: no-referrer`.
- Relevant files: `app/src/mempool/mempool-shared.tsx` (`useMempoolTracking`, the ONE
  owner of tracking state, called by all ten views; `MempoolSearchBar`'s validator at :166),
  `app/src/pages/MempoolPage.tsx` (`?block=` read at :52, `clearFocus` at :54),
  `app/src/routes/useUrlState.ts` (the push/replace policy; NOTE its spec requires an
  ENUMERATED `values` list, which a txid cannot satisfy — `?block=` is likewise hand-wired
  with `useSearchParams` + a regex, and `?tx=` follows THAT shape, not the hook's),
  `app/src/mempool/tx-detail.tsx:129` (the not-found state, "Not returned by the node" —
  the brief's second unknown, VERIFIED to exist), `app/verify-tracking.mjs` (view-generic
  tracking gate, its own CI step), `app/verify-bundle.mjs:1626` (the stale
  `//  96,835` row).
- Measured on the installed react-router-dom 6.30.4: `setSearchParams`'s functional form
  composes on the RENDER-TIME `searchParams` (`nextInit(searchParams)` in a `useCallback`
  closed over it), so two writes in one tick both compose on the same stale copy and the
  SECOND navigation is what survives. The views' `clear` calls `clearTracking()` AND
  `onClearFocus()` — two writes. Every clear write therefore deletes BOTH keys, so the pair
  converges on the same URL whichever lands last.

## 3 · SCOPE
IN: `?tx=` read/write/clear in `useMempoolTracking` (zero per-view edits — ten views share
the hook); `?block=`/`?tx=` precedence as one expression in `MempoolPage`; ONE exported txid
validator; `verify-tracking.mjs` sections for every §5 item; the `/live/mempool` budget row
re-baselined in its own first commit; `SITE_PR` 209 → 210; LOG line; CLAUDE.md note.
OUT (non-goals): writing `?block=` on IN-VIEW block clicks (blocks keep their Home-ribbon
deep link only — the tx claim is dropped when a block opens, and that wart is recorded);
`#tx=` fragment form (operator's call, `useUrlState` does no hashes — priced in the record);
the standalone `/live/mempool/tx/:txid` page (unchanged); a REST redesign of the ten views'
copy-pasted `focusBlock` effects.

## 4 · CONSTRAINTS
- Stack: React 18 / Vite 5 / TS strict / react-router-dom 6.30.4 / Node 22.
- `/live/mempool`'s TRUE margin is measured first, not read from the brief (which quotes
  M9b's base, one release stale). Near-zero JS: no new component, no new chunk, no new
  stylesheet rule.
- Only `id` goes in the URL. `blockHeight`, `explicit` and the resolved detail stay local.
- No `Math.random()`, no fabricated value on any live surface. Reduced-motion path unchanged.
- Do not touch: `api/`, `vercel.json`, `styles*.css`, `scripts/routes.mjs`.

## 5 · DONE-CRITERIA  — the gate reads ONLY this section
- [x] `npm run build` exits 0 (typecheck is its first step)
- [x] `verify-bundle.mjs:1626`'s `/live/mempool` row re-baselined from a build of `cabab9c`, in
      its own commit, old figure visible in the diff
- [x] `verify-tracking.mjs`: on EVERY registered view, a cold `?v=<id>&tx=<tracked>` opens the
      chip on the SAME txid (short-hash re-read), the typed search WRITES `tx=` with `v=` intact,
      and Clear tracked REMOVES `tx=` with `v=` intact
- [x] `verify-tracking.mjs` §7 (classic): 63-hex `?tx=` → no chip, no detail, no pageerror;
      unknown 64-hex → chip + "Not returned by the node"; `?block=&tx=` in BOTH orders → the tx;
      typed track PUSHES exactly one entry; Clear REPLACES (history length unchanged);
      A then B, Back → A, Back → none, Forward → A, Forward → B; a view switch keeps `tx=` and
      the new view shows the chip; a block search while a tx is tracked drops `tx=` and Back
      returns to the tx
- [x] Break test M1: the tx write reverted to the OBJECT form `setParams({ tx })` → named
      reds (the `v=` survivors), transcript captured; M2: 63-hex → degrades, no throw
- [x] Every new assertion has a two-polarity transcript (M1/M2 plus the fixture's own controls)
- [x] Budget: `/live/mempool` before/after byte-exact against the base build, delta attributed
      to residual zero, no ceiling raised unless crossed (red-then-green if so)
- [x] `npm run verify:static` exit 0; `verify-nav`, `verify-memviews`, `verify-memdetail`,
      `verify-glide`, `verify-memphone`, `verify-memstats`, `verify-nojs` green on the final tree
- [x] `SITE_PR` = 210 (`logMax + 1` at commit time), LOG.md line, CLAUDE.md note carrying the
      one-sentence statement of what a shared link carries — same push as the tree
- [x] Branch pushed · draft PR opened via the GitHub MCP (`gh` absent in cloud sessions)

## 6 · VERIFY COMMANDS
```
cd app && npm run build
cd app && node verify-bundle.mjs
cd app && node scripts/serve-dist.mjs 4173 &   # then:
cd app && node verify-tracking.mjs
cd app && node verify-nav.mjs && node verify-memviews.mjs && node verify-memdetail.mjs && node verify-glide.mjs && node verify-memphone.mjs && node verify-memstats.mjs && node verify-nojs.mjs
cd app && npm run verify:static
```

## 7 · REPORT  — claude code fills this on exit, completely
status: done — every §5 box passes on the final tree (`verify:static` exit 0; verify-tracking 184,
  verify-nav 129, memviews, memdetail, glide, memphone 451, memstats 80, nojs all green;
  verify-bundle 32, nothing raised). The full 39-member `verify:e2e` chain is CI's to run on the
  PR head; this sandbox ran the eight gates the handoff names plus the static chain.
pr: PR_URL_PENDING
commits:
  - docs(handoffs): the handoff, before feature work
  - test(bundle): re-baseline the /live/mempool row from a build of cabab9c (96,835 → 106,038; margin 962)
  - feat(mempool): ?tx= read/written in useMempoolTracking; precedence in MempoolPage; verify-tracking 89 → 183
  - fix(mempool): a ?block= deep link no longer consumes itself on arrival (verify-nav §4a's catch); control hardened → 184
  - docs: CLAUDE.md note, LOG line, README claims-table row, SITE_PR 210, ci.yml step counts (61 → 184, 36 → 80)
deps added: none
deviations from spec:
  - The brief's §3 sketches the read in MempoolPage "exactly as ?block= is". It is in useMempoolTracking
    instead, because the page's ?block= read is turned into a search by an effect every one of the ten
    views carries by hand; a page-level ?tx= read would have been an eleventh copy. The page keeps ONE
    expression — precedence — and the hook keeps the read, the write and the clear.
  - useUrlState is NOT used for ?tx= (its spec demands an enumerated values list); its policy is
    followed and quoted, its functional-form idiom is reproduced, and M1 proves the gate now holds it.
  - A block search drops a stale `block=` claim (naming a different block) and any `tx=` claim, by a
    PUSH. The brief asked only for mutual exclusion + stated precedence; the extra rule is what keeps
    the URL from claiming a thing not on screen after a hand-composed URL. The first cut dropped
    `block=` unconditionally and broke the Home ribbon's deep link — caught by verify-nav §4a, fixed,
    gated (§8c control), break-tested (M7).
  - One README row added (the reader-facing sentence §5 item 8 asks for); the brief named no file.
  - Seven break tests, not two: M3–M7 cover precedence, the two-writes hazard, push vs replace, the
    URL → state effect, and the deep-link regression.
notes for ARCHITECTURE.md patch: `/live/mempool` query surface is now `?v=` (view, push) · `?block=`
  (Home-ribbon block deep link, read; never written by in-view clicks) · `?tx=` (tracked transaction,
  push on track, replace on clear). Both `block` and `tx` drive ONE tracking slot; a well-formed `tx`
  wins. The one txid validator is `TXID_RE` in mempool-shared.tsx (live-detail.ts keeps a private
  copy to avoid an import cycle).
open questions:
  - `?tx=` vs `#tx=` is the operator's call; `?tx=` is recommended and the fragment is priced in the
    CLAUDE.md note (a second URL-state idiom, useUrlState does no hashes).
  - Writing `?block=` on IN-VIEW block clicks would make the slot round-trip fully (today Forward from
    a block entry is lossy, because a block has no URL claim of its own). A scope decision, not taken.
  - RouteAnnouncer announces "Navigated to Mempool" on a track, because its effect keys on
    location.search by design. Consistent with ?v=; a little odd; untouched.

## 8 · LOOP FEEDBACK  — cowork appends here when verify (step 04) fails
