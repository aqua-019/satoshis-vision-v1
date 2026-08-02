---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260801-05
branch: claude/loading-failure-freshness-language-onbw1i
status: done            # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — v6.1.4 Loading, failure and freshness language (PR A · state model)

## 1 · GOAL

`MoneroLive` stops describing its own health with four scattered booleans
(`live` / `ready` / `marketReady` / `stale`) and describes it with one
discriminated union, per endpoint. Sixteen representable states — most of them
nonsense, and two of them states the feed genuinely reaches but *cannot* express
— collapse to four that are total by construction. `useRepoPulse` stops throwing
away the state machine its own helper produces, so a dead `/api/feeds` proxy
reads as a named failure instead of an eternal spinner. When this is done the
tree has one status vocabulary, `tsc` enforces it, and the per-panel failure
work in PR B has a type to hang off.

## 2 · CONTEXT

- Source: the v6.1.4 prompt (block D2000 C, D0851–0900), prompt 05 of 19.
- No pre-existing `HANDOFF-*.md` was open; authored in manual mode per CLAUDE.md.
- Relevant files: `app/src/data/{types,xmrirish-feed,map,usePolling,useMarketHistory,useCachedFeed,useFeedEvents,DataContext}.ts(x)`,
  the 13 consumer files carrying the 92 boolean reads, `app/src/pages/future/{cards,ProtoPopup}.tsx`.
- Prior art this builds on: v6.0.6 tiered polling (3s/15s/60s), v5.0.14 all-real-data.

### Premise corrections found while verifying the prompt

The prompt's own inventory did not survive contact with the tree. Reported
because the prompt requires it, and because three of these would have sent the
work to the wrong files:

| Prompt claim | Truth |
|---|---|
| `app/src/data/useMoneroLive.ts` | Does not exist. `useMoneroLive()` is a context reader (`DataContext.tsx:44`); the feed is `xmrirish-feed.ts:153`. |
| "eleven mempool views" | Six (`views/index.tsx:68-81`). Eleven is the static *route* count. |
| "six pulse surfaces" | 3 call sites, 9 instances at rest + 1 conditional, 9 repos. |
| `cards.tsx:142`/`:152` | `:162`/`:172`; `:172` is in `FeedEmpty`, which no pulse surface uses. |
| "~51 gates, ~a dozen orphaned" | 52 files (48 app + 4 api) = 51 gates + `verify-lib.mjs`; 13 orphans; CI runs 35. |
| Provenance `NODE/NETWORK/COINGECKO/SESSION/MODEL` | Four sources, no `NETWORK` (`provenance.tsx:24`). CLAUDE.md repeats the error; corrected in this PR. |
| "4 stylesheets" | Five — `styles-motion.css` landed in v6.1.3. |
| `monero.fail` as a dependency | Not referenced anywhere in `api/` or `app/`. |

### Two findings for the record

- **`.claude/hooks/stop-gate.sh` has never existed.** `LOOPS-CHEATSHEET.md:11`
  describes it as live infrastructure and `.claude/settings.json` has no `hooks`
  key. This explains something already observed and not understood: prompt 03
  shipped with every §5 DONE-CRITERIA box unticked and nothing stopped it. The
  loopflow's deterministic backstop has never run.
- **`verify-memshell.mjs:118-123`** carries a dead `{ owned: false }` assertion
  claiming "all eleven registered" for views that number six. That is the sixth
  instance in this batch of a gate reporting on something it did not check,
  after `verify-v510` (permanently red), `verify-future` (orphaned),
  `verify-shots` (counted screenshots it never compared), prompt 04's PR (opened
  with half its Verify list unmet), and prompt 04's break-test mutation (left in
  the working tree).

## 3 · SCOPE

IN: Task 1 (discriminated union, derived-not-stored, effect audit), Task 1b
(`useRepoPulse`), the 92-site migration, their gates, and the doc corrections
this change forces.

OUT (non-goals — PR B, listed by name in the PR body): Task 2 skeletons /
stale-while-revalidate / crossfade (D0851, D0858, D0612); Task 3 last-updated
timestamps and per-panel glyphs (D0859, D1698, D1700); Task 4 partial-failure
rendering, panel error boundaries, actionable errors, degraded banner, jittered
backoff, offline badge, empty states (D0869, D0864, D1615, D0867, D0888, D0868,
D0870, D0861, D0862); Task 5 the `/sources` status page (D0891).

**PR A is behaviour-preserving by design.** No rendered string changes except
the `useRepoPulse` failure copy. That is what makes the 92-site migration
reviewable and lets `verify-allreal-dom.mjs` serve as a regression check rather
than a moving target.

## 4 · CONSTRAINTS

- Stack: React 18 / Vite 5 / TS strict / Node 22. `api/` is CommonJS.
- `Math.random()` only inside `app/src/protocols/`. Zero fabricated values.
- CSP `connect-src 'self'` — no third-party browser requests, ever.
- Provenance vocabulary is the four in `provenance.tsx`, used verbatim.
- Every route keeps its `noscript` block and literal background floor.
- Usable at 390px, no text under 12px, reduced-motion path loses no information.
- New dependencies: none.
- Do not touch: `handoffs/` (except this file + LOG.md), `MASTER-HANDOFF.md`,
  `XMR-QUICKSTART.md`, the six mempool view files beyond the mechanical migration.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run typecheck` exits 0
- [x] `npm run lint` — **N/A, no such script** in `app/package.json`
- [x] `npm run test` — **N/A, no such script**; the verify gates are this repo's tests
- [x] `npm run build` exits 0
- [x] `npm run verify:static` exits 0, including new `verify-feedstatus.mjs` and `verify-effects.mjs`
- [x] `npm run verify:e2e` exits 0
- [x] `node verify-tiers.mjs` and the four `api/verify-*.mjs` exit 0
- [x] `MoneroLive` declares no `live`/`ready`/`marketReady`/`stale` field
- [x] `useRepoPulse` returns `{ pulse, at, state }`; all four `/api/feeds` consumers agree in shape
- [x] A forced 500 on `/api/feeds?src=ghrepo` renders a failure naming the endpoint on all nine pulse surfaces — zero `fetching`
- [x] Effect census reported in §7 with a justification per survivor
- [x] Working tree clean; `grep -rn "MUTATION\|BREAK TEST" app/src app/*.mjs` empty; chain re-run after any break test
- [x] Branch pushed · PR opened, titled `PARTIAL:`, body lists every unmet Verify item by name

## 6 · VERIFY COMMANDS

```
cd app
npm run typecheck
npm run build
npm run verify:static
node verify-tiers.mjs
node ../api/verify-nodehealth.mjs && node ../api/verify-tx-parse.mjs && node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs
node scripts/serve-dist.mjs &
npm run wait-preview
npm run verify:e2e
```

## 7 · REPORT — filled on exit

**status:** done — PR A of two. Opened as `PARTIAL:` with every unmet Verify
item named in the body, per the operator's explicit request for the split.

**pr:** see `handoffs/LOG.md`

**commits:** 3 — the state model + 92-site migration; the gates; the docs.

**deps added:** none.

**effect census (D1625, the required deliverable).** **Seven** effects survive
across **six** files in `src/data/` — `useMarketHistory` carries two. (An earlier
draft of this report said "six effects", conflating the file count with the
effect count; the committed `verify-effects.mjs` ledger has always had all seven
and is what the gate checks.) All are true external sync, each with a written
justification:

| file | n | why it is external sync |
|---|---|---|
| `xmrirish-feed.ts` | 1 | the optional relay WebSocket — a subscription with teardown |
| `usePolling.ts` | 1 | tier timer + visibilitychange listener |
| `useCachedFeed.ts` | 1 | the 24h `/api/feeds` fetch |
| `useMarketHistory.ts` | 2 | range fetch + 45s retry timer |
| `useTickers.ts` | 1 | its own 5min/45s loop (predates usePolling, left alone) |
| `useFeedEvents.ts` | 1 | snapshot differ; its deps now read a DERIVED local |

Refs in the feed dropped 4 → 2: both failure counters became state, so the phase
could be derived during render instead of computed at commit time and stored.
Found in passing and NOT fixed here: `MempoolPage.tsx:73`
`useEffect(() => setZoom("fit"), [active])` is a pure derivation in an effect.

**deviations from spec:**

1. The brief spells the healthy phase `success`. The union says `live`, because
   `live` is already the repo's word in `ProvFreshness`, `SeriesStatus` and
   `FeedState`. `success` would have created a fourth vocabulary inside the one
   change whose purpose is to leave exactly one.
2. "Every consumer switches on the union exhaustively" is delivered as: pure
   predicates at the ~85 sites that only ask "do I have a number", and a
   compile-time exhaustiveness guard at the **six** sites that RENDER a phase —
   `assertNever` defaults at NavTop, Footer, NetworkPage, HomePage and both
   MarketsPage badges, plus `phase satisfies "live"` at `mempool-shared.tsx:70`,
   which is the same protection in one line with no unreachable branch to render.
   A switch at all 92 would be ceremony, not safety.
   Verified by construction rather than by reading: adding a fifth `FeedPhase`
   breaks compilation in all six files, and does so AT THE GUARD even when
   `ProvFreshness` is widened alongside it.
3. `assertNever` logs and returns a fallback rather than throwing. There is no
   panel-level boundary yet, so a throw from a data surface would unwind to
   `main.tsx` and blank the app — the opposite of the goal. It is unreachable
   while the union stays closed.
4. PR A is behaviour-preserving on purpose, so the two newly-wired orphan gates
   are a real regression check rather than a moving target. Two consequences are
   deliberate and named in the PR body: `feedDegraded` keeps the pair-AND rule
   (a single dead endpoint still does not raise STALE), and the `error` phase
   currently renders the same copy as `loading`.

**notes for ARCHITECTURE.md patch:** none — this repo has no ARCHITECTURE.md.
CLAUDE.md's Development Conventions row now carries the union; its gate counts
and provenance vocabulary were corrected.

**open questions:** none blocking PR B. The 15 `.stale` sites and the
`lastUpdate` heartbeat are enumerated in the PR body as PR B's first task.

## 8 · LOOP FEEDBACK

**Two findings about this loop's own machinery, not about the code:**

- `.claude/hooks/stop-gate.sh` **does not exist** anywhere on the filesystem,
  and `.claude/settings.json` has no `hooks` key — yet `LOOPS-CHEATSHEET.md:11`
  describes it as live infrastructure and CLAUDE.md's loopflow leans on it as
  the deterministic backstop. That explains something already observed and not
  understood: prompt 03 shipped with every §5 DONE-CRITERIA box unticked and
  nothing stopped it. The backstop has never run. Reported, not built.
- `verify-memshell.mjs:118-123` carries a dead `{ owned: false }` assertion
  claiming "all eleven registered" for mempool views that number six — the
  sixth instance in this batch of a gate reporting on something it did not
  check, after verify-v510, verify-future's orphaning, verify-shots' uncompared
  screenshots, prompt 04's half-unmet PR, and prompt 04's left-in mutation.

**One process note worth keeping.** `git checkout -- <file>` is the documented
way to undo a break-test mutation, and it destroyed uncommitted work when the
file being reverted also carried the fix under test. Commit first, then
break-test; the sequence in CLAUDE.md assumes a committed baseline and does not
say so.

## 8 · LOOP FEEDBACK
