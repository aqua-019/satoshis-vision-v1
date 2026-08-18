#!/usr/bin/env node
/**
 * verify-coldboot.mjs — cold-boot FEATURE assertions (§2-§6) + Main Home legibility (§L).
 *
 * ── THIS GATE HOLDS THE FEATURE ASSERTIONS, AND RUNS LAST ────────────────
 *
 * §2-§6 (decrypt determinism, session gating, Enter handoff, reduced motion,
 * 390px) plus §L (Main Home legibility). These drive a canvas decrypt on a
 * timeline behind a click gate, so this is the likeliest flake in the suite —
 * last position is where that costs no other gate its result.
 *
 * ── THE POSITIVE CONTROL IS NOT HERE ANY MORE ────────────────────────────
 *
 * It moved to `verify-coldboot-live.mjs`, which runs FIRST. An earlier version
 * of this header described §1 as living here AND claimed "this gate runs FIRST
 * in that chain" — both false once the split landed, in the file the split
 * changed. Recorded rather than deleted, because it is the same defect class
 * this task kept finding: a confident artifact describing a tree that no
 * longer exists.
 *
 * The reason for the split, in one line: eleven gates assert `[data-coldboot]`
 * is ABSENT, an absence passes whether the bypass worked or the selector died,
 * and only a positive control separates those. Measured on the pre-split
 * chain — 27 entries, this gate at index 27, eleven dependents, ALL before it,
 * none after — so a failure here aborted only what came after, and nothing
 * did. Every dependent had already printed green. A precondition whose failure
 * makes eleven gates uninterpretable belongs first; feature assertions belong
 * last. Two axes, two positions, and conflating them is what got it wrong.
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
  const ctx = await holdOff(await browser.newContext({ viewport: { width: 1440, height: 900 } }));
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
  const ctx = await holdOff(await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts }));
  return { ctx, page: await ctx.newPage() };
};

/** Every context in this file drives the frame-zero hold to 0.
 *
 * The hold (gate.ts#CB_HOLD_MS) keeps #root at `visibility:hidden` for
 * a deliberate black beat before the sequence starts. This file's subject is
 * the SEQUENCE — the decrypt, the session gate, the handoff, reduce, 390px —
 * none of which is the beat. Sampling through it made §5 read `0 chars` and
 * report that reduce loses information, which is a statement about the sampling
 * point rather than about reduce.
 *
 * Zeroing it here is not hiding the hold: it is asserted where it belongs, in
 * verify-cbpending (statically, including that the arithmetic is a floor) and
 * verify-coldboot-live §1c (at runtime, both the default beat and the release).
 * The alternative — one hold's worth of sleep in each of this file's eight
 * sections — buys nothing. */
async function holdOff(ctx) {
  await ctx.addInitScript(() => { window.__xmriCbHoldMs = 0; });
  return ctx;
}

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
    const ctx = await holdOff(await browser.newContext({ viewport: { width: 1440, height: 900 } }));
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

  /* ── THE §5 CRITERION, NOW ASSERTABLE ──────────────────────────────────
   * This was an unconditional `R.skip` while `data-coldboot` carried an empty
   * value in every phase, which made replayed-decrypt and skipped-decrypt
   * DOM-identical. The root now carries "decrypt" | "console", so the states
   * are distinguishable and the skip has been replaced by the real assertion.
   *
   * Worth recording WHY the stale skip was a defect and not merely dead text:
   * it was a static call with no branch reading the DOM, so it reported the
   * identical message whatever the markup contained — a true-looking artifact
   * describing a tree that no longer existed, telling the next reader the
   * markup could not support an assertion it now supports. Same class as prose
   * contradicting its own diff.
   *
   * Order is load-bearing: direction 2 (clear → "decrypt") is what proves
   * direction 1 (reload → "console") measured GATING rather than a splash that
   * simply never returns. */
  const PHASES = ['decrypt', 'console'];
  const phaseNow = async (what) => {
    const decided = await page.waitForSelector(COLDBOOT_DECIDED_SEL, { timeout: 15_000 })
      .then(() => true).catch(() => false);
    if (!R.ok(decided, `${what}: ColdBoot published its decision before we read the phase`,
      'Reading data-coldboot on an unmounted element yields null — a confusing failure ' +
      'for the wrong reason, not a real verdict.')) return null;
    const v = await page.evaluate(() =>
      document.querySelector('[data-coldboot]')?.getAttribute('data-coldboot') ?? null);
    /* Assert membership, never `!== "decrypt"`. A typo, a third phase or ""
     * must go red rather than satisfy a negative by not being the bad value. */
    R.ok(PHASES.includes(v),
      `${what}: phase is one of ${JSON.stringify(PHASES)} (got ${JSON.stringify(v)})`,
      PHASES.includes(v) ? '' : 'unknown phase value — a negative assertion would have passed on this');
    return v;
  };

  // Direction 1 — reload inside the session: lands on the console, no decrypt.
  await page.reload({ waitUntil: 'load' });
  const afterReload = await phaseNow('after reload');
  if (afterReload !== null) {
    R.ok(afterReload === 'console',
      'reload within the session does NOT replay the decrypt (phase "console")',
      afterReload === 'console' ? '' :
        `phase is "${afterReload}" after reload — the session flag is not being honoured`);
  }

  // Direction 2 — clear the flag: the decrypt RETURNS. Without this, a splash
  // that simply never replayed would pass direction 1 for free.
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'load' });
  const afterClear = await phaseNow('after clearing the flag');
  if (afterClear !== null) {
    R.ok(afterClear === 'decrypt',
      'clearing the session flag RESTORES the decrypt (phase "decrypt") — proves direction 1 measured gating',
      afterClear === 'decrypt' ? '' :
        `phase is "${afterClear}" after clearing — direction 1 proved nothing`);
  }
  await ctx.close();
}

/* ══ §4 · ENTER HANDOFF — completes, and the orb TRAVELS ════════════════ */
R.group('── 4 · Enter handoff completes; the orb travels, not collapses ──');
{
  const { ctx, page } = await cold();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForSelector(COLDBOOT_SEL, { timeout: 15000 });

  /* THE CONSOLE IS WHAT PUBLISHES THE ORB'S RECT, and until it does, Orb.tsx
     renders `display:none` — for which `boundingBox()` returns null, not a box.
     So `before` below is only a statement about the orb once the console has
     mounted; taken at `[data-coldboot]` alone it is a statement about a race.
     Measured on this tree at 1440x900, five cold runs: the splash root appears
     at 27.5-59.6ms and the orb leaves display:none 0.9-23.2ms later. That window
     is small, and it is exactly wide enough to turn an always-green assertion
     into a usually-green one on a loaded runner.
     §7 of verify-orb.mjs waits on this same selector and calls it, correctly,
     "the console pane mounted (it is what publishes the orb rect)". */
  const consoleUp = await page.waitForSelector('[data-coldboot-console="ready"]', { timeout: 25_000 })
    .then(() => true).catch(() => false);
  R.ok(consoleUp, 'precondition: the console pane mounted, so the orb has been handed a rect to sit on',
    consoleUp ? '' : 'the console never reported ready; `before` below would be null because the orb is ' +
                     'display:none until it does, and the travel measurement would have no start point');

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

/* ══ §7 · THE CONSOLE IS REACHABLE — vertically, at every width ═════════
 *
 * Added after verify-orb's own SKIP reason turned out to contain a defect. That
 * skip records the console measuring 2282.6px tall in an 844px viewport at 390
 * wide, clipped by the stage's overflow:hidden — 63% of it, including the orb,
 * simply unreachable. Desktop scaled while mobile silently hid most of itself.
 *
 * Nothing checked this at ANY viewport. §6 asserts `scrollWidth - clientWidth
 * <= 0`, which is HORIZONTAL overflow only, under a heading that reads as
 * "usable at 390px" — a claim wider than its subject.
 *
 * Either outcome is acceptable and the assertion accepts both, because "fits"
 * and "scrolls" are both fine and only SILENT CLIPPING is not: the console
 * either fits the viewport, or it lives in a scroll container that can reach
 * its own bottom. What must never pass is content that is neither. */
R.group('── 7 · the console is reachable at every width (no silent clipping) ──');
{
  const { browser: b2 } = await launchChromium();
  for (const [label, vp] of [
    ['1440x900', { width: 1440, height: 900 }],
    ['1280x800', { width: 1280, height: 800 }],
    ['390x844', { width: PHONE.width, height: PHONE.height }],
  ]) {
    const ctx = await holdOff(await b2.newContext({ viewport: vp }));
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    const ready = await page.waitForSelector('[data-coldboot-console="ready"]', { timeout: 25000 })
      .then(() => true).catch(() => false);
    R.ok(ready, `${label}: precondition — the console mounted (else nothing below has a subject)`);
    if (!ready) { await ctx.close(); continue; }
    await page.waitForTimeout(1200);

    const m = await page.evaluate(() => {
      const root = document.querySelector('[data-coldboot-console]');
      const r = root.getBoundingClientRect();
      /* Walk up to whichever ancestor can actually scroll this content. */
      let sc = root.parentElement, scrollable = null;
      while (sc && sc !== document.body) {
        const oy = getComputedStyle(sc).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight + 1) { scrollable = sc; break; }
        sc = sc.parentElement;
      }
      return {
        vh: window.innerHeight, top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1),
        scrollable: scrollable ? `${scrollable.tagName}${scrollable.className ? '.' + String(scrollable.className).split(' ')[0] : ''}` : null,
        canReachBottom: scrollable ? scrollable.scrollHeight - scrollable.clientHeight : 0,
      };
    });

    const fits = m.top >= -1 && m.bottom <= m.vh + 1;
    const scrolls = m.scrollable !== null && m.canReachBottom > 0;
    R.ok(fits || scrolls,
      `${label}: the console is reachable — ${fits ? `fits the viewport (${m.h}px in ${m.vh}px, top ${m.top}, bottom ${m.bottom})` : `scrolls inside ${m.scrollable} (${m.canReachBottom}px of reachable overflow)`}`,
      fits || scrolls ? '' :
        `The console is ${m.h}px tall in a ${m.vh}px viewport, spanning ${m.top} to ${m.bottom}, and no ` +
        'ancestor scrolls. That much of it is CLIPPED and unreachable — the orb included. Either let it ' +
        'scroll or compress it to fit; silently hiding it is neither.');
    await ctx.close();
  }
  await b2.close();
}

/* ══ §8 · THE PANES CONFORM VERTICALLY — the mockup's three growers ══════
 *
 * The mockup gives each of the three console panes exactly ONE `flex:1` child;
 * production ported one (the orb stage). The LEFT output table and the CENTRE
 * log were hard `maxHeight: 220` boxes, so nothing in those columns could
 * absorb slack — the centre column ended where its content ended and ENTER, its
 * last child, ended with it. Measured on 63dc1a8: 723.9px of dead pane below
 * ENTER at 2560x1440, 363.9 at 1920, 200.4 at 1600, 195.7 at 1440, 105.7 at 1280.
 *
 * ── WHY NOT FOLDED INTO §7 ───────────────────────────────────────────────
 * §7's claim is REACHABILITY and it accepts both "fits" and "scrolls" by
 * design. A console with 364.9px of dead pane passes every §7 assertion, and
 * should — it is reachable. Different claim, different section.
 *
 * ── THE FLOORS ARE PARSED, NOT RESTATED ──────────────────────────────────
 * `ColdBootConsole.tsx` is JSX and cannot be imported by bare node, so the two
 * stacked constants are read out of its source — the idiom verify-orb uses for
 * ORB_RADIUS_FRAC. A copied number is a second definition kept in step by
 * nothing, and this section exists because two `220` literals shipped with
 * nothing pointing at either.
 *
 * ── deadPx HAS TWO PLAUSIBLE DEFINITIONS, 1px APART ──────────────────────
 * Subtracting padding alone and subtracting padding+border differ by exactly
 * the 1px pane border, which is why the same layout was reported both as
 * "dead space 1.0" and as "195.7 vs 196.7" during planning. This section uses
 * padding+border — the pane's own CONTENT bottom — and prints the definition
 * in the assertion, so a 1.0 that should read 0.0 is not mistaken for drift. */
R.group('── 8 · the panes conform vertically (log fills, ENTER on the floor) ──');
{
  const SRC = readFileSync(new URL('./src/coldboot/ColdBootConsole.tsx', import.meta.url), 'utf8');
  const num = (name) => Number((new RegExp(`\\b${name}\\s*=\\s*(\\d+)`).exec(SRC) || [])[1]);
  const LOG_MIN_STACKED_PX = num('LOG_MIN_STACKED_PX');
  const MATRIX_MAX_STACKED_PX = num('MATRIX_MAX_STACKED_PX');
  const ORB_SLOT_MIN_PX = num('ORB_SLOT_MIN_PX');
  const DEAD_TOL = 4;

  /* ── A SOURCE ASSERTION, AND IT SAYS SO ──────────────────────────────────
   * `useFeedEvents` PREPENDS (`useFeedEvents.ts:85`), so `events[0]` is the
   * NEWEST. Rendering that raw order into a bottom-anchored column pins the
   * OLDEST to the pane floor and pushes the newest up under the boot table —
   * making the header's "live tail" label less true, which is the opposite of
   * why the anchoring was adopted. `ColdBootConsole` reverses for render.
   *
   * This is checked in SOURCE rather than at runtime because it cannot be
   * checked at runtime HERE: `serve-dist` answers /api/* with 501, so the feed
   * never reaches the `ready && !stale` state the event differ requires and the
   * log holds boot lines only — measured, 12 lines and a "boot" header in every
   * run of this section. A mocked two-tick feed was attempted and did not reach
   * that state either. What IS measured at runtime below: the column is
   * bottom-anchored (last child's bottom == the log's bottom, 516.2 == 516.2 at
   * 1440x900). So the anchoring is proven and the ORDER fed into it is not;
   * this keeps the wiring from being deleted silently in the meantime. */
  const reverses = /useMemo\(\s*\(\)\s*=>\s*\[\s*\.\.\.\s*events\s*\]\s*\.reverse\(\)/.test(SRC);
  const mapsTail = /\{\s*tail\.map\(/.test(SRC);
  const mapsRaw = /\{\s*events\.map\(/.test(SRC);
  R.ok(reverses && mapsTail && !mapsRaw,
    'SOURCE: the log renders feed events oldest-first — ColdBootConsole reverses the prepended array and maps ' +
    `the reversed one (reverses ${reverses}, maps tail ${mapsTail}, maps raw events ${mapsRaw})`,
    'useFeedEvents.ts:85 prepends, so events[0] is the NEWEST. Bottom-anchored, the raw order puts the OLDEST ' +
    'on the pane floor. The mockup appends and slices(-80) — chronological ascending, newest last.');

  R.ok([LOG_MIN_STACKED_PX, MATRIX_MAX_STACKED_PX, ORB_SLOT_MIN_PX].every(Number.isFinite),
    `precondition: the layout constants parsed out of ColdBootConsole.tsx — LOG_MIN_STACKED_PX ` +
    `${LOG_MIN_STACKED_PX}, MATRIX_MAX_STACKED_PX ${MATRIX_MAX_STACKED_PX}, ORB_SLOT_MIN_PX ${ORB_SLOT_MIN_PX}`,
    'a failed parse yields NaN, and every comparison below is >= or <=, false for NaN — so the section fails ' +
    'CLOSED, but would name the wrong cause without this.');

  /* Measures the console once the layout has settled. `deadPx` is defined ONCE,
     here, and reported with its definition. */
  const measure = (page) => page.evaluate(() => {
    const root = document.querySelector('[data-coldboot-console]');
    /* SCOPED TO THE CONSOLE ROOT, never `document`. Main Home stays mounted
       underneath the splash for the whole console phase, so a document-wide
       lookup measures whichever node happens to come first in document order.
       None of these hooks exists on Home today — `button.proto-btn` there is a
       react-router <Link>, i.e. an <a> — but "no collision today" is not a
       property this file should depend on. */
    const q = (s) => (root ? root.querySelector(s) : null);
    const grid = q('[data-cb-grid]');
    const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]) || 0;
    const contentBottom = (pane) =>
      pane.getBoundingClientRect().bottom - px(pane, 'borderBottomWidth') - px(pane, 'paddingBottom');
    const hudPane = q('[data-cb-pane="hud"]'), logPane = q('[data-cb-pane="log"]');
    const log = q('[data-cb-log]'), matrix = q('[data-cb-matrix]'), enter = q('[data-cb-enter]');
    const slot = q('[data-orb-slot="coldboot-console"]');
    /* The line rows, found STRUCTURALLY — leaf divs carrying text — not as
       "the children of the log's first child". The wrapper this assertion
       exists to police is exactly the node a positional lookup would walk
       through, so a positional lookup reports "0 sampled" when the wrapper is
       removed instead of measuring the crush that removal causes. The vacuity
       guard below would still red, but for the wrong reason and with the wrong
       message: the seam would be redirecting the subject rather than falsifying
       the claim. Measured — this form reports 12.5px against a 20px
       line-height with the wrapper gone. */
    const lineNodes = log
      ? [...log.querySelectorAll('div')].filter((n) => n.children.length === 0 && (n.textContent || '').trim().length > 0)
      : [];
    const lines = lineNodes.slice(0, 6).map((n) => +n.getBoundingClientRect().height.toFixed(1));
    const lineHeightCss = lineNodes.length ? parseFloat(getComputedStyle(lineNodes[0]).lineHeight) : NaN;
    return {
      found: !!(root && grid && hudPane && logPane && log && matrix && enter && slot),
      branch: grid ? grid.getAttribute('data-cb-grid') : null,
      tracks: grid ? getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length : 0,
      rootH: root ? +root.getBoundingClientRect().height.toFixed(1) : 0,
      logH: log ? +log.getBoundingClientRect().height.toFixed(1) : 0,
      matrixH: matrix ? +matrix.getBoundingClientRect().height.toFixed(1) : 0,
      slotH: slot ? +slot.getBoundingClientRect().height.toFixed(1) : 0,
      logDead: logPane && enter ? +(contentBottom(logPane) - enter.getBoundingClientRect().bottom).toFixed(1) : NaN,
      hudDead: hudPane && matrix ? +(contentBottom(hudPane) - matrix.getBoundingClientRect().bottom).toFixed(1) : NaN,
      paneScrollOverflow: [hudPane, logPane].filter(Boolean).map((p) => p.scrollHeight - p.clientHeight),
      lines, lineHeightCss,
      paneInnerW: hudPane ? +(hudPane.getBoundingClientRect().width - 2 * px(hudPane, 'paddingLeft')).toFixed(1) : 0,
    };
  });

  const VIEWPORTS = [
    ['2560x1440', { width: 2560, height: 1440 }, 'wide'],
    ['1920x1080', { width: 1920, height: 1080 }, 'wide'],
    ['1440x900', { width: 1440, height: 900 }, 'wide'],
    ['1280x800', { width: 1280, height: 800 }, 'wide'],
    ['1100x900', { width: 1100, height: 900 }, 'stacked'],
    ['390x844', { width: PHONE.width, height: PHONE.height }, 'stacked'],
  ];

  for (const [label, vp, expected] of VIEWPORTS) {
    const { ctx, page } = await cold({ viewport: vp });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    const ready = await page.waitForSelector('[data-coldboot-console="ready"]', { timeout: 25000 })
      .then(() => true).catch(() => false);
    R.ok(ready, `${label}: precondition — the console mounted`);
    if (!ready) { await ctx.close(); continue; }
    await page.waitForTimeout(1200);

    const m = await measure(page);
    R.ok(m.found, `${label}: precondition — every measured hook is present (grid, both panes, log, matrix, ENTER, orb slot)`,
      m.found ? '' : 'a data-cb-* hook is missing, so the numbers below would be NaN rather than wrong');
    if (!m.found) { await ctx.close(); continue; }

    /* TWO-SIDED. The attribute is the branch matchMedia CHOSE; the track count
       is what the browser RESOLVED. Asserting only one lets a 390 run that
       silently resolved `wide` pass every height check below while the stacked
       branch — the one that reads 0.0px without its floor — is never run. */
    const branchOk = m.branch === expected && m.tracks === (expected === 'stacked' ? 1 : 3);
    R.ok(branchOk,
      `${label}: precondition — the layout branch agrees with the browser: data-cb-grid="${m.branch}", ` +
      `${m.tracks} resolved column track(s), expected "${expected}"`,
      `matchMedia chose "${m.branch}" and the browser resolved ${m.tracks} track(s). Every height assertion ` +
      'below describes one branch or the other, and this is what pins which.');

    R.ok(m.logH > 0 && m.matrixH > 0,
      `${label}: precondition — both scrollers have boxes (log ${m.logH}px, matrix ${m.matrixH}px)`,
      'a zero box makes every comparison below vacuously satisfiable');

    R.ok(m.slotH >= ORB_SLOT_MIN_PX,
      `${label}: the orb stage still clears its floor (${m.slotH}px against ORB_SLOT_MIN_PX ${ORB_SLOT_MIN_PX})`,
      `${m.slotH}px. Growing the other two panes must not come out of the orb's slot — that floor is what ` +
      'v6.1.9 derived to stop the canvas being starved to a 300x150 default.');

    if (expected === 'wide') {
      R.ok(m.logDead <= DEAD_TOL,
        `${label}: ENTER sits on the log pane's floor — ${m.logDead}px below it ` +
        `(deadPx = pane bottom − border-bottom − padding-bottom − ENTER's bottom; tolerance ${DEAD_TOL})`,
        `${m.logDead}px of dead pane below ENTER. The centre column has no grower, so its leftover height falls ` +
        'out of the bottom instead of being absorbed — measured 723.9px at 2560x1440 and 363.9 at 1920 before ' +
        'the log became `flex:1 1 0`.');

      R.ok(m.logH > 220,
        `${label}: the log grew past the old hard cap (${m.logH}px against the former maxHeight:220)`,
        `${m.logH}px. The 220 literal is what made the pane end where its content ended.`);

      /* TWO-SIDED on purpose. A NEGATIVE reading is content escaping the pane —
         PANE_STYLE sets no `overflow`, and the matrix's floor rose from an
         effective 0 to MATRIX_MIN_PX, so escape became possible where it was
         not. If this reds negative the fix is that floor or a pane overflow,
         never a looser tolerance. */
      R.ok(Math.abs(m.hudDead) <= DEAD_TOL,
        `${label}: the output table fills its HUD pane — ${m.hudDead}px from the pane floor (same deadPx definition)`,
        m.hudDead > DEAD_TOL
          ? `${m.hudDead}px of dead pane below the table; it is not absorbing its column's slack.`
          : `${m.hudDead}px — NEGATIVE, so the table is spilling PAST the pane border. PANE_STYLE declares no ` +
            'overflow, so that content is drawn outside its own box rather than clipped or scrolled.');
    } else {
      /* THE ASSERTION THAT WOULD HAVE CAUGHT THE COLLAPSE, and it is two-sided
         for a measured reason: a flex-basis-0 child of a content-height column
         reads 0.0px without this floor — but with `flex:1 1 auto` instead of
         `1 1 0` it reads 240 and a one-sided `>= floor-1` passes with the floor
         REMOVED. Both failure modes are on the same axis; only a band catches
         both. */
      R.ok(Math.abs(m.logH - LOG_MIN_STACKED_PX) <= 1,
        `${label}: stacked, the log holds its floor exactly — ${m.logH}px against LOG_MIN_STACKED_PX ` +
        `${LOG_MIN_STACKED_PX}`,
        m.logH < LOG_MIN_STACKED_PX - 1
          ? `${m.logH}px. Stacked, gridStyle gives the panes content height, and a flex-basis-0 child of a ` +
            'content-height column resolves to ZERO — measured 0.0px at both 1100x900 and 390x844 without the ' +
            'floor. The log disappears on phones and nothing else reports it.'
          : `${m.logH}px, ABOVE the floor. In a content-height column the floor should be exact; a larger ` +
            'reading means the basis is `auto` rather than `0`, which makes LOG_MIN_STACKED_PX inert — it ' +
            'would ship, cite its mockup line, be parsed here, and control nothing.');

      R.ok(m.matrixH <= MATRIX_MAX_STACKED_PX + 1,
        `${label}: stacked, the output table stays capped — ${m.matrixH}px against MATRIX_MAX_STACKED_PX ` +
        `${MATRIX_MAX_STACKED_PX}`,
        `${m.matrixH}px. Stacked the table is a non-grower by design; unbounded, it makes an already-tall ` +
        'phone console taller.');

      /* The crush. Line divs carry `overflow:hidden` for their ellipsis, which
         zeroes their flex automatic minimum — as direct flex items they COMPRESS
         instead of overflowing, and `scrollHeight === clientHeight` throughout,
         so nothing reports it. Measured at 390 without the wrapper: 12.5px
         rendered against a 20px computed line-height, a 37.5% crush. */
      const crushed = m.lines.filter((h) => h > 0 && h < m.lineHeightCss - 0.5);
      R.ok(m.lines.length > 0 && Number.isFinite(m.lineHeightCss) && crushed.length === 0,
        `${label}: log lines render at their own line-height — ${m.lines.join('/')} against a computed ` +
        `${m.lineHeightCss}px (${m.lines.length} sampled)`,
        m.lines.length === 0 || !Number.isFinite(m.lineHeightCss)
          ? 'no lines sampled, so this proved nothing — the log line host is missing or empty.'
          : `${crushed.length} line(s) shorter than the computed line-height: ${crushed.join('/')}. The lines ` +
            'are direct flex items of the log column and their own overflow:hidden zeroes their automatic ' +
            'minimum, so they are being compressed rather than clipped. scrollHeight === clientHeight while ' +
            'this happens, so no overflow check anywhere can see it. LOG_LINES_STYLE is the wrapper that ' +
            'makes them ordinary blocks inside one unshrinkable item.');
    }

    R.info(`${label}: console root ${m.rootH}px · log ${m.logH} · matrix ${m.matrixH} · orb slot ${m.slotH} · ` +
      `HUD pane inner width ${m.paneInnerW} · pane scroll overflow ${JSON.stringify(m.paneScrollOverflow)}`);
    await ctx.close();
  }

  /* ── THE GROWER ACTUALLY GROWS ────────────────────────────────────────
   * The strongest assertion here carries no layout number: a CAPPED box absorbs
   * exactly 0 of a viewport increase at any value of the cap, so the ratio
   * separates a grower from a cap without knowing what either measures.
   * Measured with the fix in place: dLog 164.0 at all three wide viewports for
   * a 180px increase, ratio 0.91. The 16px shortfall is structural — the centre
   * pane's histogram is `clamp(70px, 10vh, 106px)`, so 10vh goes 90 -> 108 and
   * clamps at 106, eating exactly 16. The clamp saturates at a 1060px viewport,
   * so above that the ratio is 1.00 and between ~700 and 1060 it is 0.91.
   * A `dMatrix === 0` guard was drafted alongside this and deleted: the matrix
   * is a grower too now (it absorbs its OWN pane's slack, measured +108-111px),
   * so asserting it absorbs nothing reds on a correct tree. That control belongs
   * to the break-test, where the cap is restored. */
  {
    const { ctx, page } = await cold({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    const ready = await page.waitForSelector('[data-coldboot-console="ready"]', { timeout: 25000 })
      .then(() => true).catch(() => false);
    R.ok(ready, 'resize: precondition — the console mounted at 1440x900');
    if (ready) {
      await page.waitForTimeout(1200);
      const before = await measure(page);
      await page.setViewportSize({ width: 1440, height: 1080 });
      await page.waitForTimeout(800);
      const after = await measure(page);
      const dLog = +(after.logH - before.logH).toFixed(1);
      const dVp = 180;
      const ratio = dLog / dVp;
      R.ok(before.found && after.found && ratio >= 0.5,
        `resize 900→1080: the log ABSORBS the new height — ${before.logH} → ${after.logH} (+${dLog}px of ` +
        `${dVp}, ratio ${ratio.toFixed(2)}, floor 0.50)`,
        `+${dLog}px of ${dVp}. A capped box absorbs exactly 0 at any value of the cap, which is what this ` +
        'separates. Measured with the grower in place: +164.0px, ratio 0.91 — the 16px shortfall is the ' +
        "histogram's clamp(70px, 10vh, 106px) saturating, not the log failing to grow.");
      R.info(`resize 900→1080: matrix ${before.matrixH} → ${after.matrixH} · orb slot ${before.slotH} → ${after.slotH}`);
    }
    await ctx.close();
  }
}

/* ══ §9 · THE PHONE BAND — no overprint, completes, ≥12px, no h-overflow ══
 *
 * ── THE BLIND SPOT THIS CLOSES, stated precisely ─────────────────────────
 * The splash was NOT un-tested below 1100 — §6/§7/§8 above already render at
 * 390, and §8 renders the stacked branch at 390 AND 1100. What none of them
 * asserted is that the stacked panes do not OVERPRINT each other. §6 checks
 * horizontal overflow only; §7 accepts "scrolls inside an ancestor" as
 * reachable BY DESIGN; §8 checks each pane's internal conformance. So a
 * console whose three panes overlap by 1288px — the operator's "wall of
 * overprinted glyphs" — passed every one of them green.
 *
 * The mechanism (fixed in ColdBootConsole.tsx#gridStyle): stacked, the grid is
 * `flex:1; minHeight:0; overflowY:auto`, so it has a DEFINITE height and its
 * three implicit `auto` rows were stretched to EQUAL fractions (~viewport/3),
 * crushing the `minHeight:0` panes into ~237px rows while their real content
 * (HUD 861 · LOG 590 · NETWORK 733) overflowed and overprinted the panes
 * below. `gridAutoRows: max-content` sizes each row to its pane's content, so
 * the panes stack cleanly and the grid scrolls.
 *
 * ── WHAT THIS ASSERTS, AND WHAT IT DELIBERATELY DOES NOT ─────────────────
 * It asserts AGAINST THE DEFECT: the three panes do not overlap. It does NOT
 * cap the console's height at N× the viewport. Three content-rich panes (chain
 * state + a ring diagram; a boot log; an orb stage) cannot fit one phone
 * screen no matter how they are laid out, so clean stacking legitimately needs
 * ~2.6 screens and HONEST vertical scroll is the right answer, not cramming.
 * A height cap would fight real content and reward the very crush this fixes —
 * and it inverts: the BROKEN tree's grid scrollHeight is SMALLER (overlap
 * compresses the layout to 1234px) than the FIXED tree's clean stack (2211px),
 * so a "height <= N×vh" gate would pass the bug and fail the fix. Overlap is
 * the only metric that discriminates: measured at base 1389/1288/1103px at
 * 360/390/430; fixed 0/0/0.
 *
 * The band is 360 (narrowest common Android) · 390 · 430 (largest iPhone). */
R.group('── 9 · the phone band: panes do not overprint (360/390/430) ────────');
{
  const PHONES = [
    ['360x800', { width: 360, height: 800 }],
    ['390x844', { width: PHONE.width, height: PHONE.height }],
    ['430x932', { width: 430, height: 932 }],
  ];

  const measure = (page) => page.evaluate(() => {
    const root = document.querySelector('[data-coldboot-console]');
    const grid = root ? root.querySelector('[data-cb-grid]') : null;
    const panes = grid ? [...grid.children]
      .filter((c) => c.getAttribute('data-cb-pane'))
      .map((c) => {
        const r = c.getBoundingClientRect();
        return { name: c.getAttribute('data-cb-pane'), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) };
      }) : [];
    /* pairwise vertical intersection of the stacked panes */
    let overlap = 0; const pairs = [];
    for (let i = 0; i < panes.length; i++)
      for (let j = i + 1; j < panes.length; j++) {
        const ov = Math.min(panes[i].bottom, panes[j].bottom) - Math.max(panes[i].top, panes[j].top);
        if (ov > 1) { overlap += ov; pairs.push(`${panes[i].name}~${panes[j].name} ${ov.toFixed(0)}px`); }
      }
    /* sub-12px HTML text (the house floor). SVG <text> presentation is measured
       separately — verify-legibility and verify-mobile §6 both hold SVG apart,
       and the ring's "INDISTINGUISHABLE" label is a known 11px SVG node. */
    let htmlSub12 = 0, svgSub12 = 0; const htmlOffenders = [];
    const cb = document.querySelector('[data-coldboot]');
    if (cb) for (const el of cb.querySelectorAll('*')) {
      const t = (el.textContent || '').trim();
      if (!t || el.children.length) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (!(fs < 12)) continue;
      if (el instanceof SVGElement) svgSub12++;
      else { htmlSub12++; if (htmlOffenders.length < 4) htmlOffenders.push(`${fs}px "${t.slice(0, 24)}"`); }
    }
    return {
      paneCount: panes.length,
      overlap: +overlap.toFixed(0), pairs,
      hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      consoleH: root ? +root.getBoundingClientRect().height.toFixed(0) : 0,
      gridScrollH: grid ? grid.scrollHeight : 0,
      htmlSub12, svgSub12, htmlOffenders,
    };
  });

  for (const [label, vp] of PHONES) {
    const { ctx, page } = await cold({ viewport: vp });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    /* Console mounts within a bound — proves the sequence REACHES the
       interactive console rather than hanging in the decrypt (the operator's
       "still showing at 11s"). It stays until Enter by design; §9c presses it. */
    const ready = await page.waitForSelector('[data-coldboot-console="ready"]', { timeout: 25_000 })
      .then(() => true).catch(() => false);
    R.ok(ready, `${label}: precondition — the console reached "ready" (the sequence completes to interactive)`,
      ready ? '' : 'the console never reported ready within 25s — nothing below has a subject');
    if (!ready) { await ctx.close(); continue; }
    await page.waitForTimeout(1400);

    const m = await measure(page);
    R.ok(m.paneCount === 3,
      `${label}: precondition — all three stacked panes are present (${m.paneCount})`,
      m.paneCount === 3 ? '' : 'a pane is missing, so the overlap sum below would be vacuously 0');
    if (m.paneCount !== 3) { await ctx.close(); continue; }

    /* THE DISCRIMINATING ASSERTION. Two-sided by construction: the sum prints
       either way, so a green run shows "0px" and cannot be mistaken for a
       vacuous pass. RED on the unfixed tree at 1389/1288/1103px. */
    R.ok(m.overlap <= 2,
      `${label}: the stacked panes do NOT overprint — total pane overlap ${m.overlap}px ` +
      `(console ${m.consoleH}px, grid content ${m.gridScrollH}px, honest scroll)`,
      m.overlap > 2
        ? `${m.overlap}px of pane overlap: ${m.pairs.join(', ')}. The stacked grid is crushing its ` +
          'min-height:0 panes into equal fractional rows while their content overflows and overprints the ' +
          'panes below — the "wall of glyphs". gridStyle needs gridAutoRows:max-content in the stacked branch.'
        : '');

    R.ok(m.hOverflow <= 0,
      `${label}: no horizontal overflow (scrollWidth − clientWidth = ${m.hOverflow})`,
      m.hOverflow > 0 ? `${m.hOverflow}px past the right edge` : '');

    R.ok(m.htmlSub12 === 0,
      `${label}: no HTML text under 12px in the splash (SVG <text> reported apart: ${m.svgSub12})`,
      m.htmlSub12 > 0 ? `${m.htmlSub12} HTML node(s) below 12px: ${m.htmlOffenders.join(', ')}` : '');

    await ctx.close();
  }

  /* ── §9b · reduced motion — content reachable, no rAF ──────────────────
   * The same phone that must not overprint must also be reachable with motion
   * off: no animation loop starts and the console still stacks cleanly. */
  {
    const { ctx, page } = await cold({ viewport: { width: PHONE.width, height: PHONE.height }, reducedMotion: 'reduce' });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    const ready = await page.waitForSelector('[data-coldboot-console="ready"]', { timeout: 25_000 })
      .then(() => true).catch(() => false);
    R.ok(ready, '390 reduced-motion: precondition — the console reached "ready"');
    if (ready) {
      await page.waitForTimeout(600);
      const rm = await page.evaluate(() => ({
        running: document.getAnimations().filter((a) => a.playState === 'running').length,
        ...(() => {
          const grid = document.querySelector('[data-cb-grid]');
          const panes = grid ? [...grid.children].filter((c) => c.getAttribute('data-cb-pane'))
            .map((c) => c.getBoundingClientRect()) : [];
          let ov = 0;
          for (let i = 0; i < panes.length; i++) for (let j = i + 1; j < panes.length; j++)
            ov += Math.max(0, Math.min(panes[i].bottom, panes[j].bottom) - Math.max(panes[i].top, panes[j].top));
          return { overlap: +ov.toFixed(0), panes: panes.length };
        })(),
      }));
      R.ok(rm.running === 0,
        `390 reduced-motion: no animation loop runs (${rm.running} running)`,
        rm.running > 0 ? `${rm.running} running animations under prefers-reduced-motion` : '');
      R.ok(rm.panes === 3 && rm.overlap <= 2,
        `390 reduced-motion: the console still stacks cleanly (${rm.panes} panes, overlap ${rm.overlap}px)`,
        rm.overlap > 2 ? `${rm.overlap}px overlap with motion off` : '');
    }
    await ctx.close();
  }

  /* ── §9c · the splash COMPLETES — Enter clears it and #root shows ──────
   * The splash is Enter-gated (it does not auto-dismiss); the operator's
   * concern was that it never clears. Assert the handoff works at 390: the
   * splash is removed and the real page (#root) becomes visible. */
  {
    const { ctx, page } = await cold({ viewport: { width: PHONE.width, height: PHONE.height } });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForSelector(COLDBOOT_SEL, { timeout: 15_000 });
    const rootHiddenFirst = await page.evaluate(() => {
      const r = document.getElementById('root');
      return r ? getComputedStyle(r).visibility : 'no-root';
    });
    await page.keyboard.press('Enter');
    await page.waitForSelector(COLDBOOT_DECIDED_SEL, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => {
      const r = document.getElementById('root');
      return {
        splash: document.querySelectorAll('[data-coldboot]').length,
        rootVisible: r ? getComputedStyle(r).visibility === 'visible' : false,
      };
    });
    R.ok(after.splash === 0 && after.rootVisible,
      `390: Enter completes the splash — it is removed (${after.splash}x) and #root is visible ` +
      `(was "${rootHiddenFirst}" during the splash)`,
      after.splash > 0 ? `splash still present ${after.splash}x after Enter`
        : 'splash cleared but #root did not become visible — a blank page, worse than the splash');
    await ctx.close();
  }

  /* ── §9d · the version stamp is DERIVED, and cannot rot ────────────────
   * The console header and the first boot-log line stamped a frozen `v6.1.8`
   * for ~24 releases — it rendered on a #194 site. The site's doctrine is that
   * release identity lives in SITE_PR (data/siteVersion.ts), so the stamp now
   * reads `SITE_VERSION`. This gate parses SITE_ERA/SITE_PR out of that source
   * — the §8 idiom, a copied number is a second definition kept in step by
   * nothing — builds the expected string, and asserts the splash renders it and
   * carries NO frozen `v6.1.<n>` literal. Break either half and this reds. */
  {
    const SV = readFileSync(new URL('./src/data/siteVersion.ts', import.meta.url), 'utf8');
    const era = (/export const SITE_ERA\s*=\s*"([^"]+)"/.exec(SV) || [])[1];
    const pr = (/export const SITE_PR\s*=\s*(\d+)/.exec(SV) || [])[1];
    const parsed = Boolean(era && pr);
    R.ok(parsed, `390 version: precondition — parsed SITE_ERA "${era}" and SITE_PR ${pr} from siteVersion.ts`,
      parsed ? '' : 'could not read the version constants; the assertion below would have no expected value');
    if (parsed) {
      const expected = `${era} · #${pr}`;
      const { ctx, page } = await cold({ viewport: { width: PHONE.width, height: PHONE.height } });
      await page.goto(BASE + '/', { waitUntil: 'load' });
      await page.waitForSelector('[data-coldboot-console="ready"]', { timeout: 25_000 });
      await page.waitForTimeout(600);
      const txt = await page.evaluate(() => (document.querySelector('[data-coldboot]')?.textContent || ''));
      const frozen = /v6\.1\.\d/.exec(txt);
      R.ok(txt.includes(expected) && !frozen,
        `390 version: the splash stamps the derived SITE_VERSION "${expected}" and no frozen literal`,
        !txt.includes(expected)
          ? `the splash does not render "${expected}" — the stamp is not derived from siteVersion.ts`
          : `a frozen version literal "${frozen ? frozen[0] : ''}" still renders in the splash — it will rot the next release`);
      await ctx.close();
    }
  }
}

await browser.close();

/* ── §Z · the wire STILL matches, at the end of the chain ─────────────────
 *
 * verify-coldboot-live's §0a/§0b prove commit -> disk -> wire at the moment
 * the chain STARTS. They say nothing about whether it held for the twenty-nine
 * gates after — and a mid-chain rebuild passes both and poisons everything
 * downstream. That is not hypothetical: it happened twice in this task, once
 * on each of two machines, both times by running `npm run build` while
 * serve-dist was serving. Vite clears dist/, the server dies on the missing
 * index.html, and every later gate measures a corpse at ERR_CONNECTION_REFUSED
 * or, worse, a DIFFERENT build at a healthy 200.
 *
 * Re-checking here brackets the run for the cost of one fetch. Start-and-end is
 * not continuous coverage, but it converts "the chain was sound when it began"
 * into "the chain was sound at both ends", which is the difference between a
 * claim about a moment and a claim about a run.
 *
 * ── WHAT THIS BRACKETS, HONESTLY — corrected in v6.1.9, RE-DERIVED in p4·01 ──
 * This docblock used to open "This file is LAST in verify:e2e". That was true
 * when it was written and is FALSE now: v6.1.9 moved `verify-vitals` to the end
 * (it had been sitting at #27 with this file and `verify-orb` as its only
 * downstream, so an environmental wall-clock red made the suite's own
 * subject-under-test unreachable).
 *
 * EVERY POSITION LITERAL BELOW WAS STALE UNTIL p4·01, and this is the paragraph
 * that instructed the re-read (see its last lines). It read "#27 this file ·
 * #28 verify-orb · #29 verify-vitals", "TWO gates run after it" and "27 of 29".
 * The chain has since grown by five members — p3·14b's verify-stream, p3·15's
 * verify-peers, p3·16's verify-superstress, p3·17's verify-releases-dom and
 * p3·18's verify-legality — so those four numbers had been describing a
 * nine-releases-ago chain. Measured from `package.json` rather than derived
 * from the previous text: the tail is now #31 this file · #32 verify-orb ·
 * #33 verify-stream · #34 verify-vitals, of 34.
 *
 * So the bracket covers #1 -> #31, not the whole chain. THREE gates run after
 * it and are outside it. That is accepted rather than papered over, for reasons
 * that are specific rather than general:
 *
 *   · The failure mode this guards is a rebuild DURING the run. Nothing in the
 *     three gates after this one builds — checked, not assumed: the only
 *     `npm run build` in verify-stream.mjs and verify-vitals.mjs is the usage
 *     line in each file's own header comment, and verify-orb.mjs has none. The
 *     hazard is a human or a second shell, and 31 of 34 gates' worth of
 *     exposure is where essentially all of it is.
 *   · `verify-orb` cannot pass vacuously against a broken server — every one of
 *     its §5/§6/§7 assertions reads the live DOM behind explicit preconditions,
 *     so a dead server reds it rather than skipping it quietly. `verify-stream`
 *     is the third member of that window since p3·14b and behaves the same way:
 *     it drives the served build through 18 assertions and starts no server of
 *     its own. A STALE-but-200 dist is the residual risk, and it is now THREE
 *     gates wide rather than two.
 *   · It was NOT moved into `verify-vitals` despite that gate being last again
 *     (p4·01 restored the vitals-last tail; between #183 and p4·01 the last
 *     member was verify-stream), because vitals exits 0 under `PERF_ASSERT=0`
 *     and `MEASURE_ONLY` — a wire check living there would be silently
 *     non-binding in two documented modes, which is worse than a bracket that
 *     is honestly three gates short.
 *
 * If the chain is reordered again, re-read this: the placement argument is the
 * thing that goes stale, and a docblock claiming a property the code no longer
 * has is the exact defect this release found twice.
 *
 * Same subject as §0b — the entry chunk resolved from dist/index.html, whose
 * bytes are a pure function of the source, never index.html itself. */
R.group('── Z · the served dist still matches, 31 gates in (see the note above) ──');
{
  const distIndex = new URL('./dist/index.html', import.meta.url);
  if (!existsSync(distIndex)) {
    R.ok(false, 'dist/index.html present for the end-of-chain wire re-check',
      'No local build to compare against — the chain cannot confirm what it measured.');
  } else {
    const localHtml = readFileSync(distIndex, 'utf8');
    const entry = (localHtml.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/) || [])[1] ?? null;
    R.ok(entry !== null, 'end-of-bracket: resolved the entry chunk from dist/index.html',
      entry !== null ? `${entry}` : 'shell shape changed — this re-check would compare nothing');
    if (entry) {
      const localJs = readFileSync(new URL(`./dist/assets/${entry}`, import.meta.url));
      let served = null, err = null;
      try {
        served = Buffer.from(await (await fetch(`${BASE}/assets/${entry}`)).arrayBuffer());
      } catch (e) { err = String((e && e.message) || e); }
      if (served === null) {
        R.ok(false, `end-of-chain: ${BASE} still answering for ${entry}`,
          `No response: ${err}. The server DIED during the run — every gate after that point ` +
          'measured nothing, and the ones before it are the only results worth reading.');
      } else {
        const same = served.equals(localJs);
        R.ok(same,
          `end-of-chain: the server is STILL serving this dist (${entry}, ${localJs.length} B)`,
          same ? '' :
            `DIST CHANGED MID-CHAIN: ${BASE} now answers ${served.length} B for ${entry}, local has ` +
            `${localJs.length} B. Something rebuilt or replaced the server while the chain ran, so an ` +
            'unknown number of the gates above measured a tree that is not this one. Re-run the whole ' +
            'chain; do not trust the passes above.');
      }
    }
  }
}

process.exit(R.finish());
