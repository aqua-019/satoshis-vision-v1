// verify-feedcache.mjs — proves the /future page's 24h feed cache never
// synthesizes data and never refetches within FEED_TTL. Exercises the REAL
// shipped cache helpers (feedCacheKey, readFeedCache/writeFeedCache,
// agoStr, isStale) directly — no rendering, no DOM.
//
// Run: node verify-feedcache.mjs   (Node >=22.18 strips the type annotations)
//
// useCachedFeed.ts reuses (not forks) useMarketHistory.ts's readCache/
// writeCache/safeStore, importing them the same extensionless way the rest
// of this codebase does (Vite/tsc "Bundler" moduleResolution). Plain `node`
// has no extension-inference for relative ESM specifiers, so — purely for
// this test's own module loading, the shipped source is untouched — we
// register a tiny resolve hook that retries a failed relative import with
// ".ts" appended. See https://nodejs.org/api/module.html#moduleregister.

import { register } from 'node:module';
import { readFileSync } from 'node:fs';

const RESOLVE_TS_FALLBACK = `
  export async function resolve(specifier, context, nextResolve) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      if (err?.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
        return nextResolve(specifier + '.ts', context);
      }
      throw err;
    }
  }
`;
register(`data:text/javascript,${encodeURIComponent(RESOLVE_TS_FALLBACK)}`, import.meta.url);

const f = await import('./src/data/useCachedFeed.ts');
const { feedCacheKey, readFeedCache, writeFeedCache, agoStr, isStale, FEED_TTL, FEED_PREFIX } = f;

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };

// Map-backed Storage shim (what the browser hook does with localStorage).
const m = new Map();
const shim = {
  getItem: (k) => (m.has(k) ? m.get(k) : null),
  setItem: (k, v) => m.set(k, v),
};

// 0) private mode / no localStorage — before `window` exists at all, every
//    call must degrade to null, never throw.
ok(readFeedCache('nope') === null, 'null store (private mode) → null');

// wire up the shim as `window.localStorage` for the rest of the run
// (safeStore() reads it lazily on every call, so this is safe to do now).
globalThis.window = { localStorage: shim };

// 1) key shape
// v6.1.1: the repo-pulse id carries `.v2.` — see useRepoPulse. The payload
// shape changed (issueAt), and useCachedFeed serves a cache hit WITHOUT
// re-validating its shape, so the id is what forces the one-time refetch.
const key = feedCacheKey('gh.v2.monero-project/monero');
ok(key === `${FEED_PREFIX}gh.v2.monero-project/monero`, `feedCacheKey → "${key}"`);
ok(key === 'xmri.feed.gh.v2.monero-project/monero', 'feedCacheKey matches the documented namespace');

// 2) write → read round-trip preserves data and stamps `at` with write time.
const t0 = 1_753_000_000_000;
const repoData = { stars: 4321, pushed: '2026-07-20T00:00:00Z', issues: 12, issueAt: '2026-07-28T00:00:00Z' };
writeFeedCache('gh.v2.monero-project/monero', repoData, t0);
const hit = readFeedCache('gh.v2.monero-project/monero', t0 + 1000);
ok(!!hit && hit.at === t0, 'round-trip: `at` stamped with write time');
ok(!!hit && JSON.stringify(hit.data) === JSON.stringify(repoData), 'round-trip: data deep-equals');

// 3) entries at exactly FEED_TTL still serve; one ms past → treated as absent.
ok(readFeedCache('gh.v2.monero-project/monero', t0 + FEED_TTL) !== null, 'read at exactly FEED_TTL → still served');
ok(readFeedCache('gh.v2.monero-project/monero', t0 + FEED_TTL + 1) === null, 'read past FEED_TTL → null');
ok(FEED_TTL === 864e5, 'FEED_TTL === 24h (864e5 ms)');

// 4) corrupt / wrong-shape entries never throw — they read as null.
m.set(feedCacheKey('bad'), 'not-json{');
ok(readFeedCache('bad', t0) === null, 'corrupt JSON → null (no throw)');
m.set(feedCacheKey('shape'), JSON.stringify({ nope: true }));
ok(readFeedCache('shape', t0) === null, 'wrong shape → null (no throw)');

// 5) isStale boundary: exactly `days` old → false; one ms further → true.
const iso90 = new Date(t0 - 90 * 86_400_000).toISOString();
ok(isStale(iso90, 90, t0) === false, 'isStale: exactly 90 days old → false');
ok(isStale(iso90, 90, t0 + 1) === true, 'isStale: 90 days + 1ms → true');
ok(isStale(iso90, undefined, t0) === false, 'isStale: default days (90) matches explicit 90');
ok(isStale(null, 90, t0) === false, 'isStale: null → false');
ok(isStale(undefined, 90, t0) === false, 'isStale: undefined → false');
ok(isStale('not-a-date', 90, t0) === false, 'isStale: garbage → false');

// 6) agoStr buckets: sub-hour → "Nm ago"; under 48h → "Nh ago"; beyond → "Nd ago"; null → "—".
ok(agoStr(new Date(t0 - 12 * 60_000).toISOString(), t0) === '12m ago', 'agoStr: sub-hour → "Nm ago"');
ok(agoStr(new Date(t0 - 5 * 3_600_000).toISOString(), t0) === '5h ago', 'agoStr: under 48h → "Nh ago"');
ok(agoStr(new Date(t0 - 9 * 86_400_000).toISOString(), t0) === '9d ago', 'agoStr: beyond 48h → "Nd ago"');
ok(agoStr(null, t0) === '—', 'agoStr: null → "—"');
ok(agoStr(undefined, t0) === '—', 'agoStr: undefined → "—"');
ok(agoStr('garbage', t0) === '—', 'agoStr: garbage → "—"');

/* 7) v6.1.4 — every wrapper SURFACES the state machine it was handed.
 *
 * useCachedFeed produces `{ data, at, state }`. Three of its four wrappers
 * returned all three; `useRepoPulse` destructured `{ data }` alone and returned
 * `RepoPulse | null`, so its callers could not tell "still loading" from "the
 * proxy is dead" — both were null — and every pulse surface rendered a spinner
 * that would never resolve against a dead proxy.
 *
 * The TYPE now prevents it (each wrapper declares `state` in its return type,
 * so dropping it fails to compile). This is the belt to that pair of braces: a
 * type can be widened by a later edit, and a source assertion cannot be widened
 * by accident. It reads the shipped source rather than calling the hooks,
 * because calling them needs React and a DOM. */
{
  const src = readFileSync(new URL('./src/data/useCachedFeed.ts', import.meta.url), 'utf8');
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // Every exported hook that CALLS useCachedFeed must name `state` in its
  // signature and destructure it from the call.
  // The return types are object literals, so the capture has to run past their
  // own braces and stop at the one that opens the function BODY — which is the
  // only `{` followed by a newline.
  const hooks = [...body.matchAll(/export function (use[A-Za-z]+)\s*\([^)]*\)\s*:\s*([\s\S]*?)\{\s*\n/g)];
  const consumers = hooks
    .map(([, name, ret]) => ({ name, ret }))
    .filter(({ name }) => new RegExp(`function ${name}[\\s\\S]{0,900}?useCachedFeed<`).test(body));

  ok(consumers.length === 4, `four hooks consume useCachedFeed (found ${consumers.length})`);
  for (const { name, ret } of consumers) {
    ok(/\bstate\b/.test(ret), `${name}() declares \`state\` in its return type`);
  }

  // And none of them may destructure `{ data }` alone from the call.
  const lone = [...body.matchAll(/const\s*\{\s*data\s*\}\s*=\s*useCachedFeed</g)];
  ok(lone.length === 0,
     lone.length
       ? `a wrapper destructures { data } alone from useCachedFeed — the v6.1.4 bug, reintroduced`
       : 'no wrapper destructures { data } alone from useCachedFeed');

  ok(/export function useRepoPulse\([^)]*\)\s*:\s*\{[^}]*\bstate\b/.test(body),
     'useRepoPulse returns { pulse, at, state } like its three siblings');
  ok(/export const repoPulseEndpoint/.test(body),
     'the repo-pulse endpoint is exported so a failing surface can name it');
}

console.log(fail ? '\n❌ verify-feedcache FAILED' : '\n✅ verify-feedcache: all assertions passed');
process.exit(fail ? 1 : 0);
