---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260812-28
branch: claude/orbital-nav-visibility-uh011f
status: in_progress
written_by: claude-code (manual mode — task arrived as a prompt p2·7b, no mockup)
owner: claude-code
---

# HANDOFF — p2·7b NAV: one authoritative mempool view list

## 1 · GOAL

`orbital` — the seventh mempool view, shipped in #174 — is reachable from every
nav surface, and the mechanism that hid it cannot recur. Today it appears in
NONE of them: the LIVE mega-menu reads "MEMPOOL · 6 VIEWS" and lists six, the
⌘K palette lists six, and the same is true of the tab bar, prefetch and
breadcrumbs, because all of them read `src/nav/ia.ts` — which carried a
HAND-COPIED list of six view ids plus a second literal, `h: "Mempool · 6
views"`. The view was reachable only from the on-page switcher (which derives
from the registry, and was therefore correct) and from a typed `?v=orbital`
URL.

The fix is structural, not a seventh entry: one authoritative list, derived
everywhere, with a gate that pins it in both directions — so the four
remaining Phase 2 views inherit the fix instead of quadrupling the defect.

## 2 · CONTEXT

- `main` = `0f52a21` (PR #174 merged: Orbital, `verify-tracking`,
  `verify-memstats`, a loud budget raise).
- Defect sites: `src/nav/ia.ts:87-94` (the copy) and `:126` (the count).
  `ia.ts`'s own header at `:39-41` warned the copy "can drift if the source
  changes without this file being updated too". It drifted on the first view
  added after that warning was written.
- The wall that forced the copy is real and documented at `ia.ts:31-33`:
  `views/index.tsx` is a `.tsx`, and Node's native TS type-stripping does not
  support that extension AT ALL. `verify-ia.mjs` imports `ia.ts` under bare
  Node, so `ia.ts` structurally cannot import the registry.
- The repo already owns the cure: `views/protocol-meta.ts` is pure metadata
  split from a component registry, re-exported for bare-Node reach through
  `nav/registries.mjs`.
- No gate saw it: `verify-ia` checks ia against ROUTES, and every view leaf
  strips to the same `/live/mempool`; `verify-nav` §6 checks the on-page
  switcher, which derives from the registry.

## 3 · SCOPE

IN: extract the component-free view metadata to a bare-Node-importable
module; derive `MEMPOOL_VIEWS`, ia's list and ia's count from it; a
both-directions parity gate in `verify-ia.mjs`; re-point the gates that parse
the old location; a decommented `src/`-wide sweep for other hand-kept view
lists and count literals; budget quoted at both endpoints; rendered proof.

OUT (non-goals): `ia.ts`'s `FUTURE_PROTOCOL_META` / `ECOSYSTEM_META`
hand-copies (same class, no drift yet — curing them means giving
`pages/future/data.ts` the same split, its own change); the four remaining
Phase 2 views; any budget-ceiling change; stale PROSE counts outside the files
restructured here (reported, not fixed).

## 4 · CONSTRAINTS

- The new module MUST load under bare Node: no `@/` aliases, no `.tsx`
  imports transitively, no React.
- Vite needs a static string literal in each `import()` or the seven engines
  collapse into one glob chunk, undoing v6.0.8's code-splitting.
- All three budget ceilings stay untouched: eager 280,000 · lazy 736,000 ·
  total 1,000,000. Lazy had **2,228 B** of margin at `0f52a21`.
- Zero fabricated values; the count is derived or it is not shipped.

## 5 · DONE-CRITERIA

- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0
- [x] Exactly ONE list of mempool view ids exists in `src/` (decommented,
      exact-token sweep, scope stated)
- [x] `ia.ts` contains no view id literal and no view count literal
- [x] `verify-ia` asserts registry↔ia parity in BOTH directions, exactly-once,
      the header count against the registry side, and the component binding
- [x] Two-polarity transcript per new/modified assertion, mutation proven
      applied AND effective, trap-owned restore verified clean
- [x] Three budget lines quoted at both endpoints; any eager delta attributed
      to the byte
- [x] `npm run verify:static` exits 0 (21 gates)
- [x] `npm run verify:e2e` exits 0 (29 gates)
- [x] `verify:fit` · `verify:mobile` · `verify:perf-runtime` ·
      `verify:tracking` · `verify:memstats` exit 0
- [x] Rendered proof: mega-menu and ⌘K palette each showing seven views
      including Orbital, header reading 7, LOOKED AT
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```
cd app
npx tsc --noEmit
npm run build && node verify-bundle.mjs
npm run verify:static
node scripts/serve-dist.mjs &
npm run verify:e2e
npm run verify:fit && npm run verify:mobile && npm run verify:perf-runtime
npm run verify:tracking && npm run verify:memstats
```

## 7 · REPORT

status:
pr:
commits:
deps added:
deviations from spec:
notes for ARCHITECTURE.md patch:
open questions:

## 8 · LOOP FEEDBACK
