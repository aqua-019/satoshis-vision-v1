---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260816-39
branch: claude/prompt-attached-lmhrgq
status: done              # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — task arrived as prompt p3·17)
owner: claude-code
---

# HANDOFF — p3·17 SOURCES RELEASE NOTES: two stale versions, and a feed that died in July

## 1 · GOAL

The site stops advertising two different, both-wrong version identities one page apart,
and the release-notes surface stops implying an automatic feed is producing entries when
it has produced none since July. When this is done: the topbar label and the Sources
release list derive from ONE decided notion of release identity, that identity has an
authoritative in-repo source, and a static gate fails the build when the label goes stale
— which is the thing that did not exist for the twenty-two releases it rotted through.
Additionally the five curated release notes stop shipping in the eager entry chunk on
every route.

## 2 · CONTEXT

- Prompt: `p3·17 — SOURCES RELEASE NOTES` (C6 rewrite), rebased on `bda0491`.
- Base: `bda0491` (PR #185 merged — `/operate/superstress` is the 14th route).
- Relevant files: `app/src/data/releases.ts` (94) · `app/src/pages/SourcesPage.tsx` (332,
  release SECTION only) · `app/src/layout/NavTop.tsx:338` · `app/verify-releases.mjs` (81)
  · `api/feeds.js` (CommonJS) · `app/verify-bundle.mjs` (budgets).
- CLAUDE.md: the lazy-leaf rule (canvasColor → repoPulse → data.ts), the honest-empty
  vocabulary, "a live number is real or it is an em-dash".

### §0 premise base — ALL CONFIRMED by measurement at `bda0491`, plus two corrections

| § | Claim | Verdict |
|---|---|---|
| 0.1 | topbar `v6.0.5` (`releases.ts:23` → `NavTop.tsx:338`); curated list tops at `v5.0.20` | CONFIRMED |
| 0.2 | zero parseable version commits in last 60; `git tag` empty | CONFIRMED (0 tags) |
| 0.3 | LOG entries since p2 are task-ID keyed, no version stamps | CONFIRMED |
| 0.5 | CURATED prose is EAGER on every route | CONFIRMED — all 5 strings AND `v6.0.5` grep to exactly 1 in the served entry `assets/index-DuBnguao.js` |
| 0.8 | `/about/sources` 94,571 / 95,000 — margin **429**, tightest row | CONFIRMED exactly |
| 0.8 | eager 263,385/280,000 · lazy 882,849/886,000 · total 1,146,234/1,150,000 · cssGz 17,900/18,200 · CHUNK_COUNT 69 in [62,70] | CONFIRMED exactly |

**CORRECTION 1 — §0.3 option (a) as written is not buildable.** The prompt says every
merge since #164 is `Merge pull request #NNN` "with a descriptive branch/PR title".
Measured with `git log -1 --format=%B` over the last four merges: **the merge commit
message is ONE line with no body at all**, and the branch half is a random slug
(`claude/prompt-attached-8fdjhd`). A merge-commit parser therefore yields
`#185 — claude/prompt-attached-8fdjhd` — noise rendered as a release note, not the
"PR #185 — the Superstress hub" the prompt predicted. The PR TITLE is not in the git
object at all.

**CORRECTION 2 — the titles exist, one API call away.** `GET /repos/{repo}/pulls?state=closed`
returns number + title + `merged_at` + `html_url` in a single request, and the titles are
exactly the prose a release note wants ("p3·16 — the Superstress hub: /operate/superstress,
the 14th route"). Note `merged` is unreliable on the LIST endpoint (reads `false` on
demonstrably merged PRs); `merged_at != null` is the reliable merged test.

**CORRECTION 3 — CI checks out at depth 1.** `.github/workflows/ci.yml:65,237` use
`actions/checkout@v4` with no `fetch-depth`, so any authority derived from git HISTORY is
unreadable in CI. The authority must be a committed FILE.

## 3 · SCOPE

**IN**: the release-identity decision and both surfaces deriving from it; a staleness gate;
the honest-empty state for the release section; the era seam; the eager-prose split;
budgets re-measured and raised loudly if crossed; `verify-releases.mjs` extended (never
forked); `api/feeds.js` only as the chosen source requires.

**OUT (non-goals)**: SourcesPage's `/api/status` configuration panel and its "observed by
your browser" half (prompt 05's — the file is shared, the diff stays in the release
section). `MarketsPage:291`'s recorded mis-attribution. The GitHub **releases** API (repo
has zero tags). The vitals-last `verify:e2e` inversion (open item — reordering an `&&`
chain changes what masks what for every member). `verify-markets-dom:790`'s crash unless
touched. No new gate FILE unless a browser assertion is genuinely needed.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict. `api/feeds.js` is **CommonJS**.
- CSP `connect-src 'self'` — third parties go through `/api/`, never the browser.
- Zero fabricated values on live surfaces; degradation is last-good + honest label,
  never synthesis.
- Provenance vocabulary stays FIVE members.
- `cssGz` margin is **300 B** — reuse existing classes.
- `/about/sources` margin is **429 B** — any release-section addition crosses it.
- Do not touch: `vite.config.ts`, `vercel.json`, the `/api/status` panel.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [x] `npm run build` exits 0
- [x] `node verify-releases.mjs` exits 0 — **38 assertions** (was 15), counted from its own output
- [x] `npm run verify:static` exits 0 (22 members)
- [x] Identity DECIDED and argued in `src/data/siteVersion.ts`'s header, options (a)–(d) with the measurement that killed (a)
- [x] Both surfaces derive from it: label from `SITE_ERA`/`SITE_PR`, list from `/api/feeds?src=pulls`
- [x] Staleness gate vs `handoffs/LOG.md`; break tests M1 (stale → red) and M2 (99999 → red), restores verified against the committed blob
- [x] `verify-releases-dom` §2 (6 assertions); break test M7 restores the pre-fix header and reds it
- [x] `verify-releases-dom` §4, including the ABSENCE half; break test M8
- [x] All 15 pre-existing `verify-releases` assertions still green, unmodified except the SITE_VERSION shape check
- [x] All five strings 1 → **0** in the served entry; `eagerJsRaw` −1,025 B
- [x] `/about/sources` 95,000 → 98,000, red-then-green, residual ZERO both halves, comment written after the last src commit
- [x] 83/79/22/33/68, script CONTROLLED against bda0491 first; both places corrected
- [x] 6 states captured and viewed; two defects found by looking (seam colour, and the desktop scroll container)
- [x] Branch pushed · draft PR #186 opened via GitHub MCP · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app && npm run build
cd app && node verify-releases.mjs
cd app && npm run verify:static
cd app && node verify-bundle.mjs
```

## 7 · REPORT — filled on exit

**status**: done

**pr**: https://github.com/aqua-019/satoshis-vision-v1/pull/186 (draft)

**commits**: handoff · identity+gate · DOM gate · wiring/budgets/docs

**deps added**: none. `package-lock.json` untouched.

**the decision, and what measurement overturned**

Release identity is **PR-keyed** (option (a) in spirit), but NOT by the mechanism the
brief proposed, and the correction is the durable finding:

- §0.3(a) said merges carry "a descriptive branch/PR title". Measured with
  `git log -1 --format=%B` over the last four merges: the single line
  `Merge pull request #NNN from aqua-019/<branch>` **is the entire message — no body** —
  and the branch is a random slug. A merge parser yields
  `#185 — claude/prompt-attached-8fdjhd`.
- The titles exist on the **pulls** endpoint: number + title + `merged_at` + `html_url`
  in ONE request, cheaper than the commits path's up-to-three pages.
- `merged` is unreliable on that LIST endpoint (reads `false` on #178–#185, all merged);
  `merged_at != null` is the reliable test, pinned by fixture and by break test M6.
- (b) resume `vX.Y.Z` stamps: rejected — nothing structural produces them, which is why
  they stopped. (c) declare dormant: adopted as the FLOOR (the honest-empty state), not
  as the answer, because this surface can work.

**the defect, stated more precisely than the brief did**

Not merely "the page implies a feed is producing entries". The header ternary had THREE
branches for a FOUR-state feed, and an empty array is truthy, so the live state rendered
**`github commits · 0 releases` directly above five curated rows** — a self-contradiction
in one screenful, with every offline assertion green. Proven executably, then reproduced
in a browser by break test M7.

**the gate's shape (the §0.4 requirement, and why the obvious form fails)**

An equality gate between two hand-maintained constants detects DISAGREEMENT, not
STALENESS. Pinning `SITE_VERSION` to `package.json` would have been green for all
twenty-two releases this rotted through. The authority must MOVE ON ITS OWN →
`handoffs/LOG.md`; and must be a committed FILE, not git history → `ci.yml` checks out at
depth 1. Invariant `logMax <= SITE_PR <= logMax + 1`: may lead by one, never lag.

**deviations from spec**

1. `api/feeds.js` gained a `src=pulls` source. Sanctioned by the subject line
   ("only if your chosen source needs it"); `src=commits` is KEPT, dormant by design and
   still unit-gated.
2. A new gate FILE was added (`verify-releases-dom.mjs`), which §0.9 permits when a
   browser assertion is genuinely needed. It is: the defect is a rendered relationship
   between a header and a list, which has no offline form. Wired **mid-chain at
   `verify:e2e` position 16**, never the tail.
3. §0.5's leaf: `SITE_VERSION` moved to `data/siteVersion.ts`, but `releases.ts`
   deliberately re-exports NOTHING from it — an extensionless re-export builds under Vite
   and breaks the gate under Node's loader. No consumer needed it.

**notes for ARCHITECTURE.md patch**: a "Release identity" row was added to CLAUDE.md's
Architecture Notes table; census corrected in BOTH places it is stated.

**open questions**: none blocking. Named and deliberately not fixed: the vitals-last
`verify:e2e` inversion (#184 F4), and the ten hollow `/future#<id>` palette anchors.

## 8 · LOOP FEEDBACK
