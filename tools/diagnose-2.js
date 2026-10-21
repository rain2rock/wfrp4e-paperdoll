/**
 * Второй прогон диагностики: всё, что модуль сейчас принимает на веру.
 * Только ЧТЕНИЕ - ничего не создаёт, не удаляет и не пишет в чат. Прав ГМ не требует.
 *
 * КАК ЗАПУСТИТЬ: выбери токен своего персонажа -> F12 -> вкладка Console -> вставить файл -> Enter.
 * Потом выполни там же:  copy(__pd2)  - весь вывод ляжет в буфер.
 *
 * Отвечает на вопросы (в порядке важности для модуля):
 *   1. Несут ли благословения и заклинания свои ActiveEffect - от этого зависит, появится ли бафф после каста.
 *   2. Какие бывают типы перекаста (overcast) - по ним строится UI распределения излишка УУ.
 *   3. Есть ли у заклинаний готовые геттеры Range/Target/Duration - можно ли выбросить ручной разбор строк.
 *   4. В каком виде система отдаёт дальность и урон ОРУЖИЯ - их читает подсказка оружия.
 *   5. Структура брони и характеристик цели - из них считается «урон по цели».
 *   6. Ключи состояний, мутаций и травм - ими наполняется меню «+» в окне группы.
 */
(async () => {
  const out = { система: game.system?.version, foundry: game.version };
  const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
  out.персонаж = actor?.name ?? "нет выбранного персонажа";

  const itemPacks = (game.packs ?? []).filter((p) => p.documentName === "Item");

  /* 1. Эффекты на благословениях и заклинаниях ------------------------------ */
  // Индекс эффекты не отдаёт, поэтому грузим небольшую выборку документов
  const sample = { prayer: [], spell: [] };
  for (const pack of itemPacks) {
    if (sample.prayer.length >= 6 && sample.spell.length >= 6) break;
    let index;
    try {
      index = await pack.getIndex({ fields: ["type", "system.type.value"] });
    } catch {
      continue;
    }
    for (const e of index) {
      const bucket = e.type === "prayer" ? sample.prayer : e.type === "spell" ? sample.spell : null;
      if (!bucket || bucket.length >= 6) continue;
      try {
        const doc = await pack.getDocument(e._id);
        bucket.push({
          pack: pack.collection,
          name: doc.name,
          подтип: doc.system?.type?.value ?? doc.system?.lore?.value ?? null,
          эффектов: doc.effects?.size ?? doc.effects?.length ?? 0,
          эффекты: [...(doc.effects ?? [])].map((fx) => ({
            name: fx.name,
            transfer: fx.transfer,
            изменений: fx.changes?.length ?? 0,
            changes: (fx.changes ?? []).slice(0, 4),
            statuses: [...(fx.statuses ?? [])],
            duration: fx.duration
          }))
        });
      } catch {
        /* пропускаем недоступное игроку */
      }
    }
  }
  out["1_эффектыНаМагии"] = sample;
  out["1_ВЫВОД"] = [...sample.prayer, ...sample.spell].some((s) => s.эффектов > 0)
    ? "ДА - магия несёт свои ActiveEffect, бафф должна вешать система"
    : "НЕТ (в выборке) - эффектов на предметах нет, баффы наверняка вешаются другим способом";

  /* 2. Перекаст: какие бывают типы ------------------------------------------ */
  const oc = [];
  for (const pack of itemPacks) {
    try {
      const index = await pack.getIndex({
        fields: ["type", "system.overcast.enabled", "system.overcast.label", "system.overcast.valuePerOvercast.type"]
      });
      for (const e of index) {
        if (e.type !== "spell" || e.system?.overcast?.enabled !== true) continue;
        oc.push({ name: e.name, label: e.system?.overcast?.label ?? null, type: e.system?.overcast?.valuePerOvercast?.type ?? null });
      }
    } catch {
      /* пропускаем */
    }
  }
  out["2_перекастВсего"] = oc.length;
  out["2_типыПерекаста"] = [...new Set(oc.map((o) => o.type).filter(Boolean))].sort();
  out["2_ярлыкиПерекаста"] = [...new Set(oc.map((o) => o.label).filter(Boolean))].sort().slice(0, 30);
  out["2_примеры"] = oc.slice(0, 10);

  /* 3. Готовые геттеры у магии ---------------------------------------------- */
  try {
    const pack = itemPacks.find((p) => p.index?.some?.((e) => e.type === "spell")) ?? itemPacks[0];
    const idx = (await pack.getIndex({ fields: ["type"] })).find((e) => e.type === "spell");
    if (idx) {
      const live = await pack.getDocument(idx._id);
      out["3_геттерыМагии"] = {
        name: live.name,
        "range.value": live.system?.range?.value ?? null,
        Range: live.system?.Range ?? null,
        Target: live.system?.Target ?? null,
        Duration: live.system?.Duration ?? null,
        Damage: live.system?.Damage ?? null,
        "ключи с заглавной": Object.keys(live.system ?? {}).filter((k) => /^[A-Z]/.test(k))
      };
      out["3_ВЫВОД"] = live.system?.Range != null || live.system?.Duration != null
        ? "ДА - есть готовые значения, ручной разбор строк можно урезать"
        : "НЕТ - готовых полей у магии нет, разбор строк нужен";
    }
  } catch (err) {
    out["3_геттерыМагии"] = `не вышло: ${err?.message}`;
  }

  /* 4. Оружие: в каком виде дальность и урон -------------------------------- */
  out["4_оружиеПерсонажа"] = (actor?.itemTypes?.weapon ?? []).map((w) => ({
    name: w.name,
    "range.value": w.system?.range?.value ?? null,
    Range: w.system?.Range ?? null,
    типRange: typeof w.system?.Range,
    "damage.value": w.system?.damage?.value ?? null,
    Damage: w.system?.Damage ?? null,
    типDamage: typeof w.system?.Damage,
    isRanged: w.system?.isRanged ?? null,
    Reach: w.system?.Reach ?? null,
    weaponGroup: w.system?.weaponGroup?.value ?? null
  }));

  /* 5. Цель: броня и характеристики ----------------------------------------- */
  const target = [...(game.user?.targets ?? [])][0];
  out["5_цель"] = target?.actor
    ? {
        name: target.name,
        "status.armour": target.actor.system?.status?.armour ?? null,
        "t.bonus": target.actor.system?.characteristics?.t?.bonus ?? null,
        "wounds": target.actor.system?.status?.wounds ?? null,
        size: target.actor.system?.details?.size?.value ?? null
      }
    : "цель не выбрана - выбери врага на карте и прогони ещё раз, это нужно для «урона по цели»";

  /* 6. Состояния, мутации, травмы ------------------------------------------- */
  out["6_состоянияКонфиг"] = Object.keys(game.wfrp4e?.config?.conditions ?? {});
  const byType = {};
  for (const pack of itemPacks) {
    try {
      const index = await pack.getIndex({ fields: ["type"] });
      for (const e of index) byType[e.type] = (byType[e.type] ?? 0) + 1;
    } catch {
      /* пропускаем */
    }
  }
  out["6_предметовПоТипам"] = byType;

  /* 7. Методы системы, на которые мы опираемся ------------------------------ */
  out["7_методы"] = {
    актёр: ["setupCast", "setupPrayer", "setupWeapon", "setupSkill", "addCondition", "removeCondition", "applyDamage", "applyEffect"]
      .filter((m) => typeof actor?.[m] === "function"),
    "game.wfrp4e": Object.keys(game.wfrp4e ?? {}).slice(0, 40)
  };

  window.__pd2 = out;
  console.log("=== wfrp4e-paperdoll: диагностика 2 ===");
  console.log(JSON.stringify(out, null, 2));
  console.log("Скопировать всё:  copy(__pd2)");
  ui.notifications.info("Готово: в консоли выполни copy(__pd2)");
})();
