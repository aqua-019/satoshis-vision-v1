---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260816-39
branch: claude/prompt-attached-lmhrgq
status: in_progress        # open -> in_progress -> done | blocked
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

- [ ] `npm run build` exits 0
- [ ] `node verify-releases.mjs` exits 0, and its assertion count is REPORTED (not incremented from docs)
- [ ] `npm run verify:static` exits 0
- [ ] The release identity is DECIDED, with the reasoning written IN THE CODE (not only in the PR body)
- [ ] `SITE_VERSION` and the release list both derive from that one decided identity
- [ ] A static assertion compares `SITE_VERSION` against an authoritative source that MOVES ON ITS OWN, so it detects STALENESS and not merely disagreement; proven with a two-polarity transcript (deliberate mismatch red, then committed-blob restore)
- [ ] The zero-auto-entries state renders in the house honest-empty vocabulary — the page never implies an automatic feed is producing entries when it has produced none
- [ ] The era seam between PR-keyed and version-keyed entries renders as a labelled discontinuity, never an unexplained jump
- [ ] Curated prose survives byte-for-byte (existing gate assertions stay green)
- [ ] The CURATED prose is no longer in the served eager entry chunk — proven by a grep returning 0 where it returned 1
- [ ] Every budget re-measured on the FINAL tree; any raise is red-then-green with the delta attributed and the comment re-derived AFTER the last src commit
- [ ] Census RECOUNTED (never incremented), both places CLAUDE.md states it
- [ ] Renders captured and LOOKED AT: topbar label ×2 routes, release section fed + empty, the seam, 390px, reduced motion
- [ ] Branch pushed · draft PR opened via GitHub MCP · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app && npm run build
cd app && node verify-releases.mjs
cd app && npm run verify:static
cd app && node verify-bundle.mjs
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
