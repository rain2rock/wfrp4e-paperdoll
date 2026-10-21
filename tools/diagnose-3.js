/**
 * Третий прогон: теперь у персонажа ЕСТЬ заклинания и благословение - можно закрыть главный вопрос.
 *
 * Запуск: выбери токен своего персонажа -> F12 -> Console -> вставить -> Enter -> затем  copy(__pd3)
 *
 * Отвечает:
 *   1. Считаются ли геттеры Range/Target/Duration/Damage на СВОЁМ заклинании (у предмета из компендиума
 *      владельца нет, и они отдавали 0 - это не «ноль ярдов», а «не посчитано»). Если на своём считаются,
 *      ручной разбор строк можно сильно урезать.
 *   2. Полную структуру своего заклинания и благословения - сверить поля ingredients / overcast / cn.
 *   3. Броню и стойкость всех токенов на сцене - из них считается «урон по цели». Цель выбирать НЕ нужно.
 *
 * Всё только читает. Проба каста вынесена в конец отдельно и НЕ мешает выводу: см. __pd3cast.
 */
(async () => {
  const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
  if (!actor) return ui.notifications.warn("Выбери токен своего персонажа");

  const out = { система: game.system?.version, foundry: game.version, персонаж: actor.name };

  /* 1. ГЛАВНОЕ: геттеры на СВОИХ заклинаниях и молитвах ---------------------- */
  const mine = [...(actor.itemTypes.spell ?? []), ...(actor.itemTypes.prayer ?? [])];
  out["1_своейМагии"] = mine.length;
  out["1_сыроеПротивВычисленного"] = mine.map((i) => ({
    name: i.name,
    тип: i.type,
    "range.value": i.system?.range?.value ?? null,
    Range: i.system?.Range ?? null,
    типRange: typeof i.system?.Range,
    "target.value": i.system?.target?.value ?? null,
    Target: i.system?.Target ?? null,
    "duration.value": i.system?.duration?.value ?? null,
    Duration: i.system?.Duration ?? null,
    "damage.value": i.system?.damage?.value ?? null,
    Damage: i.system?.Damage ?? null,
    "cn.value": i.system?.cn?.value ?? null
  }));
  // Геттер полезен, если ОТЛИЧАЕТСЯ от сырой строки и при этом осмысленный.
  // Он бывает и числом, и УЖЕ ПОСЧИТАННОЙ СТРОКОЙ («Willpower yards» -> «40 yards») - проверяем оба вида
  const meaningful = (v) => (typeof v === "number" ? v > 0 : typeof v === "string" && v.trim() !== "");
  const useful = out["1_сыроеПротивВычисленного"].some(
    (r) => (meaningful(r.Range) && String(r.Range) !== String(r["range.value"])) ||
           (meaningful(r.Damage) && String(r.Damage) !== String(r["damage.value"]))
  );
  out["1_ВЫВОД"] = !mine.length
    ? "НЕ ПРОВЕРЕНО - у персонажа нет ни заклинаний, ни молитв"
    : useful
      ? "ДА - на своём предмете геттеры считают реальные числа, можно опираться на них"
      : "НЕТ - геттеры и на своём предмете бесполезны (нули или копия строки), разбор строк нужен";

  /* 2. Полная структура своего заклинания и благословения -------------------- */
  const spell = (actor.itemTypes.spell ?? [])[0];
  const prayer = (actor.itemTypes.prayer ?? [])[0];
  out["2_своёЗаклинание"] = spell ? { name: spell.name, system: spell.toObject().system } : "нет заклинаний";
  out["2_своёБлагословение"] = prayer ? { name: prayer.name, system: prayer.toObject().system } : "нет молитв";
  // Эффекты на своих предметах: именно они должны повесить бафф после успешного каста
  out["2_эффектыНаСвоих"] = mine.map((i) => ({
    name: i.name,
    эффектов: i.effects?.size ?? i.effects?.length ?? 0,
    эффекты: [...(i.effects ?? [])].map((fx) => ({
      name: fx.name,
      transfer: fx.transfer,
      disabled: fx.disabled,
      statuses: [...(fx.statuses ?? [])],
      changes: fx.changes ?? []
    }))
  }));

  /* 3. Токены на сцене: броня и стойкость (цель выбирать не нужно) ----------- */
  out["3_токеныНаСцене"] = (canvas.tokens?.placeables ?? []).slice(0, 8).map((t) => ({
    имя: t.name,
    свой: !!t.actor?.isOwner,
    броня: t.actor?.system?.status?.armour ?? null,
    "t.bonus": t.actor?.system?.characteristics?.t?.bonus ?? null,
    раны: t.actor?.system?.status?.wounds ?? null,
    размер: t.actor?.system?.details?.size?.value ?? null
  }));

  /* 4. Моё оружие: в каком виде дальность и урон ----------------------------- */
  out["4_моёОружие"] = (actor.itemTypes.weapon ?? []).map((w) => ({
    name: w.name,
    "range.value": w.system?.range?.value ?? null,
    Range: w.system?.Range ?? null,
    Damage: w.system?.Damage ?? null,
    isRanged: w.system?.isRanged ?? null
  }));

  window.__pd3 = out;
  console.log("=== wfrp4e-paperdoll: диагностика 3 ===");
  console.log(JSON.stringify(out, null, 2));
  console.log("Скопировать:  copy(__pd3)");
  ui.notifications.info("Готово: выполни copy(__pd3)");

  /* 5. Проба каста - ПОСЛЕДНЕЙ, чтобы окно броска не помешало выводу выше ----- */
  // Откроется окно броска: нажми «Бросок» или «Отмена» - результат ляжет в __pd3cast.
  try {
    const it = prayer ?? spell;
    if (!it) return;
    const setup = it.type === "spell" ? actor.setupCast : actor.setupPrayer;
    if (typeof setup !== "function") return;
    console.log(`Проба каста «${it.name}» - в окне броска нажми любую кнопку...`);
    const test = await setup.call(actor, it);
    const cast = {
      предмет: it.name,
      ключиТеста: Object.keys(test ?? {}),
      естьRoll: typeof test?.roll === "function",
      ключиResult: Object.keys(test?.result ?? {}),
      ключиPreData: Object.keys(test?.preData ?? test?.data?.preData ?? {}),
      // Самое важное: какие модификаторы система подставила САМА.
      // Если она уже учитывает дальность, наш «+20 в упор» в бросок передавать нельзя - удвоится
      модификаторы: {
        modifier: test?.preData?.modifier ?? test?.data?.preData?.modifier ?? null,
        successBonus: test?.preData?.successBonus ?? test?.data?.preData?.successBonus ?? null,
        slBonus: test?.preData?.slBonus ?? test?.data?.preData?.slBonus ?? null,
        target: test?.result?.target ?? null
      }
    };
    window.__pd3cast = cast;
    console.log("=== проба каста ===");
    console.log(JSON.stringify(cast, null, 2));
    console.log("Скопировать:  copy(__pd3cast)");
  } catch (err) {
    window.__pd3cast = `каст прерван или упал: ${err?.message}`;
    console.log("Проба каста:", window.__pd3cast);
  }
})();
