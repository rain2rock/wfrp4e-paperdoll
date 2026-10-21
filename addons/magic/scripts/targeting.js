/**
 * Выбор целей для магии: разбор дальности и цели из полей системы, кто попадает в радиус, подсветка и таргет.
 *
 * Зачем отдельный слой: сам бросок, УУ, ЧС и применение эффектов делает система wfrp4e
 * (окно модификаторов открывает actor.setupCast / actor.setupPrayer). Система знает дальность строкой,
 * но не сопоставляет её с положением токенов - этим и занимается этот файл.
 *
 * ВАЖНО: строки дальности и цели не проверены на живой системе (её исходников в репозитории нет).
 * Разбор намеренно терпимый: что не распознали - считаем «нужна ручная цель», а не падаем.
 * Диагностический макрос для сверки: tools/diagnose-magic.js
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

  /** Токен персонажа на текущей сцене (первый, если их несколько) */
  function tokenOf(actor) {
    if (!actor) return null;
    return (canvas?.tokens?.placeables ?? []).find((t) => t.actor?.id === actor.id) ?? null;
  }

  /** Дистанция между токенами в единицах сцены (ярдах), null - посчитать нечем */
  function distanceBetween(a, b) {
    if (!a || !b) return null;
    const from = { x: a.center?.x ?? a.x, y: a.center?.y ?? a.y };
    const to = { x: b.center?.x ?? b.x, y: b.center?.y ?? b.y };
    const grid = canvas?.grid;
    try {
      // Foundry v12+: measurePath, раньше - measureDistance
      if (typeof grid?.measurePath === "function") return grid.measurePath([from, to])?.distance ?? null;
      if (typeof grid?.measureDistance === "function") return grid.measureDistance(from, to);
    } catch (err) {
      console.warn("wfrp4e-paperdoll | distance", err);
    }
    // Запасной путь: евклидово расстояние в клетках, умноженное на размер клетки сцены
    const size = Number(grid?.size) || 100;
    const unit = Number(canvas?.scene?.grid?.distance ?? canvas?.dimensions?.distance) || 1;
    return (Math.hypot(to.x - from.x, to.y - from.y) / size) * unit;
  }

  /**
   * Кандидаты в цели: все видимые токены кроме самого кастера, с дистанцией и признаком «в радиусе».
   * Сортировка по дистанции, чтобы ближние были сверху.
   */
  function targetsInRange(actor, range) {
    const self = tokenOf(actor);
    const out = [];
    for (const t of canvas?.tokens?.placeables ?? []) {
      if (!t.actor || t === self) continue;
      if (t.document?.hidden && !game.user?.isGM) continue;
      const distance = distanceBetween(self, t);
      const yards = range?.yards ?? null;
      out.push({
        id: t.id,
        name: t.name ?? t.actor.name,
        img: t.document?.texture?.src ?? t.actor.img,
        distance,
        // Дистанцию посчитать не вышло (нет сцены) - не врём «далеко», помечаем неизвестной
        inRange: distance === null || yards === null ? null : distance <= yards,
        targeted: !!t.isTargeted
      });
    }
    return out.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
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
    const range = parseRange(sys.range?.value, actor);
    const targetRaw = sys.target?.value;
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
      duration: parseDuration(sys.duration?.value)
    };
    if (plan.kind !== "spell") return plan;

    // Заклинание: ЧС нужно набрать уровнями успеха, излишек идёт в перекаст
    const cn = Number(firstDefined(sys, ["cn.value", "cn"])) || 0;
    const damage = firstDefined(sys, ["damage.value", "damage"]);
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
