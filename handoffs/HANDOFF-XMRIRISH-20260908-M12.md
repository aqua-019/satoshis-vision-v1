---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260908-M12
branch: claude/terms-of-service-page-8egioc
status: done
written_by: claude-code
owner: claude-code
---

# HANDOFF — p4·M12 "/about/terms · the site's first Terms of Service"

## 1 · GOAL
`/about/terms` exists as the nineteenth route and the About section's fourth
leaf: a Terms of Service page, prerendered like every other route, whose §2
no-KYC guarantee is held in place by a dedicated build gate. `LICENSE` item 3
stops advertising an exchange-widget integration this site has not had since
v6.1.0.

## 2 · CONTEXT
- Authored in MANUAL MODE from an operator brief; this file is the record the
  repo's own loopflow rule requires, written before substantive work.
- The page has an AUTOMATED READER. kycnot.me re-reads it monthly with an AI
  and re-scores the site. "Guaranteed no KYC" is +25 privacy — a quarter of
  the privacy score — and is defined as "Terms explicitly state KYC will never
  be requested". "Can't analyse ToS" is −3 trust and names client-side
  rendering as a cause. Both facts are load-bearing for decisions below.
- Model files: `src/pages/SitePage.tsx` (page shape), `verify-site.mjs` (gate
  shape), `scripts/routes.mjs` (route authority).

## 3 · SCOPE
IN: the route + its registrations, `src/pages/TermsPage.tsx`,
`verify-terms.mjs` + npm/CI wiring, `LICENSE` item 3, `SITE_PR`, `LOG.md`.
OUT: `SitePage.tsx`, `vercel.json`, any existing prose, any other page's copy.
The Mission & ethos page and this one overlap deliberately — one is editorial,
one contractual — and neither is the other's source.

## 4 · CONSTRAINTS
- The §2 sentence ships byte-for-byte and unhedged. It is the deliverable.
- The page must render whole with JavaScript off; nothing on it may depend on
  a hook, a fetch, or a client-only branch.
- Zero new stylesheet rules (`cssGz` margin was 595 B).
- No figures, no runtime dates, no counts on the page.
- Supplied copy ships VERBATIM; anything wrong with it is reported, not fixed.

## 5 · DONE-CRITERIA
- [x] `ROUTES.length` 18 → 19; `REDIRECTS.length` unchanged at 13
- [x] `dist/about/terms/index.html` exists and carries the §2 sentence in
      STATIC HTML
- [x] `tsc --noEmit` clean (proves `routes.d.mts` registration)
- [x] `verify-terms.mjs` passes, INCLUDING its §2d planted-failure control
- [x] `verify-bundle` green with every raised ceiling justified in-file
- [x] `verify:static` green
- [x] `verify:e2e` green
- [x] `LICENSE` item 3 names no integration this site does not have

## 6 · VERIFY COMMANDS
```
cd app && npx tsc --noEmit
npm run build && npm run verify:static
node scripts/serve-dist.mjs 4173 &   # then:
node verify-terms.mjs && npm run verify:e2e && node verify-bundle.mjs
```

## 7 · REPORT
See the PR body and `handoffs/LOG.md`'s M12 line. Headline findings: the
brief's §1 scope listed six registration surfaces where the sweep finds
eleven (one of them a hard `tsc` error); two budget moves the brief did not
predict, both route-count derivatives; and four defects in the supplied copy,
reported rather than silently fixed.

## 8 · LOOP FEEDBACK
- A brief that enumerates registration surfaces should say "sweep, then
  verify" rather than listing them: the ≥8-`R.*`-keys census finds files the
  sibling-literal grep structurally cannot, because they hold no path literal.
- A brief quoting budget ceilings should include CHUNK_COUNT and the tightest
  route row. Both moved here and neither was in the table.
- "Ship the copy verbatim" and "here are the section ids" can disagree. They
  did: fourteen ids against fifteen blocks.
