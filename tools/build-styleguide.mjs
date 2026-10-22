/**
 * Витрина дизайн-системы: docs/styleguide.html (npm run styleguide).
 * Статическая страница с настоящими стилями модуля: токены, кнопки, чипы, меню,
 * полосы, ячейки и бейджи - всё, чем собираются окна. Сверяться сюда, а не изобретать.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const css = [
  read("styles/pd-system.css"),
  read("styles/paperdoll.css"),
  read("addons/magic/styles/magic.css"),
  read("addons/party/styles/party.css")
].join("\n");

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

/** Секция витрины: заголовок, пояснение, образец и используемые классы/токены */
const section = (title, note, html, refs = "") => `
  <section class="sg-section">
    <h2>${title}</h2>
    ${note ? `<p class="sg-note">${note}</p>` : ""}
    <div class="sg-demo wfrp-paperdoll wfrp-paperdoll-group wfrp-paperdoll-stash pd-theme-parchment">${html}</div>
    ${refs ? `<code class="sg-refs">${esc(refs)}</code>` : ""}
  </section>`;

const spaces = [1, 2, 3, 4, 5]
  .map((n) => `<div class="sg-space"><i style="width: var(--pd-space-${n})"></i>--pd-space-${n}</div>`)
  .join("");
const fonts = ["xs", "s", "m", "base", "l"]
  .map((k) => `<div style="font-size: var(--pd-fs-${k})">--pd-fs-${k} · Снаряжение и сумки</div>`)
  .join("");
const colors = ["text", "text-2", "muted", "frame", "well", "gold", "gold-soft", "up", "down", "warn", "hover"]
  .map((k) => `<div class="sg-color"><i style="background: var(--pd-${k})"></i>--pd-${k}</div>`)
  .join("");

const icon = (label) =>
  `<span class="pd-group-fx-icon pd-effect" title="${label}" style="width: var(--pd-icon-l); height: var(--pd-icon-l)"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23553'/%3E%3C/svg%3E" alt="">
    <span class="pd-effect-value">2</span><span class="pd-effect-left">3р</span></span>`;

const body = `
${section(
  "Токены: отступы, шрифты, цвета",
  "Все зазоры и паддинги - шкалой --pd-space-*, шрифты - --pd-fs-*, цвета - переменными темы. Свои пиксели в CSS запрещены (ловит tools/qa/dslint.mjs).",
  `<div class="sg-cols"><div>${spaces}</div><div>${fonts}</div><div>${colors}</div></div>`,
  "--pd-space-1..5, --pd-window-pad, --pd-radius, --pd-radius-lg, --pd-fs-xs..l, --pd-icon-s/l, --pd-cell"
)}
${section(
  "Кнопки",
  "Любая кнопка - .pd-btn. Модификатор .pd-btn--quiet - без подложки. Свои паддинги и шрифты кнопкам не задаются.",
  `<button type="button" class="pd-btn"><i class="fa-solid fa-sun"></i> Начало сессии</button>
   <button type="button" class="pd-btn pd-btn--quiet">Тихая кнопка</button>
   <button type="button" class="pd-btn" disabled>Недоступно</button>`,
  ".pd-btn, .pd-btn--quiet, [disabled]"
)}
${section(
  "Чипы-фильтры",
  "Панель .pd-filters: чипы слева, служебное (вес, сортировка) по правому краю. Активный чип - .is-active.",
  `<div class="pd-filters pd-stash-filters" style="width: 100%">
     <div class="pd-filter-chips">
       <button type="button" class="pd-filter is-active">Всё <span class="pd-filter-count">7</span></button>
       <button type="button" class="pd-filter">Оружие <span class="pd-filter-count">2</span></button>
       <button type="button" class="pd-filter">Броня <span class="pd-filter-count">1</span></button>
     </div>
     <div class="pd-sort"><button type="button" class="pd-btn pd-sortbtn"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5v11M1.8 11.2 4 13.5l2.2-2.3M9 4h6M9 8h4.5M9 12h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
   </div>`,
  ".pd-filters, .pd-filter-chips, .pd-filter(.is-active), .pd-filter-count"
)}
${section(
  "Выпадающее меню",
  "Меню - .pd-sortmenu (+ .is-open), заголовки разделов - .pd-sortmenu-title, пункты - .pd-sortopt (.is-active - точка слева). При нехватке места снизу вызывать fitDropdown(menu) из PD_UTIL.",
  `<div style="position: relative; height: 150px"><div class="pd-sortmenu is-open" style="position: static; display: block">
     <div class="pd-sortmenu-title">Вид</div>
     <button type="button" class="pd-sortopt is-active">Ячейки</button>
     <button type="button" class="pd-sortopt">Список с названиями</button>
   </div></div>`,
  ".pd-sortmenu(.is-open), .pd-sortmenu-title, .pd-sortopt(.is-active), PD_UTIL.fitDropdown"
)}
${section(
  "Полосы значений",
  "Разметка .pd-vital ядра: градиентная текстура, подпись внутри. Варианты: --wounds (цвет по состоянию is-light/…/is-dying), --second + --fortune/resolve/… Данные второй полосы - PD_UTIL.secondBarData.",
  `<div style="display: flex; flex-direction: column; gap: var(--pd-space-2); width: 260px">
     <div class="pd-vital pd-vital--wounds is-light"><div class="pd-vital-fill" style="width: 80%"></div><span>Раны 11 / 14</span></div>
     <div class="pd-vital pd-vital--second pd-vital--fortune"><div class="pd-vital-fill" style="width: 66%"></div><span>Удача 2 / 3</span></div>
   </div>`,
  ".pd-vital(--wounds|--second), .pd-vital-fill, PD_UTIL.secondBarData"
)}
${section(
  "Иконки эффектов и бейджи",
  "Сетка - грид фиксированных ячеек (--pd-icon-s / --pd-icon-l): иконки и «+» стоят ровно. Бейджи: уровень (.pd-effect-value, справа-снизу), длительность (.pd-effect-left, слева-сверху).",
  `<div class="pd-group-card-fx is-big" style="width: 280px">${icon("Яд")}${icon("Благословение")}<button type="button" class="pd-group-addfx-btn">+</button></div>`,
  ".pd-group-fx-icon, .pd-effect-value, .pd-effect-left, .pd-group-addfx-btn, --pd-icon-s/l"
)}
${section(
  "Монеты",
  "Кликабельная монета - .pd-coin--gc/ss/bp (ЛКМ +1, ПКМ -1, Shift ×10). Кружок номинала в тексте - .pd-coin-dot.",
  `<div class="pd-group-coins"><span class="pd-coin pd-coin--gc">2</span><span class="pd-coin pd-coin--ss">14</span><span class="pd-coin pd-coin--bp">37</span></div>
   <div style="margin-top: var(--pd-space-2)">Цена: 6<i class="pd-coin-dot pd-coin-dot--gc"></i></div>`,
  ".pd-coin--gc/ss/bp, .pd-coin-dot--gc/ss/bp, PD_UTIL.changeActorMoney"
)}
${section(
  "Аккордеон",
  "Кат - details.pd-group-stashcut: на заголовке имя, счётчик (.pd-group-stashcount) и вес по правому краю (.pd-group-stashweight).",
  `<details class="pd-group-stashcut" open style="width: 100%">
     <summary><i class="fa-solid fa-box-archive"></i> Сундук группы <span class="pd-group-stashcount">5</span><span class="pd-group-stashweight">вес 4</span></summary>
     <div class="pd-group-stashbody" style="padding: var(--pd-space-4)">Содержимое</div>
   </details>`,
  "details.pd-group-stashcut, .pd-group-stashcount, .pd-group-stashweight"
)}`;

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>WFRP4e Paperdoll - дизайн-система</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<style>${css}</style>
<style>
  body { margin: 0; padding: 24px; background: #2a2622; font: 14px/1.45 Signika, sans-serif; color: #eee; }
  .sg-head { max-width: 920px; margin: 0 auto 20px; }
  .sg-head p { color: #b8ab92; }
  .sg-section { max-width: 920px; margin: 0 auto 26px; }
  .sg-section h2 { font-size: 16px; margin: 0 0 4px; color: #e7d9ba; }
  .sg-note { margin: 0 0 8px; font-size: 12.5px; color: #b8ab92; }
  .sg-demo { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; padding: 16px; border-radius: 8px;
             background: #cfc7b4; border: 1px solid #8f846c; }
  .sg-refs { display: block; margin-top: 6px; font-size: 11.5px; color: #8fa06a; }
  .sg-cols { display: flex; gap: 32px; flex-wrap: wrap; width: 100%; color: #3b3022; font-size: 12px; }
  .sg-space { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .sg-space i { display: inline-block; height: 12px; background: #7a4c08; }
  .sg-color { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
  .sg-color i { display: inline-block; width: 18px; height: 18px; border-radius: 4px; border: 1px solid #8f846c; }
</style></head>
<body>
<div class="sg-head">
  <h1>Дизайн-система WFRP4e Paperdoll</h1>
  <p>Токены и базовые компоненты: styles/pd-system.css. Правила - в CLAUDE.md, раздел «Дизайн-система».
     Пересборка этой страницы: <code>npm run styleguide</code>.</p>
</div>
${body}
</body></html>`;

fs.writeFileSync(path.join(root, "docs/styleguide.html"), html);
console.log("docs/styleguide.html собран");
