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

  // 2. Молитвы и заклинания из компендиумов - по ним строится разбор строк дальности
  const found = [];
  for (const pack of game.packs ?? []) {
    if (pack.documentName !== "Item") continue;
    const index = await pack.getIndex({
      fields: [
        "type", "system.type.value", "system.lore.value", "system.cn.value",
        "system.range.value", "system.target.value", "system.duration.value", "system.damage.value"
      ]
    });
    for (const e of index) {
      if (e.type !== "prayer" && e.type !== "spell") continue;
      found.push({
        pack: pack.collection,
        тип: e.type,
        name: e.name,
        подтип: e.system?.type?.value ?? e.system?.lore?.value ?? null,
        cn: e.system?.cn?.value ?? null,
        range: e.system?.range?.value ?? null,
        target: e.system?.target?.value ?? null,
        duration: e.system?.duration?.value ?? null,
        damage: e.system?.damage?.value ?? null
      });
    }
  }
  dump.найденоВКомпендиумах = { молитв: found.filter((f) => f.тип === "prayer").length, заклинаний: found.filter((f) => f.тип === "spell").length };
  dump.примеры = found.slice(0, 40);

  // 3. Уникальные строки - самое ценное: по ним дорабатывается разбор дальностей
  const uniq = (key, type) => [...new Set(found.filter((f) => !type || f.тип === type).map((b) => b[key]).filter(Boolean))].sort();
  dump.уникальныеRange = uniq("range");
  dump.уникальныеTarget = uniq("target");
  dump.уникальныеDuration = uniq("duration");
  dump.уникальныеDamage = uniq("damage", "spell");

  // 3a. ГЛАВНОЕ: есть ли у заклинаний готовые вычисленные поля (как Damage/Range у оружия).
  // Если да - разбирать строки вручную не нужно, модуль возьмёт готовое.
  const computed = (actor.itemTypes.spell ?? []).concat(actor.itemTypes.prayer ?? []).map((i) => ({
    name: i.name,
    "сырой range": i.system?.range?.value ?? null,
    "вычисленный Range": i.system?.Range ?? null,
    "сырой target": i.system?.target?.value ?? null,
    "вычисленный Target": i.system?.Target ?? null,
    "сырой duration": i.system?.duration?.value ?? null,
    "вычисленный Duration": i.system?.Duration ?? null,
    "вычисленный Damage": i.system?.Damage ?? null
  }));
  dump.сыроеПротивВычисленного = computed;
  dump.ВЫВОД_естьЛиГотовыеПоля = computed.some((c) => c["вычисленный Range"] !== null || c["вычисленный Duration"] !== null)
    ? "ДА - модуль должен брать готовое, ручной разбор строк не нужен"
    : "НЕТ - остаётся ручной разбор строк (или поля зовутся иначе, смотри образецЗаклинания ниже)";

  // 3b. Полная структура одного заклинания: нужны точные имена полей ингредиента и перекаста
  try {
    const anySpell = found.find((f) => f.тип === "spell");
    if (anySpell) {
      const pack = game.packs.get(anySpell.pack);
      const idx = (await pack.getIndex()).find((e) => e.name === anySpell.name);
      const doc = await pack.getDocument(idx._id);
      dump.образецЗаклинания = { name: doc.name, system: doc.toObject().system };
    }
  } catch (err) {
    dump.образецЗаклинания = `не вышло: ${err?.message}`;
  }

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
