/**
 * verify-pageshell.mjs — the responsive gate for the PageShell migration (v6.0.4).
 *
 * Runs a 17-entry × 6-width matrix against `vite preview`
 *
 * MEASURE THAT FIGURE, DO NOT READ IT OFF THIS SENTENCE — it said "15-route"
 * against a 16-entry table for the whole p3·16 → p4·03 series, and the word
 * "route" was the reason nobody caught it: this table is NOT the canonical
 * route set. It deliberately omits two real routes (/live/markets/thesis,
 * /future/outlook) and deliberately adds four non-canonical paths (a 64-hex
 * tx deep link, /learn/timeline, /monero/bottomline, /__nope__), so it can
 * never equal ROUTES.length and comparing it to that number is a category
 * error. It is a curated WIDTH-SWEEP surface. Count the rows:
 *   node -e "const s=require('fs').readFileSync('verify-pageshell.mjs','utf8');
 *            console.log(s.match(/const ROUTES = \[([\s\S]*?)\n\];/)[1]
 *              .split('\n').filter(l=>/\{\s*path:/.test(l)).length)"
 *
 * (http://localhost:4173) and asserts the four facts the migration is supposed
 * to buy:
 *
 *   1. NO HORIZONTAL SCROLL anywhere — measured on BOTH document.documentElement
 *      and main.main. The .main metric is not optional: `.art { overflow:hidden }`
 *      plus `.main { overflow-x:hidden }` mean desktop overflow is CLIPPED, never
 *      scrolled, so the documentElement metric alone is vacuous above 768px.
 *      Tolerance 2px (matches verify-mobile.mjs; at <=768 .mp-canvas-scroll's
 *      negative margins over-cancel .main's padding by 2px — pre-existing).
 *      Fluid routes skip the .main metric: .mp-canvas-scroll is an intentional
 *      pan box, so `.main--fluid` is *supposed* to contain a wider child.
 *   2. TIER WIDTHS — exactly one .page-shell per non-fluid route, its rendered
 *      width equals PAGE_W[data-w] from layout/PageShell.tsx (±1px), and fluid
 *      routes render ZERO .page-shell elements. This is the half of the PAGE_W
 *      contract that lives in styles.css; the TS constant is the other half.
 *   3. RAIL STATE — `.shell` grid track count + `.shell > .rail` visibility.
 *      Includes the unpaired-rule regression check: if a future edit hides the
 *      rail without also writing `grid-template-columns: 1fr`, .main auto-places
 *      into the leftover 260px track. Asserting "one track" alone would not
 *      catch the inverse (template collapsed, rail still shown), so both the
 *      track count AND .main's own width are measured.
 *   4. CONTENT SURVIVAL — the migration was chrome-only, so the Bottom Line
 *      page's headline numbers must still be in the DOM.
 *
 * BOOT STATE: this sandbox reaches no live data, so every route boots to its
 * skeleton / "CONNECTING" state. That is a VALID layout state — all chrome here
 * is non-data-conditional — so the script waits on `.art-stage` (the shell) with
 * `waitUntil: "domcontentloaded"`, never `networkidle`, which would stall
 * forever on the failing /api/* fetches. Network flake is never reported as a
 * layout failure.
 */

import { chromium, webkit } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { coldBootOffBrowser } from './verify-lib.mjs';

const base = 'http://localhost:4173';
const TXID = 'a1b2c3d4'.repeat(8); // 64 hex chars — MempoolTxPage renders "not found" chrome, which is what we measure

// The CSS under test is engine-agnostic; prefer Chromium (the build present in
// this sandbox), fall back to WebKit.
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

/* COLD-BOOT BYPASS — added p4·02, and it closes a REAL hole rather than a
 * theoretical one. ROUTES[0] here is `{ path: '/' }`, where ColdBoot mounts a
 * `position:fixed; inset:0` splash over an opaque floor, so without this the
 * `/` row of every table below measures THE SPLASH and reports a confident
 * page-shell number about the wrong page state.
 *
 * `verify-coldboot-live`'s audit did not see this gate for years because its
 * "a route ARRAY containing '/'" pattern matches BARE STRING elements, and
 * this file's ROUTES holds OBJECTS (`{ path, label, tier }`). p4·02 widened
 * that audit to notice `for (… of ROUTES)`, and this was the first thing it
 * found. */
await coldBootOffBrowser(b);

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

/** Mirrors PAGE_W in src/layout/PageShell.tsx. Change one, change both. */
const PAGE_W = { wide: 1680, standard: 1440, reading: 1180 };

const ROUTES = [
  { path: '/',                   label: '/',                    tier: 'wide' },
  { path: '/live/mempool',       label: '/live/mempool',             tier: 'fluid',    rail: true },
  { path: `/live/mempool/tx/${TXID}`, label: '/live/mempool/tx/<64-hex>', tier: 'standard' },
  { path: '/live/markets',       label: '/live/markets',             tier: 'standard', rail: true },
  { path: '/live/network',       label: '/live/network',             tier: 'standard', rail: true },
  { path: '/learn',              label: '/learn',           tier: 'reading' },
  { path: '/learn/timeline',     label: '/learn/timeline',  tier: 'reading' },
  { path: '/monero',             label: '/monero',              tier: 'standard' },
  { path: '/monero/bottomline',  label: '/monero/bottomline',   tier: 'reading' },
  { path: '/future',             label: '/future',              tier: 'wide' },
  { path: '/about/peers',        label: '/about/peers',               tier: 'standard' },
  { path: '/learn/sim',          label: '/learn/sim',            tier: 'fluid' },
  { path: '/operate/node',       label: '/operate/node',                tier: 'standard' },
  // p3·16 — the 14th route. Added here even though this gate is npm-wired
  // ONLY (held back by a PRE-EXISTING /future layout red, see CLAUDE.md), so
  // that whenever the /future fix lands and the step is wired, the newest
  // page is already inside the width sweep rather than being the one route
  // the sweep was never taught about.
  { path: '/operate/superstress', label: '/operate/superstress',        tier: 'standard' },
  // p4·04 — the 15th route, added on p3·16's stated precedent above: this
  // gate is still npm-wired only, and a route absent from the table is one
  // the sweep is never taught about on the day the /future red is fixed.
  { path: '/operate/mine',       label: '/operate/mine',               tier: 'standard' },
  { path: '/about/sources',      label: '/about/sources',             tier: 'standard' },
  { path: '/__nope__',           label: '/__nope__',            tier: 'standard' },
];
const WIDTHS = [1920, 1600, 1280, 1024, 768, 390];
const TOL = 2;      // px — overflow tolerance, matches verify-mobile.mjs
const RAIL_TRACK = 260; // px — .shell's first grid track when the rail is up

const p = await b.newPage({ viewport: { width: 1920, height: 1000 } });
p.setDefaultTimeout(25000);

/* Every route above is the canonical post-v6.1.6 path. They were the legacy
 * names (`/mempool`, `/markets`, `/network`, `/education`, `/simulate`,
 * `/peers`, `/node`, `/sources`), which are redirect SOURCES — carried
 * client-side by RedirectTo under serve-dist, so this gate's 368/0 was real
 * rather than vacuous. Three things were wrong with relying on that: the
 * dependency on verify-redirects' contract was unstated and a dropped redirect
 * would have relocated the subject rather than gone red; production resolves
 * these through a Vercel 301 that the SPA never sees, so harness and
 * production ran different paths; and the client redirect lands AFTER
 * `domcontentloaded`, so the 300ms settle below was outrunning a race nobody
 * had written down. The labels carried the legacy names too, which meant a
 * failure message would have named a URL that no longer exists.
 *
 * `strays` is the standing check: one aggregate assertion at the end, rather
 * than 90 near-identical lines across 15 routes × 6 widths. */
const strays = new Set();

/** Boot a route to its (skeleton) layout state. Never networkidle — see header. */
async function visit(route) {
  await p.goto(base + route, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.art-stage', { state: 'attached' });
  await p.waitForTimeout(300); // settle: fonts + first paint of the skeleton
  const want = route.split('?')[0];
  const at = await p.evaluate(() => location.pathname);
  if (at !== want) strays.add(`${route} → ${at}`);
}

/** One DOM read per route×width — everything assertions 1-4 need. */
function probe() {
  return p.evaluate(() => {
    const de = document.documentElement;
    const main = document.querySelector('main.main');
    const shell = document.querySelector('.shell');
    const shells = Array.from(document.querySelectorAll('.page-shell'));
    const shellRail = document.querySelector('.shell > .rail');
    const r = (el) => Math.round(el.getBoundingClientRect().width * 100) / 100;
    return {
      docS: de.scrollWidth, docC: de.clientWidth,
      mainS: main ? main.scrollWidth : null,
      mainC: main ? main.clientWidth : null,
      mainW: main ? r(main) : null,
      gtc: shell ? getComputedStyle(shell).gridTemplateColumns : null,
      psN: shells.length,
      psW: shells.length ? r(shells[0]) : null,
      psDataW: shells.length ? shells[0].getAttribute('data-w') : null,
      psClass: shells.length ? shells[0].className : null,
      railDisplay: shellRail ? getComputedStyle(shellRail).display : null,
      railW: shellRail ? r(shellRail) : null,
    };
  });
}

const tracks = (gtc) => (gtc && gtc !== 'none' ? gtc.trim().split(/\s+/) : []);

// ════════════════════════════════════════════════════════════════════════
// THE MATRIX — 15 routes × 6 widths
// ════════════════════════════════════════════════════════════════════════
for (const w of WIDTHS) {
  console.log(`\n──────── viewport ${w}px ────────`);
  await p.setViewportSize({ width: w, height: 1000 });

  for (const route of ROUTES) {
    const tag = `${route.label}@${w}`;
    await visit(route.path);
    const m = await probe();
    const fluid = route.tier === 'fluid';
    const tr = tracks(m.gtc);

    // ── 1. no horizontal scroll ────────────────────────────────────────
    const docOver = m.docS - m.docC;
    ok(docOver <= TOL, `${tag}: doc no h-scroll (scrollW ${m.docS} vs clientW ${m.docC}, over ${docOver})`);
    if (fluid) {
      console.log(`   (${tag}: .main metric skipped — fluid route, .mp-canvas-scroll is an intentional pan box)`);
    } else if (m.mainS === null) {
      ok(false, `${tag}: main.main missing — page did not render its shell`);
    } else {
      const mainOver = m.mainS - m.mainC;
      ok(mainOver <= TOL, `${tag}: .main no h-scroll (scrollW ${m.mainS} vs clientW ${m.mainC}, over ${mainOver})`);
    }

    // ── 2. tier widths (1920 only — that is where max-width binds) ─────
    if (w === 1920) {
      if (fluid) {
        ok(m.psN === 0, `${tag}: fluid route renders ZERO .page-shell (found ${m.psN})`);
      } else {
        ok(m.psN === 1, `${tag}: exactly one .page-shell (found ${m.psN})`);
        if (m.psN === 1) {
          const want = PAGE_W[route.tier];
          ok(m.psDataW === route.tier, `${tag}: data-w="${m.psDataW}" (want "${route.tier}")`);
          const got = PAGE_W[m.psDataW];
          ok(got !== undefined && Math.abs(m.psW - got) <= 1,
            `${tag}: .page-shell width ${m.psW}px == PAGE_W.${m.psDataW} (${got}) ±1`);
          ok(Math.abs(m.psW - want) <= 1, `${tag}: rendered width ${m.psW}px matches expected tier ${route.tier} (${want})`);
        }
      }
      // ── 3. home-hero passthrough ─────────────────────────────────────
      if (route.path === '/') {
        ok(m.psN === 1 && /(^|\s)home-hero(\s|$)/.test(m.psClass || ''),
          `${tag}: the single .page-shell also carries "home-hero" (class="${m.psClass}")`);
      }
    }

    // ── 4. rail state ──────────────────────────────────────────────────
    const railUp = !!route.rail && w >= 1280;
    if (railUp) {
      ok(tr.length === 2, `${tag}: .shell has TWO tracks (${m.gtc})`);
      ok(tr.length === 2 && Math.abs(parseFloat(tr[0]) - RAIL_TRACK) <= 1,
        `${tag}: first track ~${RAIL_TRACK}px (got ${tr[0]})`);
      ok(m.railDisplay !== null && m.railDisplay !== 'none' && m.railW > 0,
        `${tag}: .shell > .rail visible (display ${m.railDisplay}, width ${m.railW})`);
    } else {
      ok(tr.length === 1, `${tag}: .shell has ONE track (${m.gtc})`);
      if (route.rail) {
        ok(m.railDisplay === 'none', `${tag}: .shell > .rail display:none (got ${m.railDisplay})`);
      }
    }
    // the unpaired-rule regression: rail hidden but the 260px track left behind
    // makes .main auto-place into it. Only reachable on rail routes at 1024.
    if (w === 1024 && !fluid) {
      ok(m.mainW === null || Math.abs(m.mainW - RAIL_TRACK) > 20,
        `${tag}: main.main is NOT squeezed into the ~${RAIL_TRACK}px rail track (width ${m.mainW})`);
    } else if (w === 1024 && fluid) {
      ok(m.mainW === null || Math.abs(m.mainW - RAIL_TRACK) > 20,
        `${tag}: main.main--fluid is NOT squeezed into the ~${RAIL_TRACK}px rail track (width ${m.mainW})`);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// 5. NESTED RAIL SURVIVES — mempool/terminal.tsx renders its OWN <aside
//    class="rail"> inside the pan canvas. The 769-1279 collapse uses the CHILD
//    combinator (`.shell > .rail`) precisely so this one is not swept up.
// ════════════════════════════════════════════════════════════════════════
console.log('\n──────── nested rail · /live/mempool?v=terminal@1024 ────────');
await p.setViewportSize({ width: 1024, height: 1000 });
await visit('/live/mempool?v=terminal');
await p.waitForSelector('.mp-canvas-scroll');
const rails = await p.evaluate(() =>
  Array.from(document.querySelectorAll('.rail')).map((el) => ({
    shellChild: !!(el.parentElement && el.parentElement.classList.contains('shell')),
    display: getComputedStyle(el).display,
    w: Math.round(el.getBoundingClientRect().width),
  })));
console.log('   rails:', JSON.stringify(rails));
// MESSAGE CORRECTED IN v2·3, because this assertion went red and its own
// wording sent the reader to the one rule that was correct.
//
// It used to read "(.shell > .rail did not over-reach)". When it failed on
// 260c99f, `.shell > .rail` was behaving exactly as designed — the child
// combinator at styles.css:2157 has never matched Terminal's nested rail, and
// its comment says in as many words that this is why it is scoped. The actual
// over-reach was a SECOND, unscoped `.rail { display: none }` in an
// overlapping 769-1199 band, which the message did not mention.
//
// So the gate was right to red and wrong about why: the predicate names one
// rule and the defect was in another. That is the assertion-names-the-wrong-
// subject shape living in a FAILURE MESSAGE rather than in a predicate, and it
// is worse there — a wrong predicate is caught by the next person who reads
// it, while a wrong message is only read by someone already debugging, at the
// moment they are most likely to trust it.
//
// The message now names the property rather than a suspect rule.
ok(rails.some((r) => !r.shellChild && r.display !== 'none' && r.w > 0),
  "/live/mempool?v=terminal@1024: Terminal's nested .rail is still VISIBLE — no `.rail` rule in a band covering 1024 may hide it unscoped (styles.css:2157 is child-scoped ON PURPOSE; check for a second, unscoped rule before suspecting that one)");
ok(rails.every((r) => !r.shellChild || r.display === 'none'),
  '/live/mempool?v=terminal@1024: the shell-level NetRail is still collapsed at 1024');

// ════════════════════════════════════════════════════════════════════════
// 6. TAB STRIPS — wrap on wide desktop, scroll (nowrap) below 1280.
// ════════════════════════════════════════════════════════════════════════
console.log('\n──────── tab strips ────────');
for (const [w, want] of [[1024, 'nowrap'], [1920, 'wrap']]) {
  await p.setViewportSize({ width: w, height: 1000 });
  for (const r of ['/monero', '/learn']) {
    await visit(r);
    const strip = await p.$('.tabstrip');
    if (!strip) { ok(false, `${r}@${w}: .tabstrip not found`); continue; }
    const got = await strip.evaluate((el) => getComputedStyle(el).flexWrap);
    ok(got === want, `${r}@${w}: .tabstrip flex-wrap is "${got}" (want "${want}")`);
  }
}

// ════════════════════════════════════════════════════════════════════════
// 7. CLASSIC REFLOW — Classic (the DEFAULT view) reflows on phones instead of
//    panning; Terminal deliberately KEEPS the 900px pin and still pans.
// ════════════════════════════════════════════════════════════════════════
console.log('\n──────── classic reflow @390 ────────');
await p.setViewportSize({ width: 390, height: 844 });

await visit('/live/mempool');
await p.waitForSelector('.mp-canvas-scroll');
const classic = await p.evaluate(() => {
  const el = document.querySelector('.mp-canvas-scroll');
  return {
    reflow: !!document.querySelector('.mp-canvas-scroll--reflow'),
    view: !!document.querySelector('.mp-view--reflow'),
    scrollW: el.scrollWidth, clientW: el.clientWidth,
  };
});
console.log('   classic:', JSON.stringify(classic));
ok(classic.reflow, '/live/mempool@390: .mp-canvas-scroll--reflow exists (Classic opted in)');
ok(classic.view, '/live/mempool@390: .mp-view--reflow exists');
ok(classic.scrollW - classic.clientW <= TOL,
  `/live/mempool@390: Classic does NOT pan (scrollW ${classic.scrollW} - clientW ${classic.clientW} = ${classic.scrollW - classic.clientW})`);

await visit('/live/mempool?v=terminal');
await p.waitForSelector('.mp-canvas-scroll');
const term = await p.evaluate(() => {
  const el = document.querySelector('.mp-canvas-scroll');
  el.scrollLeft = 400;
  return { reflow: !!document.querySelector('.mp-canvas-scroll--reflow'), scrollW: el.scrollWidth, clientW: el.clientWidth, left: el.scrollLeft };
});
console.log('   terminal:', JSON.stringify(term));
ok(!term.reflow, '/live/mempool?v=terminal@390: Terminal did NOT opt into reflow');
ok(term.scrollW >= 850, `/live/mempool?v=terminal@390: Terminal still pans (scrollW ${term.scrollW} >= 850)`);

// ════════════════════════════════════════════════════════════════════════
// 8. COPY SPOT-CHECK — the migration is chrome-only; the Bottom Line page's
//    headline numbers must survive it byte-for-byte.
// ════════════════════════════════════════════════════════════════════════
console.log('\n──────── copy spot-check ────────');
await p.setViewportSize({ width: 1920, height: 1000 });
await visit('/monero/bottomline');
const body = await p.evaluate(() => document.body.innerText);
for (const needle of ['$625,000', '$22,000,000']) {
  ok(body.includes(needle), `/monero/bottomline: body text still contains "${needle}"`);
}

// ════════════════════════════════════════════════════════════════════════
// 9. EVERY NAVIGATION LANDED WHERE IT WAS SENT — see visit()'s note. One
//    aggregate over every visit() this run made, so a redirect or route
//    change fails here loudly instead of silently relocating the subject of
//    all 368 assertions above.
// ════════════════════════════════════════════════════════════════════════
console.log('\n──────── landing ────────');
ok(strays.size === 0, strays.size === 0
  ? 'every route visited landed on the path requested (no redirect hops)'
  : 'routes did not land where requested: ' + [...strays].join(', '));

await b.close();
console.log(fail ? '\nPAGESHELL CHECKS FAILED' : '\nALL PAGESHELL CHECKS PASSED');
process.exit(fail ? 1 : 0);
