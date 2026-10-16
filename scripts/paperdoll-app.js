import { ICON_OVERRIDES } from "./icon-index.js";
import { ownIconFor } from "./icon-rules.js";

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

/** Опции куколки и значения по умолчанию: мутации и травмы учитываются, цены скрыты, звуки включены */
export const PD_OPTIONS = { mutations: true, injuries: true, prices: false, sounds: true };
export const option = (key) => setting(key, PD_OPTIONS[key]);

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
  if (!img?.startsWith(CORE_ICONS) || !setting("itemIcons", true)) return img;
  const rel = ownIconFor(img.slice(CORE_ICONS.length), name, ICON_OVERRIDES);
  return rel ? asset(`icons/${rel}`) : img;
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
  hand3: "slot-main",
  hand4: "slot-main",
  head2: "slot-head",
  head3: "slot-head"
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
const STAT_ART = { physical: "stat-body", mental: "stat-mind", combat: "stat-combat", defence: "stat-defence", fate: "stat-fate" };

/* -------------------------------------------- */
/*  Конечности: ампутации, переломы, протезы    */
/* -------------------------------------------- */

const LIMB_LOCS = ["rArm", "lArm", "rLeg", "lLeg"];
const isArmLoc = (loc) => loc === "rArm" || loc === "lArm";
const baseName = (img) => String(img ?? "").split("/").pop().replace(/\.\w+$/, "").toLowerCase();

/**
 * Что травма делает с конечностью. Узнаём по картинке wfrp4e-core (не зависит от перевода),
 * потом по названию на английском и русском.
 * arm / hand / leg / foot - ампутация, broken / torn - временно не действует (книга: как ампутация, пока не заживёт)
 */
function injuryLimbKind(item) {
  const img = baseName(item.img);
  const name = String(item.name ?? "").toLowerCase();
  const test = (imgRe, nameRe) => imgRe.test(img) || nameRe.test(name);
  if (test(/^amputatedhand/, /amputated hand|lost hand|кист/)) return "hand";
  if (test(/^amputatedarm/, /amputated arm|lost arm|потер\S* рук|ампутац\S* рук/)) return "arm";
  if (test(/^amputatedfoot/, /amputated foot|lost foot|стоп/)) return "foot";
  if (test(/^amputatedleg/, /amputated leg|lost leg|потер\S* ног|ампутац\S* ног/)) return "leg";
  if (test(/^broken-(arm|leg)/, /broken bone|перелом/)) return "broken";
  if (test(/^torn(arm|leg)/, /torn muscle \(major\)|серь\S* разрыв|разрыв\S* мышц\S* \(серь/)) return "torn";
  return null;
}

/** Какая конечность: rArm / lArm / rLeg / lLeg или null, если по данным не понять */
function injuryLimbLoc(item, kind) {
  const key = item.system?.location?.key;
  if (LIMB_LOCS.includes(key)) return key;
  const text = `${item.system?.location?.value ?? ""} ${item.name ?? ""} ${baseName(item.img)}`.toLowerCase();
  const side = /\bleft\b|лев/.test(text) ? "l" : /\bright\b|прав/.test(text) ? "r" : null;
  const arm = ["hand", "arm"].includes(kind) || /arm|hand|рук|кист/.test(text);
  const leg = ["foot", "leg"].includes(kind) || /leg|foot|ног|стоп/.test(text);
  if (!side || arm === leg) return null;
  return `${side}${arm ? "Arm" : "Leg"}`;
}

/* -------------------------------------------- */
/*  Мутации: лишние руки и головы               */
/* -------------------------------------------- */

const EXTRA_HANDS = ["hand3", "hand4"];
const EXTRA_HEADS = ["head2", "head3"];
const isExtraHand = (slot) => EXTRA_HANDS.includes(slot);
const isExtraHead = (slot) => EXTRA_HEADS.includes(slot);
const isExtraSlot = (slot) => isExtraHand(slot) || isExtraHead(slot);
/** В каком дополнительном слоте вещь (флаг модуля) */
const extraSlotOf = (item) => item?.flags?.[MODULE_ID]?.extraSlot ?? null;

/**
 * Что мутация даёт куколке: "hand" - лишняя рука, "head" - лишняя голова, "none" - ничего (решение ГМ), null - не знаем.
 * В базовой книге таких мутаций нет (есть щупальце - это черта-оружие), они бывают в дополнениях и у ГМ,
 * поэтому сначала флаг, который ставит ГМ кликом по мутации, потом название.
 */
function mutationGrant(item) {
  const flag = item.flags?.[MODULE_ID]?.grants;
  if (flag) return flag;
  const name = String(item.name ?? "").toLowerCase();
  if (/(extra|additional|third|fourth|second)\s+(arm|hand)s?|(третья|четв\S+|лишн\S+|дополнит\S+|втор\S+)\s+(рук|кист)|многорук/.test(name)) return "hand";
  if (/(extra|additional|second|two|third)\s+heads?|(втор\S+|лишн\S+|дополнит\S+|треть\S+)\s+голов|двухголов|две головы|многоголов/.test(name)) return "head";
  return null;
}

/** Протез: hook - крюк, leg - деревянная нога или стопа, marvel - инженерное чудо */
function prostheticKind(item) {
  if (item.type !== "trapping") return null;
  const img = baseName(item.img);
  const name = String(item.name ?? "").toLowerCase();
  if (/engineering-marvel/.test(img) || /engineering marvel|инженерн\S* чуд/.test(name)) return "marvel";
  if (/hook/.test(img) || /\bhook\b|крюк/.test(name)) return "hook";
  if (/false-leg|wooden-leg/.test(img) || /false (leg|foot)|wooden leg|peg leg|деревянн\S* ног|искусственн\S* (ног|стоп)/.test(name)) return "leg";
  return null;
}

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

export class PaperdollApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Одно окно на актёра */
  static instances = new Map();

  static uiState = { filter: "all", tab: "bag", statPanels: ["physical", "fate"], sort: "default", view: "grid" };

  _saveUiState() {
    PaperdollApp.uiState = { filter: this._filter, tab: this._tab, statPanels: [...this._statPanels], sort: this._sort, view: this._view };
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
      openSheet: PaperdollApp.onOpenSheet,
      setSort: PaperdollApp.onSetSort,
      setView: PaperdollApp.onSetView,
      toggleSortMenu: PaperdollApp.onToggleSortMenu,
      toggleOptions: PaperdollApp.onToggleOptions
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/paperdoll.hbs`,
      scrollable: [".pd-bag-list"]
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
    const armourSlot = (key) => {
      const items = armour
        .filter((a) => a.system.protects?.[key] && !(key === "head" && isExtraHead(extraSlotOf(a))))
        // При равном AP сверху то, что носят поверх: латы, потом кольчуга, потом кожа
        .sort((a, b) => (b.system.AP?.[key] ?? 0) - (a.system.AP?.[key] ?? 0) || layerRank(b) - layerRank(a));
      // Протез этой конечности - в её же слот, отдельным слоем (AP не даёт)
      const prost = prosthetics.filter((pr) => pr.flags?.[MODULE_ID]?.limb === key);
      const slot = makeSlot(key, [...items, ...prost], { showAP: true });
      slot.maim = this._maimView(key, limbs);
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
      return slot;
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
          return slot;
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
        pack: uiArt("ui-pack")
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
      sortOptions: ["default", "rarity-desc", "rarity-asc", "name-asc", "name-desc"].map((key) => ({
        key,
        label: L(`WFRPPD.Sort.${key}`),
        active: key === this._sort
      })),
      viewList: this._view === "list",
      options: Object.keys(PD_OPTIONS).map((key) => ({
        key,
        value: option(key),
        label: game.i18n.localize(`WFRPPD.Options.${key}.Name`),
        hint: game.i18n.localize(`WFRPPD.Options.${key}.Hint`)
      })),
      optionsOpen: !!this._optionsOpen,
      sortOpen: !!this._sortOpen,
      statPanels,
      statCategories,
      tabBag: this._tab === "bag",
      tabStats: this._tab === "stats",
      encumbrance: {
        current: encCurrent,
        max: encMax,
        pct: Math.clamp(encRatio * 100, 0, 100),
        state: encState,
        stateLabel: L(`WFRPPD.Enc.${encState}`),
        hint: encHint
      }
    };
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

    const charRow = (key) => {
      const c = chars[key] ?? {};
      const mod = Number(c.modifier) || 0;
      const full = cfg.characteristics?.[key];
      return {
        key: `char.${key}`,
        label: full ? L(full) : L(cfg.characteristicsAbbrev?.[key] ?? key),
        value: c.value ?? "-",
        cls: mod > 0 ? "is-up" : mod < 0 ? "is-down" : "",
        hint: [
          c.bonus !== undefined ? `${L("WFRPPD.Stats.Bonus")} ${c.bonus}` : "",
          mod ? game.i18n.format("WFRPPD.Stats.Modified", { mod: `${mod > 0 ? "+" : "-"}${Math.abs(mod)}` }) : ""
        ]
          .filter(Boolean)
          .join("\n")
      };
    };
    const row = (labelKey, value, cls = "") => ({
      key: labelKey,
      label: L(labelKey),
      value: value === undefined || value === null || value === "" ? "-" : value,
      cls
    });
    const pair = (a, b) => (a === undefined || a === null ? "-" : `${a} / ${b ?? "-"}`);
    const profile = this._profile();
    const dmg = (items) => {
      const w = items[0];
      if (!w) return "-";
      const d = this._weaponDamage(w, profile);
      return d === null ? "-" : `+${d}`;
    };
    const ap = (loc) => st.armour?.[loc]?.value ?? 0;
    const ranged = weapons.find((w) => safe(() => w.system.isRanged));

    const wounds = st.wounds ?? {};
    const woundsCls = wounds.max && wounds.value < wounds.max ? "is-down" : "";

    return {
      physical: ["ws", "bs", "s", "t", "i", "ag"].map(charRow),
      mental: [
        ...["dex", "int", "wp", "fel"].map(charRow),
        row("WFRPPD.Stats.Move", det.move?.value),
        row("WFRPPD.Stats.Run", det.move?.run)
      ],
      defence: [
        row("WFRPPD.Wounds", pair(wounds.value, wounds.max), woundsCls),
        row("WFRPPD.Stats.Crits", pair(st.criticalWounds?.value ?? 0, st.criticalWounds?.max), (st.criticalWounds?.value ?? 0) > 0 ? "is-down" : ""),
        row(cfg.locations?.head ?? "head", ap("head"), "is-armour"),
        row(cfg.locations?.body ?? "body", ap("body"), "is-armour"),
        row("WFRPPD.Stats.Arms", `${ap("rArm")} / ${ap("lArm")}`, "is-armour"),
        row("WFRPPD.Stats.Legs", `${ap("rLeg")} / ${ap("lLeg")}`, "is-armour"),
        ...(() => {
          const profile = this._profile();
          if (!profile.caster) return [];
          const pen = this._castPenalty(profile);
          return [row("WFRPPD.Stats.CastPenalty", pen ? `-${pen} УУ` : "0", pen ? "is-down" : "")];
        })()
      ],
      combat: [
        row("WFRPPD.Stats.MainDmg", dmg(mainItems)),
        row("WFRPPD.Stats.OffDmg", dmg(offItems)),
        row("WFRPPD.Stats.RangedDmg", ranged ? dmg([ranged]) : "-"),
        row("WFRPPD.Stats.SB", chars.s?.bonus),
        row("WFRPPD.Stats.TB", chars.t?.bonus),
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
  }

  /** Категории для вкладки «Характеристики» справа (как аддон ECS) */
  _statCategories(sets) {
    const sys = this.actor.system;
    const L = (key) => game.i18n.localize(key);
    const det = sys.details ?? {};
    const exp = det.experience;
    const enc = sys.status?.encumbrance ?? {};
    const row = (labelKey, value, cls = "") => ({
      key: labelKey,
      label: L(labelKey),
      value: value === undefined || value === null || value === "" ? "-" : value,
      cls
    });

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
      { key: "physical", rows: sets.physical },
      { key: "mental", rows: sets.mental.slice(0, 4) },
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
    // У каждой строки - термины для поиска статьи правил (английские названия из книги + подпись)
    const withArticle = (r) => ({ ...r, article: [ARTICLE_TERMS[r.key], r.label.replace(/:$/, "")].filter(Boolean).join("|") });
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
    const match = (name) => [...terms].some((t) => t && name?.toLowerCase().includes(String(t).toLowerCase()));
    // Сначала журналы мира, потом компендиумы журналов
    for (const entry of game.journal ?? []) {
      if (match(entry.name)) return entry.sheet.render(true);
      const page = entry.pages?.find((pg) => match(pg.name));
      if (page) return entry.sheet.render(true, { pageId: page.id });
    }
    for (const pack of game.packs ?? []) {
      if (pack.documentName !== "JournalEntry") continue;
      const index = await pack.getIndex();
      const hit = index.find((e) => match(e.name));
      if (hit) return (await pack.getDocument(hit._id))?.sheet.render(true);
    }
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

  /** Дополнительные слоты от мутаций: { hands: ["hand3"], heads: ["head2"], source: { hand3: mutation } } */
  _extraSlots() {
    const out = { hands: [], heads: [], source: {} };
    if (!option("mutations")) return out;
    for (const m of this.actor.itemTypes.mutation ?? []) {
      const grant = mutationGrant(m);
      const list = grant === "hand" ? EXTRA_HANDS : grant === "head" ? EXTRA_HEADS : null;
      const target = grant === "hand" ? out.hands : out.heads;
      if (!list || target.length >= list.length) continue;
      const key = list[target.length];
      target.push(key);
      out.source[key] = m;
    }
    return out;
  }

  /**
   * Состояние конечностей: какие травмы, какой протез надет, работает ли рука или нога.
   * Инженерное чудо отменяет все последствия для своей конечности.
   */
  _limbState() {
    const state = Object.fromEntries(LIMB_LOCS.map((loc) => [loc, { injuries: [], prosthetic: null }]));
    // Учёт травм выключен в опциях: конечности считаем целыми
    for (const item of option("injuries") ? this.actor.items : []) {
      if (item.type === "injury") {
        const kind = injuryLimbKind(item);
        const loc = kind && injuryLimbLoc(item, kind);
        if (loc) state[loc].injuries.push({ item, kind });
      } else if (item.system?.isEquipped && prostheticKind(item)) {
        const loc = item.flags?.[MODULE_ID]?.limb;
        if (LIMB_LOCS.includes(loc)) state[loc].prosthetic = item;
      }
    }
    for (const [loc, st] of Object.entries(state)) {
      const kinds = st.injuries.map((x) => x.kind);
      st.marvel = prostheticKind(st.prosthetic ?? {}) === "marvel";
      st.lost = !st.marvel && kinds.some((k) => ["arm", "hand", "leg", "foot"].includes(k));
      st.disabled = !st.marvel && kinds.some((k) => ["broken", "torn"].includes(k));
      // Рука: держать оружие нечем. Щит можно привязать к культе, если потеряна только кисть
      st.noHand = isArmLoc(loc) && (st.lost || st.disabled);
      st.stump = isArmLoc(loc) && !st.disabled && kinds.includes("hand") && !kinds.includes("arm") && !st.marvel;
      st.hook = st.stump && prostheticKind(st.prosthetic ?? {}) === "hook";
      st.any = st.injuries.length > 0;
    }
    return state;
  }

  /** Рука, которая держит оружие в слоте main / off */
  _handLoc(slot) {
    const main = safe(() => this.actor.mainArmLoc, null) ?? "rArm";
    if (slot === "main") return main;
    return main === "rArm" ? "lArm" : "rArm";
  }

  /** Значок на слоте: что не так с конечностью (и чем она заменена) */
  _maimView(loc, limbs) {
    const st = limbs[loc];
    if (!st?.any) return null;
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);
    const top = st.injuries[0].item;
    const lines = st.injuries.map((x) => `${x.item.name} - ${L(`WFRPPD.Limb.Kind.${x.kind}`)}`);
    if (st.prosthetic) lines.push(F("WFRPPD.Limb.Prosthetic", { name: st.prosthetic.name }));
    if (st.marvel) lines.push(L("WFRPPD.Limb.MarvelHint"));
    else if (isArmLoc(loc)) {
      if (st.noHand) lines.push(L(st.stump ? "WFRPPD.Limb.StumpHint" : "WFRPPD.Limb.NoHandHint"));
      if (st.hook) lines.push(L("WFRPPD.Limb.HookHint"));
    } else if (st.lost) lines.push(L(prostheticKind(st.prosthetic ?? {}) === "leg" ? "WFRPPD.Limb.LegProsthesisHint" : "WFRPPD.Limb.NoLegHint"));
    else if (st.disabled) lines.push(L("WFRPPD.Limb.LegDisabledHint"));
    if (st.disabled) lines.push(L("WFRPPD.Limb.TempHint"));
    return {
      img: itemImg(st.prosthetic && !st.marvel ? st.prosthetic.img : top.img, st.prosthetic && !st.marvel ? st.prosthetic.name : top.name),
      ok: st.marvel,
      title: lines.join("\n")
    };
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
    const sorters = {
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
          name: effect.name || L(cfg.conditions[condition]),
          img: effect.img,
          value: value && value > 1 ? value : null,
          debuff: true,
          lines: [effect.description ? plainEnrichers(stripTags(effect.description)) : ""],
          hint: L("WFRPPD.Effects.HintCondition")
        });
        continue;
      }
      // Эффекты, перенесённые с предметов и талантов, сюда не тащим - это «пассивки»
      if (effect.parent !== actor || effect.transfer === true && effect.origin) continue;
      out.push({
        kind: "effect",
        id: effect.id,
        name: effect.name,
        img: effect.img,
        disabled: !!effect.disabled,
        debuff: true,
        lines: [effect.description ? plainEnrichers(stripTags(effect.description)) : ""],
        hint: L(effect.disabled ? "WFRPPD.Effects.HintEnable" : "WFRPPD.Effects.HintDisable")
      });
    }

    const locName = (key) => (cfg.locations?.[key] ? L(cfg.locations[key]) : key);
    // Травма конечности, которую заменило инженерное чудо, больше не действует
    const limbs = this._limbState();
    const negated = (injury) => {
      const kind = injuryLimbKind(injury);
      const loc = kind && injuryLimbLoc(injury, kind);
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
        hint: L(this.editable ? "WFRPPD.Effects.HintInjury" : "WFRPPD.Effects.HintOpen")
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
        hint: L("WFRPPD.Effects.HintOpen")
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
        hint: L("WFRPPD.Effects.HintOpen")
      });
    }

    // Мутации: телесные и душевные, в рамке Хаоса. ГМ кликом отмечает, даёт ли мутация лишнюю руку или голову
    for (const m of option("mutations") ? actor.itemTypes.mutation ?? [] : []) {
      const sys = m.system ?? {};
      const type = sys.mutationType?.value;
      const grant = mutationGrant(m);
      out.push({
        kind: "mutation",
        id: m.id,
        name: m.name,
        img: itemImg(m.img, m.name),
        debuff: true,
        grant,
        lines: [
          type ? L(cfg.mutationTypes?.[type] ?? `WFRPPD.Mutation.Type.${type}`) : "",
          sys.modifier?.value ?? "",
          sys.description?.value ? plainEnrichers(stripTags(sys.description.value)) : "",
          grant === "hand" || grant === "head" ? F("WFRPPD.Mutation.Grants", { slot: L(`WFRPPD.Mutation.Grant.${grant}`) }) : ""
        ],
        hint: L(game.user?.isGM ? "WFRPPD.Mutation.GMHint" : "WFRPPD.Effects.HintOpen")
      });
    }

    return out.map((e) => ({ ...e, lines: e.lines.filter(Boolean).map((l) => humanizeTerms(l)) }));
  }

  /** ЛКМ по эффекту */
  async _onEffectClick(entry, ev = null) {
    if (!this.editable) return;
    try {
      // Shift+ЛКМ по травме - удалить её (с подтверждением): зажило, вылечили, ГМ отменил
      if (ev?.shiftKey && ["injury", "critical"].includes(entry.kind)) {
        const item = this.actor.items.get(entry.id);
        if (!item) return;
        const content = `<p>${game.i18n.format("WFRPPD.Effects.DeleteConfirm", { name: foundry.utils.escapeHTML?.(item.name) ?? item.name })}</p>`;
        const Dialog = foundry.applications?.api?.DialogV2;
        const ok = Dialog
          ? await Dialog.confirm({ window: { title: game.i18n.localize("WFRPPD.Effects.DeleteTitle") }, content })
          : true;
        if (ok) await item.delete();
        return;
      }
      if (entry.kind === "condition") {
        if (typeof this.actor.removeCondition === "function") await this.actor.removeCondition(entry.key, 1);
        else await this.actor.effects.get(entry.id)?.delete();
      } else if (entry.kind === "effect") {
        const effect = this.actor.effects.get(entry.id);
        await effect?.update({ disabled: !effect.disabled });
      } else if (entry.kind === "mutation" && game.user?.isGM) {
        // ГМ: ЛКМ по мутации переключает, что она даёт куколке: лишняя рука -> голова -> ничего -> по названию
        const order = [null, "hand", "head", "none"];
        const item = this.actor.items.get(entry.id);
        const now = item?.flags?.[MODULE_ID]?.grants ?? null;
        const next = order[(order.indexOf(now) + 1) % order.length];
        await item?.update({ [`flags.${MODULE_ID}.grants`]: next });
        ui.notifications.info(game.i18n.format("WFRPPD.Mutation.Set", { name: item?.name ?? "", slot: game.i18n.localize(`WFRPPD.Mutation.Grant.${next ?? "auto"}`) }));
      } else {
        this.actor.items.get(entry.id)?.sheet?.render(true);
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | effect action failed`, err);
    }
  }

  /** ПКМ по эффекту - открыть его лист */
  _onEffectContext(entry) {
    if (entry.kind === "condition" || entry.kind === "effect") this.actor.effects.get(entry.id)?.sheet?.render(true);
    else this.actor.items.get(entry.id)?.sheet?.render(true);
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

  /** Даёт ли эта броня штраф к касту этому магу */
  _castsThrough(item, profile) {
    const type = item.system.armorType?.value;
    if (profile.metalLore && (METAL_ARMOUR.includes(type) || item.system.isMetal)) return false;
    if (profile.beastLore && LEATHER_ARMOUR.includes(type)) return false;
    return true;
  }

  /** Штраф брони к касту: максимум AP по локациям среди «мешающей» брони */
  _castPenalty(profile, extra = null) {
    if (!profile.caster) return 0;
    const worn = this.actor.itemTypes.armour?.filter((a) => a.system.isEquipped) ?? [];
    const list = extra && !worn.includes(extra) ? [...worn, extra] : worn;
    let max = 0;
    for (const loc of LOCATIONS) {
      const ap = list
        .filter((a) => this._castsThrough(a, profile))
        .reduce((n, a) => n + (safe(() => a.system.currentAP?.[loc], null) ?? a.system.AP?.[loc] ?? 0), 0);
      max = Math.max(max, ap);
    }
    return max;
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
      // Рука без кисти или сломана: держать оружие нечем (перетащить всё равно можно - вдруг ГМ разрешит)
      if (slot === "main" || slot === "off") {
        const limbs = this._limbState();
        const hand = limbs[this._handLoc(slot)];
        const other = limbs[this._handLoc(slot === "main" ? "off" : "main")];
        if (hand.noHand) {
          if (shieldValue(item) && hand.stump) warn.push({ label: L("WFRPPD.Limb.ShieldStrapped"), info: true });
          else forbid.push({ label: L(hand.disabled ? "WFRPPD.Limb.HandBroken" : "WFRPPD.Limb.NoHand"), hint: L("WFRPPD.Limb.NoHandHint") });
        }
        if (sys.twohanded?.value && (hand.noHand || other.noHand)) forbid.push({ label: L("WFRPPD.Limb.NeedTwoHands") });
      }
      // Бонусы талантов уже сидят в уроне; здесь только «невидимая» часть (Верный выстрел)
      score += this._weaponBonuses(item, profile).score;
    }

    if (item.type === "armour") {
      if (profile.caster && !sys.isEquipped && this._castsThrough(item, profile)) {
        const delta = this._castPenalty(profile, item) - this._castPenalty(profile);
        if (delta > 0) {
          warn.push({ label: F("WFRPPD.Restr.Cast", { n: -delta }), hint: L("WFRPPD.Restr.CastHint") });
          score -= delta * 150;
        }
      }
      if (sys.penalty?.value) warn.push({ label: sys.penalty.value, info: true });
    }

    for (const cult of profile.cults) {
      if (cult.forbids(item)) forbid.push({ label: F("WFRPPD.Restr.Cult", { god: L(cult.god) }), hint: L(cult.hint) });
    }

    return { forbid, warn, score };
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

  static onToggleOptions() {
    this._optionsOpen = !this._optionsOpen;
    this.element.querySelector(".pd-options-menu")?.classList.toggle("is-open", this._optionsOpen);
  }

  static onToggleSortMenu() {
    this._sortOpen = !this._sortOpen;
    this.element.querySelector(".pd-sortmenu")?.classList.toggle("is-open", this._sortOpen);
  }

  static onSetFilter(event, target) {
    this._filter = target.dataset.filter ?? "all";
    this._saveUiState();
    this.render();
  }

  static onAutoPack(event) {
    event?.stopPropagation?.();
    this._autoPack();
  }

  static onSetTab(event, target) {
    this._tab = target.dataset.tab === "stats" ? "stats" : "bag";
    this._saveUiState();
    this.render();
  }

  static onOpenSheet() {
    this.actor.sheet?.render(true);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    PaperdollTooltip.hide();
    const root = this.element;
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
          root.querySelector(".pd-sortmenu")?.classList.remove("is-open");
        }
        if (this._optionsOpen && !ev.target.closest?.(".pd-options")) {
          this._optionsOpen = false;
          root.querySelector(".pd-options-menu")?.classList.remove("is-open");
        }
      });
    }

    // Опции куколки: переключатели сохраняются в настройках модуля (у каждого игрока свои)
    for (const box of root.querySelectorAll(".pd-option input[data-option]")) {
      box.addEventListener("change", async () => {
        try {
          await game.settings.set(MODULE_ID, box.dataset.option, box.checked);
        } catch (err) {
          console.warn(`${MODULE_ID} | option failed`, err);
        }
        PaperdollApp.renderAll();
      });
    }

    // Подзаголовок: клик по карьере, виду, статусу - статья
    for (const el of root.querySelectorAll(".pd-hero-part")) {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._openArticle(el.dataset.kind, el.textContent.trim());
      });
    }
    // Вкладка «Характеристики»: значок справа от строки открывает статью правил
    for (const el of root.querySelectorAll(".pd-ecs-info")) {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        const terms = (el.dataset.article ?? "").split("|").filter(Boolean);
        this._openArticle("stat", terms.at(-1) ?? "", terms.slice(0, -1));
      });
    }
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
      ui.notifications.warn(game.i18n.localize("WFRPPD.Warn.NotOwned"));
      return null;
    }
    return item;
  }

  _onDragStart(event, item, el) {
    PaperdollTooltip.hide();
    this._dragging = { item };
    // Формат Foundry: предмет можно бросить и в другие окна (лист, другой актёр)
    event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
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

function effectTooltip(entry) {
  const L = (k) => game.i18n.localize(k);
  const kind = L(`WFRPPD.Effects.Kind.${entry.kind}`);
  const state = entry.disabled ? ` · ${L("WFRPPD.Effects.Disabled")}` : "";
  const value = entry.value ? ` ${entry.value}` : "";
  const lines = entry.lines.map((l) => `<div class="pd-tt-text">${esc(l.length > 260 ? `${l.slice(0, 260)}…` : l)}</div>`).join("");
  return `
    <div class="pd-tt-name ${entry.debuff ? "is-debuff" : ""}">${esc(entry.name)}${esc(value)}</div>
    <div class="pd-tt-sub">${esc(kind + state)}</div>
    ${lines}
    <div class="pd-tt-hint">${esc(entry.hint)} · ${esc(L("WFRPPD.Effects.HintSheet"))}</div>`;
}

class PaperdollTooltip {
  static el = null;

  static ensure() {
    if (this.el?.isConnected) return this.el;
    this.el = document.createElement("div");
    this.el.className = "wfrp-paperdoll-tooltip";
    document.body.append(this.el);
    return this.el;
  }

  static showHtml(html, event) {
    const el = this.ensure();
    el.className = `wfrp-paperdoll-tooltip ${themeClass()}`;
    el.innerHTML = html;
    el.classList.add("is-visible");
    this.move(event);
  }

  static show(item, event, app = null) {
    const el = this.ensure();
    el.className = `wfrp-paperdoll-tooltip ${themeClass()}`;
    el.innerHTML = this.build(item, app);
    el.classList.add("is-visible");
    this.move(event);
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
  }

  static hide() {
    this.el?.classList.remove("is-visible");
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
        </div>
      </div>`);

    if (item.type === "weapon") {
      const group = safe(() => sys.WeaponGroup);
      const twoH = sys.twohanded?.value ? L("WFRPPD.Tooltip.TwoHanded") : L("WFRPPD.Tooltip.OneHanded");
      lines.push(`<div class="pd-tt-row"><span>${esc(group ? L(group) : "")}</span><span>${esc(twoH)}</span></div>`);
      const bonus = app ? app._weaponBonuses(item) : { dmg: 0, parts: [], info: [] };
      const base = safe(() => sys.Damage);
      if (base !== null && base !== undefined && base !== "") {
        const total = Number(base) + bonus.dmg;
        const from = bonus.parts.length ? ` <span class="pd-tt-bonus">(${esc(bonus.parts.join(", "))})</span>` : "";
        lines.push(`<div class="pd-tt-stat">${esc(L("WFRPPD.Tooltip.Damage"))}: <b>+${esc(Number.isNaN(total) ? base : total)}</b>${from}</div>`);
      }
      for (const i of bonus.info) lines.push(`<div class="pd-tt-bonus">${esc(i)}</div>`);
      if (safe(() => sys.isMelee)) {
        const reach = safe(() => sys.Reach);
        if (reach) lines.push(`<div class="pd-tt-stat">${esc(L("WFRPPD.Tooltip.Reach"))}: ${esc(L(reach))}</div>`);
      } else {
        const range = safe(() => sys.Range);
        if (range) lines.push(`<div class="pd-tt-stat">${esc(L("WFRPPD.Tooltip.Range"))}: ${esc(range)}</div>`);
      }
    }

    if (item.type === "armour") {
      const type = cfg.armorTypes?.[sys.armorType?.value];
      if (type) lines.push(`<div class="pd-tt-row"><span>${esc(L(type))}</span></div>`);
      const current = safe(() => sys.currentAP, sys.AP) ?? {};
      const parts = LOCATIONS.filter((l) => (sys.AP?.[l] ?? 0) > 0).map((l) => {
        const max = sys.AP[l];
        const cur = current[l] ?? max;
        const val = cur < max ? `${cur}/${max}` : `${max}`;
        return `${esc(L(cfg.locations[l]))}: <b>${esc(val)}</b>`;
      });
      if (parts.length)
        lines.push(`<div class="pd-tt-stat">${esc(L("WFRPPD.Tooltip.AP"))}<br>${parts.join("<br>")}</div>`);
      if (sys.penalty?.value)
        lines.push(`<div class="pd-tt-flaw">${esc(L("WFRPPD.Tooltip.Penalty"))}: ${esc(sys.penalty.value)}</div>`);
    }

    const qualities = safe(() => sys.Qualities, []) ?? [];
    const flaws = safe(() => sys.Flaws, []) ?? [];
    if (qualities.length) lines.push(`<div class="pd-tt-quality">${qualities.map(esc).join(", ")}</div>`);
    if (flaws.length) lines.push(`<div class="pd-tt-flaw">${flaws.map(esc).join(", ")}</div>`);

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
      lines.push(flavor ? `<div class="pd-tt-desc">«${esc(short)}»</div>` : `<div class="pd-tt-text">${esc(short)}</div>`);
    }
    if (desc.hasTable) lines.push(`<div class="pd-tt-more">${esc(L("WFRPPD.Tooltip.HasTable"))}</div>`);

    // Низ: нагрузка, цена, доступность
    const footer = [];
    const enc = sys.encumbrance?.total ?? sys.encumbrance?.value;
    if (enc !== undefined && enc !== null) footer.push(`${L("WFRPPD.Tooltip.Enc")}: ${enc}`);
    // Цену видит только ГМ: игрокам не нужно знать, сколько стоит их добыча
    const price = game.user?.isGM || option("prices") ? this.formatPrice(sys.price) : "";
    if (price) footer.push(price);
    if (footer.length) lines.push(`<div class="pd-tt-footer">${esc(footer.join(" · "))}</div>`);

    const avail = cfg.availability?.[sys.availability?.value];
    if (avail && sys.availability?.value !== "None")
      lines.push(`<div class="pd-tt-avail rarity-${rarity}">${esc(L(avail))}</div>`);

    // Двойной клик имеет смысл только для того, что вообще можно надеть
    const wearable = !!sys.isEquippable && safe(() => sys.canEquip, true) !== false;
    lines.push(`<div class="pd-tt-hint">${esc(L(wearable ? "WFRPPD.Tooltip.Hint" : "WFRPPD.Tooltip.HintOpen"))}</div>`);
    return lines.join("");
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
