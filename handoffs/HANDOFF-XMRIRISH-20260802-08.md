---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260802-08
branch: claude/v6-mockups-repo-extwzi
status: in_progress     # open -> in_progress -> done | blocked
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

- [ ] Each of the three files is byte-identical to its source attachment (`cmp` exits 0)
- [ ] The three canonical filenames are exactly `nav-ia-mockup.html`,
      `markets-network-mockup.html`, `coldboot-splash.html` — no numeral, no added version
- [ ] `docs/v6-mockups/README.md` exists and names, for each mockup, its consuming prompts
      and what it is authoritative for
- [ ] `git diff --stat origin/main` touches only `docs/v6-mockups/` and `handoffs/`
- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` — N/A with reason (no such script; the repo has no linter at all)
- [ ] `npm run test` — N/A with reason (no such script; the verify gates are this repo's tests)
- [ ] `npm run build` exits 0
- [ ] `npm run verify:static` exits 0, gate count reported and unchanged
- [ ] `npm run verify:e2e` exits 0, gate count reported and unchanged
- [ ] `node verify-tiers.mjs` and the four `api/verify-*.mjs` exit 0
- [ ] `app/dist` contains no file originating from `docs/` after a build
- [ ] Every gate that walks the new directory is identified and reported rather than
      excluded; no gate file is edited
- [ ] Branch pushed · PR opened **ready for review, not draft** · `mergeable: true`,
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

**status:**

**pr:**

**commits:**

**deps added:**

**open questions:**

## 8 · LOOP FEEDBACK
