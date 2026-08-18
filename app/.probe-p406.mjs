import { chromium } from 'playwright';
const B='http://127.0.0.1:4187';
const br = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const out=[];
async function grid(w,h,label){
  const ctx = await br.newContext({viewport:{width:w,height:h}});
  const p = await ctx.newPage();
  await p.goto(B+'/operate/peers',{waitUntil:'networkidle'});
  const r = await p.evaluate(()=>{
    const g=document.querySelector('.v6-peer-grid');
    if(!g) return {err:'no .v6-peer-grid'};
    const cs=getComputedStyle(g);
    const cols=cs.gridTemplateColumns.split(' ').filter(Boolean);
    const items=[...g.children].map(c=>{const b=c.getBoundingClientRect();return {w:+b.width.toFixed(1),h:+b.height.toFixed(1),top:+b.top.toFixed(1),left:+b.left.toFixed(1)};});
    // rows = distinct top values
    const rows=[...new Set(items.map(i=>Math.round(i.top)))].length;
    const de=document.documentElement;
    let over=0; for(const el of document.querySelectorAll('body *')){const b=el.getBoundingClientRect(); if(b.width>0&&b.right>de.clientWidth+0.5) over++;}
    return {cols:cols.length, colWidths:cols, items:items.length, rows, sizes:items.map(i=>`${i.w}x${i.h}`), overflowEls:over, scrollW:de.scrollWidth, clientW:de.clientWidth};
  });
  out.push([label,w,r]);
  await ctx.close();
}
await grid(1440,900,'desktop');
await grid(1280,900,'desktop-low');
await grid(1199,900,'tablet-top');
await grid(900,900,'tablet');
await grid(768,900,'phone-top');
await grid(390,844,'phone-390');
await grid(320,844,'phone-320');
for(const [l,w,r] of out) console.log(String(l).padEnd(12), String(w).padStart(5), JSON.stringify(r));
await br.close();
