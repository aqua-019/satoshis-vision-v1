// verify-fixtures.mjs — shared test fixtures, loadable by offline gates.
//
// Extracted from verify-lib.mjs so that api/verify-status.mjs can import
// STATUS_FIXTURE without pulling in playwright (which blocks the gate from
// running in the build job's offline-only contract). Mirrors the v6.1.4
// verify-reporter.mjs split exactly, for the same reason: a module that needs
// to be loadable from both app/verify/*.mjs and api/verify/*.mjs cannot have
// playwright as its first import.
//
// This file imports NOTHING but node: builtins (or nothing at all), so it
// stays loadable from api/verify-status.mjs.

/**
 * D0891 · the shared /api/status fixture.
 *
 * WHY EVERY GATE THAT LOADS /sources NEEDS THIS. `scripts/serve-dist.mjs` has
 * three branches — exact file, directory index, SPA fallback. For paths outside
 * /api, it returns `dist/index.html` with **HTTP 200 and text/html** (SPA
 * fallback). So an unrouted `/api/status` does not fall through to the SPA — it
 * matches the /api/* check and returns **501 + JSON** instead. A gate that loads
 * /sources without this fixture is testing an error response and calling it a
 * page.
 *
 * Correcting a note recorded elsewhere while we are here: verify-future's
 * `mockFeeds` does NOT "abort every other /api/*". It aborts three named globs
 * (`**‍/api/xmr/**`, `**‍/api/nodes*`, `**‍/api/coingecko*`) and fulfils
 * `**‍/api/feeds*`. `/api/status` matches none of them, so the mechanism is
 * "an unmatched pattern falls through", not "everything else is aborted".
 *
 * `at` is FIXED, not generated. verify-shots.mjs walks /sources and a moving
 * timestamp would diff every screenshot.
 *
 * api/verify-status.mjs asserts parity between the real handler's ENDPOINTS
 * and this fixture's — TWO assertions, on purpose: membership keyed by `path`
 * and comparing all three fields (`path`, `file`, `kind`), and ordering,
 * separately. That is what stops the mock quietly rotting away from the
 * endpoint it stands in for, which is the only thing making a fixture better
 * than no mock.
 *
 * Two notes, because this sentence was a lie until v6.1.7 and the reasons it
 * became one are worth keeping:
 *
 *   1. It described an assertion that DID NOT EXIST. verify-status.mjs had ~24
 *      assertions and none touched key-set parity; its only mention of
 *      verify-lib was a "do not import it" comment. A comment claiming a gate
 *      exists is the same class as a gate that passes what it never checked.
 *      That is also why STATUS_FIXTURE lives in this file now — verify-lib's
 *      first import is playwright, and the offline `build` job cannot load it.
 *
 *   2. `kind` is in the comparison deliberately. v6.1.7 introduced a NETWORK
 *      kind, a value not previously in the set (node / market /
 *      editorial / meta) — so it is simultaneously the field most tempting to
 *      omit and the one the change extends. Membership and ordering are
 *      separate assertions so a cosmetic reorder reds with "order differs"
 *      rather than "parity failed"; the latter invites loosening the gate, and
 *      a loosened parity check inside the gate written to replace a phantom
 *      one would be the original defect wearing a fix.
 */
export const STATUS_FIXTURE = {
  v: 1,
  at: '2026-01-01T00:00:00.000Z',
  probed: false,
  note: 'configuration only — this endpoint does not probe any upstream',
  cascade: {
    primaryConfigured: false,
    referenceCount: 6,
    referenceHosts: [
      'node.moneroworld.com:18089',
      'nodes.hashvault.pro:18081',
      'node.community.rino.io:18081',
      'opennode.xmr-tw.org:18089',
      'node.sethforprivacy.com:18089',
      'xmr-node.cakewallet.com:18081',
    ],
    networks: { mainnet: 6, stagenet: 0, testnet: 0, betanet: 0 },
  },
  endpoints: [
    { path: '/api/xmr', file: 'xmr.js', kind: 'node' },
    { path: '/api/nodes', file: 'nodes.js', kind: 'network' },
    { path: '/api/coingecko', file: 'coingecko.js', kind: 'market' },
    { path: '/api/markets', file: 'markets.js', kind: 'market' },
    { path: '/api/feeds', file: 'feeds.js', kind: 'editorial' },
    { path: '/api/status', file: 'status.js', kind: 'meta' },
  ],
};
