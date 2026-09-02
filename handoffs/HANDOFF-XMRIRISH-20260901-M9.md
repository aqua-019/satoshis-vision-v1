---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260901-M9
branch: claude/new-session-b31mfj
status: in_progress
written_by: claude-code (manual mode)
owner: claude-code
---

# HANDOFF — p4·M9 "MOBILE 2.0, IN TWO HALVES" (M9a · the pool has no ages / M9b · mobile 2.0)

## 0 · BASE AND BUDGETS

- Base: `1c5425e` — the merge of PR #205 (p4·M6c). `SITE_PR` is **205**; `handoffs/LOG.md`
  logMax is 205. The brief allowed M9a to start on `9f9e176` if #205 was still open; it had
  merged, so both halves build on the merge.
- **ONE BRANCH, TWO HALVES.** The brief asks for two PRs. This session is pinned to one branch
  by its harness (`claude/new-session-b31mfj`; pushing to a second branch is forbidden without
  the operator's say-so). The sequencing the brief cares about — fix the number before laying
  out the column that holds it — is preserved as commit order: M9a commits first, M9b after.
  A reviewer who wants two PRs can branch from the last M9a commit; the boundary is named in
  §7 REPORT.
- Post-#205 margins, to be RE-MEASURED on a build of the base before any ceiling moves:
  `cssGz` 18,586 / 19,000 (**414 B**) · `lazyJsRaw` 993,843 / 997,000 · `totalJsRaw`
  1,258,300 / 1,262,000 · chunks 76 · `/live/mempool` — READ THE ROW.
- **`cssGz` cannot hold M9b.** Plan: the section sheet (~12–18 rules), the classic phone layout
  (~15–25 rules) and the ladder's snap (~4 rules) ≈ 35–45 rules ≈ 0.5–0.8 KB gzip. The raise is
  taken red-then-green on the FINAL tree at built × 1.025 (the file's own ~2.5% convention for
  this budget, p4·02), expected to land near 19,600–19,800. M9a adds NO stylesheet rule.

## 1 · GOAL

**M9a.** `/api/xmr/mempool` answers `receive_time: 0` on every pool transaction (production,
2026-09-01, per the brief). `map.ts:220` treats 0 as an epoch and renders the current Unix time
as a duration: `1788295405s` under "age", `496748h 43m` in every table row. When this is done a
transaction whose arrival time no clock reported carries `age: null` and renders an em-dash on
every one of the ten views, the tx-detail page and the stat strip; the function records when it
first LISTED each txid and emits it as `first_seen_here`, so a warm function gives the client an
honest, smaller number labelled **seen**; `ring_size` is the ring length and not the input
count; the three fee-tier vocabularies become one; and a gate reads rendered durations and reds
on any that exceeds the age of the chain.

**M9b.** Eleven of the sixteen routes in `IA` are unreachable from the phone tab bar; the classic
mempool is desktop markup under a reflow sheet; "fluid and sharp" is not a property a gate can
hold. When this is done a tab whose section holds more than one item opens an IA-driven bottom
sheet; every IA route is reachable in at most two taps at 390 and 320, gated; classic's four
sub-components lay out for the phone by design rather than by `:not()`; and `verify-mobile`
holds the three properties the screenshots show it not holding (no mid-glyph clipping, one
horizontal gutter, ≥44px on every interactive element).

## 2 · CONTEXT

- Brief: the operator's p4·M9 document (uploaded), §0′–§9.
- Production JSON: NOT reproducible from this sandbox — `xmr.irish` and `www.xmr.irish` both
  answer `000` (the egress proxy rejects CONNECT, `connect_rejected`), the same result p4·M2
  and p4·M5 recorded. The `receive_time: 0` rows are quoted from the brief, dated 2026-09-01,
  and attributed to it.
- monerod source, read at `raw.githubusercontent.com` on 2026-09-01, branches `release-v0.18`
  and `master` — **the brief's "restricted RPC withholds it" hypothesis does not survive**:
  - `core_rpc_server.h` maps `/get_transaction_pool` with `MAP_URI_AUTO_JON2_IF(…, !m_restricted)`
    on BOTH branches (v0.18 `:126`, master `:117`): a restricted instance does not serve the
    endpoint at all.
  - v0.18 `tx_pool.cpp:1220` is the only pool-listing line that writes a 0
    (`txi.receive_time = include_sensitive_data ? meta.receive_time : 0`, comment "In restricted
    mode we do not include this data"), and v0.18 `on_get_transaction_pool` passes
    `allow_sensitive = !request_has_rpc_origin || !restricted`, which is `false` only when
    `m_restricted && ctx` — a state in which the URI is unmapped. Master passes sensitive data
    unconditionally (`get_pool_transactions_count(true)`, `txi.receive_time = meta.receive_time`).
  - The strip that DOES fire on a restricted node is `tx_pool.cpp:627/636`
    (`get_transaction_info`), which feeds `/get_transactions`' `received_timestamp` — the
    tx-detail path (`api/xmr.js:396`), where `detail-map.ts:189` has the same `0 → now` defect.
  - Conclusion recorded, not guessed: stock monerod at either branch head cannot answer
    `/get_transaction_pool` with `receive_time: 0`. The node that does is either not stock, not
    at these heads, or carrying 0 in its own pool metadata; which, this sandbox cannot see. The
    client fix is cause-agnostic: `receive_time <= 0` is UNKNOWN.
- `api/xmr.js:201` derives `ring_size` from `vin.length` — the INPUT COUNT — for every row by
  construction, while `:372` (the detail path) reads `vin[0].key.key_offsets.length` correctly.
  A full pool therefore shows `ring_size === input_count` on 100% of rows whenever `tx_json`
  parses; the brief's 3/3 sample is the whole population.
- Fee vocabularies: server `feeTier()` thresholds 1/5/20/80 pcn/B are three orders below
  mainnet's floor (~20,000), so every tx is `priority`; client `FEE_TIER_LABELS` derive from the
  node's `get_fee_estimate` tiers (NODE); classic's cards use pool QUARTILES (relative), which
  degenerate on a small or flat pool. Canonical: the node's tiers.
- Relevant files: `app/src/data/{types,map}.ts`, `app/src/mempool/*` (all ten views), 
  `app/src/mempool/{mem-stats,mempool-shared,detail-map}.ts(x)`, `api/xmr.js`,
  `api/_tests/verify-tx-parse.mjs`, `app/verify-memstats.mjs`, `app/verify-mobile.mjs`,
  `app/src/layout/BottomTabBar.tsx`, `app/src/nav/ia.ts`, `app/src/styles*.css`.

## 3 · SCOPE

IN (M9a): `Tx.age: number | null` + `ageSource` + `firstSeenAt`; every reader of `.age`;
`oldestAgeSec: number | null`; `first_seen_here` in `api/xmr.js` warm memory; `ring_size` from
`key_offsets`; one fee-tier vocabulary (node tiers) on the server tag, the histogram and
classic's cards; `verify-memstats` §6 (zeroed feed → dash; chain-age ceiling on every rendered
duration; `seen` label under a site-derived age); `detail-map.ts` `receive_time <= 0` guard.
IN (M9b): section sheet in `BottomTabBar`; `verify-mobile` reachability (§3 extension) + §7.1 /
§7.3 / §7.4 gates; classic phone layout for stat strip, ladder, fee cards, table; `cssGz` raise
with arithmetic; break tests per §8.
OUT: Orbital/Abyss/Pulse/Circuit keep the reflow sheet exactly as it is; the desktop topbar; the
six orphan gates; `LICENSE`; `api/feeds.js`; any new dependency.

## 4 · CONSTRAINTS

- React 18 · Vite 5 · TS strict · Node 22. No new dependency.
- Zero fabricated values on live surfaces: a number is real or it is an em-dash.
- `Math.random()` only under `app/src/protocols/`.
- `api/xmr.js` is CommonJS — match the file.
- No width branch in RENDER (prerender emits one composition into 18 files); width in effects/CSS.
- Every new assertion ships with a two-polarity transcript.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

M9a
- [ ] `npm run typecheck` exits 0 in `app/`
- [ ] `npm run build` exits 0 in `app/`
- [ ] With every `receive_time: 0`, every one of the ten views renders `data-memstat="oldest"` with an EMPTY value and the strip shows an em-dash — `node verify-memstats.mjs` §6 green
- [ ] No rendered duration on `/live/mempool` (any view) exceeds the chain's age — `verify-memstats` §6 chain-age sweep green, with a positive control proving the parser sees real durations
- [ ] With `first_seen_here` supplied and `receive_time: 0`, the OLDEST tile reads the site-derived age and its label reads `seen` — §6 green
- [ ] Break test: `map.ts` reverted to `num(t.receive_time, nowSec())` → §6 reds; transcript quoted in §7
- [ ] `api/_tests/verify-tx-parse.mjs` asserts the pool row's `ring_size` is `key_offsets.length` and its `fee_tier` is the node's tier — exits 0; the pre-fix row builder fails it (transcript)
- [ ] `verify:static` chain exits 0; the mempool e2e cluster (memviews · memdetail · glide · memphone · memstats · tracking) exits 0 against a served build
- [ ] `SITE_PR` = logMax + 1 at commit time; `LOG.md` line in the same commit

M9b
- [ ] `verify-mobile` reachability: every IA route reachable from the tab bar in ≤ 2 taps at 390 and 320 — 17 lines printed, none "unreachable"
- [ ] Sheet: rows ≥ 44px; Esc / backdrop / route-change dismissal; focus trap and return; reduced motion — each asserted, each break-tested
- [ ] `verify-reduce` drives the sheet as a DERIVED surface, not a hand-copied 28th
- [ ] Classic at 390 and 320: ladder's first card fully visible; fee-card footers one line; table fits its column (`scrollW − clientW ≤ 2`)
- [ ] `verify-mobile` new sections (no mid-glyph clip · one gutter · ≥44px everywhere) green with planted positive controls
- [ ] Break tests: tab bar reverted to `cols[0].items[0].p` → reachability reds naming eleven; `scroll-padding-inline` removed → clip gate reds; one sheet row at 40px → 44px assertion reds
- [ ] `verify-bundle` green on the final tree with the `cssGz` raise and byte-exact attribution
- [ ] Full `verify:e2e` chain exit 0 against a served build of the final tree

## 6 · VERIFY COMMANDS

```
cd app && npm run typecheck
cd app && npm run build
node api/_tests/verify-tx-parse.mjs
cd app && npm run verify:static
cd app && node scripts/serve-dist.mjs 4173 &  ;  npm run wait-preview
cd app && node verify-memstats.mjs && node verify-memviews.mjs && node verify-memdetail.mjs && node verify-glide.mjs && node verify-memphone.mjs && node verify-tracking.mjs
cd app && npm run verify:mobile && npm run verify:bundle
cd app && set -o pipefail; npm run verify:e2e 2>&1 | tee /tmp/e2e.log
```

## 7 · REPORT — filled on exit
status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
