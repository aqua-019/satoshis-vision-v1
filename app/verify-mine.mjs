// verify-mine.mjs — DOM gate for /operate/mine, the 15th route.
//
// Sections:
//   §0  instrument floors — the source parses everything below compares against
//   §1  the route resolves, is PRERENDERED, and all four walkthroughs are in
//       that HTML (the JS-off reader gets the instructions, not four buttons)
//   §2  four Disclosure rows, single-select, BOTH aria polarities
//   §3  every rendered command matches its recorded upstream quote
//   §4  the honesty invariants — no earnings, no device hashrate, the privacy
//       caveat present, the miner's own donation disclosed
//   §5  the one live number is real or an em-dash, and says where it came from
//   §6  the visual — DOM labels, no SVG text, no numerals, and a still frame
//       that keeps its information
//   §7  every in-app link resolves to a route that exists
//   §8  390px
//   §9  reduced motion — nothing running, no SMIL, and the field still reads
//
// ── NO COLD-BOOT BYPASS HERE, DELIBERATELY — do not "restore" it. ─────────
// verify-peers.mjs and verify-superstress.mjs carry the identical note and the
// identical reason. verify-coldboot-live §0 audits the gates that install the
// bypass against the set its own patterns detect as REACHING `/`. This gate
// never navigates to `/`, holds no array containing '/', names no R.HOME, and
// does not ITERATE the canonical ROUTES (it imports that list purely as a
// membership predicate — `.includes()` in §7, the exact shape §0's own comment
// in that gate carves out). A gate that installs a bypass it does not need is a
// false positive in that proxy and reds §0 with "DETECTOR STALE".
//
// ── WHY §3 IS NOT A SOURCE-COMPARED-TO-ITSELF CHECK ──────────────────────
// p3·19 recorded a gate that "proved" a single-source rule by comparing two
// values derived from ONE array, so an edit moved both sides and it stayed
// green. This is deliberately the other shape. The commands live as JSX string
// literals in MinePage.tsx; UPSTREAM holds an independent transcription of the
// same lines, taken from the READMEs named beside it. They are two copies with
// no common ancestor in this repo, so editing either one reds — which is
// exactly the drift worth catching, because a command that quietly stops
// matching its upstream source is a walkthrough that no longer works.
//
// BLIND SPOTS (stated, not hidden):
//   — Whether the commands actually mine. Nothing offline can know that, and
//     nothing here claims it. §3 asserts the page agrees with the transcription
//     of upstream; whether upstream is still right is an operator check.
//   — Upstream URL reachability. Egress to github.com is blocked here (raw
//     .githubusercontent answers, github.com does not), so §7 checks in-app
//     links only and the external ones are listed for a human.
//   — The LIVE feed face. serve-dist answers /api/** with 501, so §5 exercises
//     the degraded branch. That is the branch that matters for the honesty
//     claim (an em-dash, never a synthesised number) and it is the only one
//     reachable here; the live face is verify-mobile's site-wide live-state run.
//   — Prose QUALITY. This gate checks that the honest sentences are present and
//     the dishonest ones absent. It cannot check that the guide is any good.
//
// Run against serve-dist (NOT vite preview — see verify-future.mjs header):
//   npm run build && npm run wait-preview && node verify-mine.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './verify-lib.mjs';
import { makeReporter } from './verify-reporter.mjs';
import { ROUTES } from './scripts/routes.mjs';

const BASE = 'http://localhost:4173';
const __dirname = dirname(fileURLToPath(import.meta.url));
const R = makeReporter('verify-mine');

const MINE = '/operate/mine';

/* ══ §0 · instrument floors ═════════════════════════════════════════════
   Every set-difference below is vacuously true if its parse returns nothing,
   which is the defect verify-ia §7b and verify-superstress §0 each open with a
   floor to prevent. Each parse is asserted non-empty BEFORE anything reads it,
   and the sections that depend on a failed parse decline rather than pass. */
R.group('§0 · instrument floors — the parses everything below depends on');

const SRC = readFileSync(join(__dirname, 'src/pages/MinePage.tsx'), 'utf8');
R.ok(SRC.length > 8000, `MinePage.tsx read (${SRC.length} chars)`);

/** Every `cmd("id", "…")` call site, in source order. */
const CMDS = [...SRC.matchAll(/\bcmd\(\s*"([a-z0-9]+)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/g)]
  .map((m) => ({ id: m[1], cmd: m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\') }));
R.ok(CMDS.length >= 15,
  `parsed the page's command list from source (${CMDS.length} cmd() call sites)`,
  'a parse returning nothing would make §3 vacuously true');

/** The four platform ids, parsed from the Disclosure rows rather than retyped. */
const PLATFORMS = [...SRC.matchAll(/<Disclosure\s+id="([a-z]+)"/g)].map((m) => m[1]);
R.ok(PLATFORMS.length === 4,
  `four platform disclosures declared in source (${PLATFORMS.join(', ') || 'NONE'})`);

/* ══ THE UPSTREAM TRANSCRIPTION ═════════════════════════════════════════
   An INDEPENDENT copy of the command lines, transcribed from the upstream
   READMEs named below. It shares no ancestor with the page's own JSX literals,
   which is what makes §3 a real comparison — see this file's header.

   Sources, each read at its canonical raw URL:
     P2Pool  SChernykh/p2pool README — "Mining on GNU/Linux", "Mining on
             Windows", "macOS", "Android (Termux)"
     XMRig   xmrig/xmrig README, and its own CMakeLists options for the
             hwloc flag
   Two facts the Termux block rests on were MEASURED against the termux-packages
   tree rather than assumed: there is no `xmrig` package (404), which is why it
   is compiled, and there is no `hwloc` package (404), which is why the build
   passes -DWITH_HWLOC=OFF while `libuv`, `openssl` and `build-essential` all
   resolve (200). */
const MONEROD =
  './monerod --zmq-pub tcp://127.0.0.1:18083 --out-peers 32 --in-peers 64 ' +
  '--add-priority-node=p2pmd.xmrvsbeast.com:18080 --add-priority-node=nodes.hashvault.pro:18080 ' +
  '--enforce-dns-checkpointing --enable-dns-blocklist';

const UPSTREAM = [
  'sudo sysctl vm.nr_hugepages=3072',
  MONEROD,
  './p2pool --host 127.0.0.1 --wallet YOUR_WALLET_ADDRESS --mini',
  './xmrig -o 127.0.0.1:3333',
  "grep -E 'WARNING|ERROR' p2pool.log",
  '.\\p2pool.exe --host 127.0.0.1 --wallet YOUR_WALLET_ADDRESS --mini',
  '.\\xmrig.exe -o 127.0.0.1:3333',
  'brew update && brew install git cmake libuv zmq libpgm curl',
  'git clone --recursive https://github.com/SChernykh/p2pool',
  'pkg install git build-essential cmake libuv libzmq libcurl openssl',
  'cmake .. -DWITH_HWLOC=OFF && make -j$(nproc)',
];
UPSTREAM.push(
  '.\\Monero\\monerod.exe --zmq-pub tcp://127.0.0.1:18083 --out-peers 32 --in-peers 64 ' +
  '--add-priority-node=p2pmd.xmrvsbeast.com:18080 --add-priority-node=nodes.hashvault.pro:18080 ' +
  '--enforce-dns-checkpointing --enable-dns-blocklist');
R.ok(UPSTREAM.length === 12, `upstream transcription holds ${UPSTREAM.length} verbatim command lines`);

/* NOT VERBATIM, AND DECLARED ONE BY ONE WITH ITS REASON.
   This list exists because the page's first draft claimed every command was a
   quote while three were not, and only READING caught it — no assertion could,
   because the gate at that point only checked that the quotes it knew about
   were PRESENT. Absence of a check is not a check.
   Each entry names why it is not a quote. §3 asserts the rendered set is
   covered by UPSTREAM ∪ these, so a FOURTH non-quoted command cannot appear
   without someone declaring it here and on the page. */
const DERIVED = [
  ['cd p2pool && mkdir build && cd build && cmake .. && make -j$(sysctl -n hw.logicalcpu)',
   "P2Pool's macOS build steps, JOINED — upstream lists these as consecutive lines; " +
   'they are concatenated so one copy does the whole build. Every segment is upstream\'s.'],
  ['git clone https://github.com/xmrig/xmrig && mkdir xmrig/build && cd xmrig/build',
   'XMRig publishes its build guide at xmrig.com/docs, which this page cannot quote and ' +
   'this gate cannot reach. These are the standard CMake steps, and the page says so.'],
  ['./xmrig -o 192.168.1.10:3333',
   "XMRig's own invocation with the HOST changed: a phone points at a P2Pool on the LAN, " +
   'not at localhost. The page marks this line as the adapted one where it appears.'],
];
R.ok(DERIVED.length === 3, `${DERIVED.length} commands are declared NOT verbatim, each with a reason`);

const { browser } = await launch();

try {
  /* ══ §1 · the route, and what a JS-off reader gets ════════════════════ */
  R.group('§1 · the route resolves and every walkthrough ships in the prerendered HTML');

  const page = await browser.newPage();
  const resp = await page.goto(BASE + MINE, { waitUntil: 'networkidle' });
  R.ok(resp && resp.status() === 200, `${MINE} responds 200 (${resp && resp.status()})`);

  const h1 = await page.evaluate(() => document.querySelector('h1#page-title')?.innerText.trim() ?? '');
  R.ok(h1.length > 0, `the page renders an <h1#page-title> ("${h1}")`);

  /* JS OFF. Disclosure renders its panel ALWAYS and toggles `hidden`, and
     index.html's <noscript> reveals `.nojs-reveal`, so all four walkthroughs
     must be readable with scripting disabled — the Tor-at-Safest reader this
     site prerenders for. p3·16 measured the conditional-mount alternative at
     ZERO panels in the document; this is the assertion that keeps it at four. */
  const nojsCtx = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await nojsCtx.newPage();
  await nojs.goto(BASE + MINE, { waitUntil: 'domcontentloaded' });
  const nojsPanels = await nojs.evaluate(() => {
    const els = [...document.querySelectorAll('.disc-panel')];
    return { n: els.length, chars: els.reduce((a, e) => a + e.textContent.trim().length, 0) };
  });
  R.ok(nojsPanels.n === 4,
    `with JavaScript OFF the document carries all four walkthrough panels (${nojsPanels.n})`);
  R.ok(nojsPanels.chars > 2000,
    `and they carry their real content, not empty shells (${nojsPanels.chars} chars)`);
  await nojsCtx.close();

  /* ══ §2 · the accordion ═══════════════════════════════════════════════ */
  R.group('§2 · four disclosure rows, single-select, both aria polarities');

  const domIds = await page.evaluate(() =>
    [...document.querySelectorAll('[data-disclosure]')].map((e) => e.getAttribute('data-disclosure')));
  R.ok(domIds.length === 4, `four disclosure rows render (${domIds.join(', ') || 'NONE'})`);
  R.ok(PLATFORMS.every((p) => domIds.includes(p)),
    'every platform declared in source renders a row',
    `source: ${PLATFORMS.join(',')} · dom: ${domIds.join(',')}`);

  const openCount = async (p) => p.evaluate(() =>
    [...document.querySelectorAll('[data-disclosure] button')]
      .filter((b) => b.getAttribute('aria-expanded') === 'true').length);

  R.ok((await openCount(page)) === 1, 'exactly one row is open on arrival');

  /* Click through Playwright and WAIT for the commit. `page.evaluate(() => {
     btn.click(); return read(); })` measures the PREVIOUS render, because a
     React-state-controlled component does not change in the same synchronous
     tick — the race p4·03 recorded as producing two reds with one cause. */
  for (const id of domIds) {
    await page.click(`[data-disclosure="${id}"] button`);
    await page.waitForFunction(
      (x) => document.querySelector(`[data-disclosure="${x}"] button`)?.getAttribute('aria-expanded') === 'true',
      id, { timeout: 4000 });
    const n = await openCount(page);
    const panelChars = await page.evaluate((x) => {
      const b = document.querySelector(`[data-disclosure="${x}"] button`);
      const p = document.getElementById(b.getAttribute('aria-controls'));
      return p && !p.hasAttribute('hidden') ? p.innerText.trim().length : -1;
    }, id);
    R.ok(n === 1, `opening "${id}" leaves exactly one row open (${n})`);
    R.ok(panelChars > 400, `"${id}" reveals a complete walkthrough (${panelChars} chars)`);
  }

  /* ══ §3 · every command matches its upstream quote ════════════════════ */
  R.group('§3 · every rendered command matches the recorded upstream line');

  /* textContent, NOT innerText, and this is the difference between a real check
     and a vacuous one. The accordion is SINGLE-SELECT, so three of the four
     panels carry `hidden` at any moment — and `innerText` returns '' for a
     hidden element. Reading it here would have compared the UPSTREAM list
     against ONE platform's commands and silently ignored the other three,
     while reporting the same green. `textContent` sees every panel, which is
     also the honest subject: the question is what the PAGE contains, not what
     happens to be expanded. */
  const allCmdText = await page.evaluate(() =>
    [...document.querySelectorAll('.disc-panel code.mono')].map((c) => c.textContent.trim()));
  R.ok(allCmdText.length >= 15,
    `the opened walkthroughs render ${allCmdText.length} command lines`);

  // The rendered text is prefixed with the shell prompt "$ " by <Cmd>.
  const rendered = allCmdText.map((t) => t.replace(/^\$\s*/, ''));
  const body0 = await page.evaluate(() => document.querySelector('.page-shell').textContent);
  const missing = UPSTREAM.filter((u) => !rendered.some((r) => r === u));
  R.ok(missing.length === 0,
    `all ${UPSTREAM.length} recorded upstream command lines render VERBATIM`,
    missing.length ? `not found on the page: ${missing.map((m) => JSON.stringify(m)).join(' · ')}` : '');

  // The other direction: nothing on the page invents a command shape that no
  // upstream README uses. Checked structurally rather than by whitelist — every
  // command must invoke one of the four programs this page is about.
  const KNOWN_PROGRAM = /(monerod|p2pool|xmrig|brew|pkg|sudo sysctl|git clone|cmake|grep|cd )/i;
  const alien = rendered.filter((c) => !KNOWN_PROGRAM.test(c));
  R.ok(alien.length === 0,
    'every rendered command invokes one of the programs this page documents',
    alien.join(' · '));

  // Source and DOM agree on the COUNT too — a command deleted from the render
  // but left in source (or the reverse) is drift this catches.
  R.ok(rendered.length === CMDS.length,
    `source cmd() count and rendered command count agree (${CMDS.length} / ${rendered.length})`);

  /* THE PAGE'S OWN CLAIM, HELD TO ITS WORD. It says every command is quoted
     upstream "with ONE exception, marked where it appears". Found by READING
     rather than by any assertion: an earlier draft made the claim unqualified
     while carrying a macOS monerod line I had composed by dropping two flags,
     and an Android line with an adapted host. The macOS line is now the
     verbatim upstream invocation; the Android one is declared in ADAPTED.
     This asserts the exception count has not grown past what the page admits. */
  const derivedCmds = DERIVED.map(([c]) => c);
  const unquoted = rendered.filter((c) => !UPSTREAM.includes(c));
  const undeclared = unquoted.filter((c) => !derivedCmds.includes(c));
  R.ok(undeclared.length === 0,
    `every rendered command is a verbatim quote or one of the ${DERIVED.length} declared derivations`,
    undeclared.length ? `UNDECLARED: ${undeclared.join(' · ')}` : '');
  R.ok(unquoted.length === DERIVED.length,
    `the non-quoted set is exactly the declared one (${unquoted.length} of ${DERIVED.length})`);
  R.ok(/not (a )?quote|standard CMake|adapted|exception/i.test(body0),
    'and the PAGE says it carries non-quoted lines rather than claiming a clean sweep');

  /* ══ §4 · the honesty invariants ══════════════════════════════════════ */
  R.group('§4 · what this page must never print, and what it must');

  /* textContent again — see §3. Three walkthroughs are `hidden` at any moment
     and innerText cannot see them, so an innerText body would have let a
     forbidden claim hide in a collapsed panel and still reported green. */
  const body = await page.evaluate(() => document.querySelector('.page-shell').textContent);
  R.ok(body.length > 4000, `read the rendered page body (${body.length} chars)`);

  /* NO EARNINGS FIGURE. `$` alone is unusable as a probe — every command row
     renders a shell prompt and `$(nproc)` is a real substitution — so this
     keys on a dollar immediately followed by a digit.
     THE RETURN-WORD CHECK IS DELIBERATELY NOT A WORD BAN, and the first draft
     of it was. Banning `/profit/` outright would have reddened an HONEST
     sentence ("mining one CPU is not profitable, and that is not the point"),
     which is the opposite of what this section is for: the defect is a
     QUANTIFIED claim of return, not the vocabulary of return. So it fires only
     on a NUMBER standing within a clause of one of those words — a shape that
     honest prose does not have and an earnings estimate cannot avoid. */
  const EARNINGS = [
    [/\$\s?\d/, 'a dollar figure'],
    [/\bROI\b/, 'ROI'],
    [/\bpayback\b/i, 'payback'],
    [/\d[^.]{0,40}\b(profit|earn|earning|earnings|revenue|income|payout per|per day|per month)\b/i,
     'a number within a clause of a return word'],
    [/\b(profit|earn|earning|earnings|revenue|income)\b[^.]{0,40}\d/i,
     'a return word within a clause of a number'],
  ];
  const earningsHits = EARNINGS.filter(([re]) => re.test(body)).map(([, why]) => why);
  R.ok(earningsHits.length === 0,
    'the page quantifies no return — no earnings estimate anywhere',
    earningsHits.join(' · '));

  /* NO DEVICE HASHRATE. The invariant is positional, not lexical: every "H/s"
     on the page must sit inside the one live element that carries a NODE badge.
     A sentence like "a phone does a few hundred H/s" would land outside it and
     red — which is the drift worth catching, since that number depends on core
     count, cache, memory bandwidth and whether huge pages were granted. */
  const hs = await page.evaluate(() => {
    const all = (document.querySelector('.page-shell').textContent.match(/H\/s/g) || []).length;
    const el = document.querySelector('[data-live-hashrate]');
    const inside = el ? (el.textContent.match(/H\/s/g) || []).length : 0;
    return { all, inside };
  });
  R.ok(hs.all === hs.inside,
    `every "H/s" on the page sits inside the live NODE readout (${hs.inside} of ${hs.all})`,
    'a device-hashrate claim would land outside it');

  /* AND THE ABOVE IS 0-of-0 IN THIS FEED STATE, WHICH IS NOT COVERAGE.
     Found by reading this gate's own first green run: serve-dist answers
     /api/** with 501, so the readout is an em-dash and the page contains NO
     "H/s" at all — the positional assertion is then trivially true and proves
     only that nothing ELSE carries one. It still catches the defect it exists
     for (a prose hashrate reds it), but "0 of 0" must not be read as "the
     readout was checked". So the unit is pinned at SOURCE instead, where the
     live branch is visible whatever the feed is doing: exactly one "GH/s"
     template exists in the page, and it is inside the marked span. */
  const gh = [...SRC.matchAll(/GH\/s/g)].length;
  R.ok(gh === 1, `the page declares exactly one hashrate unit in source (${gh})`);
  // Sliced between the marker and its closing tag rather than matched with a
  // character class: the JSX in between contains `}` (from `${…}`), which any
  // `[^}]*` would stop at — a regex that fails against correct code.
  const flat = SRC.replace(/\s+/g, ' ');
  const openAt = flat.indexOf('data-live-hashrate');
  const closeAt = flat.indexOf('</span>', openAt);
  const inSpan = openAt >= 0 && closeAt > openAt ? flat.slice(openAt, closeAt) : '';
  R.ok(inSpan.includes('GH/s'),
    'and that unit is inside the [data-live-hashrate] span, not loose in prose');

  /* NO POOL RANKING, plus the POSITIVE control that says why. Without the
     second assertion, "no share figure" cannot be told apart from "the page
     never mentions the subject". */
  R.ok(!/network share|% of the network|share of (the )?network/i.test(body),
    'the page states no pool network-share figure');
  R.ok(/not.{0,40}measur|cannot be measured|do not tag|don't tag/i.test(body),
    'and it SAYS why — pool attribution is not measurable from here');

  /* THE PRIVACY CAVEAT. Case-insensitive deliberately: this repo has already
     paid for a case-SENSITIVE regex run against text a stylesheet uppercases. */
  R.ok(/wallet addresses are public on p2pool/i.test(body),
    'the P2Pool address-publicity caveat renders in full');
  R.ok(/new (mainnet )?wallet/i.test(body),
    'and the page gives the remedy (a fresh wallet for mining)');

  /* THE MINER'S OWN DONATION. The reader is being told to run software that
     pays its author by default; that belongs on the page telling them to. */
  R.ok(/1%/.test(body) && /donat/i.test(body),
    "XMRig's default 1% donation is disclosed on the page");

  /* NO INVENTED SUCCESSOR-POW CLAIM. Work on the next proof of work is real and
     upstream; nothing about it may be asserted here. */
  R.ok(!/RandomX\s*2(\.0)?\b/i.test(body),
    'no RandomX-successor version number is asserted');
  R.ok(!/\b(RandomX|proof of work)[^.]{0,80}\b(will|guaranteed|forever remain|always remain)\b/i.test(body),
    'no guarantee is made about the proof of work staying CPU-friendly');

  /* ══ §5 · the one live number ═════════════════════════════════════════ */
  R.group('§5 · the live reading is real or an em-dash, and names its source');

  const live = await page.evaluate(() => {
    const el = document.querySelector('[data-live-hashrate]');
    const tile = el && el.closest('.stat');
    return {
      present: !!el,
      value: el ? el.innerText.trim() : null,
      label: tile ? tile.querySelector('.lbl')?.innerText.trim() : null,
      prov: tile ? !!tile.querySelector('.prov') : false,
    };
  });
  R.ok(live.present, 'the live hashrate readout element exists');
  R.ok(live.label && /hashrate/i.test(live.label),
    `and it is the labelled network-hashrate tile ("${live.label}")`);
  // serve-dist answers /api/** with 501, so this is the DEGRADED face.
  R.ok(live.value === '—',
    `with the feed unavailable it renders an em-dash, never a number ("${live.value}")`);
  R.ok(live.prov, 'and it carries a provenance badge saying where the figure comes from');

  /* ══ §6 · the visual ══════════════════════════════════════════════════ */
  R.group('§6 · the decentralization field — DOM labels, no numerals, reserved box');

  const field = await page.evaluate(() => {
    const svg = document.querySelector('svg[data-mine-field]');
    if (!svg) return null;
    const fig = svg.closest('figure');
    const box = svg.parentElement.getBoundingClientRect();
    return {
      mode: svg.getAttribute('data-mine-field'),
      peers: svg.querySelectorAll('circle:not([data-mine-pulse])').length,
      pulses: svg.querySelectorAll('[data-mine-pulse]').length,
      links: svg.querySelectorAll('line').length,
      svgText: svg.querySelectorAll('text, tspan').length,
      smil: svg.querySelectorAll('animate, animateTransform, animateMotion, set').length,
      radii: [...new Set([...svg.querySelectorAll('circle:not([data-mine-pulse])')].map((c) => c.getAttribute('r')))],
      caption: fig ? (fig.querySelector('figcaption')?.innerText.trim().length ?? 0) : 0,
      w: Math.round(box.width), h: Math.round(box.height),
    };
  });
  R.ok(field !== null, 'the field renders');
  if (field) {
    R.ok(field.peers >= 30, `it draws a field of peers (${field.peers})`);
    R.ok(field.links >= 30, `connected to each other (${field.links} links)`);
    R.ok(field.radii.length === 1,
      `every peer is drawn at the SAME radius — no node is bigger (r=${field.radii.join('/')})`);
    /* NO SVG TEXT AT ALL, and this is a constraint rather than an aesthetic:
       an <svg> with a viewBox is DOWNSCALED at 390, and verify-mobile §6
       measures SVG text through getScreenCTM in RENDERED space against a
       BOUNDED offender list. A label in here would be a second offender. */
    R.ok(field.svgText === 0,
      `the field contains no SVG text node (${field.svgText}) — every label is DOM`);
    R.ok(field.caption > 120,
      `and the DOM caption carries the meaning instead (${field.caption} chars)`);
    R.ok(field.smil === 0,
      `no SMIL (${field.smil}) — it is invisible to CSS reduced motion, so it may not be used`);
    R.ok(field.h > 100 && field.w > 100,
      `the box is reserved before paint (${field.w}×${field.h})`);
  }

  /* THE MOTION, BOTH POLARITIES. Without the moving control, "it is still under
     reduce" cannot be told apart from "it never moved at all". */
  const sample = () => page.evaluate(() =>
    [...document.querySelectorAll('[data-mine-pulse]')].map((c) => c.getAttribute('cx')).join(','));
  const s1 = await sample();
  await page.waitForTimeout(1200);
  const s2 = await sample();
  R.ok(s1 !== s2, 'with motion allowed the pulses actually move (positive control)');

  /* ══ §7 · links ═══════════════════════════════════════════════════════ */
  R.group('§7 · every in-app link resolves to a route that exists');

  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.page-shell a[href^="/"]')].map((a) => a.getAttribute('href')));
  R.ok(hrefs.length >= 4, `the page carries in-app links (${hrefs.length})`);
  // ROUTES is used as a MEMBERSHIP PREDICATE here and never iterated — see the
  // header, and verify-coldboot-live §0's own carve-out for exactly this shape.
  const TAB_OK = /^\/(monero|learn)\/[a-z-]+(\?[a-z]+=[a-z-]+)?$/;
  const bad = hrefs.filter((h) => {
    const path = h.split('?')[0].split('#')[0];
    return !ROUTES.includes(path) && !TAB_OK.test(h);
  });
  R.ok(bad.length === 0, 'every in-app link is a real route or a real tab path', bad.join(' · '));
  R.ok(hrefs.some((h) => h.startsWith('/operate/node')),
    'the node page — this page\'s stated prerequisite — is linked');

  /* ══ §8 · 390px ═══════════════════════════════════════════════════════ */
  R.group('§8 · 390px');

  const phone = await browser.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(BASE + MINE, { waitUntil: 'networkidle' });

  /* Measured with BOUNDING RECTS, not documentElement.scrollWidth: html/body
     carry `overflow-x: clip` below 769px, so the scroll metric structurally
     cannot move and an assertion on it is vacuous. p4·02's finding. */
  const over = await phone.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.page-shell *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 1) out.push(`${el.tagName}.${el.className}`.slice(0, 60));
    }
    return out;
  });
  R.ok(over.length === 0, `nothing overflows the viewport at 390px (${over.length})`, over.slice(0, 4).join(' · '));

  const small = await phone.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.page-shell *')) {
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      if (el.classList && el.classList.contains('sr-only')) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).length;
      if (!own) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) out.push(`${el.tagName}.${el.className}@${fs}px`.slice(0, 70));
    }
    return out;
  });
  R.ok(small.length === 0,
    `no HTML text under 12px at 390px (${small.length})`, small.slice(0, 5).join(' · '));

  /* ══ §9 · reduced motion ══════════════════════════════════════════════ */
  R.group('§9 · reduced motion — nothing runs, and the field still reads');

  const rm = await browser.newPage();
  await rm.emulateMedia({ reducedMotion: 'reduce' });
  await rm.goto(BASE + MINE, { waitUntil: 'networkidle' });

  const anims = await rm.evaluate(() =>
    (document.getAnimations ? document.getAnimations() : []).filter((a) => a.playState === 'running').length);
  R.ok(anims === 0, `zero running animations under reduced motion (active: ${anims})`);

  const rmMode = await rm.evaluate(() =>
    document.querySelector('svg[data-mine-field]')?.getAttribute('data-mine-field'));
  R.ok(rmMode === 'static', `the field reports its static mode ("${rmMode}")`);

  const rmA = await rm.evaluate(() =>
    [...document.querySelectorAll('[data-mine-pulse]')].map((c) => c.getAttribute('cx')).join(','));
  await rm.waitForTimeout(1200);
  const rmB = await rm.evaluate(() =>
    [...document.querySelectorAll('[data-mine-pulse]')].map((c) => c.getAttribute('cx')).join(','));
  R.ok(rmA === rmB && rmA.length > 0, 'and nothing moves (negative control, paired with §6\'s positive one)');

  /* THE STILL FRAME LOSES NO INFORMATION, asserted on the PHASE rather than
     inferred from pixels. Under reduce the animation clock is 0, so each
     pulse's phase collapses to its SEEDED offset — six distinct, spread values
     are what keeps "a solution can originate at any peer" legible with nothing
     moving. Drop the seeded offset and every phase becomes 0.000: this reds. */
  const us = await rm.evaluate(() =>
    [...document.querySelectorAll('[data-mine-pulse]')].map((c) => parseFloat(c.getAttribute('data-mine-pulse-u'))));
  R.ok(us.length >= 4, `the still frame draws its pulses (${us.length})`);
  R.ok(new Set(us).size === us.length,
    `every pulse sits at its own distinct phase (${us.map((u) => u.toFixed(2)).join(', ')})`);
  R.ok(Math.max(...us) - Math.min(...us) > 0.4,
    `and they are spread along their paths, not bunched (span ${(Math.max(...us) - Math.min(...us)).toFixed(2)})`);

  /* A walkthrough must still be readable with motion off — the primitive
     animates no height at any preference, so this is true by construction and
     asserted anyway, because "by construction" is how things stop being true. */
  await rm.click(`[data-disclosure="${domIds[1]}"] button`);
  await rm.waitForFunction(
    (x) => document.querySelector(`[data-disclosure="${x}"] button`)?.getAttribute('aria-expanded') === 'true',
    domIds[1], { timeout: 4000 });
  const rmChars = await rm.evaluate((x) => {
    const b = document.querySelector(`[data-disclosure="${x}"] button`);
    return document.getElementById(b.getAttribute('aria-controls')).innerText.trim().length;
  }, domIds[1]);
  R.ok(rmChars > 400, `a walkthrough opens and loses no information under reduce (${rmChars} chars)`);
} catch (err) {
  R.ok(false, `gate crashed: ${err.message}\n${err.stack}`);
} finally {
  await browser.close();
}

process.exit(R.finish());
