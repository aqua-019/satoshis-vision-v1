/**
 * verify-redirects.mjs — the redirect map has exactly ONE authority. v6.1.6.
 *
 * Run from app/, offline, no browser, no dist, ~50ms:
 *   node verify-redirects.mjs
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * The old→new redirect map is written down twice, and it has to be:
 *
 *   scripts/routes.mjs  exports REDIRECTS — the canonical list. App.tsx maps
 *                       over it to generate its client mirrors, so the runtime
 *                       side genuinely has one source.
 *   vercel.json         restates the same pairs as static JSON, because JSON
 *                       cannot import anything. There is no way around this:
 *                       Vercel reads a file, not a module.
 *
 * A second hand-maintained list is exactly what this release exists to delete
 * everywhere else, and the prompt's own Verify section forbids it. Since the
 * duplication is structurally unavoidable here, the honest answer is not to
 * pretend it is single-sourced but to make drift between the two a build
 * failure. That is this gate's whole job.
 *
 * ── WHAT IT CANNOT DO ─────────────────────────────────────────────────────
 * It cannot observe an HTTP 301. Nothing offline can: scripts/serve-dist.mjs
 * models Vercel's exact-file → directory-index → SPA-catch-all order and emits
 * no 3xx of any kind, deliberately. So the status codes are asserted as
 * CONFIGURATION and reported with R.fixture(), never R.ok(). A gate that
 * counted those as passes would be claiming to have checked a response it
 * never made — the failure this repo has shipped three times.
 *
 * It also cannot confirm that Vercel forwards query strings through a redirect.
 * The docs specify `statusCode` but say nothing about query forwarding for
 * vercel.json redirects; the only documented `--preserve-query-params` flag
 * belongs to the CLI bulk-redirects product, which is a different system. That
 * is reported as an explicit unknown, because `/mempool?v=reactor` losing its
 * view would break precisely the shared link requirement 1 protects, and the
 * client mirror cannot compensate — in production the 301 fires before the SPA
 * ever loads. Verify it on a preview deploy.
 *
 * ── SECTIONS ──────────────────────────────────────────────────────────────
 *   §1 both lists load
 *   §2 vercel.json ⊆ REDIRECTS   (no extra rows invented in JSON)
 *   §3 REDIRECTS ⊆ vercel.json   (no rows silently dropped from JSON)
 *   §4 shape: every row 301, no /api/ source, no source shadowing a real route
 *   §5 the tally, printed — matched / drift, never a bare pass
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeReporter } from './verify-reporter.mjs';

const APP = dirname(fileURLToPath(import.meta.url));
const R = makeReporter('verify-redirects');

/** Canonical map + route list. Absent until scripts/routes.mjs exports them. */
let REDIRECTS = null;
let ROUTES = [];
/** vercel.json's restatement. */
let JSON_REDIRECTS = null;

R.group('§1 · both lists load');
try {
  const mod = await import(join(APP, 'scripts', 'routes.mjs'));
  ROUTES = Array.isArray(mod.ROUTES) ? mod.ROUTES : [];
  REDIRECTS = Array.isArray(mod.REDIRECTS) ? mod.REDIRECTS : null;
  R.ok(REDIRECTS !== null,
    'scripts/routes.mjs exports REDIRECTS (the canonical map)',
    'export a REDIRECTS array of { from, to } — App.tsx and this gate both read it');
  R.ok(ROUTES.length > 0, `scripts/routes.mjs exports ${ROUTES.length} ROUTES`);
} catch (e) {
  R.ok(false, `scripts/routes.mjs failed to import: ${e.message}`);
}

try {
  const v = JSON.parse(readFileSync(join(APP, '..', 'vercel.json'), 'utf8'));
  JSON_REDIRECTS = Array.isArray(v.redirects) ? v.redirects : null;
  R.ok(JSON_REDIRECTS !== null,
    'vercel.json has a redirects array',
    'vercel.json currently has no `redirects` key — add one before the rewrites block');
} catch (e) {
  R.ok(false, `vercel.json failed to parse: ${e.message}`);
}

/* Both halves are required for any comparison below to mean anything. Without
 * this guard the set maths would run over two empty arrays and report perfect
 * agreement — a vacuous pass, which is the specific way a drift gate lies. */
const comparable = REDIRECTS !== null && JSON_REDIRECTS !== null
  && REDIRECTS.length > 0 && JSON_REDIRECTS.length > 0;

const key = (from, to) => `${from} -> ${to}`;
const canon = comparable ? REDIRECTS.map((r) => key(r.from, r.to)) : [];
const json = comparable ? JSON_REDIRECTS.map((r) => key(r.source, r.destination)) : [];

R.group('§2 · vercel.json invents nothing — every JSON row is in the canonical map');
if (!comparable) {
  R.skip('vercel.json vs REDIRECTS', `canonical: ${REDIRECTS?.length ?? 'absent'}, json: ${JSON_REDIRECTS?.length ?? 'absent'} — both required`);
} else {
  const extra = json.filter((k) => !canon.includes(k));
  R.ok(extra.length === 0,
    extra.length === 0
      ? `no extra rows (${json.length} checked)`
      : `${extra.length} row(s) in vercel.json absent from REDIRECTS: ${extra.join(' | ')}`);
}

R.group('§3 · vercel.json drops nothing — every canonical row is in the JSON');
if (!comparable) {
  R.skip('REDIRECTS vs vercel.json', 'both lists required');
} else {
  const missing = canon.filter((k) => !json.includes(k));
  R.ok(missing.length === 0,
    missing.length === 0
      ? `no missing rows (${canon.length} checked)`
      : `${missing.length} canonical row(s) absent from vercel.json: ${missing.join(' | ')}`);
}

R.group('§4 · row shape');
if (!JSON_REDIRECTS || JSON_REDIRECTS.length === 0) {
  R.skip('row shape', 'vercel.json has no redirects to inspect');
} else {
  const notPermanent = JSON_REDIRECTS.filter((r) => r.statusCode !== 301);
  R.ok(notPermanent.length === 0,
    notPermanent.length === 0
      ? `all ${JSON_REDIRECTS.length} rows declare statusCode 301`
      : `${notPermanent.length} row(s) not 301: ${notPermanent.map((r) => r.source).join(', ')}`,
    'the mockup specifies 301; Vercel\'s `permanent: true` emits 308, so statusCode must be explicit');

  const apiSrc = JSON_REDIRECTS.filter((r) => String(r.source).startsWith('/api/'));
  R.ok(apiSrc.length === 0,
    apiSrc.length === 0 ? 'no row redirects an /api/ path' : `${apiSrc.length} row(s) shadow /api/`);

  /* Vercel applies redirects BEFORE the filesystem lookup, so a source equal to
   * a real route would shadow its prerendered page permanently — the page would
   * become unreachable at its own URL with nothing failing loudly. */
  const shadow = JSON_REDIRECTS.filter((r) => ROUTES.includes(r.source));
  R.ok(shadow.length === 0,
    shadow.length === 0
      ? 'no row shadows a prerendered route'
      : `${shadow.length} row(s) shadow a real route: ${shadow.map((r) => r.source).join(', ')}`);
}

R.group('§5 · tally');
if (comparable) {
  const matched = canon.filter((k) => json.includes(k)).length;
  const drift = (canon.length - matched) + json.filter((k) => !canon.includes(k)).length;
  R.info(`canonical ${canon.length} · vercel.json ${json.length} · matched ${matched} · drift ${drift}`);
  R.ok(drift === 0 && matched === canon.length && matched === json.length,
    `${matched} matched / ${drift} drift`,
    'the two lists must agree exactly, in both directions');
} else {
  R.skip('tally', 'one or both lists unavailable — nothing to count');
}

/* Configuration is asserted above; the wire is not, and cannot be. */
R.fixture('HTTP 301 responses',
  'not observable offline — serve-dist.mjs emits no 3xx by design. Status codes are asserted as configuration only.');
R.fixture('query-string forwarding through a 301',
  'undocumented for vercel.json redirects (the --preserve-query-params flag belongs to CLI bulk redirects). Unknown until a preview deploy; the client mirror cannot compensate because the 301 fires before the SPA loads.');

R.info('2 hash rows (#markets-thesis, #outlook) are absent from vercel.json BY CONSTRUCTION — a URL fragment is never transmitted to a server. They are client-only and verified in verify-ia.mjs §8.');

process.exit(R.finish());
