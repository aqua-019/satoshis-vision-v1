// verify-reduce.mjs — D0693. The 27-surface reduced-motion contract, enforced.
//
// Run from app/: `npm run build && (node scripts/serve-dist.mjs &) && node verify-reduce.mjs`
//
// The 27 surfaces are the 21 registered simulators (`/simulate?p=<id>`) and the
// 6 mempool views (`/mempool?v=<id>`). CLAUDE.md's standing rule is that "every
// animation ships a `prefers-reduced-motion` path that loses no information."
// Until v6.1.3 that rule was enforced nowhere: the reduced-motion audit for
// this change hand-drove all 27 and found FIVE files where motion simply never
// stopped — reactor, sediment and terminal in mempool/, ringct and dandelion in
// protocols/. Every one of them predates this change. A hand audit finds them
// once; this gate is what keeps them found.
//
// ── WHAT IS ASSERTED, AND WHY IT IS "ZERO" ────────────────────────────────
//
// Under `reducedMotion: 'reduce'`, per surface:
//   (a) `document.getAnimations()` reports no `running` animation, and
//   (b) the DOM contains no SMIL element (`<animate>`, `<animateTransform>`,
//       `<animateMotion>`) at all.
//
// (b) is a PRESENCE check, not a running check, and that asymmetry is the whole
// point. SMIL is invisible to CSS: `animation: none`, `@media
// (prefers-reduced-motion: reduce)`, `styles.css`'s global
// `transition-duration: 0ms` — none of them reach a `<animate>` element, and
// `getAnimations()` does not report SMIL in Chromium either. The only way to
// honour reduced motion for SMIL is to not render the element, so the only
// honest assertion is that it is absent. Four of the five defects above were
// SMIL; a running-only check would have scored them green.
//
// ── WHY THERE IS NO ALLOWLIST ─────────────────────────────────────────────
//
// The obvious next move on a red line is to add an exemption. Resist it, and
// note what the audit found instead: every one of the 27 surfaces reaches zero
// without one, because in every case the meaning was already carried by
// something static — a `<Stat>` grid, a `MemViewShell` `table` slot, an
// unconditional SVG label, or a colour/geometry distinction that does not blink.
// "This animation must keep running" has been claimed twice in this repo and
// been wrong twice. If a genuinely-must-move case ever appears, the honest
// shape is a named constant here with the reason inline — not a file list.
//
// One real distinction the gate respects: a surface may still hold a *frozen*
// animation (`playState === 'paused'`) or a finished transition. Only `running`
// counts, so `animation-play-state: paused` and a settled transition are fine.
//
// ── THE FREEZE-POINT PROBLEM, WHICH THIS GATE DOES NOT COVER ──────────────
//
// Stopping motion is necessary and not sufficient. `useTick` freezes to a
// literal 0, so a tick-driven simulator's natural still frame is its FIRST
// frame — and for three of them that frame was the "before" state the simulator
// exists to move past (view-tags reported "1 ms" for both scanners; fcmp
// reported an anonymity set of 16; stealth parked Diffie-Hellman on
// "computing…"). All three now freeze where the animation LANDS. That is a
// claim about rendered content, not about motion, so it is checked in the
// handoff's §7.1 enumeration by reading the frozen text — not here. Do not add
// a "no motion" assertion and call the contract discharged.

import { launch, BASE, makeReporter } from './verify-lib.mjs';

const R = makeReporter('verify-reduce');

/** The 21 registered simulators — views/protocols.tsx's id list. */
const SIMS = [
  'decoy', 'dandelion', 'viewtags', 'ringct', 'stealth', 'fcmp',
  'seraphis', 'jamtis', 'carrot', 'cuprate', 'stressnet', 'ospead',
  'hearth', 'metronome', 'silo', 'thermostat', 'lighthouse', 'auction',
  'skyline', 'bloodhound', 'balance',
];

/** SIX of the TEN registered mempool views.
 *
 *  THE PATH IN THIS COMMENT WAS STALE FOR SIX MERGES AND THAT IS THE TELL. It
 *  read "mempool/views.tsx's registry"; `find app -name 'views.tsx'` returns
 *  NOTHING. The real registry is `src/views/mempool-meta.ts`, and it carries
 *  TEN ids — so orbital, abyss, pulse and circuit, every canvas view added
 *  since v6.1.3, are not driven by this gate at all.
 *
 *  DO NOT "FIX" THIS BY EDITING THE LITERAL TO TEN. A hand copy corrected by
 *  hand is still a hand copy, and the eleventh view lands this same finding.
 *  SIMS above is the proof: it diffs IDENTICAL against protocols.tsx's ids
 *  today, and that is luck rather than structure — `withComponents()` couples
 *  the two REGISTRIES to each other, and nothing couples either array here to
 *  either registry. The fix is to derive both from the registries, which needs
 *  its own break tests because widening this gate adds four surfaces to a check
 *  that has found real running-animation defects before. */
const MEM = ['reactor', 'bridge', 'sediment', 'constellation', 'terminal', 'classic'];

const SURFACES = [
  ...SIMS.map((p) => ({ name: `simulate?p=${p}`, url: `${BASE}/learn/sim?p=${p}` })),
  ...MEM.map((v) => ({ name: `mempool?v=${v}`, url: `${BASE}/live/mempool?v=${v}` })),
];

/** Long enough for entrance transitions to settle and for a 1.2s-3.5s ambient
 *  loop to have started if it was going to. Shorter and a slow loop that has
 *  not begun its first iteration reads as absent. */
const SETTLE_MS = 1500;

const { browser, engine } = await launch();
R.info(`engine: ${engine} · base: ${BASE} · ${SURFACES.length} surfaces`);

/** Census one surface under a given reduced-motion setting. */
async function census(ctx, url) {
  const page = await ctx.newPage();
  try {
    // Never `networkidle` — the 3s FAST polling tier means the network is
    // never idle. domcontentloaded + an explicit selector, as everywhere else.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('main', { timeout: 15000 });
    // MOUNT, not just `main`. v6.1.5 PR B made the 21 simulators lazy, so on a
    // /simulate surface `main` now resolves while the simulator's chunk is
    // still in flight and only the Suspense fallback is on screen. Censusing
    // there finds zero animations and zero SMIL — and §1 would pass, green and
    // vacuous, for exactly the surfaces it exists to check. §2's control probe
    // would NOT catch it: it drives two fixed URLs and would keep finding
    // motion while all 21 simulator rows silently measured a fallback.
    // `.art.proto` is ProtoArtboard's root (design/ProtoArtboard.tsx:59) — the
    // simulator is on screen only once it exists.
    let mounted = true;
    if (url.includes('/learn/sim')) {
      try { await page.waitForSelector('.art.proto', { timeout: 20000 }); }
      catch { mounted = false; }   // reported as a failure, not thrown as a crash
    }
    await page.waitForTimeout(SETTLE_MS);
    const seen = await page.evaluate(() => {
      const running = (document.getAnimations ? document.getAnimations() : [])
        .filter((a) => a.playState === 'running');
      const label = (a) => {
        const target = a.effect && a.effect.target;
        const where = target && target.nodeName
          ? target.nodeName.toLowerCase() +
            (typeof target.className === 'string' && target.className
              ? '.' + target.className.trim().split(/\s+/).slice(0, 2).join('.')
              : '')
          : '?';
        return `${a.animationName || a.transitionProperty || a.constructor.name}@${where}`;
      };
      const smil = [...document.querySelectorAll('animate,animateTransform,animateMotion')]
        .map((e) => `${e.getAttribute('attributeName') || e.nodeName}@${(e.parentElement || {}).nodeName || '?'}`);
      return { css: running.map(label), smil };
    });
    return { ...seen, mounted };
  } finally {
    await page.close();
  }
}

/* ── 1 · under reduce, all 27 surfaces are still ──────────────────────────── */

R.group(`1 · reduced motion: zero running animations and zero SMIL across ${SURFACES.length} surfaces`);

const reduceCtx = await browser.newContext({
  reducedMotion: 'reduce',
  viewport: { width: 1280, height: 900 },
});

let stillMoving = 0;
let unmounted = 0;
for (const s of SURFACES) {
  const { css, smil, mounted } = await census(reduceCtx, s.url);
  // Asserted BEFORE the motion result, because it qualifies it: a surface that
  // never mounted has a meaningless census, and "0 animations" on a fallback is
  // the shape of a green that proves nothing.
  if (!mounted) {
    unmounted++;
    R.ok(false, `1 · ${s.name} · simulator mounted (.art.proto) before census`,
      'the lazy chunk never arrived, so the census below measured a Suspense fallback');
  }
  const clean = css.length === 0 && smil.length === 0;
  if (!clean) stillMoving++;
  R.ok(clean, `1 · ${s.name} · still under reduce (css ${css.length}, smil ${smil.length})`,
    [css.length ? `CSS : ${[...new Set(css)].slice(0, 6).join(' | ')}` : '',
     smil.length ? `SMIL: ${[...new Set(smil)].slice(0, 6).join(' | ')}` : ''].filter(Boolean).join('\n     '));
}
R.ok(stillMoving === 0, `1 · ${SURFACES.length - stillMoving} of ${SURFACES.length} surfaces reach zero motion under reduce`);
R.ok(unmounted === 0, `1 · all ${SIMS.length} simulator surfaces mounted before being censused`,
  `${unmounted} censused a Suspense fallback — their motion results above are vacuous`);
await reduceCtx.close();

/* ── 2 · the gate is measuring something ─────────────────────────────────────
 *
 * A "no animations found" result is indistinguishable from "the page never
 * loaded" unless the same census finds animations when motion is ALLOWED. This
 * section is what stops §1 from passing green against a blank server. It is a
 * sample, not a sweep: one canvas-free simulator and one mempool view, chosen
 * because both were confirmed by hand to animate under no-preference.
 */

R.group('2 · control: the same surfaces DO animate with motion allowed');

const motionCtx = await browser.newContext({
  reducedMotion: 'no-preference',
  viewport: { width: 1280, height: 900 },
  // ?tier=high pins the device tier, so a heuristic that lands `low` in CI
  // (deviceTier.ts folds low-core/small-viewport into it) cannot silently
  // suppress the very motion this control is looking for.
});
for (const probe of [`${BASE}/learn/sim?p=dandelion&tier=high`, `${BASE}/live/mempool?v=sediment&tier=high`]) {
  const { css, smil } = await census(motionCtx, probe);
  R.ok(css.length + smil.length > 0,
    `2 · ${probe.replace(BASE, '')} · animates when motion is allowed (css ${css.length}, smil ${smil.length}) — proves §1 measured a live page`);
}
await motionCtx.close();

await browser.close();
process.exit(R.finish());
