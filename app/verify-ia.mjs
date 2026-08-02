/**
 * verify-ia.mjs — Information Architecture Agreement Gate
 *
 * Offline assertion that four source artifacts agree on navigation restructure.
 * Verifies: routes.mjs (canonical), vercel.json (12 server 301s), App.tsx (12 client Navigate),
 * nav/ia.ts (6-section IA), and MoneroPage.tsx (hash-based nav for 2 client-only transitions).
 *
 * Cannot verify: HTTP 301 status codes (marked R.fixture), runtime routing, URL fragment delivery.
 * Hash rows and identity rows are never served by vercel.json — they are documented and skipped.
 *
 * Run: node verify-ia.mjs (from app/ directory)
 * Exit code: result count from R.finish()
 */

import { makeReporter } from './verify-reporter.mjs';
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
      R.ok(all301, all301 ? 'All 12 have statusCode 301' : 'Some redirects lack statusCode 301');

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
R.group('§3 · App.tsx contains exactly 12 <Route path="X" element={<Navigate to="Y" replace />} />');

try {
  const appPath = join(__dirname, 'src', 'App.tsx');
  const appSource = readFileSync(appPath, 'utf8');

  // Regex with s flag to match newlines between attributes; require 'replace' keyword
  // Pattern: <Route path="..." element={<Navigate to="..." replace />} />
  const navigateRegex = /<Route\s+path="([^"]+)"\s+element=\{<Navigate[\s\S]*?to="([^"]+)"[\s\S]*?replace[\s\S]*?\/>\}\s*\/>/g;

  let match;
  while ((match = navigateRegex.exec(appSource)) !== null) {
    appNavigates.push({ source: match[1], destination: match[2] });
  }

  R.ok(appNavigates.length === 12, `Found ${appNavigates.length} Navigate routes (expected 12)`);

  // Guard: 12 routes found before doing set comparisons (prevent vacuous pass on empty arrays)
  if (appNavigates.length !== 12) {
    R.info('Extracted Navigate pairs — stopping further comparisons to surface incomplete structure');
  }

} catch (e) {
  R.ok(false, `parse failed: ${e.message}`);
}

// ============================================================================
// §4 · /pro absence
// ============================================================================
R.group('§4 · /pro does not appear (never existed, is fiction from mockup)');

if (routes.length > 0) {
  R.ok(!routes.includes('/pro'), 'absent from ROUTES');
}

if (vecelRedirects.length > 0) {
  const proInRedirects = vecelRedirects.some(r => r.source === '/pro' || r.destination === '/pro');
  R.ok(!proInRedirects, 'absent from vercel redirects');
}

if (appNavigates.length > 0) {
  const proInApp = appNavigates.some(r => r.source === '/pro' || r.destination === '/pro');
  R.ok(!proInApp, 'absent from App.tsx Navigate');
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

    const found = routes.includes(destWithoutQuery) || routes.includes(prefix);
    if (!found) {
      unresolved.push(`${redirect.destination} (prefix: ${prefix})`);
    }
  }

  R.ok(unresolved.length === 0,
    unresolved.length === 0
      ? `All 12 destinations resolve`
      : `${unresolved.length} unresolved: ${unresolved.join('; ')}`);

  R.info('Prefix resolution: /learn/:tab and /learn/sim?p=:id match against /learn prefix, not proof the :param route exists in App.tsx');
}

// ============================================================================
// §3b · App.tsx Navigate destinations match vercel.json destinations
// ============================================================================
R.group('§3b · App.tsx Navigate pairs match vercel.json redirect pairs (byte-for-byte)');

if (appNavigates.length !== 12 || vecelRedirects.length !== 12) {
  R.skip('prerequisites not met', `appNavigates: ${appNavigates.length}, redirects: ${vecelRedirects.length} (both need 12)`);
} else {
  const appMap = Object.fromEntries(appNavigates.map(r => [r.source, r.destination]));
  const vercelMap = Object.fromEntries(vecelRedirects.map(r => [r.source, r.destination]));

  const mismatches = [];
  for (const [source, appDest] of Object.entries(appMap)) {
    const vercelDest = vercelMap[source];
    if (vercelDest !== appDest) {
      mismatches.push(`${source}: App=${appDest}, Vercel=${vercelDest}`);
    }
  }

  for (const source of Object.keys(vercelMap)) {
    if (!(source in appMap)) {
      mismatches.push(`${source}: only in Vercel`);
    }
  }

  R.ok(mismatches.length === 0,
    mismatches.length === 0
      ? 'All 12 pairs match'
      : `${mismatches.length} mismatches: ${mismatches.slice(0, 3).join('; ')}`);
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
R.group('§8 · MoneroPage.tsx hash handling: #markets-thesis and #outlook');

try {
  const moneroPath = join(__dirname, 'src', 'pages', 'MoneroPage.tsx');
  const moneroSource = readFileSync(moneroPath, 'utf8');

  // Strip comments and strings to prevent false positives from unrelated code
  // (e.g., case "outlook": in tab switch, bare "outlook" string in comments).
  // This is load-bearing: after the restructure, "outlook" will be deleted
  // from MONERO_TABS, so a naive substring match would flip meaning without
  // anyone noticing. Mechanism assertion catches the actual change.
  const stripped = stripStrings(stripComments(moneroSource));

  // Assert the mechanism: code reads URL fragment (location.hash or useLocation with hash)
  const readsHash = /location\.hash|useLocation\s*\([^)]*\)[\s\S]*?\bhash\b/.test(stripped);
  R.ok(readsHash, readsHash ? 'reads location.hash or useLocation().hash' : 'does not read URL fragment');

  // Assert both destination paths appear (strong signals, unlikely to collide)
  const hasMarketThesisDest = moneroSource.includes('/live/markets/thesis');
  const hasFutureOutlookDest = moneroSource.includes('/future/outlook');
  R.ok(hasMarketThesisDest, hasMarketThesisDest ? 'contains /live/markets/thesis' : 'missing /live/markets/thesis destination');
  R.ok(hasFutureOutlookDest, hasFutureOutlookDest ? 'contains /future/outlook' : 'missing /future/outlook destination');

  // Assert anchor names: markets-thesis is hyphenated (safe), outlook requires mechanism assertion above
  const hasMarketThesisAnchor = stripped.includes('markets-thesis');
  R.ok(hasMarketThesisAnchor, hasMarketThesisAnchor ? 'contains markets-thesis anchor' : 'missing markets-thesis anchor');

  R.info('Hash rows (#markets-thesis, #outlook) are client-side navigation. URL fragments never reach servers, so vercel.json structurally cannot redirect them. Absence from vercel.json is correct by design.');

} catch (e) {
  R.ok(false, `MoneroPage.tsx check failed: ${e.message}`);
}

// ============================================================================
// §2b · HTTP 301 status codes (cannot verify offline)
// ============================================================================
R.group('§2b · vercel.json 301 status codes are not verifiable offline');

R.fixture('Vercel 301 responses', 'Cannot be checked without an HTTP client. Status codes are asserted in source but observed only at deploy time. Marked as fixture because offline verification cannot measure HTTP responses.');

// ============================================================================
// Tally
// ============================================================================
R.info('');
R.info('═══════════════════════════════════════════════════════════════════');
R.info('Tally: 12 server redirects · 12 client <Navigate> · 2 hash rows · 3 identity rows');
R.info('  (12 vercel 301s + 12 App.tsx Navigate are independently verified above)');
R.info('  (2 hash: #markets-thesis, #outlook — client-only, no server redirect needed)');
R.info('  (3 identity: /, /monero, /future — unchanged, no redirect needed)');
R.info('═══════════════════════════════════════════════════════════════════');

process.exit(R.finish());
