// verify-effects.mjs — D1625. A ledger of every `useEffect` in the data layer,
// with a written justification for each survivor.
//
// Run: node verify-effects.mjs   (static: reads source, no browser, no network)
//
// The rule D1625 states is "useEffect as a last resort — reserve effects for
// true external sync, never for derived or fetched data". That is unenforceable
// as a grep: an effect is not wrong by existing, it is wrong by what it does.
// So this gate does the one thing a machine CAN check honestly — it pins the
// COUNT per file against a table a human wrote a reason into. Adding an effect
// is then a two-line diff: the code, and the sentence saying why it is external
// sync. Deleting one is a one-line diff. Neither can happen silently, and the
// reasons stay next to the numbers instead of rotting in a commit message.
//
// It deliberately does NOT assert "zero effects". Four of these are genuinely
// correct — a WebSocket subscription, timer loops, a media-query listener — and
// a gate that demanded zero would be a gate people learn to route around.

import { readFileSync, readdirSync } from 'node:fs';

let fail = false;
const ok = (cond, msg) => { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail = true; };
const group = (t) => console.log(`\n— ${t} —`);

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const countEffects = (src) => (stripComments(src).match(/\buseEffect\s*\(/g) || []).length;

/**
 * file → [expected count, why each survivor is TRUE EXTERNAL SYNC].
 * Update this table in the same commit as any effect you add or remove.
 */
const LEDGER = {
  'src/data/xmrirish-feed.ts': [1,
    'the optional relay WebSocket — an external subscription with a teardown, ' +
    'which is exactly what an effect is for. The failure counters this file used ' +
    'to keep in refs are state now, and the status phase is derived during render ' +
    '(feed-status.ts deriveAll), so neither needs an effect.'],
  'src/data/usePolling.ts': [1,
    'the tier timer + visibilitychange listener — external, and it owns its own ' +
    'cleanup and abort budget.'],
  'src/data/useCachedFeed.ts': [1,
    'the 24h-cached /api/feeds fetch. Fetching in an effect is the pattern D1625 ' +
    'warns about, but there is no data-router here (react-router is used through ' +
    'the JSX <Routes> API, so loaders are unavailable at any version) and no query ' +
    'library in the dependency set.'],
  'src/data/useMarketHistory.ts': [2,
    'the range fetch, and the 45s retry timer. Same caveat as useCachedFeed.'],
  'src/data/useTickers.ts': [1,
    'its own 5min/45s poll loop — one of the three hand-rolled loops predating ' +
    'usePolling, left alone deliberately (see usePolling.ts header).'],
  'src/data/useFeedEvents.ts': [1,
    'diffs consecutive snapshots into an event log. It writes to a ref and to ' +
    'state, so it is a genuine subscription-shaped side effect rather than a ' +
    'derivation — but its dep array now reads a DERIVED local (`stale`) computed ' +
    'during render, not a stored boolean.'],
};

group('data layer — the D1625 ledger');
for (const [file, [expected, why]] of Object.entries(LEDGER)) {
  const n = countEffects(read('./' + file));
  ok(n === expected, `${file}: ${n} effect${n === 1 ? '' : 's'} (expected ${expected})`);
  if (n !== expected) console.log(`     ↳ justification on record: ${why}`);
}

group('no un-ledgered effects in src/data/');
{
  const dir = new URL('./src/data/', import.meta.url);
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));
  const missing = [];
  for (const f of files) {
    const rel = 'src/data/' + f;
    if (countEffects(read('./' + rel)) > 0 && !(rel in LEDGER)) missing.push(rel);
  }
  ok(missing.length === 0,
     missing.length ? `un-ledgered effects in: ${missing.join(', ')}` : 'every file with an effect has a ledger entry');
}

group('the derivations that must NOT be effects');
{
  const feed = stripComments(read('./src/data/xmrirish-feed.ts'));
  ok(/useMemo<MoneroLive>|useMemo\(/.test(feed),
     'the feed derives its public snapshot with useMemo, not an effect that mirrors into state');
  ok(!/setSnap\([^)]*deriveAll/.test(feed) && !/setObs\([^)]*deriveAll/.test(feed),
     'no derived status is written back into state (that is the D1624 anti-pattern)');

  const events = stripComments(read('./src/data/useFeedEvents.ts'));
  ok(/const stale = feedDegraded\(data\.status\)/.test(events),
     'useFeedEvents computes `stale` during render and uses it in both the body and the deps');
}

console.log('');
console.log(fail ? '❌ verify-effects: FAILED' : '✅ verify-effects: all assertions passed');
process.exit(fail ? 1 : 0);
