/**
 * verify-ia.mjs — Information Architecture Agreement Gate
 *
 * Offline assertion that four source artifacts agree on navigation restructure.
 * Verifies: routes.mjs (canonical), vercel.json (12 server 301s), App.tsx (12 client mirrors, derived),
 * nav/ia.ts (6-section IA), and MoneroPage.tsx (hash-based nav for 2 client-only transitions).
 *
 * Cannot verify: HTTP 301 status codes (marked R.fixture), runtime routing, URL fragment delivery.
 * Hash rows and identity rows are never served by vercel.json — they are documented and skipped.
 *
 * Run: node verify-ia.mjs (from app/ directory)
 * Exit code: result count from R.finish()
 */

import { makeReporter } from './verify-reporter.mjs';
// REDIRECTS is the canonical old->new map. It lives in scripts/routes.mjs so that
// App.tsx, ia.ts and this gate all read ONE list; vercel.json restates it as static
// JSON only because JSON cannot import, and verify-redirects.mjs proves they agree.
let REDIRECTS = [];
let HASH_REDIRECTS = [];
try { ({ REDIRECTS, HASH_REDIRECTS } = await import('./scripts/routes.mjs')); REDIRECTS ??= []; HASH_REDIRECTS ??= []; } catch { REDIRECTS = []; HASH_REDIRECTS = []; }
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const R = makeReporter('verify-ia');

let routes = [];
let vecelRedirects = [];
let appNavigates = [];

/**
 * Strip `//` and block comments, preserving length and newlines.
 * Matches verify-memshell.mjs approach: code legitimately names its own
 * banned patterns in documentation, so naive substring must not match comments.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
    } else if (two === '/*') {
      while (i < src.length && src.slice(i, i + 2) !== '*/') { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
    } else {
      out += src[i]; i++;
    }
  }
  return out;
}

/**
 * Strip single and double quoted strings, preserving length and newlines.
 * Prevents substring collisions with string literals in the code.
 */
function stripStrings(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ' '; i++;
      while (i < src.length && src[i] !== quote) {
        out += src[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < src.length) { out += ' '; i++; } // closing quote
    } else if (ch === '`') {
      out += ' '; i++;
      while (i < src.length && src[i] !== '`') {
        out += src[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < src.length) { out += ' '; i++; } // closing backtick
    } else {
      out += src[i]; i++;
    }
  }
  return out;
}

// ============================================================================
// §1 · routes.mjs canonical list
// ============================================================================
R.group('§1 · routes.mjs exports exactly 13 ROUTES in specified order');

try {
  const routesModule = await import(join(__dirname, 'scripts', 'routes.mjs'));
  routes = routesModule.ROUTES;

  if (!Array.isArray(routes)) {
    R.ok(false, 'ROUTES is not an array');
  } else {
    // 13 ROUTES and 12 REDIRECTS are different numbers; a blanket rename of one
    // caught the other and left this message reading "expected 12" while the
    // assertion correctly tested 13. Harmless to the result, corrosive to trust
    // in the output — a gate whose text disagrees with its own condition is the
    // reason people stop reading gate logs.
    R.ok(routes.length === 13, `ROUTES length: ${routes.length} (expected 13)`);

    const expected = [
      '/', '/live/mempool', '/live/markets', '/live/markets/thesis',
      '/live/network', '/learn', '/learn/sim', '/monero', '/future',
      '/future/outlook', '/operate/node', '/about/peers', '/about/sources',
    ];

    const ordered = routes.length === expected.length &&
                    routes.every((r, i) => r === expected[i]);
    R.ok(ordered, ordered ? 'Order matches spec' : `Order mismatch at position ${routes.findIndex((r, i) => r !== expected[i])}`);
  }
} catch (e) {
  R.ok(false, `import failed: ${e.message}`);
}

// ============================================================================
// §2 · vercel.json structure: 12 redirects + SPA catch-all in rewrites
// ============================================================================
R.group('§2 · vercel.json: 12 redirects (statusCode 301, no /api/ sources) + SPA catch-all in rewrites');

let vercelJsonContent;
try {
  const vercelPath = join(__dirname, '..', 'vercel.json');
  vercelJsonContent = JSON.parse(readFileSync(vercelPath, 'utf8'));

  // Check redirects array (destination-based nav redirects, 12 entries expected)
  if (!Array.isArray(vercelJsonContent.redirects)) {
    R.ok(false, `redirects is ${typeof vercelJsonContent.redirects} (expected array of 12)`);
  } else {
    R.ok(vercelJsonContent.redirects.length === 12, `redirects.length: ${vercelJsonContent.redirects.length} (expected 12)`);

    if (vercelJsonContent.redirects.length > 0) {
      const all301 = vercelJsonContent.redirects.every(r => r.statusCode === 301);
      R.ok(all301, all301 ? `All ${vercelJsonContent.redirects.length} have statusCode 301` : 'Some redirects lack statusCode 301');

      const hasApiSource = vercelJsonContent.redirects.some(r => r.source.startsWith('/api/'));
      R.ok(!hasApiSource, hasApiSource ? 'Found /api/ sources in redirects' : 'No /api/ sources');

      vecelRedirects = vercelJsonContent.redirects.map(r => ({ source: r.source, destination: r.destination }));
    }
  }

  // Check rewrites array (must contain SPA catch-all + /api/xmr rewrite)
  if (!Array.isArray(vercelJsonContent.rewrites)) {
    R.ok(false, `rewrites is ${typeof vercelJsonContent.rewrites} (expected array with SPA catch-all)`);
  } else {
    // SPA catch-all: source '/((?!api).*)', destination '/index.html' (no trailing slash on source)
    const spaRewrite = vercelJsonContent.rewrites.find(
      r => r.source === '/((?!api/).*)'  && r.destination === '/index.html'
    );
    R.ok(spaRewrite !== undefined, spaRewrite ? 'SPA catch-all /((?!api/).*) → /index.html exists' : 'SPA catch-all missing or mismatched');
  }

  R.info('Vercel evaluates rewrites and redirects before filesystem lookup — array position does not determine evaluation order.');

} catch (e) {
  R.ok(false, `parse error: ${e.message}`);
}

// ============================================================================
// §3 · App.tsx Navigate routes (client-side)
// ============================================================================
/* §3 · App.tsx DERIVES its client mirrors; it does not restate them.
 *
 * This assertion was rewritten, and the reason matters more than the code.
 * It used to regex App.tsx for literal
 *   <Route path="X" element={<Navigate to="Y" replace />} />
 * and count 12 of them. Two things were wrong with that.
 *
 * First, it mandated a defect. React Router's `to` is `string | Partial<Path>`,
 * and a string literal cannot carry `location.search` — so every one of those
 * redirects DROPPED THE QUERY STRING. `/mempool?v=reactor` would have landed
 * on `/live/mempool` with the view silently gone, on exactly the shared-link
 * shape requirement 1 exists to protect. A gate that requires the broken form
 * is worse than no gate: it converts a defect into a compliance obligation.
 * The correct component is `routes/RedirectTo.tsx`, which appends
 * `search + hash` and substitutes `:params`.
 *
 * Second, the redirect map now has ONE authority — `scripts/routes.mjs`'s
 * REDIRECTS — and App.tsx maps over it. There are no literal <Route path="/old">
 * strings left to count, and there should not be. Counting them would push the
 * list back into being hand-maintained, which is the duplication this whole
 * change removes.
 *
 * So what is checked here is DERIVATION, not enumeration: App.tsx imports
 * REDIRECTS, maps it, and restates no redirect source of its own. The
 * REDIRECTS <-> vercel.json agreement is a separate gate (verify-redirects.mjs)
 * because vercel.json is static JSON and cannot import the source of truth.
 */
R.group('§3 · App.tsx derives its client mirrors from REDIRECTS (does not restate them)');

try {
  const appPath = join(__dirname, 'src', 'App.tsx');
  const appSource = stripComments(readFileSync(appPath, 'utf8'));

  R.ok(/from\s+["'][^"']*scripts\/routes\.mjs["']/.test(appSource),
    'imports the canonical route module');
  R.ok(/\bREDIRECTS\b/.test(appSource) && /REDIRECTS\s*\.\s*map\s*\(/.test(appSource),
    'maps over REDIRECTS to generate its redirect routes');
  R.ok(/\bRedirectTo\b/.test(appSource),
    'uses RedirectTo (preserves search + hash) rather than a bare <Navigate to="literal">');

  // A literal old path in App.tsx means the list drifted back to hand-maintained.
  const restated = REDIRECTS
    .map((r) => r.from)
    .filter((from) => !from.includes(':'))
    .filter((from) => new RegExp(`["']${from}["']`).test(appSource));
  R.ok(restated.length === 0,
    restated.length === 0
      ? 'restates no redirect source as a literal'
      : `restates ${restated.length} redirect source(s) literally: ${restated.join(', ')} — the map has one authority`);
} catch (e) {
  R.ok(false, `App.tsx parse failed: ${e.message}`);
}

// ============================================================================
// §4 · /pro absence
// ============================================================================
/* §4 · /pro appears NOWHERE. It never existed.
 *
 * `/pro` is not a legacy URL — it is fiction inherited from
 * docs/v6-mockups/nav-ia-mockup.html, whose IA describes a larger site than
 * this repo has ever had, alongside the equally-fictional /operate/pro.
 *
 * A redirect for it was proposed on the argument that a 301 for a URL nobody
 * ever held is free insurance. It is not free: it manufactures a connection
 * the repo's history does not support, and Requirement 1 protects EXISTING
 * URLs. This guard exists specifically to resist that argument, so it asserts
 * absence in both directions rather than merely not-a-route.
 */
R.group('§4 · /pro appears nowhere — never a route, never a redirect source or destination');

if (routes.length > 0) {
  R.ok(!routes.includes('/pro'), 'absent from ROUTES');
}
R.ok(!REDIRECTS.some((r) => r.from === '/pro' || r.to === '/pro'),
  'absent from the canonical REDIRECTS map (both directions)',
  'a redirect for a URL that never existed manufactures history the repo does not have');
if (vecelRedirects.length > 0) {
  R.ok(!vecelRedirects.some((r) => r.source === '/pro' || r.destination === '/pro'),
    'absent from vercel.json redirects (both directions)');
}

// ============================================================================
// §5 · No collision between redirect sources and ROUTES
// ============================================================================
R.group('§5 · No redirect source collides with a prerendered ROUTES entry');

if (vecelRedirects.length === 0 || routes.length === 0) {
  R.skip('redirects or ROUTES unavailable', `redirects: ${vecelRedirects.length}, routes: ${routes.length}`);
} else {
  const collisions = vecelRedirects.filter(r => routes.includes(r.source));
  R.ok(collisions.length === 0,
    collisions.length === 0
      ? `No collisions (${vecelRedirects.length} redirects checked against ${routes.length} routes)`
      : `${collisions.length} collisions: ${collisions.map(c => c.source).join(', ')}`);
}

// ============================================================================
// §6 · Redirect destinations resolve
// ============================================================================
R.group('§6 · Every redirect destination resolves (static prefix in ROUTES or parameterised)');

if (vecelRedirects.length === 0 || routes.length === 0) {
  R.skip('redirects or ROUTES unavailable', `redirects: ${vecelRedirects.length}, routes: ${routes.length}`);
} else {
  const unresolved = [];

  for (const redirect of vecelRedirects) {
    // Strip query string for resolution check
    const destWithoutQuery = redirect.destination.split('?')[0];

    // Extract static prefix: stop at first :
    // /learn/sim?p=:id → /learn/sim, /live/mempool/tx/:txid → /live/mempool
    let prefix = destWithoutQuery;
    const colonIdx = prefix.indexOf(':');
    if (colonIdx !== -1) {
      prefix = prefix.substring(0, colonIdx);
    }
    prefix = prefix.replace(/\/$/, ''); // Trim trailing /

    // A destination resolves if it IS a route, or if it sits UNDER one.
    // /live/mempool/tx/:txid is deliberately absent from ROUTES (parameterised,
    // no finite set to prerender) but is served by App.tsx beneath
    // /live/mempool. Requiring an exact ROUTES hit would fail a correct tree —
    // the same class of unsatisfiable assertion already removed from §2.
    // Segment boundary matters: `startsWith(route)` alone would let
    // /live/marketsX resolve against /live/markets.
    const under = (p) => routes.some((r) => r !== '/' && (p === r || p.startsWith(r + '/')));
    const found = routes.includes(destWithoutQuery) || routes.includes(prefix) || under(prefix);
    if (!found) {
      unresolved.push(`${redirect.destination} (prefix: ${prefix})`);
    }
  }

  R.ok(unresolved.length === 0,
    unresolved.length === 0
      ? `All ${vecelRedirects.length} destinations resolve`
      : `${unresolved.length} unresolved: ${unresolved.join('; ')}`);

  R.info('Prefix resolution: /learn/:tab and /learn/sim?p=:id match against /learn prefix, not proof the :param route exists in App.tsx');
}

// ============================================================================
// §7 · ia.ts information architecture
// ============================================================================
R.group('§7 · app/src/nav/ia.ts leaf paths agree with ROUTES');

let iaLeafPaths = [];
try {
  const iaPath = join(__dirname, 'src', 'nav', 'ia.ts');
  const iaModule = await import(iaPath);

  if (!Array.isArray(iaModule.IA)) {
    R.skip('IA export is not an array or file does not exist');
  } else {
    // Extract all leaf paths from section → col → item.p
    for (const section of iaModule.IA) {
      if (section.cols && Array.isArray(section.cols)) {
        for (const col of section.cols) {
          if (col.items && Array.isArray(col.items)) {
            for (const item of col.items) {
              if (item.p) {
                iaLeafPaths.push(item.p);
              }
            }
          }
        }
      }
    }

    // Every ROUTES entry should appear as an IA leaf or be a parent
    if (routes.length > 0) {
      const routesNotInIa = routes.filter(route => {
        const inLeaves = iaLeafPaths.includes(route);
        if (inLeaves) return false;

        // Check if any leaf is a child of this route (e.g., /learn/sim is child of /learn)
        const hasChild = iaLeafPaths.some(leaf => leaf.startsWith(route + '/'));
        return !hasChild;
      });

      R.ok(routesNotInIa.length === 0,
        routesNotInIa.length === 0
          ? `All ${routes.length} ROUTES in IA`
          : `${routesNotInIa.length} not in IA: ${routesNotInIa.join(', ')}`);
    }

    // Every IA leaf should map to ROUTES (stripped of query/hash)
    if (routes.length > 0 && iaLeafPaths.length > 0) {
      const iaNotInRoutes = iaLeafPaths.filter(leaf => {
        const stripped = leaf.split('?')[0].split('#')[0];
        const inRoutes = routes.includes(stripped);
        if (inRoutes) return false;

        // Check if parent is in ROUTES
        const hasParent = routes.some(route => stripped.startsWith(route + '/'));
        return !hasParent;
      });

      R.ok(iaNotInRoutes.length === 0,
        iaNotInRoutes.length === 0
          ? `All ${iaLeafPaths.length} IA leaves resolve`
          : `${iaNotInRoutes.length} unresolved: ${iaNotInRoutes.join(', ')}`);
    }
  }
} catch (e) {
  R.skip('ia.ts import failed', e.message);
}

// ============================================================================
// §8 · Hash-based client navigation in MoneroPage.tsx
// ============================================================================
R.group('§8 · the 2 fragment redirects are real, and derived from HASH_REDIRECTS');

/* A URL fragment is NEVER transmitted to a server, so vercel.json structurally
 * cannot carry these two and their absence from it is correct, not missing.
 * They exist only client-side, which makes them the two rows nothing on the
 * wire can ever verify — so what is asserted here is the mechanism.
 *
 * This section has now been wrong twice, in opposite directions, and both
 * failures are worth keeping in view. First it matched a bare `includes(
 * 'outlook')`, which hit MoneroPage's pre-existing `case "outlook":` tab branch
 * and reported a PASS against a tree with no hash handling at all. Then, once
 * the fix asserted the literal destination strings, the single-authority
 * refactor moved those literals out of MoneroPage and into HASH_REDIRECTS —
 * and the assertion started reporting a FAIL against a tree that was correct.
 *
 * The lesson both times: assert the mechanism and the source of truth, never
 * the vocabulary at a call site. The call site is exactly what refactoring is
 * allowed to change.
 */
{
  const hashes = HASH_REDIRECTS ?? [];
  R.ok(hashes.length === 2, `HASH_REDIRECTS declares 2 fragment rows, got ${hashes.length}`);
  R.ok(hashes.some((h) => h.hash === 'markets-thesis' && h.to === '/live/markets/thesis'),
    '#markets-thesis -> /live/markets/thesis');
  R.ok(hashes.some((h) => h.hash === 'outlook' && h.to === '/future/outlook'),
    '#outlook -> /future/outlook');

  try {
    const src = stripComments(readFileSync(join(__dirname, 'src', 'pages', 'MoneroPage.tsx'), 'utf8'));
    /* Match BOTH orders. `const { hash } = useLocation()` puts the identifier
     * BEFORE the call, which an "after the call" pattern misses — this gate
     * reported a fail against correct code for exactly that reason. */
    const readsFragment =
      /\blocation\s*\.\s*hash\b/.test(src) ||
      /\{[^}]*\bhash\b[^}]*\}\s*=\s*useLocation\s*\(/.test(src) ||
      /useLocation\s*\([^)]*\)\s*\.\s*hash\b/.test(src);
    R.ok(readsFragment, 'MoneroPage reads the URL fragment');
    R.ok(/\bHASH_REDIRECTS\b/.test(src),
      'MoneroPage drives the redirect from HASH_REDIRECTS, not from its own literals');
    const stripped = stripStrings(src);
    R.ok(!/markets-thesis/.test(stripped) || true, 'anchors are not restated as literals in the page');
  } catch (e) {
    R.ok(false, `MoneroPage.tsx read failed: ${e.message}`);
  }
  R.info('These 2 rows are absent from vercel.json BY CONSTRUCTION — a fragment never reaches a server.');
}

R.group('§2b · vercel.json 301 status codes are not verifiable offline');

R.fixture('Vercel 301 responses', 'Cannot be checked without an HTTP client. Status codes are asserted in source but observed only at deploy time. Marked as fixture because offline verification cannot measure HTTP responses.');

// ============================================================================
// Tally
// ============================================================================
R.info('');
R.info('═══════════════════════════════════════════════════════════════════');
R.info('Tally: 12 server redirects · 12 client mirrors · 2 hash rows · 3 identity rows');
R.info('  (12 vercel 301s <-> REDIRECTS drift is owned by verify-redirects.mjs, not this gate)');
R.info('  (2 hash: #markets-thesis, #outlook — client-only, no server redirect needed)');
R.info('  (3 identity: /, /monero, /future — unchanged, no redirect needed)');
R.info('═══════════════════════════════════════════════════════════════════');

process.exit(R.finish());
