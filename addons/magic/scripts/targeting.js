/**
 * Выбор целей для магии: разбор дальности и цели из полей системы, кто попадает в радиус, подсветка и таргет.
 *
 * Зачем отдельный слой: сам бросок, УУ, ЧС и применение эффектов делает система wfrp4e
 * (окно модификаторов открывает actor.setupCast / actor.setupPrayer). Система знает дальность строкой,
 * но не сопоставляет её с положением токенов - этим и занимается этот файл.
 *
 * Сначала берём ГОТОВЫЕ значения системы (геттеры Range/Target/Duration/Damage с заглавной буквы -
 * тот же приём, что у оружия): там дальности уже посчитаны по правилам школы. Свой разбор строк - запасной путь.
 *
 * ВАЖНО: наличие этих геттеров у заклинаний на живой системе не подтверждено (её исходников в репозитории нет),
 * как и имена полей ингредиента и перекаста. Разбор намеренно терпимый: что не распознали -
 * «нужна ручная цель», а не падение. Сверяет макрос tools/diagnose-magic.js (пункт «сыроеПротивВычисленного»).
 */
(() => {
  if (typeof globalThis.__PD_MAGIC_TARGETING__ !== "undefined") return;

  /** Кого просит заклинание или молитва: себя, касание, площадь или цель на расстоянии */
  const TARGET_KIND = { SELF: "self", TOUCH: "touch", RANGED: "ranged", AREA: "area", NONE: "none" };

  /** Бонус характеристики персонажа (СВ, С и т. п.) - в дальностях WFRP4e они встречаются постоянно */
  function charBonus(actor, key) {
    const c = actor?.system?.characteristics?.[key] ?? {};
    return Number(c.bonus ?? Math.floor((Number(c.value) || 0) / 10)) || 0;
  }

  /**
   * Строка дальности или цели -> ярды. Понимает число («20»), бонусы («Willpower Bonus yards»,
   * «СВБ ярдов»), кратные бонусы («Willpower Bonus x2»), «You»/«Self», «Touch».
   * @returns {{kind: string, yards: number|null, raw: string}}
   */
  function parseRange(raw, actor) {
    const text = String(raw ?? "").trim();
    if (!text) return { kind: TARGET_KIND.NONE, yards: null, raw: text };
    const low = text.toLowerCase();

    if (/^(you|self|caster|вы|себя|на себя)\b/.test(low)) return { kind: TARGET_KIND.SELF, yards: 0, raw: text };
    if (/^(touch|касание|прикосновение)\b/.test(low)) return { kind: TARGET_KIND.TOUCH, yards: 1, raw: text };

    // Площадь: «AoE (Willpower Bonus yards)», «радиус 10»
    const area = /\b(aoe|area|радиус|область)\b/.test(low);

    // Бонус характеристики: берём первый совпавший, при необходимости умножаем
    const BONUS = [
      [/\b(willpower|wp|св|сила воли)\b/, "wp"],
      [/\b(strength|сила)\b/, "s"],
      [/\b(toughness|выносливость)\b/, "t"],
      [/\b(agility|проворство|ловкость)\b/, "ag"],
      [/\b(initiative|инициатива)\b/, "i"],
      [/\b(intelligence|интеллект)\b/, "int"],
      [/\b(fellowship|харизма)\b/, "fel"],
      [/\b(dexterity)\b/, "dex"]
    ];
    let yards = null;
    if (/\b(bonus|бонус|б)\b/.test(low) || /\b(wpb|свб|сб|вб)\b/.test(low)) {
      const hit = BONUS.find(([re]) => re.test(low)) ?? (/\bwpb|свб\b/.test(low) ? [null, "wp"] : null);
      if (hit) {
        const mult = Number((low.match(/[x×]\s*(\d+)/) ?? [])[1]) || 1;
        yards = charBonus(actor, hit[1]) * mult;
      }
    }
    // Обычное число («20 yards», «20 ярдов»)
    if (yards === null) {
      const num = low.match(/(\d+)/);
      if (num) yards = Number(num[1]);
    }
    if (yards === null) return { kind: TARGET_KIND.NONE, yards: null, raw: text };
    return { kind: area ? TARGET_KIND.AREA : TARGET_KIND.RANGED, yards, raw: text };
  }

  /**
   * Сколько целей просит заклинание: число из поля target («1», «WPB targets»), иначе 1.
   * «You»/«Self» - цель не нужна, вернём 0.
   */
  function parseTargetCount(raw, actor) {
    const text = String(raw ?? "").trim();
    if (!text) return 1;
    const low = text.toLowerCase();
    if (/^(you|self|caster|вы|себя)\b/.test(low)) return 0;
    if (/\b(bonus|бонус)\b/.test(low) || /\b(wpb|свб)\b/.test(low)) {
      const parsed = parseRange(text, actor);
      if (parsed.yards !== null) return Math.max(1, parsed.yards);
    }
    const num = low.match(/(\d+)/);
    return num ? Math.max(1, Number(num[1])) : 1;
  }

  /** Общие утилиты ядра. Берём лениво: в Foundry api появляется на init, в моке - при сборке */
  const core = () => globalThis.__PD_API__?.util ?? game.modules?.get?.("wfrp4e-paperdoll")?.api?.util ?? null;

  /** Токен персонажа и дистанции считает ядро - там же их берёт оружие, чтобы логика была одна */
  const tokenOf = (actor) => core()?.tokenOf(actor) ?? null;
  const distanceBetween = (a, b) => core()?.distanceBetween(a, b) ?? null;

  /**
   * Кандидаты в цели: токены с дистанцией и признаком «в радиусе» этого заклинания.
   * Отличие от ядра только в том, что радиус берётся из разобранной дальности заклинания.
   */
  function targetsInRange(actor, range) {
    return core()?.tokensInRange(actor, range?.yards ?? null) ?? [];
  }

  /** Мгновенное действие или длящийся эффект: от этого зависит, вешать ли что-то на цель */
  function parseDuration(raw) {
    const text = String(raw ?? "").trim();
    const low = text.toLowerCase();
    if (!text) return { kind: "none", raw: text };
    if (/^(instant|мгнов)/.test(low)) return { kind: "instant", raw: text };
    if (/(permanent|посто[яy]н)/.test(low)) return { kind: "permanent", raw: text };
    return { kind: "lasting", raw: text };
  }

  /**
   * Первое найденное значение из нескольких возможных путей.
   * Нужно потому, что точные имена полей системы (ингредиент, перекаст) на живом мире не сверены:
   * вместо догадки об одном имени пробуем все вероятные и честно возвращаем undefined, если нет ничего.
   */
  function firstDefined(sys, paths) {
    for (const path of paths) {
      const v = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), sys);
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  }

  /**
   * Что нужно для каста: дальность, цели, длительность, а для заклинаний ещё ЧС, школа и перекаст.
   * Логика у заклинаний разная не сама по себе, а по данным - поэтому ветвимся по полям, а не по названиям.
   */
  function castPlan(actor, item) {
    const sys = item?.system ?? {};
    // Система сама считает дальности и длительности и отдаёт их геттерами с заглавной буквы
    // (как Damage/Range/Qualities у оружия): «Willpower Bonus yards» там уже превращено в число.
    // Берём готовое, если оно есть - оно авторитетнее нашего разбора строк; парсер остаётся запасным путём.
    const rangeSource = firstDefined(sys, ["Range", "range.value"]);
    const targetRaw = firstDefined(sys, ["Target", "target.value"]);
    const range = parseRange(rangeSource, actor);
    const targetKind = parseRange(targetRaw, actor);
    const needsTarget = !(
      range.kind === TARGET_KIND.SELF ||
      targetKind.kind === TARGET_KIND.SELF ||
      parseTargetCount(targetRaw, actor) === 0
    );
    // У площадных число в target - это радиус области, а не количество целей:
    // «AoE (4 yards)» значит круг радиусом 4, а не четыре цели. Считать его целями нельзя.
    const area = targetKind.kind === TARGET_KIND.AREA || range.kind === TARGET_KIND.AREA;
    const plan = {
      kind: item?.type ?? "spell",
      range,
      needsTarget,
      // В области цели не перечисляют - накрывает всех, кто попал: count null, радиус отдельно
      count: area ? null : needsTarget ? parseTargetCount(targetRaw, actor) : 0,
      area,
      areaRadius: area ? (targetKind.kind === TARGET_KIND.AREA ? targetKind.yards : range.yards) : null,
      duration: parseDuration(firstDefined(sys, ["Duration", "duration.value"]))
    };
    if (plan.kind !== "spell") return plan;

    // Заклинание: ЧС нужно набрать уровнями успеха, излишек идёт в перекаст
    const cn = Number(firstDefined(sys, ["cn.value", "cn"])) || 0;
    const damage = firstDefined(sys, ["Damage", "damage.value", "damage"]);
    const ingredient = firstDefined(sys, ["ingredient.value", "ingredients.value", "ingredient"]);
    return {
      ...plan,
      cn,
      lore: firstDefined(sys, ["lore.value", "lore"]) ?? null,
      memorized: !!firstDefined(sys, ["memorized.value", "memorized"]),
      damage: damage ?? null,
      ingredient: ingredient ?? null,
      // На что можно потратить излишек УУ. Набор выведен из данных, а не зашит по названиям заклинаний:
      // урон - только если заклинание вообще наносит урон, цели - если цель нужна, и т. д.
      overcast: {
        damage: damage !== undefined,
        targets: needsTarget,
        duration: plan.duration.kind === "lasting",
        range: range.kind === TARGET_KIND.RANGED || range.kind === TARGET_KIND.AREA
      }
    };
  }

  /**
   * Сколько УУ сверх ЧС осталось на перекаст. Сам бросок и его УУ даёт система -
   * сюда их передают уже посчитанными, мы только вычитаем ЧС.
   */
  function overcastBudget(plan, sl) {
    const need = Number(plan?.cn) || 0;
    const got = Number(sl) || 0;
    return { success: got >= need, spare: Math.max(0, got - need), need, got };
  }

  /** Навести таргет Foundry на выбранные токены (система прочитает game.user.targets при броске) */
  function setTargets(ids) {
    const wanted = new Set(ids);
    for (const t of canvas?.tokens?.placeables ?? []) {
      const should = wanted.has(t.id);
      if (!!t.isTargeted !== should) t.setTarget?.(should, { releaseOthers: false });
    }
  }

  globalThis.__PD_MAGIC_TARGETING__ = {
    TARGET_KIND,
    parseRange,
    parseTargetCount,
    parseDuration,
    tokenOf,
    distanceBetween,
    targetsInRange,
    castPlan,
    overcastBudget,
    setTargets
  };
})();
