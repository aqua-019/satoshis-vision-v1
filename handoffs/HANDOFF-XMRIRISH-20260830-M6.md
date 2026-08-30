---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260830-M6
branch: claude/new-session-5b7hz3
status: in_progress
written_by: claude-code
owner: claude-code
---

# HANDOFF — p4·M6 "THE HONESTY REPAIR"

**Manual mode, and the record is late.** The protocol says author the handoff
before substantive work; this one was written after the four files were
committed. Recorded rather than back-dated — p4·M2 made the same slip and said
so, and the value of the rule is entirely in noticing when it is broken.

## 1 · GOAL

`README.md` is the file whose thesis is *"an ethos you cannot check is a
slogan."* It contained four claims that do not check out, `app/README.md`
described a control that was removed two releases ago in the present tense,
`SitePage.tsx`'s header enumerated a section order the page had stopped
rendering, and `verify-site` §12's weight assertion reddened without
discriminating. When this is done, every claim in those files is true of this
tree, and §12's comparison set can no longer contain the thing it is comparing
against.

Six sentences and one selector. Four files. **No module, no import, no
stylesheet rule** — `cssGz` must come out byte-identical.

## 2 · CONTEXT

- Brief: `p4M6honestyrepairREFRESHED.md` (written 2026-08-18 against
  `main = 5c66929`; rebase header re-bases it on `ce87559`).
- **Actual base is this branch's head, not `ce87559`.** p4·M6b (PR #203) is
  already on it — see §3 OUT.
- Files: `README.md`, `app/README.md`, `app/src/pages/SitePage.tsx`,
  `app/verify-site.mjs`.
- Evidence read at HEAD: `app/src/styles-legibility.css:23,78,267,270`,
  `app/verify-legibility.mjs:124,559`, `app/verify-mobile.mjs:1-30,44,47`,
  `app/verify-reduce.mjs:54-55`, `app/src/data/usePolling.ts:155-177`,
  `app/src/data/useMarketHistory.ts:69-78`,
  `app/src/design/ThemeToggle.tsx:1-30`.

## 3 · SCOPE

IN: §1a-§1e README claims · §2 app/README ThemeToggle paragraph · §3 the
`sub=` coupling · §4 verify-site §12's selector.

OUT (non-goals):
- **§1d was already landed by p4·M6b** and is not re-done here. The brief
  measured it on `ce87559`, where the simulators clause named `/learn` only;
  on this branch it already names `/operate/superstress/explorer` and is
  property-based rather than enumerated. Verified at HEAD before skipping.
- **The §1b medallion dependency never materialised.** The brief's rebase
  header says §4's scoping is a dependency for M6b's support-card image.
  That image was SKIPPED in M6b as blocked on an asset, so nothing depends on
  the ordering; the scoping lands here regardless and is the better shape
  either way.
- `LICENSE`, budgets, any file under `app/public` or `api/`.

## 4 · CONSTRAINTS

- No module, no import, no stylesheet rule. `cssGz` byte-identical at 18,586.
- `git diff --name-only` for the substantive commit names exactly four files.
- Do **not** add a gate coupling the `sub=` prose to the section list — §3's
  whole point is to remove the coupling, not to pin it.
- Never `pkill -f` / `pgrep -f … | kill`. Servers by port via `lsof`.

## 5 · DONE-CRITERIA

- [x] `verify-site` green, and §12 prints a real pair (not `0px`, not equal)
- [x] M-a2 reds on weight with the CTA's height BELOW the secondary max
- [x] M-b reds on affordance AND the weight line is not an equal pair
- [x] reverting the `sub=` line reds nothing
- [x] `cssGz` byte-identical at 18,586; eager half byte-identical
- [x] exactly four files, none under `app/public` or `api/`
- [x] every gate filename and path cited in `README.md` resolves on disk
- [x] "Main Home" and "12px" swept repo-wide, every hit read

## 6 · VERIFY COMMANDS

```
cd app && npm run build && node scripts/serve-dist.mjs 4173 &
node verify-site.mjs
node verify-bundle.mjs
npm run verify:static && npm run verify:e2e
```

## 7 · REPORT

Filled at write-back — see `CLAUDE.md`'s session note for the full record.

## 8 · LOOP FEEDBACK

- **The brief's own replacement text for §1a would have been false**, in the
  same shape as the claim it was replacing: it proposed "a hard 11px type
  floor" and cited `verify-legibility.mjs` for it. Measured: three `.pill`
  nodes render at 10.5px on `/about/site` at 1440, and that gate's floor is on
  the SOURCE (token scale + inline/SVG `fontSize` literals), never on a
  rendered CSS selector. A brief that has correctly diagnosed a false claim can
  still prescribe a false replacement, and the same measurement catches both.
- **M-a refused to go red and the refusal is the finding.** The brief predicted
  that dropping the CTA's inline padding would take its height below the
  secondary links'. It goes 38px → 30px against 28px, so the assertion is
  correctly green. `proto-btn` carries its own padding. The mutation was too
  weak, not the gate blind — M-a2 crosses it and reds at `12px vs 28px`.
- **Report the slack, not the tick**: at ship the weight assertion passes by
  10px (38 vs 28), so it absorbs an 8px shrink in silence. That margin is the
  size of the defect class it cannot see.
