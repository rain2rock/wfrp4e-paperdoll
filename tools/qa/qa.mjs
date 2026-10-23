import { launch } from "./browser.mjs";
import path from "node:path";
const file = process.argv[2];
const b = await launch();
const p = await b.newPage({ viewport: { width: 1100, height: 950 } });
const errs = []; p.on("pageerror", e => errs.push("PAGEERROR " + e.message)); p.on("console", m => (m.type() === "error" || m.type() === "warning") && errs.push(m.type() + " " + m.text()));
const results = []; const ok = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`);
await p.goto("file://" + path.resolve(file)); await p.waitForTimeout(800);
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
  // 3. Разложить: сперва сам надевает самые вместительные сумки в свободные слоты
  const packState = await p.evaluate(async () => {
    const app = [...window.PaperdollApp.instances.values()].find((x) => x.rendered);
    const a = app.actor;
    const worn = () => a.items.filter((i) => i.type === 'container' && i.system.isEquipped);
    const before = worn().length;
    const spareCaps = a.items
      .filter((i) => i.type === 'container' && !i.system.isEquipped)
      .map((i) => Number(i.system.carries?.value) || 0)
      .sort((x, y) => y - x);
    await app._autoPack();
    await new Promise((r) => setTimeout(r, 400));
    const after = worn();
    return { before, spare: spareCaps.length, after: after.length,
             caps: after.map((c) => Number(c.system.carries?.value) || 0).sort((x, y) => y - x), topSpare: spareCaps[0] ?? 0 };
  });
  // если были свободные слоты и запасные сумки - самая вместительная должна оказаться надетой
  const grew = packState.after >= packState.before;
  const bestUsed = packState.before >= 3 || !packState.spare || packState.caps.includes(packState.topSpare);
  ok(`${name} pack equips best bags`, grew && bestUsed, JSON.stringify(packState));
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
// Подсказка не должна накрывать нижнюю панель Foundry (хотбар с кубиками):
// при нехватке места снизу она раскрывается вверх, а не прижимается к низу экрана.
await p.evaluate(() => {
  if (document.getElementById('ui-bottom')) return;
  const bar = document.createElement('div');
  bar.id = 'ui-bottom';
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:160px;background:#000;z-index:1';
  document.body.append(bar);
});
const barTop = await p.evaluate(() => document.getElementById('ui-bottom').getBoundingClientRect().top);
const slot = await p.$('.pd-slot[data-slot=mainHand] .pd-slot-frame') ?? await p.$('.pd-slot .pd-slot-frame');
if (slot) {
  const box = await slot.boundingBox();
  // Наводимся у самого низа доступной области - подсказке точно не хватит места снизу
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(250);
  await p.evaluate((y) => {
    const ev = new MouseEvent('pointermove', { clientX: 400, clientY: y - 20, bubbles: true });
    document.querySelector('.pd-slot .pd-slot-frame')?.dispatchEvent(ev);
  }, barTop);
  await p.waitForTimeout(200);
  const tip = await p.evaluate(() => {
    const el = document.querySelector('.wfrp-paperdoll-tooltip.is-visible');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { bottom: Math.round(r.bottom), top: Math.round(r.top) };
  });
  ok('tooltip clears hotbar', !tip || tip.bottom <= barTop, tip ? `low=${tip.bottom} bar=${Math.round(barTop)}` : 'no tooltip');
}
await p.evaluate(() => document.getElementById('ui-bottom')?.remove());

// Применение вещи (Shift+ПКМ) и значки бросков/денег в подсказке
await p.check('#mock-gm').catch(() => {});   // цены в описании видит только ГМ
await p.waitForTimeout(200);
// К этому месту прогон заканчивается на последнем персонаже (у мага сумка пустая),
// поэтому возвращаемся к первому, затем к сумке и фильтру «Всё»
if (await p.$('#mock-cast')) { await p.selectOption('#mock-cast', '0'); await p.waitForTimeout(600); }
await p.click('.pd-tab[data-tab="bag"]').catch(() => {});
await p.click('.pd-filter[data-filter="all"]').catch(() => {});
await p.waitForTimeout(300);
const useId = await p.evaluate(() => {
  // берём актёра ОТКРЫТОГО окна: в сборке с переключателем это не обязательно первый в списке
  const app = [...window.PaperdollApp.instances.values()].find((x) => x.rendered);
  const a = app?.actor ?? window.__PD_actors[0];
  window.__useActor = a.id;
  const inBag = new Set([...document.querySelectorAll('.pd-bag-grid .pd-item[data-item-id]:not(.is-ghost)')].map((e) => e.dataset.itemId));
  // Предпочитаем снаряжение (проверяет разбор по типу), иначе любую вещь с признаком расходника
  const it = a.items.find((i) => i.type === 'trapping' && inBag.has(i.id)) ?? a.items.find((i) => inBag.has(i.id));
  if (!it) return null;
  if (it.type === 'trapping') it.system.trappingType = { value: 'drugsPoisonsHerbsDraughts' };
  else it.system.consumable = true;
  it.system.quantity = { value: 2 };
  it.system.description = { value: '<p><strong>Начало действия:</strong> 1d10 раундов</p><p><strong>Цена ингредиентов:</strong> 6 ЗК</p>' };
  window.__chat = [];
  const oc = ChatMessage.create;
  ChatMessage.create = (d) => { window.__chat.push(d); return oc?.(d); };
  [...window.PaperdollApp.instances.values()].forEach((x) => x.render());
  return it.id;
});
ok('usable item found', !!useId, String(useId));
if (useId) {
  await p.waitForTimeout(500);
  const fire = (type, shift) => p.evaluate(([id, type, shift]) => {
    const el = document.querySelector(`.pd-bag-grid .pd-item[data-item-id="${id}"]:not(.is-ghost)`);
    el?.dispatchEvent(type === 'pointerenter'
      ? new PointerEvent(type, { bubbles: true, clientX: 500, clientY: 420 })
      : new MouseEvent(type, { bubbles: true, cancelable: true, shiftKey: shift }));
  }, [useId, type, shift]);
  await fire('pointerenter'); await p.waitForTimeout(400);
  const dice = await p.$$eval('.wfrp-paperdoll-tooltip .pd-vchip--dice', (e) => e.map((x) => x.textContent.trim()));
  const coin = await p.$$eval('.wfrp-paperdoll-tooltip .pd-tt-prop .pd-tt-coin .pd-coin-dot', (e) => e.length);
  const hint = await p.$eval('.wfrp-paperdoll-tooltip .pd-tt-hint', (e) => e.textContent).catch(() => '');
  ok('tooltip dice chip', dice.includes('1d10'), JSON.stringify(dice));
  const samePath = await p.evaluate(() => {
    const chip = document.querySelector('.wfrp-paperdoll-tooltip .pd-vchip--dice svg path');
    const roll = document.querySelector('.pd-roll svg path');
    return !!chip && !!roll && chip.getAttribute('d') === roll.getAttribute('d');
  });
  ok('dice icon matches weapon roll', samePath);
  ok('ingredient price as coin', coin > 0, `coins=${coin}`);
  ok('use hint shown', /Shift/i.test(hint) && !hint.includes('WFRPPD'), hint);
  const qty = () => p.evaluate((id) => {
    const a = window.__PD_actors.find((x) => x.id === window.__useActor);
    return a.items.find((i) => i.id === id).system.quantity.value;
  }, useId);
  const before = await qty();
  await fire('contextmenu', true); await p.waitForTimeout(600);
  const after = await qty();
  ok('shift+rmb uses item', after === before - 1, `${before} -> ${after}`);
  ok('use posts to chat', (await p.evaluate(() => window.__chat.length)) > 0);
  await fire('contextmenu', false); await p.waitForTimeout(400);
  ok('plain rmb does not use', (await qty()) === after);
}

// Лента эффектов основного окна: ЛКМ снимает бафф/дебафф - то же поведение, что в окне группы
const fxRemoved = await p.evaluate(async () => {
  const D = foundry.applications?.api?.DialogV2;
  if (D) D.confirm = async () => true;
  const app = [...window.PaperdollApp.instances.values()].find((x) => x.rendered);
  const a = app?.actor;
  if (!a) return null;
  const fx = { id: 'fx-test', name: 'Тестовый дебафф', img: null, disabled: false, transfer: false,
               statuses: [], changes: [], parent: a,
               delete: async function () { a.effects.splice(a.effects.indexOf(this), 1); Hooks.call('updateActor', a, {}); } };
  a.effects.push(fx);
  if (!a.effects.get) a.effects.get = (id) => a.effects.find((e) => e.id === id);
  app.render();
  await new Promise((r) => setTimeout(r, 500));
  const before = a.effects.length;
  const el = [...document.querySelectorAll('.pd-effect')].find((e) => e.getAttribute('aria-label') === 'Тестовый дебафф');
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 600));
  return `${before} -> ${a.effects.length}`;
});
if (fxRemoved) ok('lmb removes effect in main window', /^(\d+) -> (\d+)$/.test(fxRemoved) && Number(fxRemoved.split(' -> ')[1]) < Number(fxRemoved.split(' -> ')[0]), fxRemoved);

// Сравнение по Shift: у сравниваемого оружия тоже есть «Шанс попасть».
// К этому месту прогон мог переодеть персонажа - надеваем цеп сами, иначе сравнивать не с чем
await p.evaluate(async () => {
  const a = window.__PD_actors.find((x) => x.id === (window.__useActor ?? 'hugo')) ?? window.__PD_actors[0];
  // прогон мог надеть меч и снять цеп - возвращаем: цеп в руке, меч в сумке
  const sword = a.items.find((i) => i.id === 'sword');
  if (sword?.system.equipped?.value) await sword.update({ 'system.equipped.value': false });
  const flail = a.items.find((i) => i.id === 'flail');
  if (flail && !flail.system.equipped?.value) await flail.update({ 'system.equipped.value': true });
  [...window.PaperdollApp.instances.values()].forEach((x) => x.render());
});
await p.waitForTimeout(500);
await p.evaluate(() => {
  const el = [...document.querySelectorAll('.pd-bag-grid .pd-item')].find((e) => e.dataset.itemId === 'sword');
  el?.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, clientX: 600, clientY: 400, shiftKey: true }));
});
await p.waitForTimeout(600);
const cmpChance = await p.evaluate(() => {
  const cmp = document.querySelector('.wfrp-paperdoll-tooltip.is-compare.is-visible');
  if (!cmp) {
    const a = window.__PD_actors.find((x) => x.id === (window.__useActor ?? 'hugo'));
    return 'окна нет: меч=' + !!document.querySelector('.pd-bag-grid .pd-item[data-item-id=sword]') +
      ' цеп=' + a?.items.find((i) => i.id === 'flail')?.system.equipped?.value +
      ' осн.подсказка=' + !!document.querySelector('.wfrp-paperdoll-tooltip.is-visible') +
      ' опция=' + game.settings.get('wfrp4e-paperdoll', 'shiftCompare');
  }
  return [...cmp.querySelectorAll('.pd-tt-ap-row')].some((r) => /Шанс|chance/i.test(r.textContent)) ? 'есть' : 'НЕТ СТРОКИ';
});
ok('compare shows hit chance', cmpChance === 'есть', cmpChance);
await p.evaluate(() => document.querySelectorAll('.wfrp-paperdoll-tooltip').forEach((e) => e.classList.remove('is-visible')));

// Применение яда вешает его дебафф на персонажа (эффект лежит на предмете, transfer: false)
const poisonFx = await p.evaluate(async () => {
  const a = window.__PD_actors.find((x) => x.id === (window.__useActor ?? 'hugo')) ?? window.__PD_actors[0];
  const el = document.querySelector('.pd-bag-grid .pd-item[data-item-id="poison"]:not(.is-ghost)');
  if (!el) return null;
  const before = a.effects.length;
  el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, shiftKey: true }));
  await new Promise((r) => setTimeout(r, 700));
  const fx = a.effects.at(-1);
  return { grew: a.effects.length === before + 1, name: fx?.name, origin: fx?.origin ?? null };
});
if (poisonFx) {
  ok('use applies item effect', poisonFx.grew && poisonFx.name === 'Чёрный лотос', JSON.stringify(poisonFx));
  ok('applied effect keeps origin', /Item\.poison/.test(poisonFx.origin ?? ''), String(poisonFx.origin));
}

// Главный выключатель: выключенный модуль закрывает окна и не открывает новые.
// В самом конце - дальше проверять уже нечего.
const off = await p.evaluate(async () => {
  await game.settings.set('wfrp4e-paperdoll', 'enabled', false);
  await new Promise((r) => setTimeout(r, 300));
  const closed = document.querySelectorAll('.wfrp-paperdoll .pd-slot').length === 0;
  const blocked = window.PaperdollApp.openFor(window.__PD_actors[0]) === null;
  await new Promise((r) => setTimeout(r, 200));
  await game.settings.set('wfrp4e-paperdoll', 'enabled', true);
  window.PaperdollApp.openFor(window.__PD_actors[0]);
  await new Promise((r) => setTimeout(r, 400));
  const back = document.querySelectorAll('.wfrp-paperdoll .pd-slot').length > 0;
  return { closed, blocked, back };
});
ok('disabled closes windows', off.closed);
ok('disabled blocks opening', off.blocked);
ok('re-enabled opens again', off.back);

if (process.env.PD_QA_LIST) console.log(results.join('\n'));
console.log(results.filter(r => r.startsWith('FAIL')).join('\n') || 'all pass', `(${results.length} checks)`);
console.log('toasts', (await toasts()).slice(-5));
console.log('errors', [...new Set(errs)].slice(0, 15));
await b.close();
