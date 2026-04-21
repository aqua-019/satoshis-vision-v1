# CLAUDE CODE QUICK-START GUIDE
## xmr.irish v4.0 — Session Setup + Model Selection
## Read this before opening any handoff document

---

## HOW TO USE THESE HANDOFFS

Each handoff is a self-contained work order. Open one at a time. Complete it fully before moving to the next. The MASTER-HANDOFF.md has the full context if Claude Code needs background.

**Paste at the start of each Claude Code session:**
```
You are working on xmr.irish — a static HTML Monero educational site.
Repo: github.com/aqua-019/satoshis-vision-v1
Your task is in the attached handoff document.
Read it completely before writing any code.
When in doubt, preserve content and match the visual style of markets.html.
Do not change any wording, only visual presentation and structure.
```

---

## MODEL SELECTION GUIDE

### Use Opus 4.5+ for:
- HANDOFF-02 (mining.html — 8 sections, 4 Canvas charts, complex rebuild)
- HANDOFF-03 (hold-monero — content restoration + new visualizations)
- HANDOFF-05 (bottom-line — 2765-line file, must preserve every word)
- HANDOFF-09 (Mempool 3.0 — complex three-mode architecture)

### Use Sonnet 4.6 for:
- HANDOFF-01 (infra — config edits)
- HANDOFF-04 (legal — three targeted fixes)
- HANDOFF-06 (typography batch — established pattern)
- HANDOFF-07 (trust system — CSS additions + light JS)
- HANDOFF-08 (homepage SEO — additive changes)

---

## SESSION STRUCTURE (recommended)

### Session 1: Foundation (Sonnet)
→ HANDOFF-01 (infra + route fixes)
→ Verify: visit xmr.irish/mining (clean URL), check CSP headers in DevTools

### Session 2: Biggest gap (Opus)
→ HANDOFF-02 (mining.html ground-up rebuild)
→ Read mining.html first, extract all content, rebuild, verify every section

### Session 3: Conversion page (Opus)
→ HANDOFF-03 (hold-monero content restoration + ChangeNOW widget)

### Session 4: Quick wins (Sonnet)
→ HANDOFF-04 (legal 3 fixes — 45 min max)
→ HANDOFF-07 (trust system CSS + citations)

### Session 5: Typography batch part 1 (Opus for bottom-line)
→ HANDOFF-05 (bottom-line — most important, most complex typography job)

### Session 6: Typography batch part 2 (Sonnet)
→ HANDOFF-06 (timeline + quotes + secrets + btc-xmr-education + ecosystem)
→ Do one page at a time, commit after each

### Session 7: Homepage upgrades (Sonnet)
→ HANDOFF-08 (homepage SEO + user paths)

### Session 8: Mempool 3.0 (Opus — long session)
→ HANDOFF-09 (full architecture rebuild — plan for 2-3 sub-sessions)
→ Part A: Mode switcher + TRACK mode enhancements
→ Part B: MARKET mode (fee depth chart, histogram, estimator)
→ Part C: OCEAN mode additions + relay feeds

---

## VERIFICATION CHECKLIST (run after each session)

```bash
# 1. Check for remaining d09 references
grep -rl 'd09.css' *.html

# 2. Check for remaining Playfair Display inline styles
grep -r "Playfair Display" *.html | grep 'style='

# 3. Check for genui-bar remnants
grep -rl 'genui-bar' *.html

# 4. Check all pages have no-referrer
grep -rL 'no-referrer' *.html

# 5. Verify clean URLs work (after vercel.json update)
curl -I https://xmr.irish/mining | grep -i location
```

---

## COMMON MISTAKES TO AVOID

1. **Changing content wording** — only pixels change, never words
2. **Using Google Fonts CDN** — fonts must be self-hosted from /fonts/
3. **Adding TradingView embeds** — Canvas 2D charts only
4. **Forgetting the referrer meta tag** — add to every page
5. **Making the stat cards text too small** — minimum 11px in cards
6. **Losing the benchmark data** — the 7 hardware benchmarks in mining.html must all survive
7. **Rebuilding legal.html from scratch** — it needs THREE surgical fixes, not a rebuild
8. **Changing bottom-line.html wording** — the writing is exceptional, do not touch it

---

## WHAT DONE LOOKS LIKE

Run this visual QA check after any page rebuild:

1. Open the page in Chrome
2. Open DevTools → Elements
3. Click on a headline element
4. In Computed Styles, verify `font-family` contains `JetBrains Mono`
5. If it shows `Playfair Display` or `Instrument Serif` → inline styles remain, fix them
6. Check that no `style=""` attributes contain font-family declarations
7. Verify the sub-nav breadcrumb is visible at the top
8. Resize to 375px width → confirm nothing overflows

---

## GIT COMMIT CONVENTION

```bash
# Format for each page rebuild:
git add [filename].html
git commit -m "feat: rebuild [page-name] with d10 design

- Strip all inline Playfair Display/Instrument Serif styles
- Apply JetBrains Mono via d10 class system
- Add hero eyebrow/title/subtitle structure  
- [specific additions: Canvas charts, new sections, etc.]
- All content preserved verbatim
- Verified mobile responsive at 375px"
git push origin main
```

---

## PHASE COMPLETION TARGETS

| Phase | Handoffs | Target |
|-------|----------|--------|
| A: Infra | 01 | Session 1 |
| B: Critical | 02, 03, 04 | Sessions 2–4 |
| C: Typography | 05, 06 | Sessions 5–6 |
| D: Enhancement | 07, 08 | Session 7 |
| E: Mempool 3.0 | 09 | Sessions 8–10 |

**v4.0 complete when:** All pages pass the visual QA check, Mempool 3.0 is live, and the Lighthouse score is 90+ performance / 95+ accessibility.
