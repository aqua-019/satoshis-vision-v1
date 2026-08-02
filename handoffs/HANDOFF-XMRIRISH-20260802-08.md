---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-08
branch: claude/v6-mockups-repo-extwzi
status: done            # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — prompt-driven, no cowork handoff)
owner: claude-code
---

# HANDOFF — the three v6 design mockups, committed to the repo

## 1 · GOAL

The five prompts that say "build against the mockup" can read a path instead of waiting for
an attachment. Prompts 07, 09, 12, 13 and 14 each build against a self-contained HTML mockup
that today lives only outside the repo, so each of those five conversations needs the
operator to attach a file by hand. When this is done the three mockups are committed under
`docs/v6-mockups/` with a README saying which prompts consume each one and what each is
authoritative for, and it is proven — not assumed — that no build step, gate, linter or
deployment picks them up. Nothing in `app/`, `api/` or `relay/` changes.

## 2 · CONTEXT

- Source: a housekeeping prompt, explicitly **not one of the nineteen** — it consumes no
  slot and does not hop the order (still 05d → 06 → 07). Hard deadline: before prompt 07,
  the first consumer.
- Preferred slot is now, because `handoffs/LOG.md` is this batch's only collision surface
  and every PR in the batch appends one line to its end. Verified before starting: **zero
  open PRs** on the repository, so the append lands without a rebase.
- Branched from `origin/main` at `c86899b`. The designated branch already existed locally
  and on the remote at exactly that commit (0 ahead / 0 behind), so no reset was needed.
- Relevant files: `docs/v6-mockups/**` (new), `handoffs/LOG.md`, and — read but deliberately
  not modified — `app/verify-future.mjs`, `app/vite.config.ts`, `app/verify-origins.mjs`,
  `vercel.json`.

## 3 · SCOPE

IN:

1. The three mockups committed byte-for-byte under `docs/v6-mockups/` at their canonical
   names, with the browser download numerals stripped.
2. `docs/v6-mockups/README.md` — an index: one row per mockup, the prompts that consume it,
   what it is authoritative for, and a plain statement that these are design mockups rather
   than shipped code.
3. Proof that nothing imports, bundles, lints, typechecks, routes or serves them, and that
   the build and both verify chains are unchanged and green.

OUT (non-goals):

- Any change under `app/`, `api/` or `relay/` — including `app/package.json`, which every
  other PR in this batch touches and this one has no reason to.
- Editing the mockups' contents in any way, including to match the implementation.
- Editing the nineteen prompt files to point at the new paths — they live outside the repo
  and the operator maintains that side.
- `docs/README.md`. It is a stale v4-era index naming 2 of its 13 files, and the closest
  precedent (`50191d2`, which added `docs/v6-mempool-views-spec.md`) did not update it.
- Adding a `docs/` exclusion to any gate. Where a gate does walk this directory it is
  reported, not silenced.

## 4 · CONSTRAINTS

- Docs only. These are reference material that happens to be HTML.
- The mockups are **not** subject to the site's CSP, because they are never served. Do not
  "fix" them to match app rules.
- Do not modify the mockups' contents — a mockup edited to match the implementation stops
  being a spec.
- `npm run build`, `npm run verify:static` and `npm run verify:e2e` must be unchanged and
  green, with the counts reported.
- New dependencies: none.
- Do not touch: `app/`, `api/`, `relay/`, `vercel.json`, `.github/`, `docs/README.md`.

## 5 · DONE-CRITERIA

- [x] Each of the three files is byte-identical to its source attachment (`cmp` exits 0)
- [x] The three canonical filenames are exactly `nav-ia-mockup.html`,
      `markets-network-mockup.html`, `coldboot-splash.html` — no numeral, no added version
- [x] `docs/v6-mockups/README.md` exists and names, for each mockup, its consuming prompts
      and what it is authoritative for
- [x] `git diff --stat origin/main` touches only `docs/v6-mockups/` and `handoffs/`
- [x] `npm run typecheck` exits 0
- [x] `npm run lint` — N/A, no such script; the repo has no linter, formatter or
      editorconfig of any kind
- [x] `npm run test` — N/A, no such script; the verify gates are this repo's tests
- [x] `npm run build` exits 0 — 11 routes prerendered, 11 sitemap urls
- [x] `npm run verify:static` exits 0 — **16 gates**, unchanged
- [x] `npm run verify:e2e` exits 0 — **22 gates**, unchanged
- [x] `node verify-tiers.mjs` and the four `api/verify-*.mjs` exit 0
- [x] `app/dist` contains no file originating from `docs/` after a build (0 references;
      11 html files, which are the prerendered routes)
- [x] Every gate that walks the new directory is identified and reported rather than
      excluded; no gate file is edited
- [x] Branch pushed · PR opened **ready for review, not draft** · `mergeable: true`,
      `mergeable_state: clean`, CI concluded green

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

**status:** done. Every item in §3 IN landed; nothing deferred.

**pr:** see `handoffs/LOG.md`

**commits:** 3 — the mockups + README; opening this record; closing it with the PR URL.

**deps added:** none.

### The filename match was made on evidence, not on the stem alone

All three attachments arrived with the predicted download numerals *and* with their
hyphens stripped (`naviamockup_1`, `marketsnetworkmockup_3`, `coldbootsplash_6`). Rather
than matching on the mangled stem, each was matched by its `<title>`:

| Attachment | `<title>` | Committed as |
|---|---|---|
| `…naviamockup_1.html` | `D2 · nav & IA mockup (P5)` | `nav-ia-mockup.html` |
| `…marketsnetworkmockup_3.html` | `D3 · Markets & Network (P6–P8)` | `markets-network-mockup.html` |
| `…coldbootsplash_6.html` | `Cold Boot splash · v2` | `coldboot-splash.html` |

Every row filled, no attachment left over, so the "stop and report an unmatched stem"
condition never fired. Byte-identity proven with `cmp`, not asserted.

### One gate walks `docs/` — reported, not silenced

`app/verify-future.mjs:99` walks the **repo root** for
`.ts .tsx .js .mjs .css .json .md .html`; its `SKIP_DIRS` (`:73`) excludes only
`node_modules`, `.git`, `dist`, `.vercel`. It runs in CI as the 10th of the 22
`verify:e2e` gates, and gate 15 regex-tests every walked file for unproven MoneroSpace
lineage claims. No gate file was edited. Three things make it a non-event:

1. **Its scope did not change.** It already walked `docs/` — the 13 existing `docs/*.md`
   files are read on every `verify:e2e` run today. This adds files to an already-walked
   directory; it widens nothing. A `docs/` exclusion would have been the wrong fix to a
   problem that does not exist.
2. **All four new files test clean**, README included — `.md` is in the same walk, so the
   index this task adds is subject to the same check as the mockups.
3. Gate 15 asserts `lineageHits.length === 0`, not a file count, so adding files cannot
   move a gate number.

Everything else is confirmed inert: `vite.config.ts` has no `rollupOptions.input` and
`root` defaults to `app/` (two independent reasons a `.html` outside `app/` can never
become an entry); `verify-origins.mjs` scans `app/index.html` + `app/src` + `app/legacy`
only, so `docs/` stays out of scope — its `repoRoot` at `:32` is a display-string prefix
strip, never passed to `walk()`; there is no ESLint, Prettier, Biome, Stylelint or
editorconfig in the repo at all; `tsconfig.json` is `include: ["src"]`; `prerender.mjs`
and `gen-sitemap.mjs` both read a hardcoded `ROUTES` array and never call `readdirSync`;
`serve-dist.mjs` serves `dist/` only behind a traversal guard; `vercel.json` publishes
`app/dist` with no `builds` key and four literal `functions` paths; `.gitignore` excludes
neither `docs/` nor `*.html`.

### Deviation from the brief's wording, and why

The brief asks the README to say the mockups' "series are seeded placeholders and say so
on their own surfaces". They do — but **not all in the same place**, and writing it flatly
would have been a claim the files do not uniformly keep:

- `coldboot-splash.html` says it in **visible page text** — "Every number here is a
  placeholder for a real feed. Nothing ships as a value." — plus an `Illustrative` badge.
- `markets-network-mockup.html` says it in its **source header comment**, not on screen:
  seeded (deliberately, so the same chart renders every load and can be screenshot-diffed)
  with annotations that are real dated events.
- `nav-ia-mockup.html` notes it in the body standing in for a route; its two topbar rail
  figures are placeholders carrying **no on-screen marker at all**.

The README states where each one discloses it rather than asserting they all do it the
same way.

### Records protocol

The brief scoped records to the `LOG.md` line and said "beyond the LOG line and
`docs/v6-mockups/`, change nothing", which reads against CLAUDE.md:604's manual-mode rule
that prompt-driven work without a handoff file is "a protocol violation, not a shortcut".
Raised with the operator before writing; the answer was handoff **and** LOG line, which is
what every one of the seven prior tasks in this repo did.

**open questions:** none. `docs/README.md` was deliberately left alone — it is a stale
v4-era index naming 2 of its 13 files, and the closest precedent (`50191d2`, adding
`docs/v6-mempool-views-spec.md`) did not update it either. If that index is ever brought
current, this directory should be added in the same pass rather than on its own.

## 8 · LOOP FEEDBACK
