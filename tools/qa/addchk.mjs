import { launch } from "./browser.mjs";
import path from "node:path";
const b = await launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto("file://" + path.resolve(process.argv[2])); await p.waitForTimeout(1500);
const out = {};
for (const who of ["Хьюго", "Гюнтер"]) {
  const idx = await p.$$eval("#mock-cast option", (o, w) => o.findIndex((x) => x.textContent.includes(w)), who);
  if (idx < 0) continue;
  await p.selectOption("#mock-cast", String(idx)); await p.waitForTimeout(800);
  const tabs = await p.$$eval(".pd-tab", (e) => e.map((x) => x.dataset.tab));
  for (const t of tabs) { await p.click(`.pd-tab[data-tab="${t}"]`); await p.waitForTimeout(250); }
  await p.click('.pd-tab[data-tab="stats"]'); await p.waitForTimeout(200);
  out[who] = { tabs, maim: await p.$$eval(".pd-maim", (e) => e.length), extra: await p.$$eval(".pd-slot.is-extra", (e) => e.length), adv: await p.$$eval(".pd-adv", (e) => e.length), stashBtn: await p.$$eval(".pd-stashbtn", (e) => e.length), effects: await p.$$eval(".pd-effect", (e) => e.length), talentAdd: await p.$$eval(".pd-talent-add", (e) => e.length) };
}
console.log(JSON.stringify(out), "errors:", errs);
await b.close();
