// verify-v508.mjs — functional gate for v5.0.8.
//   1. all 15 simulate tabs render a non-empty stage (svg/canvas) + panel, no console errors
//   2. /design 404s; no ⌘ DESIGN link in the DOM
//   3. Home recent-blocks are focusable <a> deep-links to /mempool?v=classic&block=<h>
//   4. /mempool?v=classic&block=<real height> opens that block's detail panel
//   5. Classic & Reactor ribbon tiles carry a transform transition + numeric data-glide-key
//
// HISTORICAL GATE (pre-v5.0.14): written against the deterministic in-browser
// seed feed, which no longer exists — the app is all-real now. Kept for the
// record; the current DOM gate is verify-allreal-dom.mjs. To re-run, mock
// /api/* at the page level first:
//   npm run build && (npm run preview &) && sleep 2 && node verify-v508.mjs
import { webkit, chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";

const base = "http://localhost:4173";
const SIM_IDS = [
  "decoy", "dandelion", "viewtags", "ringct", "stealth", "fcmp",
  "hearth", "metronome", "silo", "thermostat", "lighthouse",
  "auction", "skyline", "bloodhound", "balance",
];

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

const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
let fail = false;
let consoleErrors = [];
// Ignore benign "Failed to load resource" network errors: the local preview has
// no backend, so the feed's same-origin /api/coingecko fetch 403s on every route
// (pre-existing, environment-only). We still catch genuine sim exceptions and
// React console.error output.
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

// ── 1. simulate: all 15 tabs render stage svg/canvas + panel, no console errors ──
console.log("\n=== P1 · 15 simulation tabs ===");
const simPass = [];
for (const id of SIM_IDS) {
  consoleErrors = [];
  await page.goto(`${base}/simulate?p=${id}`, { waitUntil: "networkidle" });
  let ok = false, detail = "";
  try {
    await page.waitForSelector(".proto-stage", { timeout: 8000 });
    const r = await page.evaluate(() => {
      const stage = document.querySelector(".proto-stage");
      const panel = document.querySelector(".proto-panel");
      // Largest svg/canvas by area — some stages render a 0-size SvgDefs first.
      let w = 0, h = 0;
      if (stage) {
        for (const el of stage.querySelectorAll("svg, canvas")) {
          const b = el.getBoundingClientRect();
          if (b.width * b.height > w * h) { w = b.width; h = b.height; }
        }
      }
      const sb = stage ? stage.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        hasStage: !!stage, hasPanel: !!panel,
        svgW: Math.round(w), svgH: Math.round(h),
        stageW: Math.round(sb.width), stageH: Math.round(sb.height),
        children: stage ? stage.childElementCount : 0,
      };
    });
    // A stage renders if it has a sized svg/canvas OR (a few sims, e.g. viewtags)
    // a sized DOM visualization with child content. Plus a panel, no exceptions.
    const hasViz = (r.svgW > 0 && r.svgH > 0) || (r.stageW > 0 && r.stageH > 0 && r.children > 0);
    ok = r.hasStage && r.hasPanel && hasViz && consoleErrors.length === 0;
    detail = `stage=${r.stageW}x${r.stageH}(${r.children}ch) svg=${r.svgW}x${r.svgH} panel=${r.hasPanel} errs=${consoleErrors.length}`;
  } catch (e) { detail = "threw: " + e.message; }
  console.log(`${ok ? "✅" : "❌"} ${id.padEnd(11)} ${detail}`);
  if (!ok) { fail = true; if (consoleErrors.length) console.log("   console:", consoleErrors.slice(0, 3)); }
  else simPass.push(id);
}
console.log(`PASS LIST (${simPass.length}/15): ${simPass.join(", ")}`);

// ── 2. /design 404s; no ⌘ DESIGN link ──
console.log("\n=== P6 · Design hub removed ===");
await page.goto(`${base}/design`, { waitUntil: "networkidle" });
const d = await page.evaluate(() => ({
  is404: /404/.test(document.body.innerText) && /not in the mempool/i.test(document.body.innerText),
  designLinks: document.querySelectorAll('a[href="/design"], a[href$="/design"]').length,
  hasDesignText: /⌘\s*DESIGN/i.test(document.body.innerText),
}));
const p6ok = d.is404 && d.designLinks === 0 && !d.hasDesignText;
console.log(`${p6ok ? "✅" : "❌"} /design→404=${d.is404} designLinks=${d.designLinks} ⌘DESIGN=${d.hasDesignText}`);
if (!p6ok) fail = true;

// ── 3. Home recent-blocks are focusable <a> deep-links ──
console.log("\n=== P2 · Home recent blocks clickable + live ===");
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForSelector(".mblock");
const home = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll(".mblock"));
  const re = /\/mempool\?v=classic&block=\d+$/;
  const allAnchors = els.every((e) => e.tagName === "A");
  const allMatch = els.every((e) => re.test(e.getAttribute("href") || ""));
  const first = els[0]?.getAttribute("href") || "";
  const focusable = els[0] ? (els[0].tabIndex >= 0 || els[0].tagName === "A") : false;
  return { count: els.length, allAnchors, allMatch, focusable, first };
});
const p2ok = home.count > 0 && home.allAnchors && home.allMatch && home.focusable;
console.log(`${p2ok ? "✅" : "❌"} blocks=${home.count} anchors=${home.allAnchors} hrefs=${home.allMatch} focusable=${home.focusable}`);
console.log("   first href:", home.first);
if (!p2ok) fail = true;
const deepHeight = (home.first.match(/block=(\d+)/) || [])[1];

// ── 4. deep-link round trip → block detail visible ──
console.log("\n=== P3 · Home→mempool deep-link round trip ===");
if (deepHeight) {
  await page.goto(`${base}/mempool?v=classic&block=${deepHeight}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400); // let the focusBlock effect open the panel
  const det = await page.evaluate((hStr) => {
    const want = "#" + Number(hStr).toLocaleString();
    const h2 = Array.from(document.querySelectorAll("h2")).map((e) => e.textContent || "");
    return { want, hasBlockHeader: h2.some((t) => t.includes(want)), bodyHasBack: /←\s*Back/i.test(document.body.innerText) };
  }, deepHeight);
  const p3ok = det.hasBlockHeader;
  console.log(`${p3ok ? "✅" : "❌"} detail shows ${det.want} (back-button=${det.bodyHasBack})`);
  if (!p3ok) fail = true;
} else { console.log("❌ no deep height extracted from Home"); fail = true; }

// ── 5. Classic & Reactor ribbon tiles: transform transition + numeric data-glide-key ──
console.log("\n=== P4 · glide wiring (transition: transform, keyed by height) ===");
for (const v of ["classic", "reactor"]) {
  await page.goto(`${base}/mempool?v=${v}`, { waitUntil: "networkidle" });
  let ok = false, detail = "";
  try {
    await page.waitForSelector("[data-glide-key]", { timeout: 8000 });
    const r = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("[data-glide-key]"));
      const el = els[0];
      const tr = el ? getComputedStyle(el).transition : "";
      const keys = els.map((e) => e.getAttribute("data-glide-key"));
      const allNumeric = keys.length > 0 && keys.every((k) => /^\d+$/.test(k || ""));
      return { count: els.length, hasTransform: /transform/.test(tr), allNumeric, sample: keys.slice(0, 3) };
    });
    ok = r.count > 0 && r.hasTransform && r.allNumeric;
    detail = `tiles=${r.count} transition∋transform=${r.hasTransform} keysNumeric=${r.allNumeric} ${JSON.stringify(r.sample)}`;
  } catch (e) { detail = "threw: " + e.message; }
  console.log(`${ok ? "✅" : "❌"} ${v.padEnd(8)} ${detail}`);
  if (!ok) fail = true;
}

await b.close();
console.log(`\n${fail ? "❌ FAIL" : "✅ ALL PASS"}`);
process.exit(fail ? 1 : 0);
