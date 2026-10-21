/**
 * Четвёртый прогон. Главный вопрос: КАКИЕ МОДИФИКАТОРЫ СИСТЕМА СЧИТАЕТ САМА.
 *
 * Это разом закрывает три пункта из списка правок (окружение, размер цели, преимущество):
 * если система их уже применяет, нам их считать НЕЛЬЗЯ - сложится дважды. Тогда наша задача
 * только показать число, которое она и так подставит.
 *
 * ПОДГОТОВКА (важно, иначе половина проверок пустая):
 *   1. Выбери свой токен (клик по нему).
 *   2. Возьми врага В ЦЕЛЬ: наведи на него и нажми T (или ПКМ -> иконка прицела).
 *      Выделить и взять в цель - РАЗНЫЕ вещи, нужна именно цель.
 *   3. Хорошо, если рядом стоят несколько врагов - тогда увидим, считает ли система окружение.
 *
 * Запуск: F12 -> Console -> вставить -> Enter. Затем  copy(__pd4)
 *
 * Откроется окно броска - НЕ бросай, просто посмотри и нажми «Отмена»:
 * нам нужны подставленные модификаторы, а не результат. Если всё же бросишь - тоже сойдёт.
 */
(async () => {
  const ТРОГАТЬ_СОСТОЯНИЯ = true; // добавит и сразу уберёт тестовое состояние на своём персонаже

  const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
  if (!actor) return ui.notifications.warn("Выбери свой токен");
  const out = { система: game.system?.version, персонаж: actor.name };

  /* 1. Обстановка: кто рядом, кто в цели ------------------------------------ */
  const me = canvas.tokens.placeables.find((t) => t.actor?.id === actor.id);
  const target = [...(game.user?.targets ?? [])][0];
  const dist = (t) => {
    try {
      return Math.round(canvas.grid.measurePath([me.center ?? me, t.center ?? t]).distance);
    } catch {
      return null;
    }
  };
  out["1_обстановка"] = {
    мойТокен: me?.name ?? "НЕ НАЙДЕН - выбери свой токен",
    цель: target?.name ?? "ЦЕЛЬ НЕ ВЫБРАНА - нажми T на враге, иначе проверка ниже бессмысленна",
    размерЦели: target?.actor?.system?.details?.size?.value ?? null,
    дистанцияДоЦели: me && target ? dist(target) : null,
    ктоРядом: me
      ? canvas.tokens.placeables
          .filter((t) => t !== me && t.actor)
          .map((t) => ({ имя: t.name, дистанция: dist(t) }))
          .filter((t) => t.дистанция !== null && t.дистанция <= 5)
      : [],
    моёПреимущество: actor.system?.status?.advantage?.value ?? null
  };

  /* 2. Оружие и кулаки ------------------------------------------------------ */
  const weapons = actor.itemTypes.weapon ?? [];
  out["2_оружие"] = weapons.map((w) => ({
    name: w.name,
    equipped: w.system?.isEquipped ?? null,
    Damage: w.system?.Damage ?? null,
    Range: w.system?.Range ?? null,
    isRanged: w.system?.isRanged ?? null,
    skillToUse: w.system?.skillToUse?.name ?? null
  }));
  // Чем система считает удар без оружия: есть ли у неё свой «кулак»
  out["2_безОружия"] = {
    "game.wfrp4e.config.systemItems": Object.keys(game.wfrp4e?.config?.systemItems ?? {}),
    unarmedВКонфиге: game.wfrp4e?.config?.systemItems?.unarmed ?? null,
    навыкBrawling: (actor.itemTypes.skill ?? []).find((s) => /brawling|драк/i.test(s.name))?.system?.total?.value ?? null
  };

  window.__pd4 = out;
  console.log("=== диагностика 4 (часть 1) ===");
  console.log(JSON.stringify(out, null, 2));

  /* 3. ГЛАВНОЕ: что система подставит в бросок атаки ------------------------- */
  try {
    const w = weapons.find((x) => x.system?.isEquipped) ?? weapons[0];
    if (!w) {
      out["3_бросок"] = "нет оружия у персонажа";
    } else if (typeof actor.setupWeapon !== "function") {
      out["3_бросок"] = "нет метода setupWeapon";
    } else {
      console.log(`Открываю окно броска «${w.name}» - посмотри модификаторы и нажми Отмена...`);
      const test = await actor.setupWeapon(w);
      const pre = test?.preData ?? test?.data?.preData ?? {};
      out["3_бросок"] = {
        оружие: w.name,
        // Вот ради чего всё: что система насчитала САМА
        modifier: pre.modifier ?? null,
        successBonus: pre.successBonus ?? null,
        slBonus: pre.slBonus ?? null,
        target: test?.result?.target ?? null,
        ключиPreData: Object.keys(pre),
        ключиResult: Object.keys(test?.result ?? {}),
        // Иногда система складывает модификаторы списком - забираем, если есть
        modifiers: pre.modifiers ?? test?.result?.modifiers ?? null,
        other: pre.other ?? null
      };
    }
  } catch (err) {
    out["3_бросок"] = `прервано или ошибка: ${err?.message}`;
  }

  /* 4. Принимает ли addCondition количество --------------------------------- */
  if (ТРОГАТЬ_СОСТОЯНИЯ) {
    try {
      const key = "bleeding";
      const before = actor.effects.find((e) => e.statuses?.has?.(key))?.conditionValue ?? null;
      await actor.addCondition(key, 3);
      const after = actor.effects.find((e) => e.statuses?.has?.(key))?.conditionValue ?? null;
      out["4_addCondition"] = {
        былоДо: before,
        послеЗапроса3: after,
        вывод: after === 3 || (before !== null && after === before + 3)
          ? "ПРИНИМАЕТ количество - можно выдавать несколько уровней одним вызовом"
          : `НЕ принимает (стало ${after}) - придётся звать по разу`
      };
      // Прибираем за собой: возвращаем как было
      await actor.removeCondition(key, (after ?? 0) - (before ?? 0));
      out["4_addCondition"].послеУборки = actor.effects.find((e) => e.statuses?.has?.(key))?.conditionValue ?? null;
    } catch (err) {
      out["4_addCondition"] = `ошибка: ${err?.message}`;
    }
  }

  window.__pd4 = out;
  console.log("=== диагностика 4 (полностью) ===");
  console.log(JSON.stringify(out, null, 2));
  console.log("Скопировать:  copy(__pd4)");
  ui.notifications.info("Готово: выполни copy(__pd4)");
})();
