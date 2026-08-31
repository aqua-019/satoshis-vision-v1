---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260831-M6
branch: claude/new-session-xw3hru
status: in_progress
written_by: claude-code (manual mode)
owner: claude-code
---

# HANDOFF — p4·M6 "THE HONESTY REPAIR"

## 1 · GOAL

`README.md` is the file whose thesis is *"an ethos you cannot check is a slogan."* It
currently carries claims that do not check out — a type floor that is false on desktop,
a gate cited for the claim its own header disclaims, a randomness census that is short by
one source and contradicts itself four lines later, a CSP claim true of fetches and false
of clicks, and a provenance gate credited with an assertion it never makes. `app/README.md`
describes a mount that p4·M2 removed, in the present tense. `SitePage.tsx`'s subtitle
enumerates the section order the page had *before* p4·M2 reordered it. And
`verify-site.mjs` §12's weight assertion reddens without discriminating, because its
selector can put the subject into its own comparison set.

When this is done, every claim in `README.md` that cites a mechanism is true of that
mechanism; the subtitle names no sequence, so there is no order left to rot; and §12's
weight comparison excludes its own subject by construction.

## 2 · CONTEXT

- Base: `fa5e5184` — merge of PR #203 (p4·M6b). `SITE_PR` is 203.
- **A prior session built this and it was reverted out at `4cb8cb0`** to keep #203's diff
  clean. Commits `a5358b8`, `a3c6f36`, `3aad1fd`, `72925cf` are reachable in branch
  history. Read as prior art; every figure in them is a REPORT until reproduced.
- §1d of the brief is ALREADY LANDED by #203 — `README.md:187` names
  `/operate/superstress/explorer` alongside `/learn/sim`. Not this PR's.
- Relevant: `README.md`, `app/README.md`, `app/src/pages/SitePage.tsx`,
  `app/verify-site.mjs`; gates cited: `verify-legibility`, `verify-mobile`,
  `verify-reduce`, `verify-prng`, `verify-provenance`, `verify-origins`.

## 3 · SCOPE

IN: exactly four files — `README.md`, `app/README.md`, `app/src/pages/SitePage.tsx`,
`app/verify-site.mjs`. Prose corrections; one subtitle rewrite; one gate selector fix.

OUT (non-goals): widening `verify-reduce.mjs`'s hand-copied mempool list (a fifth file, and
it needs its own break tests); adding a gate that pins the subtitle against the section list
(that recreates the coupling this PR removes); any change under `app/public/` or `api/`;
any new module, import, or stylesheet rule; `SITE_PR` bump.

## 4 · CONSTRAINTS

- **No budget may move.** Nothing here adds a module, an import, or a stylesheet rule.
  `cssGz` must come out BYTE-IDENTICAL at 18,586. If it moves at all, that is a finding.
- Baseline at `fa5e5184`: `cssGz` 18,586 · `eagerJsRaw` 264,457 · `eagerJsGz` 88,511 ·
  `lazyJsRaw` 990,618 · `totalJsRaw` 1,255,075 · chunks 76.
- `git diff --name-only` must name exactly four files.
- Never `pkill -f` / `pgrep -f | kill`. Servers: `lsof -tiTCP:<port> -sTCP:LISTEN | xargs -r kill`.
- Where the brief disagrees with measurement, the measurement wins, and the move is stated.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npm run build` exits 0
- [ ] `node verify-site.mjs` exits 0, and §12's weight line prints a REAL unequal pair
      (CTA height > secondary max, neither 0)
- [ ] §12's non-vacuity floor names the secondary count and requires >= 2
- [ ] Break test **M-a**: CTA shrunk → §12 reds on WEIGHT, message shows CTA height BELOW
      the secondary max. Mutation proven applied by `git diff` before the run.
- [ ] Break test **M-b**: CTA given `v6-res` → §12 still reds (affordance), and the weight
      line does NOT report an equal pair — the proof self-inclusion is gone
- [ ] Break test **M-c**: old `sub=` sentence restored → NOTHING reds (the coupling was
      removed, not gated). Recorded as a deliberate non-red.
- [ ] Every restore proven against the COMMITTED BLOB with a bracketed marker sweep, and
      rebuilt between restore and re-measure
- [ ] Budgets: `cssGz` byte-identical at 18,586; eager half byte-identical at 264,457;
      any lazy/total delta attributed to a named term with residual ZERO; chunks 76 = 76
- [ ] `git diff --name-only` names exactly 4 files, none under `app/public/` or `api/`
- [ ] Sweep complete: every gate filename cited in `README.md` exists; every "Main Home",
      "12px" and "11px" hit repo-wide read and judged; every gate-citation sentence in
      `README.md` checked against what that gate actually asserts
- [ ] Stale claims found OUTSIDE the four files are NAMED in the record, not fixed
- [ ] `handoffs/LOG.md` line appended; CLAUDE.md session note written
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npm run build
node verify-site.mjs
node verify-bundle.mjs
cd .. && git diff --name-only fa5e518
```

## 7 · REPORT — filled on exit

status:
pr:
commits:

## 8 · LOOP FEEDBACK

