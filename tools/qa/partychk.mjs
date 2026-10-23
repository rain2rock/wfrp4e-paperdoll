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
r.names = await p.$$eval(".pd-group-card-head .pd-group-name", (e) => e.map((x) => x.textContent));
r.fx = await p.$$eval(".pd-group-fx-icon", (e) => e.length);
r.coins = await p.$$eval(".pd-group-card-money .pd-coin", (e) => e.map((x) => x.textContent.trim()));

// Монеты: ЛКМ по золотой кроне у первой карточки должен прибавить +1 зк
const gcBefore = await p.$eval(".pd-group-card:nth-child(1) .pd-coin--gc", (e) => e.textContent.trim());
await p.click(".pd-group-card:nth-child(1) .pd-coin--gc");
await p.waitForTimeout(400);
r.gcBefore = gcBefore;
r.gcAfterClick = await p.$eval(".pd-group-card:nth-child(1) .pd-coin--gc", (e) => e.textContent.trim());

// Раны: ЛКМ у второй карточки должен прибавить +1 (restore), ПКМ -1 (remove) - как в основной карточке
const woundsBefore = await p.$eval(".pd-group-card:nth-child(2) .pd-group-wounds .pd-vital span", (e) => e.textContent.trim());
await p.click(".pd-group-card:nth-child(2) .pd-group-wounds");
await p.waitForTimeout(400);
r.woundsBefore = woundsBefore;
r.woundsAfterHeal = await p.$eval(".pd-group-card:nth-child(2) .pd-group-wounds .pd-vital span", (e) => e.textContent.trim());
await p.click(".pd-group-card:nth-child(2) .pd-group-wounds", { button: "right" });
await p.waitForTimeout(400);
r.woundsAfterDamage = await p.$eval(".pd-group-card:nth-child(2) .pd-group-wounds .pd-vital span", (e) => e.textContent.trim());

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
// Выданная мутация видна и в ленте карточки ГМ (раньше - только у игрока): лента группы
// собирается тем же конвейером, что в окне куколки (PaperdollApp.effectsFor)
r.mutInGMList = await p.$$eval(".pd-group-fx-icon.pd-effect--mutation", (e) => e.length) > 0;
await p.click(".pd-group-toolbar"); await p.waitForTimeout(150);

// Пассивку с таланта (transfer+origin) нельзя снять из окна группы и её вообще не должно быть в ленте
r.passiveShown = await p.evaluate(() =>
  [...document.querySelectorAll(".pd-group-card")].some((c) =>
    [...c.querySelectorAll(".pd-group-fx-icon")].some((i) => i.title === "Закалка")
  )
);
r.passiveStillOnActor = await p.evaluate(() => (window.__PD_actors[0].effects ?? []).some((e) => e.transfer === true && e.origin));

// Переключение на «Таблица»
// Вид переключается из панели «Отображение» - одна настройка на вид, состав и поля
// Панель после выбора остаётся открытой - можно щёлкнуть несколько полей подряд
const openDisplay = async () => {
  if (!(await p.$('.pd-group-displaymenu.is-open'))) await p.click('.pd-group-display-btn');
  await p.waitForTimeout(250);
};
const pickDisplay = async (sel) => {
  await openDisplay();
  await p.click(`.pd-group-displaymenu ${sel}`); await p.waitForTimeout(400);
};
await pickDisplay('[data-view="table"]'); await p.waitForTimeout(300);
r.rows = await p.$$eval(".pd-group-row", (e) => e.length);
r.cardsAfterSwitch = await p.$$eval(".pd-group-card", (e) => e.length);

// Начало сессии: удача первого персонажа должна подняться до судьбы
r.fortuneBefore = await p.$eval(".pd-group-row .pd-group-cell--fortune", (e) => e.textContent.trim());
await p.click(".pd-group-session"); await p.waitForTimeout(500);
r.fortuneAfter = await p.$eval(".pd-group-row .pd-group-cell--fortune", (e) => e.textContent.trim());
r.viewKeptAfterRerender = await p.$$eval(".pd-group-row", (e) => e.length) > 0;
// Таблица по макету: монеты под именем, без колонки денег, эффекты сеткой общего с карточками размера
r.tableMoneyUnderName = await p.$$eval(".pd-group-row .pd-group-card-id .pd-group-coins", (e) => e.length);
r.tableNoMoneyColumn = await p.$$eval(".pd-group-col--money", (e) => e.length) === 0;
// Таблица: доп. колонка опыта включается своей галкой (раздельные настройки с карточками)
await pickDisplay('[data-show-table="Xp"]'); await p.waitForTimeout(400);
r.tableXpCol = await p.$$eval(".pd-group-head .pd-group-cell--extra", (e) => e.map((x) => x.textContent.trim()));
await pickDisplay('[data-show-table="Xp"]'); await p.waitForTimeout(300);
r.tableXpColOff = await p.$$eval(".pd-group-head .pd-group-cell--extra", (e) => e.length);
r.tableFxSizedBySetting = await p.$$eval(".pd-group-row .pd-group-fx.is-big, .pd-group-row .pd-group-fx:not(.is-big)", (e) => e.length) > 0;

// --- Казна группы, сундук, выбор токена и приём вещей на карточку ---
// Сундук - настоящий NPC, которого НЕТ среди участников: так проверяется и то,
// что его казна обновляется в шапке без переоткрытия окна.
await p.evaluate(() => {
  const coin = (name, value, qty) => ({ id: "coin-" + value, name, type: "money",
    system: { quantity: { value: qty }, coinValue: { value }, encumbrance: { value: 0 } } });
  const donor = window.__PD_actors.find((a) => a.type === "character");
  const stash = window.__PD_makeActor__({
    id: "stash1", name: "Сундук группы", type: "npc", img: "icons/svg/chest.svg",
    system: structuredClone(donor.system),
    items: [coin("Золотая крона", 240, 2), coin("Серебряный шиллинг", 12, 14), coin("Медный пенни", 1, 37)]
  });
  game.settings.set("wfrp4e-paperdoll", "stashActor", stash.id);
});
await pickDisplay('[data-view="card"]'); await p.waitForTimeout(400);
r.treasuryCoins = await p.$$eval(".pd-group-treasury .pd-coin", (e) => e.length);
// Монеты казны не должны прилипать к правому краю окна
r.treasuryGapRight = await p.evaluate(() => {
  const coins = document.querySelectorAll(".pd-group-treasury .pd-coin");
  const last = coins[coins.length - 1];
  const app = last.closest(".application") ?? last.closest(".wfrp-paperdoll-group");
  return Math.round(app.getBoundingClientRect().right - last.getBoundingClientRect().right);
});
// Клик по казне меняет деньги сундука и сразу виден в шапке (2зк 14сш 37п + 1зк = 3/17/1)
await p.click(".pd-group-treasury .pd-coin--gc"); await p.waitForTimeout(500);
r.treasuryAfterClick = await p.$$eval(".pd-group-treasury .pd-coin", (e) => e.map((x) => x.textContent.trim()));

// Имя/фото: ЛКМ выбирает токен, двойной клик ведёт камеру
await p.evaluate(() => { canvas.tokens.controlled.length = 0; canvas.__pan = null; });
await p.click(".pd-group-card:nth-child(1) .pd-group-pick"); await p.waitForTimeout(200);
r.tokenControlled = await p.evaluate(() => canvas.tokens.controlled.length);
await p.dblclick(".pd-group-card:nth-child(1) .pd-group-pick"); await p.waitForTimeout(200);
r.tokenPanned = await p.evaluate(() => !!canvas.__pan);
// Клик по монете в шапке - про деньги, токен выбираться не должен
r.coinClickNoPick = await p.evaluate(async () => {
  canvas.tokens.controlled.length = 0;
  document.querySelector(".pd-group-card .pd-group-card-money .pd-coin")?.click();
  await new Promise((res) => setTimeout(res, 250));
  return canvas.tokens.controlled.length === 0;
});

// Перетаскивание вещи на карточку персонажа передаёт её владельцу карточки
r.dropTargets = await p.$$eval(".pd-group-drop", (e) => e.length);
await p.evaluate(() => {
  const chars = window.__PD_actors.filter((a) => a.type === "character");
  const [donor, target] = chars;
  const item = donor.items.find((i) => i.type === "trapping" || i.type === "weapon");
  window.__moved = { name: item?.name, before: target.items.filter((i) => i.name === item?.name).length };
  const dt = new DataTransfer();
  dt.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid, fromPaperdoll: true }));
  const card = document.querySelectorAll(".pd-group-drop")[1];
  card.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
  window.__dropHighlight = card.classList.contains("is-drop");
  card.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
});
await p.waitForTimeout(700);
r.dropHighlight = await p.evaluate(() => window.__dropHighlight);
r.dropMoved = await p.evaluate(() => {
  const m = window.__moved;
  const target = window.__PD_actors.filter((a) => a.type === "character")[1];
  return `${m.name} ${m.before}->${target.items.filter((i) => i.name === m.name).length}`;
});

// --- Окно сундука: деньги сверху, сетка как «При себе», сортировка, выдача и живое обновление ---
await p.evaluate(() => {
  // кладём в сундук пару вещей, чтобы было что показывать и забирать
  const stash = game.actors.get("stash1");
  const donor = window.__PD_actors.find((a) => a.type === "character");
  for (const i of donor.items.filter((x) => ["trapping", "weapon"].includes(x.type)).slice(0, 3)) {
    stash.items.push({ id: "st-" + i.id, name: i.name, type: i.type, img: i.img, parent: stash,
                       uuid: `Actor.stash1.Item.st-${i.id}`, system: structuredClone(i.system),
                       toDragData: () => ({ type: "Item", uuid: `Actor.stash1.Item.st-${i.id}` }),
                       update: async function (d) { for (const [k, v] of Object.entries(d)) foundry.utils.setProperty(this, k, v); },
                       delete: async function () { stash.items.splice(stash.items.indexOf(this), 1); Hooks.call("deleteItem", this); },
                       toObject: function () { return { name: this.name, type: this.type, img: this.img, system: structuredClone(this.system) }; } });
    Hooks.call("createItem", stash.items.at(-1));   // в живом Foundry этот хук шлёт сама система
  }
});
// Сундук теперь «под катом» прямо в окне группы: заголовок с числом предметов
await p.evaluate(() => [...window.PaperdollApp?.instances?.values?.() ?? []]); // no-op, ждём перерисовку
await p.waitForTimeout(400);
r.stashCut = await p.$$eval(".pd-group-stashcut", (e) => e.length);
r.stashCutCount = await p.$eval(".pd-group-stashcount", (e) => e.textContent.trim()).catch(() => null);
await p.click(".pd-group-stashcut summary"); await p.waitForTimeout(500);
r.stashCutOpen = await p.$$eval(".pd-group-stashcut[open]", (e) => e.length);
// Отступ окна: в ядре есть правило с !important и большей специфичностью, из-за него
// содержимое окна группы прилипало к краю.
r.padGroup = await p.evaluate(() => getComputedStyle(document.querySelector(".wfrp-paperdoll-group .window-content")).padding);
// Кнопки шапки должны быть одного размера - за это отвечает общий класс .pd-btn
r.btnHeights = await p.evaluate(() =>
  [...document.querySelectorAll(".pd-group-toolbar .pd-btn")].map((b) => Math.round(b.getBoundingClientRect().height))
);
r.stashSortBtnCut = await p.$$eval(".pd-group-stashcut .pd-stash-sortbtn", (e) => e.length);

r.stashCells = await p.$$eval(".pd-group-stashcut .pd-bag-grid .pd-item", (e) => e.length);
r.stashEmptyCells = await p.$$eval(".pd-group-stashcut .pd-bag-cell", (e) => e.length);
// деньги в сетку попадать не должны - они показаны сверху
r.stashNoMoneyInGrid = await p.$$eval(".pd-group-stashcut .pd-bag-grid .pd-item img", (e) => e.length) === r.stashCells;
// сундук - отдельный блок под «При себе», внутри кнопка «Открыть сундук группы»
r.stashSection = await p.$$eval(".pd-bag-list .pd-stash-section", (e) => e.length);
r.stashOpenBtn = await p.$$eval(".pd-stash-section .pd-stash-open", (e) => e.length);
r.stashSectionLast = await p.evaluate(() => {
  const secs = [...document.querySelectorAll(".pd-bag-list .pd-bagsec")];
  return secs.at(-1)?.classList.contains("pd-stash-section") ?? false;
});
// сортировка переключается
await p.click(".pd-group-stashcut .pd-stash-sortbtn"); await p.waitForTimeout(250);
r.stashSortMenuOpen = await p.$$eval(".pd-group-stashcut .pd-sortmenu.is-open", (e) => e.length);
await p.click('.pd-group-stashcut [data-stash-sort="name-asc"]'); await p.waitForTimeout(400);
r.stashSortApplied = await p.evaluate(() => {
  const names = [...document.querySelectorAll(".pd-group-stashcut .pd-item-name")].map((e) => e.textContent.trim());
  return JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b, "ru")));
});
r.stashStillOpenAfterSort = await p.$$eval(".pd-group-stashcut[open]", (e) => e.length);
// Вид «список с названиями» - как в сумке игрока; действует и на отдельное окно
await p.evaluate(() => [...document.querySelectorAll('.pd-group-stashcut [data-stash-view="list"]')].at(0)?.click());
await p.waitForTimeout(400);
r.stashListView = await p.evaluate(() => {
  const n = document.querySelector(".pd-group-stashbody .pd-bag-list.is-list .pd-item-name");
  return !!n && getComputedStyle(n).display !== "none" && n.textContent.trim().length > 0;
});
await p.evaluate(() => [...document.querySelectorAll('.pd-group-stashcut [data-stash-view="grid"]')].at(0)?.click());
await p.waitForTimeout(400);
r.stashGridBack = await p.evaluate(() => !document.querySelector(".pd-group-stashbody .pd-bag-list.is-list"));
// Панель как у игрока: фильтры слева, вес и сортировка по правому краю, над сеткой
r.stashPanel = await p.evaluate(() => {
  const panel = document.querySelector(".pd-group-stashbody .pd-stash-filters");
  const grid = document.querySelector(".pd-group-stashbody .pd-bag-grid");
  if (!panel || !grid) return "нет панели";
  const chips = panel.querySelector(".pd-filter-chips .pd-filter");
  const sort = panel.querySelector(".pd-sortbtn");
  const abovеGrid = panel.getBoundingClientRect().bottom <= grid.getBoundingClientRect().top + 1;
  const chipsLeft = chips && sort && chips.getBoundingClientRect().left < sort.getBoundingClientRect().left;
  // Вес - на кате, в линию с названием, по правому краю
  const w = document.querySelector(".pd-group-stashcut summary .pd-group-stashweight");
  const weightShown = !!w && getComputedStyle(w).display !== "none";
  return abovеGrid && chipsLeft && weightShown;
});
// Сетка выровнена с панелью: левый край иконок = чипам, правый край сетки = сортировке
r.stashAligned = await p.evaluate(() => {
  const L = (sel) => Math.round(document.querySelector(".pd-group-stashcut " + sel)?.getBoundingClientRect().left ?? -1);
  const R = (sel) => Math.round(document.querySelector(".pd-group-stashcut " + sel)?.getBoundingClientRect().right ?? -1);
  return L(".pd-filter") === L(".pd-item") && R(".pd-sortbtn") === R(".pd-bag-grid");
});
// Фильтр работает: «Оружие» оставляет в сетке только оружие
r.stashFilter = await p.evaluate(async () => {
  const stash = game.actors.get("stash1");
  const btn = [...document.querySelectorAll('.pd-group-stashcut [data-stash-filter]')].find((b) => b.dataset.stashFilter === "weapon");
  if (!btn) return "нет кнопки";
  btn.click();
  await new Promise((res) => setTimeout(res, 400));
  const shown = [...document.querySelectorAll(".pd-group-stashcut .pd-bag-grid .pd-item")].map((e) => stash.items.get(e.dataset.itemId)?.type);
  document.querySelector('.pd-group-stashcut [data-stash-filter="all"]')?.click();
  await new Promise((res) => setTimeout(res, 300));
  return shown.length > 0 && shown.every((t) => t === "weapon" || t === "ammunition");
});
// живое обновление: удаление вещи из сундука перерисовывает окно само
r.stashLive = await p.evaluate(async () => {
  const before = document.querySelectorAll(".pd-group-stashcut .pd-bag-grid .pd-item").length;
  await game.actors.get("stash1").items.find((i) => i.type !== "money").delete();
  await new Promise((res) => setTimeout(res, 400));
  return `${before} -> ${document.querySelectorAll(".pd-group-stashcut .pd-bag-grid .pd-item").length}`;
});
// отдельное окно сундука по-прежнему открывается из блока «При себе» (api.openStash)
await p.evaluate(() => window.__PD_API__?.addons?.get("party") && window.__PD_API__.openStash?.());
r.stashWindow = await p.evaluate(() => document.querySelectorAll(".wfrp-paperdoll-stash").length);

// --- Консистентность эффектов: ЛКМ снимает бафф/дебафф так же, как в основном окне ---
await p.evaluate(() => {
  // подтверждение снятия в моке отвечаем «да», иначе диалог повиснет
  const D = foundry.applications?.api?.DialogV2;
  if (D) D.confirm = async () => true;
  const a = window.__PD_actors.find((x) => x.type === "character");
  a.effects.push({ id: "fx-curse", name: "Проклятая топь", img: null, disabled: false, transfer: false,
                   statuses: [], changes: [], parent: a,
                   delete: async function () { a.effects.splice(a.effects.indexOf(this), 1); Hooks.call("deleteActiveEffect", this); Hooks.call("updateActor", a, {}); } });
  a.effects.get = (id) => a.effects.find((e) => e.id === id);
});
await p.waitForTimeout(500);
await pickDisplay('[data-view="card"]'); await p.waitForTimeout(400);
r.fxBeforeRemove = await p.evaluate(() => window.__PD_actors.find((x) => x.type === "character").effects.length);
const curse = await p.$('.pd-group-fx-icon[data-effect-id="fx-curse"]');
if (curse) { await curse.click(); await p.waitForTimeout(600); }
r.fxAfterLmb = await p.evaluate(() => window.__PD_actors.find((x) => x.type === "character").effects.length);

// Длительность и уровень эффекта в окне ГМ - те же значки, что в ленте основного окна
await p.evaluate(() => {
  const a = window.__PD_actors.find((x) => x.type === "character");
  a.effects.push({ id: "fx-timed", name: "Благословение стойкости", img: null, disabled: false, transfer: false,
                   statuses: [], changes: [], parent: a,
                   duration: { rounds: 6, startRound: 1, startTime: 0 },
                   delete: async function () { a.effects.splice(a.effects.indexOf(this), 1); Hooks.call("updateActor", a, {}); } });
  [...window.PaperdollApp.instances.values()].forEach((x) => x.render());
  game.combat = { round: 2, started: true };
});
await pickDisplay('[data-view="card"]'); await p.waitForTimeout(500);
r.fxDurationShown = await p.$$eval(".pd-group-fx-icon .pd-effect-left", (e) => e.map((x) => x.textContent.trim()));
r.fxIsWrapper = await p.$$eval(".pd-group-fx-icon img", (e) => e.length);

// Крупные иконки эффектов: с настройкой бейджи видны, без неё - спрятаны
r.bigFxDefault = await p.$$eval(".pd-group-card-fx.is-big", (e) => e.length) > 0;
// «+» стоит в той же сетке, что иконки: совпадает по верху с первым рядом или стоит в колонке сетки
r.plusAlignedInGrid = await p.evaluate(() => {
  const grid = [...document.querySelectorAll(".pd-group-card-fx")].find((g) => g.querySelector(".pd-group-fx-icon"));
  if (!grid) return "нет сетки с иконками";
  const btn = grid.querySelector(".pd-group-addfx-btn");
  const icons = [...grid.querySelectorAll(".pd-group-fx-icon")];
  const bw = btn.getBoundingClientRect();
  const iw = icons[0].getBoundingClientRect();
  const gridRect = grid.getBoundingClientRect();
  const cs = getComputedStyle(grid);
  const step = iw.width + (parseFloat(cs.columnGap) || 0);
  // «+» того же размера и стоит на шаге сетки от её левого края
  const sameSize = Math.round(bw.width) === Math.round(iw.width);
  const onGrid = Math.abs(((bw.left - gridRect.left) % step + step) % step) <= 1;
  return sameSize && onGrid;
});
await pickDisplay('[data-bigfx="small"]'); await p.waitForTimeout(400);
r.bigFxOff = await p.$$eval(".pd-group-card-fx.is-big", (e) => e.length);
r.badgeHiddenWhenSmall = await p.evaluate(() => {
  const b = document.querySelector(".pd-group-card-fx:not(.is-big) .pd-effect-left");
  return !b || getComputedStyle(b).display === "none";
});
await pickDisplay('[data-bigfx="big"]'); await p.waitForTimeout(400);
r.bigFxBackOn = await p.$$eval(".pd-group-card-fx.is-big", (e) => e.length) > 0;
// Брони больше нет ни в карточке, ни в таблице, ни в панели «Отображение»
// Раздел размера иконок виден только при включённых эффектах
await pickDisplay('[data-show="Effects"]'); await p.waitForTimeout(300);
r.fxSizeHiddenWithoutFx = await p.$$eval(".pd-group-displaymenu [data-bigfx]", (e) => e.length) === 0;
await pickDisplay('[data-show="Effects"]'); await p.waitForTimeout(300);
r.fxSizeBackWithFx = await p.$$eval(".pd-group-displaymenu [data-bigfx]", (e) => e.length) === 2;
r.armourGone = await p.evaluate(() =>
  !document.querySelector(".pd-group-card-ap") && !document.querySelector(".pd-group-col--ap") && !document.querySelector('[data-show="Armour"]'));

// Полосы карточек - разметка .pd-vital ядра; вторая полоса переключается шестерёнкой
r.cardVitalBars = await p.$$eval(".pd-group-card .pd-vital", (e) => e.length);
r.secondBarDefault = await p.$eval(".pd-group-card .pd-vital--second span", (e) => e.textContent.trim()).catch(() => null);
// закрываем панель «Отображение», если открыта - иначе она перекрывает шестерёнку
await p.evaluate(() => document.querySelector(".pd-group-displaymenu")?.classList.remove("is-open"));
await p.waitForTimeout(150);
await p.click(".pd-group-card .pd-group-vopts"); await p.waitForTimeout(250);
await p.click('.pd-group-barmenu.is-open [data-gbar="resolve"]'); await p.waitForTimeout(500);
r.secondBarSwitched = await p.$eval(".pd-group-card .pd-vital--second span", (e) => e.textContent.trim()).catch(() => null);
// Выбор персональный: у остальных карточек полоса не изменилась
r.secondBarOthersKept = await p.$eval(".pd-group-card:nth-child(2) .pd-vital--second span", (e) => e.textContent.trim()).catch(() => null);
await p.evaluate(() => game.settings.set("wfrp4e-paperdoll", "groupSecondBars", {})); await p.waitForTimeout(400);

// --- Панель «Отображение»: скрытие данных, сортировка и значок статуса ---
r.dotAlwaysShown = await p.$$eval(".pd-group-card-head .pd-group-dot", (e) => e.length);
r.dotInsidePortrait = await p.$$eval(".pd-group-portrait .pd-group-dot", (e) => e.length);
r.moneyBeforeHide = await p.$$eval(".pd-group-card-money", (e) => e.length);
await pickDisplay('[data-show="Money"]'); await p.waitForTimeout(300);
r.moneyAfterHide = await p.$$eval(".pd-group-card-money", (e) => e.length);
r.nameStillShown = await p.$$eval(".pd-group-card-head .pd-group-name", (e) => e.length);
await pickDisplay('[data-show="Money"]'); await p.waitForTimeout(300);
r.moneyBackAfterToggle = await p.$$eval(".pd-group-card-money", (e) => e.length);

console.log(JSON.stringify(r), "errors:", errs);
await b.close();
