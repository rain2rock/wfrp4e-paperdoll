export const MODULE_ID = "wfrp4e-paperdoll";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Локации брони в WFRP4e (ключи как в system.AP и actor.system.status.armour) */
const LOCATIONS = ["head", "body", "rArm", "lArm", "rLeg", "lLeg"];

/** Иконки пустых слотов (Font Awesome 6 free) */
const SLOT_ICONS = {
  head: "fa-solid fa-user",
  body: "fa-solid fa-shirt",
  rArm: "fa-solid fa-hand",
  lArm: "fa-solid fa-hand",
  rLeg: "fa-solid fa-socks",
  lLeg: "fa-solid fa-socks",
  accessory: "fa-solid fa-ring",
  container: "fa-solid fa-sack-xmark",
  main: "fa-solid fa-hand-fist",
  off: "fa-solid fa-shield-halved"
};

/** Доступность предмета -> «редкость» рамки в стиле WoW */
const RARITY = {
  common: "common",
  scarce: "scarce",
  rare: "rare",
  exotic: "exotic",
  special: "exotic"
};

const BAG_FILTERS = ["all", "weapon", "armour", "clothing", "other"];

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
function parseDescription(html) {
  const root = document.createElement("div");
  root.innerHTML = html ?? "";
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

export class PaperdollApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Одно окно на актёра */
  static instances = new Map();

  static uiState = { filter: "all", tab: "bag", statPanels: ["physical", "combat"] };

  _saveUiState() {
    PaperdollApp.uiState = { filter: this._filter, tab: this._tab, statPanels: [...this._statPanels] };
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
      openSheet: PaperdollApp.onOpenSheet
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/paperdoll.hbs`,
      scrollable: [".pd-bag-grid"]
    }
  };

  constructor({ actor, ...options } = {}) {
    const safeId = actor.uuid.replace(/[^a-zA-Z0-9_-]/g, "-");
    super({ ...options, id: `wfrp-paperdoll-${safeId}` });
    this.actor = actor;
    // Выбор вкладки и выпадашек запоминаем между открытиями окна
    this._filter = PaperdollApp.uiState.filter;
    this._tab = PaperdollApp.uiState.tab;
    this._statPanels = [...PaperdollApp.uiState.statPanels];
    this._dragging = null;

    this._debouncedRender = foundry.utils.debounce(() => {
      if (this.rendered) this.render();
    }, 50);

    const isMine = (doc) => doc?.parent?.uuid === this.actor.uuid;
    this._hooks = [
      ["createItem", Hooks.on("createItem", (item) => isMine(item) && this._debouncedRender())],
      ["updateItem", Hooks.on("updateItem", (item) => isMine(item) && this._debouncedRender())],
      ["deleteItem", Hooks.on("deleteItem", (item) => isMine(item) && this._debouncedRender())],
      ["updateActor", Hooks.on("updateActor", (a) => a.uuid === this.actor.uuid && this._debouncedRender())],
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
      const views = items.map((i) => view(i));
      if (!views.length && ghost) views.push(view(ghost, { ghost: true }));
      return {
        key,
        label: this._slotLabel(key),
        icon: SLOT_ICONS[key],
        top: views[0] ?? null,
        layers: Math.max(0, views.filter((v) => !v.ghost).length - 1),
        showAP,
        ap: showAP ? (sys.status?.armour?.[key]?.value ?? 0) : null
      };
    };

    // --- Броня: сверху слой с наибольшим AP на этой локации ---
    const armour = equipped("armour");
    const armourSlot = (key) => {
      const items = armour
        .filter((a) => a.system.protects?.[key])
        .sort((a, b) => (b.system.AP?.[key] ?? 0) - (a.system.AP?.[key] ?? 0));
      return makeSlot(key, items, { showAP: true });
    };

    // --- Оружие ---
    const weapons = equipped("weapon");
    const mainItems = weapons.filter((w) => !w.system.offhand?.value);
    const offItems = weapons.filter((w) => w.system.offhand?.value);
    const twoHander = mainItems.find((w) => w.system.twohanded?.value);

    const clothing = equipped("trapping").filter((t) => t.system.trappingType?.value === "clothingAccessories");

    const groups = [
      { area: "left", slots: ["head", "body", "rArm", "lArm"].map(armourSlot) },
      {
        area: "right",
        slots: [armourSlot("rLeg"), armourSlot("lLeg"), makeSlot("accessory", clothing), makeSlot("container", equipped("container"))]
      },
      {
        area: "weapons",
        slots: [makeSlot("main", mainItems), makeSlot("off", offItems, { ghost: twoHander })]
      }
    ];

    // --- Сумка ---
    const bagAll = actor.items
      .filter((i) => i.system?.isPhysical && i.type !== "money" && !i.system.isEquipped)
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, game.i18n.lang));
    const bag = bagAll.filter((i) => this._matchesFilter(i, this._filter)).map((i) => view(i));
    const filters = BAG_FILTERS.map((key) => ({
      key,
      label: L(`WFRPPD.Filter.${key}`),
      active: key === this._filter,
      count: bagAll.filter((i) => this._matchesFilter(i, key)).length
    }));

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
    const subtitle = [
      career ? `${career.name}${level ? ` (${L("WFRPPD.Level")} ${level})` : ""}` : "",
      species,
      sys.details?.status?.value ?? ""
    ]
      .filter(Boolean)
      .join(" · ");

    const enc = sys.status?.encumbrance ?? {};
    const encCurrent = Number(enc.current) || 0;
    const encMax = Number(enc.max) || 0;
    const encRatio = encMax ? encCurrent / encMax : 0;
    let encState = "ok";
    if (encRatio > 2) encState = "max";
    else if (encRatio > 1) encState = "over";

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
      careerIcon,
      effects: this._effectsCache = this._effectsView(),
      groups,
      bag,
      bagEmpty: !bag.length,
      filters,
      statPanels,
      statCategories,
      tabBag: this._tab === "bag",
      tabStats: this._tab === "stats",
      encumbrance: {
        current: encCurrent,
        max: encMax,
        pct: Math.clamp(encRatio * 100, 0, 100),
        state: encState,
        stateLabel: L(`WFRPPD.Enc.${encState}`)
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
        label: full ? L(full) : L(cfg.characteristicsAbbrev?.[key] ?? key),
        value: c.value ?? "-",
        cls: mod > 0 ? "is-up" : mod < 0 ? "is-down" : "",
        hint: c.bonus !== undefined ? `${L("WFRPPD.Stats.Bonus")} ${c.bonus}` : ""
      };
    };
    const row = (labelKey, value, cls = "") => ({
      label: L(labelKey),
      value: value === undefined || value === null || value === "" ? "-" : value,
      cls
    });
    const pair = (a, b) => (a === undefined || a === null ? "-" : `${a} / ${b ?? "-"}`);
    const dmg = (items) => {
      const w = items[0];
      if (!w) return "-";
      const d = safe(() => w.system.Damage);
      return d === null || d === undefined || d === "" ? "-" : `+${d}`;
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
          return [row("WFRPPD.Stats.CastPenalty", pen ? `-${pen} УУ` : "0", pen ? "is-down" : "is-up")];
        })()
      ],
      combat: [
        row("WFRPPD.Stats.MainDmg", dmg(mainItems), "is-melee"),
        row("WFRPPD.Stats.OffDmg", dmg(offItems), "is-melee"),
        row("WFRPPD.Stats.RangedDmg", ranged ? dmg([ranged]) : "-", "is-melee"),
        row("WFRPPD.Stats.SB", chars.s?.bonus),
        row("WFRPPD.Stats.TB", chars.t?.bonus),
        row("WFRPPD.Stats.Advantage", st.advantage?.value ?? 0)
      ],
      fate: [
        row("WFRPPD.Stats.Fate", st.fate?.value, "is-fate"),
        row("WFRPPD.Stats.Fortune", st.fortune?.value, "is-fate"),
        row("WFRPPD.Stats.Resilience", st.resilience?.value, "is-fate"),
        row("WFRPPD.Stats.Resolve", st.resolve?.value, "is-fate"),
        row("WFRPPD.Stats.Corruption", pair(st.corruption?.value ?? 0, st.corruption?.max), "is-chaos"),
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
          row("WFRPPD.Stats.ExpCurrent", exp.current, "is-up")
        ]
      });
    return cats.map((c) => ({ ...c, label: L(`WFRPPD.Stats.Set.${c.key}`) }));
  }

  _itemView(item, editable, extra = {}) {
    const sys = item.system;
    const qty = sys.quantity?.value ?? 1;
    return {
      id: item.id,
      name: item.name,
      img: item.img,
      rarity: RARITY[sys.availability?.value] ?? "none",
      qty: qty > 1 ? qty : null,
      draggable: editable && !extra.ghost,
      equippable: !!sys.isEquippable && this._defaultSlot(item) !== null,
      ghost: !!extra.ghost
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
    if (LOCATIONS.includes(slot)) return item.type === "armour" && !!sys.protects?.[slot];
    if (slot === "main" || slot === "off") return item.type === "weapon";
    if (slot === "accessory")
      return item.type === "trapping" && sys.trappingType?.value === "clothingAccessories";
    if (slot === "container") return item.type === "container";
    return false;
  }

  /** Слот по умолчанию для двойного клика */
  _defaultSlot(item) {
    const sys = item.system;
    if (item.type === "armour") return LOCATIONS.find((l) => sys.protects?.[l]) ?? null;
    if (item.type === "container") return "container";
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

  /** Предмет сейчас лежит именно в этом слоте */
  _isInSlot(item, slot) {
    if (!item.system.isEquipped || !this._canDrop(item, slot)) return false;
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
    // Двуручное во вторую руку не предлагаем - оно всё равно уйдёт в основную
    if (slot === "off") available = available.filter((i) => !i.system.twohanded?.value);
    const byName = (a, b) => a.name.localeCompare(b.name, game.i18n.lang);
    return { current: current.sort(byName), available: available.sort(byName) };
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
        img: injury.img,
        value: dur.active && Number(dur.value) ? Number(dur.value) : null,
        debuff: true,
        lines: [
          sys.location?.value ? `${L("WFRPPD.Effects.Location")}: ${locName(sys.location.key ?? sys.location.value)}` : "",
          sys.penalty?.value ? `${L("WFRPPD.Effects.Penalty")}: ${sys.penalty.value}` : "",
          left ?? ""
        ],
        hint: L("WFRPPD.Effects.HintOpen")
      });
    }
    for (const crit of actor.itemTypes.critical ?? []) {
      const sys = crit.system;
      out.push({
        kind: "critical",
        id: crit.id,
        name: crit.name,
        img: crit.img,
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
        img: disease.img,
        debuff: true,
        lines: [state, sys.symptoms?.value ? `${L("WFRPPD.Effects.Symptoms")}: ${sys.symptoms.value}` : ""],
        hint: L("WFRPPD.Effects.HintOpen")
      });
    }

    return out.map((e) => ({ ...e, lines: e.lines.filter(Boolean).map((l) => humanizeTerms(l)) }));
  }

  /** ЛКМ по эффекту */
  async _onEffectClick(entry) {
    if (!this.editable) return;
    try {
      if (entry.kind === "condition") {
        if (typeof this.actor.removeCondition === "function") await this.actor.removeCondition(entry.key, 1);
        else await this.actor.effects.get(entry.id)?.delete();
      } else if (entry.kind === "effect") {
        const effect = this.actor.effects.get(entry.id);
        await effect?.update({ disabled: !effect.disabled });
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
      cults
    };
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
      // Неосновная рука: щиты и защитное оружие с Ближним боем (парирующее) без штрафа
      if (slot === "off" && !shieldValue(item)) {
        const defensive = (safe(() => sys.Qualities, []) ?? []).some((q) => /defensive|защитн/i.test(q));
        const parry = defensive && profile.hasSkill(GROUP_SKILL.parry);
        const pen = parry ? 0 : -20 + 10 * profile.ambidextrous;
        if (pen < 0) {
          warn.push({ label: F("WFRPPD.Restr.OffHand", { n: pen }), hint: L("WFRPPD.Restr.OffHandHint") });
          score += pen * 10;
        }
      }
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

    if (LOCATIONS.includes(slot)) {
      const ap = safe(() => sys.currentAP?.[slot], null) ?? sys.AP?.[slot] ?? 0;
      return { value: ap, unit: "AP", score: ap * 100 + extras };
    }
    if (slot === "main" || slot === "off") {
      const shield = shieldValue(item);
      if (slot === "off" && shield) return { value: shield, unit: "shield", score: 1000 + shield * 100 + extras };
      const dmg = Number(safe(() => sys.Damage, 0)) || 0;
      return { value: dmg, unit: "dmg", score: dmg * 100 + extras };
    }
    return { value: null, unit: null, score: extras };
  }

  /** Где сейчас надет предмет (для подписи «сейчас: ...») */
  _currentSlotOf(item) {
    if (!item.system.isEquipped) return null;
    if (item.type === "weapon") return item.system.offhand?.value ? "off" : "main";
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
      if (item.type === "weapon") await this._equipWeapon(item, slot);
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
      if (w.id === item.id || !w.system.isEquipped) return false;
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
  async _clearSlot(slot) {
    if (!this.editable) return;
    const { current } = this._swapCandidates(slot);
    if (!current.length) return;
    try {
      await this.actor.updateEmbeddedDocuments(
        "Item",
        current.map((i) => ({ _id: i.id, "system.equipped.value": false }))
      );
    } catch (err) {
      console.warn(`${MODULE_ID} | clear slot failed`, err);
    }
  }

  async _unequip(item) {
    if (!this.editable || !item?.system?.isEquipped) return;
    try {
      await item.update({ "system.equipped.value": false });
    } catch (err) {
      console.warn(`${MODULE_ID} | unequip failed`, err);
    }
  }

  _slotLabel(slot) {
    if (LOCATIONS.includes(slot)) return game.i18n.localize(game.wfrp4e.config.locations[slot]);
    const map = { main: "Main", off: "Off", accessory: "Accessory", container: "Container" };
    return game.i18n.localize(`WFRPPD.Slot.${map[slot] ?? slot}`);
  }

  /* -------------------------------------------- */
  /*  События                                     */
  /* -------------------------------------------- */

  static onSetFilter(event, target) {
    this._filter = target.dataset.filter ?? "all";
    this._saveUiState();
    this.render();
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

    for (const el of root.querySelectorAll(".pd-item")) {
      const item = this.actor.items.get(el.dataset.itemId);
      if (!item) continue;

      el.addEventListener("pointerenter", (ev) => PaperdollTooltip.show(item, ev));
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
        }
      });

      if (!this.editable) continue;
      el.addEventListener("dragstart", (ev) => this._onDragStart(ev, item, el));
      el.addEventListener("dragend", () => this._onDragEnd());
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
        this._onEffectClick(entry);
      });
      el.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        PaperdollTooltip.hide();
        this._onEffectContext(entry);
      });
    }

    // Кнопки быстрой смены (стрелочка справа от иконки)
    PaperdollFlyout.close();
    for (const btn of root.querySelectorAll(".pd-swap")) {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        PaperdollTooltip.hide();
        if (PaperdollFlyout.isOpenFor(this, btn.dataset.slot)) PaperdollFlyout.close();
        else PaperdollFlyout.open(this, btn.dataset.slot, btn);
      });
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
    el.innerHTML = html;
    el.classList.add("is-visible");
    this.move(event);
  }

  static show(item, event) {
    const el = this.ensure();
    el.innerHTML = this.build(item);
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

  static build(item) {
    const sys = item.system;
    const cfg = game.wfrp4e.config;
    const L = (k) => game.i18n.localize(k);
    const rarity = RARITY[sys.availability?.value] ?? "none";
    const lines = [];

    lines.push(`<div class="pd-tt-name rarity-${rarity}">${esc(item.name)}</div>`);

    // Подзаголовок: тип и состояние
    const typeKey = `TYPES.Item.${item.type}`;
    const typeLabel = game.i18n.has(typeKey) ? L(typeKey) : item.type;
    const sub = [typeLabel];
    if (sys.isEquipped) sub.push(L("WFRPPD.Tooltip.Equipped"));
    lines.push(`<div class="pd-tt-sub">${esc(sub.join(" · "))}</div>`);

    if (item.type === "weapon") {
      const group = safe(() => sys.WeaponGroup);
      const twoH = sys.twohanded?.value ? L("WFRPPD.Tooltip.TwoHanded") : L("WFRPPD.Tooltip.OneHanded");
      lines.push(`<div class="pd-tt-row"><span>${esc(group ? L(group) : "")}</span><span>${esc(twoH)}</span></div>`);
      const dmg = safe(() => sys.Damage);
      if (dmg !== null && dmg !== undefined && dmg !== "")
        lines.push(`<div class="pd-tt-stat">${esc(L("WFRPPD.Tooltip.Damage"))}: <b>+${esc(dmg)}</b></div>`);
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

    const desc = parseDescription(sys.description?.value);
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
    const price = this.formatPrice(sys.price);
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

function itemMeta(item) {
  const sys = item.system;
  const cfg = game.wfrp4e.config;
  const L = (k) => game.i18n.localize(k);
  if (item.type === "weapon") {
    const parts = [];
    const dmg = safe(() => sys.Damage);
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
    const { current, available } = app._swapCandidates(slot);

    // Сортировка по силе, BIS - лучший предмет среди всего подходящего
    const profile = app._profile();
    const val = new Map([...current, ...available].map((i) => [i.id, app._slotValue(i, slot, profile)]));
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
      return `<span class="pd-fly-delta ${d > 0 ? "is-up" : "is-down"}">${d > 0 ? "+" : "-"}${Math.abs(d)} ${esc(unit)}</span>`;
    };

    const row = (item, act) => {
      const sys = item.system;
      const rarity = RARITY[sys.availability?.value] ?? "none";
      const qty = (sys.quantity?.value ?? 1) > 1 ? `<span class="pd-qty">${sys.quantity.value}</span>` : "";
      let meta = itemMeta(item);
      const where = act === "equip" ? app._currentSlotOf(item) : null;
      if (where) meta += ` · ${game.i18n.format("WFRPPD.Fly.Now", { slot: app._slotLabel(where) })}`;
      const icon = act === "unequip" ? `<i class="fa-solid fa-xmark pd-fly-act" title="${esc(L("WFRPPD.Fly.Unequip"))}"></i>` : "";
      // BIS только если он один: при равенстве подсвечивать нечего
      const v = val.get(item.id);
      const bis = !v.forbidden && bisCount === 1 && v.score === bestScore && all.length > 1;
      const chips = [
        ...v.restr.forbid.map((r) => `<span class="pd-chip is-forbid" title="${esc(r.hint ?? L("WFRPPD.Restr.ForbiddenHint"))}">${esc(r.label)}</span>`),
        ...v.restr.warn.map((r) => `<span class="pd-chip ${r.info ? "is-info" : "is-warn"}" ${r.hint ? `title="${esc(r.hint)}"` : ""}>${esc(humanizeTerms(r.label))}</span>`)
      ].join("");
      const bisBadge = bis ? `<span class="pd-fly-bis" title="${esc(L("WFRPPD.Fly.BisHint"))}">BIS</span>` : "";
      const delta = act === "equip" ? deltaChip(item) : "";
      return `
        <div class="pd-fly-row ${bis ? "is-bis" : ""} ${v.forbidden ? "is-forbidden" : ""}" data-item-id="${item.id}" data-act="${act}">
          <div class="pd-fly-icon rarity-${rarity}"><img src="${esc(item.img)}" alt="">${qty}</div>
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
    if (current.length) {
      html += `<div class="pd-fly-section">${esc(L("WFRPPD.Fly.Current"))}</div>`;
      html += current.map((i) => row(i, "unequip")).join("");
    }
    html += `<div class="pd-fly-section">${esc(L("WFRPPD.Fly.Available"))}</div>`;
    html += available.length
      ? available.map((i) => row(i, "equip")).join("")
      : `<div class="pd-fly-empty">${esc(L("WFRPPD.Fly.Empty"))}</div>`;
    // Явная кнопка «оставить слот пустым» - удобно снять всё одним кликом
    if (current.length) {
      html += `
        <div class="pd-fly-row pd-fly-clear" data-act="clear">
          <div class="pd-fly-icon"><i class="fa-solid fa-ban"></i></div>
          <div class="pd-fly-text">
            <div class="pd-fly-name">${esc(L("WFRPPD.Fly.Clear"))}</div>
            <div class="pd-fly-meta">${esc(game.i18n.format("WFRPPD.Fly.ClearHint", { n: current.length }))}</div>
          </div>
        </div>`;
    }

    const el = document.createElement("div");
    el.className = "wfrp-paperdoll-flyout";
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
      rowEl.addEventListener("pointerenter", (ev) => PaperdollTooltip.show(item, ev));
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
      if (el.contains(ev.target) || ev.target.closest?.(".pd-swap")) return;
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
