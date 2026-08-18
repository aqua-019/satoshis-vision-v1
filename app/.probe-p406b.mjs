import { chromium } from 'playwright';
const B='http://127.0.0.1:4187';
const br = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx = await br.newContext({viewport:{width:1440,height:900}});
const p = await ctx.newPage();
const read = () => p.evaluate(()=>({
  h1: document.querySelector('h1')?.innerText?.trim().slice(0,90) ?? null,
  index: !!document.querySelector('[data-protocol-index]'),
  notfound: !!document.querySelector('[data-protocol-notfound]'),
  switcher: !!document.querySelector('[data-protocol-switcher]'),
  links: [...document.querySelectorAll('[data-protocol-link]')].map(a=>a.getAttribute('data-protocol-link')),
  ariaCurrent: [...document.querySelectorAll('[data-protocol-switcher] [aria-current]')].map(b=>b.textContent.trim()),
  minis: document.querySelectorAll('canvas,svg').length,
  resourceLabels: [...document.querySelectorAll('.v6-res')].map(a=>a.textContent.trim().slice(0,70)),
  crumbs: document.querySelector('[class*=crumb], nav')?.innerText?.replace(/\n+/g,' › ').slice(0,90) ?? null,
  bodyHas: (s)=>document.body.innerText.includes(s),
  txt: document.body.innerText.replace(/\s+/g,' ').slice(0,200),
}));
for (const u of ['/future/protocol','/future/protocol?p=fcmp','/future/protocol?p=seraphis','/future/protocol?p=totally-bogus','/future/protocol?p=']) {
  await p.goto(B+u,{waitUntil:'networkidle'});
  const r = await read();
  console.log('\n=== '+u);
  console.log('  h1        :', r.h1);
  console.log('  states    : index='+r.index+' notfound='+r.notfound+' switcher='+r.switcher);
  console.log('  indexLinks:', r.links.join(','));
  console.log('  aria-cur  :', JSON.stringify(r.ariaCurrent));
  console.log('  svg/canvas:', r.minis);
  console.log('  resources :', r.resourceLabels.length, r.resourceLabels.slice(0,3));
  console.log('  text      :', r.txt.slice(0,150));
}
await br.close();
