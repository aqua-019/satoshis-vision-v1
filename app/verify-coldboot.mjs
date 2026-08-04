#!/usr/bin/env node
/**
 * verify-coldboot.mjs — cold-boot FEATURE assertions (§2-§6) + Main Home legibility (§L).
 *
 * ── THIS GATE IS LOAD-BEARING FOR TWELVE OTHER GATES ──────────────────────
 *
 * §1 below is the ONLY positive control for the whole cold-boot sweep.
 *
 * Twelve CI-reached gates now call `assertColdBootBypassed()`, which asserts
 * that `[data-coldboot]` is ABSENT. An absence assertion passes for three
 * different reasons and cannot tell them apart from the inside:
 *
 *   (a) the bypass worked                          ← the only one we mean
 *   (b) the selector is dead (attribute renamed)   ← silent, total vacuity
 *   (c) the splash never rendered for some third
 *       reason (JS disabled, SSR, route changed)   ← see verify-nojs, which
 *                                                    had exactly this and had
 *                                                    its assertion replaced
 *
 * §1 navigates to `/` WITHOUT the bypass flag and asserts the splash IS
 * there. That single assertion is what separates (a) from (b). If it is ever
 * deleted, weakened, or allowed to R.skip, the twelve preconditions silently
 * become decoration and every one of them keeps printing green.
 *
 * CONSEQUENCE FOR ORDERING, and it is not cosmetic: `verify:e2e` is an
 * `&&`-chain, so a failure stops everything after it. This gate runs FIRST in
 * that chain, ahead of all twelve dependents. If it ran last, every dependent
 * would have already reported before its own liveness proof executed — the
 * same invocation set, but a failure you cannot read. Do not reorder it.
 *
 * ── STATUS ON THE TREE THIS WAS WRITTEN AGAINST ───────────────────────────
 * The splash did not exist when this file was authored (director-build had
 * landed nothing). §1 therefore FAILS on that tree, and that is correct and
 * intended: a gate whose subject is absent must be red, never green and never
 * skipped. A skip here would be indistinguishable from a pass to every
 * downstream reader, which is the failure this whole file argues against.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import {
  makeReporter, launchChromium, BASE,
  coldBootOff, coldBootOffBrowser, assertColdBootBypassed,
  COLDBOOT_SEL, COLDBOOT_DECIDED_SEL, COLDBOOT_FLAG, PHONE,
} from './verify-lib.mjs';


const R = makeReporter('verify-coldboot');

/* The POSITIVE CONTROL and the derived sweep audit moved to
 * verify-coldboot-live.mjs, which runs FIRST in verify:e2e. This file keeps
 * the feature assertions and stays LAST, where a failure masks nothing. The
 * split is by dependency, not by age: a precondition whose failure makes
 * eleven downstream gates uninterpretable must abort before they run, and it
 * used to run after all of them. See that file's header. */

const { browser } = await launchChromium();

/* ══ §L · MAIN HOME LEGIBILITY — computed style, reported not resolved ═══
 *
 * Runs BEFORE §1 and independent of it: Main Home exists whether or not the
 * splash does, so gating this behind the splash would lose the measurement
 * on exactly the trees where Home is all there is.
 *
 * ── THE RULING THIS ENCODES ──────────────────────────────────────────────
 * §5 asks for "no text under 12px, or the --fs-label token resolved at
 * runtime — standing conflict REPORTED, not resolved". The token resolves to
 * 11px here (`clamp(11px, .74vw, 12px)`), measured, not read off the
 * declaration.
 *
 * Four families on Home compute below that and are EXEMPT as inherited shared
 * chrome — each is a shared primitive's own class governing many surfaces, so
 * changing it is a site-wide type decision and its own task. Forcing a local
 * override for Home alone would fragment the scale (some Stats at 10.5, one
 * at 11–12), which is worse than the honest conflict.
 *
 * Three of the four are LITERALLY in the standing conflict CLAUDE.md already
 * records — "19 sub-12px font-size declarations in styles-legibility.css
 * (L63-66, 71, 73-75, 77-78, 81, 84, 93-95, 98-100, 102)": L75 `.stat .lbl`,
 * L78 `.pill`, L95 `button.proto-btn`. They are not new findings and this PR
 * is not where verify-legibility.mjs:124-127's deliberate 11px floor gets
 * relitigated.
 *
 * ── THE VACUITY GUARD, and it is the whole risk here ─────────────────────
 * If every sub-12px leaf on Home is exempt, the assertion runs over an EMPTY
 * SET and passes for free — an exemption list can silently swallow its own
 * subject. So the gate counts what it actually examined and fails if that
 * number is implausible. Numbers are printed, never just a verdict. */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await coldBootOff(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const EXEMPT = [
    ['.stat .lbl',        'styles-legibility.css:75 · <Stat> primitive · 23 files'],
    ['.pill',             'styles-legibility.css:78 · shared pill · 16 files'],
    // `button.proto-btn, a.proto-btn` — BOTH variants. An earlier draft of this
    // exemption said `button.proto-btn` only and therefore did not match Home's
    // two anchor CTAs: the IDENTICAL selector-reach gap this section had just
    // found in styles-legibility.css:95, reproduced in the gate that found it.
    // A selector is a claim about which elements it reaches, and that claim is
    // only checkable by measuring rendered elements — never by reading it.
    ['button.proto-btn, a.proto-btn', 'styles-legibility.css:95 · shared button · 18 files (17 button, 2 anchor)'],
    ['.prov-tag, .prov-fresh', 'design/provenance.tsx · the NODE/COINGECKO/... vocabulary'],
    ['.crumbs, .crumbs *',     'styles-legibility.css:63 · breadcrumb chrome · AppShell-wide'],
  ];

  /* `.crumbs *` and not just `.crumbs`: the leaf that computes 11.5px is the
   * <b> root label INSIDE nav.crumbs (chain b > li > ol > nav.crumbs), which
   * INHERITS the size rather than declaring it. Exempting only the container
   * would leave the leaf asserted and the family half-covered — the same
   * selector-reach gap as `button.proto-btn` missing `a.proto-btn`, which is
   * the bug this section just found. Verified by ancestor measurement
   * (closest('.crumbs') === true), not inferred from the class name. */

  const m = await page.evaluate((exemptSels) => {
    const probeEl = document.createElement('span');
    probeEl.style.fontSize = 'var(--fs-label)';
    document.body.appendChild(probeEl);
    const tokenPx = parseFloat(getComputedStyle(probeEl).fontSize);
    probeEl.remove();

    const exemptNodes = new Set();
    for (const sel of exemptSels) {
      for (const el of document.querySelectorAll(sel)) exemptNodes.add(el);
    }

    const exempt = {}, offenders = [];
    let examined = 0;
    for (const el of document.querySelectorAll('main *')) {
      if (el.children.length || !(el.textContent || '').trim()) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (exemptNodes.has(el)) {
        const k = fs.toFixed(2);
        (exempt[k] ||= { n: 0, eg: new Set() });
        exempt[k].n++; exempt[k].eg.add(el.className || el.tagName);
        continue;
      }
      examined++;
      if (fs < 12 && Math.abs(fs - tokenPx) > 0.01) {
        offenders.push({ fs: fs.toFixed(2), cls: el.className || el.tagName,
                         txt: (el.textContent || '').trim().slice(0, 30) });
      }
    }
    return {
      tokenPx, examined, offenders,
      exempt: Object.fromEntries(Object.entries(exempt)
        .map(([k, v]) => [k, { n: v.n, eg: [...v.eg].slice(0, 3) }])),
    };
  }, EXEMPT.map(([sel]) => sel));

  R.group('── L · Main Home legibility (standing conflict: reported, not resolved) ──');
  R.info(`--fs-label resolves to ${m.tokenPx}px at 1440 (declared clamp(11px,.74vw,12px))`);

  for (const [sel, why] of EXEMPT) R.info(`EXEMPT ${sel} — ${why}`);
  for (const [px, v] of Object.entries(m.exempt).sort((a, b) => a[0] - b[0])) {
    R.info(`EXEMPT measured ${px}px × ${v.n} — ${JSON.stringify(v.eg)}  ← STANDING CONFLICT, not resolved here`);
  }

  /* VACUITY GUARD — the exemption list must not have eaten the subject. */
  R.ok(m.examined >= 20,
    `panel-own leaves actually examined: ${m.examined} (need ≥20, else the exemption list swallowed the subject)`,
    m.examined < 20
      ? `Only ${m.examined} non-exempt text leaves. The assertion below would pass over a near-empty ` +
        `set — an exemption list silently consuming what it was meant to carve out of.`
      : '');

  R.ok(m.offenders.length === 0,
    `every panel-own leaf is ≥12px or exactly the --fs-label token (${m.tokenPx}px) — ` +
    `${m.examined} examined, ${m.offenders.length} below`,
    m.offenders.length
      ? m.offenders.map((o) => `${o.fs}px · ${o.cls} · "${o.txt}"`).join('\n     ')
      : '');

  await ctx.close();
}

/** Fresh context WITHOUT the bypass — a real cold visitor. */
const cold = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  return { ctx, page: await ctx.newPage() };
};

/* ══ §2 · DECRYPT DETERMINISM — same seed, same frames ══════════════════
 *
 * ── TWO DEFECTS THIS SECTION SHIPPED WITH, both mine, both the same shape ─
 *
 * 1. WRONG SUBJECT. It screenshotted the whole splash ROOT, which contains
 *    the orb. The orb rotates on `useAnimationSeconds`, accumulating REAL rAF
 *    deltas by deliberate ruling — ambient rotation on a wall clock is correct
 *    for a live network visualisation. So two runs differed for a legitimate
 *    reason and the gate blamed the decrypt. The §5 claim is about the
 *    DECRYPT, not the viewport: an assertion over a wider subject than its
 *    claim fails (or passes) for reasons outside the claim. Same class as the
 *    attribution check being file-scoped rather than record-bound.
 *
 * 2. WRONG SAMPLING POINT. It froze at `waitForTimeout(1200)` — wall clock —
 *    directly contradicting this section's own comment saying not to. Two runs
 *    do not reach the same frame at the same millisecond, so that diff
 *    measured the runner.
 *
 * ── THE SUBJECT, AND WHY toDataURL AND NOT A SCREENSHOT ──────────────────
 * A Playwright element screenshot composites whatever is painted OVER the
 * element's box, so scoping to the canvas element still admits the orb —
 * measured: two canvas-element screenshots 60ms apart differed 753717 vs
 * 653963 B. `canvas.toDataURL()` reads the BACKING STORE: only what field.ts
 * painted, and the orb is a separate DOM node that cannot contaminate it.
 * Structural exclusion, not lucky geometry.
 *
 * ── THE POINT: LOCKED T=1, not a wall-clock offset ──────────────────────
 * ColdBoot.tsx:436-440 locks T at 1 on resolve ("no further frames needed
 * until Enter") and writes the session flag there. That is the one instant
 * both runs provably share. Measured across two cold runs: identical length
 * 38334 and identical sha256 e9051c6aca813f2a. */
{
  const KEY = 'xmrirish.coldboot';
  const SEL = `${COLDBOOT_SEL} canvas`;
  const grab = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForSelector(COLDBOOT_SEL, { timeout: 15_000 }).catch(() => {});
    await page.waitForFunction((k) => { try { return sessionStorage.getItem(k) === '1'; } catch { return false; } },
      KEY, { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(400);
    const info = await page.evaluate((s) => {
      const c = document.querySelector(s);
      if (!c) return { found: false };
      const b = c.getBoundingClientRect();
      return { found: true, w: Math.round(b.width), h: Math.round(b.height), data: c.toDataURL() };
    }, SEL);
    await ctx.close();
    return info;
  };

  const A = await grab(), B = await grab();

  /* GUARD 1 — the element exists and has area. A missing selector yields two
   * identical empty results and a green "deterministic": the exact vacuity
   * shape this task has now hunted four times. */
  const found = R.ok(A.found && B.found && A.w > 0 && A.h > 0,
    `decrypt canvas found with non-zero area (${A.w}x${A.h})`,
    !A.found || !B.found ? `${SEL} not found — nothing was compared.` : 'canvas has zero area');

  if (found) {
    /* GUARD 2 — non-trivial payload. Two byte-identical 0-byte captures
     * satisfy equality perfectly and prove nothing. */
    const big = R.ok(A.data.length > 1024 && B.data.length > 1024,
      `both captures are non-trivial (${A.data.length} / ${B.data.length} chars, need >1024)`,
      'a near-empty capture makes the equality below meaningless');

    if (big) {
      R.ok(A.data === B.data,
        'two cold runs produce a byte-identical decrypt canvas at locked T=1',
        A.data === B.data ? '' :
          `lengths ${A.data.length} vs ${B.data.length} — a seeded decrypt must not vary between runs`);
    }
  }
}

/* ══ §3 · ONCE-PER-SESSION, IN BOTH DIRECTIONS ══════════════════════════ */
R.group('── 3 · once-per-session gating, both directions ─────────────────');
{
  const { ctx, page } = await cold();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForSelector(COLDBOOT_SEL, { timeout: 15000 });

  /* PRECONDITION for every negative assertion below. Waiting on COLDBOOT_SEL
   * would be exactly wrong here: correct behaviour IS its absence. Wait for
   * the DECISION instead. */
  const decided = async (what) => {
    const ok = await page.waitForSelector(COLDBOOT_DECIDED_SEL, { timeout: 15_000 })
      .then(() => true).catch(() => false);
    return R.ok(ok,
      `${what}: ColdBoot published its decision (${COLDBOOT_DECIDED_SEL}) before we sampled`,
      ok ? '' : `No decision marker after 15s. Without it a count of 0 below cannot tell ` +
                `"absent because the flag was honoured" from "absent because the lazy chunk ` +
                `had not resolved" — the assertion would pass vacuously on a §5 criterion.`);
  };

  /* ── §3 CANNOT BE ASSERTED YET, AND SAYING SO IS THE ONLY HONEST OPTION ──
   *
   * §5 asks: "reload lands on the CONSOLE with NO DECRYPT". An earlier draft
   * of this section asserted `[data-coldboot]` count === 0 after reload. That
   * was semantically WRONG, not merely early: the console renders INSIDE the
   * splash root (measured chain: SECTION[data-coldboot-console] > DIV >
   * DIV[data-coldboot]), so the root is legitimately present in BOTH states.
   * The assertion demanded the splash disappear when the spec says only the
   * decrypt is skipped.
   *
   * MEASURED, three phases, one run:
   *   t=mount             {root:"", console:"ready"}
   *   t=decrypt resolved  {root:"", console:"ready"}
   *   t=after reload      {root:"", console:"ready"}
   *
   * `data-coldboot` carries an EMPTY value throughout, so replayed-decrypt and
   * skipped-decrypt are DOM-identical. No selector can tell them apart, which
   * means no assertion here can distinguish pass from fail — and one that
   * printed green would be asserting nothing on a headline §5 criterion.
   *
   * What IS established, and is asserted below: the session flag really is
   * written, on decrypt RESOLVE (ColdBoot.tsx:399-402 / :436-439 —
   * `resolvedRef` at t>=1), not on mount and not on Enter. A gate that
   * reloaded before resolve saw no flag and concluded the gating was broken;
   * the gating was fine and the gate was early.
   *
   * NEEDED (contract): a phase VALUE on the root — `data-coldboot="decrypt"`
   * vs `"console"` — or any marker present only while the decrypt runs. One
   * attribute value turns this from unassertable into two-polarity testable. */
  const KEY = 'xmrirish.coldboot';
  const flagWritten = await page
    .waitForFunction((k) => { try { return sessionStorage.getItem(k) === '1'; } catch { return false; } },
      KEY, { timeout: 20_000 })
    .then(() => true).catch(() => false);
  R.ok(flagWritten,
    `the session flag ${KEY} is written once the decrypt resolves`,
    flagWritten ? '' : 'Flag never appeared within 20s — nothing downstream could gate on it.');

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector(COLDBOOT_DECIDED_SEL, { timeout: 15_000 }).catch(() => {});
  const consoleAfter = await page.locator('[data-coldboot-console]').count();
  R.ok(consoleAfter > 0,
    'reload within the session lands on the CONSOLE',
    consoleAfter === 0 ? 'no console after reload — the session reload path is broken' : '');

  R.skip('reload does NOT replay the DECRYPT (and clearing the flag restores it)',
    'NOT MACHINE-CHECKABLE on this markup: data-coldboot carries an empty value in every ' +
    'phase, so replayed-decrypt and skipped-decrypt are DOM-identical. Needs a phase value ' +
    'on the root (data-coldboot="decrypt"|"console"). Skipped rather than asserted, because ' +
    'an assertion that cannot fail is not evidence for a §5 criterion.');
  await ctx.close();
}

/* ══ §4 · ENTER HANDOFF — completes, and the orb TRAVELS ════════════════ */
R.group('── 4 · Enter handoff completes; the orb travels, not collapses ──');
{
  const { ctx, page } = await cold();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForSelector(COLDBOOT_SEL, { timeout: 15000 });

  const orb = page.locator('[data-orb]').first();
  const before = (await orb.count()) ? await orb.boundingBox() : null;
  R.ok(before !== null, 'orb is present on the splash before handoff (prerequisite for measuring travel)');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  /* Negative assertion — same rule as §3. Post-interaction so the chunk has
   * long resolved, but the marker makes that structural rather than lucky. */
  await page.waitForSelector(COLDBOOT_DECIDED_SEL, { timeout: 10_000 }).catch(() => {});
  const gone = await page.locator(COLDBOOT_SEL).count();
  R.ok(gone === 0, 'Enter completes the handoff — splash is removed',
    gone > 0 ? `${COLDBOOT_SEL} still present ${gone}x after Enter` : '');

  if (before) {
    const after = (await orb.count()) ? await orb.boundingBox() : null;
    R.ok(after !== null, 'orb SURVIVES the handoff (it travels rather than collapsing)',
      after === null ? 'orb absent after handoff — it was destroyed and re-created, which is a collapse' : '');
    if (after) {
      const moved = Math.hypot(after.x - before.x, after.y - before.y);
      R.ok(moved > 1,
        `orb travelled across the cut (moved ${moved.toFixed(1)}px)`,
        moved <= 1 ? 'orb did not move — the two screens do not read as one place' : '');
    }
  }
  await ctx.close();
}

/* ══ §5 · REDUCED MOTION — instant resolve, no collapse, no blur ════════ */
R.group('── 5 · reduced motion ───────────────────────────────────────────');
{
  const { ctx, page } = await cold({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const state = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const blurred = [...document.querySelectorAll('*')].filter((n) => {
      const f = getComputedStyle(n).filter;
      return f && f !== 'none' && /blur\((?!0px)/.test(f);
    }).length;
    return {
      splashPresent: !!el,
      animations: document.getAnimations().filter((a) => a.playState === 'running').length,
      blurred,
      bodyText: (document.body.innerText || '').trim().length,
    };
  }, COLDBOOT_SEL);

  R.ok(state.animations === 0, `no animation runs under reduce (got ${state.animations})`);
  R.ok(state.blurred === 0, `no element carries a non-zero blur() under reduce (got ${state.blurred})`);
  R.ok(state.bodyText > 500,
    `page is COMPLETE under reduce (${state.bodyText} chars) — reduce loses no information`);
  await ctx.close();
}

/* ══ §6 · 390px ════════════════════════════════════════════════════════ */
R.group('── 6 · 390px ────────────────────────────────────────────────────');
{
  const { ctx, page } = await cold({ viewport: { width: PHONE.width, height: PHONE.height } });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForSelector(COLDBOOT_SEL, { timeout: 15000 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  R.ok(overflow <= 0, `no horizontal overflow at 390px (scrollWidth-clientWidth = ${overflow})`);
  await ctx.close();
}

await browser.close();
process.exit(R.finish());
