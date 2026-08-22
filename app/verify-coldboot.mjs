#!/usr/bin/env node
/**
 * verify-coldboot.mjs — cold-boot FEATURE assertions (§2-§11) + Main Home legibility (§L).
 *
 * ── THIS GATE HOLDS THE FEATURE ASSERTIONS, AND RUNS LAST ────────────────
 *
 * §2-§6 (decrypt determinism, session gating, Enter handoff, reduced motion,
 * 390px), §7-§8 (the console is reachable, the panes conform), §9 (the phone
 * band: p4·M1's stacked console), §10-§11 (p4·M4: the phone DECRYPT, and the
 * orb reaching the phone's Network slot) plus §L (Main Home legibility). These
 * drive a canvas decrypt on a timeline behind a click gate, so this is the
 * likeliest flake in the suite — last position is where that costs no other
 * gate its result.
 *
 * The range in the first line has been stale before — it read "§2-§6" while
 * §7, §8 and §9 were in the file. A header that names a subset of what runs is
 * the same narrower-subject defect this file records against its own
 * assertions, so it is corrected here rather than left.
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

/* ══ §10 · THE PHONE DECRYPT — the mark is a MESSAGE, not a WALL ═════════
 *
 * ── WHAT §9 COVERS AND WHAT IT DOES NOT ──────────────────────────────────
 * §9 (p4·M1) gates the CONSOLE on a phone: three stacked panes that do not
 * overprint. It never renders the DECRYPT PHASE that runs for several seconds
 * BEFORE the console, and nothing else does either — so the phase the operator
 * called "severely broken" was outside every one of this file's nine sections.
 *
 * ── THE DEFECT IS RASTER RESOLUTION, AND NAMING IT PRECISELY IS THE WHOLE
 *    REASON THIS SECTION ASSERTS WHAT IT ASSERTS ──────────────────────────
 * "Overprinted glyphs" is what it LOOKS like and is not what it IS: the field
 * is a cell grid and each cell holds exactly one glyph, so two glyphs cannot
 * occupy one cell by construction. What actually happened is that the wordmark
 * is a RASTER — `composeTarget` samples a drawn bitmap into cells — and on a
 * phone each letterform got EIGHT CELLS. Measured by rasterising the real grid
 * and reading the output as ASCII:
 *
 *     1440x900, one line   124 cols x 6 rows / 9 glyphs  =  83 cells/glyph  READS
 *      390x844, one line    38 cols x 2 rows / 9 glyphs  =   8 cells/glyph  noise
 *      390x844, two lines   47 cols x 12 rows / 9 glyphs =  63 cells/glyph  READS
 *
 * A two-row-tall mark is a smear whatever its font size, and that is why the
 * fix is a LAYOUT change (field.ts#WORDMARK_STACKED) rather than a scale: at
 * 2x cell size the mark gets 2.2 columns per glyph — WORSE — and at a smaller
 * cell it drops below MIN_CELL_PX, which is the 12px floor. Both directions of
 * "scale the field" are refuted by the arithmetic; the layout is the only free
 * variable. This is the p4·M1 lesson repeated: assert against the DEFECT, and
 * the defect is only assertable once you know what it is.
 *
 * ── HOW A CANVAS IS ASSERTED AT ALL ──────────────────────────────────────
 * It is not. `verify-legibility` reads inline `fontSize` and SVG attributes,
 * `verify-mobile` walks rendered elements, and a `drawImage` call is neither —
 * which is exactly how an 8-cells-per-glyph smear shipped past 84 gates.
 * `ColdBoot.tsx` publishes `window.__XMR_FIELD__` (gate.ts#FIELD_REPORT_GLOBAL),
 * the `__XMR_CLOVER__`/`__XMR_GOV__` idiom: the geometry that was drawn, read
 * from the same memoised object `drawField` used, so it cannot disagree with
 * the frame on screen.
 *
 * ── THE SECOND HALF: A SLOWER PHONE USED TO GET A LONGER SEQUENCE ────────
 * `ColdBoot`'s loop clamps its per-frame delta at 64ms, so a device that
 * cannot hit 15.6fps advances the progress ramp more slowly than the wall
 * clock. Measured at 390x844: 5,785ms unthrottled and 9,015ms under 6x CPU
 * throttle, against 5,745ms at 1440 — the phone was served the whole desktop
 * sequence, and a slow phone was served MORE of it. Both halves are bounded
 * below, and the wide stage carries a LOWER bound too, because "apply the
 * phone duration everywhere" would satisfy every upper bound in this section
 * while silently halving the desktop sequence. */
R.group('── 10 · the phone decrypt: the mark reads, and the sequence is bounded ──');
{
  /* Derived, not chosen. The narrow stage runs EFFECTIVE_NARROW_MS = 3,333ms
     with a 1.35x wall ceiling of 4,500ms, and this gate zeroes the frame-zero
     hold, so the flip lands at ~3,523ms (measured 3,557 / 3,523 / 3,545 at
     360 / 390 / 430). 4,800 is that plus the loop's own measured startup, and
     it reds on the 5,785ms the same tree took before this release. */
  const PHONE_FLIP_MAX_MS = 4800;
  /* The wide stage is bounded BOTH WAYS: 5,556ms nominal, measured 5,745-5,798
     before and after. Below 4,900 means the narrow duration leaked onto
     desktop; above 7,000 means the wide sequence grew. */
  const WIDE_FLIP_MIN_MS = 4900;
  const WIDE_FLIP_MAX_MS = 7000;
  /* The raster floor. Measured 53 / 63 / 74 at 360 / 390 / 430 after the fix
     and EIGHT at all three before it, against a 1440 control of 83. 40 sits in
     the empty gap between those two populations — it is not a target anyone
     tuned to, and the two are an order of magnitude apart. */
  const MIN_CELLS_PER_GLYPH = 40;
  /* Cells-per-glyph alone could in principle be satisfied by a very wide,
     very short mark, which is precisely the shape that failed. Rows is the
     independent axis that says the letterform has vertical structure at all:
     measured 11 / 12 / 13 after, TWO before, 6 on the 1440 control. */
  const MIN_MARK_ROWS = 8;
  /* See the ink assertion below for why the box figure is not the one asserted.
     Measured 22.6 / 26.9 / 34.2 at 360 / 390 / 430 after the fix and 4.8 / 4.0 /
     5.7 before it, against a 1440 control of 43.8. */
  const MIN_INK_PER_GLYPH = 15;

  /* ══ p4·M7 · WHY THE FOUR FIGURES ABOVE ARE FLOORS, AND WHAT THAT COST ══
   *
   * The brief that prompted this release put it exactly right about the SHAPE:
   * every assertion guarding this field asks "is there enough?" and none asks
   * "is there too much?" or "is there any background left?". It drew the wrong
   * conclusion from it — it said "a field that degenerates into a wall of noise
   * maximises all four", and that is not true of these four: `cellsPerGlyph`,
   * `inkPerGlyph`, `rows` and `glyphs` all come out of `composeTarget`, which
   * runs once per geometry and never sees a painted pixel. The wall could not
   * have moved them.
   *
   * What the wall DID do is sit outside their subject entirely. The defect was
   * `drawField` clearing `(0, 0, w, h)` in CSS pixels while blitting glyphs in
   * BACKING-STORE pixels: at dpr 2 it repainted the top-left quarter and the
   * other three accumulated every frame of the sequence. Nothing above reads a
   * pixel, and §10 runs at the context default of dpr 1 where the two spaces
   * coincide — so the gate was not merely blind to the wall, it was measuring
   * a device on which the wall does not exist.
   *
   * So the answer is not to put a ceiling on each of the four. Two of them get
   * a ceiling where a ceiling has content (below), and the real assertion is
   * §10e, which reads the canvas back.
   *
   * ── THE CEILINGS THAT HAVE CONTENT, AND THE UNIT THEY ARE IN ────────────
   * A raw ceiling on `cellsPerGlyph` cannot be written once for a band whose
   * measured values run 40 (320x568) to 113 (550x1000) — it would either be so
   * wide it asserts nothing or so tight it reds on an untested phone. The claim
   * worth making is stage-relative: THE MARK IS A MARK, NOT THE FIELD. Measured
   * across 144 stages (w 320-550 x h 560-1000) on the shipping tree:
   *     mark box / grid     0.126 .. 0.347      (1440x900 control: 0.125)
   *     mark rows / rows    0.167 .. 0.441      (1440x900 control: 0.174)
   * The ceilings sit above the measured envelope with room, because their job
   * is to catch a mark that has eaten the stage — the fit fraction restored to
   * full width, the margin deleted, the stacked layout replaced by one huge
   * line — not to re-litigate the tuning. */
  const MARK_SHARE_MAX = 0.45;
  const MARK_ROW_SHARE_MAX = 0.55;

  /* THE HONEST PER-LINE RESOLUTION. `mark.cols` is the width of the WIDEST
     LINE, so `cols / glyphs` charges one line's width to BOTH lines' letter
     count on a stacked mark and under-reports by the stacking factor: at 390 it
     reads 43/9 = 4.8 where "IRISH" really gets 43/5 = 8.6. field.ts publishes
     `mark.colsPerGlyph` against `mark.lineGlyphs` instead. Measured 7.8 / 8.6 /
     9.4 at 360 / 390 / 430, 7.2 at the 320 floor, 13.8 on the 1440 control —
     and 4.2 if the WIDE one-line composition ever leaks onto a phone, which is
     the failure this floor is really for. */
  const MIN_COLS_PER_GLYPH = 6.5;

  /* THE MARK IS NOT EDGE-TO-EDGE. In VISIBLE columns, because `layout.cols` is
     one more than the reader sees by design and a margin measured against it is
     inflated by a column nobody is shown. Measured min 4 across all 144 stages
     (field.ts#narrowMarginCols reserves 3-6 by width and the raster's own side
     bearing adds the rest); the pre-p4·M7 tree measures 3 at every width in the
     band, so this floor discriminates with a column to spare. */
  const MIN_MARK_MARGIN_COLS = 4;

  /* THE AMBIENT WEIGHT FIELD, corroborating §10e from the composition side. A
     narrow stage thins and dims ambient near the message and far from it;
     a wide stage gets EXACTLY 1.0 in every cell, which is what makes the
     desktop frame bit-identical. Measured 0.539 / 0.550 / 0.556 at 430 / 390 /
     360 and 0.578 at 320. If this moves and §10e's pixels do not, one of the
     two instruments is lying. */
  const AMBIENT_MEAN_BAND = [0.40, 0.75];

  /* How long to wait for the raster to report itself final. Measured: 900ms at
     1x, 3.1s at 6x CPU, 9.4s at 10x CPU (this file's own §10b rate) and 10.7s
     at Slow 4G + 10x. 15s clears the worst of those with room and, unlike the
     25s this started at, cannot dominate a stage that never settles. On the
     timeout the FIRST report is used instead of nothing, so the bands below
     still have a subject and the dedicated `markFontSettled` assertion names
     the failure. */
  const SETTLE_TIMEOUT_MS = 15_000;

  const PHONES = [
    ['360x800', { width: 360, height: 800 }],
    ['390x844', { width: PHONE.width, height: PHONE.height }],
    ['430x932', { width: 430, height: 932 }],
  ];

  /** Load `/` cold, read the published field report, and time the phase flip
   *  from `data-coldboot="decrypt"` to `"console"`. `cpu` throttles via CDP
   *  (Chromium only — this file already launches Chromium explicitly). */
  const runStage = async (vp, cpu = 0, dpr = 0) => {
    const { ctx, page } = await cold({ viewport: vp, ...(dpr ? { deviceScaleFactor: dpr } : {}) });
    if (cpu) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    }
    const t0 = Date.now();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    /* TWO WAITS, AND THE ORDER IS LOAD-BEARING — A BREAK TEST FOUND THIS.
       The first version of this block waited for the SETTLED report and took
       `publishedAt` from that instant, which quietly redefined `loopMs`: the
       comment below says "this instant is the loop's own start" and it had
       stopped being true, so §10b measured the loop MINUS the settle delay and
       its own ceiling got more permissive with nothing red. M4 (the host never
       reports the raster settled) is what exposed it — the timing assertions
       came back at 25,125ms against a 4,800ms bound, for a reason that has
       nothing to do with timing. Now the FIRST publish anchors the loop, the
       flip is timed by a promise started BEFORE the settle wait so that wait
       cannot be counted as part of the sequence, and the settled report is
       fetched afterwards purely to give the bands a determinate subject. */
    const first = await page.waitForFunction(() => window.__XMR_FIELD__ || null, null, { timeout: 25_000 })
      .then((h) => h.jsonValue()).catch(() => null);
    /* The report is published in the decrypt effect's setup, BEFORE the first
       rAF, so this instant is the loop's own start. `flipMs` measures the whole
       navigation (bundle + hold + loop) and `loopMs` measures only the loop —
       which is the quantity the wall ceiling actually bounds. */
    const publishedAt = Date.now();
    const flipAt = page.waitForFunction(
      () => document.querySelector('[data-coldboot]')?.getAttribute('data-coldboot') === 'console',
      null, { timeout: 30_000 }).then(() => Date.now()).catch(() => null);
    /* WAIT FOR THE SETTLED RASTER, NOT THE FIRST PUBLISH.
       `composeTarget` rasterises the wordmark through a canvas, and a canvas
       substitutes a fallback face SILENTLY for a webfont that has not loaded.
       Geist ships 400-700 and the mark asks for 800, so nothing on this route
       had ever fetched the face it resolves to — measured on the pre-p4·M7
       tree, the same stage published ink 237 at mount and 268 once the face
       arrived, with mark rows 6 -> 8 at 1440. Reading the first publish is
       reading a coin flip, which a floor survives and a BAND cannot.
       `markFontSettled` means the raster is FINAL, not that the font arrived —
       a load that fails is a settled outcome too, so this cannot hang on a
       missing face. */
    const report = await page.waitForFunction(
      () => (window.__XMR_FIELD__ && window.__XMR_FIELD__.markFontSettled ? window.__XMR_FIELD__ : null),
      null, { timeout: SETTLE_TIMEOUT_MS })
      .then((h) => h.jsonValue())
      .catch(() => first);
    const at = await flipAt;
    const flipped = at !== null;
    const now = at ?? Date.now();
    const flipMs = now - t0;
    const loopMs = now - publishedAt;
    const pending = await page.evaluate(() => document.documentElement.classList.contains('cb-pending'));
    await ctx.close();
    return { report, flipped, flipMs, loopMs, pending };
  };

  /** Every field §10 asserts on, as one comparable string. Derived from the
   *  report rather than listed at the call site so the invariance control and
   *  the assertions it justifies can never drift apart: a field added to §10
   *  and not to this is a field the control silently stops covering. */
  const geomOf = (r) => {
    const l = r.layout || {};
    const m = r.mark || {};
    return JSON.stringify({
      cols: l.cols, rows: l.rows, cw: l.cw, ch: l.ch,
      visibleCols: r.visibleCols, narrow: r.narrow, cells: r.cells,
      markMarginLeft: r.markMarginLeft, markMarginRight: r.markMarginRight,
      blockMarginLeft: r.blockMarginLeft, blockMarginRight: r.blockMarginRight,
      ambientMean: r.ambientMean, markLockFrom: r.markLockFrom,
      closingRowLocks: r.closingRowLocks, closingLine: r.closingLine,
      markRows: m.rows, markCols: m.cols, ink: m.ink,
      colsPerGlyph: m.colsPerGlyph, cellsPerGlyph: m.cellsPerGlyph, inkPerGlyph: m.inkPerGlyph,
    });
  };

  /* Collected across the stage loop so the ordering assertion below cannot go
     vacuous: a ONE-ROW closing line is trivially non-decreasing, and if every
     phone stopped wrapping, every per-stage check would pass while asserting
     nothing about the case that broke. */
  const closingShapes = [];
  /* Stashed so the dpr-invariance control below can compare against the very
     report these assertions were made on, rather than taking a second dpr-1
     reading and comparing two things neither of which was asserted. */
  let dpr1Geom = null;

  for (const [label, vp] of PHONES) {
    const { report, flipped, flipMs, pending } = await runStage(vp);

    /* PRECONDITION / VACUITY FLOOR. Every assertion below reads this object;
       without it they would all be `undefined`-comparisons, and a `>=` against
       undefined is false, which would look like a real red for the wrong
       reason. A missing hook is its own, named failure. */
    const ok = Boolean(report && report.layout && report.mark);
    R.ok(ok, `${label}: precondition — the field published __XMR_FIELD__ ` +
      (ok ? `(${report.layout.cols}x${report.layout.rows} cells, font ${report.layout.font}px)` : ''),
      ok ? '' : 'no field report — the decrypt either never ran or stopped publishing; nothing below has a subject');
    if (!ok) continue;

    const { layout, mark, narrow } = report;

    R.ok(narrow === true,
      `${label}: the narrow composition is engaged (stage ${layout.cols}x${layout.rows} cells)`,
      narrow ? '' : `narrow=false at ${vp.width}px — field.ts#isNarrowStage did not fire, so this stage is ` +
        'being composed for a wide viewport and the mark below is the desktop layout squeezed onto a phone');

    /* THE CANVAS TYPE FLOOR, ASSERTED FOR THE FIRST TIME. field.ts#MIN_CELL_PX
       says in its own docblock that "no gate enforces this constant; it is
       asserted by construction only" — because canvas text is invisible to
       every DOM legibility gate here. It is enforced now. */
    R.ok(layout.font >= 12,
      `${label}: the field's own glyphs are ${layout.font}px — at or above the 12px floor`,
      `${layout.font}px canvas glyphs. MIN_CELL_PX is 12 and a canvas is invisible to verify-legibility ` +
      'and verify-mobile, so this is the only place the floor is checked at all.');

    /* THE DISCRIMINATING ASSERTION. Two-sided by construction — the number
       prints on a pass, so a green run reads "63" and can never be mistaken
       for a vacuous one. RED at 8 on the pre-p4·M4 tree, at all three widths. */
    R.ok(mark.cellsPerGlyph >= MIN_CELLS_PER_GLYPH,
      `${label}: the wordmark rasters at ${mark.cellsPerGlyph} cells per glyph ` +
      `(${mark.cols} cols x ${mark.rows} rows over ${mark.glyphs} glyphs, floor ${MIN_CELLS_PER_GLYPH})`,
      mark.cellsPerGlyph >= MIN_CELLS_PER_GLYPH ? '' :
        `${mark.cellsPerGlyph} cells per glyph — a letterform in that many cells is a smear, not a letter. ` +
        `The mark is ${mark.cols}x${mark.rows} cells for ${mark.glyphs} glyphs. This is the "wall of glyphs": ` +
        'the message is drawn at a resolution the grid cannot carry, so it reads as more noise. Note that ' +
        'scaling the cells CANNOT fix it in either direction — bigger cells mean fewer columns and a worse ' +
        'raster, smaller cells break MIN_CELL_PX. See field.ts#WORDMARK.');

    /* THE SAME CLAIM IN THE UNIT THAT CANNOT BE GAMED. `cellsPerGlyph` is a
       BOUNDING BOX, and a box can be large and empty — the first version of
       this release quoted the box figure against an intuition about ink and
       overstated its own fix by 2.3x. Measured at 390: box 8 -> 63, INK
       4.0 -> 26.9, against a 1440 control of 82.7 box / 43.8 ink. 15 sits in
       the empty gap between the two populations. */
    R.ok(mark.inkPerGlyph >= MIN_INK_PER_GLYPH,
      `${label}: the mark inks ${mark.ink} cells — ${mark.inkPerGlyph} per glyph ` +
      `(floor ${MIN_INK_PER_GLYPH}; box figure ${mark.cellsPerGlyph})`,
      `${mark.inkPerGlyph} lit cells per letterform. The bounding box can be generous and the raster still ` +
      'empty, which is why this is asserted in ink and the box figure is only printed beside it.');

    R.ok(mark.rows >= MIN_MARK_ROWS,
      `${label}: the mark is ${mark.rows} cell-rows tall (floor ${MIN_MARK_ROWS}, of ${layout.rows} available)`,
      `${mark.rows} rows. A mark this short has no vertical structure to read — the independent axis to ` +
      'cells-per-glyph, so a very wide very short mark cannot satisfy one by failing the other.');

    /* ── THE OTHER SIDE OF BOTH FLOORS (p4·M7) ──────────────────────────
       Stage-relative, because the raw figures legitimately run 40..113 across
       the phone band and no single raw ceiling can be both meaningful and safe
       there. The claim is that the mark is a MARK: it may not eat the field. */
    const boxShare = (mark.rows * mark.cols) / (layout.rows * layout.cols);
    const rowShare = mark.rows / layout.rows;
    /* SPLIT, and the split is the point. These were ONE assertion joined by
       `&&` until p4·M7's post-merge review, which is why neither had a
       demonstrated polarity: a conjunction can only ever be shown to red as a
       conjunction, so "both ceilings are exercised" was unprovable however many
       mutations were run. They measure different things — AREA against the
       whole grid, and HEIGHT against the row count — and a mark can breach
       either alone. Two assertions, two break tests, two answers. */
    R.ok(boxShare <= MARK_SHARE_MAX,
      `${label}: the mark's box is ${(boxShare * 100).toFixed(1)}% of the grid ` +
      `(ceiling ${(MARK_SHARE_MAX * 100).toFixed(0)}%)`,
      `${(boxShare * 100).toFixed(1)}% of the grid. The mark has stopped being a mark and become the field — ` +
      'the fit fraction has been restored to the full stage width, the margin reserve has been removed, or ' +
      'the stacked layout has been replaced by one very large line. See field.ts#narrowMarginCols and ' +
      'field.ts#fitFrac.');

    R.ok(rowShare <= MARK_ROW_SHARE_MAX,
      `${label}: the mark is ${(rowShare * 100).toFixed(1)}% of the grid's rows ` +
      `(ceiling ${(MARK_ROW_SHARE_MAX * 100).toFixed(0)}%)`,
      `${(rowShare * 100).toFixed(1)}% of the rows. A stacked mark that keeps growing pushes the cipher block ` +
      'off the bottom of the stage — the `row < rows - 1 - signerRows.length` guard then silently drops the ' +
      'closing line rather than overflowing, so this reds BEFORE the sequence loses its own payoff. See ' +
      'field.ts#px, whose narrow branch is a fraction of the stage HEIGHT.');

    R.ok(mark.colsPerGlyph >= MIN_COLS_PER_GLYPH,
      `${label}: each letterform of the widest line gets ${mark.colsPerGlyph} cell columns ` +
      `(${mark.cols} cols over ${mark.lineGlyphs} glyphs, floor ${MIN_COLS_PER_GLYPH})`,
      `${mark.colsPerGlyph} columns per letterform. This is the HORIZONTAL resolution of the raster, measured ` +
      'against the widest LINE rather than against every glyph in a stacked mark. Below ~5 a letterform is a ' +
      'bar. A reading near 4 means the WIDE one-line composition is being drawn on a phone.');

    /* THE MARK IS NOT EDGE-TO-EDGE. `min` of the two, so a mark that is
       centred-but-overhanging on one side cannot be rescued by the other. */
    const margin = Math.min(report.markMarginLeft, report.markMarginRight);
    R.ok(margin >= MIN_MARK_MARGIN_COLS,
      `${label}: the mark clears both edges — ${report.markMarginLeft} / ${report.markMarginRight} of ` +
      `${report.visibleCols} visible columns (floor ${MIN_MARK_MARGIN_COLS})`,
      `${report.markMarginLeft} / ${report.markMarginRight} visible columns of clearance. The message runs into ` +
      'the edge of the stage with ambient scramble pressing on the letterforms at the same size and the same ' +
      'tint. Measured at 3 on the pre-p4·M7 tree at every width in this band.');

    /* THE BLOCK IS MARGINED TOO, AND IT IS A SEPARATE CLAIM. The wordmark's
       fit and the cipher block's left edge are computed by different code paths
       off the same reserve, so one can be inside the margin while the other
       runs to the edge — which is what the pre-p4·M7 tree did: mark at column 3
       and the closing line reaching column 53 of 54. The ladder in
       field.ts#SIGNER_FORMS is measured against the MARGINED width on a narrow
       stage precisely so this holds; measuring it against the visible width
       instead restores rung 1 and pushes the block back out to the edge with
       every other assertion here still green. */
    const blockMargin = Math.min(report.blockMarginLeft, report.blockMarginRight);
    R.ok(blockMargin >= MIN_MARK_MARGIN_COLS,
      `${label}: the cipher block clears both edges — ${report.blockMarginLeft} / ${report.blockMarginRight} ` +
      `of ${report.visibleCols} visible columns (floor ${MIN_MARK_MARGIN_COLS})`,
      `${report.blockMarginLeft} / ${report.blockMarginRight} visible columns. The block runs to the edge of ` +
      'the stage while the mark above it does not — the closing-line ladder is being fitted to the full ' +
      'visible width rather than to the margined one. See field.ts#SIGNER_FORMS.');

    /* THE RASTER IS FINAL. `markFontSettled` is set once the face the wordmark
       rasters with has settled — loaded or failed, both of which are final
       outcomes — so it is ALWAYS true on a healthy host and asserting it costs
       nothing. Without it, removing the wait leaves every band above reading a
       fallback-face raster that still sits inside its band, and nothing says so. */
    R.ok(report.markFontSettled === true,
      `${label}: the wordmark raster is final (markFontSettled) — every band above has a determinate subject`,
      'the field never reported a settled raster, so the numbers above describe whichever font happened to be ' +
      'resident when composeTarget ran. See field.ts#ensureMarkFont.');

    /* ── AND IT LANDS BEFORE THE MARK BEGINS TO READ ────────────────────
       ASSERTED RATHER THAN FENCED, and that is a decision with an argument.
       `ensureMarkFont`'s geometry rebuild is unconditional in T, so the raster
       always ends up in the settled face — the DETERMINISM is safe either way.
       What is not safe is the ORDER: a rebuild after the mark has started
       resolving is a wordmark that visibly thickens while a reader is reading
       it. Measured, T at the rebuild: 0.015 at 1x, 0.181 at 6x CPU, 0.316 at
       10x and 0.388 at Slow 4G + 10x, against a MEASURED first lock of 0.318
       (`field.ts#markLockFrom`; an earlier draft of this block said 0.241,
       which is the theoretical floor of `composeTarget`'s cls-1 expression at
       t=0 and not a value any real cell takes — the assertion below reads the
       published number and restates neither side).

       So the margin at 1x is wide and it is ALREADY CROSSED under throttle —
       which is exactly why this is an assertion and not a comment. Fencing the
       rebuild instead would leave the slow device with a mark rastered in a
       face nobody chose, permanently, and would make `markFontSettled` a lie.
       BOTH SIDES ARE PUBLISHED (`markFontSettledAtT`, `markLockFrom`), so this
       restates neither and cannot drift from the composition.

       STATED BLIND SPOT: the three stages here run UNTHROTTLED. §10b throttles
       at 10x and deliberately does not make this claim, because the measured
       0.316 there is a known, accepted crossing rather than a regression. What
       this catches is the 1x margin closing — a mark whose first lock moves
       earlier, or a font path that starts resolving late on an ordinary
       device. */
    const settledAtT = Number(report.markFontSettledAtT);
    R.ok(settledAtT < report.markLockFrom,
      `${label}: the raster settles at T=${settledAtT.toFixed(3)}, before the mark's own first lock at ` +
      `T=${report.markLockFrom} (margin ${(report.markLockFrom - settledAtT).toFixed(3)})`,
      `the raster settled at T=${settledAtT.toFixed(3)} against a first lock of ${report.markLockFrom}. The ` +
      'wordmark begins resolving out of the scramble and THEN changes shape, because the face it rasters with ' +
      'arrived late. See field.ts#ensureMarkFont for the measured table and ColdBoot.tsx for why the rebuild ' +
      'is unconditional rather than fenced.');

    R.ok(report.ambientMean >= AMBIENT_MEAN_BAND[0] && report.ambientMean <= AMBIENT_MEAN_BAND[1],
      `${label}: the ambient weight field means ${report.ambientMean} ` +
      `(band ${AMBIENT_MEAN_BAND[0]}-${AMBIENT_MEAN_BAND[1]} — a clearing round the message and a fade far from it)`,
      report.ambientMean > AMBIENT_MEAN_BAND[1]
        ? `${report.ambientMean} — the narrow stage is getting the wide stage's undifferentiated field. ` +
          'There is no clearing round the message and no empty space under the cipher block.'
        : `${report.ambientMean} — the field has been thinned past a texture. The clear fix already restored ` +
          "density parity with the desktop; thinning on top of it corrects the same defect twice.");

    /* THE PAYOFF SENTENCE SURVIVES THE GRID.
       The line the whole sequence closes on is `signer_index ??? — NOT ENCODED
       IN THE PROTOCOL`, and on a 360px stage it was placed one character wider
       than the reader can see, so it rendered "...IN THE PROTOCO" — a sentence
       about what the protocol does not encode, cut mid-word, on the narrowest
       device. Read back OUT of the composed grid (field.ts#readRow) over the
       fully visible columns, so this is the text a reader gets rather than the
       text the code intended. A trailing-word check, not a length check: the
       narrow stage legitimately ships a shorter form of the line with the
       padding runs squeezed and every WORD verbatim. */
    const closing = String(report.closingLine || '');
    R.ok(/PROTOCOL$/.test(closing.trimEnd()) && /signer_index/.test(closing),
      `${label}: the closing line is placed intact — "${closing.trimEnd().slice(-34)}"`,
      closing.trim().length === 0
        ? 'the closing line is EMPTY — it was never placed, so nothing here is being checked'
        : `the grid holds "${closing.trimEnd()}". The sequence's closing claim is cut off at the right edge: ` +
          'putLine drops any cell outside [0, cols) and layoutField returns one more column than the viewport ' +
          'shows, so a line that "fits in cols" can still lose its last characters. See ' +
          'field.ts#SIGNER_FORMS — the ladder of forms, widest first, and field.ts#narrowMarginCols, which is ' +
          'what the ladder is measured against on a narrow stage.');

    /* THE CLOSING LINE RESOLVES IN READING ORDER, TOP ROW FIRST.
       `signerFit` measures the ladder against the MARGINED width on a narrow
       stage, so a phone now takes a WRAPPED rung where it used to take a
       one-row one — and the schedule case that puts the closing line last was
       keyed on the block's FIRST row alone. Every later row fell into the
       generic branch, which resolves EARLIER: measured at 390x844 the payoff
       row "── NOT ENCODED IN THE PROTOCOL" locked over [0.373, 0.478] against
       an intro row locking uniformly at 0.502, so the reader watched the answer
       appear and then the question. Nothing caught it — every assertion here
       reads the closing line's TEXT, and the text was perfect.

       Read as a SERIES rather than a pair so a three-row form is covered too,
       and MEASURED off `lockAt` in field.ts rather than restated from the
       schedule, so a change to the schedule moves this number.

       BLIND SPOT, stated: this does NOT assert the closing line locks last of
       all text. It does not — KICK, SUB1 and the block header take the generic
       branch, whose jitter term can carry a cell past 0.502. The claim being
       made is the narrower true one: the closing block resolves in its own
       reading order. */
    const locks = Array.isArray(report.closingRowLocks) ? report.closingRowLocks.map(Number) : [];
    closingShapes.push([label, locks.length]);
    if (label === '390x844') dpr1Geom = geomOf(report);
    const descending = locks.findIndex((v, i) => i > 0 && v < locks[i - 1]);
    R.ok(locks.length > 0 && descending === -1,
      `${label}: the closing line resolves top row first — locks [${locks.join(', ')}] over ${locks.length} row(s)`,
      locks.length === 0
        ? 'the closing line reported NO rows, so its lock order is unchecked — field.ts#closingRowLocks is empty, ' +
          'which means the block was never placed'
        : `the closing line resolves OUT OF ORDER: locks [${locks.join(', ')}], row ${descending} at ` +
          `${locks[descending]} lands before row ${descending - 1} at ${locks[descending - 1]}. The sentence the ` +
          'sequence closes on appears before its own opening row. See field.ts#closingOrd — every row the block ' +
          'occupies must carry the closing case, not just its first.');

    /* THE SEQUENCE ENDS. `flipped` is the structural half — a sequence that
       never hands off is the fail-closed case, and it is asserted before the
       timing so a hang reads as a hang rather than as a slow run. */
    R.ok(flipped, `${label}: the decrypt hands off to the console (phase reached "console")`,
      'the sequence never left the decrypt phase within 30s — the reader is trapped on the field');
    if (!flipped) continue;

    R.ok(flipMs <= PHONE_FLIP_MAX_MS,
      `${label}: decrypt -> console in ${flipMs}ms (bound ${PHONE_FLIP_MAX_MS}ms)`,
      `${flipMs}ms on a phone. The narrow stage runs EFFECTIVE_NARROW_MS; this reads like the wide ` +
      "stage's 5,556ms, i.e. a phone being served the whole desktop sequence.");

    /* FAIL OPEN. `cb-pending` hides #root behind an opaque floor; if it is
       still on the root once the console is up, a JS-enabled phone is looking
       at a black page with the splash's own content invisible beneath it. */
    R.ok(pending === false,
      `${label}: the frame-zero floor is released (html has no .cb-pending once the console is up)`,
      'html still carries .cb-pending — #root is hidden behind the anti-flash floor. A permanently blank ' +
      'phone is worse than any wall; index.html carries three independent removers and none of them ran.');
  }

  /* THE ORDERING CHECK ABOVE IS ONLY WORTH ANYTHING IF SOMETHING WRAPS.
     A one-row closing line is non-decreasing by construction, so without this
     floor every stage could stop wrapping and all three per-stage assertions
     would go green while the case that actually broke went unexercised — the
     shape this repo keeps re-recording, an assertion that is true about the
     wrong subject. 360 and 390 take a wrapped rung and 430 takes a one-row
     one, so the stage set carries BOTH paths and is asserted to. */
  const wrapped = closingShapes.filter(([, n]) => n >= 2);
  const single = closingShapes.filter(([, n]) => n === 1);
  const shapeText = closingShapes.map(([l, n]) => `${l}:${n}`).join(' ');
  R.ok(wrapped.length > 0 && single.length > 0,
    `the stage set exercises BOTH closing forms — wrapped ${wrapped.length}, one-row ${single.length} (${shapeText})`,
    `every phone stage reported the same closing-line shape (${shapeText}). The reading-order assertion above is ` +
    'vacuous on a one-row line, so with nothing wrapping it proves nothing. Either the ladder stopped wrapping ' +
    '(see field.ts#signerFit and #narrowMarginCols) or the stage widths no longer straddle the rung boundary — ' +
    'at cw 7.2, 360 and 390 wrap and 430 does not.');

  /* ══ WHY THIS SECTION MAY RUN AT ONE DEVICE PIXEL RATIO ═══════════════
   * Every figure §10 reads comes out of `composeTarget`, which fills a CELL
   * GRID and never touches a pixel — so it is dpr-INVARIANT, and reading it at
   * the context default measures exactly what a retina device would report.
   *
   * THAT IS LOAD-BEARING AND IT WAS ASSERTED NOWHERE. The release this gate
   * was written for was a defect that existed ONLY at dpr >= 2, and the reason
   * these assertions could not see it is precisely this invariance: the wall
   * was in the PAINT, which is §10e's subject. But the argument runs both ways.
   * A change that made the GEOMETRY dpr-dependent — deriving `cw` from the
   * backing store, keying a margin on the ratio — would silently narrow every
   * assertion in this section to one device class, and §10e would stay green,
   * because §10e reads COVERAGE and not geometry. Nothing would speak.
   *
   * Measured across dpr 1, 2 and 3 at 390x844, 320x568 and 1440x900 before
   * this was written: every field identical at every stage. One stage is
   * asserted here rather than all nine, because the claim is structural — the
   * grid is computed in CSS pixels — and one counter-example falsifies it. */
  if (dpr1Geom) {
    const { report: hi } = await runStage({ width: PHONE.width, height: PHONE.height }, 0, 2);
    const dpr2Geom = hi ? geomOf(hi) : null;
    R.ok(dpr2Geom !== null && dpr2Geom === dpr1Geom,
      '390x844: the composed geometry is IDENTICAL at dpr 2 and dpr 1 — which is what makes ' +
      'every other assertion in this section a claim about all devices rather than about dpr 1',
      dpr2Geom === null
        ? 'the dpr 2 stage published no report at all, so the invariance is unchecked'
        : `the grid DIFFERS by device pixel ratio.\n      dpr1: ${dpr1Geom}\n      dpr2: ${dpr2Geom}\n` +
          '      Every assertion in §10 is taken at dpr 1, and they are only claims about a retina ' +
          'device while this holds. Something now derives the CELL GRID from the backing store rather ' +
          'than from CSS pixels — see field.ts#layoutField, which takes cw from measureText.');
  } else {
    R.ok(false, '390x844: the composed geometry is IDENTICAL at dpr 2 and dpr 1',
      'the dpr 1 stage never published a report, so there is no baseline to compare against and this ' +
      'control is vacuous rather than passing');
  }

  /* ── §10b · A SLOW PHONE GETS A SHORTER SEQUENCE, NOT A LONGER ONE ─────
   * The whole point of schedule.ts#WALL_CEIL_FACTOR. 6x is this repo's own
   * throttle convention (verify-memperf, verify-perf-runtime).
   *
   * ── THIS SECTION'S FIRST VERSION COULD NOT SEE ITS OWN SUBJECT, AND ONLY
   *    A BREAK TEST SAID SO ─────────────────────────────────────────────────
   * It asserted the whole navigation against 7,500ms, calibrated to red on the
   * 9,015ms this tree measured BEFORE the release. Deleting the wall ceiling
   * left it GREEN at 167 passed · 0 failed — because the 9,015 came from the
   * OLD 5,556ms duration, and against the new 3,333ms one the same 1.8x
   * stretch lands near 7,000ms, under the bound. The number was calibrated
   * against a baseline that the OTHER half of this release had already moved.
   * A bound that only reds on a defect nobody can reintroduce is not a bound.
   *
   * Two changes, and the SECOND one is the interesting half.
   *
   * (1) It measures the LOOP (from the instant the field publishes its report,
   * which is the loop's own setup) rather than the whole navigation, so bundle
   * and hold time are not inside the number the ceiling is supposed to govern.
   * Navigation time under throttle is dominated by parse and is not even
   * monotonic in the throttle rate — measured 18,539ms at 16x against 11,978ms
   * at 20x on the same tree — so it is the wrong quantity to bound. The bound
   * is DERIVED FROM THE CEILING THE PAGE REPORTS rather than written down:
   * `wallCeilMs * 1.15`. Not a tautology — `wallCeilMs` is a constant the page
   * states, and the assertion is that the loop's ACTUAL wall duration respected
   * it.
   *
   * (2) THE THROTTLE IS 10x, NOT THIS REPO'S CUSTOMARY 6x, AND THAT IS THE
   * WHOLE REASON THE FIRST VERSION COULD NOT SEE ITS SUBJECT. Deleting the
   * ceiling and re-running left the gate green TWICE — once against a 7,500ms
   * end-to-end bound and again against this loop bound at 6x. Measured across
   * the rate, loop ms with the ceiling vs without:
   *
   *      1x   3,315  /  3,315   — inert by construction (no frame clamps)
   *      6x   4,187  /  4,486   — 1.07x: the ceiling barely binds
   *     10x   3,922  /  7,348   — 1.87x
   *     16x   3,930  / 11,977   — 3.05x
   *     20x   3,636  / 15,138   — 4.16x
   *
   * 6x on this sandbox is simply not slow enough to make the 64ms clamp lie:
   * the median frame is still under 64ms and only the tail clamps. The operator
   * reported the splash "still showing at 11s", which on that curve is a device
   * around 14-16x — so the customary 6x understates the phone this release is
   * for. 10x is the first rate where the separation is unambiguous, and the
   * 1x row is the empirical form of the arithmetic proof that this ceiling
   * changes nothing on a machine that keeps up. */
  {
    const { flipped, flipMs, loopMs, report } = await runStage({ width: PHONE.width, height: PHONE.height }, 10);
    R.ok(Boolean(report) && flipped,
      '390 @10x CPU: precondition — the field ran and handed off under throttle',
      'the sequence did not complete under 6x throttle at all — the timing below has no subject');
    if (report && flipped) {
      const ceil = Number(report.wallCeilMs) || 0;
      R.ok(ceil > 0,
        `390 @10x CPU: precondition — the page reports its own wall ceiling (${ceil}ms)`,
        'no wallCeilMs in the field report, so the bound below would be derived from zero');
      if (ceil > 0) {
        const bound = Math.round(ceil * 1.15);
        R.ok(loopMs <= bound,
          `390 @10x CPU: the decrypt LOOP ran ${loopMs}ms against its own ${ceil}ms wall ceiling ` +
          `(bound ${bound}ms; whole navigation ${flipMs}ms)`,
          `${loopMs}ms of loop against a ${ceil}ms ceiling. The progress ramp's per-frame delta is clamped ` +
          'at 64ms, so a device that cannot hit 15.6fps advances it more slowly than real time and the ' +
          'sequence gets LONGER the slower the phone — measured 9,015ms end-to-end before ' +
          'schedule.ts#WALL_CEIL_FACTOR existed, and reported by the operator at ~11s. The unclamped wall ' +
          'accumulator in ColdBoot.tsx is what bounds it, and this reading says it is not doing so.');
      }
      /* REPORTED, NOT ASSERTED. What a visitor waits end to end is the number
         that matters to them, and it is also the one this gate cannot bound
         honestly: under throttle it is dominated by bundle parse and is not
         monotonic in the rate (18,539ms at 16x against 11,978ms at 20x). A
         bound on it would be a bound on the runner. The 1x end-to-end bounds
         above are stable and are where that claim is made. */
      R.info(`390 @10x CPU: whole navigation ${flipMs}ms (parse-dominated — reported, not bounded)`);
    }
  }

  /* ── §10c · THE WIDE STAGE IS UNTOUCHED, BOUNDED BOTH WAYS ─────────────
   * A one-sided upper bound would be satisfied by shortening EVERY stage, so
   * this control also has a FLOOR. And it asserts the wide mark still rasters,
   * which is what stops §10's cells-per-glyph floor from being a claim that
   * only holds where it was tuned. */
  {
    const { report, flipped, flipMs } = await runStage({ width: 1440, height: 900 });
    const ok = Boolean(report && report.mark);
    R.ok(ok, '1440x900 control: precondition — the field published its report', ok ? '' : 'no report');
    if (ok) {
      R.ok(report.narrow === false,
        `1440x900 control: the WIDE composition is engaged (narrow=false, ${report.layout.cols}x${report.layout.rows} cells)`,
        'narrow=true at 1440 — the phone composition has leaked onto the desktop stage');
      R.ok(report.mark.cellsPerGlyph >= MIN_CELLS_PER_GLYPH,
        `1440x900 control: the wide mark rasters at ${report.mark.cellsPerGlyph} cells per glyph ` +
        `(${report.mark.cols}x${report.mark.rows} over ${report.mark.glyphs})`,
        `${report.mark.cellsPerGlyph} — the desktop mark regressed`);
      /* THE WIDE STAGE'S AMBIENT FIELD IS EXACTLY 1.0, and "exactly" is the
         assertion. Every narrow-composition term in field.ts multiplies by this
         value, so a wide field of 1.0 makes each one an exact float no-op and
         the desktop frame bit-identical. A wide stage reading anything else
         means the phone composition has reached the desktop through a door
         `narrow === false` above does not cover. */
      R.ok(report.ambientMean === 1,
        `1440x900 control: the ambient weight field is exactly 1.0 — every narrow term is an exact no-op here`,
        `ambientMean ${report.ambientMean} on a wide stage. The narrow composition is being applied to the ` +
        'desktop, so the frame is no longer bit-identical to the one this file drew before p4·M7.');
      R.ok(report.mark.colsPerGlyph >= MIN_COLS_PER_GLYPH &&
           (report.mark.rows * report.mark.cols) / (report.layout.rows * report.layout.cols) <= MARK_SHARE_MAX,
        `1440x900 control: the wide mark is ${report.mark.colsPerGlyph} columns per letterform and ` +
        `${(((report.mark.rows * report.mark.cols) / (report.layout.rows * report.layout.cols)) * 100).toFixed(1)}% of the grid`,
        'the wide mark has lost horizontal resolution or has eaten the stage');
      R.ok(flipped && flipMs >= WIDE_FLIP_MIN_MS && flipMs <= WIDE_FLIP_MAX_MS,
        `1440x900 control: decrypt -> console in ${flipMs}ms (band ${WIDE_FLIP_MIN_MS}-${WIDE_FLIP_MAX_MS}ms — ` +
        'the wide sequence is neither shortened nor stretched)',
        flipMs < WIDE_FLIP_MIN_MS
          ? `${flipMs}ms — the desktop sequence got SHORTER. The narrow duration has leaked onto the wide ` +
            'stage; every upper bound in this section would still pass.'
          : `${flipMs}ms — the desktop sequence got longer, or never completed`);
    }
  }

  /* ── §10d · REDUCED MOTION NEVER SEES THE FIELD AT ALL ─────────────────
   * The host mounts straight to the console at a conceptual T=1 and renders NO
   * canvas (ColdBoot.tsx's skipDecrypt branch), so "the decrypt loses no
   * information under reduce" is true because there is no decrypt. Asserted as
   * an ABSENCE with a POSITIVE CONTROL beside it — the console must be present
   * and carry real text, or "no canvas" would also be satisfied by a page that
   * rendered nothing at all. */
  {
    const { ctx, page } = await cold({ viewport: { width: PHONE.width, height: PHONE.height }, reducedMotion: 'reduce' });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    const ready = await page.waitForSelector('[data-coldboot-console="ready"]', { timeout: 25_000 })
      .then(() => true).catch(() => false);
    R.ok(ready, '390 reduce: precondition — the console reached "ready"');
    if (ready) {
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => ({
        canvases: document.querySelectorAll('[data-coldboot] > canvas').length,
        phase: document.querySelector('[data-coldboot]')?.getAttribute('data-coldboot') ?? null,
        chars: (document.querySelector('[data-coldboot]')?.innerText || '').trim().length,
        field: Boolean(window.__XMR_FIELD__),
      }));
      R.ok(m.chars > 400,
        `390 reduce: positive control — the console carries ${m.chars} chars of real text`,
        `only ${m.chars} chars — the absence below would be satisfied by an empty page`);
      R.ok(m.canvases === 0 && m.phase === 'console' && !m.field,
        `390 reduce: no decrypt field is ever rendered (phase "${m.phase}", ${m.canvases} field canvas, ` +
        `report published: ${m.field})`,
        `phase "${m.phase}" with ${m.canvases} field canvas — a reduced-motion phone is being shown the ` +
        'animated decrypt');
    }
    await ctx.close();
  }

  /* ── §10e · THE FIELD CONVERGES — the canvas, read back ────────────────
   *
   * ── THE ASSERTION THAT WOULD HAVE CAUGHT THE BUG THAT SHIPPED ──────────
   * `drawField` cleared `(0, 0, w, h)` in CSS pixels and blitted every glyph in
   * BACKING-STORE pixels. At dpr 1 the two spaces coincide and the frame
   * cleared correctly; at dpr 2 the clear covered the top-left QUARTER of the
   * store and the other three kept every glyph ever drawn there. Phones are
   * dpr 2-3, the desktops this was authored on are dpr 1, and every section
   * above runs at the context default of 1 — so the field a phone renders had
   * never been looked at by anything, and the sequence's own promise, that it
   * CONVERGES and fades to black around the resolved message, was false on
   * every retina device for the whole of its life.
   *
   * Nothing above could have seen it. The four figures §10 asserts come out of
   * `composeTarget` and never touch a pixel. §2 compares two cold runs by
   * `toDataURL` and both runs accumulate identically, so it stayed green. The
   * only instrument that answers this reads the canvas.
   *
   * ── AND THE WIDE CONTROL AT dpr 1 IS GREEN ON THE BROKEN TREE ──────────
   * Which is exactly why there are THREE stages and not two. Measured against
   * a build of the pre-p4·M7 tree, coverage of the LAST frame before the
   * handoff (lit = any channel > 24, bright = > 120):
   *
   *                        pre-p4·M7        shipping
   *      390x844 dpr 2     46.4 / 41.6       0.0 / 0.0
   *      320x568 dpr 2     45.7 / 41.9       0.0 / 0.0
   *     1440x900 dpr 2     42.5 / 35.0       0.0 / 0.0
   *     1440x900 dpr 1      0.0 /  0.0       0.0 / 0.0     <- always passed
   *
   * A phone-only assertion cannot tell "the phone is right" from "everything
   * is right", so the wide dpr-1 stage is here as the control that says the
   * suite is not simply reporting universal failure. And the wide dpr-2 stage
   * is here because WITHOUT IT this section would read as a claim about phones,
   * when the axis is the device pixel ratio: the same 1440x900 viewport is
   * broken at one ratio and clean at the other, on one build.
   *
   * ── WHY THE TAIL AND NOT A FIXED T ─────────────────────────────────────
   * The brief asks for "by T = 0.9 the field has faded to near-empty", which is
   * the right claim. T is not directly readable from outside — the loop's own
   * accumulator is clamped per frame and can be overridden by the wall ceiling
   * — so a gate that computed T from wall time would be asserting against its
   * own arithmetic rather than against the page's. The LAST FRAME BEFORE THE
   * PHASE FLIPS is the same claim anchored on something the page states itself,
   * and it is stronger: at T=1 the field is empty by construction (`fade` and
   * every content alpha reach 0), so a tail that is not empty is a tail that
   * did not converge. Measured zero-variance at 0.0 across 15 runs and 5
   * stages on the shipping tree; the T≈0.9 sample is PRINTED beside it for
   * context and is not asserted, because at dpr 2 on a slow stage the wall
   * ceiling legitimately re-times the run and that index stops meaning what it
   * says.
   *
   * ── THE SAMPLER IS STRIPS, AND THAT IS A MEASUREMENT NOT A SHORTCUT ────
   * A full-frame `getImageData` at 1440x900 dpr 2 is 5.2M pixels and costs
   * ~40ms per sample, which pushed the run from ~5,950ms to ~7,990ms — past the
   * page's own wall ceiling. An instrument that changes what it measures is not
   * measuring it. Ten evenly spaced strips of 48 store-px cost ~10ms and read
   * within 1.4 points of the full frame at every stage. */
  R.group('── 10e · the field converges: the canvas, read back at dpr 1 and dpr 2 ──');
  {
    /* ── EVERY FIGURE BELOW IS IN THE STRIP SAMPLER'S OWN UNITS ───────────
     * The bands here were CALIBRATED WITH THE SAMPLER THAT ENFORCES THEM, and
     * that is deliberate: a band derived from a full-frame read and enforced
     * with a cheaper one is two instruments, and the next person to re-derive
     * would get a different number and be unable to tell drift from method.
     *
     * The bias is small and it is not zero. Measured on one tree, strip against
     * full-frame, peak lit: 390x844 dpr2 17.1 vs 17.1 · 1440x900 dpr1 20.8 vs
     * 21.1 · 1440x900 dpr2 17.3 vs 18.7 — so the strip figure runs up to ~1.4
     * points LOW at 1440 dpr 2 and is identical on a phone. The tail figures,
     * which are what the load-bearing assertion reads, are 0.0 under both.
     * A re-derivation with the full frame will therefore read slightly HIGHER
     * peaks than these ceilings were set against; that is method, not drift. */
    /* Non-vacuity. Measured 32 samples on a phone and 50-54 at 1440. */
    const MIN_SAMPLES = 12;
    /* The field PAINTED. Without this every ceiling below is satisfied by a
       canvas that drew nothing at all — which is precisely how an absence-only
       section reports confidence about a blank page. Measured peak 17.2-21.0. */
    const PEAK_LIT_MIN = 8;
    /* Measured peak 17.2-21.0 shipping against 45.4-52.3 pre-fix. 32 sits in
       the empty gap between the two populations, closer to neither. */
    const PEAK_LIT_MAX = 32;
    /* Measured peak 6.7-10.8 shipping against 36.4-45.8 pre-fix. */
    const PEAK_BRIGHT_MAX = 18;
    /* THE CONVERGENCE. Measured 0.0 on every shipping stage across 15 runs;
       42.5-46.5 lit and 34.9-41.9 bright pre-fix on the three dpr-2 stages. */
    const TAIL_LIT_MAX = 3;
    const TAIL_BRIGHT_MAX = 1;
    /* THE MECHANISM, NAMED. At the tail every quadrant is empty, so the spread
       between the busiest and the quietest is ~0. Under the CSS-px clear the
       top-left quadrant is the one being repainted and reads ~0 while the other
       three hold the whole accumulated run — which is the "blank box top-left,
       filled everywhere else" the operator described. This assertion cannot add
       coverage the tail check does not already have; it exists so the failure
       MESSAGE names the line rather than leaving the next reader to find it. */
    const QUAD_SPREAD_MAX = 3;

    /* ══ DO NOT SIMPLIFY THIS TO ONE WIDE STAGE AND ONE PHONE ═════════════
     * The obvious version of this section — a phone plus a wide control —
     * WOULD HAVE PASSED ON THE TREE THAT SHIPPED THE BUG. Measured against a
     * build of the pre-p4·M7 tree, last frame before the handoff:
     *     390x844 dpr 2   46.4 % lit   <- red
     *    1440x900 dpr 2   42.5 % lit   <- red
     *    1440x900 dpr 1    0.0 % lit   <- GREEN, on the broken tree
     * Each of the three answers a different question, and dropping any one of
     * them restores a specific blindness:
     *   · the PHONE is the subject the operator reported;
     *   · the WIDE dpr 1 stage is the control that says the suite is not
     *     simply reporting universal failure — without it a red here cannot be
     *     told apart from "everything is broken";
     *   · the WIDE dpr 2 stage is NOT a symmetry nicety and is the one most
     *     likely to be tidied away. It is what makes this a claim about the
     *     DEVICE PIXEL RATIO rather than about phones, and it is the stage that
     *     covers every retina laptop and 4K desktop — which is to say the
     *     defect it guards was never a mobile one. The same 1440x900 viewport
     *     is broken at one ratio and clean at the other, on one build. */
    const STAGES = [
      ['390x844 dpr2', { width: PHONE.width, height: PHONE.height }, 2],
      ['1440x900 dpr1', { width: 1440, height: 900 }, 1],
      ['1440x900 dpr2', { width: 1440, height: 900 }, 2],
    ];

    const converged = [];
    for (const [label, vp, dpr] of STAGES) {
      const { ctx, page } = await cold({ viewport: vp, deviceScaleFactor: dpr });
      await page.addInitScript(() => {
        window.__cbCov = [];
        const STRIPS = 10;
        const SH = 48;
        const arm = () => {
          const root = document.querySelector('[data-coldboot]');
          const cv = root && root.querySelector('canvas');
          if (!cv || !cv.width) { setTimeout(arm, 16); return; }
          /* Re-getting the 2d context returns the SAME context the page is
             drawing with; the attribute bag is ignored on a second call, so
             this neither creates a second context nor changes the first. */
          const g = cv.getContext('2d');
          const t0 = performance.now();
          const count = (data) => {
            let lit = 0; let bright = 0;
            for (let i = 0; i < data.length; i += 4) {
              const m = Math.max(data[i], data[i + 1], data[i + 2]);
              if (m > 24) lit++;
              if (m > 120) bright++;
            }
            return [lit, bright, data.length / 4];
          };
          const quads = () => {
            const W = cv.width; const H = cv.height;
            const s = Math.max(16, Math.min(160, Math.floor(Math.min(W, H) / 6)));
            const at = (x, y) => {
              const [lit, , n] = count(g.getImageData(x, y, s, s).data);
              return +(lit / n * 100).toFixed(2);
            };
            return [
              at(Math.floor(W * 0.25 - s / 2), Math.floor(H * 0.25 - s / 2)),
              at(Math.floor(W * 0.75 - s / 2), Math.floor(H * 0.25 - s / 2)),
              at(Math.floor(W * 0.25 - s / 2), Math.floor(H * 0.75 - s / 2)),
              at(Math.floor(W * 0.75 - s / 2), Math.floor(H * 0.75 - s / 2)),
            ];
          };
          const iv = setInterval(() => {
            const r = document.querySelector('[data-coldboot]');
            if (!r || r.getAttribute('data-coldboot') !== 'decrypt') { clearInterval(iv); return; }
            try {
              let lit = 0; let bright = 0; let n = 0;
              const step = Math.max(1, Math.floor((cv.height - SH) / (STRIPS - 1)));
              for (let i = 0; i < STRIPS; i++) {
                const y = Math.min(Math.max(0, cv.height - SH), i * step);
                const [l, b, m] = count(g.getImageData(0, y, cv.width, Math.min(SH, cv.height)).data);
                lit += l; bright += b; n += m;
              }
              const eff = (window.__XMR_FIELD__ && window.__XMR_FIELD__.effectiveMs) || 5556;
              window.__cbCov.push({
                T: +((performance.now() - t0) / eff).toFixed(3),
                lit: +(lit / n * 100).toFixed(2),
                bright: +(bright / n * 100).toFixed(2),
                quads: quads(),
              });
            } catch { /* a sampler must never be able to blank the page */ }
          }, 100);
        };
        arm();
      });
      await page.goto(BASE + '/', { waitUntil: 'load' });
      await page.waitForFunction(
        () => document.querySelector('[data-coldboot]')?.getAttribute('data-coldboot') === 'console',
        null, { timeout: 30_000 }).catch(() => {});
      const cov = await page.evaluate(() => window.__cbCov || []);
      await ctx.close();

      const enough = cov.length >= MIN_SAMPLES;
      R.ok(enough, `${label}: precondition — ${cov.length} canvas samples through the decrypt ` +
        `(floor ${MIN_SAMPLES})`,
        `${cov.length} samples. The canvas was never found, or the phase never sat in "decrypt" long enough ` +
        'to sample — nothing below has a subject.');
      if (!enough) { converged.push(null); continue; }

      const peakLit = Math.max(...cov.map((c) => c.lit));
      const peakBright = Math.max(...cov.map((c) => c.bright));
      const tail = cov[cov.length - 1];
      const near90 = cov.reduce((a, c) => (Math.abs(c.T - 0.9) < Math.abs(a.T - 0.9) ? c : a));

      R.ok(peakLit >= PEAK_LIT_MIN,
        `${label}: positive control — the field actually paints (peak ${peakLit.toFixed(1)}% lit, ` +
        `floor ${PEAK_LIT_MIN}%)`,
        `peak ${peakLit.toFixed(1)}% lit. The ceilings below would all be satisfied by a canvas that drew ` +
        'nothing, which is an absence reporting confidence about a blank stage.');

      R.ok(peakLit <= PEAK_LIT_MAX && peakBright <= PEAK_BRIGHT_MAX,
        `${label}: at its busiest the field is ${peakLit.toFixed(1)}% lit / ${peakBright.toFixed(1)}% bright ` +
        `(ceilings ${PEAK_LIT_MAX}% / ${PEAK_BRIGHT_MAX}%)`,
        `${peakLit.toFixed(1)}% lit and ${peakBright.toFixed(1)}% bright at peak. The field is a wall rather ` +
        'than a texture, and a reader cannot tell the message from the background.');

      /* THE ONE THAT MATTERS. */
      R.ok(tail.lit <= TAIL_LIT_MAX && tail.bright <= TAIL_BRIGHT_MAX,
        `${label}: the field CONVERGES — the last frame before the handoff is ${tail.lit.toFixed(1)}% lit / ` +
        `${tail.bright.toFixed(1)}% bright (ceilings ${TAIL_LIT_MAX}% / ${TAIL_BRIGHT_MAX}%; T≈0.9 read ` +
        `${near90.lit.toFixed(1)}% / ${near90.bright.toFixed(1)}%, peak ${peakLit.toFixed(1)}%)`,
        `the last frame holds ${tail.lit.toFixed(1)}% lit / ${tail.bright.toFixed(1)}% bright against a peak of ` +
        `${peakLit.toFixed(1)}%. THE FIELD NEVER FADES. field.ts#drawField clears its canvas once per frame; if ` +
        'that clear is expressed in CSS pixels while the glyphs blit in backing-store pixels, then at any ' +
        'devicePixelRatio above 1 it repaints only the top-left 1/dpr² of the store and the rest accumulates ' +
        'every frame of the sequence. That is invisible at dpr 1, which is where this file runs every other ' +
        'section. See field.ts#drawField and orb.ts:492 for the form that is correct.');

      const spread = Math.max(...tail.quads) - Math.min(...tail.quads);
      R.ok(spread <= QUAD_SPREAD_MAX,
        `${label}: the four quadrants agree at the tail — [${tail.quads.join(', ')}]% lit, spread ` +
        `${spread.toFixed(1)} (ceiling ${QUAD_SPREAD_MAX})`,
        `quadrant coverage [${tail.quads.join(', ')}]% at the last frame, spread ${spread.toFixed(1)}. One ` +
        'region of the canvas is being repainted and the others are not. If the quiet quadrant is the ' +
        'TOP-LEFT one, the clear is expressed in CSS pixels and the draw in backing-store pixels — that is ' +
        'the whole defect, and this is the shape a reader sees: a blank box in one corner and the entire ' +
        'run of the sequence painted on top of itself everywhere else.');

      converged.push({ label, dpr, tail, peakLit });
    }

    /* THE CROSS-STAGE CLAIM, which no single stage above can make: convergence
       is a property of the SEQUENCE and not of a viewport. Stated as its own
       assertion so a run in which only the phone converged reads as a defect
       rather than as three quarters of a pass. */
    const usable = converged.filter(Boolean);
    R.ok(usable.length === STAGES.length && usable.every((c) => c.tail.lit <= TAIL_LIT_MAX),
      `every stage converges at both device pixel ratios — ` +
      usable.map((c) => `${c.label} ${c.tail.lit.toFixed(1)}%`).join(' · '),
      'at least one stage did not converge. The three stages exist to separate three different failures: a ' +
      'phone that is broken, a suite that is reporting universal failure, and a defect whose axis is the ' +
      'device pixel ratio rather than the viewport width.');
  }
}

/* ══ §11 · THE ORB REACHES THE PHONE'S NETWORK SLOT ══════════════════════
 *
 * ── THE DEFECT, AND WHY EVERY EXISTING ASSERTION MISSED IT ───────────────
 * `[data-orb]` is `position:fixed` and drives itself from the rect
 * `ColdBootConsole` publishes for its slot. Until p4·M1 that slot could only
 * change by RESIZING, so a ResizeObserver plus `window.resize` saw everything.
 * p4·M1 made the stacked grid a SCROLL CONTAINER — the phone fix, and it
 * stays — and a scroll moves a box without resizing it.
 *
 * So on a phone the orb was sized correctly, painted correctly, and pinned at
 * a viewport coordinate 753px below the fold (measured at 390x844: slot top
 * y=1597 in an 844px viewport, inside a 2,211px scroller). Scrolling down to
 * the Network pane arrived at an EMPTY frame. Every assertion that could have
 * spoken was about the orb's own size or paint, both of which were fine;
 * `verify-orb` §7 reports it as a reasoned SKIP, because `elementFromPoint` is
 * viewport-relative and cannot answer about an off-screen element.
 *
 * ── WHAT DISCRIMINATES ───────────────────────────────────────────────────
 * Not "is the orb painted" (it was), not "does the slot exist" (it did), and
 * not the orb's rect on its own. The only metric that separates the two trees
 * is the orb's rect AFTER A SCROLL, against the slot's — plus
 * `elementFromPoint` at the slot's centre, which is exactly the probe
 * `verify-orb` had to decline. Both are floored by a paint census, so "the orb
 * is over the slot" cannot pass over a blank canvas. */
R.group('── 11 · the orb reaches the phone console\'s Network slot ─────────────');
{
  const STAGES = [
    ['360x800', { width: 360, height: 800 }, true],
    ['390x844', { width: PHONE.width, height: PHONE.height }, true],
    ['430x932', { width: 430, height: 932 }, true],
    ['1440x900', { width: 1440, height: 900 }, false],
  ];

  for (const [label, vp, expectBelowFold] of STAGES) {
    const { ctx, page } = await cold({ viewport: vp });
    await page.goto(BASE + '/', { waitUntil: 'load' });
    const ready = await page.waitForSelector('[data-coldboot-console="ready"]', { timeout: 30_000 })
      .then(() => true).catch(() => false);
    R.ok(ready, `${label}: precondition — the console reached "ready"`);
    if (!ready) { await ctx.close(); continue; }
    await page.waitForTimeout(900);

    const before = await page.evaluate(() => {
      const s = document.querySelector('[data-orb-slot="coldboot-console"]');
      if (!s) return null;
      const b = s.getBoundingClientRect();
      return { top: Math.round(b.top), inView: b.top < window.innerHeight && b.bottom > 0 };
    });
    R.ok(before !== null, `${label}: precondition — the console renders an orb slot`,
      'no [data-orb-slot="coldboot-console"] — there is nothing for the orb to reach');
    if (!before) { await ctx.close(); continue; }

    /* THE VACUITY FLOOR FOR THE SCROLL TEST. If the slot were already on
       screen at a phone width, scrolling would prove nothing and the whole
       section would pass on a tree with no scroll tracking at all. The wide
       stage is the reverse control: its slot is IN view and must stay so. */
    if (expectBelowFold) {
      R.ok(before.inView === false,
        `${label}: precondition — the slot starts BELOW THE FOLD (top ${before.top}px in a ${vp.height}px ` +
        'viewport), so the scroll below is a real test',
        `the slot is already visible at top ${before.top}px, so scrolling to it proves nothing and every ` +
        'assertion below would pass on a tree that does not track scroll at all');
    } else {
      R.ok(before.inView === true,
        `${label}: control — the wide stage's slot is on screen from the start (top ${before.top}px)`,
        `the desktop slot is off-screen at top ${before.top}px — the console layout regressed`);
    }

    await page.evaluate(() => {
      const g = document.querySelector('[data-cb-grid]');
      if (g && g.scrollHeight > g.clientHeight) g.scrollTop = g.scrollHeight;
      document.querySelector('[data-orb-slot="coldboot-console"]')?.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(500);

    const m = await page.evaluate(() => {
      const slot = document.querySelector('[data-orb-slot="coldboot-console"]');
      const orb = document.querySelector('[data-orb]');
      const cv = orb ? orb.querySelector('canvas') : null;
      const sb = slot.getBoundingClientRect();
      const ob = orb ? orb.getBoundingClientRect() : null;
      const ix = ob ? Math.max(0, Math.min(sb.right, ob.right) - Math.max(sb.left, ob.left)) : 0;
      const iy = ob ? Math.max(0, Math.min(sb.bottom, ob.bottom) - Math.max(sb.top, ob.top)) : 0;
      let lit = 0, n = 0;
      if (cv && cv.width && cv.height) {
        try {
          const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
          for (let i = 3; i < d.length; i += 4 * 13) { n++; if (d[i] > 8) lit++; }
        } catch { /* tainted canvas would report 0, which fails honestly */ }
      }
      const cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2;
      const hit = (cy >= 0 && cy <= window.innerHeight) ? document.elementFromPoint(cx, cy) : null;
      return {
        slotTop: Math.round(sb.top), slotOnScreen: sb.top < window.innerHeight && sb.bottom > 0,
        orbTop: ob ? Math.round(ob.top) : null,
        coverage: sb.width * sb.height > 0 ? +((ix * iy) / (sb.width * sb.height)).toFixed(3) : 0,
        buf: cv ? `${cv.width}x${cv.height}` : null,
        litFrac: n ? +(lit / n).toFixed(4) : 0,
        overSlot: Boolean(hit && hit.closest('[data-orb]')),
        hitTag: hit ? hit.tagName : 'off-viewport',
      };
    });

    R.ok(m.slotOnScreen,
      `${label}: the slot scrolled into view (top ${m.slotTop}px)`,
      'the slot could not be brought on screen — the assertions below have no subject');
    if (!m.slotOnScreen) { await ctx.close(); continue; }

    /* THE PAINT FLOOR, FIRST. Without it "the orb covers the slot" is
       satisfiable by a correctly-positioned blank canvas, which is the
       "empty framed box that implies a failed load" this must never ship. */
    R.ok(m.litFrac >= 0.05,
      `${label}: the orb canvas is PAINTED (${m.buf} backing store, ${(m.litFrac * 100).toFixed(1)}% of ` +
      'sampled pixels lit)',
      `${(m.litFrac * 100).toFixed(1)}% lit on a ${m.buf} buffer — the slot would frame an empty box, which ` +
      'reads to a visitor as a failed load. Render nothing or render the orb; never a frame around nothing.');

    /* THE DISCRIMINATING ASSERTIONS. On the pre-p4·M4 tree the orb stays
       pinned at the rect published before the scroll — coverage 0 at all three
       phone widths, with elementFromPoint returning the slot's own div. */
    R.ok(m.coverage >= 0.9,
      `${label}: the orb sits ON the slot after scrolling — ${(m.coverage * 100).toFixed(0)}% of the slot ` +
      `covered (slot top ${m.slotTop}, orb top ${m.orbTop})`,
      `only ${(m.coverage * 100).toFixed(0)}% covered: the slot is at ${m.slotTop} and the orb at ${m.orbTop}. ` +
      '[data-orb] is position:fixed and tracks the rect the console publishes; the console grid is a scroll ' +
      'container on a phone, and a scroll moves a box without resizing it, so neither the ResizeObserver nor ' +
      'window.resize fires. See ColdBootConsole.tsx\'s slot effect.');

    /* ── §11b · TRACKING THE SLOT MUST NOT COST LAYOUT SHIFT ──────────────
     * The orb is `position:fixed` and `Orb.tsx` re-anchors its layout box on
     * every render at rest, so the naive way to make it follow a scrolling slot
     * is to write `left`/`top` once per frame — which is a scored layout shift
     * on every one of them. MEASURED on the tree that first fixed the tracking:
     * a 40-step scroll of the console grid at 390x844 scored **CLS 0.242**
     * against this repo's 0.005 ceiling, 64 frames at ~0.0168 each with `DIV`
     * (the orb) the sole source, IDENTICAL at 1x and 6x. The remedy is in
     * Orb.tsx: a same-size rect change keeps the base and moves by transform.
     *
     * NOTHING ELSE IN THE SUITE CAN SEE THIS. `verify-cls.mjs` and
     * `verify-vitals.mjs` both call `coldBootOffBrowser`, so `/`'s recorded
     * 0.0000 is taken with the splash bypassed — it could not have moved, and a
     * regression here would have shipped green. That is why the assertion lives
     * beside the tracking it pays for rather than in the CLS gate.
     *
     * Floored on BOTH sides: the grid must actually have scrolled and frames
     * must actually have elapsed, or "0.000" is a statement about a scroll that
     * never happened. */
    if (expectBelowFold) {
      const shift = await page.evaluate(async () => {
        let cls = 0; const srcs = [];
        const po = new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) {
            cls += e.value;
            if (e.value > 0.0005 && srcs.length < 4) srcs.push(`${e.value.toFixed(4)} ${(e.sources || []).map((x) => x.node && x.node.nodeName).join(',')}`);
          }
        });
        po.observe({ type: 'layout-shift' });
        const g = document.querySelector('[data-cb-grid]');
        if (!g) return { cls: -1, frames: 0, scrolled: 0, srcs };
        g.scrollTop = 0;
        let frames = 0;
        const max = g.scrollHeight - g.clientHeight;
        for (let i = 1; i <= 40; i++) {
          g.scrollTop = (max * i) / 40;
          await new Promise((r) => requestAnimationFrame(() => { frames++; r(); }));
        }
        await new Promise((r) => setTimeout(r, 300));
        po.disconnect();
        return { cls: +cls.toFixed(5), frames, scrolled: Math.round(g.scrollTop), srcs };
      });
      R.ok(shift.frames >= 20 && shift.scrolled > 100,
        `${label}: precondition — the console really scrolled (${shift.scrolled}px over ${shift.frames} frames)`,
        `${shift.frames} frames / ${shift.scrolled}px — a shift score over a scroll that did not happen is not a measurement`);
      if (shift.frames >= 20 && shift.scrolled > 100) {
        R.ok(shift.cls <= 0.005,
          `${label}: scrolling the console to the orb emits NO layout shift (CLS ${shift.cls.toFixed(5)}, ceiling 0.005)`,
          `CLS ${shift.cls} over the scroll — ${shift.srcs.join(' · ')}. The orb is tracking its slot by writing ` +
          'left/top per frame on a position:fixed element, which is a scored shift every frame. Orb.tsx must keep ' +
          'its layout base and express a same-size move as a transform, the way the ENTER travel already does.');
      }
    }

    R.ok(m.overSlot,
      `${label}: elementFromPoint at the slot's centre resolves INSIDE [data-orb] (${m.hitTag})`,
      `resolved to ${m.hitTag}, outside [data-orb] — the reader looking at the Network slot is not looking ` +
      'at the orb. This is the probe verify-orb §7 has to decline, because it cannot speak about an ' +
      'off-screen element; here the slot has been scrolled on screen first, so it can.');

    await ctx.close();
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
