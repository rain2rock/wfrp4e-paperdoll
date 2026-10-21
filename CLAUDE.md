# WFRP4e Paperdoll - контекст для Claude Code

Модуль Foundry VTT (V13/V14) для системы WFRP4e (9.x): окно снаряжения в стиле WoW - «куколка» со слотами,
сумки, статы, лента эффектов, броски, прокачка. Автор - Михаил (rain2rock). Модуль продаётся: ядро платное (~$5),
каждое дополнение платное отдельно. Ядро обязано работать без любого дополнения.

## Как общаться

- Русский язык, дружелюбно, «бро», мужской род. Кратко. Перед работой уточнять недостающее.
- Только дефис «-», никогда длинное тире «—». Кавычки русские «...».
- Сначала показать результат (скриншот мока), если просят «покажи».

## Гит - строгие правила

- Ничего не коммитить и не пушить, пока Михаил не скажет «заливай» (или «отправляй в гит»).
- Не копить коммиты по одному: по «заливай» - ВСЁ одним коммитом.
- Сообщение коммита максимально короткое (`v0.41.0: <что>`), минимум токенов на гит.
- Перед пушем поднять версию в `module.json` (пуш в main с новой версией запускает релиз).
- Никогда не коммитить платные иконки wfrp4e-core и Foundry, `tools/snapshot*.json`.
  Свою графику (`assets/icons`, `assets/ui`) - можно.

## Релиз

`.github/workflows/release.yml`: при пуше в main с изменённым `module.json` создаётся релиз `vX.Y.Z`:
- ядро: `module.json` + `module.zip`;
- каждое дополнение из `addons/<id>`: `wfrp4e-paperdoll-<id>.json` + `.zip`, версия = версия ядра (проставляет jq).

Manifest URL ядра: `https://github.com/rain2rock/wfrp4e-paperdoll/releases/latest/download/module.json`,
дополнений: `.../releases/latest/download/wfrp4e-paperdoll-<id>.json`.

## Структура

- `scripts/paperdoll-app.js` - ядро (~4000 строк): `PaperdollApp` (ApplicationV2 + Handlebars), `PaperdollTooltip`,
  утилиты, реестр дополнений `ADDONS`, `PD_UTIL`, `PD_API`, опции `PD_OPTIONS`.
  Звуки синтезируются через Web Audio, без файлов: `playCoinSound(gain)` - монеты, `playGearSound("equip"|"unequip"|"move")` -
  надеть / снять / переложить. Оба слушают опцию `sounds` и громкость интерфейса Foundry, доступны дополнениям через `PD_UTIL`.
- `scripts/main.js` - init: настройки (все `config:false`), меню настроек, `Hooks.callAll("wfrp4e-paperdoll.init", PD_API)`, клавиша.
- `scripts/settings-menu.js` - окно настроек по вкладкам: категории ядра + вкладка на каждое дополнение.
- `scripts/translate.js`, `scripts/glossary-ru.js` - перевод терминов и описаний. `icon-index.js`, `icon-rules.js` - подбор иконок.
- `templates/paperdoll.hbs`, `styles/paperdoll.css`, `lang/ru.json`, `lang/en.json`.
- `addons/<id>/` - дополнения, каждое отдельный модуль Foundry: `module.json`, `scripts/`, `lang/`, `styles/`.
  Манифест генерирует `python3 tools/make-addon-manifest.py <id> "<title>" "<desc>" [socket]`.

## Дополнения

| id | Что | Хуки/методы |
|---|---|---|
| magic | вкладка «Магия», каст по клику, штраф брони к касту | tabs, statSets, restrictions |
| injuries | травмы конечностей, протезы | mixin `_limbState/_injuryLimb/_maimView`, `prostheticKind`, restrictions |
| mutations | мутации в ленте эффектов, лишние руки/головы | mixin `_extraSlots`, effects, effectClick |
| progression | «+» за опыт, дерево, вехи карьеры, покупка талантов | mixin `_advInfo/_advance/_advanceTree/_milestones/_careerCategory/_talentOffers/_buyTalent`, onRender |
| party | передача вещей на токен, общий сундук, окно группы для ГМ (раны/удача/броня/золото/эффекты кликабельно как в карточке, карточки или таблица, казна группы), «Начало сессии», «+» у ленты - поиск и выдача состояния, а также мутации и травмы из компендиумов, если стоят дополнения mutations / injuries | bagToolbar, onRender, externalDrop, socket, keybinding `openGroup` (ГМ, по умолчанию G), `api.openStash`, `api.openGroup` |

### API дополнений

Скрипт дополнения - IIFE:
```js
if (globalThis.__PD_MOCK__) register(globalThis.__PD_API__);
else Hooks.once("wfrp4e-paperdoll.init", register);
```
- `api.registerAddon({ id, title, intro, icon, settings, tabs, ...hooks })` - регистрирует и настройки (в неймспейсе ядра,
  `config:false`; boolean-дефолты попадают в `PD_OPTIONS`). Настройка: `{ key, default, type?, scope?, choices?, actorSelect? }`.
- `api.mixin(Class)` - копирует методы класса в `PaperdollApp.prototype` (переопределяет дефолты ядра).
- `api.util` = `PD_UTIL` (esc, safe, T, norm, option, itemImg, uiArt, LIMB_LOCS, EXTRA_HANDS, ...).
- Хуки: `tabs[{id,label,icon,visible(app),render(app),onRender(app,el)}]`, `statSets(app, sets, {row, profile})`,
  `restrictions(app, item, slot, out{forbid,warn,score}, profile)`, `bagToolbar(app) -> html`, `onRender(app, root)`,
  `externalDrop(app, item, data) -> bool`, `effects(app, out)`, `effectClick(app, entry, ev) -> bool`.
- В ядре дефолты «без дополнения»: конечности целы, лишних слотов нет, `_advInfo()` = null, нет дерева и вех.
- Ассеты ядра из CSS дополнения: `url("../../wfrp4e-paperdoll/assets/...")`.

## Мок и проверки

Мок - настоящий код модуля поверх заглушки Foundry (`tools/mock-runtime.js`), один html-файл.
```bash
npm install
npm run mock                                              # docs/paperdoll-mock.html
node tools/build-mock.mjs --cast --out mock-all.html      # переключатель персонажей (Хьюго, Гюнтер)
node tools/build-mock.mjs --cast --addons none --out mock-core.html   # только ядро; all | magic,party
tools/qa/run-all.sh                                       # всё сразу: с дополнениями и без
```
Проверки в `tools/qa/` (нужен playwright: `npm i -D playwright && npx playwright install chromium`):
- `qa.mjs <mock>` - слоты, фильтры, сортировка, перетаскивание (~100 проверок, все должны быть PASS);
- `addchk.mjs <mock>` - вкладки, травмы, лишние слоты, прокачка по персонажам;
- `mutchk.mjs`, `progchk.mjs` - мутации и прокачка; `partychk.mjs` - окно группы и «Начало сессии»;
  `sfxchk.mjs` - звуки (надеть/снять/переложить/монеты) через перехват Web Audio; `smoke.mjs` - импорт main.js и окно настроек.
Тестовые персонажи (`tools/mock-data.mjs`): «Хьюго» - основной, для общих проверок; «Гюнтер» (--cast) - минимум вещей и много свободного опыта специально для прокачки/покупки талантов.
Скриншоты для себя - через playwright (`page.screenshot`), Михаил смотрит мок в браузере.

## Правила игры (WFRP4e), которые уже зашиты

- Отдых: Стойкость (Endurance) +20 раз в день, лечит БВ + УУ ран, день полного покоя - ещё +БВ.
- Талант: 100 опыта + 100 за каждый взятый уровень, только таланты текущей ступени карьеры.
- Без оружия: СБ+0, Undamaging, навык Brawling. Resilience = «Упорство», Endurance = «Стойкость».
- Скрытность и наблюдательность - не защита: показываются в «Тело»/«Разум» и только если не ноль.

## Отложено / идеи

- Иконки «по названию» (папка by-name) - ждут иконки от Михаила из Figma.
- Полоса нагрузки шире и правки полосы удачи - одной правкой, когда будут иконки.
- Диагностический макрос для настоящего Foundry.
- Окно настроек, сокеты, сундук, dropCanvasData проверены только в моке - проверить в живом Foundry.
- Окно группы: кнопка «+» зовёт `actor.addCondition(key, value)`, а если метода нет - сама создаёт ActiveEffect со `statuses`.
  Какой путь сработает в живой системе, без настоящего Foundry не проверить (в моке - своя заглушка), но молча не делать ничего кнопка уже не может.
- Мутации и травмы в меню «+» берутся из компендиумов предметов по `type`. В моке компендиум поддельный (`tools/mock-runtime.js`),
  в живом Foundry состав зависит от установленных модулей с контентом.
- Сокеты: Foundry не подписывает module-сокеты, поэтому ГМ проверяет права по `userId` из payload (его теоретически можно подделать).
  Полная защита невозможна в принципе - рассчитываем на доверенный состав стола.
- Дополнение `party` разрослось (~800 строк, три фичи). Разбить на файлы мешает сборка: в Foundry скрипты дополнения -
  отдельные ES-модули без общей области видимости, а мок их просто склеивает. Нужен либо общий неймспейс, либо сборка с импортами.
- Идеи: смена карьеры, наборы снаряжения.
