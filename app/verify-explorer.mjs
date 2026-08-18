// verify-explorer.mjs — /operate/superstress/explorer, the SIMULATED beta-chain
// explorer. p4·07.
//
// WHAT THIS GATE IS FOR
// Every other page on this site is either live data or an openly-labelled
// simulator sitting inside `/learn/sim`. This one is neither: it wears the
// classic mempool EXPLORER's clothes — block tiles, confirmation counts, a fee
// structure, a transaction feed — while every number in it comes from the wind
// tunnel in `protocols/stressnet-model.ts`. That is the most dangerous shape
// this repo has shipped, because a screenshot of it is one crop away from
// looking like a chain reading.
//
// So the risk here is NOT a broken page. A broken page is loud. The risk is a
// WORKING page that ships one badge short of honest, and it has four distinct
// failure modes, one per section below:
//
//   1. THE BANNER SCROLLS AWAY. A banner that is only at the top of a 4000px
//      page is a banner that was not there for most of the reading. §1 asserts
//      presence at BOTH scroll extremes, and — because "present" is the easy
//      half — that it is inside the viewport at both, which is the claim that
//      actually fails when someone changes `position: sticky` to `relative`.
//   2. A LIVE PROVENANCE BADGE APPEARS. The five-member ProvSource vocabulary
//      is the site's whole mechanism for saying where a number came from, and
//      NODE means "telemetry from the node this site reads". §3 asserts MODEL
//      is present AND that the other four are absent — both directions,
//      because "MODEL is present" stays true on a page that ALSO carries NODE.
//   3. A TXID LOOKS REAL. §4 asserts every rendered txid is patently synthetic
//      and carries a non-vacuity floor, since an empty selector satisfies
//      "every txid is marked" perfectly.
//   4. A CHAIN PARAMETER GETS INVENTED. The p3·19 embargo is untouched by
//      simulation: the real chain's genesis, nettype and ports are still
//      undocumented, and a SIMULATED page is exactly where a plausible-looking
//      one would slip in unchallenged. §5.
//
// WHY THE ASSERTIONS COME IN PAIRS. Nine of the checks below are ABSENCES, and
// an absence passes whether the property holds or the selector died. Every one
// is therefore paired with a positive control on the same instrument — §3's
// MODEL count, §4's txid floor, §5's corpus length, §6's banner-carries-it,
// §8's reduced-motion readout census. If a control reads zero the pairing has
// failed and the absence beside it proves nothing; that is what the control is
// for, and p4·06 recorded three assertions that shipped green without one.
//
// Run against serve-dist (NOT vite preview — see verify-future.mjs header).
//   npm run build && npm run wait-preview && node verify-explorer.mjs
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
const R = makeReporter('verify-explorer');

const { R: ROUTE } = await import(join(__dirname, 'scripts', 'routes.mjs'));
const EXPLORER = ROUTE.OPERATE_SUPERSTRESS_EXPLORER;

/* SOURCE READS NEVER THROW AT MODULE LOAD, and that is p4·01's #186 fix
 * applied on the way in rather than after the fact. A bare `readFileSync` at
 * top level turns a moved or missing file into a Node stack trace with ZERO
 * named reds and NO summary line — and a `grep '❌'` over that output returns
 * EMPTY, which reads exactly like "no failures found". Measured on this file's
 * own first run, before the page existed: `EXIT=1`, stack trace, no tally.
 * Each miss is recorded and reported as a named assertion in §0 instead. */
const READ_ERRORS = [];
const src = (...p) => {
  try {
    return readFileSync(join(__dirname, ...p), 'utf8');
  } catch (e) {
    READ_ERRORS.push(`${p.join('/')} — ${e.code || e.message}`);
    return '';
  }
};
const PAGE_SRC = src('src', 'pages', 'operate', 'StressnetExplorerPage.tsx');
const CHAIN_SRC = src('src', 'protocols', 'stressnet-chain.ts');
const MODEL_SRC = src('src', 'protocols', 'stressnet-model.ts');
const DATA_SRC = src('src', 'pages', 'future', 'data.ts');

/**
 * STRING-AWARE COMMENT STRIPPER, and it is written rather than copied for a
 * reason this repo has paid for three times.
 *
 * §11 asserts the chain module contains no `Math.random`. Run against the raw
 * source that assertion goes RED against a correct file, because the module's
 * own docblock explains at length WHY it uses a seeded hash instead of
 * `Math.random` — the code legitimately names the pattern it is forbidden to
 * use. verify-memshell.mjs hit exactly this and strips first.
 *
 * But its stripper is NOT string-aware, and the recorded defects are all in
 * that gap: p3·16's stripper blanked the `//` inside a URL string literal and
 * made a gate report an order mismatch against a page that was right; p4·01's
 * mangled the glob `'**{@literal /}api/**'`, a string containing both comment
 * delimiters; a p4·02 worker's read a template literal's closing backtick as
 * an opening one and swallowed the rest of the file. So this one tracks
 * quote state, including template literals, and is proven by the
 * falsifiability pair in §11 rather than trusted.
 */
function stripComments(s) {
  let out = '';
  let i = 0;
  let quote = null; // "'" | '"' | '`' | null
  while (i < s.length) {
    const c = s[i];
    const two = s.slice(i, i + 2);
    if (quote) {
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i++; continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; out += c; i++; continue; }
    if (two === '//') { while (i < s.length && s[i] !== '\n') { out += ' '; i++; } continue; }
    if (two === '/*') {
      while (i < s.length && s.slice(i, i + 2) !== '*/') { out += s[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2; continue;
    }
    out += c; i++;
  }
  return out;
}

const CHAIN_CODE = stripComments(CHAIN_SRC);
const MODEL_CODE = stripComments(MODEL_SRC);

/* The betanet accent, PARSED out of the page rather than typed here. The
 * p3·19 rule on the hub says the banner ships "in an accent used nowhere
 * else"; a literal restated in this file would let the two drift apart and
 * would make §6's uniqueness sweep agree with the gate instead of with the
 * app. */
const ACCENT = (PAGE_SRC.match(/BETANET_ACCENT\s*=\s*"(#[0-9a-f]{6})"/i) || [])[1] || '';

const { browser } = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

/* `main.main` is the scroller above 768px — `.art` is `height:100vh;
 * overflow:hidden` (styles.css:347-359), so `window.scrollTo` is a NO-OP on
 * desktop. CLAUDE.md records that trap twice; two pages shipped a
 * `window.scrollTo(0,0)` that never ran. Drive BOTH and report which moved,
 * so a future layout change cannot make this gate silently measure an
 * unscrolled page. */
const scrollTo = async (where) => {
  return page.evaluate((w) => {
    const el = document.querySelector('main.main');
    const doc = document.scrollingElement || document.documentElement;
    const set = (n) => (w === 'top' ? 0 : n.scrollHeight);
    if (el) el.scrollTop = set(el);
    if (doc) doc.scrollTop = set(doc);
    return { mainTop: el ? el.scrollTop : -1, docTop: doc ? doc.scrollTop : -1,
             mainH: el ? el.scrollHeight : -1 };
  }, where);
};

try {
  // ══ §0 · instrument floor ═══════════════════════════════════════════════
  /* Every set comparison below is vacuously true against a page that failed to
   * render, and a page that failed to render is exactly what a bad route
   * registration produces. Floor first, always. */
  R.group('§0 · the instrument found its subject');

  R.ok(READ_ERRORS.length === 0,
    READ_ERRORS.length === 0
      ? 'every source file this gate reads was found on disk'
      : `source read failed — ${READ_ERRORS.join(' | ')}`);
  R.ok(PAGE_SRC.length > 0 && CHAIN_SRC.length > 0 && MODEL_SRC.length > 0,
    `read page/chain/model sources (${PAGE_SRC.length}/${CHAIN_SRC.length}/${MODEL_SRC.length} chars)`);

  R.ok(typeof EXPLORER === 'string' && EXPLORER.length > 0,
    `routes.mjs exports OPERATE_SUPERSTRESS_EXPLORER: ${EXPLORER}`);

  const resp = await page.goto(BASE + EXPLORER, { waitUntil: 'networkidle' });
  R.ok(resp && resp.status() === 200, `GET ${EXPLORER} → ${resp ? resp.status() : 'no response'}`);

  const rootCount = await page.locator('[data-explorer-root]').count();
  R.ok(rootCount === 1, `the explorer root renders exactly once (found ${rootCount})`);

  const bodyText = await page.locator('main.main').innerText();
  R.ok(bodyText.length > 800, `the page carries ${bodyText.length} chars of rendered text (floor)`);

  const h1 = await page.locator('#page-title').count();
  R.ok(h1 === 1, `exactly one #page-title h1 (found ${h1})`);

  // ══ §1 · THE BANNER IS PERSISTENT ═══════════════════════════════════════
  /* The headline assertion of the whole release. Two scroll extremes, and at
   * each one both halves: the element EXISTS, and its box is actually inside
   * the viewport. Existence alone is satisfied by a banner that has scrolled
   * 3000px off the top, which is precisely the defect. */
  R.group('§1 · the BETANET banner is persistent at both scroll extremes');

  const banner = page.locator('[data-betanet-banner]');
  R.ok(await banner.count() === 1, 'exactly one [data-betanet-banner]');

  const bannerState = async () => page.evaluate(() => {
    const el = document.querySelector('[data-betanet-banner]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      text: el.innerText.replace(/\s+/g, ' ').trim(),
      top: Math.round(r.top), bottom: Math.round(r.bottom),
      h: Math.round(r.height), w: Math.round(r.width),
      position: cs.position,
      visible: cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05,
      inViewport: r.bottom > 0 && r.top < window.innerHeight && r.height > 0,
    };
  });

  const atTop = await scrollTo('top');
  const bTop = await bannerState();
  R.ok(bTop !== null, 'the banner is in the DOM at the top of the page');
  R.ok(bTop && bTop.inViewport, `at scrollTop=0 the banner is inside the viewport (top=${bTop && bTop.top}, h=${bTop && bTop.h})`);
  R.ok(bTop && bTop.visible, 'and it is actually visible (not display:none / visibility:hidden / opacity:0)');

  const atBottom = await scrollTo('bottom');
  /* Positive control on the SCROLL ITSELF. Without it, a page shorter than the
   * viewport — or a scroller this helper failed to find — makes the bottom
   * assertion identical to the top one, and the pair proves nothing. */
  R.ok(atBottom.mainTop > 200 || atBottom.docTop > 200,
    `the page actually scrolled (main.scrollTop=${atBottom.mainTop}, doc.scrollTop=${atBottom.docTop}, mainScrollH=${atBottom.mainH})`);

  const bBot = await bannerState();
  R.ok(bBot && bBot.inViewport,
    `at the BOTTOM of the page the banner is STILL inside the viewport (top=${bBot && bBot.top}, h=${bBot && bBot.h})`);
  R.ok(bBot && bBot.visible, 'and still visible there');
  R.ok(bBot && bBot.h > 0 && bBot.w > 0, `and still has a box (${bBot && bBot.w}×${bBot && bBot.h})`);

  // ══ §2 · IT SAYS WHAT IT IS ═════════════════════════════════════════════
  R.group('§2 · the banner carries the #188 rule\'s words, and SIMULATED');

  const bannerText = (bBot && bBot.text) || '';
  R.ok(/BETANET\s*·\s*NOT MAINNET\s*·\s*TEST FUNDS ONLY/i.test(bannerText),
    `the banner states the #188 rule verbatim: "${bannerText.slice(0, 90)}"`);
  R.ok(/\bSIMULATED\b/i.test(bannerText),
    'and the word SIMULATED, which the #188 rule did not need and this page does');

  /* SIMULATED must also survive outside the banner — the banner is one element
   * and a reader who has scrolled to a panel is reading the panel. */
  const pageText = await page.locator('[data-explorer-root]').innerText();
  const simMentions = (pageText.match(/\bsimulated\b/gi) || []).length;
  R.ok(simMentions >= 3, `"simulated" appears ${simMentions} times in the page body (floor 3)`);

  /* And the page must never claim the opposite. These are the words that would
   * turn a model into a measurement. */
  const LIE_RX = /\blive (chain|data|feed|reading)\b|\breal[- ]time chain\b|\bmainnet (data|reading)\b|\bfrom the (beta[- ]?chain|node)\b/i;
  const lies = pageText.split(/(?<=[.!?])\s+|\n+/).filter((s) => LIE_RX.test(s));
  R.ok(lies.length === 0,
    lies.length === 0
      ? 'no sentence claims this is a live or measured reading'
      : `sentences claiming a live reading: ${lies.slice(0, 2).join(' | ')}`);

  // ══ §3 · PROVENANCE — MODEL, AND NOTHING THAT MEANS LIVE ════════════════
  /* Both directions on one instrument. "MODEL is present" is true of a page
   * that also carries NODE, and "NODE is absent" is true of a page whose
   * provenance markup died entirely — neither alone is the claim. */
  R.group('§3 · every provenance badge on the page says MODEL');

  const prov = await page.evaluate(() => {
    const root = document.querySelector('[data-explorer-root]');
    const all = root ? [...root.querySelectorAll('[class*="prov--"]')] : [];
    const kinds = {};
    for (const el of all) {
      for (const c of el.classList) {
        if (c.startsWith('prov--') && c !== 'prov--inline' && c !== 'prov--bare' && c !== 'prov--compact') {
          kinds[c.slice(6)] = (kinds[c.slice(6)] || 0) + 1;
        }
      }
    }
    return kinds;
  });

  R.ok((prov.model || 0) >= 2,
    `MODEL provenance badges rendered: ${prov.model || 0} (floor 2 — the positive control for the absences below)`);

  for (const live of ['node', 'network', 'coingecko', 'session']) {
    R.ok(!(prov[live] > 0),
      `no ${live.toUpperCase()} provenance badge anywhere on the page (found ${prov[live] || 0})`);
  }

  /* The freshness suffix is the other half of the provenance vocabulary, and
   * "LIVE" there would assert a feed this page does not have. */
  const provText = await page.evaluate(() => {
    const root = document.querySelector('[data-explorer-root]');
    return root ? [...root.querySelectorAll('.prov')].map((e) => e.innerText).join(' | ') : '';
  });
  R.ok(provText.length > 0, `provenance markup found and read (${provText.length} chars)`);
  R.ok(!/\blive\b/i.test(provText),
    `no provenance badge carries a LIVE freshness suffix: "${provText.slice(0, 120)}"`);

  /* And the live-feed heartbeat must not be here. MemViewShell renders
   * MempoolHeartbeat unconditionally — "LIVE · updated Ns ago" — which is why
   * this page rebuilds the classic IDIOM rather than importing the shell. */
  R.ok(!/updated \d+s ago/i.test(pageText),
    'the live-feed heartbeat ("updated Ns ago") does not appear on this page');

  // ══ §4 · EVERY TXID IS PATENTLY SYNTHETIC ═══════════════════════════════
  R.group('§4 · no transaction id on this page could be mistaken for a real one');

  const txids = await page.evaluate(() =>
    [...document.querySelectorAll('[data-sim-txid]')]
      .map((e) => (e.getAttribute('data-sim-txid') || '').trim()));

  R.ok(txids.length >= 8,
    `${txids.length} transaction ids rendered (floor 8 — the non-vacuity control for the marking assertion)`);

  const unmarked = txids.filter((t) => !t.startsWith('sim:'));
  R.ok(unmarked.length === 0,
    unmarked.length === 0
      ? `all ${txids.length} txids carry the sim: prefix`
      : `${unmarked.length} txid(s) are NOT marked synthetic: ${unmarked.slice(0, 3).join(', ')}`);

  /* The attribute is the machine-readable half; the READER only sees the
   * rendered text. A page that stamps sim: on an attribute and prints a bare
   * 64-hex string is exactly a screenshot that circulates as real. */
  const shownIds = await page.evaluate(() =>
    [...document.querySelectorAll('[data-sim-txid]')].map((e) => e.innerText.trim()));
  const shownUnmarked = shownIds.filter((t) => t.length > 0 && !/sim:/i.test(t));
  R.ok(shownUnmarked.length === 0,
    shownUnmarked.length === 0
      ? `and all ${shownIds.length} are RENDERED with the marking visible, not only in an attribute`
      : `${shownUnmarked.length} txid(s) render without a visible sim: marker: ${shownUnmarked.slice(0, 3).join(', ')}`);

  /* A bare 64-hex run anywhere in the page text is a real-looking Monero txid
   * whatever element it sits in. Scoped to the page body so the chrome cannot
   * contribute. */
  const bareHex = (pageText.match(/\b[0-9a-f]{64}\b/gi) || []);
  R.ok(bareHex.length === 0,
    bareHex.length === 0
      ? 'no bare 64-hex string is printed anywhere in the page body'
      : `${bareHex.length} bare 64-hex string(s) printed: ${bareHex.slice(0, 2).join(', ')}`);

  // ══ §5 · THE CHAIN-PARAMETER EMBARGO SURVIVES SIMULATION ════════════════
  /* p3·19 answered the endpoint question and left genesis / nettype / ports
   * explicitly undocumented, because nobody has published them. A simulated
   * page is the likeliest place for an invented one to appear looking
   * authoritative. The corpus length is the positive control: an empty
   * pageText would satisfy every absence below. */
  R.group('§5 · no chain parameter is invented, and no address is printed');

  R.ok(pageText.length > 600, `page body corpus is ${pageText.length} chars (control for the absences below)`);

  const EMBARGO = [
    ['genesis', /\bgenesis (block|hash|tx)\b/i],
    ['nettype', /\bnettype\b|\btestnet\b|\bstagenet\b/i],
    /* PROXIMITY, not adjacency — and this pattern is WIDER than it was because
     * a break test refused to go red. The first version required the digits to
     * touch the word ("port: 18085", "18085 port"); the mutation that exposed
     * it said "the beta chain's P2P port IS 18085", and three characters of
     * English defeated the whole assertion while 81 others stayed green. It is
     * the narrower-subject family this repo records, in my own gate.
     *
     * A bare 4-5 digit ban is not available: the page legitimately prints
     * heights (#40000) and fee rates (20,000 pn/B). So the check is the WORD
     * within 40 non-sentence-ending characters of the NUMBER, in either order,
     * which is what "documenting a port" actually looks like in prose. The
     * page's own copy contains no occurrence of "port" outside imports, so the
     * false-positive surface is empty — verified, not assumed. */
    ['a port number', /\bports?\b[^.!?]{0,40}\b\d{4,5}\b|\b\d{4,5}\b[^.!?]{0,40}\bports?\b/i],
    ['a seed node / peer address', /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/],
    ['a Monero address', /\b[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/],
    ['an onion address', /\b[a-z2-7]{16,56}\.onion\b/i],
    ['a difficulty/target claim for the real chain', /\bthe (?:beta[- ]?chain|stressnet)'?s? (?:difficulty|block target|genesis)\b/i],
  ];
  for (const [name, rx] of EMBARGO) {
    const hit = pageText.match(rx);
    R.ok(!hit, hit ? `EMBARGO BREACH — ${name}: "${String(hit[0]).slice(0, 40)}"` : `no ${name} appears in the copy`);
  }

  /* The resurrection sweep, this page's own copy. verify-superstress §6f reads
   * the HUB; the same defect on a NEW page would be invisible to it. Sentence
   * -scoped for the reason that gate records: the page legitimately says
   * "endpoint" (explaining there is none) and could legitimately say
   * "pending" about something else. */
  const sentences = pageText.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
  R.ok(sentences.length > 12, `${sentences.length} sentences parsed (control)`);
  const PENDING_RX = /\bpending\b|awaiting|landing soon|coming soon|to be wired|not wired|still to come/i;
  const ENDPOINT_RX = /endpoint|telemetry/i;
  const resurrected = sentences.filter((s) => ENDPOINT_RX.test(s) && PENDING_RX.test(s));
  R.ok(resurrected.length === 0,
    resurrected.length === 0
      ? 'no sentence pairs an endpoint word with a pending word — the answered question stays answered'
      : `resurrected: ${resurrected.slice(0, 2).join(' | ')}`);

  /* And no "live coming soon" promise anywhere — §1.5's explicit ban. The
   * source switch is architecture, not a promise. */
  const PROMISE_RX = /\bcoming soon\b|\bwhen (?:the |a )?live\b|\bonce (?:the )?(?:endpoint|node) (?:is |lands)\b|\bfeature flag\b/i;
  const promises = sentences.filter((s) => PROMISE_RX.test(s));
  R.ok(promises.length === 0,
    promises.length === 0
      ? 'and the page makes no "live coming soon" promise'
      : `promise copy found: ${promises.slice(0, 2).join(' | ')}`);

  // ══ §6 · AN ACCENT USED NOWHERE ELSE ════════════════════════════════════
  /* The p3·19 rule's second clause, which is the one a reviewer skips because
   * it reads as styling. It is not: sharing a colour with mainnet numbers is
   * how a crop of this page becomes indistinguishable from /live/mempool. */
  R.group('§6 · the betanet accent is used nowhere else in the tree');

  R.ok(/^#[0-9a-f]{6}$/i.test(ACCENT),
    `parsed BETANET_ACCENT out of the page source: ${ACCENT || '(none — the constant moved or was renamed)'}`);

  if (ACCENT) {
    const { execSync } = await import('node:child_process');
    const hits = execSync(
      `grep -rniE "${ACCENT.slice(1)}" src/ *.css 2>/dev/null | grep -v "StressnetExplorerPage" || true`,
      { cwd: __dirname, encoding: 'utf8' }).trim();
    const other = hits ? hits.split('\n').filter(Boolean) : [];
    R.ok(other.length === 0,
      other.length === 0
        ? `${ACCENT} appears in no other file — it is this page's alone`
        : `${ACCENT} is shared with: ${other.slice(0, 3).join(' | ')}`);

    /* Positive control: the accent must actually REACH the banner, or the
     * uniqueness sweep above is a true fact about an unused constant. */
    const bannerUsesAccent = await page.evaluate((hex) => {
      const el = document.querySelector('[data-betanet-banner]');
      if (!el) return false;
      const want = hex.toLowerCase().replace('#', '');
      const rgb = (s) => {
        const m = s.match(/rgba?\(([^)]+)\)/);
        if (!m) return '';
        const p = m[1].split(',').map((n) => Number(n.trim()));
        return p.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join('');
      };
      const els = [el, ...el.querySelectorAll('*')];
      return els.some((n) => {
        const cs = getComputedStyle(n);
        return rgb(cs.color) === want || rgb(cs.borderTopColor) === want ||
               rgb(cs.backgroundColor) === want || rgb(cs.borderLeftColor) === want;
      });
    }, ACCENT);
    R.ok(bannerUsesAccent, `and the banner actually renders in it (computed style carries ${ACCENT})`);
  }

  // ══ §7 · THE CLASSIC EXPLORER IDIOM ═════════════════════════════════════
  /* The page has to BE an explorer, not a banner with a paragraph under it.
   * These are the three surfaces the prompt names: tiles, confirmations, fee
   * structure. */
  R.group('§7 · the classic explorer layout renders, driven by the model');

  const layout = await page.evaluate(() => ({
    blocks: document.querySelectorAll('[data-sim-block]').length,
    confs: [...document.querySelectorAll('[data-sim-conf]')].map((e) => Number(e.getAttribute('data-sim-conf'))),
    tiers: document.querySelectorAll('[data-sim-tier]').length,
    stats: document.querySelectorAll('[data-explorer-stat]').length,
    dial: document.querySelectorAll('[data-storm]').length,
  }));

  R.ok(layout.blocks >= 6, `${layout.blocks} block tiles render (floor 6)`);
  R.ok(layout.tiers >= 3, `${layout.tiers} fee-tier rows render (floor 3)`);
  R.ok(layout.stats >= 4, `${layout.stats} explorer stat readouts render (floor 4)`);
  R.ok(layout.dial === 1, `exactly one storm dial (found ${layout.dial})`);

  /* Confirmations must be a real ordering, not a constant — the classic view's
   * whole confirmation idiom is "tip − block height", and a column of
   * identical numbers is the shape that ships when the derivation breaks. */
  const confs = layout.confs;
  R.ok(confs.length >= 6, `${confs.length} confirmation counts read (control)`);
  const strictlyIncreasing = confs.every((c, i) => i === 0 || c > confs[i - 1]);
  R.ok(strictlyIncreasing,
    strictlyIncreasing
      ? `confirmations increase strictly with depth: ${confs.slice(0, 8).join(' < ')}`
      : `confirmations are not a strict ordering: ${confs.slice(0, 8).join(', ')}`);
  R.ok(new Set(confs).size === confs.length,
    `and no two tiles report the same confirmation count (${new Set(confs).size} distinct of ${confs.length})`);

  // ══ §8 · THE DIAL DRIVES THE CHAIN ══════════════════════════════════════
  /* The storm dial is the page's only input, and if it does not move the
   * numbers then the "explorer" is a static picture with a slider on it. Two
   * measurements at two intensities, on the same instrument. */
  R.group('§8 · the wind tunnel actually drives the readouts');

  const readStats = () => page.evaluate(() =>
    [...document.querySelectorAll('[data-explorer-stat]')]
      .map((e) => e.getAttribute('data-explorer-stat') + '=' + e.innerText.replace(/\s+/g, ' ').trim()));

  await scrollTo('top');
  const dial = page.locator('[data-storm]');
  await dial.fill('8');
  await page.waitForTimeout(120);
  const calm = await readStats();
  await dial.fill('96');
  await page.waitForTimeout(120);
  const storm = await readStats();

  R.ok(calm.length >= 4 && storm.length >= 4,
    `read ${calm.length} readouts at calm and ${storm.length} at storm (control)`);
  const moved = calm.filter((c, i) => c !== storm[i]).length;
  R.ok(moved >= 3,
    moved >= 3
      ? `${moved} of ${calm.length} readouts change between storm 8 and storm 96`
      : `only ${moved} readout(s) moved — the dial is not driving the model. calm=${calm.join(' ')} storm=${storm.join(' ')}`);

  /* And the failure the wind tunnel exists to show must be reachable: at full
   * storm the block-size cap is exceeded and a backlog appears. A model that
   * never breaks proves nothing — stressnet.tsx's own header says so. */
  const brokeAtStorm = await page.evaluate(() =>
    document.querySelectorAll('[data-sim-broken="true"]').length > 0);
  R.ok(brokeAtStorm, 'at storm 96 the page reports the cap exceeded — the failure state is reachable');

  // ══ §9 · THE LINKS CLOSE ════════════════════════════════════════════════
  R.group('§9 · the null placeholder closed and the hub crosslinks here');

  R.ok(!/\["Beta-chain explorer",\s*null\]/.test(DATA_SRC),
    'data.ts no longer carries ["Beta-chain explorer", null]');
  R.ok(/Beta-chain explorer[^"]*·\s*simulated[^"]*",\s*R\.OPERATE_SUPERSTRESS_EXPLORER/.test(DATA_SRC),
    'and the row now points at this route, labelled simulated');

  await page.goto(BASE + ROUTE.OPERATE_SUPERSTRESS, { waitUntil: 'networkidle' });
  const hubLinks = await page.evaluate(() =>
    [...document.querySelectorAll('[data-crosslinks] a')].map((a) => ({
      href: new URL(a.href).pathname, text: a.innerText.replace(/\s+/g, ' ').trim() })));
  R.ok(hubLinks.length >= 4, `the hub renders ${hubLinks.length} crosslinks (control)`);
  const toExplorer = hubLinks.filter((l) => l.href === EXPLORER);
  R.ok(toExplorer.length === 1,
    toExplorer.length === 1
      ? `the hub links to the explorer: "${toExplorer[0].text}"`
      : `the hub has ${toExplorer.length} links to ${EXPLORER}`);
  R.ok(toExplorer.length === 1 && /simulated/i.test(toExplorer[0].text),
    'and that link says "simulated" on its face, so the hub never sends a reader to it expecting a chain reading');

  /* The hub's own answered-state copy is NOT this PR's to edit, and the rule
   * paragraph it carries is what this page inherits. Assert both survived. */
  const hubText = await page.locator('main.main').innerText();
  R.ok(/BETANET\s*·\s*NOT MAINNET\s*·\s*TEST FUNDS ONLY/i.test(hubText),
    'the hub still records the #188 rule this page obeys');
  R.ok(/no path from here to your beta chain/i.test(hubText),
    'and the hub\'s answered-state copy is untouched — no live panel, still, by design');

  // ══ §10 · REDUCED MOTION LOSES NO INFORMATION ═══════════════════════════
  /* The sim precedent: stressnet.tsx's model is closed-form so "the readouts
   * are identical whether the canvas is animating or frozen at t=0". The same
   * property has to hold here, and it is checkable rather than asserted —
   * every readout, every tile and every txid must still be present. */
  R.group('§10 · under prefers-reduced-motion nothing is lost');

  const rmCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const rm = await rmCtx.newPage();
  await rm.goto(BASE + EXPLORER, { waitUntil: 'networkidle' });

  const rmCensus = await rm.evaluate(() => ({
    blocks: document.querySelectorAll('[data-sim-block]').length,
    txids: document.querySelectorAll('[data-sim-txid]').length,
    stats: document.querySelectorAll('[data-explorer-stat]').length,
    tiers: document.querySelectorAll('[data-sim-tier]').length,
    banner: document.querySelectorAll('[data-betanet-banner]').length,
    running: document.getAnimations ? document.getAnimations().filter((a) => a.playState === 'running').length : -1,
  }));

  R.ok(rmCensus.banner === 1, 'the banner is still there under reduced motion');
  R.ok(rmCensus.blocks >= 6, `all ${rmCensus.blocks} block tiles still render (was ${layout.blocks})`);
  R.ok(rmCensus.txids >= 8, `all ${rmCensus.txids} transaction rows still render (was ${txids.length})`);
  R.ok(rmCensus.stats === layout.stats, `the same ${rmCensus.stats} stat readouts render (was ${layout.stats})`);
  R.ok(rmCensus.tiers === layout.tiers, `the same ${rmCensus.tiers} fee-tier rows render (was ${layout.tiers})`);
  R.ok(rmCensus.running === 0, `zero running animations under reduced motion (found ${rmCensus.running})`);

  await rmCtx.close();

  // ══ §11 · THE CHAIN IS SEEDED, NOT RANDOM ═══════════════════════════════
  /* A simulated chain built on Math.random would render a different history on
   * every reload — which makes a screenshot unreproducible, a break test
   * unrepeatable and this gate's own assertions unstable. Seeded is the
   * stronger honesty property, not merely the convenient one. */
  R.group('§11 · the simulated chain is deterministic');

  const chainOf = async (p) => p.evaluate(() =>
    [...document.querySelectorAll('[data-sim-block]')]
      .map((e) => e.getAttribute('data-sim-height') + ':' + e.getAttribute('data-sim-kb')).join('|'));

  const c1ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const c1 = await c1ctx.newPage();
  await c1.goto(BASE + EXPLORER, { waitUntil: 'networkidle' });
  const chainA = await chainOf(c1);
  await c1.reload({ waitUntil: 'networkidle' });
  const chainB = await chainOf(c1);
  await c1ctx.close();

  R.ok(chainA.length > 20, `the chain fingerprint is non-empty (${chainA.length} chars — control)`);
  R.ok(chainA === chainB,
    chainA === chainB
      ? 'two loads of the frozen chain produce an identical block series'
      : `the chain differs between loads:\n  A=${chainA.slice(0, 120)}\n  B=${chainB.slice(0, 120)}`);

  /* FALSIFIABILITY PAIR for the stripper, offline and run before the
   * assertions that depend on it. Without this the two `Math.random` checks
   * below are green whether the stripper works or silently blanks the whole
   * file — and a stripper that returns "" satisfies every absence perfectly.
   * Case A must survive stripping (it is code); case B must not (it is a
   * comment); case C is the string-literal trap p3·16 recorded. */
  const A = stripComments('const x = Math.random();');
  const B = stripComments('// never call Math.random here\nconst x = 1;');
  const C = stripComments('const u = "http://x/y"; const v = Math.random();');
  R.ok(/Math\.random/.test(A), 'stripper self-check A — code survives stripping');
  R.ok(!/Math\.random/.test(B), 'stripper self-check B — a comment does not');
  R.ok(/Math\.random/.test(C) && C.includes('http://x/y'),
    'stripper self-check C — a // inside a string literal is not read as a comment');
  R.ok(CHAIN_CODE.length > 400 && MODEL_CODE.length > 200,
    `stripped sources are non-empty (${CHAIN_CODE.length}/${MODEL_CODE.length} chars) — an empty strip would satisfy every absence below`);

  R.ok(!/Math\.random/.test(CHAIN_CODE),
    'the chain module CALLS no Math.random — it draws from design/prng.ts\'s seeded h3');
  R.ok(!/Math\.random/.test(MODEL_CODE),
    'and neither does the model leaf');
  R.ok(/from ["']@\/design\/prng["']|from ["']\.\.\/design\/prng["']/.test(CHAIN_CODE),
    'the chain module imports the shared seeded generator rather than growing its own');

  // ══ §12 · 390px ═════════════════════════════════════════════════════════
  /* verify-mobile sweeps this route automatically (it imports ROUTES), so this
   * section does NOT restate the type floor or the overflow sweep. What it
   * does check is the one property that is specific to this page and that a
   * site-wide sweep cannot know: the banner survives the phone. */
  R.group('§12 · the banner survives 390px, at both scroll extremes');

  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const mp = await mob.newPage();
  await mp.goto(BASE + EXPLORER, { waitUntil: 'networkidle' });

  const mobBanner = async () => mp.evaluate(() => {
    const el = document.querySelector('[data-betanet-banner]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { inViewport: r.bottom > 0 && r.top < window.innerHeight && r.height > 0,
             right: Math.round(r.right), clipped: el.scrollWidth > el.clientWidth + 1 };
  });

  const mTop = await mobBanner();
  R.ok(mTop && mTop.inViewport, 'at 390 the banner is in the viewport at the top');
  R.ok(mTop && mTop.right <= 391, `and does not overflow the 390px viewport (right=${mTop && mTop.right})`);
  R.ok(mTop && !mTop.clipped, 'and its own text is not clipped inside it');

  await mp.evaluate(() => {
    const el = document.querySelector('main.main');
    const doc = document.scrollingElement || document.documentElement;
    if (el) el.scrollTop = el.scrollHeight;
    if (doc) doc.scrollTop = doc.scrollHeight;
  });
  const mBot = await mobBanner();
  R.ok(mBot && mBot.inViewport, 'and it is STILL in the viewport at the bottom of the page on a phone');

  await mob.close();

} catch (err) {
  R.ok(false, `Test crashed: ${err.message}`);
} finally {
  await browser.close();
}

process.exit(R.finish());
