// verify-v510.mjs — functional gate for the v5.1.0 chart-fidelity batch.
//
//   1. /network: the five panels render the hi-fi chart components — each chart
//      <svg viewBox="0 0 1000 H"> carries y-axis <text> tick labels + dashed
//      gridlines; NO element on the page uses preserveAspectRatio="none".
//   2. Honesty: hashrate current-value pill == the live KPI hashrate; panel
//      window labels reflect the real window (no "· 7d" / "last 96 ticks" /
//      "cap ~250 tx"); the synthesised "Synthesise 168 points" is gone.
//   3. /markets: XMR/BTC panel shows sat-labelled y-axis + a sat value pill; the
//      privacy peer-group panel fits its box (no overflow) and has a legend row;
//      the XMR/USD candles + XMR-vs-Top-10 line panels still render (unchanged).
//   4. Mobile (390): every upgraded chart scales to width — no full-page
//      horizontal scroll on /network or /markets.
//
// Run against `npm run preview` (built WITHOUT VITE_LIVE_DATA → simulated feed,
// deterministic, no network):
//   npm run build && (npm run preview &) && sleep 2 && node verify-v510.mjs
import { webkit, chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";

const base = "http://localhost:4173";

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((n) => n.startsWith("chromium-")).sort().reverse()) {
    const p = root + "/" + d + "/chrome-linux/chrome";
    if (existsSync(p)) return p;
  }
  return undefined;
}

let b, engine = "webkit";
try { b = await webkit.launch(); }
catch { engine = "chromium"; const ep = findChrome(); b = await chromium.launch(ep ? { executablePath: ep } : {}); }
console.log("engine:", engine);

let fail = false;
const FAIL = (m) => { fail = true; console.log("❌ " + m); };
const OK = (m) => console.log("✅ " + m);

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  console.log(`\n──────── ${vp.name} ${vp.width}×${vp.height} ────────`);
  const page = await b.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));

  // ── /network ──────────────────────────────────────────────────────
  await page.goto(`${base}/network`, { waitUntil: "networkidle" });
  await page.waitForSelector(".panel-b svg", { timeout: 8000 });
  await page.waitForTimeout(300);

  const net = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll(".panel"));
    const titleOf = (p) => (p.querySelector(".panel-h .l")?.textContent || "").trim();
    // Chart svgs use the shared 1000-unit logical viewBox.
    const chartSvgs = Array.from(document.querySelectorAll(".panel-b svg"))
      .filter((s) => (s.getAttribute("viewBox") || "").startsWith("0 0 1000"));
    const charts = chartSvgs.map((s) => ({
      texts: s.querySelectorAll("text").length,
      grid: s.querySelectorAll('line[stroke-dasharray]').length,
      parNone: s.getAttribute("preserveAspectRatio") === "none",
    }));
    // Scope to chart bodies — the persistent NetRail price ticker (nav chrome,
    // out of scope for this batch) still uses a stretched mini-sparkline.
    const anyParNone = !!document.querySelector('.panel-b [preserveAspectRatio="none"]');

    // hashrate KPI value (e.g. "5.45 GH/s") and the hashrate panel's pill texts.
    const stats = Array.from(document.querySelectorAll(".stat"));
    const hStat = stats.find((s) => /hashrate/i.test(s.querySelector(".lbl")?.textContent || ""));
    const kpiHash = (hStat?.querySelector(".val")?.textContent || "").match(/([\d.]+)/)?.[1] || "";
    const hPanel = panels.find((p) => /hashrate/i.test(titleOf(p)));
    const hPillTexts = hPanel ? Array.from(hPanel.querySelectorAll("svg text")).map((t) => (t.textContent || "").trim()) : [];
    const pillMatchesKpi = !!kpiHash && hPillTexts.includes(kpiHash);

    const titles = panels.map(titleOf).filter(Boolean);
    const bodyTxt = document.body.innerText;
    return {
      titles, chartCount: charts.length, charts, anyParNone,
      kpiHash, hPillTexts, pillMatchesKpi,
      hasSynthLabel: /Synthesise 168 points/.test(bodyTxt),
      staleLabels: titles.filter((t) => /·\s*7d|last 96 ticks|cap ~250/.test(t)),
      sessionLabels: titles.filter((t) => /session ·|last \d+ blocks/.test(t)),
      hScroll: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  console.log("  network titles:", net.titles.join(" | "));
  if (net.chartCount >= 5) OK(`network chart svgs: ${net.chartCount}`); else FAIL(`network chart svgs ${net.chartCount} < 5`);
  const wellFormed = net.charts.every((c) => c.texts >= 3 && c.grid >= 1 && !c.parNone);
  if (wellFormed) OK("every network chart has axis labels + gridlines, no preserveAspectRatio=none");
  else FAIL("a network chart is missing axis labels/gridlines or uses preserveAspectRatio=none: " + JSON.stringify(net.charts));
  if (!net.anyParNone) OK('no preserveAspectRatio="none" in /network chart panels'); else FAIL('preserveAspectRatio="none" present in a /network chart panel');
  if (net.pillMatchesKpi) OK(`hashrate pill == live KPI (${net.kpiHash} GH/s)`); else FAIL(`hashrate pill ${JSON.stringify(net.hPillTexts)} != KPI ${net.kpiHash}`);
  if (!net.hasSynthLabel) OK('"Synthesise 168 points" gone'); else FAIL('"Synthesise 168 points" still present');
  if (net.staleLabels.length === 0) OK("no stale window labels (7d / 96 ticks / cap ~250)"); else FAIL("stale labels: " + net.staleLabels.join(", "));
  if (net.sessionLabels.length >= 3) OK(`honest window labels: ${net.sessionLabels.join(" | ")}`); else FAIL("missing honest window labels: " + net.sessionLabels.join(", "));
  if (net.hScroll <= 2) OK(`/network no horizontal scroll (Δ${net.hScroll}px)`); else FAIL(`/network horizontal overflow Δ${net.hScroll}px`);

  // ── /markets ──────────────────────────────────────────────────────
  await page.goto(`${base}/markets`, { waitUntil: "networkidle" });
  await page.waitForSelector(".panel-b svg", { timeout: 8000 });
  await page.waitForTimeout(300);

  const mk = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll(".panel"));
    const titleOf = (p) => (p.querySelector(".panel-h .l")?.textContent || "").trim();
    const find = (re) => panels.find((p) => re.test(titleOf(p)));

    const btc = find(/XMR\s*\/\s*BTC/i);
    const btcTexts = btc ? Array.from(btc.querySelectorAll("svg text")).map((t) => (t.textContent || "").trim()) : [];
    const btcHasSat = btcTexts.some((t) => /\bsat$/.test(t));
    const btcParNone = btc ? !!btc.querySelector('[preserveAspectRatio="none"]') : true;

    const peer = find(/Privacy peer group/i);
    const peerBody = peer?.querySelector(".panel-b");
    const peerSvg = !!peer?.querySelector("svg");
    // legend row: swatch spans + a "%" reading per coin
    const legendPct = peer ? (peerBody?.innerText.match(/[+\-]?\d+\.\d%/g) || []).length : 0;
    const peerOverflow = peerBody ? peerBody.scrollWidth - peerBody.clientWidth : 999;

    const candle = find(/XMR\s*\/\s*USD/i);
    const top10 = find(/Top 10/i);

    return {
      btcHasSat, btcParNone, btcTexts: btcTexts.slice(0, 6),
      peerSvg, legendPct, peerOverflow,
      candleHasSvg: !!candle?.querySelector("svg"),
      top10HasSvg: !!top10?.querySelector("svg"),
      hScroll: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  if (mk.btcHasSat && !mk.btcParNone) OK(`XMR/BTC sat-labelled axis (e.g. ${mk.btcTexts.filter((t) => /sat$/.test(t))[0] || "?"})`);
  else FAIL(`XMR/BTC sat labels=${mk.btcHasSat} parNone=${mk.btcParNone} texts=${JSON.stringify(mk.btcTexts)}`);
  if (mk.peerSvg && mk.legendPct >= 2 && mk.peerOverflow <= 2) OK(`peer-group fits box (overflowΔ${mk.peerOverflow}px) + legend (${mk.legendPct} coins)`);
  else FAIL(`peer-group svg=${mk.peerSvg} legendPct=${mk.legendPct} overflowΔ${mk.peerOverflow}px`);
  if (mk.candleHasSvg && mk.top10HasSvg) OK("XMR/USD candles + Top-10 line panels unchanged (render)");
  else FAIL(`candle=${mk.candleHasSvg} top10=${mk.top10HasSvg}`);
  if (mk.hScroll <= 2) OK(`/markets no horizontal scroll (Δ${mk.hScroll}px)`); else FAIL(`/markets horizontal overflow Δ${mk.hScroll}px`);

  if (errs.length) FAIL(`console errors: ${JSON.stringify(errs.slice(0, 3))}`); else OK("no console errors");
  await page.close();
}

await b.close();
console.log(`\n${fail ? "❌ FAIL" : "✅ ALL PASS"}`);
process.exit(fail ? 1 : 0);
