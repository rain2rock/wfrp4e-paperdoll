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

  /** Характеристики, которые встречаются в дальностях (проверено по компендиумам живого мира) */
  const CHARS = [
    [/willpower|\bwp\b|сила воли/, "wp"],
    [/fellowship|харизма/, "fel"],
    [/initiative|инициатива/, "i"],
    [/intelligence|интеллект/, "int"],
    [/strength|сила/, "s"],
    [/toughness|выносливость/, "t"],
    [/agility|проворство/, "ag"],
    [/dexterity|ловкость/, "dex"]
  ];
  const YARDS_IN_MILE = 1760;
  /** «Особые» дальности: числа нет и быть не может, цель выбирает человек */
  const SPECIAL = /\b(line of sight|special|see text|see description|random vortex|varies|по описанию|особое)\b/;

  /**
   * Строка дальности или цели -> ярды. Формы взяты из живых компендиумов, а не придуманы:
   * «Willpower Bonus yards», «Willpower yards» (вся характеристика, не бонус), «Half Willpower yards»,
   * «Willpower / 2 yards», «2 * Fellowship Bonus yards», «Fellowship Bonus miles», «20 yards (can't be extended)»,
   * «You», «Self», «Touch», «You or Touch», а также «Line of sight» / «Special» / «See text» - их не считаем.
   * @returns {{kind: string, yards: number|null, raw: string, special?: boolean}}
   */
  function parseRange(raw, actor) {
    const text = String(raw ?? "").trim();
    if (!text) return { kind: TARGET_KIND.NONE, yards: null, raw: text };
    const low = text.toLowerCase();

    // Касание проверяем ДО «себя»: «You or Touch» - это всё-таки касание, цель нужна
    if (/\btouch\b|касание|прикосновение/.test(low)) return { kind: TARGET_KIND.TOUCH, yards: 1, raw: text };
    if (/^(you|self|caster)\b|^(вы|себя|на себя)\b/.test(low)) return { kind: TARGET_KIND.SELF, yards: 0, raw: text };
    // Особые дальности: не выдумываем число, пусть выбирают руками
    if (SPECIAL.test(low)) return { kind: TARGET_KIND.NONE, yards: null, raw: text, special: true };

    const area = /\b(aoe|area)\b|радиус|область/.test(low);
    const miles = /\bmiles?\b|мил[ьия]/.test(low);

    // Характеристика: «Willpower Bonus» - бонус, просто «Willpower» - всё значение
    const hit = CHARS.find(([re]) => re.test(low));
    let base = null;
    if (hit) {
      const c = actor?.system?.characteristics?.[hit[1]] ?? {};
      const bonus = /bonus|бонус/.test(low);
      base = bonus
        ? Number(c.bonus ?? Math.floor((Number(c.value) || 0) / 10)) || 0
        : Number(c.value) || 0;
    } else {
      const num = low.match(/(\d+)/);
      if (num) base = Number(num[1]);
    }
    if (base === null) return { kind: TARGET_KIND.NONE, yards: null, raw: text };

    // Делители и множители: «Half X», «X / 2», «2 * X», «X x2»
    if (/\bhalf\b|половин/.test(low) || /\/\s*2\b/.test(low)) base = Math.floor(base / 2);
    const mult = low.match(/(\d+)\s*[*x×]\s*(?=[a-zа-я])/) ?? low.match(/[*x×]\s*(\d+)/);
    if (mult && hit) base *= Number(mult[1]);

    const yards = miles ? base * YARDS_IN_MILE : base;
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
   * Готовое значение системы против сырой строки.
   *
   * Геттеры Range/Duration считаются ОТНОСИТЕЛЬНО ВЛАДЕЛЬЦА предмета. У заклинания из компендиума
   * владельца нет, и геттер отдаёт 0 - это «не посчитано», а не «ноль ярдов». Проверено на живом мире:
   * у заклинания с range.value = "Touch" геттер Range вернул 0. Поэтому ноль и пустую строку игнорируем,
   * иначе «касание» превратилось бы в дальнобойное заклинание с радиусом 0, и в радиус не попадал бы никто.
   */
  function preferComputed(computed, raw) {
    if (typeof computed === "number" && computed > 0) return String(computed);
    if (typeof computed === "string" && computed.trim()) return computed;
    return raw;
  }

  /**
   * Что нужно для каста: дальность, цели, длительность, а для заклинаний ещё ЧС, школа и перекаст.
   * Логика у заклинаний разная не сама по себе, а по данным - поэтому ветвимся по полям, а не по названиям.
   */
  function castPlan(actor, item) {
    const sys = item?.system ?? {};
    const rangeSource = preferComputed(sys.Range, sys.range?.value);
    const targetRaw = preferComputed(sys.Target, sys.target?.value);
    const range = parseRange(rangeSource, actor);
    const targetKind = parseRange(targetRaw, actor);
    const needsTarget = !(
      range.kind === TARGET_KIND.SELF ||
      targetKind.kind === TARGET_KIND.SELF ||
      parseTargetCount(targetRaw, actor) === 0
    );
    // Площадь система отмечает флагом target.aoe - он надёжнее разбора строки.
    // У площадных число в target - радиус области, а не количество целей: «AoE (4 yards)» - круг радиусом 4.
    const area = sys.target?.aoe === true || targetKind.kind === TARGET_KIND.AREA || range.kind === TARGET_KIND.AREA;
    const plan = {
      kind: item?.type ?? "spell",
      range,
      needsTarget,
      // В области цели не перечисляют - накрывает всех, кто попал: count null, радиус отдельно
      count: area ? null : needsTarget ? parseTargetCount(targetRaw, actor) : 0,
      area,
      areaRadius: area ? (targetKind.kind === TARGET_KIND.AREA ? targetKind.yards : range.yards) : null,
      duration: parseDuration(preferComputed(sys.Duration, sys.duration?.value))
    };
    if (plan.kind !== "spell") return plan;

    // Заклинание: ЧС нужно набрать уровнями успеха, излишек идёт в перекаст
    const cn = Number(firstDefined(sys, ["cn.value", "cn"])) || 0;
    // Только скалярные пути: у заклинания без урона damage = { value: "", dice: "" },
    // и запасной путь на сам объект вернул бы его целиком вместо «урона нет».
    // Ноль от геттера тоже не урон - у предмета из компендиума он означает «не посчитано»
    const damage = preferComputed(sys.Damage, sys.damage?.value) || null;
    // Ингредиенты - массив предметов (так в системе), а не одно поле
    const ingredients = Array.isArray(sys.ingredients) ? sys.ingredients : [];
    // Перекаст система описывает сама: enabled, на что и по сколько за уровень.
    // Берём её данные, а не свои догадки по полям - раньше набор выводился «на глаз».
    const oc = sys.overcast ?? {};
    return {
      ...plan,
      cn,
      lore: firstDefined(sys, ["lore.value", "lore"]) ?? null,
      memorized: !!firstDefined(sys, ["memorized.value", "memorized"]),
      // Магический снаряд - отдельный флаг системы: такие заклинания бьют уроном
      magicMissile: sys.magicMissile?.value === true,
      ritual: sys.ritual?.value === true,
      damage: damage ?? null,
      ingredients,
      ingredient: ingredients[0]?.name ?? null,
      overcast: {
        enabled: oc.enabled === true,
        label: oc.label ?? "",
        perOvercast: oc.valuePerOvercast ?? null,
        initial: oc.initial ?? null
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
