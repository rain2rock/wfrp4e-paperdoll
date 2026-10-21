import { launch } from "./browser.mjs";
import path from "node:path";
const b = await launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto("file://" + path.resolve(process.argv[2])); await p.waitForTimeout(1200);

// Не-ГМ: кнопка не открывает окно
await p.click("#mock-group"); await p.waitForTimeout(300);
const r = { openedAsPlayer: await p.$$eval(".wfrp-paperdoll-group", (e) => e.length) };

// ГМ: открыть окно группы - по умолчанию вид «Карточки»
await p.check("#mock-gm"); await p.waitForTimeout(150);
await p.click("#mock-group"); await p.waitForTimeout(500);
r.cards = await p.$$eval(".pd-group-card", (e) => e.length);
r.names = await p.$$eval(".pd-group-card-head span", (e) => e.map((x) => x.textContent));
r.fx = await p.$$eval(".pd-group-fx-icon", (e) => e.length);
r.coins = await p.$$eval(".pd-group-card-money .pd-coin", (e) => e.map((x) => x.textContent.trim()));

// Монеты: ЛКМ по золотой кроне у первой карточки должен прибавить +1 зк
const gcBefore = await p.$eval(".pd-group-card:nth-child(1) .pd-coin--gc", (e) => e.textContent.trim());
await p.click(".pd-group-card:nth-child(1) .pd-coin--gc");
await p.waitForTimeout(400);
r.gcBefore = gcBefore;
r.gcAfterClick = await p.$eval(".pd-group-card:nth-child(1) .pd-coin--gc", (e) => e.textContent.trim());

// Раны: ЛКМ у второй карточки должен прибавить +1 (restore), ПКМ -1 (remove) - как в основной карточке
const woundsBefore = await p.$eval(".pd-group-card:nth-child(2) .pd-group-wounds .pd-group-card-num", (e) => e.textContent.trim());
await p.click(".pd-group-card:nth-child(2) .pd-group-wounds");
await p.waitForTimeout(400);
r.woundsBefore = woundsBefore;
r.woundsAfterHeal = await p.$eval(".pd-group-card:nth-child(2) .pd-group-wounds .pd-group-card-num", (e) => e.textContent.trim());
await p.click(".pd-group-card:nth-child(2) .pd-group-wounds", { button: "right" });
await p.waitForTimeout(400);
r.woundsAfterDamage = await p.$eval(".pd-group-card:nth-child(2) .pd-group-wounds .pd-group-card-num", (e) => e.textContent.trim());

// «+» у ленты: поиск и добавление состояния (на второй карточке). Каждый раз берём свежий $$,
// т.к. добавление эффекта вызывает полный ре-рендер окна и старые хендлы элементов отвязываются от DOM.
await (await p.$$(".pd-group-addfx-btn"))[1].click(); await p.waitForTimeout(200);
await p.fill(".pd-group-addmenu-search", "ошелом"); await p.waitForTimeout(150);
r.addMenuFiltered = await p.$$eval(".pd-group-addmenu-list [data-add-key]:not([hidden])", (e) => e.map((x) => x.textContent));
await p.click('.pd-group-addmenu-list [data-add-key]:not([hidden])'); await p.waitForTimeout(400);
r.fxAfterAdd = await p.$$eval(".pd-group-card:nth-child(2) .pd-group-fx-icon", (e) => e.length);

// Подробности эффекта при наведении - тултип ядра (теперь у Гюнтера точно есть хотя бы один эффект)
await p.hover(".pd-group-card:nth-child(2) .pd-group-fx-icon");
await p.waitForTimeout(250);
r.tooltipVisible = await p.isVisible(".wfrp-paperdoll-tooltip");
r.tooltipHint = await p.$eval(".wfrp-paperdoll-tooltip .pd-tt-hint", (e) => e.textContent.trim()).catch(() => null);

// Снятие состояния: добавим второй уровень, ЛКМ снимет 1, Shift+ЛКМ уберёт совсем - как в основном окне
await (await p.$$(".pd-group-addfx-btn"))[1].click(); await p.waitForTimeout(200);
await p.fill(".pd-group-addmenu-search", "ошелом"); await p.waitForTimeout(150);
await p.click('.pd-group-addmenu-list [data-add-key]:not([hidden])'); await p.waitForTimeout(400);
const condValue = () => p.evaluate(() => (window.__PD_actors[1].effects ?? []).find((e) => e.statuses.has("stunned"))?.conditionValue ?? null);
r.condBefore = await condValue();
await p.click(".pd-group-card:nth-child(2) .pd-group-fx-icon"); await p.waitForTimeout(400);
r.condAfterClick = await condValue();
await p.click(".pd-group-card:nth-child(2) .pd-group-fx-icon", { modifiers: ["Shift"] }); await p.waitForTimeout(400);
r.condAfterShift = await condValue();

await (await p.$$(".pd-group-addfx-btn"))[1].click(); await p.waitForTimeout(150); // снова открыть ту же панель
r.addMenuReopened = await p.isVisible(".pd-group-addmenu");
await p.click(".pd-group-toolbar"); await p.waitForTimeout(150);
r.addMenuClosedByOutsideClick = !(await p.isVisible(".pd-group-addmenu"));

// Разделы меню «+»: состояния всегда, мутации и травмы - от установленных дополнений (из компендиумов)
await (await p.$$(".pd-group-addfx-btn"))[1].click(); await p.waitForTimeout(600);
r.addMenuSections = await p.$$eval(".pd-group-addmenu-section", (e) => e.map((x) => x.dataset.section));
r.mutationOptions = await p.$$eval('[data-add-type="mutation"]', (e) => e.map((x) => x.textContent.trim()));
const mutCount = () => p.evaluate(() => window.__PD_actors[1].items.filter((i) => i.type === "mutation").length);
r.mutBefore = await mutCount();
const mutBtn = await p.$('[data-add-type="mutation"]');
if (mutBtn) { await mutBtn.click(); await p.waitForTimeout(500); }
r.mutAfter = await mutCount();
await p.click(".pd-group-toolbar"); await p.waitForTimeout(150);

// Пассивку с таланта (transfer+origin) нельзя снять из окна группы и её вообще не должно быть в ленте
r.passiveShown = await p.evaluate(() =>
  [...document.querySelectorAll(".pd-group-card")].some((c) =>
    [...c.querySelectorAll(".pd-group-fx-icon")].some((i) => i.title === "Закалка")
  )
);
r.passiveStillOnActor = await p.evaluate(() => (window.__PD_actors[0].effects ?? []).some((e) => e.transfer === true && e.origin));

// Переключение на «Таблица»
await p.click('.pd-group-viewtoggle [data-view="table"]'); await p.waitForTimeout(300);
r.rows = await p.$$eval(".pd-group-row", (e) => e.length);
r.cardsAfterSwitch = await p.$$eval(".pd-group-card", (e) => e.length);

// Начало сессии: удача первого персонажа должна подняться до судьбы
r.fortuneBefore = await p.$eval(".pd-group-row", (e) => e.querySelectorAll("div")[2]?.textContent.trim());
await p.click(".pd-group-session"); await p.waitForTimeout(500);
r.fortuneAfter = await p.$eval(".pd-group-row", (e) => e.querySelectorAll("div")[2]?.textContent.trim());
r.viewKeptAfterRerender = await p.$$eval(".pd-group-row", (e) => e.length) > 0;

console.log(JSON.stringify(r), "errors:", errs);
await b.close();
