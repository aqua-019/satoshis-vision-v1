// verify-fit.mjs — proves P1 fit-to-view for the four wide mempool views at both
// desktop (1440) and mobile (390). Run after `npm run build` with the preview server up:
//   npm run build && (npm run preview &) && sleep 2 && node verify-fit.mjs
//
// For reactor/bridge/sediment/constellation it asserts, on load:
//   • .mp-canvas-scroll has NO horizontal overflow (scrollWidth ≈ clientWidth)
//   • the content is scaled (a non-identity transform on .mp-fit, and the
//     .mp-view--fit box is narrower than the natural content width)
//   • reactor also has no vertical overflow (it fits both axes at 1440)
//   • vertical scroll still works on the tallest view (sediment)
// Plus: the fit/100% toggle switches reactor to true size + horizontal pan.

import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const base = 'http://localhost:4173';

/* HEIGHT_FIT_TOLERANCE is PARSED, never restated. The gate whose job is to
 * police the fit maths is the last place a hand-copied constant should live —
 * a drifted copy here would make this file agree with itself and disagree with
 * the app, which is the failure mode it exists to catch. Same rule as scenario
 * 8a parsing LIMB_K out of orb.ts. If the declaration moves or is renamed this
 * throws immediately rather than silently falling back to a literal. */
const HEIGHT_FIT_TOLERANCE = (() => {
  const src = readFileSync(new URL('./src/mempool/useFitToView.ts', import.meta.url), 'utf8');
  const m = src.match(/const\s+HEIGHT_FIT_TOLERANCE\s*=\s*([0-9.]+)\s*;/);
  if (!m) throw new Error('verify-fit: could not parse HEIGHT_FIT_TOLERANCE out of src/mempool/useFitToView.ts');
  return Number(m[1]);
})();
console.log('HEIGHT_FIT_TOLERANCE (parsed from source):', HEIGHT_FIT_TOLERANCE);

/* WHICH VIEWS ARE UNDER THE CANVAS BUDGET AT THE 1440 REFERENCE VIEWPORT.
 *
 * Declared and asserted in BOTH directions, because the assertion above is
 * conditional on which side of canvasW a view falls and is therefore satisfied
 * either way — the contract records exactly this: a view can silently acquire a
 * scale transform, drop its type below the floor, and no gate goes red.
 *
 * `true`  = must fit unscaled. Defends a width fix that was paid for.
 * `false` = recorded debt: still over budget today. If you FIX one of these,
 *           this map is what tells you to come and say so.
 */
/* Does reactor's height clause fire at each tested viewport? Declared, and
 * checked BOTH WAYS, because "reactor is outside the hazard band" is a claim no
 * composition can make: the band is ~8% wide, relative to the width scale, and
 * positioned by naturalH, so every layout has window heights that scale it.
 * What IS assertable is the per-viewport fact, and a composition change that
 * moves the band across one of these cells goes red here instead of silently
 * altering the rendered type size. Values are MEASURED, not predicted.
 */
const HEIGHT_CLAUSE_AT = {
  'desktop': false,            // 1440x900   canvasH 702 — far below the band
  'desktop-rail-band': false,  // 1280x900   wS 0.8644 pulls the band down out of reach
  'mobile': false,             // canvas is overflow-y:hidden, so boundedV is false and it cannot fire
};

const FITS_AT_1440 = {
  reactor: true,        // v2·4: artboard made definite at ARTBOARD_W 1180. Was 1668 fixtured / 1413 empty.
  constellation: true,  // v2·2: 1132 after its caption was capped. Was 1413 unbounded.
  bridge: false,        // 2517 — Ops Bridge is the next v2 rebuild.
  sediment: false,      // 3281 — repeat(12, 1fr) amplification, two co-equal drivers. Contract §8.
};

// Prefer the locally-cached Chromium; some sandboxes can't download WebKit (CDN not
// allowlisted). The CSS under test (transform/overflow) is engine-agnostic.
function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const p = root + '/' + d + '/chrome-linux/chrome';
    if (existsSync(p)) return p;
  }
  return undefined;
}

let b, engine = 'chromium';
try {
  const executablePath = findChrome();
  b = await chromium.launch(executablePath ? { executablePath } : {});
} catch {
  engine = 'webkit';
  b = await webkit.launch();
}
console.log('engine:', engine);

let fail = false;
let skipped = 0;
const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail = true; };

/* Canonical routes + a landing assertion. This file navigated to `/mempool?v=`
 * — a pre-v6.1.6 name and a redirect source since. It was not producing wrong
 * answers (serve-dist has no 301s, so RedirectTo runs client-side and preserves
 * the query), but the gate's correctness rested on verify-redirects' contract
 * with nothing stating the dependency, and a dropped redirect would have made
 * it measure a different page rather than go red. `landed` is what makes that
 * failure loud. */
const strays = new Set();
let navs = 0;
const landed = async (p, want) => {
  navs++;
  const at = await p.evaluate(() => location.pathname);
  if (at !== want) strays.add(`${at} (wanted ${want})`);
};

const VIEWS = ['reactor', 'bridge', 'sediment', 'constellation'];
/* 1440x1000 IS NOT A ROUND NUMBER, IT IS DERIVED — and it is the whole reason
 * the height-clause arm of the predicate above is more than decoration.
 *
 * `HEIGHT_FIT_TOLERANCE` changes the rendered scale of every fit-enabled view
 * and has been carried on the open-debt list as "zero gate coverage" precisely
 * because this file tested 900 and 844, and the clause fires at NEITHER, for any
 * view. A predicate that handles a branch no viewport reaches is coverage on
 * paper: `clauseFires` would compute false on every run forever.
 *
 * The band is derived, not guessed, and it MOVES WITH THE COMPOSITION — which
 * is why this viewport was retuned rather than left at a round number.
 * `canvasH ~= viewportH - 198` (measured constant across six viewport heights),
 * and with wS = 1 the clause fires while 0.92 <= canvasH / naturalH < 1:
 *     naturalH 851 -> viewportH [ 981, 1049)      <- an earlier composition
 *     naturalH 956 -> viewportH [1078, 1154)      <- what ships
 * 1000 exercised the clause against 851 and does NOT against 956. Leaving it
 * would have kept a green cell that had silently stopped testing anything —
 * the vacuity this suite keeps finding. 1100 sits mid-band for the shipped
 * height. If reactor's height moves again, this number moves with it, and
 * HEIGHT_CLAUSE_AT below is what makes that failure loud rather than silent.
 *
 * Reactor is the load-bearing cell at this viewport: with naturalW 1180 == the
 * 1180 canvas, wS is 1, so ONLY the height clause can produce a transform. That
 * is exactly the disagreement the old width-only predicate could not represent —
 * width alone predicts no transform while one exists.
 *
 * Consequence worth stating plainly rather than burying: reactor renders scaled
 * for window heights inside its band, so its authored 11px paints near 10.4px
 * there. That is a real range of laptop windows. It is unavoidable — every
 * composition has such a band and moving the height moves the band with it
 * (contract §8) — and it is now OBSERVED rather than silent.
 */
/* 1280x900 IS THE WIDTH ANALOGUE, AND IT PINS A BAND NOTHING ASSERTED.
 *
 * `styles.css:2149` hides `.shell > .rail` at `(min-width: 769px) and
 * (max-width: 1279px)`. So widening the window from 1279 to 1280 makes the
 * canvas 259px NARROWER, and it does not recover reactor's 1180 budget until
 * viewport 1440. Measured across the ladder:
 *
 *   viewport   canvasW   rail    scale at natW 1180   authored 11px renders
 *       1216      1216   none                1.0000                  11.00px
 *       1279      1279   none                1.0000                  11.00px
 *       1280      1020   FLEX                0.8644                   9.51px
 *       1366      1106   flex                0.9373                  10.31px
 *       1439      1179   flex                0.9992                  10.99px
 *       1440      1180   flex                1.0000                  11.00px
 *       1920      1660   flex                1.0000                  11.00px
 *
 * So reactor meets the type floor at viewport >= 1440 and at <= 1279, and misses
 * it across 1280-1439 — which contains 1366, the most common laptop width there
 * is, and where a NARROWER window works while a wider one does not.
 *
 * v2·4 did not create this band, it REVEALED it: at naturalW 1668 every viewport
 * was under the floor (0.707 at 1440, 0.663 at 1366), so nothing distinguished
 * 1280-1439 from anywhere else. Lifting the view to 1180 clears the floor
 * everywhere except here.
 *
 * THE FIX IS ONE LINE AND IT IS DELIBERATELY NOT THIS PR'S: `:2149`'s upper
 * bound 1279 -> 1439 closes the band exactly. It changes layout for every view
 * at 1280-1439, `verify-pageshell` is npm-wired only so CI would not catch the
 * fallout, and that same media block already has a history — its duplicate at
 * `:2643` is what hid Terminal's rail and took #170 to find. This viewport
 * exists so that when someone does make that change, a gate says so.
 */
const VPS = [
  { w: 1440, h: 900, name: 'desktop' },
  { w: 1280, h: 900, name: 'desktop-rail-band' },
  { w: 390, h: 844, name: 'mobile' },
];

for (const vp of VPS) {
  const p = await b.newPage({ viewport: { width: vp.w, height: vp.h } });
  for (const v of VIEWS) {
    await p.goto(`${base}/live/mempool?v=${v}`, { waitUntil: 'networkidle' });
    await landed(p, '/live/mempool');
    await p.waitForSelector('.mp-view--fit .mp-fit');
    // Settle to a STABLE transform rather than sleeping a fixed 150ms. A
    // transient `matrix(1,0,0,1,0,0)` was observed once in three runs at 1280 on
    // a view whose settled transform is 0.864407 (confirmed stable from 0ms by a
    // standalone probe), i.e. the flat wait was marginal under load. Two
    // consecutive agreeing reads is deterministic where a bigger sleep is only
    // less-often-wrong.
    await p.waitForTimeout(120);
    for (let i = 0, prev = null; i < 12; i++) {
      const cur = await p.evaluate(() => getComputedStyle(document.querySelector('.mp-fit')).transform);
      if (cur === prev) break;
      prev = cur;
      await p.waitForTimeout(60);
    }
    const r = await p.evaluate(() => {
      const sc = document.querySelector('.mp-canvas-scroll');
      const box = document.querySelector('.mp-view--fit');
      const fit = document.querySelector('.mp-fit');
      return {
        sw: sc.scrollWidth, cw: sc.clientWidth, sh: sc.scrollHeight, ch: sc.clientHeight,
        transform: getComputedStyle(fit).transform,
        natW: fit.offsetWidth,
        // v2·4: naturalH and the canvas's overflow-y are the two inputs the
        // height clause reads. Without them this gate could only ever predict a
        // transform from WIDTH, while useFitToView derives it from both.
        natH: fit.offsetHeight,
        overflowY: getComputedStyle(sc).overflowY,
        boxW: Math.round(box.getBoundingClientRect().width),
        boxH: Math.round(box.getBoundingClientRect().height),
      };
    });
    ok(r.sw - r.cw <= 2, `${vp.name} ${v}: no horizontal overflow (scrollW ${r.sw} − clientW ${r.cw} = ${r.sw - r.cw})`);
    const identity = !r.transform || r.transform === 'none' || r.transform === 'matrix(1, 0, 0, 1, 0, 0)';
    // A view only has to scale when it is genuinely wider than its canvas.
    // Constellation's natural width fell below the 1440 desktop canvas at some
    // point before v6.0.2 (it fails this assertion at bf7fc80 too, with natural
    // 1000), so demanding a scale-down there asserted a fact that had stopped
    // being true. Identity transform on a view that already fits is correct
    // behaviour, not a regression.
    //
    // v2·4 — THE PREDICATE NOW MIRRORS `compute()` INSTEAD OF HALF OF IT.
    // `mustScale` was named for "should a transform exist?" but computed "is it
    // too wide?", and useFitToView.ts:58-65's HEIGHT clause can produce a
    // transform when width alone says none is needed. That gap was harmless
    // only while every fit view was width-bound: the moment a view's naturalW
    // drops under the canvas (reactor, this PR), a firing height clause makes
    // this assertion take its `: identity` branch and fail — printing "fits
    // unscaled, no transform applied" while a transform IS applied, sending the
    // reader to inspect the wrong thing. Subject narrower than claim, living in
    // a predicate.
    //
    // The band is ~8% wide and RELATIVE TO THE WIDTH SCALE, and canvasH tracks
    // the browser window, so every composition has window heights that fire it —
    // there is no layout that escapes, only one that moves the band. See the
    // contract §8. TOL is PARSED out of the source rather than restated here,
    // for the same reason scenario 8a parses LIMB_K: a restated constant in the
    // one file whose job is to police that constant is where drift hides.
    const wS = Math.min(1, r.cw / r.natW);
    const boundedV = r.ch > 0 && r.overflowY !== 'hidden';
    const hS = boundedV ? r.ch / r.natH : null;
    const clauseFires = hS !== null && hS < wS && hS >= wS * HEIGHT_FIT_TOLERANCE;
    const expectTransform = wS < 1 || clauseFires;
    // THE SHRINK CONJUNCT MUST FOLLOW THE DRIVING AXIS. `boxW < natW` silently
    // assumed width-driven scaling and is FALSE for a height-driven one: with
    // wS === 1 the wrapper's inline width is the scaled width (1112 for reactor
    // at 1440x1000) but `.mp-view` carries `min-width: 100%` (styles.css:1229),
    // so the rendered box is pinned back to the canvas's 1180 and the conjunct
    // fails against a view behaving perfectly. Measured, not predicted — it is
    // why the first version of this predicate still went red at 1440x1000 after
    // the transform half was already correct.
    const shrunk = wS < 1 ? r.boxW < r.natW - 1 : r.boxH < r.natH - 1;
    // NOT asserted: applied scale === predicted scale. It is the stronger claim
    // and it is TIMING-DEPENDENT — a view's natural size settles after load, and
    // sediment was caught mid-settle at 2080x1414 while measuring 3281x1761 at
    // rest, so the applied transform legitimately corresponds to a size that is
    // no longer current. The qualitative form is invariant under that race; an
    // equality would have been a flake generator. Named per §9 rather than left
    // for someone to discover: what this predicate cannot see is a transform of
    // the WRONG MAGNITUDE in the right direction.
    ok(expectTransform ? (!identity && shrunk) : identity,
      `${vp.name} ${v}: ${expectTransform
        ? `scaled to fit (transform ${r.transform}; ${
            wS < 1 ? `box ${r.boxW} < natural ${r.natW}; width-bound wS ${wS.toFixed(6)}`
                   : `boxH ${r.boxH} < naturalH ${r.natH}; WIDTH FITS — the height clause fired: hS ${hS.toFixed(6)} in [${(wS * HEIGHT_FIT_TOLERANCE).toFixed(6)}, ${wS.toFixed(6)})`})`
        : `fits unscaled, no transform applied (natural ${r.natW}x${r.natH} <= canvas ${r.cw}x${r.ch}${
            hS === null ? ', height clause N/A — canvas is not vertically bounded' : `; hS ${hS.toFixed(6)} outside [${(wS * HEIGHT_FIT_TOLERANCE).toFixed(6)}, ${wS.toFixed(6)})`})`}`);
    if (vp.name === 'desktop') {
      // The standing check the width work needed and did not have. Asserted in
      // both directions so the map cannot rot into a list of things that used to
      // be true — a `false` row going green is a fix nobody recorded.
      const fits = r.natW <= r.cw + 1;
      ok(fits === FITS_AT_1440[v],
        `desktop ${v}: natural width ${r.natW} vs canvas ${r.cw} — ${
          FITS_AT_1440[v]
            ? (fits ? 'under budget, as declared' : `OVER BUDGET. This view is declared fits:true; it has regressed and is now scaled by ${(r.cw / r.natW).toFixed(6)}, so its authored 11px renders at ${(11 * r.cw / r.natW).toFixed(2)}px`)
            : (fits ? 'now UNDER budget — this is a fix, and FITS_AT_1440 still records it as debt. Update the map and say so in the PR body.' : 'still over budget, as recorded')}`);
    }
    if (v === 'reactor') {
      /* WHAT THIS REPLACED, AND WHY — v2·4, and this is the third assertion in
       * this file whose SUBJECT stopped matching its CLAIM. All three are one
       * pass with one reason, not three ad-hoc edits:
       *   · the 100%-toggle pan asserted a symptom the width fix removes
       *   · `mustScale` predicted a transform from WIDTH while useFitToView
       *     derives it from width AND height
       *   · this one proxied for a failure `FITS_AT_1440` now detects directly
       *
       * It used to read `scrollH - clientH <= 200`, and its own comment gave the
       * subject: "a sliver, not a symptom of THE FIT MATH FAILING ALTOGETHER."
       * That was the right check while reactor was width-bound and scaled — a
       * big vertical scroll then meant the fit had given up. Reactor is now
       * deliberately unscaled at naturalW 1180 == canvasW, so vertical scroll is
       * ordinary: bridge, sediment and constellation all scroll and always have.
       * The 200 was calibrated at 84px measured on a SCALED reactor; applying it
       * to an unscaled one is the same category of error the comment four lines
       * further down was written to reject.
       *
       * SELF-REFERENTIAL JUSTIFICATION, STATED RATHER THAN HIDDEN: the assertion
       * being leaned on here — `FITS_AT_1440` — is ONE PR OLD and was added by
       * the same change that retires this one. That is not disqualifying (the
       * new check is strictly more direct: it reads naturalW against canvasW
       * instead of inferring it from a scroll delta) but a reader who spots it
       * before the file admits it is right to discount the argument, so the file
       * admits it.
       */

      // 1 · THE RUNAWAY CAP — derived, not chosen to clear the current value.
      // A view may legitimately be taller than its canvas; that is what a scroll
      // container is for. What is never legitimate is a composition so tall the
      // canvas shows less than half of it, because then the "view" is a scroll
      // position rather than a view. 2x canvasH is that line, and it is stated
      // as a RATIO precisely so it cannot be tuned to a measurement: canvasH
      // tracks the window (~viewportH - 198), so a fixed pixel cap would mean
      // something different on every screen.
      //
      // GATED ON `boundedV`, and the first version was NOT — it failed at 390
      // against a view behaving correctly, which is this suite's own favourite
      // defect committed inside a new assertion. On the phone the canvas is
      // `overflow-y: hidden; height: auto` and the PAGE scrolls, so `clientHeight`
      // there tracks CONTENT rather than a window onto it: `2 x canvasH` is not a
      // bound, it is a restatement of the content height. Measured, mobile reads
      // natural 1384 against canvas 458 and would fail forever. Same predicate
      // `useFitToView.ts:57-59` uses to exclude mobile from the height clause,
      // for the same reason. Reported as a reasoned skip rather than silently
      // not asserted — a silent non-measurement and a measurement of zero are the
      // same line in a report.
      if (boundedV) {
        ok(r.natH <= 2 * r.ch,
          `${vp.name} reactor: height is bounded (natural ${r.natH} <= 2 x canvas ${r.ch} = ${2 * r.ch}; showing ${(100 * r.ch / r.natH).toFixed(1)}% per screen)`);
      } else {
        skipped++;
        console.log(`⏭  SKIP — ${vp.name} reactor height cap: the canvas is not vertically bounded here `
          + `(overflow-y ${r.overflowY}, the page scrolls), so clientHeight ${r.ch} tracks content and 2x it would not be a bound. `
          + `Natural height ${r.natH}, not asserted.`);
      }

      // 2 · THE HEIGHT-CLAUSE BAND, ASSERTED PER VIEWPORT — never as a universal.
      // `HEIGHT_CLAUSE_AT` declares, for each tested viewport, whether the clause
      // is expected to fire, and it is checked BOTH WAYS. This is deliberately
      // NOT phrased as "reactor is out of the hazard band": no composition is.
      // Measured, for three candidate heights considered during this rebuild,
      // the band in viewport-height terms is
      //     naturalH 851 -> [ 981, 1049)     876 -> [1004, 1074)     956 -> [1078, 1154)
      // and every one contains a common desktop window height. The band moves
      // with the composition; it never goes away (contract §8). So the honest
      // claim is per-viewport, and its value is that a composition change which
      // silently moves the band across one of these viewports goes red here.
      const expected = HEIGHT_CLAUSE_AT[vp.name];
      ok(expected !== undefined && clauseFires === expected,
        expected === undefined
          ? `${vp.name} reactor: viewport not declared in HEIGHT_CLAUSE_AT — add it rather than leaving the band unchecked`
          : `${vp.name} reactor: height clause ${clauseFires ? 'FIRES' : 'does not fire'} as declared `
            + `(hS ${hS === null ? 'n/a — canvas not vertically bounded' : hS.toFixed(6)}, band [${(wS * HEIGHT_FIT_TOLERANCE).toFixed(6)}, ${wS.toFixed(6)}))`);
    }
    if (v === 'sediment') {
      const vy = await p.evaluate(() => {
        const sc = document.querySelector('.mp-canvas-scroll');
        if (sc.scrollHeight > sc.clientHeight + 2) { sc.scrollTop = 200; return { mode: 'canvas', ok: sc.scrollTop > 50 }; }
        if (document.documentElement.scrollHeight > window.innerHeight + 2) { window.scrollTo(0, 200); return { mode: 'page', ok: window.scrollY > 50 }; }
        return { mode: 'fits', ok: true }; // scaled view fits the viewport — nothing to scroll, which is correct
      });
      ok(vy.ok, `${vp.name} sediment: vertical ${vy.mode === 'fits' ? 'view fits viewport (whole, no scroll needed)' : 'scroll works (' + vy.mode + ')'}`);
    }
  }
  await p.close();
}

/* Fit/100% toggle: switching reactor to 100% restores true size, and pans WHERE
 * TRUE SIZE EXCEEDS THE CANVAS.
 *
 * v2·4 — THIS ASSERTION'S SUBJECT MOVED, so the assertion moved with it. It ran
 * only at 1440 and asserted the pan UNCONDITIONALLY, which was sound for exactly
 * as long as reactor was wider than its canvas (natural 1413 vs 1180). Reactor is
 * now 1180 by construction, so at 1440 "fit" and "100%" are the SAME geometry and
 * there is nothing left to pan: the old form would have gone red against a view
 * behaving correctly, asserting a symptom the fix removes.
 *
 * The pan path is not dropped, it is RELOCATED to where it still has a subject:
 * 1280, where canvasW is 1020 against the same 1180 artboard, so 100% pans 160px.
 * A live positive control rather than a waiver. The 1440 cell keeps the identity
 * claim and states the no-pan case POSITIVELY rather than skipping it, because a
 * silent non-measurement and a measurement of zero are the same line in a report.
 *
 * 390 WAS THE FIRST CHOICE AND IT IS WRONG — recorded because it is the obvious
 * guess and it cost a red run. A phone canvas looks like the ideal pan case
 * (390 against 1180), but `.mp-view--fit` is clamped to the canvas width there,
 * so 100% mode produces boxW 390, scrollW 390 and scrollLeft 0: the toggle is
 * INERT at 390. Measured across the band, 100% mode pans at 1280/1100/1024/900/
 * 800/769 (every canvasW < 1180) and nowhere at 1440/1600/1920/2560 or at 390.
 * Terminal panning at 390 is not a counter-example — it is a NON-fit view pinned
 * to `width: 900px` by `styles.css`, a different mechanism entirely.
 *
 * Follow-on, recorded not fixed: the zoom control RENDERS at 390 (MempoolPage
 * gates it on `meta.fit` only) while being incapable of changing the geometry
 * there. That is pre-existing and was untested — the old assertion ran at 1440
 * only — and it is a control question, not a fit-maths one.
 */
/* THE HEIGHT-CLAUSE CONTROL — the viewport is DERIVED, not chosen.
 *
 * This started as a hand-picked `1440x1000`, which exercised the clause against
 * a naturalH of 851. The composition grew to 956 and the cell silently stopped
 * testing anything; retuned to 1100, the iso-stack fix took naturalH to 1031 and
 * it went stale AGAIN — caught only because HEIGHT_CLAUSE_AT asserts the
 * expectation in both directions. Two staleness events in one PR is the signal
 * that the number was the wrong thing to write down.
 *
 * So: measure reactor's naturalH first, then compute a viewport that lands
 * mid-band for THAT height, then assert the clause fires there. The control
 * follows the composition instead of being recalibrated after it.
 *
 *   clause fires while   0.92 <= canvasH / naturalH < 1     (at wS = 1)
 *   canvasH ~= viewportH - CHROME_H                          (measured constant)
 *   pick canvasH = 0.96 * naturalH  ->  mid-band by construction
 *
 * If this ever fails, the interesting quantity is CHROME_H, not the viewport.
 */
const CHROME_H = 198;
{
  const p0 = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p0.goto(`${base}/live/mempool?v=reactor`, { waitUntil: 'networkidle' });
  await p0.waitForSelector('.mp-view--fit .mp-fit');
  await p0.waitForTimeout(300);
  const natH = await p0.evaluate(() => document.querySelector('.mp-fit').offsetHeight);
  await p0.close();

  const wantCanvasH = Math.round(0.96 * natH);
  const vh = wantCanvasH + CHROME_H;
  const p1 = await b.newPage({ viewport: { width: 1440, height: vh } });
  await p1.goto(`${base}/live/mempool?v=reactor`, { waitUntil: 'networkidle' });
  await landed(p1, '/live/mempool');
  await p1.waitForSelector('.mp-view--fit .mp-fit');
  await p1.waitForTimeout(300);
  const r = await p1.evaluate(() => {
    const sc = document.querySelector('.mp-canvas-scroll');
    const fit = document.querySelector('.mp-fit');
    return { cw: sc.clientWidth, ch: sc.clientHeight, natW: fit.offsetWidth, natH: fit.offsetHeight,
             transform: getComputedStyle(fit).transform };
  });
  const wS = Math.min(1, r.cw / r.natW);
  const hS = r.ch / r.natH;
  const fires = hS < wS && hS >= wS * HEIGHT_FIT_TOLERANCE;
  const identity = r.transform === 'none' || r.transform === 'matrix(1, 0, 0, 1, 0, 0)';
  ok(fires && !identity,
    `height-clause control @1440x${vh} (DERIVED from naturalH ${natH}): the clause fires and a transform IS applied `
    + `(hS ${hS.toFixed(6)} in [${(wS * HEIGHT_FIT_TOLERANCE).toFixed(6)}, ${wS.toFixed(6)}), transform ${r.transform}) — `
    + `this is the one cell where width alone predicts NO transform and one exists`);
  await p1.close();
}

/* Three cells, because the control needs BOTH a subject and durability.
 *   reactor @1440  — identity, and NOTHING to pan: the fix's own outcome, stated
 *                    positively rather than skipped.
 *   reactor @1280  — the live pan control ON THE ACTUAL SUBJECT. canvasW 1020 vs
 *                    the 1180 artboard, so 100% pans 160px.
 *   sediment @1440 — the DURABLE control. reactor's pan cell depends on reactor
 *                    staying wider than a 1020 canvas; sediment is 3281 against
 *                    1180 and nothing on the roadmap proposes shrinking it, so
 *                    the toggle keeps a test even if reactor narrows again.
 * Two hosts, not one, for the same reason the map above is asserted both ways:
 * a control whose only subject can be fixed away is a control with an expiry date.
 */
const TOGGLE_CELLS = [
  { view: 'reactor', w: 1440, h: 900, name: 'reactor@1440' },
  { view: 'reactor', w: 1280, h: 900, name: 'reactor@1280' },
  { view: 'sediment', w: 1440, h: 900, name: 'sediment@1440' },
];

for (const vp of TOGGLE_CELLS) {
  const p = await b.newPage({ viewport: { width: vp.w, height: vp.h } });
  await p.goto(`${base}/live/mempool?v=${vp.view}`, { waitUntil: 'networkidle' });
  await landed(p, '/live/mempool');
  await p.waitForSelector('.mp-zoom__btn');
  await p.waitForTimeout(150);
  const btns = await p.$$('.mp-zoom__btn');
  await btns[1].click(); // "100%"
  await p.waitForTimeout(700); // let the 250ms transform transition fully settle
  const r = await p.evaluate(() => {
    const sc = document.querySelector('.mp-canvas-scroll');
    const fit = document.querySelector('.mp-fit');
    sc.scrollLeft = 200;
    return {
      transform: getComputedStyle(fit).transform,
      sw: sc.scrollWidth, cw: sc.clientWidth, left: sc.scrollLeft, natW: fit.offsetWidth,
    };
  });
  const identity = r.transform === 'none' || r.transform === 'matrix(1, 0, 0, 1, 0, 0)';
  ok(identity, `${vp.name} toggle 100%: at true size (transform ${r.transform}; natural ${r.natW})`);
  const canPan = r.natW > r.cw + 50;
  ok(canPan ? (r.sw - r.cw > 50 && r.left > 50) : (r.sw - r.cw <= 2 && r.left === 0),
    canPan
      ? `${vp.name} toggle 100%: pans horizontally (scrollW ${r.sw} > clientW ${r.cw}, left ${r.left})`
      : `${vp.name} toggle 100%: nothing to pan — true size ${r.natW} fits canvas ${r.cw}, so scrollW ${r.sw} − clientW ${r.cw} = ${r.sw - r.cw} and scrollLeft stays ${r.left}`);
  await p.close();
}

// Reported positively rather than only on failure: a guard that prints nothing
// when it passes cannot be told apart from a guard that never ran.
ok(strays.size === 0, strays.size === 0
  ? `all ${navs} navigations landed on /live/mempool (no redirect hop)`
  : `navigations did not land as requested: ${[...strays].join(', ')}`);

await b.close();
console.log(`\nverify-fit: ${skipped} reasoned skip(s) — a skip is neither a pass nor a failure.`);
console.log(fail ? 'FIT CHECKS FAILED' : 'ALL FIT CHECKS PASSED');
process.exit(fail ? 1 : 0);
