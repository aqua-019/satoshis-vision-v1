import { chromium } from 'playwright';
const br = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await (await br.newContext({viewport:{width:1440,height:900}})).newPage();
await p.goto('http://localhost:4173/future',{waitUntil:'networkidle'});
const before = await p.evaluate(()=>[...document.querySelectorAll('a[href]')].length);
const btns = await p.evaluate(()=>[...document.querySelectorAll('button.navitem')].map(b=>b.textContent.trim()));
console.log('navitem buttons:', JSON.stringify(btns));
console.log('anchors before hover:', before);
await p.locator('button.navitem', {hasText:'FUTURE'}).first().hover();
await p.waitForTimeout(600);
const after = await p.evaluate(()=>({
  n:[...document.querySelectorAll('a[href]')].length,
  proto:[...document.querySelectorAll('a[href*="/future/protocol?p="]')].map(a=>a.getAttribute('href')),
  hollow:[...document.querySelectorAll('a[href*="/future#"]')].map(a=>a.getAttribute('href')),
  expanded: document.querySelectorAll('button.navitem[aria-expanded="true"]').length,
}));
console.log('after hover:', JSON.stringify(after));
// also open OPERATE to see the peers leaf
await p.locator('button.navitem', {hasText:'OPERATE'}).first().hover();
await p.waitForTimeout(600);
console.log('operate leaves:', await p.evaluate(()=>[...document.querySelectorAll('#nav-dd-panel a[href]')].map(a=>a.getAttribute('href'))));
await br.close();
