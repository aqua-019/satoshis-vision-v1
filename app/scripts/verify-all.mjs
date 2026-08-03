// verify-all.mjs — run every gate CI reaches, in one command, with one tally.
//
// Run from app/:  npm run verify:all
//   --no-build          skip phase 0 (local iteration against an existing dist/)
//   --only <substring>  run only gates whose command matches
//   --phase <0|1|2>     run a single phase
//
// ── THIS IS AN ORCHESTRATOR, NOT A GATE ───────────────────────────────────
// The repo-wide rule is that no verify-*.mjs spawns its own server: gates
// assume one is already running, which is what lets CI start a single
// serve-dist and share it across the whole verify:e2e chain. This file is not
// a gate — it makes no assertions of its own — so it is allowed to manage the
// server lifecycle. It lives in scripts/ rather than being named verify-*.mjs
// precisely so that distinction is visible from the filename.
//
// ── WHY IT IS DELIBERATELY NOT IN CI ──────────────────────────────────────
// ci.yml splits into two jobs that run in PARALLEL: `build` (offline gates, no
// browser binaries) and `verify` (installs Chromium, serves dist). Running
// this file in CI would serialise both halves into one job and roughly double
// wall-clock time for exactly zero extra coverage. It exists for the local
// one-command story and for the finish-line question "which gates did you
// actually run", which it answers by name below rather than from memory.
//
// ── WHY IT RUNS GATES INDIVIDUALLY RATHER THAN VIA THE npm CHAINS ─────────
// `verify:static` and `verify:e2e` are `&&` chains: the first failure aborts
// the rest, so one broken gate hides every gate after it and you learn about
// them one twenty-minute cycle at a time. This file reads those chains out of
// package.json, plus a hardcoded list of offline api/ gates, and runs each
// command separately, reporting the whole picture in one pass.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : d; };
const ONLY = val('--only', null);
const PHASE = val('--phase', null);
const NO_BUILD = flag('--no-build');

const pkg = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'));
/** Split an npm script's `&&` chain back into individual commands. */
const chain = (script) => (pkg.scripts[script] || '').split('&&').map((s) => s.trim()).filter(Boolean);

const PHASES = [
  { n: 0, name: 'build', needsServer: false, cmds: NO_BUILD ? [] : ['tsc --noEmit', 'npm run build'] },
  {
    n: 1,
    name: 'offline gates',
    needsServer: false,
    cmds: [
      ...chain('verify:static'),
      'node verify-tiers.mjs',
      'node ../api/verify-nodehealth.mjs',
      'node ../api/verify-tx-parse.mjs',
      'node ../api/verify-feeds.mjs',
      'node ../api/verify-markets.mjs',
      'node ../api/verify-status.mjs',
      'node ../api/verify-nodes.mjs',
      'node verify-bundle.mjs',
    ],
  },
  { n: 2, name: 'browser gates', needsServer: true, cmds: chain('verify:e2e') },
];

/* ── server lifecycle ────────────────────────────────────────────────────── */
let child = null;

const alive = async () => {
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
};

async function ensureServer() {
  // If something already answers, it is not ours: CI starts its own serve-dist
  // (ci.yml's "Start static server"), and an orchestrator that kills the CI
  // server would fail the run in a way that takes an hour to understand.
  if (await alive()) {
    console.log(`  · a server already answers on :${PORT} — reusing it, and NOT killing it on exit`);
    return;
  }
  console.log(`  · starting scripts/serve-dist.mjs on :${PORT}`);
  child = spawn('node', ['scripts/serve-dist.mjs', String(PORT)], { cwd: APP, stdio: 'ignore', detached: false });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await alive()) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`serve-dist did not come up on :${PORT} within 60s`);
}

function stopServer() {
  if (child && !child.killed) { try { child.kill('SIGTERM'); } catch { /* already gone */ } child = null; }
}
// A failed run that leaves :4173 bound makes the NEXT run fail for an unrelated
// reason, which is a genuinely horrible afternoon. Cover every exit path.
process.on('exit', stopServer);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { stopServer(); process.exit(130); });
}

/* ── staleness ───────────────────────────────────────────────────────────
 * A STALE dist/ is worse than an absent one: the run passes happily against a
 * build from three commits ago and reports green on code that was never
 * compiled. So compare mtimes and say out loud which branch was taken. */
function newestSourceMs() {
  let newest = 0;
  const roots = ['src', 'scripts', 'index.html', 'vite.config.ts', 'vite.ssr.config.ts', 'package.json'];
  const visit = (p) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) { for (const n of readdirSync(p)) visit(join(p, n)); return; }
    if (st.mtimeMs > newest) newest = st.mtimeMs;
  };
  for (const r of roots) visit(join(APP, r));
  return newest;
}

function distFreshness() {
  const marker = join(APP, 'dist', 'index.html');
  if (!existsSync(marker)) return { state: 'absent' };
  const dist = statSync(marker).mtimeMs;
  const src = newestSourceMs();
  return { state: dist >= src ? 'fresh' : 'stale', dist, src };
}

/* ── run ─────────────────────────────────────────────────────────────────── */
const TALLY = /(\d+) passed · (\d+) fixtured · (\d+) skipped · (\d+) failed/;
const results = [];

function run(cmd) {
  const t0 = Date.now();
  const r = spawnSync(cmd, { cwd: APP, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  process.stdout.write(out);
  const m = out.match(TALLY);
  return {
    cmd,
    code: r.status ?? 1,
    ms: Date.now() - t0,
    // Only claim counters for gates that actually printed them. Several older
    // gates predate makeReporter and print raw console.log; inventing numbers
    // for those would be the precise lie this tally exists to prevent.
    tally: m ? { passed: +m[1], fixtured: +m[2], skipped: +m[3], failed: +m[4] } : null,
  };
}

console.log('verify:all — every gate CI reaches, plus the v6.1.5 cost gates.\n');

const fresh = distFreshness();
if (!NO_BUILD) {
  console.log(`  · dist/ is ${fresh.state} — phase 0 rebuilds it regardless`);
} else if (fresh.state === 'fresh') {
  console.log('  · --no-build, and dist/ is NEWER than every source file: reusing it');
} else {
  console.log(`  · --no-build, but dist/ is ${fresh.state.toUpperCase()} — these results describe a build that`);
  console.log('    does not match the working tree. Drop --no-build.');
}

let started = false;
try {
  for (const phase of PHASES) {
    if (PHASE !== null && String(phase.n) !== String(PHASE)) continue;
    const cmds = phase.cmds.filter((c) => !ONLY || c.includes(ONLY));
    if (!cmds.length) continue;

    console.log(`\n${'─'.repeat(72)}\nPHASE ${phase.n} · ${phase.name} — ${cmds.length} command(s)\n${'─'.repeat(72)}`);
    if (phase.needsServer && !started) { await ensureServer(); started = true; }

    for (const cmd of cmds) {
      console.log(`\n▶ ${cmd}`);
      const res = run(cmd);
      results.push(res);
      // Phase 0 is a prerequisite, not a gate: if the build fails, every gate
      // after it would be measuring a stale or absent tree and its verdict
      // would be noise.
      if (phase.n === 0 && res.code !== 0) {
        console.log('\n✖ phase 0 failed — stopping. Every later gate would measure a tree that was never built.');
        break;
      }
    }
    if (phase.n === 0 && results.some((r) => r.code !== 0)) break;
  }
} finally {
  stopServer();
}

/* ── the tally ───────────────────────────────────────────────────────────── */
const agg = { passed: 0, fixtured: 0, skipped: 0, failed: 0 };
let unparsed = 0;
for (const r of results) {
  if (!r.tally) { unparsed++; continue; }
  for (const k of Object.keys(agg)) agg[k] += r.tally[k];
}

const w = Math.max(...results.map((r) => r.cmd.length), 10);
console.log(`\n${'═'.repeat(72)}\nverify:all — every command run, by name\n${'═'.repeat(72)}`);
for (const r of results) {
  const t = r.tally
    ? `${r.tally.passed}p ${r.tally.fixtured}x ${r.tally.skipped}s ${r.tally.failed}f`
    : 'no tally';
  console.log(`${r.code === 0 ? '✅' : '❌'} ${r.cmd.padEnd(w)}  ${String((r.ms / 1000).toFixed(1)).padStart(6)}s  ${t}`);
}

const failed = results.filter((r) => r.code !== 0);
console.log(`${'─'.repeat(72)}`);
console.log(`${results.length} commands · ${failed.length} failed`);
// skip and fixture are NEVER folded into passed. A consolidated line reading
// "312 passed" when 9 were fixtured is exactly the lie makeReporter's four
// separate counters exist to prevent, and re-introducing it at the aggregate
// level would undo that one layer up.
console.log(`assertions: ${agg.passed} passed · ${agg.fixtured} fixtured · ${agg.skipped} skipped · ${agg.failed} failed`);
if (unparsed) {
  console.log(`${unparsed} command(s) printed no makeReporter tally (build steps, or gates predating it);`);
  console.log('their assertions are NOT in the totals above — only their exit codes are.');
}
if (failed.length) console.log(`\nfailed: ${failed.map((r) => r.cmd).join(' · ')}`);

process.exit(failed.length ? 1 : 0);
