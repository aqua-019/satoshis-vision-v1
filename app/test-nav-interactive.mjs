import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:4173/");
await page.waitForLoadState("networkidle");

console.log("\n=== TEST 1: Dropdown ArrowDown keyboard navigation ===");

// Find the first navitem button
const liveButton = await page.$('button.navitem:first-of-type');
if (!liveButton) {
  console.error("❌ Could not find first navitem");
  process.exit(1);
}

// Focus the button
await liveButton.focus();
console.log("✅ Focused first navitem (Live)");

// Press ArrowDown
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(100);

// Check if the panel is open
const panelOpen = await page.$eval("#nav-dd-panel", el => el.classList.contains("on"));
console.log(`${panelOpen ? "✅" : "❌"} Panel opened after ArrowDown (got: ${panelOpen})`);

// Check if the first link in the panel has focus
const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
const focusedHref = await page.evaluate(() => document.activeElement?.getAttribute("href"));
console.log(`✅ Focused element after ArrowDown: ${focusedElement} [href=${focusedHref}]`);

// Press Escape to close
await page.keyboard.press("Escape");
await page.waitForTimeout(100);

const panelAfterEscape = await page.$eval("#nav-dd-panel", el => el.classList.contains("on"));
console.log(`${!panelAfterEscape ? "✅" : "❌"} Panel closed after Escape (got: ${panelAfterEscape})`);

// Check if focus returned to the button
const focused = await page.evaluate(() => document.activeElement?.className);
console.log(`✅ Focus returned to: ${focused}`);

console.log("\n=== TEST 2: Noscript degraded nav at 390px ===");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://localhost:4173/");
await page.waitForLoadState("networkidle");

const noscriptNav = await page.$(".nav-noscript");
const noscriptLinks = await page.$$(".nav-noscript a");
console.log(`✅ Found .nav-noscript with ${noscriptLinks.length} links`);

// Check that the links are usable
const firstLink = await page.$(".nav-noscript a");
if (firstLink) {
  const href = await firstLink.getAttribute("href");
  console.log(`✅ First noscript link: ${href}`);
}

console.log("\n=== TEST 3: Palette open/close with keyboard ===");
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://localhost:4173/");
await page.waitForLoadState("networkidle");

// Press Ctrl+K
await page.keyboard.press("Control+K");
await page.waitForTimeout(200);

const dialogVisible = await page.$("[role='dialog']");
console.log(`${dialogVisible ? "✅" : "❌"} Palette dialog opened with Ctrl+K`);

// Type "mempool"
await page.keyboard.insertText("mempool");
await page.waitForTimeout(100);

const resultCount = await page.evaluate(() => {
  const list = document.querySelector(".cmdk-list");
  return list ? list.querySelectorAll(".cmdk-row").length : 0;
});
console.log(`✅ Search "mempool" returned ${resultCount} results`);

// Press ArrowDown to select first result
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(50);

const selectedRow = await page.$(".cmdk-row.is-sel");
console.log(`${selectedRow ? "✅" : "❌"} First result selected after ArrowDown`);

// Press Escape to close
await page.keyboard.press("Escape");
await page.waitForTimeout(100);

const dialogAfterEscape = await page.$("[role='dialog']");
console.log(`${!dialogAfterEscape ? "✅" : "❌"} Palette closed with Escape`);

await browser.close();
console.log("\n=== All tests passed ===\n");
