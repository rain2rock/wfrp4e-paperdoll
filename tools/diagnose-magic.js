/**
 * Диагностика магии для живого Foundry. Ничего не меняет и не пишет в чат - только печатает в консоль.
 * Прав ГМ не требует: всё читается с собственного персонажа и из открытых игроку компендиумов.
 *
 * КАК ЗАПУСТИТЬ ИГРОКУ (прав на макросы не нужно):
 *   1. В окне Foundry нажми F12 - откроется консоль браузера, вкладка Console.
 *   2. Вставь туда весь этот файл и нажми Enter.
 *   3. Выполни в той же консоли:  copy(__pdDump)  - весь вывод ляжет в буфер обмена.
 * Можно и макросом типа «Script», если ГМ разрешил их игрокам - результат тот же.
 *
 * Перед запуском выбери токен своего мага или жреца (или просто имей назначенного персонажа).
 *
 * ПРОБА КАСТА включена: она дёргает setupPrayer, чтобы увидеть форму объекта теста.
 * У некоторых версий это открывает окно броска и может оставить след в чате - за столом это увидят.
 * Если нужно тихо, поставь false в строке ПРОБНЫЙ_КАСТ ниже.
 */
(async () => {
  const ПРОБНЫЙ_КАСТ = true;

  const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
  if (!actor) return ui.notifications.warn("Выбери токен своего персонажа или назначь себе персонажа");
  if (!actor.isOwner) return ui.notifications.warn("Это не твой персонаж - выбери своего");

  const dump = {
    система: game.system?.version,
    foundry: game.version,
    персонаж: actor.name,
    ярольГМ: game.user?.isGM === true,
    компендиумовВидно: (game.packs ?? []).filter((p) => p.documentName === "Item").length
  };

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
  // Берём ЖИВОЙ документ из компендиума (не toObject - он срезает геттеры) и смотрим на нём.
  // Так ответ получится, даже если у персонажа нет ни одного заклинания.
  try {
    const anySpell = found.find((f) => f.тип === "spell") ?? found[0];
    if (anySpell) {
      const pack = game.packs.get(anySpell.pack);
      const idx = (await pack.getIndex()).find((e) => e.name === anySpell.name);
      const live = await pack.getDocument(idx._id);
      dump.геттерыНаЖивомДокументе = {
        name: live.name,
        "system.range.value": live.system?.range?.value ?? null,
        "system.Range": live.system?.Range ?? null,
        "system.Target": live.system?.Target ?? null,
        "system.Duration": live.system?.Duration ?? null,
        "system.Damage": live.system?.Damage ?? null,
        "все ключи system": Object.keys(live.system ?? {}),
        "ключи с заглавной": Object.keys(live.system ?? {}).filter((k) => /^[A-Z]/.test(k))
      };
    }
  } catch (err) {
    dump.геттерыНаЖивомДокументе = `не вышло: ${err?.message}`;
  }

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
  // Вывод делаем ТОЛЬКО если было на чём проверять: у персонажа без заклинаний пустой список
  // не значит «геттеров нет» - он значит «не проверяли». Смотрим и на живой документ из компендиума.
  const live = dump.геттерыНаЖивомДокументе;
  const liveHas = live && typeof live === "object" && (live["system.Range"] !== null || live["system.Duration"] !== null);
  dump.ВЫВОД_естьЛиГотовыеПоля = computed.length === 0 && !liveHas && typeof live !== "object"
    ? "НЕ ПРОВЕРЕНО - у персонажа нет заклинаний и живой документ не открылся"
    : computed.some((c) => c["вычисленный Range"] !== null || c["вычисленный Duration"] !== null) || liveHas
      ? "ДА - модуль должен брать готовое, ручной разбор строк не нужен"
      : "НЕТ - готовых полей нет, нужен ручной разбор строк (смотри «ключи с заглавной» выше)";

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
    const prayer = (actor.itemTypes.prayer ?? [])[0] ?? (actor.itemTypes.spell ?? [])[0];
    const setup = prayer?.type === "spell" ? actor.setupCast : actor.setupPrayer;
    if (!ПРОБНЫЙ_КАСТ) {
      dump.тест = "проба каста выключена флагом ПРОБНЫЙ_КАСТ";
    } else if (prayer && typeof setup === "function") {
      const test = await setup.call(actor, prayer, { bypass: true, skipTargets: true });
      dump.тест = {
        ключи: Object.keys(test ?? {}),
        естьRoll: typeof test?.roll === "function",
        ключиResult: Object.keys(test?.result ?? {}),
        ключиData: Object.keys(test?.data ?? {}),
        preData: Object.keys(test?.preData ?? test?.data?.preData ?? {})
      };
    } else {
      dump.тест = "нет молитв и заклинаний у персонажа, либо нет метода setupPrayer/setupCast";
    }
  } catch (err) {
    dump.тест = `setup бросил ошибку: ${err?.message}`;
  }

  // 6. Цели и измерение дистанции - на чём строится выбор целей
  dump.цели = {
    выбраноСейчас: [...(game.user.targets ?? [])].map((t) => t.name),
    естьMeasurePath: typeof canvas.grid?.measurePath === "function",
    естьMeasureDistance: typeof canvas.grid?.measureDistance === "function",
    единицаСцены: canvas.scene?.grid?.distance,
    размерКлетки: canvas.grid?.size
  };

  window.__pdDump = dump;
  console.log("=== wfrp4e-paperdoll: диагностика магии ===");
  console.log(JSON.stringify(dump, null, 2));
  console.log("Чтобы скопировать всё в буфер, выполни в консоли:  copy(__pdDump)");
  ui.notifications.info("Готово: в консоли (F12) выполни copy(__pdDump) и пришли результат");
})();
