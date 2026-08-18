// verify-protocol.mjs — /future/protocol, the peers relocation, and the death
// of the hollow anchors. p4·06.
//
// WHAT THIS GATE IS FOR
// Ten Future-dropdown rows were `/future#<id>` and #184 measured that /future
// renders no panel any of them can scroll to. p4·06 gave the five protocol
// rows a real `?p=` page, moved the four PARTNER rows behind one working
// "Trusted peers" leaf, and relocated that leaf from About to Operate. Three
// classes of defect follow from that and are what this file watches:
//
//   1. SILENT SUBSTITUTION — five URLs rendering one component. If `?p=` were
//      mis-read, every id would render the same protocol and every other
//      assertion here would still pass. §2 is five DISTINCT titles, and it is
//      the reason this gate exists rather than a single smoke check.
//   2. A HOLLOW ANCHOR COMING BACK — §4 asserts the absence in the RENDERED
//      nav, where verify-ia §7c asserts it in the exported IA object. Two
//      instruments, because a nav that renders something the IA does not
//      contain is exactly the drift neither alone can see.
//   3. A ROUTE THAT MOVED BREAKING ITS OLD LINK — §5, in BOTH layers.
//
// Run against serve-dist (NOT vite preview — see verify-future.mjs header).
//   npm run build && npm run wait-preview && node verify-protocol.mjs
//
// NO COLD-BOOT BYPASS IS INSTALLED HERE, and that is structural rather than
// asserted: the splash gate's own predicate (coldboot/gate.ts) ends
// `pathname === R.HOME`, and this gate never visits `/`. Adding a bypass would
// red verify-coldboot-live §0, which audits the set of gates that install one.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './verify-lib.mjs';
import { makeReporter } from './verify-reporter.mjs';

const BASE = 'http://localhost:4173';
const __dirname = dirname(fileURLToPath(import.meta.url));
const R = makeReporter('verify-protocol');

const DATA = readFileSync(join(__dirname, 'src', 'pages', 'future', 'data.ts'), 'utf8');
const { R: ROUTE, REDIRECTS } = await import(join(__dirname, 'scripts', 'routes.mjs'));

/* The five ids, PARSED from data.ts rather than typed here. A hardcoded list
 * would make this gate agree with itself instead of with the app — the
 * mempool-meta.ts idiom, and the defect p3·19 recorded when a gate compared
 * the source to itself through the DOM. */
const FUTURE_SRC = (DATA.match(/export\s+const\s+FUTURE_PROTOCOLS\s*:[^=]*=\s*\[([\s\S]*?)\];/) || [])[1] || '';
const IDS = [...FUTURE_SRC.matchAll(/\{\s*id:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
const TAGS = [...FUTURE_SRC.matchAll(/\btag:\s*"([^"]+)"/g)].map((m) => m[1]);

const { browser } = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

try {
  // ══ §0 · instrument floor ══════════════════════════════════════════════
  /* Every set comparison below is vacuously true against an empty parse, and
   * an empty parse is exactly what a moved file or a changed literal shape
   * produces. Floor first, always. */
  R.group('§0 · the instrument found its subject');
  R.ok(FUTURE_SRC.length > 0, 'located FUTURE_PROTOCOLS in data.ts source');
  R.ok(IDS.length >= 5, `parsed ${IDS.length} protocol ids: ${IDS.join(', ')}`);
  R.ok(TAGS.length === IDS.length, `parsed one tag per id (${TAGS.length} tags / ${IDS.length} ids)`);

  // ══ §1 · the three states ══════════════════════════════════════════════
  R.group('§1 · the bare path, a known id and an unknown id are three different pages');

  const state = async (url) => {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    return page.evaluate(() => ({
      index: !!document.querySelector('[data-protocol-index]'),
      notfound: !!document.querySelector('[data-protocol-notfound]'),
      switcher: !!document.querySelector('[data-protocol-switcher]'),
      links: [...document.querySelectorAll('[data-protocol-link]')].map((a) => a.getAttribute('data-protocol-link')),
      h1: (document.querySelector('h1')?.innerText || '').trim(),
      current: [...document.querySelectorAll('[data-protocol-switcher] [aria-current]')].length,
      text: document.body.innerText,
    }));
  };

  const bare = await state('/future/protocol');
  R.ok(bare.index && !bare.notfound, 'bare /future/protocol renders the INDEX, not a protocol and not an error');
  R.ok(bare.links.length === IDS.length && IDS.every((id) => bare.links.includes(id)),
    `the index links all ${IDS.length} protocols (${bare.links.join(', ')})`);
  R.ok(bare.h1.length > 0, `the index carries a real h1 ("${bare.h1.slice(0, 48)}")`);

  /* `?p=` with NO VALUE must fall through to the index, not error. This is
   * SimulatePage's `requested !== ""` clause; without it a trailing `?p=` —
   * which browsers and share sheets produce on their own — reads as a
   * fabricated id and shows a not-found for something nobody asked for. */
  const empty = await state('/future/protocol?p=');
  R.ok(empty.index && !empty.notfound, 'a valueless ?p= falls through to the index rather than erroring');

  // ══ §2 · five ids, five DISTINCT pages ═════════════════════════════════
  /* THE SECTION THIS GATE EXISTS FOR. One component renders five URLs, so the
   * failure that costs most is the quiet one: every id resolving to the same
   * protocol. Distinctness is asserted as a SET SIZE, so it cannot be
   * satisfied by four matches and one repeat. */
  R.group('§2 · each ?p= renders its OWN protocol (the silent-substitution class)');

  const titles = [];
  for (let i = 0; i < IDS.length; i++) {
    const id = IDS[i];
    const s = await state(`/future/protocol?p=${id}`);
    titles.push(s.h1);
    R.ok(!s.index && !s.notfound && s.switcher,
      `?p=${id} renders a protocol (index=${s.index} notfound=${s.notfound})`);
    R.ok(s.h1.includes(TAGS[i]),
      `?p=${id} names "${TAGS[i]}" in its h1 (got "${s.h1.slice(0, 56)}")`);
    R.ok(s.current === 1, `?p=${id} marks exactly one switcher chip aria-current (${s.current})`);
  }
  const distinct = new Set(titles.map((t) => t.trim()));
  R.ok(distinct.size === IDS.length,
    `all ${IDS.length} ids render DISTINCT titles (${distinct.size} distinct) — no id silently substitutes another`);

  // ══ §3 · the unknown id names it and substitutes nothing ═══════════════
  /* verify-future §11c's shape: a positive AND a negative. Naming the id is
   * not enough on its own — a page could name it and still render a fallback
   * underneath, which is the v6.0.9 defect. */
  R.group('§3 · an unknown ?p= names what it could not find and renders no protocol');

  const BOGUS = 'definitely-not-a-protocol';
  const nf = await state(`/future/protocol?p=${BOGUS}`);
  R.ok(nf.notfound && !nf.index, 'an unknown id renders the not-found, not the index and not a protocol');
  R.ok(nf.text.includes(BOGUS), `the page NAMES the id it could not find ("${BOGUS}")`);
  R.ok(nf.current === 0, `no switcher chip is aria-current under not-found (${nf.current}) — it refuses to highlight a substitute`);
  R.ok((await page.locator('[role="alert"]').count()) >= 1, 'the not-found is announced (role="alert")');

  /* NO ARTBOARD. FutureMini is the only <canvas> this page ever renders, so
   * its absence is the machine-checkable form of "renders no artboard".
   * Counted rather than asserted as a boolean, and PAIRED against a known id
   * in the same run — otherwise "0 canvases" would also pass on a page whose
   * visualization had simply broken everywhere. */
  const nfCanvas = await page.locator('canvas').count();
  await page.goto(`${BASE}/future/protocol?p=${IDS[0]}`, { waitUntil: 'networkidle' });
  const okCanvas = await page.locator('canvas').count();
  R.ok(okCanvas > nfCanvas,
    `the not-found renders no artboard while a real id does (${nfCanvas} vs ${okCanvas} canvases)`);

  // ══ §4 · the hollow anchors are gone from the RENDERED nav ═════════════
  /* verify-ia §7c asserts this over the exported IA object. This asserts it
   * over what a reader can actually click, which is a different subject: a
   * nav that renders a link the IA does not contain is invisible to §7c. */
  R.group('§4 · no rendered nav link is a /future# fragment');

  await page.goto(`${BASE}/future`, { waitUntil: 'networkidle' });
  const navHrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
  R.ok(navHrefs.length > 0, `${navHrefs.length} rendered anchors to search (floor: an empty page would pass vacuously)`);
  const hollow = navHrefs.filter((h) => h && h.includes('/future#'));
  R.ok(hollow.length === 0,
    hollow.length === 0
      ? 'zero rendered /future# anchors — the #184 hollow anchors are gone'
      : `${hollow.length} hollow anchor(s) rendered: ${hollow.join(', ')}`);
  const protoHrefs = navHrefs.filter((h) => h && h.includes('/future/protocol?p='));
  R.ok(protoHrefs.length >= IDS.length,
    `the protocol destinations render as real anchors (${protoHrefs.length} found) — the positive half, so the absence above cannot pass on a page with no links at all`);

  // ══ §5 · the peers relocation, in BOTH layers ══════════════════════════
  R.group('§5 · /about/peers -> /operate/peers is redirected server-side AND client-side');

  /* SERVER LAYER — asserted from configuration, because serve-dist emits no
   * 3xx by design (verify-redirects records the same limitation). What CAN be
   * checked offline is that the two layers declare the same pair. */
  const vercel = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf8'));
  const srvRow = vercel.redirects.find((r) => r.source === '/about/peers');
  R.ok(!!srvRow && srvRow.destination === ROUTE.OPERATE_PEERS && srvRow.statusCode === 301,
    `vercel.json 301s /about/peers -> ${srvRow ? srvRow.destination : '(absent)'}`);
  const cliRow = REDIRECTS.find((r) => r.from === '/about/peers');
  R.ok(!!cliRow && cliRow.to === ROUTE.OPERATE_PEERS,
    `routes.mjs mirrors it client-side -> ${cliRow ? cliRow.to : '(absent)'}`);

  /* NO CHAIN. `/peers` predates this move and pointed at `/about/peers`;
   * left alone it would now be hop one of two. verify-ia §6 reds on that
   * independently, and this states the property in the terms a reader cares
   * about: every redirect lands on something that is actually served. */
  const chained = REDIRECTS.filter((r) => REDIRECTS.some((o) => o.from === r.to));
  R.ok(chained.length === 0,
    chained.length === 0
      ? 'no redirect destination is itself a redirect source (no two-hop chains)'
      : `${chained.length} chained redirect(s): ${chained.map((r) => `${r.from} -> ${r.to}`).join(', ')}`);

  /* CLIENT LAYER — observable here. serve-dist does not redirect, so the old
   * path falls through to the SPA shell and <RedirectTo> does the work; that
   * is precisely the mirror we want to exercise. */
  await page.goto(`${BASE}/about/peers`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => location.pathname !== '/about/peers', null, { timeout: 8000 }).catch(() => {});
  const landed = new URL(page.url()).pathname;
  R.ok(landed === ROUTE.OPERATE_PEERS, `visiting the old /about/peers lands on ${landed}`);
  const peerCards = await page.locator('.v6-peer-grid > .v6-stagger').count();
  R.ok(peerCards >= 3, `and it lands on REAL CONTENT, not an empty shell (${peerCards} partner cards)`);

  // ══ §6 · the grid's responsive shape ═══════════════════════════════════
  /* verify-peers makes ZERO geometry assertions, so a 4-column-to-3-column
   * change is invisible to it. Column count is read off the COMPUTED
   * `grid-template-columns` — the resolved track list — rather than inferred
   * from card positions, which would also "pass" on a collapsed grid. */
  R.group('§6 · the peers grid is 3 / 2 / 1 columns across the repo\'s own bands');

  const cols = async (w, h) => {
    const c = await browser.newContext({ viewport: { width: w, height: h } });
    const pp = await c.newPage();
    await pp.goto(`${BASE}${ROUTE.OPERATE_PEERS}`, { waitUntil: 'networkidle' });
    const out = await pp.evaluate(() => {
      const g = document.querySelector('.v6-peer-grid');
      if (!g) return null;
      const tracks = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length;
      const items = [...g.children];
      const rows = new Set(items.map((el) => Math.round(el.getBoundingClientRect().top))).size;
      const de = document.documentElement;
      let over = 0;
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.right > de.clientWidth + 0.5) over++;
      }
      return { tracks, items: items.length, rows, over };
    });
    await c.close();
    return out;
  };

  const d = await cols(1440, 900);
  R.ok(d && d.tracks === 3, `1440 (desktop band): ${d ? d.tracks : 'no grid'} columns`);
  R.ok(d && d.rows === 2, `and the fourth card WRAPS to a second row rather than padding the first (${d ? d.rows : '?'} rows, ${d ? d.items : '?'} cards)`);

  const t = await cols(1000, 900);
  R.ok(t && t.tracks === 2, `1000 (the 769-1199 tablet band): ${t ? t.tracks : 'no grid'} columns`);

  const m = await cols(390, 844);
  R.ok(m && m.tracks === 1, `390 (phone): ${m ? m.tracks : 'no grid'} column`);
  /* THE ONE THAT WOULD HAVE CAUGHT A REAL REGRESSION. The <=768 layer
   * collapses grids by matching `[style*="grid-template-columns"]` — the
   * INLINE attribute. Moving this grid into a class means that blanket rule no
   * longer sees it, so the phone case now rests entirely on the class's own
   * mobile-first default. If that default were ever dropped, the desktop
   * three-column rule would not apply either and the grid would silently fall
   * back to ONE track anyway — which is why the overflow check below, not the
   * track count above, is the assertion with teeth here. */
  R.ok(m && m.over === 0, `and nothing overflows the viewport at 390 (${m ? m.over : '?'} elements past the edge)`);

  const n = await cols(320, 844);
  R.ok(n && n.tracks === 1 && n.over === 0, `320: ${n ? n.tracks : '?'} column, ${n ? n.over : '?'} elements past the edge`);

  // ══ §7 · the FCMP++ audit is cited, and cited accurately ═══════════════
  R.group('§7 · the Trail of Bits audit renders as two dated, sourced resources');

  await page.goto(`${BASE}/future/protocol?p=fcmp`, { waitUntil: 'networkidle' });
  const res = await page.evaluate(() =>
    [...document.querySelectorAll('.v6-res')].map((a) => ({
      text: a.textContent.replace(/\s+/g, ' ').trim(),
      href: a.getAttribute('href'),
    })));
  R.ok(res.length >= 5, `the fcmp resources row renders ${res.length} entries (floor: an empty row would pass the absence checks below vacuously)`);

  const tob = res.find((r) => /Trail of Bits/i.test(r.text));
  R.ok(!!tob, 'a Trail of Bits resource is rendered');
  R.ok(!!tob && /trailofbits\/publications/.test(tob.href || ''),
    `it links Trail of Bits' own publications repo (${tob ? (tob.href || '').slice(0, 78) : 'n/a'})`);
  /* THE DATE IS THE REVIEW'S, NOT THE ANNOUNCEMENT'S. Trail of Bits' own
   * index dates this review Jul 2026 and their filename says 2026-07; the
   * MAGIC Grants post is Aug 2026. Dating the audit by its announcement is
   * the easy error and it is a month wrong, so the two are asserted apart. */
  R.ok(!!tob && /Jul 2026/.test(tob.text), `and is dated by the REVIEW (${tob ? tob.text.slice(0, 68) : 'n/a'})`);

  const mg = res.find((r) => /magicgrants\.org/.test(r.href || ''));
  R.ok(!!mg, 'the MAGIC Grants announcement is rendered');
  R.ok(!!mg && /Aug 2026/.test(mg.text), `and is dated by the POST (${mg ? mg.text.slice(0, 68) : 'n/a'})`);

  /* NO COMPLETION CLAIM. ToB's index marks this entry "fix review report";
   * that is their fact, not ours to restate as "fixed" or "resolved" on a
   * page that did not verify it. */
  const fcmpText = await page.innerText('body');
  const overclaim = ['findings fixed', 'all issues resolved', 'passed the audit', 'no findings']
    .filter((s) => fcmpText.toLowerCase().includes(s));
  R.ok(overclaim.length === 0,
    overclaim.length === 0
      ? 'no completion claim is made about the audit — the links say what they are'
      : `overclaim(s) on the page: ${overclaim.join(', ')}`);

  // ══ §8 · xmr.club is described as what it is ═══════════════════════════
  /* A PAIR, and it has to be. The old copy called xmr.club "the social layer"
   * and a "community hub … discussion, projects, culture". Asserting only the
   * NEW words would stay green if the old paragraph were still on the page
   * beside them, so the old ones are asserted ABSENT too. Neither half is
   * checkable against the live site from CI — the gateway answers 403 to
   * CONNECT for xmr.club — and this gate does not pretend otherwise: it
   * checks what the repo SAYS, which is the operator's to review. */
  R.group('§8 · the xmr.club entry describes a directory, not a social hub');

  await page.goto(`${BASE}${ROUTE.OPERATE_PEERS}`, { waitUntil: 'networkidle' });
  const clubCard = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.v6-peer-grid > .v6-stagger')];
    const c = cards.find((el) => /xmr\.club/i.test(el.innerText));
    return c ? c.innerText.replace(/\s+/g, ' ') : null;
  });
  R.ok(!!clubCard, 'the xmr.club card renders on the peers page');
  R.ok(!!clubCard && clubCard.length > 60, `and carries real copy (${clubCard ? clubCard.length : 0} chars — floor, so the absences below are not vacuous)`);

  const STALE = ['social layer', 'where the humans hang out', 'meetup coordination', 'discussion, projects, culture'];
  const survived = STALE.filter((s) => clubCard && clubCard.toLowerCase().includes(s.toLowerCase()));
  R.ok(survived.length === 0,
    survived.length === 0
      ? 'none of the four superseded descriptions survive'
      : `superseded copy still on the page: ${survived.join(' | ')}`);
  R.ok(!!clubCard && /audited/i.test(clubCard) && /director|directory/i.test(clubCard),
    'the card describes an audited directory');

  /* NO COUNTS. A listing total would be true on the day it shipped and wrong
   * the day the directory grew — the same rot SITE_PR was built to detect.
   * Scoped to the xmr.club card so the site's own live figures elsewhere are
   * not in range. */
  const clubDigits = (clubCard || '').match(/\b\d[\d,]{1,}\b/g) || [];
  R.ok(clubDigits.length === 0,
    clubDigits.length === 0
      ? 'the xmr.club card quotes no counts (nothing to go stale)'
      : `the card quotes ${clubDigits.length} number(s): ${clubDigits.join(', ')}`);

  /* DIFFERENTIATION. Two partners now occupy no-KYC territory; the page must
   * say how they differ or it is describing one project twice. */
  const peersText = await page.innerText('body');
  R.ok(/kyc\.rip/i.test(clubCard || ''),
    'the xmr.club copy names kyc.rip, so the two no-KYC partners are told apart rather than described twice');
  R.ok(/kyc\.rip/i.test(peersText), 'and kyc.rip is itself still on the page');

} catch (err) {
  R.ok(false, `Test crashed: ${err.message}`);
} finally {
  await browser.close();
}

process.exit(R.finish());
