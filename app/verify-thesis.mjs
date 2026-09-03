// verify-thesis.mjs — DOM + source gate for /monero/thesis, the eighth Monero tab.
//
// Sections:
//   §0  source floors — the data module parses, and every count below is DERIVED
//   §1  registration: MONERO_TABS is 8, thesis sits between attacks and bottomline
//   §2  WHY is exactly the derived set of pairs, and the reachable subset is pinned
//   §3  sources: every srcs key resolves, the uncited set is pinned BY NAME, dates
//   §4  the rendered type floor at 1440 and 390 — the gap verify-mobile leaves
//   §5  the briefs reuse V6Modal: role=dialog, Escape, focus restore, variant
//   §6  no interpolation reaches an HTML sink
//   §7  the flow overlay's endpoints land on real panels — measured, not assumed
//   §8  reduced motion — the gap verify-reduce leaves
//
// ── NO COLD-BOOT BYPASS HERE, DELIBERATELY — do not "restore" it. ─────────
// Same reason verify-superstress.mjs and verify-peers.mjs carry the identical
// note: verify-coldboot-live's §0 audits the set of gates that install the
// bypass against the set its own patterns detect as REACHING `/`. This gate
// never navigates to `/`, holds no route array containing '/', names no
// R.HOME, and does NOT import ROUTES from verify-lib.mjs — that import alone
// marks a gate as /-reaching, because ROUTES[0] === '/'.
//
// ── TWO COVERAGE GAPS THIS GATE EXISTS TO FILL, both MEASURED on the base ──
//  1. verify-mobile's type-floor sweep imports the 18-entry BUILD routes from
//     scripts/routes.mjs, and no /monero/<tab> is in it. So NO Monero tab has
//     ever been in that sweep — not this one, not the seven that predate it.
//     §4 does it here for this tab only; the other seven remain uncovered and
//     that is named, not fixed.
//  2. verify-reduce.mjs never visits /monero at all — its surface list is 21
//     simulators plus 6 mempool views. §8 covers this tab's reduced-motion
//     behaviour; the rest of /monero remains uncovered.
//
// BLIND SPOTS (stated, not hidden):
//   — Whether the 26 cited sources say what the panels claim they say. Nothing
//     offline can know that, and egress to those hosts is blocked here. §3
//     checks SHAPE and RESOLUTION, never truth.
//   — Whether the URLs still resolve. §3 asserts they are absolute https
//     permalinks; it cannot fetch them.
//   — Prose quality, and whether the argument is any good.
//   — §7 measures that an arrow ENDS inside some panel's box. It does not know
//     which panel the author meant.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './verify-lib.mjs';
import { makeReporter } from './verify-reporter.mjs';

const BASE = process.env.VERIFY_BASE || 'http://localhost:4173';
const __dirname = dirname(fileURLToPath(import.meta.url));
const R = makeReporter('verify-thesis');
const ok = (c, m) => R.ok(c, m);

const src = (rel) => readFileSync(join(__dirname, rel), 'utf8');
const dataSrc = src('src/pages/monero/thesisData.ts');
const tabSrc = src('src/pages/monero/ThesisTab.tsx');
const tabsSrc = src('src/pages/monero/tabs.ts');
const pageSrc = src('src/pages/MoneroPage.tsx');

// ── §0 · source floors ────────────────────────────────────────────────────
R.group('§0 · source floors — nothing below may assert over an empty parse');

const ORDER = (dataSrc.match(/THESIS_ORDER: readonly ThesisNumeral\[\] = \[([^\]]+)\]/) || [, ''])[1]
  .split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean);
ok(ORDER.length === 7, `§0a THESIS_ORDER parses to ${ORDER.length} numerals (need 7): ${ORDER.join(' ')}`);

const srcKeys = [...dataSrc.matchAll(/^  ([a-z0-9]+): \{ label:/gm)].map((m) => m[1]);
ok(srcKeys.length >= 20, `§0b THESIS_SOURCES parses to ${srcKeys.length} entries (floor 20 — a broken parse must not make §3 vacuous)`);

const whyKeys = [...dataSrc.matchAll(/^  "([IVX]+\|[IVX]+)":/gm)].map((m) => m[1]);
ok(whyKeys.length > 0, `§0c THESIS_WHY parses to ${whyKeys.length} keys`);

const numerals = [...dataSrc.matchAll(/^    numeral: "([IVX]+)",/gm)].map((m) => m[1]);
ok(numerals.length === 7, `§0d seven pressures carry an explicit numeral: ${numerals.join(' ')}`);

const themeBlocks = [...dataSrc.matchAll(/^    themes: \[([^\]]*)\],/gm)]
  .map((m) => m[1].split(',').map((t) => t.trim().replace(/"/g, '')).filter(Boolean));
ok(themeBlocks.length === 7, `§0e seven themes arrays parse (${themeBlocks.map((t) => t.length).join('/')} entries)`);

// ── §1 · registration ─────────────────────────────────────────────────────
R.group('§1 · the tab is registered, and in the right place');

const tabIds = [...tabsSrc.matchAll(/\{ id: "([a-z]+)", label: "([^"]+)" \}/g)].map((m) => m[1]);
ok(tabIds.length === 8, `§1a MONERO_TABS has 8 entries: ${tabIds.join(' · ')}`);
const iT = tabIds.indexOf('thesis');
ok(iT > 0 && tabIds[iT - 1] === 'attacks' && tabIds[iT + 1] === 'bottomline',
   `§1b thesis sits BETWEEN attacks and bottomline (got ${tabIds[iT - 1]} → thesis → ${tabIds[iT + 1]})`);
ok(/React\.lazy\(\s*\(\)\s*=>\s*\n?\s*import\("\.\/monero\/ThesisTab"\)/.test(pageSrc),
   '§1c MoneroPage reaches ThesisTab through React.lazy — the dynamicImport that keeps it off /monero\'s static closure');
ok(/case "thesis":/.test(pageSrc) && /React\.Suspense/.test(pageSrc),
   '§1d the thesis case is wrapped in a Suspense boundary');
ok(/active === "bottomline" \|\| active === "thesis" \? "reading"/.test(pageSrc),
   '§1e the tab takes the "reading" width tier (1180px — the mockup\'s own wrap)');

// ── §2 · WHY is derived, not restated ─────────────────────────────────────
R.group('§2 · the pair set is DERIVED from the numerals and diffed both ways');

const expected = [];
for (let i = 0; i < ORDER.length; i++) for (let j = i + 1; j < ORDER.length; j++) expected.push(`${ORDER[i]}|${ORDER[j]}`);
const missing = expected.filter((k) => !whyKeys.includes(k));
const extra = whyKeys.filter((k) => !expected.includes(k));
ok(missing.length === 0, `§2a every derived pair has a WHY sentence${missing.length ? ` — MISSING: ${missing.join(', ')}` : ` (${expected.length} pairs)`}`);
ok(extra.length === 0, `§2b no WHY key outside the derived set${extra.length ? ` — EXTRA: ${extra.join(', ')}` : ''}`);
ok(new Set(whyKeys).size === whyKeys.length, `§2c no duplicate WHY key (${whyKeys.length} keys, ${new Set(whyKeys).size} distinct)`);

/* THE REACHABILITY SPLIT, and it is the finding this section exists for.
   The correlation list pairs panels by SHARED THEME, so a pair sharing none
   is declared and never rendered. Measured on the shipping data exactly ONE
   is: IV|VI — IV is [data, privacy, future] and VI is [trace, risk, state].
   It is pinned BY NAME rather than tolerated as a count, so a SECOND dead
   pair is a build failure instead of a silent loss of a written sentence. */
const reach = new Set();
for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
  if (i === j) continue;
  if (themeBlocks[i].some((t) => themeBlocks[j].includes(t))) {
    const [a, b] = [numerals[i], numerals[j]].sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y));
    reach.add(`${a}|${b}`);
  }
}
const dead = expected.filter((k) => !reach.has(k));
ok(dead.length === 1 && dead[0] === 'IV|VI',
   `§2d exactly ONE declared pair is unreachable and it is IV|VI (dead: ${dead.join(', ') || 'none'}) — a second would mean a written sentence is silently unrendered`);
ok(reach.size === expected.length - 1,
   `§2e ${reach.size} of ${expected.length} pairs are reachable at runtime`);

// ── §3 · sources ──────────────────────────────────────────────────────────
R.group('§3 · every cited source resolves; the uncited set is pinned by name');

const cited = new Set([...dataSrc.matchAll(/^    srcs: \[([^\]]*)\],/gm)]
  .flatMap((m) => m[1].split(',').map((t) => t.trim().replace(/"/g, '')).filter(Boolean)));
const orphans = [...cited].filter((k) => !srcKeys.includes(k));
ok(orphans.length === 0, `§3a every srcs key resolves to a source${orphans.length ? ` — ORPHANS: ${orphans.join(', ')}` : ` (${cited.size} cited of ${srcKeys.length} declared)`}`);

/* TWO SOURCES ARE DECLARED AND CITED BY NO PANEL, and they are pinned by NAME
   rather than counted. `bis` (the BIS CBDC survey) and `seiz` (Chainalysis on
   asset seizure) are real dated permalinks the operator sourced; citing them
   would mean writing prose that references them, which is a content decision
   this release did not take. Reported rather than deleted — and named, so a
   THIRD uncited source cannot appear unnoticed. */
const uncited = srcKeys.filter((k) => !cited.has(k)).sort();
ok(JSON.stringify(uncited) === JSON.stringify(['bis', 'seiz']),
   `§3b the uncited set is exactly {bis, seiz} (got: ${uncited.join(', ') || 'none'})`);

const urls = [...dataSrc.matchAll(/url: "([^"]+)"/g)].map((m) => m[1]);
ok(urls.length === srcKeys.length, `§3c every source carries a url (${urls.length}/${srcKeys.length})`);
const badUrl = urls.filter((u) => !/^https:\/\/[^\s/]+\/.+/.test(u));
ok(badUrl.length === 0, `§3d every url is an absolute https permalink with a path${badUrl.length ? ` — ${badUrl.join(', ')}` : ''}`);

/* THE DATE SLOT IS NOT ALWAYS A DATE, and the page's standfirst is written to
   match. Three sources carry something else: `hf` is an OPEN GitHub milestone
   ("live") and `fcc`/`seiz` are undated topic pages ("—"). Inventing a date
   for a moving target would be the exact defect this page is about, so they
   are pinned BY NAME and the standfirst says "dated where the publisher dates
   it" rather than claiming every figure carries a publication date. */
const dates = [...dataSrc.matchAll(/^  ([a-z0-9]+): \{ label: "[^"]*", url: "[^"]*", date: "([^"]*)" \}/gm)]
  .map((m) => [m[1], m[2]]);
const undated = dates.filter(([, d]) => !/\d{4}/.test(d)).map(([k]) => k).sort();
ok(JSON.stringify(undated) === JSON.stringify(['fcc', 'hf', 'seiz']),
   `§3e the sources with no year in the date slot are exactly {fcc, hf, seiz} (got: ${undated.join(', ') || 'none'})`);
ok(!/every source is a link you can open[^.]*publication date/i.test(tabSrc),
   '§3f the standfirst does not claim every source carries a publication date');

// ── §6 · the HTML sink takes constants only (source assertion) ────────────
R.group('§6 · nothing interpolated reaches dangerouslySetInnerHTML');

const sinks = [...tabSrc.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)].map((m) => m[1].trim());
ok(sinks.length > 0, `§6a the sink is present and parseable (${sinks.length} site(s))`);
const dynamic = sinks.filter((e) => e.includes('`') || e.includes('+') || /\$\{/.test(e));
ok(dynamic.length === 0,
   `§6b no template literal or concatenation reaches the sink${dynamic.length ? ` — ${dynamic.join(' | ')}` : ' (every site is a bare identifier)'}`);
ok(!/useSearchParams|useParams|location\.(search|hash)/.test(tabSrc),
   '§6c the tab reads nothing from the URL, so no URL-derived string can reach the sink');

// ── §9 · the block does not ground on the one token no theme rebinds ─────
R.group('§9 · theme safety — nothing grounds on --bg-0');
const cssSrc = src('src/styles.css');
const block = cssSrc.slice(cssSrc.indexOf('/* ══ /monero/thesis'));
ok(block.length > 4000, `§9a the thesis stylesheet block parses (${block.length} chars)`);
/* --bg-0 is the ONE ground token no theme overrides — `grep -c -- '--bg-0'
   styles-theme.css` is 0 — so anything grounded on it stays #050505 while
   indigo's panels are #17161C and phosphor's are #0A130A. The mockup grounds
   its chips there; ported literally they were black holes in a lighter card. */
/* COMMENTS STRIPPED FIRST. The block's own header explains WHY #ff6600 is not
   used, which means a naive grep for it matches the prose written to prevent
   it — verify-orb §4's recorded self-referential-grep defect, reproduced here
   by the assertion's first draft. */
const code = block.replace(/\/\*[\s\S]*?\*\//g, '');
ok(code.length > 3000 && code.length < block.length, `§9a2 comment strip left ${code.length} of ${block.length} chars of live CSS`);
const bg0 = (code.match(/var\(--bg-0\)/g) || []).length;
ok(bg0 === 0, `§9b no rule in the thesis block grounds on --bg-0 (found ${bg0}) — it is the only ground token no theme rebinds`);
ok(/var\(--f-serif\)/.test(code) && !/var\(--f-disp\)/.test(code),
   '§9c the block uses the repo font token --f-serif, not the mockup\'s non-existent --f-disp');
ok(!/#ff6600/.test(code) && /var\(--tk-accent\)/.test(code),
   '§9d the Monero orange comes from --tk-accent, not the mockup\'s second orange #ff6600');
ok(!/!important/.test(code), '§9e the block adds ZERO !important');

// ── browser ───────────────────────────────────────────────────────────────
const { browser } = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto(`${BASE}/monero/thesis`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-thesis-panel]', { timeout: 15000 }).catch(() => {});

  R.group('§1f · the route renders the tab');
  const panels = await page.$$eval('[data-thesis-panel]', (n) => n.map((x) => x.getAttribute('data-thesis-panel')));
  ok(panels.length === 7, `§1f /monero/thesis renders 7 pressure panels (got ${panels.length})`);
  const h1s = await page.$$eval('#page-title', (n) => n.length);
  ok(h1s === 1, `§1g exactly one #page-title on the route (got ${h1s})`);

  /* §1h — a <button> centres its content box vertically in Chromium even at
     display:block, and panel V is the only card that spans two grid rows, so
     it is the only one where that shows: it rendered its first line 279px
     below its own top border. The assertion is that EVERY panel starts its
     content at its own padding, which is a property no single-row card can
     falsify — measure them all or the one that matters is not covered. */
  const tops = await page.$$eval('[data-thesis-panel]', (ns) => ns.map((el) => {
    const r = el.getBoundingClientRect();
    const k = el.querySelector('.th-num').getBoundingClientRect();
    return { id: el.getAttribute('data-thesis-panel'), gap: Math.round(k.top - r.top), h: Math.round(r.height) };
  }));
  const spread = Math.max(...tops.map((t) => t.gap)) - Math.min(...tops.map((t) => t.gap));
  ok(tops.length === 7 && spread <= 1,
     `§1h every panel top-aligns its content (gaps ${tops.map((t) => t.gap).join('/')}px, spread ${spread}) — the two-row card must not centre`);
  ok(Math.max(...tops.map((t) => t.h)) > Math.min(...tops.map((t) => t.h)) * 1.5,
     `§1h2 the panels are genuinely unequal in height (${Math.min(...tops.map((t) => t.h))}..${Math.max(...tops.map((t) => t.h))}px), so §1h is not passing over a uniform grid`);

  // ── §4 · the rendered type floor ───────────────────────────────────────
  R.group('§4 · rendered type — the sweep verify-mobile never runs on a Monero tab');
  const measure = async () => page.evaluate(() => {
    const out = [];
    const walk = document.querySelectorAll('.th-root *');
    for (const el of walk) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (!hasText) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.push({ fs: parseFloat(cs.fontSize), sel: el.className || el.tagName });
    }
    return out;
  });

  const named = ['.th-chip', '.th-ours b', '.th-tag', '.th-corr-h', '.th-corr-shared'];
  for (const [w, h, floor] of [[1440, 900, 11], [390, 844, 12]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(180);
    const all = await measure();
    ok(all.length > 40, `§4·${w} the sweep found ${all.length} text-bearing elements (floor 40 — a collapsed selector must not pass vacuously)`);
    const under = all.filter((e) => e.fs < floor - 0.01);
    ok(under.length === 0,
       `§4·${w} no text-bearing element under ${floor}px${under.length ? ` — ${under.length}: ` + under.slice(0, 5).map((u) => `${u.fs}px ${u.sel}`).join(' | ') : ''}`);
    const sizes = await page.evaluate((sels) => sels.map((s) => {
      const el = document.querySelector(s);
      return [s, el ? parseFloat(getComputedStyle(el).fontSize) : null];
    }), named);
    R.info(`  §4·${w} named: ${sizes.map(([s, v]) => `${s} ${v === null ? 'absent' : v + 'px'}`).join(' · ')}`);
  }
  /* THREE OF THE FIVE NAMED SELECTORS LIVE ONLY INSIDE AN OPEN BRIEF
     (.th-tag, .th-corr-h, .th-corr-shared), so the sweep above reported them
     `absent` and checked nothing. That is the vacuity this block closes: the
     brief is opened at BOTH widths and swept with the same walker, and the
     five are asserted PRESENT so a renamed class cannot pass as an absence. */
  for (const [w, h, floor] of [[1440, 900, 11], [390, 844, 12]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    await page.click('[data-thesis-panel="p3"]');
    await page.waitForSelector('.th-brief', { timeout: 5000 });
    const inBrief = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.th-brief *')) {
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
        if (!hasText) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        out.push({ fs: parseFloat(cs.fontSize), sel: el.className || el.tagName });
      }
      const named = ['.th-tag', '.th-corr-h', '.th-corr-shared', '.th-srcs-d', '.th-dl dt'];
      return { out, named: named.map((s) => { const e = document.querySelector(s);
        return [s, e ? parseFloat(getComputedStyle(e).fontSize) : null]; }) };
    });
    ok(inBrief.out.length > 30, `§4·${w}·brief the brief sweep found ${inBrief.out.length} text-bearing elements (floor 30)`);
    const badB = inBrief.out.filter((e) => e.fs < floor - 0.01);
    ok(badB.length === 0,
       `§4·${w}·brief no text in an open brief under ${floor}px${badB.length ? ` — ${badB.length}: ` + badB.slice(0, 5).map((u) => `${u.fs}px ${u.sel}`).join(' | ') : ''}`);
    const absent = inBrief.named.filter(([, v]) => v === null).map(([s]) => s);
    ok(absent.length === 0,
       `§4·${w}·brief every named selector is PRESENT, so none of the above passed as an absence${absent.length ? ` — missing: ${absent.join(', ')}` : ''}`);
    R.info(`  §4·${w}·brief named: ${inBrief.named.map(([s, v]) => `${s} ${v === null ? 'ABSENT' : v + 'px'}`).join(' · ')}`);
    await page.keyboard.press('Escape');
    await page.locator('[role="dialog"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(150);

  // ── §7 · the flow overlay lands on panels ──────────────────────────────
  R.group('§7 · the ported flow overlay — endpoints measured, never assumed');
  const flow = await page.evaluate(() => {
    const svg = document.querySelector('.th-loop-svg');
    if (!svg) return null;
    if (getComputedStyle(svg).display === 'none') return { hidden: true };
    const box = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const rects = [...document.querySelectorAll('[data-thesis-panel]')].map((p) => {
      const r = p.getBoundingClientRect();
      return { id: p.getAttribute('data-thesis-panel'), l: r.left, t: r.top, r: r.right, b: r.bottom };
    });
    const hit = (x, y) => rects.find((q) => x >= q.l - 4 && x <= q.r + 4 && y >= q.t - 4 && y <= q.b + 4);
    const out = [];
    for (const p of svg.querySelectorAll('path[d^="M"]')) {
      const len = p.getTotalLength();
      if (!len) continue;
      const e = p.getPointAtLength(len);
      // viewBox units -> viewport px (preserveAspectRatio="none" stretches both axes)
      const X = box.left + (e.x - vb.x) * (box.width / vb.width);
      const Y = box.top + (e.y - vb.y) * (box.height / vb.height);
      const h = hit(X, Y);
      out.push({ d: p.getAttribute('d').slice(0, 14), on: h ? h.id : null });
    }
    return { hidden: false, out, panels: rects.length };
  });
  if (flow === null) {
    ok(false, '§7a the flow overlay is in the DOM');
  } else if (flow.hidden) {
    R.info('§7 overlay hidden at this width — skipped');
  } else {
    ok(flow.out.length >= 8, `§7a the overlay draws ${flow.out.length} arrows (floor 8)`);
    const landed = flow.out.filter((a) => a.on);
    R.info(`  §7 arrow endpoints landing inside a panel box: ${landed.length}/${flow.out.length}`);
    ok(landed.length === flow.out.length,
       `§7b EVERY arrow ends inside a panel${landed.length === flow.out.length ? '' : ` — ${flow.out.filter((a) => !a.on).map((a) => a.d).join(' | ')} land on nothing`}`);
  }

  // ── §5 · the briefs reuse V6Modal ──────────────────────────────────────
  R.group('§5 · the briefs reuse V6Modal whole');
  const dialogsClosed = await page.$$eval('[role="dialog"]', (n) => n.length);
  ok(dialogsClosed === 0, `§5a no [role="dialog"] before anything is opened (got ${dialogsClosed})`);

  await page.click('[data-thesis-panel="p2"]');
  await page.waitForSelector('.th-brief', { timeout: 5000 });
  const dlg = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const lb = d.getAttribute('aria-labelledby');
    return {
      modal: d.getAttribute('aria-modal'),
      base: d.classList.contains('v6-modal'),
      variant: d.classList.contains('v6-modal--thesis'),
      labelResolves: !!(lb && document.getElementById(lb)),
      veilBase: !!document.querySelector('.v6-modal-veil'),
      srcs: document.querySelectorAll('.th-srcs a').length,
    };
  });
  ok(dlg !== null, '§5b opening a panel mounts a [role="dialog"]');
  ok(dlg && dlg.modal === 'true', '§5c the dialog is aria-modal');
  ok(dlg && dlg.base, '§5d it keeps the BARE .v6-modal class — verify-discrete\'s six queries are all bare-class and must still match');
  ok(dlg && dlg.veilBase, '§5e the veil keeps the bare .v6-modal-veil class');
  ok(dlg && dlg.variant, '§5f the thesis geometry variant is applied');
  ok(dlg && dlg.labelResolves, '§5g aria-labelledby resolves to an element that exists');
  ok(dlg && dlg.srcs >= 5, `§5h the hinge brief renders its sources (${dlg && dlg.srcs})`);

  /* D0666 — role="dialog" OUTLIVES the close by one exit transition's worth of
     frames, by design: V6Modal keeps the node mounted for exactly as long as
     its own computed transition-duration. Sampling on the line after Escape
     reads the dialog mid-exit and fails; verify-future.mjs:495 made precisely
     this mistake and was changed to a waitFor. The property this asserts is
     that it eventually DETACHES — a dialog that merely hides is the
     always-mounted-portal shape verify-future.mjs:249 rules out. */
  await page.keyboard.press('Escape');
  await page.locator('[role="dialog"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  const after = await page.$$eval('[role="dialog"]', (n) => n.length);
  ok(after === 0, `§5i Escape closes and the dialog UNMOUNTS, not merely hides (got ${after})`);

  // every panel opens its OWN brief
  let opened = 0;
  for (const id of panels) {
    await page.click(`[data-thesis-panel="${id}"]`);
    await page.waitForSelector('.th-brief', { timeout: 5000 }).catch(() => {});
    const t = await page.$eval('.th-brief-title', (e) => e.textContent.trim()).catch(() => null);
    if (t) opened++;
    await page.keyboard.press('Escape');
    await page.locator('.th-brief').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
  ok(opened === 7, `§5j all seven panels open a titled brief (${opened}/7)`);

  // ── §8 · reduced motion ────────────────────────────────────────────────
  R.group('§8 · reduced motion — the gap verify-reduce leaves on /monero');
  const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const rp = await rm.newPage();
  await rp.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await rp.goto(`${BASE}/monero/thesis`, { waitUntil: 'networkidle' });
  await rp.waitForSelector('[data-thesis-panel]', { timeout: 15000 }).catch(() => {});
  const motion = await rp.evaluate(() => ({
    running: document.getAnimations().filter((a) => a.playState === 'running').length,
    smil: document.querySelectorAll('animate, animateTransform, animateMotion').length,
    panels: document.querySelectorAll('[data-thesis-panel]').length,
    chars: (document.querySelector('.th-root')?.innerText || '').length,
  }));
  ok(motion.panels === 7, `§8a reduced motion still renders all 7 panels (${motion.panels}) — "no motion" must not be satisfied by rendering nothing`);
  ok(motion.chars > 2000, `§8b reduced motion loses no content (${motion.chars} chars)`);
  ok(motion.running === 0, `§8c zero running animations under reduce (${motion.running})`);
  ok(motion.smil === 0, `§8d no SMIL element is rendered (${motion.smil}) — CSS cannot reach it, so the only way to honour the preference is not to render it`);
  await rm.close();
} catch (err) {
  ok(false, `gate crashed: ${err.message}\n${err.stack}`);
} finally {
  await browser.close();
}

process.exit(R.finish());
