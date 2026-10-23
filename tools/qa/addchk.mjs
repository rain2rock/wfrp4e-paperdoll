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
  out[who] = { tabs, maim: await p.$$eval(".pd-maim", (e) => e.length), extra: await p.$$eval(".pd-slot.is-extra", (e) => e.length), adv: await p.$$eval(".pd-adv", (e) => e.length), stashBtn: await p.$$eval(".pd-stash-section .pd-stash-open", (e) => e.length), effects: await p.$$eval(".pd-effect", (e) => e.length), talentAdd: await p.$$eval(".pd-talent-add", (e) => e.length) };
}
// --- Протезы Гюнтера: двойной клик ставит каждый на свою повреждённую конечность ---
// (аддоны могут быть выключены - тогда Гюнтер без травм и проверка пропускается)
if (out["Гюнтер"]?.maim > 0) {
  const opts = await p.$$eval("#mock-cast option", (e) => e.map((o) => o.textContent));
  await p.selectOption("#mock-cast", String(opts.findIndex((o) => /Гюнтер/.test(o)))); await p.waitForTimeout(800);
  await p.click('.pd-tab[data-tab="bag"]'); await p.waitForTimeout(300);
  const dbl = (id) => p.evaluate((id) => {
    const el = [...document.querySelectorAll(`.pd-bag-grid .pd-item[data-item-id="${id}"]`)].find((e) => !e.classList.contains("is-ghost"));
    el?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
  }, id);
  const st = (slot) => p.evaluate((slot) => document.querySelector(`.pd-slot[data-slot="${slot}"]`)?.className.match(/is-(maimed|replaced|patched)/)?.[0] ?? "plain", slot);
  await dbl("v-hook"); await p.waitForTimeout(400);
  await dbl("v-wooden-leg"); await p.waitForTimeout(400);
  await dbl("v-marvel"); await p.waitForTimeout(400);
  out.prosthetics = {
    hookOnArm: await st("lArm"),
    legOnFoot: await st("rLeg"),
    // «чудо» обязано пойти на сломанную ногу БЕЗ протеза, а не вытеснять крюк
    marvelOnBrokenLeg: await st("lLeg"),
    hookStillOn: await p.evaluate(() => window.__PD_actors.find((a) => a.id === "vet")?.items.find((i) => i.id === "v-hook")?.system.isEquipped ?? null)
  };
}
// Травма - такой же дебафф: ЛКМ в ленте снимает её (с подтверждением), ПКМ - только открывает
if (out["Гюнтер"]?.maim > 0) {
  const injCount = () => p.evaluate(() => window.__PD_actors.find((a) => a.id === "vet")?.items.filter((i) => i.type === "injury").length);
  await p.evaluate(() => { const D = foundry.applications?.api?.DialogV2; if (D) D.confirm = async () => true; });
  const before = await injCount();
  await p.evaluate(() => {
    const el = [...document.querySelectorAll(".pd-effect--injury")].at(0);
    el?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  });
  await p.waitForTimeout(300);
  const afterRmb = await injCount();
  await p.evaluate(() => {
    const el = [...document.querySelectorAll(".pd-effect--injury")].at(0);
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await p.waitForTimeout(500);
  out.injuryClicks = { before, afterRmb, afterLmb: await injCount() };
}
console.log(JSON.stringify(out), "errors:", errs);
await b.close();
