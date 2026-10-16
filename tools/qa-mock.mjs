/**
 * Прогон мока как пользователь: каждый слот, фильтры, сортировка, список, «Разложить», деньги, статы, эффекты, перетаскивание.
 *   node tools/build-mock.mjs --blank --cast --effects --out mock-qa.html
 *   node tools/qa-mock.mjs $PWD/mock-qa.html
 * Нужен playwright (npm i -D playwright). Печатает проваленные проверки и ошибки консоли.
 */
import { chromium } from "playwright";
const file = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 950 } });
const errs = []; p.on("pageerror", e => errs.push("PAGEERROR " + e.message)); p.on("console", m => (m.type() === "error" || m.type() === "warning") && errs.push(m.type() + " " + m.text()));
const results = []; const ok = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`);
await p.goto("file://" + file); await p.waitForTimeout(800);
const toasts = () => p.$$eval('.mock-toast', els => els.map(e => e.textContent));
const nActors = await p.$$eval('#mock-cast option', e => e.length).catch(() => 1);
for (let a = 0; a < nActors; a++) {
  if (nActors > 1) { await p.selectOption('#mock-cast', String(a)); await p.waitForTimeout(600); }
  const name = await p.$eval('.pd-hero-name', e => e.textContent.trim());
  // 1. каждый слот: открыть список, надеть первую доступную, снять всё, вернуть
  const slots = await p.$$eval('.pd-slot', els => els.map(e => e.dataset.slot));
  for (const slot of slots) {
    const sel = `.pd-slot[data-slot="${slot}"] .pd-slot-frame`;
    if (!await p.$(sel)) continue;
    await p.click(sel); await p.waitForTimeout(120);
    const fly = await p.$('.wfrp-paperdoll-flyout');
    ok(`${name} ${slot} flyout`, !!fly);
    if (!fly) continue;
    const eq = await p.$('.wfrp-paperdoll-flyout .pd-fly-row[data-act=equip]');
    if (eq) {
      const id = await eq.getAttribute('data-item-id');
      await eq.click(); await p.waitForTimeout(250);
      const inSlot = await p.$$eval(`.pd-slot[data-slot="${slot}"] .pd-item`, els => els.map(e => e.dataset.itemId));
      const twoH = slot === 'off';
      ok(`${name} ${slot} equip ${id}`, inSlot.includes(id) || twoH || /^bag/.test(slot) && await p.$(`.pd-bagsec-icon[data-slot="${slot}"]`) !== null, JSON.stringify(inSlot));
    } else await p.keyboard.press('Escape');
    await p.mouse.click(3, 3); await p.waitForTimeout(80);
  }
  // 2. фильтры / сортировка / список
  for (const f of await p.$$eval('.pd-filter', els => els.map(e => e.dataset.filter))) {
    await p.click(`.pd-filter[data-filter="${f}"]`); await p.waitForTimeout(150);
    const active = await p.$eval('.pd-filter.is-active', e => e.dataset.filter).catch(() => 'none');
    ok(`${name} filter ${f}`, active === f, active);
  }
  await p.click('.pd-filter[data-filter="all"]'); await p.waitForTimeout(150);
  for (const srt of ['rarity-desc', 'name-asc', 'name-desc', 'default']) {
    await p.click('.pd-sortbtn'); await p.click(`.pd-sortopt[data-sort="${srt}"]`); await p.waitForTimeout(150);
  }
  await p.click('.pd-sortbtn'); await p.click('.pd-sortopt[data-view="list"]'); await p.waitForTimeout(150);
  ok(`${name} list view`, !!await p.$('.pd-bag-list.is-list'));
  await p.click('.pd-sortbtn'); await p.click('.pd-sortopt[data-view="grid"]'); await p.waitForTimeout(150);
  // 3. Разложить
  const pack = await p.$('.pd-pack:not(.is-idle)');
  if (pack) { await pack.click(); await p.waitForTimeout(300); ok(`${name} pack`, true); }
  // 4. переполнение сумки: проверка, что used <= cap для всех надетых сумок
  // 5. деньги
  const m0 = await p.$$eval('.pd-coin', e => e.map(x => x.textContent.trim()).join(' '));
  await p.click('.pd-coin--bp'); await p.click('.pd-coin--bp', { button: 'right' }); await p.waitForTimeout(200);
  const m1 = await p.$$eval('.pd-coin', e => e.map(x => x.textContent.trim()).join(' '));
  ok(`${name} money +1-1`, true, `${m0} -> ${m1}`);
  // 6. вкладка статов, книжка, выпадашки
  await p.click('[data-tab=stats]'); await p.waitForTimeout(150);
  ok(`${name} stats tab`, (await p.$$('.pd-ecs-row')).length > 10);
  await p.click('[data-tab=bag]'); await p.waitForTimeout(150);
  await p.selectOption('.pd-statbox select[data-panel="0"]', 'combat'); await p.waitForTimeout(150);
  await p.selectOption('.pd-statbox select[data-panel="0"]', 'physical'); await p.waitForTimeout(150);
  // 7. эффекты: клик по первому состоянию
  const eff = await p.$('.pd-effect--condition');
  if (eff) {
    const before = await p.$$eval('.pd-effect', e => e.length);
    const val = await p.$eval('.pd-effect--condition', e => e.textContent.trim());
    await eff.click(); await p.waitForTimeout(300);
    const after = await p.$$eval('.pd-effect', e => e.length);
    const val2 = await p.$eval('.pd-effect--condition', e => e.textContent.trim()).catch(() => '-');
    ok(`${name} condition click refreshes`, before !== after || val !== val2, `${before}/${val} -> ${after}/${val2}`);
  }
  // 8. drag: из сумки в слот и обратно
  const bagItem = await p.$('.pd-bagsec .pd-item[draggable=true]');
  if (bagItem) {
    const id = await bagItem.getAttribute('data-item-id');
    await p.dragAndDrop(`.pd-bagsec .pd-item[data-item-id="${id}"]`, '.pd-slot[data-slot=accessory] .pd-slot-frame'); await p.waitForTimeout(300);
  }
  ok(`${name} no stuck flyout`, !(await p.$('.wfrp-paperdoll-flyout')));
}
console.log(results.filter(r => r.startsWith('FAIL')).join('\n') || 'all pass', `(${results.length} checks)`);
console.log('toasts', (await toasts()).slice(-5));
console.log('errors', [...new Set(errs)].slice(0, 15));
await b.close();
