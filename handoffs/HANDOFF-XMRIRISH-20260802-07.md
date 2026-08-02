---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-07
branch: claude/provenance-freshness-truth-6ddexw
status: done           # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — v6.1.4 Provenance freshness truth (PR C · item 5)

## 1 · GOAL

The badges tell the truth. Today 18 `<Provenance>` badges pulse a green "live"
dot that is a hardcoded string literal — they pulse through a total node outage,
and on `/network` two of them pulse directly beside the literal text `· stale`
rendered by their own panel header. When this is done the freshness of a badge is
*derived* from the endpoints its panel actually reads, `ProvFreshness` can express
`error` and is guarded by an exhaustive switch, a static gate makes a hardcoded
live dot fail CI rather than fail review, every live-data panel shows when its own
endpoint last answered (frozen at last-good during an outage, with the age still
counting up), and the gold stale suffix stops blinking at readers who asked it not
to.

## 2 · CONTEXT

- Source: the v6.1.4 prompt, block 05c of 19 — PR C, the third of prompt 05.
- Scope source of truth: `handoffs/HANDOFF-XMRIRISH-20260802-06.md` §3 OUT item 5
  and §8 LOOP FEEDBACK. That handoff, not the prompt, defines scope; where they
  disagree the handoff wins and the disagreement is reported.
- Branched fresh from `origin/main` at `9820966`, which contains PR A (#151) and
  PR B (#152).
- Prior art: PR A's `app/src/data/feed-status.ts` (`FeedPhase`, `FeedKey`,
  `hasData`/`isStale`/`isDown`, `feedDegraded`'s pair-AND, `chromePhase`,
  `freshAt`, `assertNever`); PR B's per-endpoint clocks and `PanelFrame`'s
  `dataKey`/`stale`.

## 3 · SCOPE

IN — item 5's first three sub-items plus the two defects that land on this surface:

1. `ProvFreshness` gains `error`; the badge renders a distinct treatment; the
   header documents all five; the render gains its first exhaustiveness guard.
2. `<NodeProvenance>` to the handoff's three binding requirements, and the
   rewiring of every blind `fresh="live"` site to it.
3. A static gate that fails on a literal `fresh="live"` outside a reasoned
   allowlist.
4. Per-panel last-updated timestamps from `freshAt(status[key])` across all 32
   live-data panels.
5. `.prov-fresh--stale` into the reduced-motion kill-list (handoff §8 latent
   defect 1), with the new error suffix in it from the start.
6. Triage of the no-prop sites into live-and-unmarked vs correctly-silent.

OUT — deferred, carried forward from handoff 06 §3:

- Structure-aware skeletons, stale-while-revalidate, skeleton→content crossfade
  (item 5.4).
- `PanelBoundary` + inline retry (5.5), degraded-mode banner (5.6), offline badge
  UI (5.7), jittered retry backoff (5.8), zero-results states (5.9).
- `api/status.js` + the `/sources` status page + `api/verify-status.mjs` (5.10) —
  still the reserved first caller for `makeReporter`'s unshipped `fixture()`.
- `MarketsPage:291`'s source mis-attribution — recorded in §7, deliberately not
  fixed; it is an attribution question with a `DataLegend` knock-on, not freshness.

## 4 · CONSTRAINTS

- Stack: React 18 / Vite 5 / TS strict / Node 22. `api/` untouched by this change.
- `Math.random()` only inside `app/src/protocols/`. Zero fabricated values.
- CSP `connect-src 'self'`; no third-party browser requests.
- Usable at 390px; no text under 12px; reduced motion loses no information.
- New CSS sits in `@layer components`; only `@keyframes` is exempt.
- New dependencies: none.
- Commit before break-testing — `git checkout -- <file>` destroys uncommitted work
  when the reverted file also carries the fix under test.

## 5 · DONE-CRITERIA

- [x] `npm run typecheck` exits 0
- [x] `npm run lint` — N/A, no such script
- [x] `npm run test` — N/A, no such script; the verify gates are this repo's tests
- [x] `npm run build` exits 0
- [x] `npm run verify:static` exits 0 (16 gates after this PR)
- [x] `npm run verify:e2e` exits 0 (22 gates)
- [x] `node verify-tiers.mjs` and the four `api/verify-*.mjs` exit 0
- [x] `ProvFreshness` includes `error`; the badge renders a distinct error
      treatment; the header documents all five
- [x] The error copy is checked against the real `SUSPENDED_RE` and does not match
      it; the string and the check are named in the PR body
- [x] `.prov` and the new suffix span are still `display: inline`
- [x] The guard sweep ran per handoff 06 §8's five steps; site count, where each
      failed, and any site failing only at a neighbour's type are reported
- [x] The temporary phase member is reverted; `git status` clean and
      `grep -rn "MUTATION" app/src` empty **before** the final chain run
- [x] `<NodeProvenance>` does not call `feedDegraded`; multi-key resolves worst-of;
      the `FeedPhase → ProvFreshness` switch ends in `assertNever`
- [x] Zero blind `fresh="live"` on live-data surfaces; every remaining literal is
      allowlisted with a reason; the ternary exceptions are named
- [x] The gate goes red on a literal added to a live surface — proven, then reverted
- [x] The no-prop sites are triaged: how many gained freshness, how many are
      correctly silent, why
- [x] Killing one endpoint changes that panel's badge and timestamp and no other's
- [x] During an outage every visible timestamp freezes at last-good and its
      relative age keeps counting up
- [x] `.prov-fresh--stale` and the new error suffix are both in the reduce kill-list
- [x] Working tree clean; `grep -rn "MUTATION\|BREAK TEST" app/src app/*.mjs` empty
- [x] Branch pushed · PR opened ready for review (not draft) · `mergeable: true`,
      `mergeable_state: clean`, every CI check concluded green

## 6 · VERIFY COMMANDS

```
cd app
npm ci
npm run typecheck && npm run build
npm run verify:static
node verify-tiers.mjs
node ../api/verify-nodehealth.mjs && node ../api/verify-tx-parse.mjs && node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs
node scripts/serve-dist.mjs &
npm run wait-preview
npm run verify:e2e
```

## 7 · REPORT

**status:** done. Not a partial — every item in §3 IN landed.

**pr:** see `handoffs/LOG.md`

**commits:** 6 — the `error` member + its guard + the reduce fix; `NodeProvenance`;
the shared clock + `PanelFrame.updatedAt`; the 20-site rewiring; the market
timestamps + the `verify-motion` precision fix; records.

**deps added:** none.

### The guard sweep — 12 sites, measured twice

Run per handoff 06 §8's five steps, on a committed clean tree, both before and
after this PR's changes. **On merged `main` it found 9; after this PR, 12.**

| # | Site | Error | Own guard? |
|---|---|---|---|
| 1 | `useOnline.ts:94` `CHROME_LABEL` | TS2741 | own (Record) |
| 2 | `useOnline.ts:109` `chromeDetail` | TS2366 | own (return type) |
| 3 | `Footer.tsx:25` | TS2345 | **own** — see below |
| 4 | `NavTop.tsx:129` | TS2345 | own |
| 5 | `mempool-shared.tsx:84` | TS1360 | own (`satisfies`) |
| 6 | `HomePage.tsx:67` | TS2345 | own |
| 7 | `MarketsPage.tsx:73` (`freshProps`) | TS2345 | own |
| 8 | `MarketsPage.tsx:103` (`GroupBadge`) | TS2345 | own |
| 9 | `NetworkPage.tsx:211` | TS2345 | own |
| 10 | **NEW** `provenance.tsx:132` `freshSuffix` | TS2345 | own |
| 11 | **NEW** `provenance.tsx:181` `freshOfPhase` | TS2345 | own |
| 12 | **NEW** `provenance.tsx:187` `PHASE_RANK` | TS2741 | own (Record) |

**No site borrowed protection from a neighbour.** The specific worry was
`Footer.tsx:25`, which indexes `CHROME_LABEL[state]` in a grouped case — but
`state` is narrowed inside that arm, so the index stays valid and Footer fails at
its own `assertNever` (column 26, the argument). The missing-key error is
reported separately at the object literal in `useOnline.ts:94`. Verified
empirically rather than reasoned about.

**Reported separately, and it is not a guard:** `useMarketHistory.ts:293`
`groupStatus` is an if-chain ending `return "loading"`. A new `FeedPhase`
collapses into that catch-all and produces **zero** compiler output. The sweep
therefore reads **12 guarded, 1 known-unguarded** — never "12 guarded".

### Corrections to the instruction, measured against the tree

1. **"Add a sixth `FeedPhase` member."** `FeedPhase` has FOUR members
   (`feed-status.ts:88`). The sweep adds a **fifth**, which makes a sixth
   `ChromeState`. `useOnline.ts:60` already says so in a comment. Off by one;
   the procedure is unaffected.
2. **"Seven guard sites; report yours against seven."** The seven named are all
   real and at the named lines, including `MarketsPage:73`'s
   `{ fresh: "none" as ProvFreshness }` fallback (confirmed verbatim). But there
   are **two more nobody has counted** — `useOnline.ts:94` and `:109` — which
   guard by `Record` exhaustiveness and by declared return type rather than by
   `assertNever`/`satisfies`, so a grep for those two idioms misses them.
   Agreement on seven, plus two.
3. **"48 JSX call sites."** 47. `grep -rn "<Provenance"` returns 49; two are
   docblock prose (`provenance.tsx:95`, `MarketsPage.tsx:59`).
4. **"The two ternary sites are legitimate."** One is. `MarketsPage:100` is
   airtight. **`MarketsPage:263` was not** — it gated on `hasData`, which is
   `at !== null` and therefore true for phase `stale`, so it rendered a pulsing
   live dot on a market feed that was confirmed down. Fixed here.
5. **"18 no-prop sites."** 18 by token, **16 by behaviour** —
   `MarketsPage:297`/`:302` receive `fresh` through a `{...freshProps(...)}`
   spread, which a regex audit misses.

### The no-prop triage

**4 gained freshness** — `classic.tsx:143` (confirmations, `tip − height`, so
`blocks`), `tx-detail.tsx:229` and `:499` (per-tx / per-block node data, via the
`phase` arm), and `MarketsPage:291`'s neighbours. **2 were already marked** via
the spread. **12 are correctly silent:** the `DataLegend` specimen, three
`/simulate` MODEL markers, the `/sources` legend row, `/network`'s deliberately
paused peer-telemetry frame, and six `protocols/*` artboards that take `data` in
their uniform signature but never read it. Silence there is not an omission —
those surfaces make no freshness claim to keep.

### Things the work found that the instruction did not predict

- **`Provenance` had a second live-dot backdoor.** The `pulse` prop forced the
  dot on independent of `fresh`, with **zero call sites**. Banning `fresh="live"`
  while it survived would have moved the escape hatch, not closed it. Deleted,
  and gate-asserted gone.
- **`ProvFreshness` had no exhaustiveness guard anywhere.** The suffixes were two
  independent ternaries. The pre-PR sweep proves it: widening `ProvFreshness` on
  merged `main` produced errors at nine sites tree-wide and **zero** in
  `provenance.tsx` itself. This is the hazard §8 warned about, demonstrated.
- **`SourceBadge` was eating the failure signal.** `detail={prefix ?? f.detail}`
  meant that at the three call sites passing a `prefix`, the `"unavailable"`
  detail was silently discarded and an errored series rendered
  `COINGECKO · 0 bars · 4h` with no failure indication at all. Moving error from
  a `detail` to a suffix fixes it as a side effect: no caller's `??` can drop it.
- **`useMarketHistory`'s `lastGood` map discarded timestamps.** `readCache`
  parsed `parsed.at` for its max-age check and threw it away, and the in-memory
  map stored bare data. Both now carry the arrival instant, which is what makes
  a cache-served panel able to say *when* rather than guessing.
- **The three `tx-detail` sites were two.** `:258` looked unkeyable but its
  confirmation count is `chainTip(data) = data.blocks[0]?.height ?? data.height`,
  so it is plain `keys={["blocks"]}`. Only `:229`/`:499` are genuinely outside
  the `FeedKey` union.

### Deviations

- **`verify-motion.mjs` assertion 2 was changed, and it is a strengthening.** It
  tested "did this transition snapshot a Suspense fallback" with a bare
  `/loading/i` over body innerText — a proxy that matches the word anywhere on
  the page. Once badges derive freshness honestly, a badge whose endpoint has not
  answered renders `" · loading"`, which is not a fallback; it tripped the proxy
  on every `/mempool` badge at once. It now uses `SUSPENDED_RE`, extracted from
  `entry-ssr.tsx` rather than re-typed, which requires a trailing `.`/`…` and so
  separates `"loading…"` from `" · loading"`. The extraction self-checks against
  a known match and non-match and **throws** if it ever stops behaving, so a
  botched lift cannot make the assertion pass vacuously. Break-tested by widening
  `SUSPENDED_RE` back to `/loading/i`: the gate refuses to run.
- **Per-panel timestamps cover 29 of 32 live panels.** The 3 without are the
  terminal `$ help` keyboard legend, reactor's `Ring · 16` illustrative diagram,
  and `/markets`'s atomic-swap directory (`SWAP_DIRECTORY`, a hand-authored
  constant). None render feed data; all three are named rather than skipped.

### Not verifiable in this sandbox — reported as blocked, not as passed

Egress to Monero nodes, CoinGecko and the live domain is blocked. Outage
behaviour is proven against **mocked** routes in `verify-failure.mjs`, not
against a real node failure. The freeze/count-up assertions run against a mocked
500 on one endpoint while its siblings answer.

### One defect recorded and deliberately NOT fixed

**`MarketsPage.tsx:291` mis-attributes circulating supply.** The badge reads
`COINGECKO ∣ SESSION`, but `MarketsPage.tsx:240` is
`circ = hasData(status.network) ? SUPPLY_AT_TAIL + max(0, height − TAIL_START_HEIGHT) × TAIL_REWARD : 0`
— node height and protocol constants. CoinGecko contributes nothing.

Left alone because it is an **attribution** question, not a freshness one, and it
is not the one-line fix it looks like:

1. **There are two defensible readings.** The badge sits in `sub`, immediately
   after "M circ · tail emission", which is pure node. But the tile's headline
   value is `price × circ`, which genuinely is CoinGecko × node. Whether a bare
   badge in `sub` describes the sub-line or the whole tile is an open question
   about KPI-tile semantics, and answering it is editorial.
2. **It has a knock-on.** `MarketsPage.tsx:264` declares
   `<DataLegend sources={["coingecko"]} />` — the page's own statement of what it
   carries. Putting a NODE badge on the page makes that legend incomplete; it
   would need `["coingecko","node"]`, which changes the page's declared
   vocabulary.

Whoever takes this should be choosing between those readings, not guessing.

**open questions:** none blocking. The ten deferred workstreams from handoff 06
§3 are unchanged apart from item 5's first three sub-items, which landed here.

## 8 · LOOP FEEDBACK
