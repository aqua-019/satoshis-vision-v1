---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260816-40
branch: claude/attached-prompt-e8gjpl
status: in_progress        # open -> in_progress -> done | blocked
written_by: claude-code    # manual mode — task arrived as an attached prompt
owner: claude-code
---

# HANDOFF — p3·18 THE LEGAL EVIDENCE LAYER: citations, honest dates, and the orphan gate

## 1 · GOAL

`/monero/legality` stops asserting more confidence than it has. Every one of the 21
jurisdiction rows carries (a) a **citation** — a label plus, where a primary source can
honestly be named, an https link to the naming authority's own domain — and (b) a
**`reviewed` date derived from git history**, being the date that row's note last
materially changed, not the date this PR ran. The page renders both, plus a page-level
oldest/newest line, so staleness is VISIBLE rather than implied. And `verify-legality.mjs`
— an orphan since v6.0.10, wired to neither npm nor CI — runs in `verify:e2e`, extended to
gate the two new claims, the non-hue status channel, and 320px reflow. Orphans 7 → 6.

## 2 · CONTEXT

- Attached prompt: `p3·18 — THE LEGAL EVIDENCE LAYER` (prompt 18 of 19, C7 rewrite).
  It is itself a REWRITE of `claude/prompts/18-legal-redesign-REWRITE-FIRST.md`, whose
  three defects were all fixed at v6.0.10 before this loop began.
- Base: `origin/main` = **`1d64871`** (PR #186 merged).
  **Trap recorded:** the LOCAL `main` ref is stale at `088a6e8` (PR #165) — 21 PRs behind.
  `git log main` misleads; `git log origin/main` is the authority in this clone.
- **The clone arrived SHALLOW** (443 commits, graft boundary at `2cfdfeb` 2026-07-31 — the
  very commit that split `data.ts` out of `LegalityTab.tsx`). §0.5's git derivation was
  therefore NOT executable as delivered. `git fetch --unshallow` recovered it: 443 → 878
  commits, and the notes' true vintage reaches back to `7b49980` (2026-06-05).
- Relevant files: `app/src/pages/monero/legality/data.ts` (104) · `JurisdictionRow.tsx` (71) ·
  `StatusChip.tsx` (44) · `status.ts` (123) · `LegalityControls.tsx` (83) ·
  `app/src/pages/monero/LegalityTab.tsx` (184) · `app/verify-legality.mjs` (**230**, not the
  prompt's 231) · `app/verify-bundle.mjs` · `app/package.json` · `.github/workflows/ci.yml` ·
  `CLAUDE.md` (two census places).
- In-repo precedent for the citation shape: `app/src/pages/future/data.ts:26`
  `export type EcoLink = readonly [label: string, href: string | null]` — label + honest null.

## 3 · SCOPE

IN:
- A `sources` field on `MatrixRow`, populated for all 21 rows, honest nulls where no primary
  source can be named without inventing a path.
- A `reviewed` field on `MatrixRow`, git-derived, rendered per row + a page-level range line.
- Extending `verify-legality.mjs` and wiring it into `verify:e2e` MID-CHAIN (never the tail —
  the vitals-last inversion, #184 F4, is an open item and must not be deepened).
- Census recount in BOTH CLAUDE.md places + the `ci.yml` e2e step title.
- Budget raises for any ceiling this PR's bytes actually cross.

OUT (non-goals):
- Rebuilding the layout (§0.1: the 8-column-grid defect is fixed and gated).
- Migrating `JurisdictionRow` to `design/Disclosure` (§0.3: its single-open accordion is the
  right shape for a filtered list; `Disclosure` was MODELLED ON it, not the reverse).
- Editing any legal CLAIM. There is no egress to verify current law, so a note is reported as
  possibly-aged, never silently "refreshed".
- Fixing the vitals-last `verify:e2e` inversion.
- `verify-markets-dom:790` — not touched by this PR.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22. Vercel only.
- Honest-data doctrine: a live number is real or it is an em-dash. A date is true or absent.
  **Mass-stamping today's date on 21 unreviewed rows would be a fabricated review** — the exact
  defect class this site exists to refuse.
- **No egress.** Measured, not assumed: the agent gateway answers **403 to CONNECT** for
  `www.dfs.ny.gov:443`, `eur-lex.europa.eu:443` and `www.fincen.gov:443`. Link VALIDITY is
  therefore operator-checkable and must ship as a listed, bracketed absence.
- No third-party browser request may ever be added (CSP `connect-src 'self'`; gated by
  `verify-origins.mjs`). Citations are `<a href>` the READER may click — never a fetch.
- `cssGz` margin is **300 B**; `lazyJsRaw` margin is **894 B**. Reuse classes; state any crossing.
- The `.kicker`/`text-transform` family: any gate reading rendered legality text uses
  `textContent` or case-insensitive matching. Three instances recorded; do not add a fourth.
- Provenance stays five members. The legality page is editorial + cited-source content, not
  live data — no live badge appears on a legal claim.

## 5 · DONE-CRITERIA  — the gate reads ONLY this section

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `node verify-legality.mjs` exits 0 against a served build of the FINAL tree
- [ ] All 21 rows carry a `sources` entry; every non-null `href` is `https:` and on the domain
      of the authority the row's own note names — asserted in the gate, both directions
      (count derived from data, no hardcoded 21)
- [ ] All 21 rows carry a `reviewed` date that parses, is not in the future, and is not
      uniformly today's date (the fabricated-review check)
- [ ] The page-level oldest/newest line RECOMPUTES from the rendered rows (derivation-checking,
      the gate file's own idiom) rather than matching a literal
- [ ] Status channel survives greyscale: a non-hue channel is asserted present in the gate
- [ ] 320px-equivalent viewport: no horizontal scroll, asserted in the gate
- [ ] `verify-legality` appears in `verify:e2e` MID-CHAIN, not last; `npm run verify:e2e` exits 0
- [ ] Two-polarity transcript for EVERY new or modified assertion (a state that reds it and a
      state that greens it), restores verified against the COMMITTED BLOB with bracketed
      absence-greps
- [ ] `node verify-bundle.mjs` exits 0; every ceiling this PR crosses is raised red-then-green
      on the FINAL tree with the delta attributed
- [ ] Census RECOUNTED (never incremented) by a script CONTROLLED against `bda0491` first, and
      updated in BOTH CLAUDE.md places + the `ci.yml` e2e step title
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npx tsc --noEmit
npm run build
node scripts/serve-dist.mjs &        # confirm holder: lsof -iTCP:4173 -sTCP:LISTEN -P -n
node verify-legality.mjs
node verify-bundle.mjs
npm run verify:static
npm run verify:e2e
```

## 7 · REPORT  — filled on exit

status:
pr:
commits:

## 8 · LOOP FEEDBACK

- The prompt's §0.5 assumed `git log --follow` would reach the pre-split note history. In a
  **shallow** clone it does not, and the graft boundary sat exactly on the split commit — the
  one place where the amputation is invisible (`--follow` returns a plausible 3-commit history
  that simply stops). `git rev-parse --is-shallow-repository` before any archaeology.
- The prompt gave `verify-legality.mjs` as 231 lines; it is 230.
