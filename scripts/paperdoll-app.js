import { ICON_OVERRIDES } from "./icon-index.js";
import { translateTerm } from "./glossary-ru.js";
import { translateText, cachedTranslation, looksEnglish } from "./translate.js";
import { ownIconFor, talentSlug } from "./icon-rules.js";

export const MODULE_ID = "wfrp4e-paperdoll";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Локации брони в WFRP4e (ключи как в system.AP и actor.system.status.armour) */
const LOCATIONS = ["head", "body", "rArm", "lArm", "rLeg", "lLeg"];

/* -------------------------------------------- */
/*  Своя графика: assets/ui и assets/icons      */
/* -------------------------------------------- */

/** Путь к файлу модуля. В моке вместо пути подставляется data URI */
export const asset = (rel) => globalThis.__PD_ASSETS__?.[rel] ?? `modules/${MODULE_ID}/assets/${rel}`;
/** Картинка интерфейса из assets/ui */
export const uiArt = (name) => asset(`ui/${name}.png`);
/** Картинка не загрузилась - ставим знак вопроса (один раз, без зацикливания) */
export const bindMissingImages = (root) => {
  if (!root || root._pdMissingBound) return;
  root._pdMissingBound = true;
  root.addEventListener(
    "error",
    (ev) => {
      const img = ev.target;
      if (img?.tagName !== "IMG" || img.dataset.pdMissing) return;
      if (!img.closest?.(".wfrp-paperdoll, .wfrp-paperdoll-tooltip, .wfrp-paperdoll-flyout")) return;
      img.dataset.pdMissing = "1";
      img.src = uiArt("ui-missing");
    },
    true
  );
};

/** Опции куколки и значения по умолчанию: мутации и травмы учитываются, цены скрыты, звуки включены */
export const PD_OPTIONS = { prices: false, sounds: true, detailedStats: false, tokenDblClick: false, hotkey: true, passiveBuffs: false, translateTerms: false, effectDurations: true, unarmed: true, restButton: true, rolls: true, shiftCompare: true };
export const option = (key) => setting(key, PD_OPTIONS[key]);
/** Игровой термин на русском (опция «Переводить термины», клиент на русском) */
export const T = (name) =>
  option("translateTerms") && !setting("translateDescOnly", false) && game.i18n?.lang === "ru" ? translateTerm(name) : name;
/** Как переводить описания: off | chrome | google */
const trProvider = () => setting("translateText", "off");

const setting = (key, fallback) => {
  try {
    return game.settings.get(MODULE_ID, key) ?? fallback;
  } catch {
    return fallback;
  }
};
/** Тема окна: dark (тёмная) или parchment (пергамент) */
/** Тема окна: осталась одна - пергамент */
export const currentTheme = () => "parchment";
const themeClass = () => `pd-theme-${currentTheme()}`;

const CORE_ICONS = "modules/wfrp4e-core/icons/";
/**
 * Иконка предмета: заглушки wfrp4e-core подменяем своими из assets/icons.
 * Варианты (-fine, -flaw, dagger2) без своей картинки берут картинку базового предмета.
 */
export function itemImg(img, name = "") {
  if (!img) return uiArt("ui-missing");
  if (!img?.startsWith(CORE_ICONS) || !setting("itemIcons", true)) return img;
  const rel = ownIconFor(img.slice(CORE_ICONS.length), name, ICON_OVERRIDES);
  return rel ? asset(`icons/${rel}`) : img;
}

/**
 * Иконка таланта: своя по названию (assets/icons/talents), если есть - у непоказанной, ещё не купленной
 * вещи картинки вообще нет, itemImg() тут бессилен. Кастомную картинку (не заглушку wfrp4e-core) не трогаем.
 */
export function talentImg(img, name = "") {
  if (!img || img.startsWith(CORE_ICONS)) {
    const slug = talentSlug(name);
    const rel = slug && `talents/${slug}.png`;
    if (rel && ICON_OVERRIDES.has(rel) && setting("itemIcons", true)) return asset(`icons/${rel}`);
  }
  return itemImg(img, name);
}

/** Силуэты пустых слотов */
const SLOT_ART = {
  head: "slot-head",
  body: "slot-body",
  rArm: "slot-arm-r",
  lArm: "slot-arm-l",
  rLeg: "slot-leg-r",
  lLeg: "slot-leg-l",
  accessory: "slot-accessory",
  container: "slot-bag",
  bag1: "slot-bag",
  bag2: "slot-bag",
  bag3: "slot-bag",
  main: "slot-main",
  off: "slot-off",
  hand3: "slot-hand-extra",
  hand4: "slot-hand-extra",
  head2: "slot-head-extra",
  head3: "slot-head-extra"
};

/** Статьи правил для строк вкладки «Характеристики»: как они называются в журналах wfrp4e-core */
const ARTICLE_TERMS = {
  "WFRPPD.Stats.Move": "Movement", "WFRPPD.Stats.Walk": "Movement", "WFRPPD.Stats.Run": "Movement",
  "WFRPPD.Encumbrance": "Encumbrance",
  "char.ws": "Weapon Skill", "char.bs": "Ballistic Skill", "char.s": "Strength", "char.t": "Toughness", "char.i": "Initiative",
  "char.ag": "Agility", "char.dex": "Dexterity", "char.int": "Intelligence", "char.wp": "Willpower", "char.fel": "Fellowship",
  "WFRPPD.Stats.MainDmg": "Damage", "WFRPPD.Stats.OffDmg": "Damage", "WFRPPD.Stats.RangedDmg": "Damage",
  "WFRPPD.Stats.SB": "Strength", "WFRPPD.Stats.TB": "Toughness", "WFRPPD.Stats.Advantage": "Advantage",
  "WFRPPD.Stats.Crits": "Critical", "WFRPPD.Stats.CastPenalty": "Armour",
  "WFRPPD.Stats.Fate": "Fate", "WFRPPD.Stats.Fortune": "Fortune", "WFRPPD.Stats.Resilience": "Resilience",
  "WFRPPD.Stats.Resolve": "Resolve", "WFRPPD.Stats.Corruption": "Corruption", "WFRPPD.Stats.Sin": "Sin",
  "WFRPPD.Stats.ExpTotal": "Experience", "WFRPPD.Stats.ExpSpent": "Experience", "WFRPPD.Stats.ExpCurrent": "Experience"
};

/** Иконки категорий во вкладке «Характеристики» */
/** Что можно показать второй полосой под моделью */
const SECOND_BARS = ["fortune", "resolve", "corruption", "advantage", "xp"];
const STAT_ART = { tree: "stat-tree", general: "stat-general", experience: "stat-experience", career: "stat-career", skills: "stat-skills", talents: "stat-talents", physical: "stat-body", mental: "stat-mind", combat: "stat-combat", defence: "stat-defence", fate: "stat-fate" };

/* -------------------------------------------- */
/*  Конечности: ампутации, переломы, протезы    */
/* -------------------------------------------- */

const LIMB_LOCS = ["rArm", "lArm", "rLeg", "lLeg"];
const isArmLoc = (loc) => loc === "rArm" || loc === "lArm";
const baseName = (img) => String(img ?? "").split("/").pop().replace(/\.\w+$/, "").toLowerCase();

/* -------------------------------------------- */
/*  Мутации: лишние руки и головы               */
/* -------------------------------------------- */

const EXTRA_HANDS = ["hand3", "hand4"];
const EXTRA_HEADS = ["head2", "head3"];
const isExtraHand = (slot) => EXTRA_HANDS.includes(slot);
const isExtraHead = (slot) => EXTRA_HEADS.includes(slot);
const isExtraSlot = (slot) => isExtraHand(slot) || isExtraHead(slot);
/** В каком дополнительном слоте вещь (флаг модуля) */
// Без дополнения «Мутации» (или с выключенной опцией) флаг игнорируем, вещь видна в обычном слоте
const extraSlotOf = (item) => (ADDONS.has("mutations") && option("mutations") ? item?.flags?.[MODULE_ID]?.extraSlot ?? null : null);

/** Протез: hook - крюк, leg - деревянная нога или стопа, marvel - инженерное чудо. Распознаёт дополнение «Травмы» */
const prostheticKind = (item) => ADDONS.get("injuries")?.prostheticKind?.(item) ?? null;

/** Доступность предмета -> «редкость» рамки в стиле WoW */
const RARITY = {
  common: "common",
  scarce: "scarce",
  rare: "rare",
  exotic: "exotic",
  special: "exotic"
};

const BAG_FILTERS = ["all", "weapon", "armour", "clothing", "other"];

/** Слоты для сумок, как сумки на панели в WoW */
const BAG_SLOTS = ["bag1", "bag2", "bag3"];
const isBagSlot = (slot) => BAG_SLOTS.includes(slot);
/** Ячеек в ряду сумки */
const BAG_COLS = 5;

/* -------------------------------------------- */
/*  Ограничения по правилам (базовая книга 4e)  */
/* -------------------------------------------- */

const METAL_ARMOUR = ["plate", "mail", "otherMetal", "gromril"];
const LEATHER_ARMOUR = ["softLeather", "boiledLeather"];

/** Стрелковое, которое можно использовать через соседнюю специализацию (без достоинств) */
const RANGED_FALLBACK = ["crossbow", "throwing"];

/** Специализация навыка для группы оружия (как в названиях навыков системы) */
const GROUP_SKILL = {
  basic: "Melee (Basic)", cavalry: "Melee (Cavalry)", fencing: "Melee (Fencing)", brawling: "Melee (Brawling)",
  flail: "Melee (Flail)", parry: "Melee (Parry)", polearm: "Melee (Polearm)", twohanded: "Melee (Two-Handed)",
  blackpowder: "Ranged (Blackpowder)", bow: "Ranged (Bow)", crossbow: "Ranged (Crossbow)", entangling: "Ranged (Entangling)",
  engineering: "Ranged (Engineering)", explosives: "Ranged (Explosives)", sling: "Ranged (Sling)", throwing: "Ranged (Throwing)"
};

/**
 * Обеты культов, которые касаются снаряжения.
 * В базовой книге это только Ульрик; список легко расширить.
 */
const CULT_RULES = [
  {
    god: "WFRPPD.Gods.Ulric",
    match: /ulric|ульрик/i,
    hint: "WFRPPD.Restr.CultUlric",
    forbids: (item) => {
      const sys = item.system;
      if (item.type === "weapon") return ["blackpowder", "engineering", "explosives", "crossbow"].includes(sys.weaponGroup?.value);
      if (item.type === "armour") {
        const helmet = (sys.AP?.head ?? 0) > 0 && (METAL_ARMOUR.includes(sys.armorType?.value) || /helm|шлем/i.test(item.name));
        return helmet;
      }
      return false;
    }
  }
];

/** Вес редкости для сравнения предметов */
const RARITY_RANK = { None: 0, common: 1, scarce: 2, rare: 3, exotic: 4, special: 4 };

/** Значение качества «Щит N» (система или подпись качества) */
function shieldValue(item) {
  const sys = item.system;
  const v = safe(() => sys.properties?.qualities?.shield?.value, null);
  if (Number(v)) return Number(v);
  const label = (safe(() => sys.Qualities, []) ?? []).find((q) => /^(shield|щит)(\s|$)/i.test(q));
  if (!label) return 0;
  return Number(label.match(/(\d+)/)?.[1] ?? 1);
}

/** Есть ли у предмета достоинство или изъян (ключ системы или подпись) */
function hasProperty(item, key, rx) {
  const sys = item.system;
  const props = safe(() => sys.properties, null) ?? {};
  if (props.qualities?.[key] || props.flaws?.[key]) return true;
  const labels = [...(safe(() => sys.Qualities, []) ?? []), ...(safe(() => sys.Flaws, []) ?? [])];
  return labels.some((q) => rx.test(q));
}

/** Гибкая броня или мягкая кожа - её можно поддеть под другой доспех (стр. 300) */
function isUnderLayer(item) {
  return item.system.armorType?.value === "softLeather" || hasProperty(item, "flexible", /flexible|гибк/i);
}

/**
 * Штрафы брони к навыкам (стр. 300).
 * Каждый элемент кольчуги или лат: -10 к скрытности.
 * Поле «Эффект» предмета (например, «-20 к наблюдательности») читаем как есть.
 * Достоинство «Практичный» (Up in Arms) снижает каждый штраф на 10.
 */
function armourSkillPenalties(item) {
  const sys = item.system;
  const out = { stealth: 0, perception: 0 };
  if (item.type !== "armour") return out;
  const type = sys.armorType?.value;
  if (["mail", "plate"].includes(type)) out.stealth = 10;
  const text = String(sys.penalty?.value ?? "");
  for (const m of text.matchAll(/[-−–]\s*(\d+)\s*(?:к|to)?\s*([A-Za-zА-Яа-яЁё]+)/g)) {
    const n = Number(m[1]);
    if (/stealth|скрыт/i.test(m[2])) out.stealth = Math.max(out.stealth, n);
    else if (/percep|наблюд|восприят/i.test(m[2])) out.perception = Math.max(out.perception, n);
  }
  // Данные без поля «Эффект»: узнаём шлемы и капюшон по названию
  if (!out.perception && (sys.AP?.head ?? 0) > 0) {
    if (/great\s*helm|closed|топфхельм|глух|закрыт/i.test(item.name)) out.perception = 20;
    else if (/helm|coif|шлем|капюшон/i.test(item.name) && type !== "softLeather") out.perception = 10;
  }
  if (hasProperty(item, "practical", /practical|практичн/i)) {
    out.stealth = Math.max(0, out.stealth - 10);
    out.perception = Math.max(0, out.perception - 10);
  }
  return out;
}

/** Группа боеприпасов для стрелкового оружия (null - боеприпасы не нужны) */
const AMMO_BY_GROUP = { bow: "bow", longbow: "bow", crossbow: "crossbow", sling: "sling", blackpowder: "BPandEng", engineering: "BPandEng" };
function weaponAmmoGroup(item) {
  const sys = item.system;
  const g = sys.ammunitionGroup?.value;
  if (g) return g === "none" ? null : g;
  return AMMO_BY_GROUP[sys.weaponGroup?.value] ?? null;
}
function ammoGroupOf(item) {
  const t = item.system.ammunitionType?.value;
  if (t) return t;
  const n = item.name ?? "";
  if (/sling|пращ/i.test(n)) return "sling";
  if (/bolt|болт/i.test(n)) return "crossbow";
  if (/arrow|стрел/i.test(n)) return "bow";
  if (/shot|powder|bullet|пул|порох|дробь|картеч/i.test(n)) return "BPandEng";
  return null;
}

/**
 * Стоимость шага развития (книга, стр. 47): зависит от уже сделанных шагов.
 * Шаги 0-4 стоят по первой цене, 5-9 по второй и т. д. Вне карьеры - вдвое дороже.
 */
const XP_TABLE = {
  characteristic: [25, 30, 40, 50, 70, 90, 120, 150, 190, 230, 280, 330, 390, 450, 520],
  skill: [10, 15, 20, 30, 40, 60, 80, 110, 140, 180, 220, 270, 320, 380, 440]
};
function advanceCost(advances, type) {
  const table = safe(() => game.wfrp4e.config.xpCost?.[type], null) ?? XP_TABLE[type];
  const i = Math.min(Math.floor(Math.max(0, Number(advances) || 0) / 5), table.length - 1);
  return table[i];
}

/** Навык из списка карьеры: точное совпадение или «Ближний бой (любое)» для любой специализации */
const norm = (s) => String(s ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
function skillMatches(name, entry) {
  const a = norm(name);
  const b = norm(entry);
  if (!b) return false;
  if (a === b) return true;
  const any = b.match(/^(.*?)\s*\((any|любой|любая|любое|любые|любого)\)$/);
  if (any) return a === any[1] || a.startsWith(`${any[1]} (`);
  return false;
}

/**
 * Бафф или дебафф: по тому, что эффект прибавляет (+/-) к характеристикам и проверкам,
 * а без чисел - по названию (благословения, молитвы, Ярость - баффы; проклятия, яды - дебаффы).
 * Возвращает "buff" | "debuff" | null (непонятно).
 */
const BUFF_RX = /bless|благослов|prayer|молитв|miracle|чудо|invoke|frenzy|ярост|berserk|берсерк|inspir|воодушев|aura|аур|protect|защит|ward|оберег|courage|смелост|fearless|бесстраш|heal|исцел|regenerat|регенер|haste|ускор|strength of|сила /i;
const DEBUFF_RX = /curse|прокля|poison|яд|отрав|disease|болезн|fear|страх|terror|ужас|weak|слаб|blind|ослеп|deaf|оглуш|stun|ошелом|fatigue|устал|bleed|кровотеч|hex|сглаз|penalt|штраф/i;
function effectPolarity(effect) {
  let sum = 0;
  for (const ch of effect.changes ?? []) {
    const n = Number(ch.value);
    if (!Number.isFinite(n) || n === 0) continue;
    // ADD (2) и OVERRIDE/UPGRADE считаем по знаку; штрафы в системе иногда пишутся в modifier со знаком минус
    sum += Math.sign(n);
  }
  if (sum > 0) return "buff";
  if (sum < 0) return "debuff";
  const name = `${effect.name ?? ""}`;
  if (DEBUFF_RX.test(name)) return "debuff";
  if (BUFF_RX.test(name)) return "buff";
  return null;
}

/** Наборы статов для выпадашек под портретом */
const STAT_SETS = ["physical", "mental", "combat", "defence", "fate"];

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* -------------------------------------------- */
/*  Расшифровка сокращений: «6 ЗК» -> «6 золотых крон (ЗК)»   */
/* -------------------------------------------- */

function plural(n, forms) {
  const a = Math.abs(Math.trunc(n)) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
}

/** Сокращение -> [формы слова для 1/2/5, как подписать сокращение] */
const TERMS = [
  [/(ЗК|зк|GC)/, (n) => `${plural(n, game.i18n.localize("WFRPPD.Terms.gc").split("|"))} (ЗК)`],
  [/(СШ|сш|SS)/, (n) => `${plural(n, game.i18n.localize("WFRPPD.Terms.ss").split("|"))} (СШ)`],
  [/(П|п|BP)/, (n) => `${plural(n, game.i18n.localize("WFRPPD.Terms.bp").split("|"))} (П)`],
  [/(УУ|SL)/, (n) => `${plural(n, game.i18n.localize("WFRPPD.Terms.sl").split("|"))} (УУ)`]
];

/** «-2 УУ» -> «-2 уровня успеха (УУ)», «6 ЗК» -> «6 золотых крон (ЗК)» */
function humanizeTerms(text) {
  let out = String(text ?? "");
  for (const [abbr, word] of TERMS) {
    const re = new RegExp(`([+\\-–]?\\d+)\\s*${abbr.source}(?![\\p{L}])`, "gu");
    out = out.replace(re, (_, num) => `${num} ${word(Number(num.replace("–", "-")))}`);
  }
  return out;
}

/**
 * Разворачивает служебную разметку Foundry в обычный текст:
 *   [[/r 1d10]]           -> 1d10
 *   [[/r 1d10]]{подпись}  -> подпись
 *   @Pay[6зк]{6 ЗК}       -> 6 ЗК
 *   @Condition[устал]     -> устал
 *   @UUID[...]{Имя}       -> Имя
 */
function plainEnrichers(text) {
  return String(text ?? "")
    .replace(/\[\[\s*\/(?:r|roll|gmr|br|pr)\s+([^\]]+?)\s*\]\](?:\{([^}]*)\})?/gi, (_, f, label) => label || f)
    .replace(/\[\[\s*([^\]]+?)\s*\]\](?:\{([^}]*)\})?/g, (_, f, label) => label || f)
    .replace(/@\w+\[([^\]]*)\](?:\{([^}]*)\})?/g, (_, ref, label) => label || ref.split(".").pop());
}

/**
 * Разбирает описание предмета для тултипа:
 * абзацы вида «<strong>Метка:</strong> значение» -> строки свойств,
 * остальное -> текст. Таблицы в тултип не тащим, только помечаем.
 */
const PRICE_LABEL = /цен|стоимост|price|cost/i;

function parseDescription(html, { hidePrices = false } = {}) {
  const root = document.createElement("div");
  // Для игроков ссылки на оплату (@Pay[...]) превращаем в пустоту ещё до разбора
  root.innerHTML = hidePrices ? String(html ?? "").replace(/@Pay\[[^\]]*\](?:\{[^}]*\})?/gi, "") : html ?? "";
  const hasTable = !!root.querySelector("table");
  root.querySelectorAll("table").forEach((t) => t.remove());
  const clean = (t) => plainEnrichers(t).replace(/\s+/g, " ").trim();

  const props = [];
  const text = [];
  const blocks = root.querySelectorAll("p, li, h1, h2, h3, h4, blockquote");
  const nodes = blocks.length ? [...blocks] : [root];
  for (const node of nodes) {
    const strong = node.querySelector("strong, b");
    const full = clean(node.textContent);
    if (!full) continue;
    if (strong && node.textContent.trim().startsWith(strong.textContent.trim()) && /:\s*$/.test(strong.textContent.trim())) {
      const label = clean(strong.textContent).replace(/:\s*$/, "");
      const value = clean(full.slice(full.indexOf(":") + 1));
      if (label && hidePrices && PRICE_LABEL.test(label)) continue;
      if (label && value) {
        props.push([label, value]);
        continue;
      }
    }
    text.push(full);
  }
  return { props, text: text.join(" "), hasTable };
}

function stripTags(html) {
  const div = document.createElement("div");
  div.innerHTML = html ?? "";
  return (div.textContent ?? "").replace(/\s+/g, " ").trim();
}

function sys(doc) {
  return doc?.system ?? {};
}

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch (e) {
    return fallback;
  }
}

/**
 * Звон монет без звукового файла: несколько коротких «металлических» обертонов через Web Audio.
 * gain - при получении две монетки, при трате одна и ниже. Громкость - из настройки интерфейса Foundry.
 */
let coinAudio = null;
function playCoinSound(gain = true) {
  if (!option("sounds")) return;
  try {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return;
    coinAudio ??= new AC();
    const ctx = coinAudio;
    if (ctx.state === "suspended") ctx.resume();
    let volume = 0.5;
    try {
      volume = Number(game.settings.get("core", "globalInterfaceVolume") ?? 0.5);
    } catch {}
    // Звон тихий: четверть от громкости интерфейса
    volume *= 0.25;
    if (!(volume > 0)) return;
    const hits = gain ? [0, 0.07] : [0];
    for (const t0 of hits) {
      const start = ctx.currentTime + t0;
      const base = (gain ? 2600 : 2100) * (1 + (Math.random() - 0.5) * 0.08);
      for (const [mul, amp, decay] of [[1, 0.35, 0.18], [2.76, 0.18, 0.12], [5.4, 0.08, 0.07]]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = base * mul;
        g.gain.setValueAtTime(amp * volume, start);
        g.gain.exponentialRampToValueAtTime(0.0001, start + decay);
        osc.connect(g).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + decay + 0.02);
      }
    }
  } catch {
    // Звук - украшение: без него всё работает
  }
}

/**
 * Дополнения - отдельные модули (магия, травмы, мутации, развитие, группа).
 * Регистрируются через PD_API.registerAddon в хуке «wfrp4e-paperdoll.init».
 * Ядро работает без любого из них: точки расширения вызываются, только если дополнение есть.
 */
export const ADDONS = new Map();
/** Вызвать точку расширения у всех дополнений: addon[name](app, ...args) */
const addonHook = (name, ...args) => {
  const out = [];
  for (const a of ADDONS.values()) if (typeof a[name] === "function") out.push(a[name](...args));
  return out;
};

export class PaperdollApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Одно окно на актёра */
  /** Описания талантов из библиотеки: имя -> текст */
  static _talentLib = new Map();

  static instances = new Map();

  static uiState = { filter: "all", tab: "bag", statPanels: ["physical", "fate"], sort: "default", view: "grid", statsView: "list" };

  _saveUiState() {
    PaperdollApp.uiState = { filter: this._filter, tab: this._tab, statPanels: [...this._statPanels], sort: this._sort, view: this._view, statsView: this._statsView };
  }

  static openFor(actor) {
    if (!actor) return null;
    let app = this.instances.get(actor.uuid);
    if (!app) {
      app = new this({ actor });
      this.instances.set(actor.uuid, app);
    }
    app.render({ force: true });
    if (app.rendered) app.bringToFront?.();
    return app;
  }

  /** Перерисовать все открытые куколки (смена темы или иконок в настройках) */
  static renderAll() {
    for (const app of this.instances.values()) if (app.rendered) app.render();
  }

  static DEFAULT_OPTIONS = {
    classes: ["wfrp-paperdoll"],
    tag: "div",
    window: {
      icon: "fa-solid fa-user-shield",
      resizable: true
    },
    position: { width: 960, height: 720 },
    actions: {
      setFilter: PaperdollApp.onSetFilter,
      setTab: PaperdollApp.onSetTab,
      autoPack: PaperdollApp.onAutoPack,
      unloadBag: PaperdollApp.onUnloadBag,
      setStatsView: PaperdollApp.onSetStatsView,
      openSheet: PaperdollApp.onOpenSheet,
      setSort: PaperdollApp.onSetSort,
      setView: PaperdollApp.onSetView,
      toggleSortMenu: PaperdollApp.onToggleSortMenu,
      toggleBarMenu: PaperdollApp.onToggleBarMenu,
      setSecondBar: PaperdollApp.onSetSecondBar
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/paperdoll.hbs`,
      scrollable: [".pd-bag-list", ".pd-ecs", ".pd-addon-tab"]
    }
  };

  constructor({ actor, ...options } = {}) {
    const safeId = actor.uuid.replace(/[^a-zA-Z0-9_-]/g, "-");
    super({ ...options, id: `wfrp-paperdoll-${safeId}` });
    this.actor = actor;
    // Выбор вкладки и выпадашек запоминаем между открытиями окна
    this._filter = PaperdollApp.uiState.filter;
    this._sort = PaperdollApp.uiState.sort ?? "default";
    this._view = PaperdollApp.uiState.view ?? "grid";
    this._statsView = PaperdollApp.uiState.statsView ?? "list";
    this._tab = PaperdollApp.uiState.tab;
    this._statPanels = [...PaperdollApp.uiState.statPanels];
    this._dragging = null;

    this._debouncedRender = foundry.utils.debounce(() => {
      if (this.rendered) this.render();
    }, 50);

    const isMine = (doc) => doc?.parent?.uuid === this.actor.uuid;
    // Эффект на самом персонаже или на его предмете
    const effectMine = (e) => isMine(e) || e?.parent?.parent?.uuid === this.actor.uuid;
    this._hooks = [
      ["createItem", Hooks.on("createItem", (item) => isMine(item) && this._debouncedRender())],
      ["updateItem", Hooks.on("updateItem", (item) => isMine(item) && this._debouncedRender())],
      ["deleteItem", Hooks.on("deleteItem", (item) => isMine(item) && this._debouncedRender())],
      ["updateActor", Hooks.on("updateActor", (a) => a.uuid === this.actor.uuid && this._debouncedRender())],
      // Состояния и эффекты - отдельные документы: без этих хуков лента эффектов не обновлялась бы
      ["createActiveEffect", Hooks.on("createActiveEffect", (e) => effectMine(e) && this._debouncedRender())],
      ["updateActiveEffect", Hooks.on("updateActiveEffect", (e) => effectMine(e) && this._debouncedRender())],
      ["deleteActiveEffect", Hooks.on("deleteActiveEffect", (e) => effectMine(e) && this._debouncedRender())],
      ["deleteActor", Hooks.on("deleteActor", (a) => a.uuid === this.actor.uuid && this.close())]
    ];
  }

  get title() {
    return `${game.i18n.localize("WFRPPD.Title")}: ${this.actor.name}`;
  }

  get editable() {
    return this.actor.isOwner;
  }

  /* -------------------------------------------- */
  /*  Данные                                      */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const actor = this.actor;
    const sys = actor.system;
    const cfg = game.wfrp4e.config;
    const L = (key) => game.i18n.localize(key);
    const editable = this.editable;

    const view = (item, extra = {}) => this._itemView(item, editable, extra);
    const equipped = (type) => (actor.itemTypes[type] ?? []).filter((i) => i.system.isEquipped);

    /** Слот в стиле WoW: одна иконка сверху, остальные слои считаем */
    const makeSlot = (key, items, { showAP = false, ghost = null } = {}) => {
      // Сверху - самая редкая вещь; при равной редкости порядок как был (для брони - по AP и слою)
      const rare = (i) => RARITY_RANK[i.system.availability?.value] ?? 0;
      const views = [...items].sort((a, b) => rare(b) - rare(a)).map((i) => view(i));
      if (!views.length && ghost) views.push(view(ghost, { ghost: true }));
      return {
        key,
        label: this._slotLabel(key),
        art: uiArt(SLOT_ART[key]),
        top: views[0] ?? null,
        layers: Math.max(0, views.filter((v) => !v.ghost).length - 1),
        // «+N» (сколько ещё вещей под верхней) путает: показываем только при наведении
        layersOnHover: true,
        showAP,
        ap: showAP ? (sys.status?.armour?.[key]?.value ?? 0) : null
      };
    };

    // --- Броня: сверху слой с наибольшим AP на этой локации ---
    const LAYER = { plate: 4, mail: 3, boiledLeather: 2, softLeather: 1 };
    const layerRank = (a) => LAYER[a.system.armorType?.value] ?? 0;
    const armour = equipped("armour");
    const limbs = this._limbState();
    const prosthetics = actor.items.filter((i) => i.system?.isEquipped && prostheticKind(i));
    const layerClash = this._layerConflicts();
    /** Значок «нет боеприпасов» на слоте со стрелковым оружием */
    const ammoWarn = (slot, items) => {
      const dry = items.filter((w) => this._hasAmmo(w) === false);
      if (dry.length) slot.warn = { title: [L("WFRPPD.Restr.NoAmmo"), ...dry.map((w) => `- ${w.name}`), L("WFRPPD.Restr.NoAmmoHint")].join("\n") };
      return slot;
    };
    const armourSlot = (key) => {
      const items = armour
        .filter((a) => a.system.protects?.[key] && !(key === "head" && isExtraHead(extraSlotOf(a))))
        // При равном AP сверху то, что носят поверх: латы, потом кольчуга, потом кожа
        .sort((a, b) => (b.system.AP?.[key] ?? 0) - (a.system.AP?.[key] ?? 0) || layerRank(b) - layerRank(a));
      // Протез этой конечности - в её же слот, отдельным слоем (AP не даёт)
      const prost = prosthetics.filter((pr) => pr.flags?.[MODULE_ID]?.limb === key);
      const slot = makeSlot(key, [...items, ...prost], { showAP: true });
      slot.maim = this._maimView(key, limbs);
      if (layerClash[key]) {
        slot.warn = {
          title: [L("WFRPPD.Restr.LayerSlot"), ...layerClash[key].map((a) => `- ${a.name}`), L("WFRPPD.Restr.LayerHint")].join("\n")
        };
      }
      return slot;
    };

    // --- Оружие ---
    const weapons = equipped("weapon").filter((w) => !isExtraHand(extraSlotOf(w)));
    // Лишние руки и головы от мутаций
    const extra = this._extraSlots();
    const extraSlot = (key) => {
      const items = actor.items.filter((i) => i.system?.isEquipped && extraSlotOf(i) === key);
      const slot = makeSlot(key, items, { showAP: false });
      slot.extra = true;
      slot.hint = game.i18n.format("WFRPPD.Mutation.ExtraHint", { name: extra.source[key]?.name ?? "" });
      return ammoWarn(slot, items);
    };
    const mainItems = weapons.filter((w) => !w.system.offhand?.value);
    const offItems = weapons.filter((w) => w.system.offhand?.value);
    const twoHander = mainItems.find((w) => w.system.twohanded?.value);

    const clothing = equipped("trapping").filter((t) => t.system.trappingType?.value === "clothingAccessories");

    const groups = [
      { area: "left", slots: [armourSlot("head"), ...extra.heads.map(extraSlot), ...["body", "rArm", "lArm"].map(armourSlot)] },
      {
        area: "right",
        slots: [armourSlot("rLeg"), armourSlot("lLeg"), makeSlot("accessory", clothing)]
      },
      {
        area: "weapons",
        slots: ["main", "off"].map((key) => {
          const loc = this._handLoc(key);
          // Крюк вместо кисти виден в слоте этой руки, если в ней ничего нет
          const hook = limbs[loc].hook ? limbs[loc].prosthetic : null;
          const slot = key === "main" ? makeSlot("main", mainItems, { ghost: hook }) : makeSlot("off", offItems, { ghost: twoHander ?? hook });
          slot.maim = this._maimView(loc, limbs);
          // Двуручное при руке, которой нет: значок и на основной руке (держит, если ГМ разрешил)
          const otherLoc = this._handLoc(key === "main" ? "off" : "main");
          if (!slot.maim && key === "main" && twoHander && limbs[otherLoc].noHand) slot.maim = this._maimView(otherLoc, limbs);
          // Пустая рука - это кулаки: оружие «без оружия» нельзя снять
          if (!slot.top && option("unarmed")) slot.hint = this._unarmedHint();
          else if (editable && !slot.top.ghost && option("rolls")) slot.rollId = slot.top.id;
          return ammoWarn(slot, key === "main" ? mainItems : offItems);
        }).concat(extra.hands.map(extraSlot))
      }
    ];

    // --- Сумки: три слота и раскладка по сумкам ---
    const bagAssign = this._bagAssignment();
    const bagSlots = BAG_SLOTS.map((key) => makeSlot(key, bagAssign.bySlot[key] ? [bagAssign.bySlot[key]] : []));

    const bagAll = actor.items
      .filter((i) => i.system?.isPhysical && i.type !== "money" && !i.system.isEquipped)
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, game.i18n.lang));
    const bag = bagAll.filter((i) => this._matchesFilter(i, this._filter)).map((i) => view(i));
    const bagSections = this._bagSections(bagAll, bagAssign, view);
    // Фильтры: только те, где есть хотя бы одна вещь («Всё» - всегда)
    const filterCount = (key) => bagAll.filter((i) => this._matchesFilter(i, key)).length;
    if (this._filter !== "all" && !filterCount(this._filter)) this._filter = "all";
    const filters = BAG_FILTERS.map((key) => ({
      key,
      label: L(`WFRPPD.Filter.${key}`),
      active: key === this._filter,
      count: filterCount(key)
    })).filter((f) => f.key === "all" || f.count > 0);

    // --- Статы ---
    const sets = this._statSets(mainItems, offItems, weapons);
    const statPanels = this._statPanels.map((selected) => ({
      options: STAT_SETS.map((key) => ({ key, label: L(`WFRPPD.Stats.Set.${key}`), selected: key === selected })),
      rows: sets[selected] ?? []
    }));
    const statCategories = this._statCategories(sets);
    // Вкладки дополнений (Магия и т. п.)
    const addonTabs = [...ADDONS.values()].flatMap((a) => a.tabs ?? []).filter((t) => safe(() => t.visible?.(this) ?? true, false));
    if (!["bag", "stats"].includes(this._tab) && !addonTabs.some((t) => t.id === this._tab)) this._tab = "bag";
    const activeAddonTab = addonTabs.find((t) => t.id === this._tab);

    // --- Шапка: имя, карьера, вид ---
    const career = safe(() => sys.currentCareer ?? actor.currentCareer);
    const level = career?.system?.level?.value;
    const speciesKey = sys.details?.species?.value;
    const species = speciesKey ? L(cfg.species?.[speciesKey] ?? speciesKey) : "";
    // Подзаголовок по частям: клик по карьере, виду или статусу открывает статью
    const statusValue = sys.details?.status?.value ?? "";
    const subtitleParts = [
      career && { kind: "career", text: `${career.name}${level ? ` (${L("WFRPPD.Level")} ${level})` : ""}` },
      species && { kind: "species", text: species },
      statusValue && { kind: "status", text: statusValue }
    ].filter(Boolean);
    const subtitle = subtitleParts.map((part) => part.text).join(" · ");

    const enc = sys.status?.encumbrance ?? {};
    const encCurrent = Number(enc.current) || 0;
    const encMax = Number(enc.max) || 0;
    const encRatio = encMax ? encCurrent / encMax : 0;
    // Перегруженность по книге: до x2 предела, до x3, больше x3
    let encState = "ok";
    if (encRatio > 3) encState = "max";
    else if (encRatio > 2) encState = "heavy";
    else if (encRatio > 1) encState = "over";
    const encHint = this._encHint(encState, encCurrent, encMax);

    // Иконка карьеры справа в шапке (у карьер WFRP своя картинка на каждый уровень)
    const careerClass = career?.system?.class?.value;
    const careerIcon = career?.img && !/mystery-man|item-bag|trapping\.png/.test(career.img)
      ? {
          img: career.img,
          title: [careerClass && `${L("WFRPPD.Class")}: ${careerClass}`, `${L("WFRPPD.Career")}: ${career.name}${level ? ` (${L("WFRPPD.Level")} ${level})` : ""}`]
            .filter(Boolean)
            .join("\n")
        }
      : null;

    return {
      actor,
      editable,
      img: actor.img,
      name: actor.name,
      subtitle,
      subtitleParts,
      careerIcon,
      money: this._moneyView(),
      theme: currentTheme(),
      art: {
        swap: uiArt("ui-swap-arrow"),
        caret: uiArt("ui-caret-down"),
        tabBag: uiArt("ui-tab-bag"),
        tabStats: uiArt("ui-tab-stats"),
        carried: uiArt("ui-carried"),
        pack: uiArt("ui-pack"),
        unload: uiArt("ui-delta-down"),
        options: uiArt("ui-options")
      },
      effects: this._effectsCache = this._effectsView(),
      groups,
      bag,
      bagEmpty: !bag.length,
      bagSlots,
      bagSections,
      bagOverflow: bagAssign.overflow.length
        ? game.i18n.format("WFRPPD.Bags.Overflow", { names: bagAssign.overflow.map((i) => i.name).join(", ") })
        : "",
      filters,
      sortOptions: ["default", "type", "rarity-desc", "rarity-asc", "name-asc", "name-desc"].map((key) => ({
        key,
        label: L(`WFRPPD.Sort.${key}`),
        active: key === this._sort
      })),
      viewList: this._view === "list",
      sortOpen: !!this._sortOpen,
      statPanels,
      statCategories,
      tabBag: this._tab === "bag",
      tabStats: this._tab === "stats",
      addonTabs: addonTabs.map((t) => ({ id: t.id, label: L(t.label), icon: t.icon, active: t.id === this._tab })),
      addonTabHtml: activeAddonTab ? safe(() => activeAddonTab.render(this), "") : "",
      bagToolbarHtml: addonHook("bagToolbar", this).filter(Boolean).join(""),
      restButton: this.editable && option("restButton"),
      statsTree: this._treeView(),
      hasProgression: ADDONS.has("progression"),
      xpFree: (() => {
        const e = sys.details?.experience;
        return e ? (Number(e.total) || 0) - (Number(e.spent) || 0) : null;
      })(),
      encumbrance: {
        current: encCurrent,
        max: encMax,
        pct: Math.clamp(encRatio * 100, 0, 100),
        state: encState,
        stateLabel: L(`WFRPPD.Enc.${encState}`),
        hint: encHint
      },
      vitals: this._vitals(),
      barMenuOpen: !!this._barMenuOpen
    };
  }

  /** Полоски под моделью: раны и удача (перебросы) */
  _vitals() {
    const st = this.actor.system.status ?? {};
    const F = (k, d) => game.i18n.format(k, d);
    const bar = (value, max) => {
      const v = Math.max(0, Number(value) || 0);
      const m = Math.max(0, Number(max) || 0);
      return { value: v, max: m, pct: m ? Math.clamp((v / m) * 100, 0, 100) : 0 };
    };
    const wounds = bar(st.wounds?.value, st.wounds?.max);
    // Цвет и состояние по доле оставшихся ран
    const r = wounds.max ? wounds.value / wounds.max : 1;
    const tier = !wounds.max ? "full" : wounds.value === 0 ? "dying" : r <= 0.25 ? "critical" : r <= 0.5 ? "heavy" : r <= 0.75 ? "wounded" : r < 1 ? "light" : "full";
    wounds.tier = tier;
    wounds.status = game.i18n.localize(`WFRPPD.Vitals.Tier.${tier}`);
    wounds.state = `is-${tier} ${tier === "dying" ? "is-down" : tier === "critical" ? "is-low" : ""}`.trim();
    wounds.hint = [wounds.status, F("WFRPPD.Vitals.WoundsHint", { value: wounds.value, max: wounds.max }), this.editable ? `~ ${game.i18n.localize("WFRPPD.Vitals.WoundsClick")}` : ""].filter(Boolean).join("\n");
    // Вторая полоса: что показывать, выбирает игрок (шестерёнка при наведении)
    const kind = SECOND_BARS.includes(setting("secondBar", "fortune")) ? setting("secondBar", "fortune") : "fortune";
    const exp = this.actor.system.details?.experience ?? {};
    const free = (Number(exp.total) || 0) - (Number(exp.spent) || 0);
    const src = {
      // Удача восполняется до значения судьбы в начале сессии: её и считаем максимумом
      fortune: () => bar(st.fortune?.value, Math.max(Number(st.fate?.value) || 0, Number(st.fortune?.value) || 0)),
      // Решимость восполняется до значения упорства
      resolve: () => bar(st.resolve?.value, Math.max(Number(st.resilience?.value) || 0, Number(st.resolve?.value) || 0)),
      corruption: () => bar(st.corruption?.value, st.corruption?.max),
      advantage: () => bar(st.advantage?.value, Number(st.advantage?.max) || 10),
      xp: () => bar(free, exp.total)
    };
    const second = src[kind]();
    second.kind = kind;
    second.label = game.i18n.localize(`WFRPPD.Vitals.Second.${kind}`);
    second.hint = F(`WFRPPD.Vitals.SecondHint.${kind}`, { value: second.value, max: second.max });
    second.options = SECOND_BARS.map((k) => ({ key: k, label: game.i18n.localize(`WFRPPD.Vitals.Second.${k}`), active: k === kind }));
    return { wounds, second };
  }

  /* -------------------------------------------- */
  /*  Опыт: карьера, вехи, шаги развития          */
  /* -------------------------------------------- */

  /**
   * Текущая ступень карьеры и что на ней доступно (книга, стр. 47-48).
   * Навыки: этой ступени и всех предыдущих ступеней той же карьеры.
   * Характеристики: отмеченные на ступенях до текущей включительно. Таланты: только этой ступени.
   */
  _careerInfo() {
    const actor = this.actor;
    const careers = actor.itemTypes.career ?? [];
    const cur = careers.find((c) => c.system.current?.value) ?? safe(() => actor.system.currentCareer, null);
    if (!cur?.system || !Array.isArray(cur.system.skills)) return null;
    const group = cur.system.careergroup?.value ?? cur.name;
    const level = Number(cur.system.level?.value) || 1;
    const path = careers.filter((c) => (c.system.careergroup?.value ?? c.name) === group);
    const upTo = path.filter((c) => (Number(c.system.level?.value) || 1) <= level);
    if (!upTo.includes(cur)) upTo.push(cur);
    const skills = [...new Set(upTo.flatMap((c) => c.system.skills ?? []))];
    const chars = new Set();
    for (const c of upTo) for (const [k, v] of Object.entries(c.system.characteristics ?? {})) if (v === true || v?.value) chars.add(k);
    const levels = [1, 2, 3, 4].map((n) => {
      const it = path.find((c) => Number(c.system.level?.value) === n);
      return { n, name: it?.name ?? null, current: n === level, past: n < level, complete: !!it?.system.complete?.value };
    });
    return { item: cur, group, level, need: level * 5, skills, chars, talents: cur.system.talents ?? [], levels };
  }

  /** Данные для кнопки «+» у навыка или характеристики. В ядре кнопок нет - их даёт дополнение «Развитие» */
  _advInfo() {
    return null;
  }

  /** Режим прокачки (дерево) есть только с дополнением «Развитие» */
  _treeView() {
    return this._statsView === "tree" && typeof this._advanceTree === "function";
  }

  /** Навыки персонажа на этой характеристике */
  _skillsOf(key) {
    return (this.actor.itemTypes.skill ?? []).filter((sk) => (sk.system.characteristic?.value ?? "") === key);
  }

  /** Бонус характеристики и что от него зависит (раны, нагрузка, урон) */
  _bonusEffects(key) {
    const L = (k) => game.i18n.localize(k);
    const halfling = /halfling|полурослик/i.test(String(this.actor.system.details?.species?.value ?? ""));
    const map = {
      s: [halfling ? null : ["WFRPPD.Impact.Wounds", 1], ["WFRPPD.Impact.Damage", 1], ["WFRPPD.Impact.Enc", 1]],
      t: [["WFRPPD.Impact.Wounds", 2], ["WFRPPD.Impact.Enc", 1]],
      wp: [["WFRPPD.Impact.Wounds", 1]]
    };
    return (map[key] ?? []).filter(Boolean).map(([k, n]) => ({ label: L(k), n }));
  }

  /** Подробно про бонус характеристики: как считается, на что влияет, какие таланты им ограничены */
  _bonusInfo(key) {
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);
    const c = this.actor.system.characteristics?.[key] ?? {};
    const value = Number(c.value) || 0;
    const bonus = Number(c.bonus ?? Math.floor(value / 10));
    const cfg = game.wfrp4e.config;
    const name = L(cfg.characteristics?.[key] ?? key);
    const lines = [
      `${F("WFRPPD.Bonus.Title", { name })}\t${bonus}`,
      F("WFRPPD.Bonus.How", { value, bonus }),
      `## ${L("WFRPPD.Bonus.Affects")}`,
      ...this._bonusEffects(key).map((e) => `· ${e.label}\t+${e.n} ${L("WFRPPD.Impact.PerBonusShort")}`)
    ];
    const uses = game.i18n.has(`WFRPPD.Bonus.Uses.${key}`) ? L(`WFRPPD.Bonus.Uses.${key}`) : "";
    if (uses) lines.push(...uses.split("\n").map((u) => `· ${u}`));
    // Таланты, чей предел - этот бонус
    const capped = (this.actor.itemTypes.talent ?? []).filter((t) => String(t.system.max?.value ?? "").replace(/Bonus$/i, "") === key);
    const names = [...new Set(capped.map((t) => T(t.name)))];
    if (names.length) lines.push(`· ${F("WFRPPD.Bonus.Talents", { list: names.join(", "), n: bonus })}`);
    return lines;
  }

  /** Отдых и восстановление: проверка Стойкости (+20), успех - [БВ + УУ] ран, день полного покоя - ещё +БВ */
  async _restRecover(fullDay = false) {
    if (!this.editable) return;
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);
    const actor = this.actor;
    const t = actor.system.characteristics?.t ?? {};
    const tb = Number(t.bonus ?? Math.floor((Number(t.value) || 0) / 10)) || 0;
    const skill = (actor.itemTypes.skill ?? []).find((s) => /^(endurance|стойкость)$/i.test(s.name));
    const base = Number(safe(() => skill.system.total?.value, null) ?? t.value) || 0;
    const target = base + 20;
    const roll = await new Roll("1d100").evaluate();
    const r = roll.total;
    const ok = r <= 5 || (r <= target && r < 96);
    const sl = Math.floor(target / 10) - Math.floor(r / 10);
    const w = actor.system.status?.wounds ?? {};
    const max = Number(w.max) || 0;
    const now = Number(w.value) || 0;
    const heal = (ok ? tb + Math.max(0, sl) : 0) + (fullDay ? tb : 0);
    const next = Math.min(max, now + heal);
    if (next !== now) await actor.update({ "system.status.wounds.value": next });
    const content = `<div class="wfrp-paperdoll-rest"><b>${esc(L("WFRPPD.Rest.Title"))}</b><br>${esc(
      F("WFRPPD.Rest.Roll", { r, target, sl: sl > 0 ? `+${sl}` : sl })
    )}<br><b>${esc(ok ? L("WFRPPD.Rest.Success") : L("WFRPPD.Rest.Fail"))}</b> ${esc(F("WFRPPD.Rest.Healed", { n: next - now, now: next, max }))}</div>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }), content, rolls: [roll] });
  }

  /** Цель проверки атаки оружием: значение навыка группы, иначе ББ / ДБ */
  _attackTarget(item) {
    const sys = item?.system;
    if (!sys) return null;
    const ranged = !!safe(() => sys.isRanged);
    const chars = this.actor.system.characteristics ?? {};
    const sk = safe(() => sys.skillToUse, null) ?? (this.actor.itemTypes.skill ?? []).find((s) => norm(s.name) === norm(GROUP_SKILL[sys.weaponGroup?.value] ?? ""));
    const val = Number(safe(() => sk?.system.total?.value, null));
    if (sk && val) return { target: val, from: T(sk.name) };
    const c = ranged ? "bs" : "ws";
    return { target: Number(chars[c]?.value) || 0, from: game.i18n.localize(game.wfrp4e.config.characteristics?.[c] ?? c) };
  }

  /**
   * Проверка из окна: через систему WFRP4e (диалог модификаторов, карточка в чате).
   * Если системный вызов недоступен - простой бросок d100 против цели в чат.
   */
  async _rollTest(kind, ref) {
    const actor = this.actor;
    const L = (k) => game.i18n.localize(k);
    try {
      let test = null;
      if (kind === "weapon" && actor.setupWeapon) test = await actor.setupWeapon(ref);
      else if (kind === "skill" && actor.setupSkill) test = await actor.setupSkill(ref);
      else if (kind === "char" && actor.setupCharacteristic) test = await actor.setupCharacteristic(ref);
      else throw new Error("no system test");
      if (test?.roll) await test.roll();
      return;
    } catch (err) {
      if (!/no system test/.test(String(err?.message))) console.warn("wfrp4e-paperdoll | system test", err);
    }
    // Запасной бросок
    let label = "";
    let target = 0;
    if (kind === "weapon") {
      const hit = this._attackTarget(ref);
      label = `${ref.name} (${hit?.from ?? ""})`;
      target = hit?.target ?? 0;
    } else if (kind === "skill") {
      label = T(ref.name);
      target = Number(safe(() => ref.system.total?.value, 0)) || 0;
    } else {
      const c = actor.system.characteristics?.[ref] ?? {};
      label = L(game.wfrp4e.config.characteristics?.[ref] ?? ref);
      target = Number(c.value) || 0;
    }
    const roll = await new Roll("1d100").evaluate();
    const r = roll.total;
    const ok = r <= 5 || (r <= target && r < 96);
    const sl = Math.floor(target / 10) - Math.floor(r / 10);
    const content = `<div class="wfrp-paperdoll-rest"><b>${esc(label)}</b><br>${esc(
      game.i18n.format("WFRPPD.Rest.Roll", { r, target, sl: sl > 0 ? `+${sl}` : sl })
    )}<br><b>${esc(ok ? L("WFRPPD.Rest.Success") : L("WFRPPD.Rest.Fail"))}</b></div>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }), content, rolls: [roll] });
  }

  /** Урон кулаками: БС+0 (Щадящее) */
  _unarmedDamage() {
    const c = this.actor.system.characteristics?.s ?? {};
    return Number(c.bonus ?? Math.floor((Number(c.value) || 0) / 10)) || 0;
  }

  /** Подсказка пустого слота оружия: персонаж бьёт кулаками */
  _unarmedHint() {
    const L = (k) => game.i18n.localize(k);
    return [
      L("WFRPPD.Unarmed.Name"),
      `${L("WFRPPD.Unarmed.Damage")}\t+${this._unarmedDamage()} (${L("WFRPPD.Unarmed.Formula")})`,
      `${L("WFRPPD.Unarmed.Group")}\t${L("WFRPPD.Unarmed.Brawling")}`,
      `${L("WFRPPD.Unarmed.Quality")}\t${L("WFRPPD.Unarmed.Undamaging")}`,
      `~ ${L("WFRPPD.Unarmed.Note")}`
    ].join("\n");
  }

  /** Описание таланта из самого предмета (без разметки) */
  _talentText(t) {
    const text = String(safe(() => t.system.description?.value, "") ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length > 20 ? text : "";
  }

  /** Описание из библиотеки: талант с тем же названием в компендиумах предметов (кэш на сессию) */
  async _loadTalentText(t) {
    const key = norm(t.name);
    const lib = PaperdollApp._talentLib;
    if (lib.has(key)) return lib.get(key);
    lib.set(key, "");
    const base = (n) => norm(String(n ?? "").replace(/\s*\([^)]*\)\s*$/, ""));
    try {
      for (const pack of game.packs ?? []) {
        if (pack.documentName !== "Item") continue;
        const index = await pack.getIndex({ fields: ["type"] });
        const hit = index.find((e) => (e.type ?? "talent") === "talent" && norm(e.name) === key) ?? index.find((e) => (e.type ?? "talent") === "talent" && base(e.name) === base(t.name));
        if (!hit) continue;
        const doc = await pack.getDocument(hit._id);
        const text = this._talentText(doc);
        if (text) {
          lib.set(key, text);
          break;
        }
      }
    } catch (err) {
      console.warn("wfrp4e-paperdoll | talent description", err);
    }
    return lib.get(key);
  }

  /** Подсказка таланта: крупная иконка, название, уровень и описание */
  _talentTooltip(t, lvl) {
    const L = (k) => game.i18n.localize(k);
    const max = this._talentMax(t);
    const level = max ? game.i18n.format("WFRPPD.Talent.Level", { lvl, max }) : game.i18n.format("WFRPPD.Talent.LevelNoMax", { lvl });
    const text = this._talentText(t) || PaperdollApp._talentLib.get(norm(t.name)) || "";
    const short = text.length > 900 ? `${text.slice(0, 900).trim()}…` : text;
    const loading = !text && !PaperdollApp._talentLib.has(norm(t.name));
    return `
      <div class="pd-tt-head">
        <div class="pd-tt-icon rarity-${max && lvl >= max ? "rare" : "common"}"><img src="${esc(talentImg(t.img, t.name))}" alt=""></div>
        <div class="pd-tt-title">
          <div class="pd-tt-name">${esc(T(t.name))}</div>
          <div class="pd-tt-sub">${esc(L("WFRPPD.Career.Talent"))} · ${esc(level)}</div>
        </div>
      </div>
      ${short ? `<div class="pd-tt-text pd-tr">${esc(short)}</div>` : `<div class="pd-tt-more">${esc(L(loading ? "WFRPPD.Talent.Loading" : "WFRPPD.Talent.NoText"))}</div>`}`;
  }

  _talentMax(t) {
    const sys = t.system;
    const direct = safe(() => sys.Max, null);
    if (direct !== null && direct !== undefined && direct !== "" && Number.isFinite(Number(direct))) return Number(direct);
    const v = String(sys.max?.value ?? "").trim();
    if (!v || v === "none") return null;
    if (/^\d+$/.test(v)) return Number(v);
    const ch = this.actor.system.characteristics?.[v.replace(/Bonus$/i, "")];
    return ch ? Number(ch.bonus ?? Math.floor((Number(ch.value) || 0) / 10)) : null;
  }

  /* -------------------------------------------- */
  /*  Статы в стиле WoW / ECS                     */
  /* -------------------------------------------- */

  /** Все наборы строк для выпадашек под портретом */
  _statSets(mainItems, offItems, weapons) {
    const sys = this.actor.system;
    const cfg = game.wfrp4e.config;
    const L = (key) => game.i18n.localize(key);
    const chars = sys.characteristics ?? {};
    const st = sys.status ?? {};
    const det = sys.details ?? {};

    const career = this._careerInfo();
    const charRow = (key) => {
      const c = chars[key] ?? {};
      const mod = Number(c.modifier) || 0;
      const full = cfg.characteristics?.[key];
      const adv = this._advInfo("char", key, career);
      // Подробно: начальное + шаги развития + модификатор = итог (опция)
      const parts = option("detailedStats") && c.initial !== undefined
        ? { i: Number(c.initial) || 0, a: Number(c.advances) || 0, m: mod }
        : null;
      return {
        adv,
        parts,
        done: !!adv?.reached,
        key: `char.${key}`,
        label: full ? L(full) : L(cfg.characteristicsAbbrev?.[key] ?? key),
        value: c.value ?? "-",
        cls: mod > 0 ? "is-up" : mod < 0 ? "is-down" : "",
        hint: [
          c.bonus !== undefined || c.value !== undefined ? this._bonusInfo(key).join("\n") : "",
          mod ? game.i18n.format("WFRPPD.Stats.Modified", { mod: `${mod > 0 ? "+" : "-"}${Math.abs(mod)}` }) : ""
        ]
          .filter(Boolean)
          .join("\n")
      };
    };
    // Как в WoW: прибавка от вещей и эффектов - зелёным, потеря - красным, ноль и прочерк - серым
    const row = (labelKey, value, cls = "") => {
      const v = value === undefined || value === null || value === "" ? "-" : value;
      return { key: labelKey, label: L(labelKey), value: v, cls: cls || (v === "-" || v === 0 || v === "0" ? "is-zero" : "") };
    };
    const pair = (a, b) => (a === undefined || a === null ? "-" : `${a} / ${b ?? "-"}`);
    const profile = this._profile();
    const dmg = (items, fists = false) => {
      const w = items[0];
      // Пустые руки - кулаки (БС+0)
      if (!w) return fists && option("unarmed") ? `+${this._unarmedDamage()}` : "-";
      const d = this._weaponDamage(w, profile);
      return d === null ? "-" : `+${d}`;
    };
    const ap = (loc) => st.armour?.[loc]?.value ?? 0;
    // Броня целиком от надетого: есть очки - зелёным, нет - серым
    const apCls = (...locs) => (locs.some((l) => Number(ap(l)) > 0) ? "is-up" : "is-zero");
    const ranged = weapons.find((w) => safe(() => w.system.isRanged));

    const pen = this._skillPenalties();
    const wounds = st.wounds ?? {};
    const woundsCls = wounds.max && wounds.value < wounds.max ? "is-down" : "";

    const sets = {
      // Тело: сила, выносливость, подвижность; Разум: восприятие, ум, воля, обаяние
      // Штрафы брони - рядом с тем, на что влияют, и только когда они есть
      physical: [
        ...["s", "t", "ag", "dex"].map(charRow),
        row("WFRPPD.Stats.Move", det.move?.value),
        row("WFRPPD.Stats.Run", det.move?.run),
        ...(pen.stealth ? [row("WFRPPD.Stats.StealthPenalty", `-${pen.stealth}`, "is-down")] : [])
      ],
      mental: [
        ...["i", "int", "wp", "fel"].map(charRow),
        ...(pen.perception ? [row("WFRPPD.Stats.PerceptionPenalty", `-${pen.perception}`, "is-down")] : [])
      ],
      defence: [
        row("WFRPPD.Wounds", pair(wounds.value, wounds.max), woundsCls),
        row("WFRPPD.Stats.Crits", pair(st.criticalWounds?.value ?? 0, st.criticalWounds?.max), (st.criticalWounds?.value ?? 0) > 0 ? "is-down" : ""),
        row("WFRPPD.Stats.TB", chars.t?.bonus),
        row(cfg.locations?.head ?? "head", ap("head"), apCls("head")),
        row(cfg.locations?.body ?? "body", ap("body"), apCls("body")),
        row("WFRPPD.Stats.Arms", `${ap("rArm")} / ${ap("lArm")}`, apCls("rArm", "lArm")),
        row("WFRPPD.Stats.Legs", `${ap("rLeg")} / ${ap("lLeg")}`, apCls("rLeg", "lLeg")),
      ],
      combat: [
        ...["ws", "bs"].map(charRow),
        row("WFRPPD.Stats.MainDmg", dmg(mainItems, true)),
        row("WFRPPD.Stats.OffDmg", dmg(offItems, !offItems.length && !mainItems.some((w) => w.system.twohanded?.value))),
        row("WFRPPD.Stats.RangedDmg", ranged ? dmg([ranged]) : "-"),
        row("WFRPPD.Stats.SB", chars.s?.bonus),
        row("WFRPPD.Stats.Advantage", st.advantage?.value ?? 0)
      ],
      fate: [
        row("WFRPPD.Stats.Fate", st.fate?.value),
        row("WFRPPD.Stats.Fortune", st.fortune?.value),
        row("WFRPPD.Stats.Resilience", st.resilience?.value),
        row("WFRPPD.Stats.Resolve", st.resolve?.value),
        row("WFRPPD.Stats.Corruption", pair(st.corruption?.value ?? 0, st.corruption?.max)),
        row("WFRPPD.Stats.Sin", st.sin?.value ?? 0, (st.sin?.value ?? 0) > 0 ? "is-sin" : "")
      ]
    };
    // Дополнения дописывают строки (штраф к касту и т. п.); row - тот же построитель строк
    addonHook("statSets", this, sets, { row, profile });
    return sets;
  }

  /** Категории для вкладки «Характеристики» справа (как аддон ECS) */
  _statCategories(sets) {
    const sys = this.actor.system;
    const L = (key) => game.i18n.localize(key);
    const det = sys.details ?? {};
    const exp = det.experience;
    const enc = sys.status?.encumbrance ?? {};
    // Как в WoW: прибавка от вещей и эффектов - зелёным, потеря - красным, ноль и прочерк - серым
    const row = (labelKey, value, cls = "") => {
      const v = value === undefined || value === null || value === "" ? "-" : value;
      return { key: labelKey, label: L(labelKey), value: v, cls: cls || (v === "-" || v === 0 || v === "0" ? "is-zero" : "") };
    };

    const cats = [
      {
        key: "general",
        rows: [
          row("WFRPPD.Stats.Move", det.move?.value),
          row("WFRPPD.Stats.Walk", det.move?.walk),
          row("WFRPPD.Stats.Run", det.move?.run),
          row("WFRPPD.Encumbrance", `${Number(enc.current) || 0} / ${Number(enc.max) || 0}`)
        ]
      },
      ...(this._treeView()
        ? [{ key: "tree", rows: this._advanceTree([...sets.combat.slice(0, 2), ...sets.physical.slice(0, 4), ...sets.mental.slice(0, 4)]) }]
        : [{ key: "physical", rows: sets.physical.slice(0, 4) }, { key: "mental", rows: sets.mental.slice(0, 4) }]),
      { key: "combat", rows: sets.combat },
      { key: "defence", rows: sets.defence },
      { key: "fate", rows: sets.fate }
    ];
    if (exp)
      cats.push({
        key: "experience",
        rows: [
          row("WFRPPD.Stats.ExpTotal", exp.total),
          row("WFRPPD.Stats.ExpSpent", exp.spent),
          row("WFRPPD.Stats.ExpCurrent", exp.current)
        ]
      });
    // Карьера и вехи ступени - из дополнения «Развитие»; в режиме прокачки сверху
    const career = this._careerInfo();
    const careerCat = this._careerCategory?.(career);
    if (careerCat) {
      if (this._treeView()) cats.unshift(careerCat);
      else cats.push(careerCat);
    }
    const skills = (this.actor.itemTypes.skill ?? [])
      .map((sk) => ({ sk, adv: this._advInfo("skill", sk, career), n: Number(sk.system.advances?.value) || 0 }))
      // Навыки карьеры - всегда; остальные - если уже развиты
      .filter(({ adv, n }) => (adv ? adv.inCareer !== false : false) || n > 0)
      .sort((a, b) => (b.adv?.inCareer === true) - (a.adv?.inCareer === true) || a.sk.name.localeCompare(b.sk.name));
    if (skills.length && !this._treeView()) {
      cats.push({
        key: "skills",
        rows: skills.map(({ sk, adv }) => ({
          key: sk.name,
          itemId: sk.id,
          skillRoll: true,
          label: T(sk.name),
          value: safe(() => sk.system.total?.value, null) ?? adv?.adv,
          cls: adv?.inCareer === false ? "is-outcareer" : "",
          done: !!adv?.reached,
          adv
        }))
      });
    }
    // Таланты персонажа: уровень, если взят несколько раз; в подсказке - начало описания
    // Система хранит каждый взятый уровень таланта отдельным предметом с тем же названием:
    // складываем их в одну строку, уровень = сумма шагов (как в листе персонажа)
    const byName = new Map();
    for (const t of this.actor.itemTypes.talent ?? []) {
      // по переведённому имени: «Hardy» и «Закалка» - один талант
      const k = norm(T(t.name));
      const g = byName.get(k);
      const n = Number(t.system.advances?.value) || 1;
      if (g) g.lvl += n;
      else byName.set(k, { t, lvl: n });
    }
    const talents = [...byName.values()].sort((a, b) => T(a.t.name).localeCompare(T(b.t.name)));
    const offers = this.editable && option("talentBuy") && this._talentOffers ? this._talentOffers() : [];
    if (talents.length || offers.length) {
      cats.push({
        key: "talents",
        offers,
        offersOpen: !!this._talentMenuOpen,
        offersHint: offers.length
          ? [game.i18n.localize("WFRPPD.TalentBuy.Title"), ...offers.map((o) => `${o.can ? "·" : "!"} ${o.label} ${o.lvl}→${o.lvl + 1}\t${o.cost}`), `~ ${game.i18n.localize("WFRPPD.TalentBuy.Click")}`].join("\n")
          : "",
        rows: talents.map(({ t, lvl }) => {
          const max = this._talentMax(t);
          const text = String(safe(() => t.system.description?.value, "") ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          const head = max ? game.i18n.format("WFRPPD.Talent.Level", { lvl, max }) : game.i18n.format("WFRPPD.Talent.LevelNoMax", { lvl });
          return {
            key: t.name,
            talentId: t.id,
            talentLvl: lvl,
            label: T(t.name),
            value: max ? `${lvl} / ${max}` : String(lvl),
            cls: max && lvl >= max ? "is-max" : "",
            done: !!(max && lvl >= max),
            hint: [head, text ? `» ${text.length > 400 ? `${text.slice(0, 400).trim()}…` : text}` : ""].filter(Boolean).join("\n")
          };
        })
      });
    }
    // У каждой строки - термины для поиска статьи правил (английские названия из книги + подпись)
    // Специализация в скобках статье не нужна: «Lore (Empire)» -> «Lore»
    const baseName = (t) => String(t ?? "").replace(/:$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
    const withArticle = (r) => ({
      ...r,
      article: [ARTICLE_TERMS[r.key], baseName(r.label)].filter(Boolean).join("|"),
      // Клик по названию характеристики или навыка - проверка
      rollKey: this.editable && option("rolls") && (String(r.key).startsWith("char.") || r.skillRoll) ? r.key : null
    });
    return cats.map((c) => ({
      ...c,
      rows: c.rows.map(withArticle),
      label: L(`WFRPPD.Stats.Set.${c.key}`),
      art: STAT_ART[c.key] ? uiArt(STAT_ART[c.key]) : null
    }));
  }

/**
   * Подсказка к полоске нагрузки: что перегруз делает с персонажем прямо сейчас (книга правил, «Перегруженность»).
   * Вес надетых вещей уже уменьшен на 1, вещи в сумках не считаются - это делает сама система.
   */
  _encHint(state, current, max) {
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);
    const sys = this.actor.system;
    const cfg = game.wfrp4e.config;
    const move = Number(sys.details?.move?.value) || 0;
    const ag = Number(sys.characteristics?.ag?.value) || 0;
    const agName = L(cfg.characteristics?.ag ?? "Ag");
    const lines = [F("WFRPPD.EncHint.Load", { current, max, x2: max * 2, x3: max * 3 })];
    if (state === "ok") lines.push(L("WFRPPD.EncHint.Ok"));
    else if (state === "max") lines.push(L("WFRPPD.EncHint.Max"));
    else {
      const heavy = state === "heavy";
      const newMove = Math.max(heavy ? 2 : 3, move - (heavy ? 2 : 1));
      const newAg = heavy ? Math.max(10, ag - 20) : ag - 10;
      lines.push(L(heavy ? "WFRPPD.EncHint.Heavy" : "WFRPPD.EncHint.Over"));
      lines.push(F("WFRPPD.EncHint.Move", { from: move, to: Math.min(move, newMove) }));
      lines.push(F("WFRPPD.EncHint.Char", { name: agName, from: ag, to: newAg, d: heavy ? 20 : 10 }));
      lines.push(L(heavy ? "WFRPPD.EncHint.Fatigue2" : "WFRPPD.EncHint.Fatigue"));
      lines.push(L("WFRPPD.EncHint.Extra"));
    }
    return lines.join("\n");
  }

  /** Номинал монеты в медных пенни */
  static COIN_VALUE = { gc: 240, ss: 12, bp: 1 };

  /**
   * ЛКМ по монете - +1, ПКМ - -1, с Shift - по 10.
   * Деньги сразу разменяны по номиналам: 12 п = 1 сш, 20 сш = 1 зк. Не хватает мелочи на трату - разменивается крупная монета.
   */
  async _changeMoney(key, delta) {
    if (!this.editable) return;
    const V = PaperdollApp.COIN_VALUE;
    const coins = {};
    for (const k of Object.keys(V)) coins[k] = this.actor.items.find((i) => i.type === "money" && Number(i.system.coinValue?.value) === V[k]);
    const missing = Object.keys(V).filter((k) => !coins[k]);
    if (missing.length) {
      ui.notifications.warn(game.i18n.format("WFRPPD.Money.NoCoin", { coin: missing.map((k) => game.i18n.localize(`WFRPPD.Money.Name.${k}`)).join(", ") }));
      return;
    }
    const qty = (k) => Number(coins[k].system.quantity?.value) || 0;
    let total = Object.keys(V).reduce((n, k) => n + qty(k) * V[k], 0) + delta * V[key];
    if (total < 0) {
      ui.notifications.warn(game.i18n.localize("WFRPPD.Money.NotEnough"));
      return;
    }
    const next = { gc: Math.floor(total / V.gc) };
    total -= next.gc * V.gc;
    next.ss = Math.floor(total / V.ss);
    next.bp = total - next.ss * V.ss;
    const updates = Object.keys(V)
      .filter((k) => next[k] !== qty(k))
      .map((k) => ({ _id: coins[k].id, "system.quantity.value": next[k] }));
    if (!updates.length) return;
    // Анимация и звон после перерисовки: «+1» / «-1» у нажатой монеты
    this._moneyFx = { key, delta };
    playCoinSound(delta > 0);
    await this.actor.updateEmbeddedDocuments("Item", updates);
  }

  /**
   * Открыть статью к части подзаголовка: карьера - лист карьеры,
   * вид и статус - журнал с таким названием (в мире или в компендиумах, например wfrp4e-core).
   */
  async _openArticle(kind, text, extra = []) {
    if (kind === "career") {
      const career = safe(() => this.actor.system.currentCareer ?? this.actor.currentCareer);
      if (career?.sheet) return career.sheet.render(true);
    }
    const terms = new Set([...extra, text]);
    if (kind === "status") {
      // «Brass 0», «Медь 2» -> ищем и по слову тира: Brass / Silver / Gold
      const tier = String(text).replace(/\s*\d+\s*$/, "").trim();
      if (tier) terms.add(tier);
      terms.add(game.i18n.localize("WFRPPD.Article.Status"));
    }
    if (kind === "species") terms.add(this.actor.system.details?.species?.value ?? "");
    // Лучшее совпадение: точное название > начинается с термина > содержит термин.
    // Ищем по журналам, их страницам и заголовкам внутри страниц (статья навыка - заголовок в главе книги)
    const list = [...terms].map((t) => norm(t)).filter(Boolean);
    const score = (name) => {
      // «Weapon Skill (WS)» в книге = «Weapon Skill»
      const n = norm(String(name ?? "").replace(/\s*\([^)]*\)\s*$/, ""));
      if (!n) return 0;
      let best = 0;
      for (const t of list) {
        if (n === t) best = Math.max(best, 3);
        else if (n.startsWith(`${t} `) || n.startsWith(`${t}(`)) best = Math.max(best, 2);
        else if (t.length > 3 && n.includes(t)) best = Math.max(best, 1);
      }
      return best;
    };
    let hit = null;
    const consider = (s, open) => {
      if (s > (hit?.s ?? 0)) hit = { s, open };
    };
    const scanEntry = (entry) => {
      consider(score(entry.name), () => entry.sheet.render(true));
      for (const pg of entry.pages ?? []) {
        consider(score(pg.name), () => entry.sheet.render(true, { pageId: pg.id }));
        for (const h of Object.values(safe(() => pg.toc, {}) ?? {})) {
          consider(score(h.text), () => entry.sheet.render(true, { pageId: pg.id, anchor: h.slug }));
        }
      }
    };
    for (const entry of game.journal ?? []) scanEntry(entry);
    if ((hit?.s ?? 0) < 3) {
      for (const pack of game.packs ?? []) {
        if (pack.documentName !== "JournalEntry") continue;
        const index = await pack.getIndex({ fields: ["pages.name"] });
        for (const e of index) {
          const pageHit = (e.pages ?? []).some((pg) => score(pg.name) >= 2);
          if (score(e.name) < 2 && !pageHit) continue;
          const doc = await pack.getDocument(e._id);
          if (doc) scanEntry(doc);
        }
        if ((hit?.s ?? 0) >= 3) break;
      }
    }
    // Заголовки внутри страниц компендиумов: только книги правил (их немного), один раз за сессию
    if ((hit?.s ?? 0) < 2) {
      PaperdollApp._rulebooks ??= (async () => {
        const out = [];
        for (const pack of game.packs ?? []) {
          if (pack.documentName !== "JournalEntry" || !/rule|core|книг|правил/i.test(`${pack.metadata?.label} ${pack.collection}`)) continue;
          out.push(...(await pack.getDocuments()));
        }
        return out;
      })();
      for (const doc of await PaperdollApp._rulebooks) scanEntry(doc);
    }
    if (hit) return hit.open();
    ui.notifications.info(game.i18n.format("WFRPPD.Article.NotFound", { name: text }));
  }

  /** Деньги персонажа: монеты по номиналам (1 зк = 20 сш = 240 п) */
  _moneyView() {
    const L = (k) => game.i18n.localize(k);
    const coins = this.actor.items.filter((i) => i.type === "money");
    if (!coins.length) return null;
    let total = 0;
    const by = { gc: 0, ss: 0, bp: 0 };
    const img = {};
    for (const c of coins) {
      const qty = Number(c.system.quantity?.value) || 0;
      const value = Number(c.system.coinValue?.value) || 1;
      total += qty * value;
      const key = value === 240 ? "gc" : value === 12 ? "ss" : "bp";
      by[key] += value === 240 || value === 12 || value === 1 ? qty : qty * value;
      img[key] ??= c.img;
    }
    const parts = ["gc", "ss", "bp"].map((k) => ({ key: k, value: by[k], img: img[k] ?? null, label: L(`WFRPPD.Money.${k}`), title: L(`WFRPPD.Money.Name.${k}`) }));
    const gc = Math.floor(total / 240);
    const ss = Math.floor((total % 240) / 12);
    const bp = total % 12;
    const sum = [gc && `${gc} ${L("WFRPPD.Money.gc")}`, ss && `${ss} ${L("WFRPPD.Money.ss")}`, (bp || !total) && `${bp} ${L("WFRPPD.Money.bp")}`]
      .filter(Boolean)
      .join(" ");
    return { parts, hint: game.i18n.format("WFRPPD.Money.Total", { sum }), rates: game.i18n.localize("WFRPPD.Money.Rates") };
  }

  _itemView(item, editable, extra = {}) {
    const sys = item.system;
    const qty = sys.quantity?.value ?? 1;
    return {
      id: item.id,
      name: item.name,
      img: itemImg(item.img, item.name),
      rarity: RARITY[sys.availability?.value] ?? "none",
      qty: qty > 1 ? qty : null,
      draggable: editable && !extra.ghost,
      equippable: !!sys.isEquippable && this._defaultSlot(item) !== null,
      ghost: !!extra.ghost
    };
  }

  /** Дополнительные слоты (лишние руки и головы). В ядре их нет - даёт дополнение «Мутации» */
  _extraSlots() {
    return { hands: [], heads: [], source: {} };
  }

  /**
   * Состояние конечностей: травмы, протез, работает ли рука или нога.
   * В ядре все конечности целы - травмы учитывает дополнение «Травмы»
   */
  _limbState() {
    const healthy = () => ({ injuries: [], prosthetic: null, marvel: false, lost: false, disabled: false, noHand: false, stump: false, hook: false, any: false });
    return Object.fromEntries(LIMB_LOCS.map((loc) => [loc, healthy()]));
  }

  /** Какую конечность задела травма (rArm / lArm / rLeg / lLeg) или null. Знает дополнение «Травмы» */
  _injuryLimb() {
    return null;
  }

  /** Рука, которая держит оружие в слоте main / off */
  _handLoc(slot) {
    const main = safe(() => this.actor.mainArmLoc, null) ?? "rArm";
    if (slot === "main") return main;
    return main === "rArm" ? "lArm" : "rArm";
  }

  /** Значок на слоте: что не так с конечностью. В ядре его нет - даёт дополнение «Травмы» */
  _maimView() {
    return null;
  }

  _matchesFilter(item, filter) {
    switch (filter) {
      case "weapon":
        return item.type === "weapon" || item.type === "ammunition";
      case "armour":
        return item.type === "armour";
      case "clothing":
        return (
          item.type === "container" ||
          (item.type === "trapping" && item.system.trappingType?.value === "clothingAccessories")
        );
      case "other":
        return !["weapon", "ammunition", "armour", "container"].includes(item.type) &&
          !(item.type === "trapping" && item.system.trappingType?.value === "clothingAccessories");
      default:
        return true;
    }
  }

  /* -------------------------------------------- */
  /*  Правила слотов                              */
  /* -------------------------------------------- */

  /** Можно ли положить предмет в этот слот */
  _canDrop(item, slot) {
    if (!item) return false;
    const sys = item.system;
    const pk = prostheticKind(item);
    if (pk) {
      // Протез - в слот своей конечности: крюк на руку, нога на ногу, инженерное чудо куда угодно
      if (!LIMB_LOCS.includes(slot)) return false;
      return pk === "marvel" || (pk === "hook" ? isArmLoc(slot) : !isArmLoc(slot));
    }
    if (isExtraHand(slot)) return item.type === "weapon";
    if (isExtraHead(slot)) return item.type === "armour" && !!sys.protects?.head;
    if (LOCATIONS.includes(slot)) return item.type === "armour" && !!sys.protects?.[slot];
    if (slot === "main" || slot === "off") return item.type === "weapon";
    if (slot === "accessory")
      return item.type === "trapping" && sys.trappingType?.value === "clothingAccessories";
    if (slot === "container" || isBagSlot(slot)) return item.type === "container";
    return false;
  }

  /** Слот по умолчанию для двойного клика */
  _defaultSlot(item) {
    const sys = item.system;
    const pk = prostheticKind(item);
    if (pk) {
      // Сначала туда, где конечности не хватает
      const limbs = this._limbState();
      const fits = LIMB_LOCS.filter((loc) => this._canDrop(item, loc));
      return fits.find((loc) => limbs[loc].lost || limbs[loc].disabled) ?? fits[0] ?? null;
    }
    if (item.type === "armour") return LOCATIONS.find((l) => sys.protects?.[l]) ?? null;
    if (item.type === "container") {
      const { bySlot } = this._bagAssignment();
      return BAG_SLOTS.find((k) => !bySlot[k]) ?? null;
    }
    if (item.type === "trapping")
      return sys.trappingType?.value === "clothingAccessories" ? "accessory" : null;
    if (item.type === "weapon") {
      if (sys.twohanded?.value) return "main";
      const equippedWeapons = this.actor.itemTypes.weapon.filter((w) => w.system.isEquipped);
      const mainBusy = equippedWeapons.some((w) => !w.system.offhand?.value);
      const offBusy = equippedWeapons.some((w) => w.system.offhand?.value || w.system.twohanded?.value);
      const isShield = !!safe(() => sys.properties?.qualities?.shield, false);
      if (isShield && !offBusy) return "off";
      if (mainBusy && !offBusy) return "off";
      return "main";
    }
    return null;
  }

  /* -------------------------------------------- */
  /*  Сумки                                       */
  /* -------------------------------------------- */

  /**
   * Какая надетая сумка в каком слоте.
   * Номер слота хранится во флаге предмета; надетые без флага занимают свободные слоты по порядку.
   * Всё, что не влезло в 3 слота (надели с обычного листа), - overflow.
   */
  _bagAssignment() {
    const worn = (this.actor.itemTypes.container ?? []).filter((c) => c.system.isEquipped);
    const bySlot = {};
    const rest = [];
    for (const c of worn) {
      const want = c.flags?.[MODULE_ID]?.bagSlot;
      if (isBagSlot(want) && !bySlot[want]) bySlot[want] = c;
      else rest.push(c);
    }
    const overflow = [];
    for (const c of rest) {
      const free = BAG_SLOTS.find((k) => !bySlot[k]);
      if (free) bySlot[free] = c;
      else overflow.push(c);
    }
    const slotOf = new Map(Object.entries(bySlot).map(([k, c]) => [c.id, k]));
    return { bySlot, overflow, slotOf };
  }

  /** Сколько веса лежит в контейнере и сколько он вмещает */
  _bagLoad(container) {
    const inside = this.actor.items.filter((i) => i.system?.location?.value === container.id && !i.system.isEquipped);
    const used = inside.reduce((n, i) => n + (Number(i.system.encumbrance?.total ?? i.system.encumbrance?.value) || 0), 0);
    const cap = Number(container.system.carries?.value) || 0;
    return { inside, used: Math.round(used * 100) / 100, cap };
  }

  /**
   * Разделы вкладки «Сумка»: каждая надетая сумка, потом ненадетые контейнеры с вещами,
   * в конце - «При себе» (вещи вне сумок).
   */
  _bagSections(bagAll, assign, view) {
    const L = (k) => game.i18n.localize(k);
    const containers = this.actor.itemTypes.container ?? [];
    const filter = (i) => this._matchesFilter(i, this._filter);
    const emptyCells = (n) => Array.from({ length: Math.max(0, n) }, (_, i) => i);
    // Сортировка вещей внутри разделов: по редкости или по алфавиту
    const rank = (i) => RARITY_RANK[i.system.availability?.value] ?? 0;
    const byName = (a, b) => a.name.localeCompare(b.name, game.i18n.lang);
    // По типу: оружие ближнего боя, стрелковое, боеприпасы, броня (сверху вниз), одежда, сумки, остальное
    const typeRank = (i) => {
      const sys = i.system;
      if (i.type === "weapon") return safe(() => sys.isRanged) ? 1 : 0;
      if (i.type === "ammunition") return 2;
      if (i.type === "armour") return 3 + (["head", "body", "rArm", "lArm", "rLeg", "lLeg"].findIndex((l) => sys.protects?.[l] || (sys.AP?.[l] ?? 0) > 0) + 1) / 10;
      if (i.type === "trapping" && sys.trappingType?.value === "clothingAccessories") return 4;
      if (i.type === "container") return 5;
      if (i.type === "trapping") return 6 + (String(sys.trappingType?.value ?? "misc").charCodeAt(0) % 20) / 100;
      return 7;
    };
    const sorters = {
      type: (a, b) => typeRank(a) - typeRank(b) || byName(a, b),
      "rarity-desc": (a, b) => rank(b) - rank(a) || byName(a, b),
      "rarity-asc": (a, b) => rank(a) - rank(b) || byName(a, b),
      "name-asc": byName,
      "name-desc": (a, b) => byName(b, a)
    };
    const sorted = (list) => (sorters[this._sort] ? [...list].sort(sorters[this._sort]) : list);
    const section = (c, kind) => {
      const { inside, used, cap } = this._bagLoad(c);
      // Фильтр не прячет вещи в сумке, а гасит их: иначе кажется, что в сумке есть место
      const items = sorted(inside).map((i) => ({ ...view(i), dimmed: !filter(i) }));
      const over = cap > 0 && used > cap;
      const slot = kind === "worn" ? assign.slotOf.get(c.id) ?? "" : "";
      return {
        id: c.id,
        kind,
        slot,
        name: c.name,
        img: itemImg(c.img, c.name),
        // Пустые ячейки как в WoW: у сумки столько ячеек, сколько пунктов вмещает
        // Пустые ячейки = сколько пунктов нагрузки ещё влезет (вместимость сумки - в весе, а не в штуках)
        cells: emptyCells(Math.floor(cap - used + 1e-9)),
        slotLabel: kind === "worn" ? this._slotLabel(assign.slotOf.get(c.id) ?? "") : L("WFRPPD.Bags.NotWorn"),
        used,
        cap,
        hasCap: cap > 0,
        pct: cap ? Math.clamp((used / cap) * 100, 0, 100) : 0,
        over,
        full: cap > 0 && used >= cap,
        items,
        canUnload: this.editable && items.length > 0,
        empty: false
      };
    };

    const worn = BAG_SLOTS.map((k) => assign.bySlot[k]).filter(Boolean);
    // Слоты сумок по порядку; свободный слот - пустой раздел, клик по иконке надевает сумку
    const sections = BAG_SLOTS.map((k) =>
      assign.bySlot[k]
        ? section(assign.bySlot[k], "worn")
        : {
            id: `slot-${k}`,
            kind: "free",
            slot: k,
            name: this._slotLabel(k),
            img: uiArt("slot-bag"),
            slotLabel: L("WFRPPD.Bags.FreeSlot"),
            hasCap: false,
            items: [],
            cells: [],
            empty: false,
            noGrid: true
          }
    );
    // Ненадетые контейнеры показываем, только если в них что-то лежит
    for (const c of containers) {
      if (c.system.isEquipped) continue;
      if (this._bagLoad(c).inside.length) sections.push(section(c, "stored"));
    }
    const shown = new Set(sections.map((sec) => sec.id));
    const loose = bagAll.filter((i) => !shown.has(i.system?.location?.value) && !(shown.has(i.id) && i.type === "container"));
    sections.push({
      id: "",
      kind: "loose",
      name: L("WFRPPD.Bags.Loose"),
      img: null,
      slotLabel: "",
      hasCap: false,
      looseWeight: String(Math.round(loose.reduce((n, i) => n + this._weightOf(i), 0) * 100) / 100),
      // Кнопка только когда реально есть что и куда положить
      canPack: this.editable && (() => {
        const maxFree = Math.max(0, ...worn.map((c) => { const { used, cap } = this._bagLoad(c); return cap - used; }));
        return loose.some((i) => this._packable(i) && this._weightOf(i) > 0 && this._weightOf(i) <= maxFree);
      })(),
      items: sorted(loose).map((i) => ({ ...view(i), dimmed: !filter(i) })),
      isLoose: true,
      // «При себе» без вместимости: добиваем пустыми ячейками до полного ряда
      cells: emptyCells((BAG_COLS - (loose.length % BAG_COLS)) % BAG_COLS || (loose.length ? 0 : BAG_COLS)),
      empty: false
    });
    return sections;
  }

  /** Вес предмета в пунктах нагрузки (с учётом количества) */
  _weightOf(item) {
    return Number(item.system.encumbrance?.total ?? (item.system.encumbrance?.value ?? 0) * (item.system.quantity?.value ?? 1)) || 0;
  }

  /**
   * Можно ли убрать вещь в сумку при авто-раскладке.
   * Здравый смысл из книги: двуручное и древковое оружие в рюкзак не лезет,
   * сумки в сумки не кладём.
   */
  _packable(item) {
    if (item.type === "container" || item.type === "money") return false;
    if (item.system.isEquipped) return false;
    if (item.type === "weapon") {
      const group = item.system.weaponGroup?.value;
      if (item.system.twohanded?.value || ["polearm", "cavalry"].includes(group)) return false;
    }
    return true;
  }

  /**
   * «Разложить по сумкам»: самые тяжёлые вещи «при себе» уходят в надетые сумки.
   * Жадно по убыванию веса; каждую вещь кладём в сумку, где после неё останется меньше всего места
   * (так в большие сумки влезает больше). Вещи с нулевым весом не трогаем - нагрузку они не дают.
   */
  async _autoPack() {
    if (!this.editable) return;
    const { bySlot } = this._bagAssignment();
    const bags = BAG_SLOTS.map((k) => bySlot[k]).filter(Boolean);
    if (!bags.length) return ui.notifications.warn(game.i18n.localize("WFRPPD.Bags.NoBags"));

    const free = new Map(bags.map((b) => {
      const { used, cap } = this._bagLoad(b);
      return [b.id, cap > 0 ? cap - used : 0];
    }));
    const bagIds = new Set(this.actor.items.filter((i) => i.type === "container").map((i) => i.id));
    const loose = this.actor.items
      .filter((i) => i.system?.isPhysical && !i.system.isEquipped && !bagIds.has(i.system.location?.value))
      .filter((i) => this._packable(i) && this._weightOf(i) > 0)
      .sort((a, b) => this._weightOf(b) - this._weightOf(a) || a.name.localeCompare(b.name, game.i18n.lang));

    const updates = [];
    const skipped = [];
    let moved = 0;
    for (const item of loose) {
      const w = this._weightOf(item);
      const fits = bags.filter((b) => free.get(b.id) >= w);
      if (!fits.length) {
        skipped.push(item.name);
        continue;
      }
      const target = fits.sort((a, b) => free.get(a.id) - free.get(b.id))[0];
      free.set(target.id, free.get(target.id) - w);
      updates.push({ _id: item.id, "system.location.value": target.id });
      moved += w;
    }

    if (!updates.length) return ui.notifications.info(game.i18n.localize("WFRPPD.Bags.PackNothing"));
    try {
      await this.actor.updateEmbeddedDocuments("Item", updates);
    } catch (err) {
      console.warn(`${MODULE_ID} | auto-pack failed`, err);
      return;
    }
    const msg = game.i18n.format("WFRPPD.Bags.Packed", { n: updates.length, w: Math.round(moved * 100) / 100 });
    const names = skipped.length > 4
      ? `${skipped.slice(0, 4).join(", ")} ${game.i18n.format("WFRPPD.Bags.AndMore", { n: skipped.length - 4 })}`
      : skipped.join(", ");
    const rest = skipped.length ? " " + game.i18n.format("WFRPPD.Bags.PackSkipped", { names }) : "";
    ui.notifications.info(msg + rest);
  }

  /** Переложить предмет в контейнер (или достать, если containerId пустой) */
  async _moveToContainer(item, containerId) {
    if (!this.editable || !item) return;
    if (item.id === containerId) return;
    if ((item.system.location?.value ?? "") === containerId && !item.system.isEquipped) return;
    if (containerId) {
      const container = this.actor.items.get(containerId);
      if (!container) return;
      // Сумку в сумку не кладём
      if (item.type === "container") {
        ui.notifications.warn(game.i18n.format("WFRPPD.Bags.NoNesting", { item: item.name }));
        return;
      }
      const { used, cap } = this._bagLoad(container);
      // Надетая вещь в сумке снимется и потеряет скидку «надето -1»: считаем полный вес
      const weight = item.system.isEquipped
        ? (Number(item.system.encumbrance?.value) || 0) * (Number(item.system.quantity?.value) || 1)
        : Number(item.system.encumbrance?.total ?? item.system.encumbrance?.value) || 0;
      if (cap > 0 && used + weight > cap) {
        ui.notifications.warn(
          game.i18n.format("WFRPPD.Bags.Full", { bag: container.name, used, cap, weight })
        );
        return;
      }
    }
    const update = { "system.location.value": containerId };
    if (item.system.isEquipped) update["system.equipped.value"] = false;
    try {
      await item.update(update);
    } catch (err) {
      console.warn(`${MODULE_ID} | move failed`, err);
    }
  }

  /** Надеть сумку в конкретный слот; то, что там было, снимается */
  async _equipBag(item, slot) {
    await this._pinBags();
    const { bySlot, slotOf } = this._bagAssignment();
    const occupant = bySlot[slot];
    const from = slotOf.get(item.id);
    if (occupant && occupant.id !== item.id) {
      // Сумка уже надета в другом слоте - меняем их местами, иначе прежнюю снимаем
      if (from) await occupant.update({ [`flags.${MODULE_ID}.bagSlot`]: from });
      else await occupant.update({ "system.equipped.value": false, [`flags.${MODULE_ID}.bagSlot`]: null });
    }
    await item.update({ "system.equipped.value": true, [`flags.${MODULE_ID}.bagSlot`]: slot });
  }

  /** Предмет сейчас лежит именно в этом слоте */
  _isInSlot(item, slot) {
    if (!item.system.isEquipped || !this._canDrop(item, slot)) return false;
    if (prostheticKind(item)) return item.flags?.[MODULE_ID]?.limb === slot;
    // Вещь в лишней руке или на второй голове - только там
    if (isExtraSlot(slot) || isExtraSlot(extraSlotOf(item))) return extraSlotOf(item) === slot;
    if (isBagSlot(slot)) return this._bagAssignment().slotOf.get(item.id) === slot;
    if (item.type === "weapon") {
      const off = !!item.system.offhand?.value;
      return slot === "off" ? off : !off;
    }
    return true;
  }

  /** Что сейчас в слоте и чем его можно заменить (для быстрой смены) */
  _swapCandidates(slot) {
    const fits = this.actor.items.filter((i) => this._canDrop(i, slot));
    const current = fits.filter((i) => this._isInSlot(i, slot));
    let available = fits.filter((i) => !this._isInSlot(i, slot));
    // Протезы в списке - только для потерянной конечности (перетащить можно куда угодно)
    if (LIMB_LOCS.includes(slot) && !this._limbState()[slot].lost) available = available.filter((i) => !prostheticKind(i));
    // Двуручное во вторую руку не предлагаем - оно всё равно уйдёт в основную
    if (slot === "off" || isExtraHand(slot)) available = available.filter((i) => !i.system.twohanded?.value);
    // Сумки, надетые в других слотах, - отдельной группой: выбор такой сумки меняет слоты местами
    let worn = [];
    if (isBagSlot(slot)) {
      worn = available.filter((i) => i.system.isEquipped);
      available = available.filter((i) => !i.system.isEquipped);
    }
    const byName = (a, b) => a.name.localeCompare(b.name, game.i18n.lang);
    return { current: current.sort(byName), available: available.sort(byName), worn: worn.sort(byName) };
  }

  /* -------------------------------------------- */
  /*  Эффекты: состояния, травмы, болезни         */
  /* -------------------------------------------- */

  /**
   * Всё, что сейчас висит на персонаже, в одну ленту как баффы/дебаффы в WoW:
   * - состояния WFRP (кровотечение, усталость...) - ЛКМ снимает 1 уровень;
   * - эффекты на самом персонаже (например, от местности) - ЛКМ выключает/включает;
   * - травмы, критические раны, болезни - со сроком заживления, ЛКМ открывает.
   */
  _effectsView() {
    const actor = this.actor;
    const cfg = game.wfrp4e.config;
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);
    const out = [];

    for (const effect of actor.effects ?? []) {
      const statuses = [...(effect.statuses ?? [])];
      const condition = statuses.find((st) => cfg.conditions?.[st]);
      if (condition) {
        const value = Number(effect.conditionValue ?? effect.system?.condition?.value) || null;
        out.push({
          kind: "condition",
          id: effect.id,
          key: condition,
          name: T(effect.name || L(cfg.conditions[condition])),
          img: effect.img,
          value: value && value > 1 ? value : null,
          left: effectRemaining(effect),
          debuff: true,
          lines: [effect.description ? plainEnrichers(stripTags(effect.description)) : ""],
          hint: L(this.editable ? "WFRPPD.Effects.HintCondition" : "WFRPPD.Effects.HintOpen")
        });
        continue;
      }
      // Эффекты, перенесённые с предметов и талантов, - «пассивки»: только с опцией
      if (effect.parent !== actor || effect.transfer === true && effect.origin) continue;
      const pol = effectPolarity(effect);
      out.push({
        kind: pol === "buff" ? "buff" : "effect",
        id: effect.id,
        name: effect.name,
        img: effect.img,
        disabled: !!effect.disabled,
        left: effectRemaining(effect),
        debuff: pol !== "buff",
        lines: [effect.description ? plainEnrichers(stripTags(effect.description)) : ""],
        hint: L(this.editable ? "WFRPPD.Effects.HintRemovable" : "WFRPPD.Effects.HintOpen")
      });
    }

    // Эффекты с предметов персонажа (таланты, психология, черты, вещи):
    // временные (Ярость и т. п.) - всегда, постоянные пассивки - только с опцией «Пассивные баффы»
    const passive = option("passiveBuffs");
    for (const item of actor.items ?? []) {
      for (const effect of item.effects ?? []) {
        if (effect.disabled || effect.isSuppressed) continue;
        if (effect.transfer === false) continue;
        const temporary = !!safe(() => effect.isTemporary, false);
        if (!temporary && !passive) continue;
        const pol = effectPolarity(effect);
        if (pol === "debuff" && !temporary) continue;
        out.push({
          kind: pol === "debuff" ? "effect" : "buff",
          id: effect.id,
          itemId: item.id,
          passive: !temporary,
          name: effect.name || item.name,
          img: effect.img || item.img,
          left: temporary ? effectRemaining(effect) : null,
          debuff: pol === "debuff",
          lines: [
            game.i18n.format("WFRPPD.Effects.From", { name: item.name }),
            effect.description ? plainEnrichers(stripTags(effect.description)) : ""
          ],
          // Временный (Ярость и т. п.) - можно снять им самим, не трогая талант; пассивку снимают через сам предмет
          hint: L(temporary && this.editable ? "WFRPPD.Effects.HintRemovable" : "WFRPPD.Effects.HintItemEffect")
        });
      }
    }

    const locName = (key) => (cfg.locations?.[key] ? L(cfg.locations[key]) : key);
    // Травма конечности, которую заменило инженерное чудо, больше не действует
    const limbs = this._limbState();
    const negated = (injury) => {
      const loc = this._injuryLimb(injury);
      return !!(loc && limbs[loc]?.marvel);
    };
    for (const injury of actor.itemTypes.injury ?? []) {
      const sys = injury.system;
      const dur = sys.duration ?? {};
      let left = null;
      if (dur.permanent) left = L("WFRPPD.Effects.Permanent");
      else if (dur.active && dur.value) left = F("WFRPPD.Effects.DaysLeft", { n: dur.value });
      else if (dur.value) left = F("WFRPPD.Effects.HealsIn", { n: dur.value });
      out.push({
        kind: "injury",
        id: injury.id,
        name: injury.name,
        img: itemImg(injury.img, injury.name),
        value: dur.active && Number(dur.value) ? Number(dur.value) : null,
        debuff: !negated(injury),
        negated: negated(injury),
        lines: [
          sys.location?.value ? `${L("WFRPPD.Effects.Location")}: ${locName(sys.location.key ?? sys.location.value)}` : "",
          sys.penalty?.value ? `${L("WFRPPD.Effects.Penalty")}: ${sys.penalty.value}` : "",
          negated(injury) ? L("WFRPPD.Limb.MarvelHint") : "",
          left ?? ""
        ],
        hint: L(this.editable ? "WFRPPD.Effects.HintRemovable" : "WFRPPD.Effects.HintOpen")
      });
    }
    for (const crit of actor.itemTypes.critical ?? []) {
      const sys = crit.system;
      out.push({
        kind: "critical",
        id: crit.id,
        name: crit.name,
        img: itemImg(crit.img, crit.name),
        debuff: true,
        lines: [
          sys.location?.value ? `${L("WFRPPD.Effects.Location")}: ${locName(sys.location.key ?? sys.location.value)}` : "",
          sys.wounds?.value ? `${L("WFRPPD.Wounds")}: ${sys.wounds.value}` : "",
          sys.modifier?.value ? `${L("WFRPPD.Effects.Penalty")}: ${sys.modifier.value}` : ""
        ],
        hint: L(this.editable ? "WFRPPD.Effects.HintRemovable" : "WFRPPD.Effects.HintOpen")
      });
    }
    for (const disease of actor.itemTypes.disease ?? []) {
      const sys = disease.system;
      const inc = sys.incubation ?? {};
      const dur = sys.duration ?? {};
      const state = dur.active
        ? F("WFRPPD.Effects.DiseaseActive", { n: dur.value ?? "?", unit: dur.unit ?? "" })
        : inc.active
          ? F("WFRPPD.Effects.DiseaseIncubation", { n: inc.value ?? "?", unit: inc.unit ?? "" })
          : "";
      out.push({
        kind: "disease",
        id: disease.id,
        name: disease.name,
        img: itemImg(disease.img, disease.name),
        debuff: true,
        lines: [state, sys.symptoms?.value ? `${L("WFRPPD.Effects.Symptoms")}: ${sys.symptoms.value}` : ""],
        hint: L(this.editable ? "WFRPPD.Effects.HintRemovable" : "WFRPPD.Effects.HintOpen")
      });
    }

    // Дополнения добавляют свои записи (например, мутации)
    addonHook("effects", this, out);

    // Сначала баффы, потом остальное; на стыке - разделитель
    const buffs = out.filter((e) => e.kind === "buff");
    const rest = out.filter((e) => e.kind !== "buff");
    return [...buffs, ...rest].map((e) => ({ ...e, isBuff: e.kind === "buff", lines: e.lines.filter(Boolean).map((l) => humanizeTerms(l)) }));
  }

  /** ЛКМ по эффекту */
  /** Диалог подтверждения снятия (единый для травм/критов/болезней/эффектов) */
  async _confirmRemoveEffect(name) {
    const Dialog = foundry.applications?.api?.DialogV2;
    if (!Dialog) return true;
    const content = `<p>${game.i18n.format("WFRPPD.Effects.DeleteConfirm", { name: foundry.utils.escapeHTML?.(name) ?? name })}</p>`;
    return Dialog.confirm({ window: { title: game.i18n.localize("WFRPPD.Effects.DeleteTitle") }, content });
  }

  /** Сама запись ленты как ActiveEffect-документ: с предмета - из его effects, иначе - с самого актёра */
  _effectDoc(entry) {
    return entry.itemId ? this.actor.items.get(entry.itemId)?.effects?.get(entry.id) : this.actor.effects.get(entry.id);
  }

  /** Лист, который открывает запись ленты эффектов: пассивку - через её предмет, всё остальное - сама запись */
  _effectSheet(entry) {
    if (entry.itemId && entry.passive) this.actor.items.get(entry.itemId)?.sheet?.render(true);
    else if (["condition", "effect", "buff"].includes(entry.kind)) this._effectDoc(entry)?.sheet?.render(true);
    else this.actor.items.get(entry.id)?.sheet?.render(true);
  }

  /**
   * ЛКМ по записи ленты - везде одно правило: Shift - снять (с подтверждением, кроме уровня состояния
   * и пассивки с предмета - их снять нельзя, у них нет своего «снять»), без Shift - открыть лист.
   * Исключение - состояние: ЛКМ без Shift снимает 1 уровень (как было), это самое частое действие с ним.
   */
  async _onEffectClick(entry, ev = null) {
    if (!this.editable) return;
    try {
      // Дополнение может забрать клик себе (вернуть true)
      for (const a of ADDONS.values()) if (a.effectClick && (await a.effectClick(this, entry, ev))) return;

      if (ev?.shiftKey) {
        if (["injury", "critical", "disease"].includes(entry.kind)) {
          const item = this.actor.items.get(entry.id);
          if (item && (await this._confirmRemoveEffect(item.name))) await item.delete();
          return;
        }
        if (entry.kind === "condition") {
          await this.actor.effects.get(entry.id)?.delete();
          return;
        }
        if (entry.kind === "effect" || entry.kind === "buff") {
          if (entry.itemId && entry.passive) return; // пассивку с предмета так не снять - её источник предмет/талант
          const effect = this._effectDoc(entry);
          if (effect && (await this._confirmRemoveEffect(effect.name))) await effect.delete();
        }
        return;
      }

      if (entry.kind === "condition") {
        if (typeof this.actor.removeCondition === "function") await this.actor.removeCondition(entry.key, 1);
        else await this.actor.effects.get(entry.id)?.delete();
        return;
      }
      this._effectSheet(entry);
    } catch (err) {
      console.warn(`${MODULE_ID} | effect action failed`, err);
    }
  }

  /** ПКМ по эффекту - всегда открыть лист (эффекта или его предмета-источника) */
  _onEffectContext(entry) {
    this._effectSheet(entry);
  }

  /* -------------------------------------------- */
  /*  Профиль ограничений персонажа               */
  /* -------------------------------------------- */

  /** Навыки, таланты, магия и бог - всё, что влияет на выбор снаряжения */
  _profile() {
    const actor = this.actor;
    const names = (type) => (actor.itemTypes[type] ?? []).map((i) => i.name);
    const skills = names("skill");
    const talents = actor.itemTypes.talent ?? [];
    const talentLevel = (re) =>
      talents.filter((t) => re.test(t.name)).reduce((n, t) => n + (Number(t.system?.advances?.value) || 1), 0);

    const arcane = talents.filter((t) => /^(arcane magic|школа магии)/i.test(t.name)).map((t) => t.name);
    const petty = talentLevel(/^(petty magic|малая магия)/i) > 0;
    const witch = talentLevel(/^(witch|ведьм)/i) > 0;
    const lores = arcane.map((n) => (n.match(/\(([^)]+)\)/)?.[1] ?? "").toLowerCase());

    const godText = [sys(actor).details?.god?.value ?? "", ...talents.map((t) => t.name)].join(" ");
    const cults = CULT_RULES.filter((c) => c.match.test(godText));

    return {
      hasSkills: skills.length > 0,
      hasSkill: (name) => skills.some((s) => s.toLowerCase() === name.toLowerCase()),
      caster: arcane.length > 0 || petty || witch || (actor.itemTypes.spell ?? []).length > 0,
      metalLore: lores.some((l) => /metal|металл/.test(l)),
      beastLore: lores.some((l) => /beast|звер/.test(l)),
      ambidextrous: Math.min(2, talentLevel(/^(ambidextrous|амбидекстр)/i)),
      mightyBlow: talentLevel(/^(strike mighty blow|могучий удар)/i),
      accurateShot: talentLevel(/^(accurate shot|точный выстрел)/i),
      sureShot: talentLevel(/^(sure shot|верный выстрел)/i),
      dualWielder: talentLevel(/^(dual wielder|двойная атака)/i) > 0,
      frenzy: talentLevel(/^(frenzy|ярость)/i) > 0,
      cults
    };
  }

  /**
   * Бонусы талантов к оружию, которые система добавляет только в момент броска.
   * dmg - прибавка к урону, parts - откуда она, info - пометки без влияния на урон.
   */
  _weaponBonuses(item, profile = this._profile()) {
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);
    const out = { dmg: 0, parts: [], info: [], score: 0 };
    if (item?.type !== "weapon") return out;
    const ranged = !!safe(() => item.system.isRanged);
    if (!ranged && profile.mightyBlow) {
      out.dmg += profile.mightyBlow;
      out.parts.push(F("WFRPPD.Talent.MightyBlow", { n: profile.mightyBlow }));
    }
    if (ranged && profile.accurateShot) {
      out.dmg += profile.accurateShot;
      out.parts.push(F("WFRPPD.Talent.AccurateShot", { n: profile.accurateShot }));
    }
    if (ranged && profile.sureShot) {
      out.info.push(F("WFRPPD.Talent.SureShot", { n: profile.sureShot }));
      out.score += profile.sureShot * 30;
    }
    if (!ranged && profile.frenzy) out.info.push(L("WFRPPD.Talent.Frenzy"));
    return out;
  }

  /** Урон оружия с учётом талантов (число или null) */
  _weaponDamage(item, profile = this._profile()) {
    const base = safe(() => item.system.Damage);
    if (base === null || base === undefined || base === "") return null;
    const n = Number(base);
    if (Number.isNaN(n)) return null;
    return n + this._weaponBonuses(item, profile).dmg;
  }

  /** Надетая броня (плюс примерка ещё одной вещи) */
  _wornArmour(extra = null) {
    const worn = this.actor.itemTypes.armour?.filter((a) => a.system.isEquipped) ?? [];
    return extra && !worn.includes(extra) ? [...worn, extra] : worn;
  }

  /**
   * Слои брони: на одной части тела можно сочетать жёсткий доспех
   * только с гибкой бронёй или мягкой кожей под ним (стр. 300).
   * Возвращает { loc: [жёсткие вещи] } там, где их больше одной.
   */
  _layerConflicts(extra = null) {
    const out = {};
    const list = this._wornArmour(extra).filter((a) => !isUnderLayer(a));
    for (const loc of LOCATIONS) {
      const rigid = list.filter((a) => (a.system.AP?.[loc] ?? 0) > 0);
      if (rigid.length > 1) out[loc] = rigid;
    }
    return out;
  }

  /** Суммарные штрафы брони к скрытности и наблюдательности (со всеми надетыми вещами) */
  _skillPenalties(extra = null) {
    const sum = { stealth: 0, perception: 0 };
    for (const a of this._wornArmour(extra)) {
      const p = armourSkillPenalties(a);
      sum.stealth += p.stealth;
      sum.perception += p.perception;
    }
    return sum;
  }

  /** Есть ли у персонажа подходящие боеприпасы (null - этому оружию не нужны) */
  _hasAmmo(weapon) {
    if (!safe(() => weapon.system.isRanged)) return null;
    const group = weaponAmmoGroup(weapon);
    if (!group) return null;
    return (this.actor.itemTypes.ammunition ?? []).some(
      (a) => ammoGroupOf(a) === group && (Number(a.system.quantity?.value ?? 1) || 0) > 0
    );
  }

  /**
   * Ограничения предмета для слота.
   * forbid - нельзя по правилам (не участвует в BIS),
   * warn - можно, но со штрафом (score - насколько это хуже).
   */
  _restrictions(item, slot, profile = this._profile()) {
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);
    const sys = item.system;
    const forbid = [];
    const warn = [];
    let score = 0;

    if (item.type === "weapon") {
      const group = sys.weaponGroup?.value;
      const skillName = GROUP_SKILL[group] ?? group;
      const trained = !!safe(() => sys.skillToUse, null);
      if (profile.hasSkills && !trained) {
        if (safe(() => sys.isRanged) && !RANGED_FALLBACK.includes(group)) {
          forbid.push({ label: F("WFRPPD.Restr.NoSkill", { skill: skillName }) });
        } else {
          warn.push({ label: L("WFRPPD.Restr.Untrained"), hint: F("WFRPPD.Restr.UntrainedHint", { skill: skillName }) });
        }
      }
      if (profile.hasSkills && group === "cavalry" && sys.twohanded?.value && !profile.hasSkill(GROUP_SKILL.twohanded)) {
        warn.push({ label: L("WFRPPD.Restr.Cavalry") });
        score -= 100;
      }
      // Неосновная рука: атака -20, Амбидекстр 1 -> -10, 2 -> 0.
      // Защитное оружие с Ближним боем (парирующее) без штрафа только В ЗАЩИТЕ.
      if (slot === "off" && !shieldValue(item)) {
        const defensive = (safe(() => sys.Qualities, []) ?? []).some((q) => /defensive|защитн/i.test(q));
        const parry = defensive && profile.hasSkill(GROUP_SKILL.parry);
        const pen = -20 + 10 * profile.ambidextrous;
        if (pen < 0) {
          warn.push({
            label: F(parry ? "WFRPPD.Restr.OffHandAttack" : "WFRPPD.Restr.OffHand", { n: pen }),
            hint: L(parry ? "WFRPPD.Restr.OffHandParryHint" : "WFRPPD.Restr.OffHandHint")
          });
          // Парирующее оружие во второй руке чаще для защиты - штраф к атаке весит вдвое меньше
          score += pen * (parry ? 5 : 10);
        }
        if (profile.dualWielder) score += 100;
      }
      if (this._hasAmmo(item) === false) {
        warn.push({ label: L("WFRPPD.Restr.NoAmmo"), hint: L("WFRPPD.Restr.NoAmmoHint") });
        score -= 200;
      }
      // Бонусы талантов уже сидят в уроне; здесь только «невидимая» часть (Верный выстрел)
      score += this._weaponBonuses(item, profile).score;
    }

    if (item.type === "armour") {
      // Слои: два жёстких доспеха на одной части тела по правилам не сочетаются
      if (!sys.isEquipped && !isUnderLayer(item)) {
        const before = this._layerConflicts();
        const after = this._layerConflicts(item);
        const clash = Object.keys(after).filter((loc) => !before[loc]);
        if (clash.length) {
          const other = after[clash[0]].find((a) => a !== item);
          warn.push({ label: F("WFRPPD.Restr.Layer", { name: other?.name ?? "" }), hint: L("WFRPPD.Restr.LayerHint") });
          score -= 300;
        }
      }
      // Штрафы к навыкам
      const pen = armourSkillPenalties(item);
      if (pen.stealth) warn.push({ label: F("WFRPPD.Restr.Stealth", { n: -pen.stealth }), hint: L("WFRPPD.Restr.SkillPenaltyHint"), info: true });
      if (pen.perception) warn.push({ label: F("WFRPPD.Restr.Perception", { n: -pen.perception }), hint: L("WFRPPD.Restr.SkillPenaltyHint"), info: true });
      if (hasProperty(item, "practical", /practical|практичн/i)) warn.push({ label: L("WFRPPD.Restr.Practical"), good: true });
      score -= (pen.stealth + pen.perception) * 2;
    }

    for (const cult of profile.cults) {
      if (cult.forbids(item)) forbid.push({ label: F("WFRPPD.Restr.Cult", { god: L(cult.god) }), hint: L(cult.hint) });
    }

    // Дополнения добавляют свои ограничения (штраф к касту, увечья и т. п.)
    const out = { forbid, warn, score };
    addonHook("restrictions", this, item, slot, out, profile);
    return out;
  }

  /* -------------------------------------------- */
  /*  BIS: что лучше всего в этот слот            */
  /* -------------------------------------------- */

  /**
   * Оценка предмета для слота.
   * value - главное число для сравнения (AP, урон, значение щита),
   * score - итог с учётом качеств, изъянов и редкости (для сортировки и BIS).
   */
  _slotValue(item, slot, profile = this._profile()) {
    const base = this._slotValueBase(item, slot);
    const r = this._restrictions(item, slot, profile);
    return { ...base, score: base.score + r.score, restr: r, forbidden: r.forbid.length > 0 };
  }

  _slotValueBase(item, slot) {
    const sys = item.system;
    const q = (safe(() => sys.Qualities, []) ?? []).length;
    const f = (safe(() => sys.Flaws, []) ?? []).length;
    const rarity = RARITY_RANK[sys.availability?.value] ?? 0;
    const extras = q * 10 - f * 10 + rarity;

    if (prostheticKind(item)) return { value: null, unit: null, score: (prostheticKind(item) === "marvel" ? 500 : 300) + extras };
    if (LOCATIONS.includes(slot)) {
      const ap = safe(() => sys.currentAP?.[slot], null) ?? sys.AP?.[slot] ?? 0;
      return { value: ap, unit: "AP", score: ap * 100 + extras };
    }
    if (slot === "main" || slot === "off") {
      const shield = shieldValue(item);
      if (slot === "off" && shield) return { value: shield, unit: "shield", score: 1000 + shield * 100 + extras };
      const dmg = this._weaponDamage(item) ?? 0;
      return { value: dmg, unit: "dmg", score: dmg * 100 + extras };
    }
    if (isBagSlot(slot)) {
      const cap = Number(sys.carries?.value) || 0;
      return { value: cap, unit: "cap", score: cap * 100 + extras };
    }
    return { value: null, unit: null, score: extras };
  }

  /** Где сейчас надет предмет (для подписи «сейчас: ...») */
  _currentSlotOf(item) {
    if (!item.system.isEquipped) return null;
    if (extraSlotOf(item)) return extraSlotOf(item);
    if (item.type === "weapon") return item.system.offhand?.value ? "off" : "main";
    if (item.type === "container") return this._bagAssignment().slotOf.get(item.id) ?? null;
    if (prostheticKind(item)) return item.flags?.[MODULE_ID]?.limb ?? null;
    return null;
  }

  async _equipTo(item, slot) {
    if (!this.editable) return;
    if (!this._canDrop(item, slot)) {
      ui.notifications.warn(
        game.i18n.format("WFRPPD.Warn.WrongSlot", {
          item: item.name,
          slot: this._slotLabel(slot)
        })
      );
      return;
    }

    try {
      // Надетая вещь не может лежать в сумке: сначала достаём её
      // (иначе система считает её «в контейнере» - нет AP и нагрузки)
      if (item.system.location?.value) await item.update({ "system.location.value": "" });
      if (isExtraSlot(slot)) {
        // Лишняя рука или голова: вещь надета, где именно - во флаге модуля (система о третьей руке не знает)
        const update = { "system.equipped.value": true, [`flags.${MODULE_ID}.extraSlot`]: slot };
        if (item.type === "weapon") update["system.offhand.value"] = false;
        await item.update(update);
      } else if (isExtraSlot(extraSlotOf(item))) {
        // Из лишней руки - в обычный слот: сначала снимаем флаг
        await item.update({ [`flags.${MODULE_ID}.extraSlot`]: null });
        if (item.type === "weapon") await this._equipWeapon(item, slot);
        else if (!item.system.isEquipped) await item.update({ "system.equipped.value": true });
      } else if (item.type === "weapon") await this._equipWeapon(item, slot);
      else if (isBagSlot(slot)) await this._equipBag(item, slot);
      else if (prostheticKind(item)) {
        // Протез на конечность: один на конечность, прежний снимаем
        const prev = this.actor.items.find((i) => i.id !== item.id && prostheticKind(i) && i.system.isEquipped && i.flags?.[MODULE_ID]?.limb === slot);
        if (prev) await prev.update({ "system.equipped.value": false, [`flags.${MODULE_ID}.limb`]: null });
        await item.update({ "system.equipped.value": true, [`flags.${MODULE_ID}.limb`]: slot });
      }
      else if (!item.system.isEquipped) await item.update({ "system.equipped.value": true });
    } catch (err) {
      // Система сама показывает уведомление (например, лимит экипированного оружия)
      console.warn(`${MODULE_ID} | equip failed`, err);
    }
  }

  async _equipWeapon(item, slot) {
    const sys = item.system;
    const twoHanded = !!sys.twohanded?.value;
    const wantOff = slot === "off" && !twoHanded;

    // Как в WoW: то, что мешает, снимается автоматически
    const conflicts = this.actor.itemTypes.weapon.filter((w) => {
      if (w.id === item.id || !w.system.isEquipped || isExtraHand(extraSlotOf(w))) return false;
      if (twoHanded || w.system.twohanded?.value) return true;
      return !!w.system.offhand?.value === wantOff;
    });
    if (conflicts.length) {
      await this.actor.updateEmbeddedDocuments(
        "Item",
        conflicts.map((w) => ({ _id: w.id, "system.equipped.value": false }))
      );
    }

    // Порядок важен: при смене equipped система сбрасывает offhand,
    // поэтому сначала надеваем, потом выставляем руку отдельным апдейтом
    if (!sys.isEquipped) await item.update({ "system.equipped.value": true });
    if (!!item.system.offhand?.value !== wantOff) await item.update({ "system.offhand.value": wantOff });
  }

  /** Снять всё, что сейчас в слоте */
  /** Закрепить текущие слоты сумок во флагах, чтобы при снятии одной остальные не съезжали */
  async _pinBags() {
    const { slotOf } = this._bagAssignment();
    const updates = [...slotOf]
      .filter(([id, slot]) => this.actor.items.get(id)?.flags?.[MODULE_ID]?.bagSlot !== slot)
      .map(([id, slot]) => ({ _id: id, [`flags.${MODULE_ID}.bagSlot`]: slot }));
    if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
  }

  async _clearSlot(slot) {
    if (!this.editable) return;
    const { current } = this._swapCandidates(slot);
    if (!current.length) return;
    if (isBagSlot(slot)) await this._pinBags();
    try {
      await this.actor.updateEmbeddedDocuments(
        "Item",
        current.map((i) => ({ _id: i.id, "system.equipped.value": false, ...(extraSlotOf(i) ? { [`flags.${MODULE_ID}.extraSlot`]: null } : {}) }))
      );
    } catch (err) {
      console.warn(`${MODULE_ID} | clear slot failed`, err);
    }
  }

  async _unequip(item) {
    if (!this.editable || !item?.system?.isEquipped) return;
    try {
      if (item.type === "container") await this._pinBags();
      const update = { "system.equipped.value": false };
      if (prostheticKind(item)) update[`flags.${MODULE_ID}.limb`] = null;
      if (extraSlotOf(item)) update[`flags.${MODULE_ID}.extraSlot`] = null;
      await item.update(update);
    } catch (err) {
      console.warn(`${MODULE_ID} | unequip failed`, err);
    }
  }

  _slotLabel(slot) {
    if (LOCATIONS.includes(slot)) return game.i18n.localize(game.wfrp4e.config.locations[slot]);
    const map = { main: "Main", off: "Off", accessory: "Accessory", container: "Container", bag1: "Bag1", bag2: "Bag2", bag3: "Bag3", hand3: "Hand3", hand4: "Hand4", head2: "Head2", head3: "Head3" };
    return game.i18n.localize(`WFRPPD.Slot.${map[slot] ?? slot}`);
  }

  /* -------------------------------------------- */
  /*  События                                     */
  /* -------------------------------------------- */

  static onSetSort(event, target) {
    this._sort = target.dataset.sort ?? "default";
    this._sortOpen = false;
    this._saveUiState();
    this.render();
  }

  static onSetView(event, target) {
    this._view = target.dataset.view === "list" ? "list" : "grid";
    this._sortOpen = false;
    this._saveUiState();
    this.render();
  }

  static onToggleBarMenu(event) {
    event?.stopPropagation?.();
    this._barMenuOpen = !this._barMenuOpen;
    this.element.querySelector(".pd-barmenu")?.classList.toggle("is-open", this._barMenuOpen);
  }

  static async onSetSecondBar(event, target) {
    event?.stopPropagation?.();
    this._barMenuOpen = false;
    try {
      await game.settings.set(MODULE_ID, "secondBar", target.dataset.bar ?? "fortune");
    } catch {}
    this.render();
  }

  static onToggleSortMenu() {
    this._sortOpen = !this._sortOpen;
    this.element.querySelector(".pd-sort .pd-sortmenu")?.classList.toggle("is-open", this._sortOpen);
  }

  static onSetFilter(event, target) {
    const f = target.dataset.filter ?? "all";
    // Повторный клик по активному фильтру - сброс на «Всё»
    this._filter = f === this._filter ? "all" : f;
    this._saveUiState();
    this.render();
  }

  static onSetStatsView(event, target) {
    this._statsView = target.dataset.view === "tree" ? "tree" : "list";
    this._saveUiState();
    this.render();
  }

  /** Выгрузить всё из сумки: вещи переходят «при себе» */
  static async onUnloadBag(event, target) {
    event?.stopPropagation?.();
    const id = target.closest("[data-container]")?.dataset.container;
    if (!id || !this.editable) return;
    const updates = this.actor.items.filter((i) => i.system?.location?.value === id).map((i) => ({ _id: i.id, "system.location.value": "" }));
    if (!updates.length) return;
    await this.actor.updateEmbeddedDocuments("Item", updates);
    ui.notifications?.info(game.i18n.format("WFRPPD.Bags.Unloaded", { n: updates.length, name: this.actor.items.get(id)?.name ?? "" }));
  }

  static onAutoPack(event) {
    event?.stopPropagation?.();
    this._autoPack();
  }

  static onSetTab(event, target) {
    this._tab = target.dataset.tab || "bag";
    this._saveUiState();
    this.render();
  }

  static onOpenSheet(event) {
    // Клики по полоскам и ленте эффектов поверх модели лист не открывают
    if (event?.target?.closest?.(".pd-vitals, .pd-effects")) return;
    this.actor.sheet?.render(true);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    PaperdollTooltip.hide();
    const root = this.element;
    // Битые и пропавшие картинки в окне, подсказках и списке смены - знак вопроса
    bindMissingImages(document);
    root.classList.remove("pd-theme-dark", "pd-theme-parchment");
    root.classList.add(themeClass());

    for (const el of root.querySelectorAll(".pd-item")) {
      const item = this.actor.items.get(el.dataset.itemId);
      if (!item) continue;

      el.addEventListener("pointerenter", (ev) => PaperdollTooltip.show(item, ev, this));
      el.addEventListener("pointermove", (ev) => PaperdollTooltip.move(ev));
      el.addEventListener("pointerleave", () => PaperdollTooltip.hide());

      el.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        PaperdollTooltip.hide();
        item.sheet?.render(true);
      });

      if (el.classList.contains("is-ghost")) continue;

      el.addEventListener("dblclick", (ev) => {
        ev.preventDefault();
        PaperdollTooltip.hide();
        if (item.system.isEquipped) this._unequip(item);
        else {
          const slot = this._defaultSlot(item);
          if (slot) this._equipTo(item, slot);
          else if (item.type === "container") ui.notifications.warn(game.i18n.localize("WFRPPD.Bags.NoFreeSlot"));
        }
      });

      if (!this.editable) continue;
      el.addEventListener("dragstart", (ev) => this._onDragStart(ev, item, el));
      el.addEventListener("dragend", () => this._onDragEnd());
    }

    // Меню сортировки закрывается кликом мимо него
    // Корневой элемент окна живёт между перерисовками - вешаем один раз
    if (!this._sortCloserBound) {
      this._sortCloserBound = true;
      root.addEventListener("pointerdown", (ev) => {
        if (this._sortOpen && !ev.target.closest?.(".pd-sort")) {
          this._sortOpen = false;
          root.querySelector(".pd-sort .pd-sortmenu")?.classList.remove("is-open");
        }
        if (this._barMenuOpen && !ev.target.closest?.(".pd-barmenu, .pd-vital-opts")) {
          this._barMenuOpen = false;
          root.querySelector(".pd-barmenu")?.classList.remove("is-open");
        }
      });
    }

    // Подзаголовок: клик по карьере, виду, статусу - статья
    for (const el of root.querySelectorAll(".pd-hero-part")) {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._openArticle(el.dataset.kind, el.textContent.trim());
      });
    }
    // Раны: ЛКМ +1, ПКМ -1, с Shift - по 5 (в пределах 0..максимум)
    const woundsBar = root.querySelector(".pd-vital--wounds");
    if (woundsBar && this.editable) {
      const change = async (ev, dir) => {
        // Полоса лежит внутри модели, а клик по модели открывает лист - не пускаем клик дальше
        ev.preventDefault();
        ev.stopPropagation();
        const w = this.actor.system.status?.wounds ?? {};
        const max = Number(w.max) || 0;
        const now = Number(w.value) || 0;
        const next = Math.clamp(now + dir * (ev.shiftKey ? 5 : 1), 0, max);
        if (next !== now) await this.actor.update({ "system.status.wounds.value": next });
      };
      woundsBar.addEventListener("click", (ev) => {
        if (ev.target.closest(".pd-rest, .pd-restmenu")) return;
        change(ev, 1);
      });
      woundsBar.querySelector(".pd-rest")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        woundsBar.querySelector(".pd-restmenu")?.classList.toggle("is-open");
      });
      for (const b of woundsBar.querySelectorAll(".pd-restmenu [data-rest]")) {
        b.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          woundsBar.querySelector(".pd-restmenu")?.classList.remove("is-open");
          this._restRecover(b.dataset.rest === "day");
        });
      }
      woundsBar.addEventListener("contextmenu", (ev) => change(ev, -1));
    }
    // Броски: кубик на слоте оружия, клик по названию характеристики или навыка
    for (const el of root.querySelectorAll(".pd-roll[data-roll-item]")) {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        PaperdollTooltip.hide();
        const item = this.actor.items.get(el.dataset.rollItem);
        if (item) this._rollTest("weapon", item);
      });
    }
    for (const el of root.querySelectorAll("[data-roll-key]")) {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        PaperdollTooltip.hide();
        const key = el.dataset.rollKey;
        if (key.startsWith("char.")) return this._rollTest("char", key.slice(5));
        const sk = this.actor.items.get(el.dataset.rollItem) ?? (this.actor.itemTypes.skill ?? []).find((s) => s.name === key);
        if (sk) this._rollTest("skill", sk);
      });
    }

    // Дополнения: своя вкладка и свои обработчики
    const tabEl = root.querySelector(".pd-addon-tab");
    if (tabEl) {
      const tab = [...ADDONS.values()].flatMap((a) => a.tabs ?? []).find((t) => t.id === this._tab);
      tab?.onRender?.(this, tabEl);
    }
    addonHook("onRender", this, root);

    // Вкладка «Характеристики»: значок справа от строки открывает статью правил
    for (const el of root.querySelectorAll(".pd-ecs-info")) {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        const terms = (el.dataset.article ?? "").split("|").filter(Boolean);
        this._openArticle("stat", terms.at(-1) ?? "", terms.slice(0, -1));
      });
    }
    // Подсказки title - своей карточкой
    PaperdollTooltip.adoptTitles(root);
    // Анимация последней операции с деньгами
    if (this._moneyFx) {
      const { key, delta } = this._moneyFx;
      this._moneyFx = null;
      const coin = root.querySelector(`.pd-coin[data-coin="${key}"]`);
      if (coin) {
        coin.classList.add(delta > 0 ? "is-gain" : "is-spend");
        const fx = document.createElement("span");
        fx.className = `pd-coin-fx ${delta > 0 ? "is-gain" : "is-spend"}`;
        fx.textContent = `${delta > 0 ? "+" : "-"}${Math.abs(delta)}`;
        coin.append(fx);
        fx.addEventListener("animationend", () => fx.remove(), { once: true });
      }
    }
    // Монеты: ЛКМ +1, ПКМ -1, с Shift по 10
    for (const el of root.querySelectorAll(".pd-coin")) {
      const step = (ev) => (ev.shiftKey ? 10 : 1);
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._changeMoney(el.dataset.coin, step(ev));
      });
      el.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        this._changeMoney(el.dataset.coin, -step(ev));
      });
    }

    // Выпадашки статов под портретом
    for (const select of root.querySelectorAll(".pd-statbox select")) {
      select.addEventListener("change", () => {
        this._statPanels[Number(select.dataset.panel)] = select.value;
        this._saveUiState();
        this.render();
      });
    }

    // Таланты: подсказка как у вещи - крупная иконка и описание (из листа или из библиотеки)
    for (const el of root.querySelectorAll(".pd-ecs-main[data-talent]")) {
      const t = this.actor.items.get(el.dataset.talent);
      if (!t) continue;
      el.addEventListener("pointerover", (ev) => ev.stopPropagation());
      el.addEventListener("pointerenter", async (ev) => {
        const lvl = Number(el.dataset.lvl) || 1;
        PaperdollTooltip.showHtml(this._talentTooltip(t, lvl), ev);
        // Описания в листе нет - ищем в библиотеке и дорисовываем, если подсказка ещё на этом таланте
        if (!this._talentText(t) && !PaperdollApp._talentLib.has(norm(t.name))) {
          await this._loadTalentText(t);
          if (el.matches(":hover")) PaperdollTooltip.showHtml(this._talentTooltip(t, lvl), ev);
        }
      });
      el.addEventListener("pointermove", (ev) => PaperdollTooltip.move(ev));
      el.addEventListener("pointerleave", () => PaperdollTooltip.hide());
    }

    // Значок травмы на слоте: подсказка с крупной картинкой
    for (const el of root.querySelectorAll(".pd-maim[data-maim]")) {
      const view = this._maimCache?.[el.dataset.maim];
      if (!view) continue;
      // Значок лежит внутри слота: его подсказка не должна уступать подсказке слота
      el.addEventListener("pointerover", (ev) => ev.stopPropagation());
      el.addEventListener("pointerenter", (ev) => PaperdollTooltip.showHtml(maimTooltip(view), ev));
      el.addEventListener("pointermove", (ev) => PaperdollTooltip.move(ev));
      el.addEventListener("pointerleave", () => PaperdollTooltip.hide());
    }

    // Лента эффектов
    for (const el of root.querySelectorAll(".pd-effect")) {
      const entry = this._effectsCache?.[Number(el.dataset.index)];
      if (!entry) continue;
      el.addEventListener("pointerenter", (ev) => PaperdollTooltip.showHtml(effectTooltip(entry), ev));
      el.addEventListener("pointermove", (ev) => PaperdollTooltip.move(ev));
      el.addEventListener("pointerleave", () => PaperdollTooltip.hide());
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        PaperdollTooltip.hide();
        this._onEffectClick(entry, ev);
      });
      el.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        PaperdollTooltip.hide();
        this._onEffectContext(entry);
      });
    }

    // Быстрая смена: клик по слоту открывает список (стрелочек больше нет)
    PaperdollFlyout.close();
    if (this.editable) {
      for (const frame of root.querySelectorAll(".pd-slot-frame")) {
        const slot = frame.closest(".pd-slot")?.dataset.slot;
        if (!slot) continue;
        frame.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          PaperdollTooltip.hide();
          if (PaperdollFlyout.isOpenFor(this, slot)) PaperdollFlyout.close();
          else PaperdollFlyout.open(this, slot, frame);
        });
      }
    }

    // Слоты куколки
    for (const slotEl of root.querySelectorAll(".pd-slot")) {
      const slot = slotEl.dataset.slot;
      slotEl.addEventListener("dragover", (ev) => {
        if (!this.editable) return;
        ev.preventDefault();
        if (this._dragging)
          ev.dataTransfer.dropEffect = this._canDrop(this._dragging.item, slot) ? "move" : "none";
      });
      slotEl.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const item = await this._resolveDropItem(ev);
        this._onDragEnd();
        if (item) this._equipTo(item, slot);
      });
    }

    // Сумка
    const bag = root.querySelector(".pd-bag");
    if (bag) {
      bag.addEventListener("dragover", (ev) => {
        if (!this.editable) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
      });
      bag.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const item = await this._resolveDropItem(ev);
        this._onDragEnd();
        if (item?.system.isEquipped) this._unequip(item);
      });
    }

    // Иконка сумки в заголовке раздела - как слот: клик открывает список смены сумки
    if (this.editable) {
      for (const icon of root.querySelectorAll(".pd-bagsec-icon[data-slot]")) {
        const slot = icon.dataset.slot;
        icon.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          PaperdollTooltip.hide();
          if (PaperdollFlyout.isOpenFor(this, slot)) PaperdollFlyout.close();
          else PaperdollFlyout.open(this, slot, icon);
        });
      }
    }

    // Разделы сумок: перетащил в раздел - переложил в эту сумку (или «при себе»)
    for (const sec of root.querySelectorAll(".pd-bagsec")) {
      const freeSlot = sec.dataset.freeSlot;
      if (freeSlot) {
        // Свободный слот сумки: сюда можно бросить сумку, чтобы надеть
        sec.addEventListener("dragover", (ev) => {
          if (!this.editable) return;
          ev.preventDefault();
          ev.stopPropagation();
          sec.classList.add("is-drop");
        });
        sec.addEventListener("dragleave", (ev) => {
          if (!sec.contains(ev.relatedTarget)) sec.classList.remove("is-drop");
        });
        sec.addEventListener("drop", async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          sec.classList.remove("is-drop");
          const item = await this._resolveDropItem(ev);
          this._onDragEnd();
          if (item) this._equipTo(item, freeSlot);
        });
        continue;
      }
      const containerId = sec.dataset.container ?? "";
      sec.addEventListener("dragover", (ev) => {
        if (!this.editable) return;
        ev.preventDefault();
        ev.stopPropagation();
        sec.classList.add("is-drop");
        ev.dataTransfer.dropEffect = "move";
      });
      sec.addEventListener("dragleave", (ev) => {
        if (!sec.contains(ev.relatedTarget)) sec.classList.remove("is-drop");
      });
      sec.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        sec.classList.remove("is-drop");
        const item = await this._resolveDropItem(ev);
        this._onDragEnd();
        if (item) this._moveToContainer(item, containerId);
      });
    }
  }

  /**
   * Предмет, который бросили: из нашего окна или из листа персонажа.
   * Чужие предметы (другой актёр, компендий) не принимаем.
   */
  async _resolveDropItem(event) {
    if (this._dragging?.item) return this._dragging.item;
    const TE = foundry.applications.ux.TextEditor.implementation;
    const data = safe(() => TE.getDragEventData(event), {});
    if (data?.type !== "Item" || !data.uuid) return null;
    const item = await fromUuid(data.uuid);
    if (!item) return null;
    if (item.parent?.uuid !== this.actor.uuid) {
      // Чужая вещь: может забрать дополнение (сундук группы)
      for (const a of ADDONS.values()) if (a.externalDrop && (await a.externalDrop(this, item, data))) return null;
      ui.notifications.warn(game.i18n.localize("WFRPPD.Warn.NotOwned"));
      return null;
    }
    return item;
  }

  _onDragStart(event, item, el) {
    PaperdollTooltip.hide();
    this._dragging = { item };
    // Формат Foundry: предмет можно бросить и в другие окна (лист, другой актёр)
    // fromPaperdoll: сброс на токен на столе передаёт вещь его персонажу (дополнение «Группа»)
    event.dataTransfer.setData("text/plain", JSON.stringify({ ...item.toDragData(), fromPaperdoll: true }));
    event.dataTransfer.effectAllowed = "move";
    el.classList.add("is-dragging");

    // Подсветка подходящих слотов
    for (const slotEl of this.element.querySelectorAll(".pd-slot")) {
      const ok = this._canDrop(item, slotEl.dataset.slot);
      slotEl.classList.toggle("is-valid", ok);
      slotEl.classList.toggle("is-invalid", !ok);
    }
    if (item.system.isEquipped) this.element.querySelector(".pd-bag")?.classList.add("is-valid");
    // Подсветить сумки, куда предмет влезает, и приглушить переполненные
    const weight = Number(item.system.encumbrance?.total ?? item.system.encumbrance?.value) || 0;
    for (const sec of this.element.querySelectorAll(".pd-bagsec")) {
      const id = sec.dataset.container;
      if (!id) continue;
      const c = this.actor.items.get(id);
      if (!c || c.id === item.id) continue;
      const { used, cap } = this._bagLoad(c);
      const here = item.system.location?.value === id;
      sec.classList.toggle("is-invalid", !here && cap > 0 && used + weight > cap);
    }
  }

  _onDragEnd() {
    this._dragging = null;
    if (!this.element) return;
    for (const el of this.element.querySelectorAll(".is-valid, .is-invalid, .is-dragging")) {
      el.classList.remove("is-valid", "is-invalid", "is-dragging");
    }
  }

  async _onClose(options) {
    await super._onClose(options);
    PaperdollTooltip.hide();
    if (PaperdollFlyout.app === this) PaperdollFlyout.close();
    for (const [name, id] of this._hooks) Hooks.off(name, id);
    PaperdollApp.instances.delete(this.actor.uuid);
  }
}

/* ============================================ */
/*  Тултип в стиле WoW                          */
/* ============================================ */

/**
 * Сколько осталось действовать эффекту (Foundry: раунды/ходы в бою или игровое время).
 * { short: "3р" | "2ч", long: "Осталось: 3 раунда" } или null, если эффект бессрочный.
 */
function effectRemaining(effect) {
  if (!option("effectDurations")) return null;
  const d = safe(() => effect.duration, null) ?? {};
  const L = (k) => game.i18n.localize(k);
  const F = (k, x) => game.i18n.format(k, x);
  let rounds = null;
  let seconds = null;
  if (["turns", "rounds"].includes(d.type) && Number.isFinite(d.remaining)) rounds = Math.max(0, Math.ceil(d.remaining));
  else if (d.type === "seconds" && Number.isFinite(d.remaining)) seconds = Math.max(0, d.remaining);
  else if (Number(d.rounds) || Number(d.turns)) {
    const total = Number(d.rounds) || 0;
    const now = game.combat?.round ?? null;
    rounds = now !== null && d.startRound !== undefined && d.startRound !== null ? Math.max(0, total - (now - d.startRound)) : total;
  } else if (Number(d.seconds)) {
    const now = game.time?.worldTime ?? 0;
    seconds = d.startTime !== undefined && d.startTime !== null ? Math.max(0, d.startTime + Number(d.seconds) - now) : Number(d.seconds);
  }
  if (rounds !== null) return { short: F("WFRPPD.Effects.LeftRoundsShort", { n: rounds }), long: F("WFRPPD.Effects.LeftRounds", { n: rounds }) };
  if (seconds !== null) {
    const [n, unit] = seconds < 60 ? [Math.ceil(seconds), "s"] : seconds < 3600 ? [Math.ceil(seconds / 60), "m"] : seconds < 86400 ? [Math.ceil(seconds / 3600), "h"] : [Math.ceil(seconds / 86400), "d"];
    return { short: `${n}${L(`WFRPPD.Effects.Unit.${unit}`)}`, long: F("WFRPPD.Effects.LeftTime", { n, unit: L(`WFRPPD.Effects.UnitLong.${unit}`) }) };
  }
  return null;
}

function effectTooltip(entry) {
  const L = (k) => game.i18n.localize(k);
  const kind = L(`WFRPPD.Effects.Kind.${entry.kind}`);
  const state = entry.disabled ? ` · ${L("WFRPPD.Effects.Disabled")}` : "";
  const value = entry.value ? ` ${entry.value}` : "";
  const lines = entry.lines.map((l) => `<div class="pd-tt-text pd-tr">${esc(l.length > 260 ? `${l.slice(0, 260)}…` : l)}</div>`).join("");
  // Шапка как у вещей: крупная иконка в рамке своего типа, рядом название и тип
  return `
    <div class="pd-tt-head">
      ${entry.img ? `<div class="pd-tt-icon pd-tt-fx fx-${esc(entry.kind)}"><img src="${esc(entry.img)}" alt=""></div>` : ""}
      <div class="pd-tt-title">
        <div class="pd-tt-name ${entry.kind === "buff" ? "is-buff" : entry.debuff ? "is-debuff" : ""}">${esc(entry.name)}${esc(value)}</div>
        <div class="pd-tt-sub">${esc(kind + state)}</div>
        ${entry.left ? `<div class="pd-tt-left">${esc(entry.left.long)}</div>` : ""}
      </div>
    </div>
    ${lines}
    <div class="pd-tt-hint">${esc(/ПКМ|RMB/i.test(entry.hint ?? "") ? entry.hint : [entry.hint, L("WFRPPD.Effects.HintSheet")].filter(Boolean).join(" · "))}</div>`;
}

/** Подсказка значка травмы на слоте: крупная картинка травмы, что с конечностью и чем заменена */
function maimTooltip(view) {
  const L = (k) => game.i18n.localize(k);
  const [head, ...rest] = view.lines;
  return `
    <div class="pd-tt-head">
      <div class="pd-tt-icon pd-tt-fx fx-injury"><img src="${esc(view.bigImg)}" alt=""></div>
      <div class="pd-tt-title">
        <div class="pd-tt-name is-debuff">${esc(view.name)}</div>
        <div class="pd-tt-sub">${esc(L("WFRPPD.Effects.Kind.injury"))}${view.ok ? "" : view.partial ? ` · ${esc(view.prostheticName)}` : ""}</div>
      </div>
    </div>
    ${[head, ...rest].map((l) => `<div class="pd-tt-text pd-tr">${esc(l)}</div>`).join("")}`;
}

export class PaperdollTooltip {
  static el = null;

  static ensure() {
    if (this.el?.isConnected) return this.el;
    this.el = document.createElement("div");
    this.el.className = "wfrp-paperdoll-tooltip";
    document.body.append(this.el);
    return this.el;
  }

  static mode = null;

  static showHtml(html, event, mode = "rich") {
    const el = this.ensure();
    this.mode = mode;
    el.className = `wfrp-paperdoll-tooltip ${themeClass()} ${mode === "tip" ? "is-tip" : ""}`;
    el.innerHTML = html;
    el.classList.add("is-visible");
    this.move(event);
    this.translate(el, event);
  }

  static show(item, event, app = null) {
    const el = this.ensure();
    this.mode = "item";
    this.current = { item, app };
    this.lastEvent = event;
    this.bindCompareKeys();
    el.className = `wfrp-paperdoll-tooltip ${themeClass()}`;
    el.innerHTML = this.build(item, app);
    el.classList.add("is-visible");
    this.move(event);
    this.translate(el, event);
    if (event?.shiftKey) this.showCompare();
    else this.hideCompare();
  }

  /* ---------- Сравнение с надетым (Shift, как в WoW) ---------- */

  /** Надетые вещи в тех же слотах: оружие - в руках, броня - на тех же частях тела */
  static compareTargets(item, app) {
    const sys = item?.system;
    if (!sys || sys.isEquipped || !app?.actor) return [];
    const equipped = (app.actor.items ?? []).filter((i) => i.id !== item.id && i.type === item.type && i.system?.isEquipped);
    if (item.type === "weapon") return equipped.slice(0, 2);
    if (item.type === "armour") {
      const locs = (o) => LOCATIONS.filter((l) => o.system.protects?.[l] || (o.system.AP?.[l] ?? 0) > 0);
      const mine = locs(item);
      return equipped.filter((a) => locs(a).some((l) => mine.includes(l))).slice(0, 2);
    }
    return [];
  }

  /** Число урона: «SB+4» -> 4, «+9» -> 9 */
  static dmgNum(w) {
    const v = String(safe(() => w.system.damage?.value, "") ?? "");
    const m = v.match(/[+-]?\s*\d+/);
    return { sb: /SB|БС/i.test(v), n: m ? Number(m[0].replace(/\s/g, "")) : 0 };
  }

  /** Что изменится, если надеть item вместо other */
  static diffLines(item, other) {
    const L = (k) => game.i18n.localize(k);
    const out = [];
    const sign = (d) => (d > 0 ? `+${d}` : `${d}`);
    if (item.type === "weapon") {
      const a = this.dmgNum(item), b = this.dmgNum(other);
      if (a.sb === b.sb && a.n !== b.n) out.push([a.n - b.n, `${sign(a.n - b.n)} ${L("WFRPPD.Tooltip.CmpDamage")}`]);
    } else if (item.type === "armour") {
      const cfg = game.wfrp4e?.config ?? {};
      for (const l of LOCATIONS) {
        const d = (Number(item.system.AP?.[l]) || 0) - (Number(other.system.AP?.[l]) || 0);
        if (d) out.push([d, `${sign(d)} ${game.i18n.format("WFRPPD.Tooltip.CmpAP", { loc: L(cfg.locations?.[l] ?? l) })}`]);
      }
    }
    return out;
  }

  static showCompare() {
    if (!option("shiftCompare")) return this.hideCompare();
    const cur = this.current;
    if (this.mode !== "item" || !cur) return this.hideCompare();
    const targets = this.compareTargets(cur.item, cur.app);
    if (!targets.length) return this.hideCompare();
    const L = (k) => game.i18n.localize(k);
    this.cmpEls ??= [];
    while (this.cmpEls.length < targets.length) {
      const e = document.createElement("div");
      document.body.append(e);
      this.cmpEls.push(e);
    }
    this.cmpEls.forEach((e, i) => {
      const other = targets[i];
      if (!other) return e.classList.remove("is-visible");
      const diff = this.diffLines(cur.item, other);
      const diffHtml = diff.length
        ? `<div class="pd-cmp-diff"><div class="pd-cmp-title">${esc(L("WFRPPD.Tooltip.CompareTitle"))}</div>${diff
            .map(([d, t]) => `<div class="${d > 0 ? "is-up" : "is-down"}">${esc(t)}</div>`)
            .join("")}</div>`
        : "";
      e.className = `wfrp-paperdoll-tooltip ${themeClass()} is-compare is-visible`;
      e.innerHTML = `<div class="pd-cmp-head">${esc(L("WFRPPD.Tooltip.CurrentlyEquipped"))}</div>${this.build(other, null)}${diffHtml}`;
    });
    this.placeCompare();
  }

  static hideCompare() {
    for (const e of this.cmpEls ?? []) e.classList.remove("is-visible");
  }

  /** Карточки надетого - вплотную слева от основной подсказки (не влезает - справа) */
  static placeCompare() {
    const main = this.el?.getBoundingClientRect();
    if (!main) return;
    const cards = (this.cmpEls ?? []).filter((e) => e.classList.contains("is-visible"));
    const widths = cards.map((e) => e.getBoundingClientRect().width);
    const total = widths.reduce((a, b) => a + b + 4, 0);
    let x = main.left - total >= 8 ? main.left - total : main.right + 4;
    for (const [i, e] of cards.entries()) {
      const h = e.getBoundingClientRect().height;
      e.style.left = `${x}px`;
      e.style.top = `${Math.max(8, Math.min(main.top, window.innerHeight - h - 8))}px`;
      x += widths[i] + 4;
    }
  }

  static bindCompareKeys() {
    if (this._cmpKeys) return;
    this._cmpKeys = true;
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Shift" && !ev.repeat && this.mode === "item") this.showCompare();
    });
    document.addEventListener("keyup", (ev) => {
      if (ev.key === "Shift") this.hideCompare();
    });
  }

  /**
   * Машинный перевод английских текстов в подсказке (настройка «Переводить описания»).
   * Из кэша - сразу, иначе асинхронно, если подсказка ещё на экране.
   * «Только описания» - переводим лишь описания и художественный текст (.pd-tr).
   */
  static translate(el, event) {
    const provider = trProvider();
    const lang = game.i18n?.lang ?? "en";
    if (provider === "off" || lang === "en") return;
    const sel = setting("translateDescOnly", false) ? ".pd-tr" : ".pd-tr, .pd-tip-line:not(.is-kv), .pd-tip-head:not(.is-kv)";
    for (const node of el.querySelectorAll(sel)) {
      const src = node.textContent.trim().replace(/^«|»$/g, "");
      if (!looksEnglish(src)) continue;
      const wrap = (t) => (node.classList.contains("pd-tt-desc") ? `«${t}»` : t);
      const hit = cachedTranslation(src, lang);
      if (hit) {
        node.textContent = wrap(hit);
        node.title = src;
        continue;
      }
      node.classList.add("is-translating");
      translateText(src, lang, provider).then((out) => {
        node.classList.remove("is-translating");
        if (!out || !node.isConnected) return;
        node.textContent = wrap(out);
        node.title = src;
        if (event) this.move(event);
      });
    }
  }

  static move(event) {
    const el = this.el;
    if (!el?.classList.contains("is-visible")) return;
    const pad = 16;
    const { innerWidth: vw, innerHeight: vh } = window;
    const rect = el.getBoundingClientRect();
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + rect.width > vw - 8) x = event.clientX - rect.width - pad;
    if (y + rect.height > vh - 8) y = Math.max(8, vh - rect.height - 8);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (this.cmpEls?.some((e) => e.classList.contains("is-visible"))) this.placeCompare();
  }

  static hide() {
    this.el?.classList.remove("is-visible");
    this.hideCompare();
    this.current = null;
    this.mode = null;
  }

  /** Короткая подсказка (бывший title): первая строка - заголовок, остальные - текст */
  static tipHtml(text) {
    const lines = String(text ?? "").split("\n").filter((l) => l.trim());
    if (!lines.length) return "";
    const [head, ...rest] = lines;
    // «текст<TAB>значение» - значение прижато вправо
    const cell = (l) => {
      const [a, b] = l.split("\t");
      return b === undefined ? esc(a.trim()) : `<span>${esc(a.trim())}</span><b>${esc(b.trim())}</b>`;
    };
    const body = rest
      .map((l) => {
        if (l.startsWith("## ")) return `<div class="pd-tip-section">${esc(l.slice(3))}</div>`;
        if (l.startsWith("! ")) return `<div class="pd-tip-line is-warn ${l.includes("\t") ? "is-kv" : ""}">${cell(l.slice(2))}</div>`;
        if (l.startsWith("~ ")) return `<div class="pd-tip-note">${esc(l.slice(2))}</div>`;
        // «» » - описание (художественный текст): переводится и в режиме «только описания»
        if (l.startsWith("» ")) return `<div class="pd-tip-line is-desc pd-tr">${esc(l.slice(2))}</div>`;
        const sub = /^\s{2,}|^[·✓-]\s/.test(l);
        const text = sub ? l.replace(/^\s*[·✓-]?\s*/, "") : l;
        return `<div class="pd-tip-line ${sub ? "is-sub" : ""} ${l.includes("\t") ? "is-kv" : ""}">${sub ? '<i class="pd-tip-dot"></i>' : ""}${cell(text)}</div>`;
      })
      .join("");
    return `<div class="pd-tip-head ${head.includes("\t") ? "is-kv" : ""}">${cell(head)}</div>${body}`;
  }

  /**
   * Системные подсказки (title) в окне куколки и списке смены рисуем своей карточкой:
   * title переносится в data-pd-tip, показ - один общий обработчик на документ.
   */
  static adoptTitles(root) {
    if (!root) return;
    // Перерисовка: старая подсказка могла остаться от исчезнувшего элемента
    if (this.mode === "tip") this.hide();
    for (const el of root.querySelectorAll("[title]")) {
      const t = el.getAttribute("title");
      el.removeAttribute("title");
      if (t) el.dataset.pdTip = t;
    }
    if (this._tipsBound) return;
    this._tipsBound = true;
    let timer = null;
    let current = null;
    const inScope = (el) => el?.closest?.(".wfrp-paperdoll, .wfrp-paperdoll-flyout");
    document.addEventListener("pointerover", (ev) => {
      const t = ev.target?.closest?.("[data-pd-tip]");
      if (!t || !inScope(t) || t === current) return;
      current = t;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (current !== t || !t.isConnected) return;
        this.showHtml(this.tipHtml(t.dataset.pdTip), ev, "tip");
      }, 250);
    });
    document.addEventListener("pointerout", (ev) => {
      if (!current) return;
      if (ev.relatedTarget && current.contains(ev.relatedTarget)) return;
      if (ev.target?.closest?.("[data-pd-tip]") !== current) return;
      current = null;
      clearTimeout(timer);
      if (this.mode === "tip") this.hide();
    });
    document.addEventListener("pointermove", (ev) => {
      if (this.mode === "tip") this.move(ev);
    });
  }

  static build(item, app = null) {
    const sys = item.system;
    const cfg = game.wfrp4e.config;
    const L = (k) => game.i18n.localize(k);
    const rarity = RARITY[sys.availability?.value] ?? "none";
    const lines = [];

    // Шапка: крупная иконка в рамке редкости, рядом название, тип и состояние
    const typeKey = `TYPES.Item.${item.type}`;
    const typeLabel = game.i18n.has(typeKey) ? L(typeKey) : item.type;
    const sub = [typeLabel];
    if (sys.isEquipped) sub.push(L("WFRPPD.Tooltip.Equipped"));
    lines.push(`
      <div class="pd-tt-head">
        <div class="pd-tt-icon rarity-${rarity}"><img src="${esc(itemImg(item.img, item.name))}" alt=""></div>
        <div class="pd-tt-title">
          <div class="pd-tt-name rarity-${rarity}">${esc(item.name)}</div>
          <div class="pd-tt-sub">${esc(sub.join(" · "))}</div>
          ${this.priceHtml(sys.price, app)}
        </div>
      </div>`);

    if (item.type === "weapon") {
      // Блок оружия как у брони: заголовок (группа и хват), строки с крупными значениями
      const group = safe(() => sys.WeaponGroup);
      const twoH = sys.twohanded?.value ? L("WFRPPD.Tooltip.TwoHanded") : L("WFRPPD.Tooltip.OneHanded");
      const bonus = app ? app._weaponBonuses(item) : { dmg: 0, parts: [], info: [] };
      const base = safe(() => sys.Damage);
      const rows = [];
      const row = (label, val, cls = "", sub = "") =>
        rows.push(`<div class="pd-tt-ap-row"><span>${esc(label)}${sub}</span><span class="pd-tt-val ${cls}">${esc(val)}</span></div>`);
      if (base !== null && base !== undefined && base !== "") {
        const total = Number(base) + bonus.dmg;
        const sub = bonus.parts.length ? `<small class="pd-tt-bonus">${esc(bonus.parts.join(", "))}</small>` : "";
        row(L("WFRPPD.Tooltip.Damage"), `+${Number.isNaN(total) ? base : total}`, "is-dmg", sub);
      }
      // Шанс попасть: навык группы оружия, без него - ББ / ДБ
      if (app) {
        const hit = app._attackTarget(item);
        if (hit) row(L("WFRPPD.Roll.Chance"), `${hit.target}%`, "is-text", `<small class="pd-tt-bonus">${esc(hit.from)}</small>`);
      }
      if (safe(() => sys.isMelee)) {
        const reach = safe(() => sys.Reach);
        if (reach) row(L("WFRPPD.Tooltip.Reach"), L(reach), "is-text");
      } else {
        const range = safe(() => sys.Range);
        if (range) row(L("WFRPPD.Tooltip.Range"), game.i18n.format("WFRPPD.Tooltip.Yards", { n: range }), "is-text");
        // Боеприпасы: что подходит и сколько
        const need = weaponAmmoGroup(item);
        if (need && app) {
          const ammo = (app.actor.itemTypes.ammunition ?? []).filter((x) => ammoGroupOf(x) === need && Number(x.system.quantity?.value ?? 1) > 0);
          const n = ammo.reduce((t, x) => t + Number(x.system.quantity?.value ?? 1), 0);
          row(L("WFRPPD.Tooltip.Ammo"), n ? String(n) : "0", n ? "" : "is-hurt",
            ammo.length ? `<small class="pd-tt-sub2">${esc(ammo.map((x) => x.name).join(", "))}</small>` : "");
        }
      }
      lines.push(`<div class="pd-tt-armour">
          <div class="pd-tt-armour-head"><span>${esc(group ? L(group) : "")}</span><span>${esc(twoH)}</span></div>
          ${rows.join("")}
        </div>`);
      const notes = bonus.info.map((i) => `<div class="pd-tt-note is-good">${esc(i)}</div>`);
      // Ограничения по правилам: без навыка, неосновная рука, обеты, нет боеприпасов
      if (app) {
        const r = app._restrictions(item, sys.offhand?.value ? "off" : "main");
        for (const x of r.forbid) notes.push(`<div class="pd-tt-note is-bad">${esc(x.label)}</div>`);
        for (const x of r.warn) if (!x.info) notes.push(`<div class="pd-tt-note ${x.good ? "is-good" : "is-bad"}">${esc(humanizeTerms(x.label))}</div>`);
      }
      if (notes.length) lines.push(`<div class="pd-tt-notes">${notes.join("")}</div>`);
    }

    if (item.type === "armour") {
      // Класс брони таблицей: часть тела слева, значок КБ справа. Парные части с равным КБ - одной строкой
      const current = safe(() => sys.currentAP, sys.AP) ?? {};
      const cell = (l) => {
        const max = Number(sys.AP?.[l] ?? 0);
        const cur = Number(current[l] ?? max);
        return { max, cur, txt: cur < max ? `${cur}/${max}` : `${max}`, hurt: cur < max };
      };
      const rows = [];
      const add = (label, c) => c.max > 0 && rows.push({ label, ...c });
      const all = LOCATIONS.map(cell);
      if (all.every((c) => c.max > 0 && c.txt === all[0].txt)) add(L("WFRPPD.Tooltip.AllBody"), all[0]);
      else {
        add(L(cfg.locations.head), cell("head"));
        add(L(cfg.locations.body), cell("body"));
        for (const [r, l, both] of [["rArm", "lArm", "WFRPPD.Tooltip.Arms"], ["rLeg", "lLeg", "WFRPPD.Tooltip.Legs"]]) {
          const a = cell(r);
          const b = cell(l);
          if (a.max > 0 && b.max > 0 && a.txt === b.txt) add(L(both), a);
          else {
            add(L(cfg.locations[r]), a);
            add(L(cfg.locations[l]), b);
          }
        }
      }
      const type = cfg.armorTypes?.[sys.armorType?.value];
      if (rows.length) {
        lines.push(`<div class="pd-tt-armour">
          <div class="pd-tt-armour-head"><span>${esc(L("WFRPPD.Tooltip.AP"))}</span>${type ? `<span>${esc(L(type))}</span>` : ""}</div>
          ${rows
            .map((r) => `<div class="pd-tt-ap-row"><span>${esc(r.label)}</span><span class="pd-tt-ap ${r.hurt ? "is-hurt" : ""}">${esc(r.txt)}</span></div>`)
            .join("")}
        </div>`);
      } else if (type) lines.push(`<div class="pd-tt-row"><span>${esc(L(type))}</span></div>`);
      // Что эта вещь значит по правилам: слои и штрафы к навыкам
      const notes = [];
      if (isUnderLayer(item)) notes.push(`<div class="pd-tt-note is-good">${esc(L("WFRPPD.Tooltip.UnderLayer"))}</div>`);
      const pen = armourSkillPenalties(item);
      if (pen.stealth) notes.push(`<div class="pd-tt-note is-bad">${esc(game.i18n.format("WFRPPD.Restr.Stealth", { n: -pen.stealth }))}</div>`);
      if (pen.perception) notes.push(`<div class="pd-tt-note is-bad">${esc(game.i18n.format("WFRPPD.Restr.Perception", { n: -pen.perception }))}</div>`);
      if (!notes.length && sys.penalty?.value) notes.push(`<div class="pd-tt-note is-bad">${esc(sys.penalty.value)}</div>`);
      if (notes.length) lines.push(`<div class="pd-tt-notes">${notes.join("")}</div>`);
    }

    const qualities = safe(() => sys.Qualities, []) ?? [];
    const flaws = safe(() => sys.Flaws, []) ?? [];
    if (qualities.length || flaws.length) {
      lines.push(`<div class="pd-tt-tags">${[
        ...qualities.map((q) => `<span class="pd-tt-tag is-quality">${esc(q)}</span>`),
        ...flaws.map((f) => `<span class="pd-tt-tag is-flaw">${esc(f)}</span>`)
      ].join("")}</div>`);
    }

    // Цены (и самой вещи, и ингредиентов) видит только ГМ
    const desc = parseDescription(sys.description?.value, { hidePrices: !(game.user?.isGM || option("prices")) });
    if (desc.props.length) {
      const rows = desc.props
        .slice(0, 8)
        .map(([k, v]) => `<div class="pd-tt-prop"><span>${esc(k)}</span><span>${esc(humanizeTerms(v))}</span></div>`)
        .join("");
      lines.push(`<div class="pd-tt-props">${rows}</div>`);
    }
    if (desc.text) {
      const full = humanizeTerms(desc.text);
      const short = full.length > 300 ? `${full.slice(0, 300).trim()}…` : full;
      // Короткий текст без свойств - это «флейвор», как жёлтая цитата в WoW
      const flavor = !desc.props.length && short.length < 160;
      lines.push(flavor ? `<div class="pd-tt-desc pd-tr">«${esc(short)}»</div>` : `<div class="pd-tt-text pd-tr">${esc(short)}</div>`);
    }
    if (desc.hasTable) lines.push(`<div class="pd-tt-more">${esc(L("WFRPPD.Tooltip.HasTable"))}</div>`);

    // Низ: нагрузка, цена, доступность
    const footer = [];
    const enc = sys.encumbrance?.total ?? sys.encumbrance?.value;
    if (enc !== undefined && enc !== null) footer.push(`${L("WFRPPD.Tooltip.Enc")}: ${enc}`);
    if (footer.length) lines.push(`<div class="pd-tt-footer">${esc(footer.join(" · "))}</div>`);

    const avail = cfg.availability?.[sys.availability?.value];
    if (avail && sys.availability?.value !== "None")
      lines.push(`<div class="pd-tt-avail rarity-${rarity}">${esc(L(avail))}</div>`);

    // Двойной клик имеет смысл только для того, что вообще можно надеть
    const wearable = !!sys.isEquippable && safe(() => sys.canEquip, true) !== false;
    const cmpHint = app && option("shiftCompare") && this.compareTargets(item, app).length ? ` · ${L("WFRPPD.Tooltip.CompareHint")}` : "";
    lines.push(`<div class="pd-tt-hint">${esc(L(wearable ? "WFRPPD.Tooltip.Hint" : "WFRPPD.Tooltip.HintOpen"))}${esc(cmpHint)}</div>`);
    return lines.join("");
  }

  /**
   * Цена иконками монет под названием: 2 [крона] 5 [шиллинг]. Видит ГМ или игрок с опцией «Показывать цены».
   * Иконки - картинки монет персонажа (как в шапке), без них - нарисованные кружки.
   */
  static priceHtml(price, app = null) {
    if (!price || !(game.user?.isGM || option("prices"))) return "";
    const V = { gc: 240, ss: 12, bp: 1 };
    const coins = app?.actor?.items?.filter?.((i) => i.type === "money") ?? [];
    const parts = Object.keys(V)
      .filter((k) => Number(price[k]) > 0)
      .map((k) => {
        const coin = coins.find((c) => Number(c.system.coinValue?.value) === V[k]);
        const title = esc(game.i18n.localize(`WFRPPD.Money.Name.${k}`));
        const icon = coin?.img ? `<img src="${esc(coin.img)}" alt="">` : `<i class="pd-coin-dot pd-coin-dot--${k}"></i>`;
        return `<span class="pd-tt-coin" title="${title}">${Number(price[k])}${icon}</span>`;
      });
    return parts.length ? `<div class="pd-tt-price">${parts.join("")}</div>` : "";
  }

  static formatPrice(price) {
    if (!price) return "";
    const L = (k) => game.i18n.localize(k);
    const parts = [];
    if (price.gc) parts.push(`${price.gc} ${L("WFRPPD.Money.gc")}`);
    if (price.ss) parts.push(`${price.ss} ${L("WFRPPD.Money.ss")}`);
    if (price.bp) parts.push(`${price.bp} ${L("WFRPPD.Money.bp")}`);
    return humanizeTerms(parts.join(" "));
  }
}


/* ============================================ */
/*  Быстрая смена: выпадающий список слота      */
/* ============================================ */

function itemMeta(item, app = null) {
  const sys = item.system;
  const cfg = game.wfrp4e.config;
  const L = (k) => game.i18n.localize(k);
  if (item.type === "weapon") {
    const parts = [];
    const dmg = app ? app._weaponDamage(item) : safe(() => sys.Damage);
    if (dmg !== null && dmg !== undefined && dmg !== "") parts.push(`${L("WFRPPD.Tooltip.Damage")} +${dmg}`);
    parts.push(sys.twohanded?.value ? L("WFRPPD.Tooltip.TwoHanded") : L("WFRPPD.Tooltip.OneHanded"));
    return parts.join(" · ");
  }
  if (item.type === "armour") {
    const parts = LOCATIONS.filter((l) => (sys.AP?.[l] ?? 0) > 0).map((l) => `${L(cfg.locations[l])} ${sys.AP[l]}`);
    return parts.length ? `${L("WFRPPD.Tooltip.APShort")}: ${parts.join(", ")}` : "";
  }
  const typeKey = `TYPES.Item.${item.type}`;
  return game.i18n.has(typeKey) ? L(typeKey) : item.type;
}

class PaperdollFlyout {
  static el = null;
  static app = null;
  static slot = null;
  static _onDocPointer = null;
  static _onKey = null;

  static isOpenFor(app, slot) {
    return this.el?.isConnected && this.app === app && this.slot === slot;
  }

  static open(app, slot, anchor) {
    this.close();
    this.app = app;
    this.slot = slot;

    const L = (k) => game.i18n.localize(k);
    const { current, available, worn } = app._swapCandidates(slot);

    // Сортировка по силе, BIS - лучший предмет среди всего подходящего (надетые в других слотах не в счёт)
    const profile = app._profile();
    const val = new Map([...current, ...available, ...worn].map((i) => [i.id, app._slotValue(i, slot, profile)]));
    // Запрещённое по правилам - всегда в конце списка
    const rank = (i) => (val.get(i.id).forbidden ? -1e6 : 0) + val.get(i.id).score;
    const byScore = (a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name, game.i18n.lang);
    current.sort(byScore);
    available.sort(byScore);
    const all = [...current, ...available];
    const allowed = all.filter((i) => !val.get(i.id).forbidden);
    const bestScore = allowed.length ? Math.max(...allowed.map((i) => val.get(i.id).score)) : null;
    const bisCount = allowed.filter((i) => val.get(i.id).score === bestScore).length;
    const curValue = current.length ? Math.max(...current.map((i) => val.get(i.id).value ?? 0)) : 0;

    const deltaChip = (item) => {
      const v = val.get(item.id);
      if (v.value === null) return "";
      const d = v.value - curValue;
      if (!current.length && !d) return "";
      if (!d) return `<span class="pd-fly-delta is-same">=</span>`;
      const unit = L(`WFRPPD.Fly.Unit.${v.unit}`);
      return `<span class="pd-fly-delta ${d > 0 ? "is-up" : "is-down"}"><i class="pd-delta-ico" style="--ico: url('${uiArt(d > 0 ? "ui-delta-up" : "ui-delta-down")}')"></i>${d > 0 ? "+" : "-"}${Math.abs(d)} ${esc(unit)}</span>`;
    };

    const row = (item, act) => {
      const sys = item.system;
      const rarity = RARITY[sys.availability?.value] ?? "none";
      const qty = (sys.quantity?.value ?? 1) > 1 ? `<span class="pd-qty">${sys.quantity.value}</span>` : "";
      let meta = itemMeta(item, app);
      const where = act === "equip" || act === "swap" ? app._currentSlotOf(item) : null;
      if (where) meta += ` · ${game.i18n.format("WFRPPD.Fly.Now", { slot: app._slotLabel(where) })}`;
      const isSwap = act === "swap";
      if (isSwap) {
        act = "equip";
        // Для надетой в другом слоте сумки главное - где она сейчас
        meta = game.i18n.format("WFRPPD.Fly.NowCap", { slot: app._slotLabel(where) });
      }
      const icon = act === "unequip" ? `<img class="pd-fly-act" src="${uiArt("ui-close")}" alt="" title="${esc(L("WFRPPD.Fly.Unequip"))}">` : "";
      // BIS только если он один: при равенстве подсвечивать нечего
      const v = val.get(item.id);
      const bis = !isSwap && !v.forbidden && bisCount === 1 && v.score === bestScore && all.length > 1;
      const chips = [
        ...v.restr.forbid.map((r) => `<span class="pd-chip is-forbid" title="${esc(r.hint ?? L("WFRPPD.Restr.ForbiddenHint"))}"><img src="${uiArt("ui-forbid")}" alt="">${esc(r.label)}</span>`),
        ...v.restr.warn.map((r) => `<span class="pd-chip ${r.good ? "is-good" : r.info ? "is-info" : "is-warn"}" ${r.hint ? `title="${esc(r.hint)}"` : ""}>${!r.good && !r.info ? `<img src="${uiArt("ui-warn")}" alt="">` : ""}${esc(humanizeTerms(r.label))}</span>`)
      ].join("");
      const bisBadge = bis ? `<img class="pd-fly-bis" src="${uiArt("ui-bis")}" alt="BIS" title="${esc(L("WFRPPD.Fly.BisHint"))}">` : "";
      const delta = isSwap ? `<span class="pd-fly-delta is-same">${esc(L("WFRPPD.Fly.Swap"))}</span>` : act === "equip" ? deltaChip(item) : "";
      return `
        <div class="pd-fly-row ${bis ? "is-bis" : ""} ${v.forbidden ? "is-forbidden" : ""}" data-item-id="${item.id}" data-act="${act}">
          <div class="pd-fly-icon rarity-${rarity}"><img src="${esc(itemImg(item.img, item.name))}" alt="">${qty}</div>
          <div class="pd-fly-text">
            <div class="pd-fly-name rarity-${rarity}">${esc(item.name)}</div>
            <div class="pd-fly-meta">${esc(meta)}</div>
            ${chips ? `<div class="pd-fly-chips">${chips}</div>` : ""}
          </div>
          <div class="pd-fly-side">${bisBadge}${delta}</div>
          ${icon}
        </div>`;
    };

    let html = `<div class="pd-fly-title">${esc(app._slotLabel(slot))}</div>`;
    // Какие таланты учтены в оценке - один раз на весь список, а не у каждой строки
    if (slot === "main" || slot === "off") {
      const t = [];
      if (profile.mightyBlow) t.push(game.i18n.format("WFRPPD.Talent.ShortMightyBlow", { n: profile.mightyBlow }));
      if (profile.accurateShot) t.push(game.i18n.format("WFRPPD.Talent.ShortAccurateShot", { n: profile.accurateShot }));
      if (profile.sureShot) t.push(game.i18n.format("WFRPPD.Talent.ShortSureShot", { n: profile.sureShot }));
      if (slot === "off" && profile.ambidextrous) t.push(game.i18n.format("WFRPPD.Talent.ShortAmbidextrous", { n: profile.ambidextrous }));
      if (slot === "off" && profile.dualWielder) t.push(L("WFRPPD.Talent.ShortDualWielder"));
      if (t.length) html += `<div class="pd-fly-talents">${esc(L("WFRPPD.Talent.Counted"))}: ${esc(t.join(", "))}</div>`;
    }
    if (current.length) {
      html += `<div class="pd-fly-section">${esc(L("WFRPPD.Fly.Current"))}</div>`;
      html += current.map((i) => row(i, "unequip")).join("");
    }
    // Совсем пусто: ни надетого, ни подходящего - одна строка «Нечего надеть» с заглушкой слота
    if (!current.length && !available.length && !worn.length) {
      html += `
        <div class="pd-fly-row pd-fly-nothing">
          <div class="pd-fly-icon"><img src="${uiArt(SLOT_ART[slot] ?? "slot-bag")}" alt=""></div>
          <div class="pd-fly-text"><div class="pd-fly-name">${esc(L("WFRPPD.Fly.Nothing"))}</div></div>
        </div>`;
    }
    // Нечего надеть - раздел не показываем вовсе
    if (available.length) {
      html += `<div class="pd-fly-section">${esc(L("WFRPPD.Fly.Available"))}</div>`;
      html += available.map((i) => row(i, "equip")).join("");
    }
    if (worn.length) {
      html += `<div class="pd-fly-section">${esc(L("WFRPPD.Fly.WornElsewhere"))}</div>`;
      html += worn.map((i) => row(i, "swap")).join("");
    }
    // Явная кнопка «оставить слот пустым» - удобно снять всё одним кликом
    if (current.length) {
      html += `
        <div class="pd-fly-row pd-fly-clear" data-act="clear">
          <div class="pd-fly-icon"><img src="${uiArt("ui-unequip-all")}" alt=""></div>
          <div class="pd-fly-text">
            <div class="pd-fly-name">${esc(L("WFRPPD.Fly.Clear"))}</div>
            <div class="pd-fly-meta">${esc(game.i18n.format("WFRPPD.Fly.ClearHint", { n: current.length }))}</div>
          </div>
        </div>`;
    }

    const el = document.createElement("div");
    el.className = `wfrp-paperdoll-flyout ${themeClass()}`;
    el.innerHTML = html;
    document.body.append(el);
    PaperdollTooltip.adoptTitles(el);
    this.el = el;
    anchor.classList.add("is-open");
    this.anchor = anchor;

    // Позиция: справа от стрелочки, с переворотом у края экрана
    const r = anchor.getBoundingClientRect();
    const fr = el.getBoundingClientRect();
    let x = r.right + 6;
    if (x + fr.width > window.innerWidth - 8) x = r.left - fr.width - 6;
    let y = r.top - 8;
    if (y + fr.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - fr.height - 8);
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${y}px`;

    el.querySelector(".pd-fly-clear")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      PaperdollTooltip.hide();
      this.close();
      app._clearSlot(slot);
    });

    for (const rowEl of el.querySelectorAll(".pd-fly-row[data-item-id]")) {
      const item = app.actor.items.get(rowEl.dataset.itemId);
      if (!item) continue;
      rowEl.addEventListener("pointerenter", (ev) => PaperdollTooltip.show(item, ev, app));
      rowEl.addEventListener("pointermove", (ev) => PaperdollTooltip.move(ev));
      rowEl.addEventListener("pointerleave", () => PaperdollTooltip.hide());
      rowEl.addEventListener("click", (ev) => {
        ev.preventDefault();
        PaperdollTooltip.hide();
        const act = rowEl.dataset.act;
        this.close();
        if (act === "unequip") app._unequip(item);
        else app._equipTo(item, slot);
      });
      rowEl.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        PaperdollTooltip.hide();
        item.sheet?.render(true);
      });
    }

    this._onDocPointer = (ev) => {
      if (el.contains(ev.target) || ev.target.closest?.(".pd-slot-frame, .pd-bagsec-icon")) return;
      this.close();
    };
    this._onKey = (ev) => {
      if (ev.key === "Escape") this.close();
    };
    document.addEventListener("pointerdown", this._onDocPointer, true);
    document.addEventListener("keydown", this._onKey, true);
  }

  static close() {
    if (this._onDocPointer) document.removeEventListener("pointerdown", this._onDocPointer, true);
    if (this._onKey) document.removeEventListener("keydown", this._onKey, true);
    this._onDocPointer = this._onKey = null;
    this.anchor?.classList.remove("is-open");
    this.anchor = null;
    this.el?.remove();
    this.el = null;
    this.app = null;
    this.slot = null;
  }
}

/* -------------------------------------------- */
/*  API для дополнений                          */
/* -------------------------------------------- */

/** Общие помощники ядра: дополнения берут их отсюда, а не копируют */
export const PD_UTIL = {
  MODULE_ID, LOCATIONS, GROUP_SKILL, METAL_ARMOUR, LEATHER_ARMOUR, RANGED_FALLBACK, RARITY_RANK, LIMB_LOCS, EXTRA_HANDS, EXTRA_HEADS,
  esc, safe, T, norm, option, setting, asset, uiArt, itemImg, talentImg, skillMatches, stripTags, plainEnrichers, humanizeTerms,
  isArmLoc, shieldValue, advanceCost, effectPolarity, prostheticKind, baseName,
  extraSlotOf, isExtraHand, isExtraHead, addonHook
};

export const PD_API = {
  PaperdollApp,
  PaperdollTooltip,
  util: PD_UTIL,
  addons: ADDONS,
  hasAddon: (id) => ADDONS.has(id),

  /**
   * Подключить дополнение.
   * addon = { id, title, icon, settings: [{ key, default, type?, choices?, scope? }], tabs: [...],
   *   statSets(app, sets, ctx), restrictions(app, item, slot, out, profile), effects(app, out),
   *   effectClick(app, entry, ev), bagToolbar(app), externalDrop(app, item, data), onRender(app, root) }
   */
  registerAddon(addon) {
    if (!addon?.id) return;
    ADDONS.set(addon.id, addon);
    for (const def of addon.settings ?? []) {
      if (typeof def.default === "boolean" && !(def.key in PD_OPTIONS)) PD_OPTIONS[def.key] = def.default;
      const full = `${MODULE_ID}.${def.key}`;
      if (!game.settings?.register || game.settings.settings?.has(full)) continue;
      game.settings.register(MODULE_ID, def.key, {
        name: def.name ?? `WFRPPD.Options.${def.key}.Name`,
        hint: def.hint ?? `WFRPPD.Options.${def.key}.Hint`,
        scope: def.scope ?? "client",
        config: false,
        type: def.type ?? Boolean,
        default: def.default,
        ...(def.choices ? { choices: def.choices } : {}),
        onChange: () => PaperdollApp.renderAll()
      });
    }
  },

  /** Добавить методы окну (класс-«примесь»: его методы копируются в PaperdollApp) */
  mixin(Cls) {
    for (const key of Object.getOwnPropertyNames(Cls.prototype)) {
      if (key === "constructor") continue;
      Object.defineProperty(PaperdollApp.prototype, key, Object.getOwnPropertyDescriptor(Cls.prototype, key));
    }
  }
};
