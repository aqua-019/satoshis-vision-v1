/* p3·13 render pass — NOT committed. §5's "render BOTH endpoints and LOOK".
   Reuses verify-markets-dom's own fixture so the probe and the gate describe
   one page rather than two. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const gate = readFileSync('verify-markets-dom.mjs', 'utf8');
const head = gate.slice(0, gate.indexOf('let fails = 0;'));
const { fulfil, findChrome } = await import('data:text/javascript;base64,' +
  Buffer.from(head.replace(/^import \{ chromium \}.*$/m, '') + '\nexport { fulfil, findChrome };').toString('base64'));

const OUT = process.env.OUT || '/tmp/render';
const b = await chromium.launch(findChrome() ? { executablePath: findChrome() } : {});

async function page({ w, h, reduced = false, dead = false }) {
  const ctx = await b.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const p = await ctx.newPage();
  await p.route('**/api/**', dead ? (r) => r.abort() : fulfil);
  await p.addInitScript(() => { try { sessionStorage.setItem('xmrirish.coldboot', '1'); } catch {} });
  await p.goto('http://localhost:4173/live/markets', { waitUntil: 'load' });
  await p.waitForTimeout(dead ? 3000 : 1800);
  return p;
}
const shot = async (p, name, el) => {
  const t = el ? await p.$(el) : null;
  if (el && !t) { console.log(`   (skip ${name} — ${el} absent)`); return; }
  if (t) await t.scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
  await (t || p).screenshot({ path: `${OUT}/${name}.png` });
  console.log(`   wrote ${name}.png`);
};
const facts = (p) => p.evaluate(() => {
  const anns = [...document.querySelectorAll('[data-annotations]')];
  const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
  const tip = cs('.mk-ann-tip'), tog = cs('.mk-ann-toggle'), note = cs('.mk-ann-note'), mk = cs('.mk-tip');
  return {
    note: document.querySelector('[data-ann-note]')?.textContent ?? '—',
    layers: anns.map((a) => ({
      compact: a.className.includes('compact'),
      groups: a.getAttribute('data-ann-count'),
      flags: [...a.querySelectorAll('.mk-ann')].map((f) => ({
        n: f.getAttribute('data-ann-members'), left: Math.round(parseFloat(f.style.left)),
        cat: f.getAttribute('data-ann-cat'),
        dotBox: (() => { const d = f.querySelector('.mk-ann-dot'); const r = d?.getBoundingClientRect(); return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : '—'; })(),
      })),
    })),
    fs: { tip: tip?.fontSize, toggle: tog?.fontSize, note: note?.fontSize, readout: mk?.fontSize },
    tipW: (() => { const e = document.querySelector('.mk-ann-tip'); const r = e?.getBoundingClientRect(); return r ? `${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)}` : '—'; })(),
    panelRight: (() => { const e = document.querySelector('.cc-root'); const r = e?.getBoundingClientRect(); return r ? Math.round(r.right) : 0; })(),
    docScrollW: document.documentElement.scrollWidth,
    viewportW: innerWidth,
    stale: !!document.querySelector('.cc-stale'),
    animating: document.getAnimations ? document.getAnimations().filter((a) => a.playState === 'running').length : -1,
  };
});

for (const cfg of [
  { tag: '1440', w: 1440, h: 900 },
  { tag: '390', w: 390, h: 844 },
  { tag: '1440-reduced', w: 1440, h: 900, reduced: true },
  { tag: '1440-outage', w: 1440, h: 900, dead: true },
]) {
  console.log(`\n═══ ${cfg.tag} ═══`);
  const p = await page(cfg);
  if (!cfg.dead) {
    await p.click('button[aria-pressed]:has-text("1Y")').catch(() => {});
    await p.waitForTimeout(1400);
  }
  const f = await facts(p);
  console.log('  note        :', JSON.stringify(f.note));
  console.log('  font sizes  :', JSON.stringify(f.fs));
  console.log('  h-overflow  :', f.docScrollW, 'vs viewport', f.viewportW, f.docScrollW > f.viewportW ? '  ← OVERFLOW' : '  ok');
  console.log('  stale badge :', f.stale, '| running animations:', f.animating);
  for (const l of f.layers) console.log(`  ${l.compact ? 'brush' : 'plot '}: groups=${l.groups} ${JSON.stringify(l.flags)}`);
  await shot(p, `${cfg.tag}-page`);
  await shot(p, `${cfg.tag}-hero`, '.cc-root');

  if (!cfg.dead) {
    // the cluster badge and its tooltip
    const cluster = await p.$('.mk-ann-cluster .mk-ann-dot');
    if (cluster) {
      await cluster.hover(); await p.waitForTimeout(350);
      const t = await facts(p);
      console.log('  cluster tip :', t.tipW, '| panel right edge', t.panelRight);
      await shot(p, `${cfg.tag}-cluster-tip`, '.cc-root');
      await cluster.click(); await p.waitForTimeout(900);
      const z = await facts(p);
      console.log('  after zoom-to-cluster:', JSON.stringify(z.layers.find((l) => !l.compact)?.flags));
      await shot(p, `${cfg.tag}-cluster-expanded`, '.cc-root');
      await p.click('button[aria-pressed]:has-text("1Y")').catch(() => {});
      await p.waitForTimeout(1000);
    }
    // a single flag's tooltip
    const single = await p.$('.mk-ann:not(.mk-ann-cluster) .mk-ann-dot');
    if (single) {
      await single.hover(); await p.waitForTimeout(350);
      const t = await facts(p);
      console.log('  single tip  :', t.tipW, '| panel right edge', t.panelRight);
      await shot(p, `${cfg.tag}-flag-tip`, '.cc-root');
    }
    // the pinned synced state, all four charts
    const cv = await p.$('.cc-canvas');
    if (cv) {
      await cv.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
      const r = await cv.boundingBox();
      await p.mouse.move(r.x + r.width * 0.55, r.y + r.height * 0.4);
      await p.waitForTimeout(150);
      await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(300);
      await p.mouse.move(2, 2); await p.waitForTimeout(300);
      const read = await p.evaluate(() => ({
        hero: document.querySelector('[data-candle-tip]')?.hidden ? null : (document.querySelector('[data-candle-tip]').textContent || '').replace(/\s+/g, ' ').trim(),
        svg: [...document.querySelectorAll('[data-sync-tip]')].map((e) => e.hidden ? null : (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 56)),
      }));
      console.log('  PINNED hero :', read.hero);
      read.svg.forEach((t, i) => console.log(`  PINNED svg${i} :`, t));
      await shot(p, `${cfg.tag}-pinned-hero`, '.cc-root');
      await shot(p, `${cfg.tag}-pinned-page`);
    }
  }
  await p.context().close();
}
await b.close();
