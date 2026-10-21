/**
 * Диагностика магии для живого Foundry. Ничего не меняет - только печатает в консоль (F12).
 *
 * Как запустить: Foundry -> вкладка «Макросы» -> новый макрос типа «Script» -> вставить этот файл -> выполнить.
 * Выбери перед запуском токен жреца или мага (или просто открой лист - возьмём game.user.character).
 *
 * Зачем: исходников системы wfrp4e у модуля нет, поэтому форму данных (строки дальности, цели,
 * длительности и то, что возвращает setupPrayer / setupCast) нужно снять с живого мира.
 * Скопируй вывод целиком - по нему достраивается разбор дальностей в addons/magic/scripts/targeting.js
 */
(async () => {
  const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
  if (!actor) return ui.notifications.warn("Выбери токен или назначь себе персонажа");

  const dump = { система: game.system?.version, foundry: game.version, персонаж: actor.name };

  // 1. Что вообще лежит в молитвах и заклинаниях
  const say = (items) =>
    items.map((i) => ({
      name: i.name,
      type: i.type,
      подтип: i.system?.type?.value ?? i.system?.lore?.value ?? null,
      range: i.system?.range?.value ?? null,
      target: i.system?.target?.value ?? null,
      duration: i.system?.duration?.value ?? null,
      cn: i.system?.cn?.value ?? null
    }));
  dump.молитвы = say(actor.itemTypes.prayer ?? []);
  dump.заклинания = say(actor.itemTypes.spell ?? []);

  // 2. Все благословения из компендиумов - по ним строится разбор строк дальности
  const blessings = [];
  for (const pack of game.packs ?? []) {
    if (pack.documentName !== "Item") continue;
    const index = await pack.getIndex({ fields: ["type", "system.type.value", "system.range.value", "system.target.value", "system.duration.value"] });
    for (const e of index) {
      if (e.type !== "prayer") continue;
      blessings.push({
        pack: pack.collection,
        name: e.name,
        подтип: e.system?.type?.value ?? null,
        range: e.system?.range?.value ?? null,
        target: e.system?.target?.value ?? null,
        duration: e.system?.duration?.value ?? null
      });
    }
  }
  dump.благословенияИзКомпендиумов = blessings;

  // 3. Уникальные строки дальности и цели - самое ценное для разбора
  const uniq = (key) => [...new Set(blessings.map((b) => b[key]).filter(Boolean))];
  dump.уникальныеRange = uniq("range");
  dump.уникальныеTarget = uniq("target");
  dump.уникальныеDuration = uniq("duration");

  // 4. Какие методы каста вообще есть у актёра
  dump.методыАктёра = ["setupPrayer", "setupCast", "setupSkill", "setupCharacteristic", "addCondition", "removeCondition"]
    .filter((m) => typeof actor[m] === "function");

  // 5. Форма объекта теста - БЕЗ броска (setup только готовит тест)
  try {
    const prayer = (actor.itemTypes.prayer ?? [])[0];
    if (prayer && typeof actor.setupPrayer === "function") {
      const test = await actor.setupPrayer(prayer, { bypass: true, skipTargets: true });
      dump.тест = {
        ключи: Object.keys(test ?? {}),
        естьRoll: typeof test?.roll === "function",
        ключиResult: Object.keys(test?.result ?? {}),
        ключиData: Object.keys(test?.data ?? {}),
        preData: Object.keys(test?.preData ?? test?.data?.preData ?? {})
      };
    } else {
      dump.тест = "нет молитв у персонажа или нет метода setupPrayer";
    }
  } catch (err) {
    dump.тест = `setupPrayer бросил ошибку: ${err?.message}`;
  }

  // 6. Цели и измерение дистанции - на чём строится выбор целей
  dump.цели = {
    выбраноСейчас: [...(game.user.targets ?? [])].map((t) => t.name),
    естьMeasurePath: typeof canvas.grid?.measurePath === "function",
    естьMeasureDistance: typeof canvas.grid?.measureDistance === "function",
    единицаСцены: canvas.scene?.grid?.distance,
    размерКлетки: canvas.grid?.size
  };

  console.log("=== wfrp4e-paperdoll: диагностика магии ===");
  console.log(JSON.stringify(dump, null, 2));
  ui.notifications.info("Готово: открой консоль (F12) и скопируй вывод");
})();
