/**
 * data/siteVersion.ts — the build's own version identity, and nothing else.
 *
 * ── WHY THIS IS ITS OWN LEAF (p3·17) ────────────────────────────────────
 * `SITE_VERSION` lived in `data/releases.ts` beside `CURATED`, and `NavTop`
 * imports it — so the entry chunk carried all five curated release notes on
 * every route. Measured at `bda0491`: each of the five prose strings grepped
 * to exactly 1 in the served entry (`dist/assets/index-*.js`), ~600 B of
 * editorial copy that only `/about/sources` ever renders, paid for by all
 * fourteen routes at first paint.
 *
 * This is the FOURTH application of the same lesson — `design/canvasColor.ts`,
 * `pages/future/repoPulse.tsx`, `pages/future/data.ts`, and now here. Rollup
 * chunks per MODULE, not per export, so the fix is always to move the symbol
 * to a module whose importers have the reachability you want.
 *
 * KEEP THIS LEAF TINY. `NavTop` is eager, so anything added to this file is
 * paid for by every route on first paint. Release-note PROSE goes in
 * `releases.ts`, which is lazy (its only importer is `SourcesPage`).
 *
 * ── WHY THE LABEL IS A BUILD-TIME CONSTANT, NOT FEED-DERIVED ────────────
 * Carried forward verbatim in intent from the docblock this constant used to
 * live under: the chrome's version badge is BUILD identity. Deriving it from
 * a live GitHub feed would let a stale deployment advertise a version whose
 * code is not actually in the bundle the visitor is running. The release
 * LIST may be live; the LABEL may not.
 *
 * ── WHAT "A RELEASE" IS HERE, AND WHY IT CHANGED ────────────────────────
 * This site shipped `vX.Y.Z` stamps through v6.1.9 and then stopped. Measured
 * at `bda0491`: `git tag` is EMPTY, and zero of the last 60 commit subjects
 * parse as a version. PRs #164–#185 — twenty-two of them — shipped with no
 * version identity at all, so "what version is this?" had no true answer in
 * any convention the repo still practises. The topbar answered `v6.0.5`
 * anyway, for twenty-two releases, because nothing watched it.
 *
 * Three candidates were considered and the reasoning is recorded here rather
 * than in a PR body, because a PR body is not where the next person looks:
 *
 *   (a) PARSE MERGE COMMITS. REJECTED — not buildable. Every merge since #164
 *       is `Merge pull request #NNN from aqua-019/<branch>`, and measured with
 *       `git log -1 --format=%B`, that ONE LINE is the entire message: there is
 *       no body, and the branch half is a random slug
 *       (`claude/prompt-attached-8fdjhd`). A merge-commit parser yields
 *       "#185 — claude/prompt-attached-8fdjhd" — noise rendered as a release
 *       note. The PR TITLE is not in the git object at all.
 *
 *   (b) RESUME `vX.Y.Z — subject` STAMPS. REJECTED — it rots the same way. It
 *       asks a human to remember something on every PR, which is exactly the
 *       convention twenty-two PRs already declined to follow. Nothing
 *       structural produces it, so nothing structural preserves it.
 *
 *   (c) DECLARE THE FEED DORMANT. Adopted only as the FLOOR, not the answer —
 *       see `SourcesPage`'s release section, which now says so honestly when
 *       the automatic feed yields nothing. A tombstone is what you ship when
 *       the surface cannot work; this one can.
 *
 *   (d) PR-KEYED IDENTITY — TAKEN. A pull request is what this project
 *       actually ships: GitHub assigns the number, the operator writes the
 *       title, and `handoffs/LOG.md` records one line per task naming it. The
 *       numbers are produced by the workflow itself, so the convention cannot
 *       be forgotten. Titles come from the pulls API (`/api/feeds?src=pulls`),
 *       which returns number + title + merged_at + html_url in ONE request —
 *       strictly cheaper than the commits path's up-to-three pages, and real
 *       prose rather than a slug.
 *
 * ── THE STALENESS GATE, AND WHY EQUALITY WOULD NOT HAVE WORKED ──────────
 * `verify-releases.mjs` asserts `SITE_PR` against `handoffs/LOG.md`. The
 * shape of that assertion is the load-bearing part:
 *
 *   AN EQUALITY GATE BETWEEN TWO HAND-MAINTAINED CONSTANTS DETECTS
 *   DISAGREEMENT, NOT STALENESS — AND STALENESS IS THE DEFECT.
 *
 * Pinning `SITE_VERSION` to, say, `package.json`'s `version` would have gone
 * green for all twenty-two releases this rotted through: both sides simply sit
 * still together. The authority has to MOVE ON ITS OWN. `handoffs/LOG.md`
 * gains one line per completed task carrying its PR URL, so it moves every
 * time the site does.
 *
 * It also has to be a committed FILE rather than git history: `.github/
 * workflows/ci.yml` uses `actions/checkout@v4` with no `fetch-depth`, which
 * defaults to depth 1, so a `git log`-derived authority is unreadable in CI.
 *
 * The invariant is `logMax <= SITE_PR <= logMax + 1` — the label may LEAD by
 * one (you set it for the PR you are opening, before its own LOG line is
 * written at write-back) but may never LAG. Plain equality would red for most
 * of every PR's life, and this repo has already recorded where that leads:
 * "a red a re-run clears is a red people learn to click through". The `+ 1`
 * upper bound is what stops the loophole in the other direction — without it,
 * `SITE_PR = 99999` would satisfy "never behind" forever.
 */

/** The product era. The app has been the v6 SPA since v6.1.0 deleted the v4
 *  static site; v6.1.9 was the last release that carried a patch number. */
export const SITE_ERA = "v6";

/** The pull request this build ships. Bump it in the SAME commit that opens
 *  the PR — `verify-releases.mjs` fails the build once `handoffs/LOG.md`
 *  records a newer one, which is the staleness detector described above. */
export const SITE_PR = 197;

/** The rendered topbar label (`NavTop.tsx`), linking to
 *  `/about/sources#release-notes`.
 *
 *  DERIVED, never typed twice: the label and the number cannot disagree,
 *  because there is only one number. The gate reads `SITE_PR` directly rather
 *  than regexing this string — a parser over a display label is a defect class
 *  this repo has paid for more than once, and it is avoidable here for free. */
export const SITE_VERSION = `${SITE_ERA} · #${SITE_PR}`;
