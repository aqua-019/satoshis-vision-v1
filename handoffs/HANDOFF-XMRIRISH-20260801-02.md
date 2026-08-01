---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260801-02
branch: claude/future-tab-automation-registry-0e3gox
status: done            # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — v6.1.1 Future tab automation registry: four pulses, push/issue split, lineage removal

## 1 · GOAL

The `/future` tab reports repo health per-signal instead of collapsing it into
one badge, pulses four repos instead of two, carries no paid-API framing, and
asserts no unconfirmed provenance for the Superbrain project. Before this,
`monero-project/research-lab` rendered as `repo quiet · 485d ago` because
nobody *pushes* to it — while its issues carry the actual MRL discussion — so
the tab told visitors Monero research had stopped. After it, push age and
issue age are two separately-labelled readouts sourced from two GitHub
endpoints, and the DOM gate that proves it runs in CI for the first time.

## 2 · CONTEXT

- Prompt 02 of 19 (v6.1.1). Prompt 01 shipped the v4 front-end deletion.
- Relevant files: `api/feeds.js`, `app/src/data/useCachedFeed.ts`,
  `app/src/pages/future/{data.ts,cards.tsx,ProtoPopup.tsx}`,
  `app/src/pages/FuturePage.tsx`, `app/src/protocols/stressnet.tsx`,
  `app/verify-future.mjs`, `api/verify-feeds.mjs`, `app/verify-feedcache.mjs`.
- Three user decisions taken mid-task: reword rather than delete the X ingest
  path (`api/feeds.js`'s `src=x` 501 branch left untouched); fold one extra
  upstream call into `src=ghrepo` rather than special-casing research-lab
  client-side; wire `verify-future.mjs` into `verify:e2e`.

### Premises in the prompt that did not survive contact with the repo

- "~43 gates": there are **44 files** (`app/`×40, `api/`×4), 43 gates plus the
  shared `verify-lib.mjs`. CI ran **24 distinct files**, now 25.
- "`research-lab` currently reads `quiet · 485d`": no such string existed. The
  rendered string was `repo quiet · 485d ago`, and the figure is computed live.
- "#161 … you already fetch them": issues are fetched, but **no issue number is
  hardcoded anywhere** in the tree.
- The provenance claim shipped in **four** rendered places, not one — including
  `protocols/stressnet.tsx` and a separate unsourced superlative on
  `FuturePage.tsx`. `MoneroSpace` and `Superbrain` appeared **nowhere**, so the
  project name had to be added, not corrected.
- `verify-future.mjs` — the gate owning every *Verify* criterion — was
  **orphaned**, in neither npm nor CI. The Future tab was ungated.
- Found while editing: the registry claimed a **"2.5s poll"** and a
  `monerod get_info` dependency. Both were superseded by tiered polling in
  v6.0.6. Corrected, since it is the surface this task edits.

## 3 · SCOPE

IN: the automation registry, the `useRepoPulse` set, the `src=ghrepo` payload,
the copy fixes, the lineage removal, gate updates, CI wiring, doc counts.

OUT (non-goals): deleting the server-side X ingest path (user chose reword);
`useRepoPulse` discarding `state` so a failed pulse reads "fetching…"
indefinitely (pre-existing, all pulse cards, not introduced here); the SVG
sub-12px mobile text issue; the other 17 orphaned gates.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict · Node 22. `api/` is **CommonJS**.
- CSP `connect-src 'self'` — GitHub is reachable only via `/api/feeds`.
- Zero fabricated values: a null `issueAt` renders an em-dash, never a date.
- `vercel.json` caps `api/feeds.js` at `maxDuration` 15s, and each upstream
  fetch has an 8s timeout — so the two GitHub calls must run concurrently.
- Do not touch: `api/feeds.js`'s `src=x` / 501 branch.

## 5 · DONE-CRITERIA  — the gate reads ONLY this section

- [x] `npm run typecheck` exits 0
- [ ] `npm run lint` — **N/A, no such script exists** in `app/package.json`
- [ ] `npm run test` — **N/A, no such script exists** in `app/package.json`
- [x] `npm run build` exits 0
- [x] four pulses render with real numbers
- [x] `grep -ri "friend's\|paid-tier\|X_BEARER" app/src/` → zero hits
- [x] `research-lab` shows both push age and issue age, labelled distinctly
- [x] 4 GitHub requests on cold load, 0 on reload within 24h
- [x] no lineage claim about the Superbrain project anywhere in the tree
- [x] `grep -c networkidle app/verify-future.mjs` returns 0
- [x] every scenario passes against `node scripts/serve-dist.mjs`, not `vite preview`
- [x] `npm run verify:e2e` green end to end with `verify-future` included
- [x] `/monero/future` still absent from `app/scripts/routes.mjs`
- [x] Branch pushed · PR opened

## 6 · VERIFY COMMANDS

```
cd app && npm ci
npm run typecheck
npm run build
node ../api/verify-feeds.mjs
npm run verify:static
node scripts/serve-dist.mjs &
npm run wait-preview
node verify-future.mjs
npm run verify:e2e
grep -c networkidle verify-future.mjs
grep -ri "friend's\|paid-tier\|X_BEARER" src/
grep -n "monero/future" scripts/routes.mjs
```

## 7 · REPORT

status: done

pr: (filled in below once opened)

commits: one conventional commit on `claude/future-tab-automation-registry-0e3gox`.

deps added: none.

deviations from spec:
- The prompt's "4 GitHub requests on cold load" is the cost of the **registry
  block**, not the page. A cold `/future` is 11 `/api/feeds` requests — 9
  `src=ghrepo` (5 protocol cards + 4 registry) + `getmonero` + `mrl`; it was 9
  before this change. The gate asserts both numbers so neither drifts.
- Browser requests per repo stay at 1, but `src=ghrepo` now makes **2**
  upstream GitHub calls per edge-cache miss (repo metadata + newest issue),
  run concurrently under `Promise.allSettled`. 8 per 24h for the registry —
  far inside the 60/hr unauthenticated limit.
- The repo-pulse cache id moved to `gh.v2.<repo>` because the payload shape
  changed. `useCachedFeed` serves a cache hit without re-validating its shape,
  so without the bump a returning visitor would have read
  `last issue activity —` on an active repo for up to 24h — the exact
  misreading this task removes. Cost: one refetch per repo, once.
- `ProtoPopup` got the same two accuracy fixes as the registry ("push quiet",
  and the `(incl. PRs)` caveat on `open_issues_count`), because it renders the
  identical claim from the identical field.
- `AUTOMATION_ROWS`' stale "2.5s poll" / `monerod get_info` claims were
  corrected; they are on the surface this task edits.
- A lineage-claim note was added to `CLAUDE.md`'s Known Issues. It is a
  standing fact (an open question with a third party) and a guard against a
  future session "restoring" the removed sentence — not a session log.

notes for ARCHITECTURE.md patch: none — no ARCHITECTURE.md in this repo.

open questions:
- The Superbrain project's interface lineage, with its maintainer. Until it is
  answered, the tree names the project and links the repo and asserts nothing
  further; `verify-future.mjs` enforces that.
- `useRepoPulse` discards `state`, so a pulse whose proxy call fails shows
  "fetching via /api/feeds …" forever rather than an honest failure. It affects
  all six pulse surfaces and predates this change; worth its own task.

## 8 · LOOP FEEDBACK

(none)
