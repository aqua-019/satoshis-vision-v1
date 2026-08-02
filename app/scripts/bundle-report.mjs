// bundle-report.mjs — renders the human-facing bundle report. v6.1.5.
//
// Run: npm run build && node scripts/bundle-report.mjs
// Emits: .perf/bundle-report.html · .perf/bundle-report.md · .perf/bundle-report.json
//
// ── THIS IS NOT A GATE, AND THE DISTINCTION IS LOAD-BEARING ───────────────
// The visualiser is for a human; verify-bundle.mjs is the number that fails
// CI. They do not touch. This script makes ZERO assertions and always exits 0,
// and "the artifact was produced" is never part of any pass condition —
// because an HTML file existing checks nothing whatsoever about the bundle.
// That separation is the whole reason this repo's gates are trustworthy:
// verify-shots.mjs once counted screenshots it never compared toward a
// "pixel-identical" claim, and this file is deliberately shaped so it cannot
// become that.
//
// Self-contained by construction: inline CSS, no scripts, no external
// requests. The site is used over Tor and its tooling should behave the same
// way even when the output never leaves a CI artifact.
//
// Zero dependencies. rollup-plugin-visualizer would do this in one line, but
// this repo ships 3 dependencies and 7 devDependencies against 60+ hand-rolled
// gates, and adding a supply-chain edge for a dev-only convenience is the
// wrong trade on a privacy project.
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants as ZC } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(APP, 'dist');
const ASSETS = join(DIST, 'assets');
const PERF = join(APP, '.perf');
const GRAPH = join(PERF, 'bundle-graph.json');

if (!existsSync(ASSETS) || !existsSync(GRAPH)) {
  console.error('bundle-report: no dist/ or .perf/bundle-graph.json — run `npm run build` first.');
  process.exit(0); // not a gate; absence is not a failure
}

const graph = JSON.parse(readFileSync(GRAPH, 'utf8'));
const byFile = new Map(graph.chunks.map((c) => [c.fileName, c]));

const measure = (rel) => {
  const buf = readFileSync(join(DIST, rel));
  return {
    file: rel,
    raw: buf.length,
    gz: gzipSync(buf, { level: 9 }).length,
    br: brotliCompressSync(buf, { params: { [ZC.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
};

const rel = readdirSync(ASSETS).map((f) => `assets/${f}`);
const js = rel.filter((f) => f.endsWith('.js')).map(measure).sort((a, b) => b.raw - a.raw);
const css = rel.filter((f) => f.endsWith('.css')).map(measure);

function staticClosure(fileName) {
  const seen = new Set();
  const stack = [fileName];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    for (const i of byFile.get(cur)?.imports ?? []) stack.push(i);
  }
  return seen;
}

const entry = graph.chunks.find((c) => c.isEntry);
const eager = entry ? [...staticClosure(entry.fileName)] : [];
const gzOf = (f) => js.concat(css).find((m) => m.file === f)?.gz ?? 0;

const totals = {
  jsRaw: js.reduce((n, m) => n + m.raw, 0),
  jsGz: js.reduce((n, m) => n + m.gz, 0),
  cssRaw: css.reduce((n, m) => n + m.raw, 0),
  cssGz: css.reduce((n, m) => n + m.gz, 0),
  eagerGz: eager.reduce((n, f) => n + gzOf(f), 0),
  chunks: js.length,
};

const report = { generatedAt: new Date().toISOString(), totals, eager, js, css, chunks: graph.chunks };
mkdirSync(PERF, { recursive: true });
writeFileSync(join(PERF, 'bundle-report.json'), JSON.stringify(report, null, 2));

const kb = (n) => (n / 1024).toFixed(1);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* ── markdown ─────────────────────────────────────────────────────────── */
const md = [
  '# Bundle report',
  '',
  `Generated ${report.generatedAt}`,
  '',
  `- **Eager JS (gzip):** ${kb(totals.eagerGz)} KB — what every visitor downloads before anything renders`,
  `- **CSS (gzip):** ${kb(totals.cssGz)} KB (${kb(totals.cssRaw)} KB raw, one render-blocking file)`,
  `- **Total JS:** ${kb(totals.jsRaw)} KB raw / ${kb(totals.jsGz)} KB gzip across ${totals.chunks} chunks`,
  '',
  'Budgets are asserted by `verify-bundle.mjs`, not here. This file reports.',
  '',
  '| chunk | raw KB | gzip KB | brotli KB | eager |',
  '|---|---:|---:|---:|:-:|',
  ...js.map((m) => `| \`${m.file.replace('assets/', '')}\` | ${kb(m.raw)} | ${kb(m.gz)} | ${kb(m.br)} | ${eager.includes(m.file) ? '●' : ''} |`),
  '',
].join('\n');
writeFileSync(join(PERF, 'bundle-report.md'), md);

/* ── html ─────────────────────────────────────────────────────────────── */
const max = js[0]?.raw || 1;
const rows = js.map((m) => {
  const w = ((m.raw / max) * 100).toFixed(1);
  const isEager = eager.includes(m.file);
  return `<tr${isEager ? ' class="eager"' : ''}>
    <td class="n">${esc(m.file.replace('assets/', ''))}${isEager ? '<span class="tag">eager</span>' : ''}
      <div class="bar"><i style="width:${w}%"></i></div></td>
    <td class="r">${kb(m.raw)}</td><td class="r">${kb(m.gz)}</td><td class="r">${kb(m.br)}</td>
  </tr>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bundle report — xmr.irish</title>
<style>
  :root { color-scheme: dark; --bg:#0b0a08; --fg:#e8e4dc; --dim:#8a8378; --line:#231f1a; --acc:#f60; }
  body { margin:0; padding:2rem 1.25rem; background:var(--bg); color:var(--fg);
         font:14px/1.5 ui-monospace,"JetBrains Mono",Menlo,monospace; }
  main { max-width: 60rem; margin: 0 auto; }
  h1 { font-size:1.25rem; margin:0 0 .25rem; letter-spacing:.02em; }
  p.sub { color:var(--dim); margin:0 0 1.5rem; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(12rem,1fr)); gap:.75rem; margin-bottom:1.75rem; }
  .card { border:1px solid var(--line); padding:.85rem 1rem; }
  .card b { display:block; font-size:1.4rem; color:var(--acc); font-weight:600; }
  .card span { color:var(--dim); font-size:.8rem; }
  table { width:100%; border-collapse:collapse; }
  th,td { text-align:left; padding:.4rem .5rem; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--dim); font-weight:400; font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; }
  td.r,th.r { text-align:right; font-variant-numeric:tabular-nums; }
  tr.eager td.n { color:var(--acc); }
  .tag { margin-left:.5rem; font-size:.65rem; border:1px solid var(--acc); padding:0 .3rem; }
  .bar { height:3px; background:var(--line); margin-top:.35rem; }
  .bar i { display:block; height:100%; background:var(--acc); opacity:.55; }
  footer { color:var(--dim); font-size:.78rem; margin-top:2rem; border-top:1px solid var(--line); padding-top:.9rem; }
  @media (prefers-color-scheme: light) {
    :root { color-scheme: light; --bg:#faf8f4; --fg:#1a1713; --dim:#6b6459; --line:#e4ded4; }
  }
</style></head><body><main>
<h1>Bundle report</h1>
<p class="sub">${esc(report.generatedAt)} — sizes measured from <code>dist/assets</code>, gzip level 9.</p>
<div class="cards">
  <div class="card"><b>${kb(totals.eagerGz)} KB</b><span>eager JS, gzip — before anything renders</span></div>
  <div class="card"><b>${kb(totals.cssGz)} KB</b><span>CSS, gzip — one render-blocking file</span></div>
  <div class="card"><b>${kb(totals.jsRaw)} KB</b><span>total JS, raw, ${totals.chunks} chunks</span></div>
</div>
<table><thead><tr><th>chunk</th><th class="r">raw KB</th><th class="r">gzip KB</th><th class="r">brotli KB</th></tr></thead>
<tbody>${rows}</tbody></table>
<footer>This page reports; it asserts nothing. Budgets are enforced by
<code>verify-bundle.mjs</code>, and a green build there is the only claim about size
this repo makes. Brotli is shown because Vercel serves it; budgets are gzip
because that is the unit PERF-BASELINE.md's historical series uses.</footer>
</main></body></html>`;
writeFileSync(join(PERF, 'bundle-report.html'), html);

console.log(`bundle-report: eager ${kb(totals.eagerGz)} KB gzip · css ${kb(totals.cssGz)} KB gzip · ${totals.chunks} chunks`);
console.log(`  wrote .perf/bundle-report.{html,md,json}`);
