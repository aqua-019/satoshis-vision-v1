---
handoff: v1
project: XMR.IRISH
task_id: XMRIRISH-20260817-43
branch: claude/prompt-attached-d9y8cj
status: in_progress        # open -> in_progress -> done | blocked
written_by: claude-code (manual mode — task arrived as a prompt, p4·02)
owner: claude-code
---

# HANDOFF — p4·02 "THE MOBILE FOUNDATION": the type floor, the touch copy, and the gate with no exemptions

## 1 · GOAL

Every visible HTML text element on all fourteen canonical routes renders at 12px or
larger on a phone, and a wired gate makes that permanent. Today the site ships a
deliberate 11px floor on desktop and inherits it unchanged on a 390px phone, where
`.prov-tag`/`.prov-fresh` — the provenance markers that are this site's entire honesty
channel — render at **9.5px**. The two gates that claim to check this (`verify-peers`
§7, `verify-superstress` §8) pass by EXEMPTING the classes that fail.

When this is done: a `@media (max-width: 720px)` floor layer in `styles-legibility.css`
raises every sub-12px class to 12px at the tab-bar threshold; the rewritten
`verify-mobile.mjs` walks all fourteen routes at 390×844 with touch and asserts the
floor with **no class exemptions**, plus overflow, tab-bar targets, and bottom
clearance; the two exemption walkers are retired; user-visible copy no longer tells a
touch reader to "click" or "hover"; and the letter-spaced kicker no longer breaks
mid-word. The standing 11-vs-12px standards conflict is ADJUDICATED, in the stylesheet,
with the argument recorded where the next person will look.

## 2 · CONTEXT

- Prompt: `p402mobilefoundation.md` (attached to the session).
- Base: `5cf71f0`, the merge of p4·01 (#189). The prompt was authored at `81fafca`, so
  **every §0 figure is a claim about a different tree** and is re-confirmed in §7.
- CLAUDE.md standing items this closes or moves: the 11-vs-12px STANDARDS CONFLICT
  (Known Issues); `verify-peers` §7's dated "p4·02 replaces them wholesale" comment.
- Relevant files: `app/src/styles-legibility.css` (the floor layer, loaded LAST) ·
  `app/src/styles.css` (D0212's plain `@media (max-width: 720px)` precedent, and D1207's
  `@container navshell (max-width: 720px)`) · `app/verify-mobile.mjs` (EXISTS, 148 lines,
  ALREADY wired to npm + CI) · `app/verify-peers.mjs` §7 · `app/verify-superstress.mjs`
  §8 · `app/verify-bundle.mjs` (cssGz) · `app/src/layout/NavTop.tsx` (the `⌘K` chip).
- **Correction to the brief, load-bearing**: `verify-mobile.mjs` is NOT new. It exists
  and is wired to BOTH npm (`verify:mobile`) and `ci.yml`. §0.4's predicted census move
  (83→84 files / 79→80 gates / e2e 34→35 / CI 69→70) is therefore wrong as stated; the
  census is re-derived by controlled script in §7 rather than assumed.

## 3 · SCOPE

IN:
- `app/src/styles-legibility.css` — the ≤720px 12px floor layer + kicker wrap protection.
- `app/verify-mobile.mjs` — rewritten: 14 routes, no exemptions, five assertion families.
- `app/verify-peers.mjs` §7 · `app/verify-superstress.mjs` §8 — exemption lists retired.
- `app/src/layout/NavTop.tsx` — the `⌘K` chip's touch presentation at ≤720px.
- Copy sweep across `app/src/pages/**` for device-specific verbs in RENDERED strings.
- `app/verify-bundle.mjs` — the cssGz raise this PR crosses by design.
- `app/src/data/siteVersion.ts` — `SITE_PR` 189 → 190.
- CLAUDE.md session note + census + `handoffs/LOG.md`.

OUT (non-goals), each named because a "quick improvement" here prejudges later work:
- **No cockpit-view work.** The `.mp-fit` miniature problem (reactor et al. at 390) is
  p4·03's; its per-view decisions must not be pre-empted.
- No new routes. No new touch-interaction machinery for the synced-cursor instruments
  (p4·04). No BottomTabBar redesign — it measures good.
- `.dd` hover panels stay desktop-only (the tab bar covers sections on touch).
- Desktop's recorded 11px floor is NOT raised unless raising it proves free.
- SVG `<text>` and canvas glyph sizes are decided on measurement (see §7), not by
  reflex — an authored-space assertion over a transformed subject is a claim in the
  wrong space, and this repo has a recorded rule about that.

## 4 · CONSTRAINTS

- Stack: React 18 · Vite 5 · TS strict. Edit `app/src/**`; no hand-edited HTML.
- Reuse the D1207 **720px** threshold; do not mint a new breakpoint. Note it must be a
  plain `@media`, not `@container navshell` — `.main` is not a descendant of either
  navshell instance, which is exactly why D0212 already carves out one plain `@media`
  at that number.
- Zero fabricated values on live surfaces. Reduced-motion and noscript floors unchanged.
- No new dependencies.
- Two-polarity execution transcripts for every new/modified assertion; restores verified
  against the COMMITTED BLOB with a bracketed marker sweep; rebuild between restore and
  re-measure.
- Do not touch: `api/`, `relay/`, `vercel.json`.

## 5 · DONE-CRITERIA — the gate reads ONLY this section

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] All 14 canonical routes measure **0** visible HTML text elements under 12px at
      390×844 with touch (walker: element owns a text node, visible box, computed size),
      or every exception is named with a measured reason in §7
- [ ] `npm run verify:mobile` exits 0 and prints a terminal summary with a non-zero pass
      count and 0 failures
- [ ] `verify-mobile.mjs` contains NO class-exemption list for the type-floor assertion
      (bracketed absence-grep)
- [ ] Two-polarity transcript for each new gate assertion family: a mutation that reds it
      naming route + element, and the clean tree green
- [ ] `verify-peers.mjs` §7 and `verify-superstress.mjs` §8 carry no
      `pill`/`kicker`/`mono`/`dim2`/`prov-tag`/`prov-fresh` exemption list
- [ ] `npm run verify:static` exits 0
- [ ] `npm run verify:e2e` exits 0
- [ ] `node verify-bundle.mjs` exits 0, with the cssGz ceiling raised to built + ≤4,000
      and its comment re-derived AFTER the last `src/` commit
- [ ] Bracketed absence-grep: no rendered string in `app/src/**` instructs "click" or
      "hover" except the keepers argued in §7
- [ ] No mid-word break in any letter-spaced uppercase kicker on any of the 14 routes at
      390 AND 320 (measured by Range client rects, not by eye)
- [ ] Census RE-COUNTED by a script CONTROLLED against `e5eae16` (81/77/22/31/66) and
      `bda0491` (82/78/22/32/67) first; both CLAUDE.md census sites and the ci.yml step
      titles agree with the measurement
- [ ] Renders captured and LOOKED AT at 390 and 320: topbar, tab bar, one live view,
      /monero, /future, /operate/superstress, /about/sources
- [ ] `SITE_PR` = 190 and `logMax <= SITE_PR <= logMax + 1` holds
- [ ] Branch pushed · draft PR opened · `mergeable_state` reported

## 6 · VERIFY COMMANDS

```bash
cd app
npx tsc --noEmit
npm run build
node scripts/serve-dist.mjs &            # own port, holder confirmed by lsof
npm run verify:mobile
npm run verify:static
npm run verify:e2e
node verify-bundle.mjs
node verify-legibility.mjs
```

## 7 · REPORT

_(filled at write-back)_

## 8 · LOOP FEEDBACK

_(filled at write-back)_
