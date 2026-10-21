import { launch } from "./browser.mjs";
import path from "node:path";
const b = await launch();
const p = await b.newPage({ viewport: { width: 1100, height: 950 } });
const errs=[]; p.on("pageerror", e => errs.push(e.message));
await p.goto("file://" + path.resolve(process.argv[2])); await p.waitForTimeout(1200);
const n = await p.$$eval('#mock-cast option', e=>e.length); const out={};
for (let a=0;a<n;a++){ await p.selectOption('#mock-cast', String(a)); await p.waitForTimeout(500);
  await p.click('.pd-tab[data-tab="stats"]').catch(()=>{}); await p.waitForTimeout(200);
  out[a]={mut: await p.$$eval('.pd-effect--mutation', e=>e.length), extra: await p.$$eval('.pd-slot.is-extra,.pd-slot[data-slot^="hand"],.pd-slot[data-slot^="head2"]', e=>e.map(x=>x.dataset.slot)), tabs: await p.$$eval('[data-tab]', e=>[...new Set(e.map(x=>x.dataset.tab))])};
  if (out[a].mut) { await p.keyboard.down('Shift'); await p.click('.pd-effect--mutation'); await p.keyboard.up('Shift'); await p.waitForTimeout(300); out[a].toast = await p.$$eval('.mock-toast', e=>e.map(x=>x.textContent).slice(-1)); }
}
console.log(JSON.stringify(out), errs); await b.close();
