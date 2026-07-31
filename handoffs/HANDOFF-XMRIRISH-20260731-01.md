---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260731-01
branch: claude/delete-v4-frontend-11kv8t
status: done            # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — v6.1.0 · Delete the dead v4 front-end

## 1 · GOAL

The repo contains only what ships. The v4 static site at the repo root — 22 `.html`
pages, `js/`, `css/`, `nav.js` and the codemod that patched them — is gone, along with
the orphaned metadata and deploy config that served it. `sitemap.xml` is generated from
the React route table into `app/dist`, where it actually resolves. No CI gate reads the
repo root any more, and no red check remains that everyone is expected to ignore.

## 2 · CONTEXT

- Prompt 01 of 19 for v6.1.0 (prompt-driven; manual mode per CLAUDE.md loopflow).
- Root cause: `vercel.json` sets `outputDirectory: app/dist` and rewrites
  `/((?!api/).*)` → `/index.html`. The repo root is not in `app/dist`, so every legacy
  URL already resolved to the SPA shell.
- Relevant files: `vercel.json`, `app/verify-origins.mjs`, `app/scripts/prerender.mjs`,
  `.github/workflows/ci.yml`.

**Three premises in the brief did not survive verification:**

1. "`main` is at v6.0.9" — `main` carries v6.0.12; the branch was exactly at `main`.
2. "Re-confirm with `curl https://xmr.irish/legal.html`" — sandbox egress returns 403 on
   CONNECT. Verified structurally via `vercel.json` instead, which is a stronger proof.
3. "Retire `auto-merge.yml`" — already deleted in `a570bbb`, absent at `origin/main`.

## 3 · SCOPE

IN: delete the v4 front-end and its orphans; rewrite `verify-origins.mjs` as an app-only
gate; generate `sitemap.xml`/`robots.txt` from a shared route table; resolve
`verify-v510.mjs`; update stale docs and the session-start hook.

OUT: `app/src/**` and `app/index.html` (untouched by design); `docs/` v4 audits (kept as
historical record); `api/monero.js` (now orphaned — flagged, not removed, as deleting it
touches `api/` and `vercel.json` function config); the three remaining hand-maintained
route lists in `NavTop.tsx`, `RootBoundary.tsx` and `verify-lib.mjs`.

## 4 · CONSTRAINTS

- CSP `connect-src 'self'`; zero third-party browser requests; fonts stay self-hosted.
- `api/` is CommonJS; scripts under `app/scripts/` are ESM `.mjs`, zero dependencies.
- No workflow that merges, approves, or pushes to `main`.
- Do not merge the PR; do not verify against a deployment.

## 5 · DONE-CRITERIA

- [x] `npm run typecheck` exits 0
- [x] `npm run build` exits 0, emits 11 prerendered routes + `dist/sitemap.xml` + `dist/robots.txt`
- [x] `npm run verify:static` exits 0 (11 gates, incl. `verify-origins --static`)
- [x] `npm run verify:e2e` exits 0 (9 gates, incl. `verify-origins` full)
- [x] All 9 CI job-1 offline gates pass individually
- [x] `app/index.html` byte-identical; `app/src/**` shows zero changes
- [x] `sitemap.xml` contains only routes that resolve — all 11 return 200
- [x] No red check left that is not a real failure
- [x] Branch pushed · draft PR opened

## 6 · VERIFY COMMANDS

```
cd app && npm ci && npm run typecheck && npm run build
node verify-tiers.mjs && node ../api/verify-nodehealth.mjs && node ../api/verify-tx-parse.mjs
node ../api/verify-feeds.mjs && node ../api/verify-markets.mjs && node verify-stale.mjs
node verify-confirmations.mjs && node verify-txdetail.mjs && node verify-feedcache.mjs
npm run verify:static
node scripts/serve-dist.mjs & npm run wait-preview && npm run verify:e2e
```

## 7 · REPORT

**status**: done

**pr**: https://github.com/aqua-019/satoshis-vision-v1/pull/146

**commits**: one — `feat(repo)!: delete the dead v4 front-end`

**deps added**: none

**deviations from spec**:

1. **~100 files deleted, not the ~75 predicted.** 22 HTML + 51 `js/` + 2 `css/` = the
   brief's 75. The other 25 are user-approved orphan cleanup: root `fonts/` (17 woff2,
   referenced only by `css/d10.css`, zero family overlap with the app's 12),
   `netlify.toml`, root `favicon.svg`/`manifest.json`/`sitemap.xml`/`robots.txt`,
   `nav.js`, `harden-legacy-head.mjs`, `verify-v510.mjs`.

2. **"Nothing in `app/` touched" was not achievable.** `app/verify-origins.mjs` reads the
   repo root and runs in CI twice; leaving it would have broken both jobs. The sitemap
   generator also lives under `app/scripts/`. The invariant actually held is the one that
   protects the site: `app/index.html` is byte-identical and `app/src/**` has zero changes.

3. **`verify-v510.mjs` deleted rather than fixed or gated.** The brief offered two routes,
   both assuming `networkidle` was the only defect. It also selects charts by
   `viewBox="0 0 1000…"` (v6.0.12 switched to measured CSS width) and looks for a `Top 10`
   panel now titled `XMR vs Top 9`. Its header called it a HISTORICAL GATE against a feed
   deleted in v5.0.14, and it does zero route mocking. Repair would have produced a
   near-duplicate of `verify-charts.mjs` + `verify-markets-dom.mjs`, both already in CI.

4. **`auto-merge.yml`: no action taken.** Already gone at `origin/main` (`a570bbb`).

5. **Docs beyond the brief.** `CLAUDE.md`'s overview and `README.md` described the deleted
   site end-to-end; both were rewritten. `MASTER-HANDOFF.md` and `XMR-QUICKSTART.md` got
   deprecation banners rather than rewrites — they are v4 records worth keeping.

**notes for ARCHITECTURE.md patch**: `app/scripts/routes.mjs` is the single source for
static routes, consumed by `prerender.mjs` and `gen-sitemap.mjs`. Prompt 07's 11 → 6
restructure edits that file only.

**open questions**:
- `api/monero.js` and its two `vercel.json` entries are now orphaned. Remove in a
  follow-up scoped to `api/`?
- Three hand-maintained route lists remain (`NavTop.tsx` `NAV`, `RootBoundary.tsx`
  `ROUTES`, `verify-lib.mjs` `ROUTES`). Worth folding onto `routes.mjs` during prompt 07.

## 8 · LOOP FEEDBACK

<none — no verify failures>
