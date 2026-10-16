/* ==========================================================
   Данные для мока: персонаж, предметы и строки системы.
   Иконки пока эмодзи-заглушки, в Foundry будут настоящие.
   ========================================================== */

const icon = (glyph, color) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0d0b09"/></radialGradient></defs><rect width="64" height="64" fill="url(#g)"/><text x="32" y="44" font-size="34" text-anchor="middle">${glyph}</text></svg>`
  );

const portrait =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><defs><radialGradient id="b" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#5a3a22"/><stop offset="1" stop-color="#120d09"/></radialGradient></defs><rect width="300" height="400" fill="url(#b)"/><g fill="#0a0806" opacity=".92"><circle cx="150" cy="120" r="48"/><path d="M60 400 C60 250 100 190 150 190 C200 190 240 250 240 400Z"/></g><path d="M150 200 L150 330 M115 240 L185 240" stroke="#8a2a1f" stroke-width="10" stroke-linecap="round"/></svg>`
  );

const base = (o) => ({
  quantity: { value: 1 },
  encumbrance: { value: 0 },
  price: { gc: 0, ss: 0, bp: 0 },
  availability: { value: "common" },
  description: { value: "" },
  ...o
});
const weapon = (o) =>
  base({ equipped: { value: false }, twohanded: { value: false }, offhand: { value: false }, weaponGroup: { value: "basic" }, reach: { value: "average" }, ...o });
const armour = (AP, o) =>
  base({ equipped: { value: false }, armorType: { value: "softLeather" }, penalty: { value: "" }, AP: { head: 0, body: 0, rArm: 0, lArm: 0, rLeg: 0, lLeg: 0, ...AP }, ...o });
const trapping = (o) => base({ equipped: { value: false }, trappingType: { value: "misc" }, ...o });

const ch = (initial, advances = 0, modifier = 0) => ({ initial, advances, modifier });

export const actorData = {
  id: "hugo",
  name: "Хьюго Брандлин",
  img: portrait,
  career: { name: "Флагеллант", level: 1, class: "Странники" },
  skills: ["Melee (Basic)", "Melee (Flail)", "Ranged (Sling)", "Language (Magick)"],
  talents: [{ name: "Arcane Magic (Fire)" }],
  system: {
    characteristics: {
      ws: ch(33, 5), bs: ch(27), s: ch(36, 5), t: ch(39, 5), i: ch(31, 2),
      ag: ch(36), dex: ch(29), int: ch(31), wp: ch(42, 5, 5), fel: ch(24)
    },
    status: {
      wounds: { value: 11, max: 14 },
      criticalWounds: { value: 1, max: 4 },
      advantage: { value: 0 },
      fate: { value: 3 }, fortune: { value: 2 },
      resilience: { value: 2 }, resolve: { value: 1 },
      corruption: { value: 2, max: 7 }, sin: { value: 1 },
      encumbrance: { current: 0, max: 0 }
    },
    details: {
      species: { value: "human" },
      status: { value: "Медь 2" },
      move: { value: 4, walk: "8", run: "16" },
      experience: { total: 420, spent: 350, current: 70 }
    },
    settings: { equipPoints: 2 }
  },
  items: [
    { id: "flail", name: "Цеп", type: "weapon", img: icon("⛓️", "#6a5a4a"),
      system: weapon({ equipped: { value: true }, twohanded: { value: true }, weaponGroup: { value: "flail" }, damage: { value: "SB+5" },
        _qualities: ["Отвлекающее", "Обвивающее"], _flaws: ["Опасное"], availability: { value: "scarce" }, encumbrance: { value: 1 }, price: { gc: 2 },
        description: { value: "<p>Тяжёлые цепи с шипами, которыми флагеллант бичует себя и врагов Зигмара.</p>" } }) },
    { id: "sword", name: "Меч охотника на ведьм", type: "weapon", img: icon("⚔️", "#8a8a9a"),
      system: weapon({ damage: { value: "SB+4" }, _qualities: ["Пробивающее"], availability: { value: "rare" }, encumbrance: { value: 1 }, price: { gc: 1 },
        description: { value: "<p>Подарок храмовника, который не дожил до утра.</p>" } }) },
    { id: "dagger", name: "Кинжал", type: "weapon", img: icon("🗡️", "#5a6a7a"),
      system: weapon({ damage: { value: "SB+2" }, reach: { value: "vshort" }, price: { ss: 16 } }) },
    { id: "whip", name: "Плеть", type: "weapon", img: icon("〰️", "#5a3020"),
      system: weapon({ weaponGroup: { value: "flail" }, reach: { value: "long" }, damage: { value: "SB+2" }, _qualities: ["Быстрое", "Обвивающее"], _flaws: ["Слабое"], price: { ss: 5 } }) },
    { id: "buckler", name: "Баклер", type: "weapon", img: icon("🔰", "#7a6a3a"),
      system: weapon({ weaponGroup: { value: "parry" }, reach: { value: "personal" }, damage: { value: "SB+1" }, _qualities: ["Щит 1", "Защитное"], price: { ss: 18 } }) },
    { id: "sling", name: "Праща", type: "weapon", img: icon("🪨", "#6a6a5a"),
      system: weapon({ weaponGroup: { value: "sling" }, damage: { value: "+6" }, _ranged: true, _range: "60", price: { ss: 1 } }) },
    { id: "hood", name: "Кожаный капюшон", type: "armour", img: icon("🪖", "#5a4030"),
      system: armour({ head: 1 }, { equipped: { value: true }, _flaws: ["Частичное"], price: { ss: 5 } }) },
    { id: "jack", name: "Кожаная куртка", type: "armour", img: icon("🧥", "#7a5230"),
      system: armour({ body: 1, rArm: 1, lArm: 1 }, { equipped: { value: true }, encumbrance: { value: 1 }, price: { ss: 12 },
        description: { value: "<p>Потёртая кожаная куртка, пропитанная кровью и воском.</p>" } }) },
    { id: "mail", name: "Кольчужная рубаха", type: "armour", img: icon("🛡️", "#7a7a8a"),
      system: armour({ body: 2 }, { armorType: { value: "mail" }, _qualities: ["Гибкая"], availability: { value: "scarce" }, encumbrance: { value: 2 }, price: { gc: 3 },
        description: { value: "<p>Снята с мёртвого рыцаря у дороги на Убершрейк.</p>" } }) },
    { id: "legs", name: "Кожаные штаны", type: "armour", img: icon("👖", "#6a4a2a"),
      system: armour({ rLeg: 1, lLeg: 1 }, { encumbrance: { value: 1 }, price: { ss: 14 } }) },
    { id: "robe", name: "Рваная ряса", type: "trapping", img: icon("👘", "#4a3a5a"),
      system: trapping({ equipped: { value: true }, trappingType: { value: "clothingAccessories" }, encumbrance: { value: 1 }, price: { ss: 2 },
        description: { value: "<p>Ряса, порванная плетьми. На спине вышит молот Зигмара.</p>" } }) },
    { id: "hammer", name: "Подвеска-молот", type: "trapping", img: icon("🔨", "#c9a45c"),
      system: trapping({ trappingType: { value: "clothingAccessories" }, availability: { value: "exotic" }, price: { gc: 4 },
        description: { value: "<p>Серебряный молот Зигмара на чёрном шнуре. Тёплый на ощупь.</p>" } }) },
    { id: "sack", name: "Котомка", type: "container", img: icon("🎒", "#6a5530"),
      system: base({ equipped: { value: true }, encumbrance: { value: 1 }, price: { ss: 4 }, carries: { value: 2 } }) },
    { id: "relic", name: "Палец святого", type: "trapping", img: icon("☝️", "#c9a45c"),
      system: trapping({ availability: { value: "exotic" }, price: { gc: 10 },
        description: { value: "<p>Высохший палец в серебряном ковчежце. Говорят, принадлежал мученику из Нульна.</p>" } }) },
    { id: "tome", name: "Молитвенник Зигмара", type: "trapping", img: icon("📖", "#8a3a2a"),
      system: trapping({ availability: { value: "rare" }, trappingType: { value: "booksAndDocuments" }, price: { gc: 1 } }) },
    { id: "candle", name: "Свечи", type: "trapping", img: icon("🕯️", "#a08050"), system: trapping({ location: { value: "sack" }, quantity: { value: 6 }, price: { bp: 1 } }) },
    { id: "bandage", name: "Бинты", type: "trapping", img: icon("🩹", "#a09080"), system: trapping({ location: { value: "sack" }, quantity: { value: 4 }, price: { bp: 2 } }) },
    { id: "water", name: "Фляга с водой", type: "trapping", img: icon("🫗", "#4a6a7a"), system: trapping({ availability: { value: "None" }, price: { bp: 3 } }) }
  ]
};

/** Конфиг системы, который читает модуль (game.wfrp4e.config) */
export const config = {
  locations: { head: "WFRP4E.Locations.head", body: "WFRP4E.Locations.body", rArm: "WFRP4E.Locations.rArm", lArm: "WFRP4E.Locations.lArm", rLeg: "WFRP4E.Locations.rLeg", lLeg: "WFRP4E.Locations.lLeg" },
  characteristics: { ws: "CHAR.WS", bs: "CHAR.BS", s: "CHAR.S", t: "CHAR.T", i: "CHAR.I", ag: "CHAR.Ag", dex: "CHAR.Dex", int: "CHAR.Int", wp: "CHAR.WP", fel: "CHAR.Fel" },
  characteristicsAbbrev: { ws: "CHARAbbrev.WS", bs: "CHARAbbrev.BS", s: "CHARAbbrev.S", t: "CHARAbbrev.T", i: "CHARAbbrev.I", ag: "CHARAbbrev.Ag", dex: "CHARAbbrev.Dex", int: "CHARAbbrev.Int", wp: "CHARAbbrev.WP", fel: "CHARAbbrev.Fel" },
  availability: { None: "-", common: "WFRP4E.Availability.Common", scarce: "WFRP4E.Availability.Scarce", rare: "WFRP4E.Availability.Rare", exotic: "WFRP4E.Availability.Exotic", special: "WFRP4E.Availability.Special" },
  armorTypes: { softLeather: "WFRP4E.ArmourType.SLeather", mail: "WFRP4E.ArmourType.Mail" },
  species: { human: "Человек" },
  conditions: {
    ablaze: "Горит", bleeding: "Кровотечение", blinded: "Ослеплён", broken: "Сломлен", deafened: "Оглушён (слух)",
    entangled: "Опутан", fatigued: "Усталость", poisoned: "Отравлен", prone: "Сбит с ног", stunned: "Ошеломлён",
    surprised: "Застигнут врасплох", unconscious: "Без сознания", grappling: "В клинче", engaged: "В бою"
  }
};

/** Строки системы WFRP4e (в Foundry их даёт локализация системы) */
export const systemStrings = {
  "WFRP4E.Locations.head": "Голова",
  "WFRP4E.Locations.body": "Тело",
  "WFRP4E.Locations.rArm": "Правая рука",
  "WFRP4E.Locations.lArm": "Левая рука",
  "WFRP4E.Locations.rLeg": "Правая нога",
  "WFRP4E.Locations.lLeg": "Левая нога",
  "CHAR.WS": "Ближний бой", "CHAR.BS": "Дальний бой", "CHAR.S": "Сила", "CHAR.T": "Выносливость", "CHAR.I": "Инициатива",
  "CHAR.Ag": "Проворство", "CHAR.Dex": "Ловкость", "CHAR.Int": "Интеллект", "CHAR.WP": "Сила воли", "CHAR.Fel": "Харизма",
  "CHARAbbrev.WS": "ББ", "CHARAbbrev.BS": "ДБ", "CHARAbbrev.S": "С", "CHARAbbrev.T": "В", "CHARAbbrev.I": "И",
  "CHARAbbrev.Ag": "Пр", "CHARAbbrev.Dex": "Л", "CHARAbbrev.Int": "Инт", "CHARAbbrev.WP": "СВ", "CHARAbbrev.Fel": "Х",
  "WFRP4E.Availability.Common": "Обычное", "WFRP4E.Availability.Scarce": "Дефицит", "WFRP4E.Availability.Rare": "Редкое",
  "WFRP4E.Availability.Exotic": "Экзотика", "WFRP4E.Availability.Special": "Особое",
  "WFRP4E.ArmourType.SLeather": "Мягкая кожа", "WFRP4E.ArmourType.Mail": "Кольчуга",
  "WFRP4E.GroupType.basic": "Обычное", "WFRP4E.GroupType.twohanded": "Двуручное", "WFRP4E.GroupType.polearm": "Древковое", "WFRP4E.GroupType.crossbow": "Арбалеты", "WFRP4E.GroupType.fencing": "Фехтовальное", "WFRP4E.GroupType.flail": "Цепы", "WFRP4E.GroupType.parry": "Парирующее", "WFRP4E.GroupType.sling": "Пращи",
  "WFRP4E.Reach.average": "Средняя", "WFRP4E.Reach.vshort": "Очень короткая", "WFRP4E.Reach.long": "Длинная", "WFRP4E.Reach.personal": "Личная",
  "TYPES.Item.weapon": "Оружие", "TYPES.Item.armour": "Броня", "TYPES.Item.trapping": "Снаряжение", "TYPES.Item.container": "Контейнер"
};

/**
 * Тестовые профили для флага --profile: подменяют навыки, таланты и бога,
 * чтобы проверить ограничения в списке быстрой смены.
 */
export const PROFILES = {
  // Маг Огня: штраф брони к касту, стрелкового навыка нет
  mage: {
    skills: ["Melee (Basic)", "Language (Magick)", "Channelling (Aqshy)"],
    talents: [{ name: "Arcane Magic (Fire)" }],
    god: ""
  },
  // Маг Металла: металл можно, кожа мешает
  metal: {
    skills: ["Melee (Basic)", "Language (Magick)"],
    talents: [{ name: "Arcane Magic (Metal)" }],
    god: ""
  },
  // Жрец Ульрика: обеты против пороха, шлемов и арбалетов
  ulric: {
    skills: ["Melee (Basic)", "Melee (Two-Handed)", "Melee (Polearm)", "Ranged (Blackpowder)", "Pray"],
    talents: [{ name: "Bless (Ulric)" }, { name: "Invoke (Ulric)" }],
    god: "Ulric"
  },
  // Боец с двумя руками: амбидекстр, парирование
  duelist: {
    skills: ["Melee (Basic)", "Melee (Fencing)", "Melee (Parry)", "Ranged (Blackpowder)"],
    talents: [
      { name: "Ambidextrous", advances: 1 }, { name: "Strike Mighty Blow", advances: 2 }, { name: "Dual Wielder" },
      { name: "Accurate Shot", advances: 1 }, { name: "Sure Shot", advances: 1 }, { name: "Frenzy" }
    ],
    god: ""
  }
};

/** Тестовые эффекты для флага --effects: состояния, эффект местности, травма, крит, болезнь */
export const TEST_EFFECTS = {
  effects: [
    { id: "eff-bleed", name: "Кровотечение", statuses: ["bleeding"], value: 2, _icon: "sys:conditions/bleeding.png",
      description: "<p>Теряешь 1 пункт здоровья в конце каждого раунда за каждый уровень. При 0 здоровья - проверка на смерть.</p>" },
    { id: "eff-fatigue", name: "Усталость", statuses: ["fatigued"], value: 1, _icon: "sys:conditions/fatigued.png",
      description: "<p>-10 ко всем проверкам за каждый уровень.</p>" },
    { id: "eff-swamp", name: "Проклятая топь", _icon: "core:magic/unholy/silhouette-robe-evil-glow.webp",
      description: "<p>Пока персонаж в топях Драквальда: -10 к Хладнокровию и Стойкости. Выключить, когда персонаж покинет территорию.</p>" }
  ],
  items: [
    { id: "inj-arm", name: "Лёгкий перелом руки", type: "injury", _icon: "icons:injuries/broken-arm.png",
      system: { location: { value: "lArm", key: "lArm" }, penalty: { value: "-20 к проверкам этой рукой" }, duration: { value: "5", active: true, permanent: false } } },
    { id: "crit-cut", name: "Глубокий порез", type: "critical", _icon: "icons:injuries/tornbody.png",
      system: { location: { value: "body", key: "body" }, wounds: { value: "2" }, modifier: { value: "+1 Кровотечение" } } },
    { id: "dis-fever", name: "Гнилая лихорадка", type: "disease", _icon: "icons:diseases/disease.png",
      system: { incubation: { value: "1", unit: "день", active: true }, duration: { value: "5", unit: "дней", active: false },
        symptoms: { value: "Лихорадка, Слабость" } } }
  ]
};

/**
 * Чистый персонаж для мока (флаг --blank): скромное снаряжение без перевеса и пара сумок.
 * Иконки: _icon - ссылка на иконку (свою из assets/icons или из папок --icons), img - эмодзи на случай сборки без них.
 */
const own = (rel) => `icons:equipment/${rel}`;
export const blankActor = {
  id: "blank",
  name: "Новый персонаж",
  img: portrait,
  career: null,
  skills: ["Melee (Basic)"],
  talents: [],
  system: {
    characteristics: {
      ws: ch(35), bs: ch(30), s: ch(33), t: ch(34), i: ch(32),
      ag: ch(31), dex: ch(30), int: ch(29), wp: ch(31), fel: ch(30)
    },
    status: {
      wounds: { value: 12, max: 12 },
      criticalWounds: { value: 0, max: 3 },
      advantage: { value: 0 },
      fate: { value: 2 }, fortune: { value: 2 },
      resilience: { value: 1 }, resolve: { value: 1 },
      corruption: { value: 0, max: 6 }, sin: { value: 0 },
      encumbrance: { current: 0, max: 0 }
    },
    details: {
      species: { value: "human" },
      status: { value: "Медь 3" },
      move: { value: 4, walk: "8", run: "16" },
      experience: { total: 0, spent: 0, current: 0 }
    },
    settings: { equipPoints: 2 }
  },
  items: [
    // Надето
    { id: "b-axe", name: "Топор", type: "weapon", _icon: own("weapons/axe.png"), img: icon("🪓", "#5a6a7a"),
      system: weapon({ equipped: { value: true }, damage: { value: "SB+4" }, encumbrance: { value: 1 }, price: { gc: 1 } }) },
    { id: "b-dagger", name: "Кинжал", type: "weapon", _icon: own("weapons/dagger.png"), img: icon("🗡️", "#5a6a7a"),
      system: weapon({ equipped: { value: true }, offhand: { value: true }, damage: { value: "SB+2" }, reach: { value: "vshort" }, price: { ss: 16 } }) },
    { id: "b-cap", name: "Кожаная шапка", type: "armour", _icon: own("armour/leather-skullcap.png"), img: icon("🪖", "#5a4030"),
      system: armour({ head: 1 }, { equipped: { value: true }, _flaws: ["Частичное"], price: { ss: 8 } }) },
    { id: "b-jerkin", name: "Кожаный жилет", type: "armour", _icon: own("armour/leather-jerkin.png"), img: icon("🦺", "#7a5230"),
      system: armour({ body: 1 }, { equipped: { value: true }, encumbrance: { value: 1 }, price: { gc: 1 } }) },
    { id: "b-legs", name: "Кожаные поножи", type: "armour", _icon: own("armour/leather-leggings.png"), img: icon("👖", "#6a4a2a"),
      system: armour({ rLeg: 1, lLeg: 1 }, { equipped: { value: true }, encumbrance: { value: 1 }, price: { gc: 1 } }) },
    { id: "b-clothes", name: "Одежда", type: "trapping", _icon: own("clothing_and_accessories/clothing.png"), img: icon("👕", "#5a5040"),
      system: trapping({ equipped: { value: true }, trappingType: { value: "clothingAccessories" }, encumbrance: { value: 1 }, price: { ss: 12 } }) },
    { id: "b-cloak", name: "Плащ", type: "trapping", _icon: own("clothing_and_accessories/cloak.png"), img: icon("🧥", "#4a3a2a"),
      system: trapping({ equipped: { value: true }, trappingType: { value: "clothingAccessories" }, encumbrance: { value: 1 }, price: { ss: 10 } }) },
    { id: "b-boots", name: "Сапоги", type: "trapping", _icon: own("clothing_and_accessories/boots.png"), img: icon("🥾", "#5a4030"),
      system: trapping({ equipped: { value: true }, trappingType: { value: "clothingAccessories" }, price: { ss: 15 } }) },
    // Сумки
    { id: "b-backpack", name: "Рюкзак", type: "container", _icon: own("packs_and_containers/backpack.png"), img: icon("🎒", "#6a5530"),
      flags: { "wfrp4e-paperdoll": { bagSlot: "bag1" } },
      system: base({ equipped: { value: true }, encumbrance: { value: 1 }, price: { ss: 4 }, carries: { value: 4 } }) },
    { id: "b-sling", name: "Наплечная сумка", type: "container", _icon: own("packs_and_containers/sling-bag.png"), img: icon("👜", "#6a5530"),
      flags: { "wfrp4e-paperdoll": { bagSlot: "bag2" } },
      system: base({ equipped: { value: true }, encumbrance: { value: 0 }, price: { ss: 1 }, carries: { value: 2 } }) },
    // В рюкзаке
    { id: "b-blanket", name: "Одеяло", type: "trapping", _icon: own("miscellaneous_trappings/blanket.png"), img: icon("🛏️", "#6a5a4a"),
      system: trapping({ location: { value: "b-backpack" }, encumbrance: { value: 1 }, price: { ss: 8 } }) },
    { id: "b-rope", name: "Верёвка, 10 ярдов", type: "trapping", _icon: own("miscellaneous_trappings/rope-10-yards.png"), img: icon("🪢", "#7a6a4a"),
      system: trapping({ location: { value: "b-backpack" }, encumbrance: { value: 1 }, price: { ss: 4 } }) },
    { id: "b-rations", name: "Паёк на день", type: "trapping", _icon: own("food_drink_and_lodging/rations-1-day.png"), img: icon("🍞", "#7a6a3a"),
      system: trapping({ location: { value: "b-backpack" }, quantity: { value: 3 }, price: { ss: 1 } }) },
    // В наплечной сумке
    { id: "b-tinder", name: "Огниво", type: "trapping", _icon: own("miscellaneous_trappings/tinderbox.png"), img: icon("🔥", "#7a4a2a"),
      system: trapping({ location: { value: "b-sling" }, price: { ss: 1 } }) },
    { id: "b-bandage", name: "Бинты", type: "trapping", _icon: own("miscellaneous_trappings/bandage.png"), img: icon("🩹", "#a09080"),
      system: trapping({ location: { value: "b-sling" }, quantity: { value: 3 }, price: { bp: 2 } }) },
    // При себе
    { id: "b-water", name: "Бурдюк", type: "trapping", _icon: own("packs_and_containers/waterskin.png"), img: icon("🫗", "#4a6a7a"),
      system: trapping({ price: { bp: 8 } }) },
    { id: "b-lantern", name: "Фонарь", type: "trapping", _icon: own("miscellaneous_trappings/lantern.png"), img: icon("🏮", "#8a6a2a"),
      system: trapping({ encumbrance: { value: 1 }, price: { ss: 5 } }) }
  ]
};

/** Тестовые персонажи для переключателя в моке (флаг --cast) */
const stats = (wounds, s, t) => ({
  wounds: { value: wounds, max: wounds }, criticalWounds: { value: 0, max: 4 }, advantage: { value: 0 },
  fate: { value: 1 }, fortune: { value: 1 }, resilience: { value: 2 }, resolve: { value: 2 },
  corruption: { value: 0, max: 7 }, sin: { value: 0 }, encumbrance: { current: 0, max: 0 }
});
const details = (status) => ({ species: { value: "human" }, status: { value: status }, move: { value: 4, walk: "8", run: "16" }, experience: { total: 300, spent: 250, current: 50 } });
const inBag = (id) => ({ location: { value: id } });

export const CAST = [
  {
    id: "merc",
    name: "Наёмник Ульрих",
    img: portrait,
    career: { name: "Наёмник", level: 2, class: "Воины" },
    skills: ["Melee (Basic)", "Melee (Polearm)", "Ranged (Crossbow)"],
    talents: [{ name: "Strike Mighty Blow" }],
    system: {
      characteristics: { ws: ch(42, 5), bs: ch(35), s: ch(38, 5), t: ch(40), i: ch(33), ag: ch(30), dex: ch(28), int: ch(27), wp: ch(34), fel: ch(26) },
      status: stats(15), details: details("Серебро 1"), settings: { equipPoints: 2 }
    },
    items: [
      { id: "m-halberd", name: "Алебарда", type: "weapon", _icon: own("weapons/halberd.png"), img: icon("🪓", "#5a6a7a"),
        system: weapon({ equipped: { value: true }, twohanded: { value: true }, weaponGroup: { value: "polearm" }, reach: { value: "long" }, damage: { value: "SB+4" }, encumbrance: { value: 3 }, _qualities: ["Защитное", "Пробивающее", "Рубящее"], price: { gc: 2 } }) },
      { id: "m-xbow", name: "Арбалет", type: "weapon", _icon: own("weapons/crossbow.png"), img: icon("🏹", "#5a6a7a"),
        system: weapon({ weaponGroup: { value: "crossbow" }, damage: { value: "+9" }, _ranged: true, _range: "60", encumbrance: { value: 2 }, availability: { value: "scarce" }, price: { gc: 5 } }) },
      { id: "m-helm", name: "Открытый шлем", type: "armour", _icon: own("armour/plate-open-helm.png"), img: icon("⛑️", "#7a7a8a"),
        system: armour({ head: 2 }, { equipped: { value: true }, armorType: { value: "plate" }, encumbrance: { value: 1 }, price: { gc: 2 } }) },
      { id: "m-mail", name: "Кольчуга", type: "armour", _icon: own("armour/mail-coat.png"), img: icon("🛡️", "#7a7a8a"),
        system: armour({ body: 2, rArm: 2, lArm: 2, rLeg: 2, lLeg: 2 }, { equipped: { value: true }, armorType: { value: "mail" }, encumbrance: { value: 3 }, availability: { value: "scarce" }, price: { gc: 3 } }) },
      { id: "m-breast", name: "Латный нагрудник", type: "armour", _icon: own("armour/plate-breastplate.png"), img: icon("🛡️", "#8a8a9a"),
        system: armour({ body: 2 }, { equipped: { value: true }, armorType: { value: "plate" }, encumbrance: { value: 3 }, availability: { value: "rare" }, price: { gc: 10 } }) },
      { id: "m-clothes", name: "Одежда", type: "trapping", _icon: own("clothing_and_accessories/clothing.png"), img: icon("👕", "#5a5040"),
        system: trapping({ equipped: { value: true }, trappingType: { value: "clothingAccessories" }, encumbrance: { value: 1 } }) },
      { id: "m-sack", name: "Большой мешок", type: "container", _icon: own("packs_and_containers/sack-large.png"), img: icon("🎒", "#6a5530"),
        flags: { "wfrp4e-paperdoll": { bagSlot: "bag1" } }, system: base({ equipped: { value: true }, encumbrance: { value: 1 }, carries: { value: 6 } }) },
      { id: "m-bolts", name: "Арбалетные болты", type: "ammunition", _icon: own("ammunition/bolt.png"), img: icon("➶", "#5a5a4a"),
        system: base({ ...inBag("m-sack"), quantity: { value: 12 }, encumbrance: { value: 0 } }) },
      { id: "m-tent", name: "Палатка", type: "trapping", _icon: own("miscellaneous_trappings/tent.png"), img: icon("⛺", "#6a5a3a"),
        system: trapping({ ...inBag("m-sack"), encumbrance: { value: 2 } }) },
      { id: "m-pot", name: "Котелок", type: "trapping", _icon: own("miscellaneous_trappings/cooking-pot.png"), img: icon("🍲", "#5a5a5a"),
        system: trapping({ ...inBag("m-sack"), encumbrance: { value: 1 } }) },
      { id: "m-ale", name: "Бочонок эля", type: "trapping", _icon: own("food_drink_and_lodging/ale-keg.png"), img: icon("🍺", "#7a5a2a"),
        system: trapping({ encumbrance: { value: 2 } }) }
    ]
  },
  {
    id: "mage",
    name: "Ученица Магистра Лиза",
    img: portrait,
    career: { name: "Маг", level: 1, class: "Учёные" },
    skills: ["Language (Magick)", "Channelling (Aqshy)", "Melee (Basic)"],
    talents: [{ name: "Arcane Magic (Fire)" }, { name: "Petty Magic" }],
    system: {
      characteristics: { ws: ch(26), bs: ch(28), s: ch(25), t: ch(30), i: ch(38), ag: ch(33), dex: ch(35), int: ch(45, 5), wp: ch(44, 5), fel: ch(36) },
      status: stats(10), details: details("Серебро 2"), settings: { equipPoints: 2 }
    },
    items: [
      { id: "g-staff", name: "Посох", type: "weapon", _icon: own("weapons/quarter-staff.png"), img: icon("🦯", "#6a4a2a"),
        system: weapon({ equipped: { value: true }, twohanded: { value: true }, weaponGroup: { value: "polearm" }, reach: { value: "long" }, damage: { value: "SB+4" }, encumbrance: { value: 2 }, _qualities: ["Защитное", "Дробящее"] }) },
      { id: "g-robes", name: "Мантия Светлого колледжа", type: "trapping", _icon: own("clothing_and_accessories/robes.png"), img: icon("👘", "#8a3a2a"),
        system: trapping({ equipped: { value: true }, trappingType: { value: "clothingAccessories" }, encumbrance: { value: 1 }, availability: { value: "rare" }, price: { gc: 3 } }) },
      { id: "g-hat", name: "Шляпа", type: "trapping", _icon: own("clothing_and_accessories/hat.png"), img: icon("🎩", "#4a3a5a"),
        system: trapping({ equipped: { value: true }, trappingType: { value: "clothingAccessories" } }) },
      { id: "g-amulet", name: "Амулет огненного камня", type: "trapping", _icon: own("clothing_and_accessories/amulet.png"), img: icon("📿", "#c94a2a"),
        system: trapping({ equipped: { value: true }, trappingType: { value: "clothingAccessories" }, availability: { value: "exotic" }, price: { gc: 25 },
          description: { value: "<p>Тёплый на ощупь камень в серебряной оправе. Говорят, в нём спит искра Акши.</p>" } }) },
      { id: "g-jack", name: "Кожаная куртка", type: "armour", _icon: own("armour/leather-jack.png"), img: icon("🧥", "#7a5230"),
        system: armour({ body: 1, rArm: 1, lArm: 1 }, { encumbrance: { value: 1 }, price: { ss: 12 } }) },
      { id: "g-sling", name: "Наплечная сумка", type: "container", _icon: own("packs_and_containers/sling-bag.png"), img: icon("👜", "#6a5530"),
        flags: { "wfrp4e-paperdoll": { bagSlot: "bag1" } }, system: base({ equipped: { value: true }, carries: { value: 2 } }) },
      { id: "g-case", name: "Тубус для свитков", type: "container", _icon: own("packs_and_containers/scroll-case.png"), img: icon("📜", "#6a5530"),
        flags: { "wfrp4e-paperdoll": { bagSlot: "bag2" } }, system: base({ equipped: { value: true }, carries: { value: 1 } }) },
      { id: "g-pouch", name: "Кошель с ингредиентами", type: "container", _icon: own("packs_and_containers/pouch.png"), img: icon("👝", "#6a5530"),
        flags: { "wfrp4e-paperdoll": { bagSlot: "bag3" } }, system: base({ equipped: { value: true }, carries: { value: 1 } }) },
      { id: "g-grimoire", name: "Гримуар", type: "trapping", _icon: own("book_documents/book-magic.png"), img: icon("📕", "#8a3a2a"),
        system: trapping({ ...inBag("g-sling"), encumbrance: { value: 1 }, availability: { value: "rare" }, trappingType: { value: "booksAndDocuments" } }) },
      { id: "g-writing", name: "Письменный набор", type: "trapping", _icon: own("tools_and_kits/writing-kit.png"), img: icon("✒️", "#3a3a5a"),
        system: trapping({ ...inBag("g-sling") }) },
      { id: "g-scroll", name: "Свиток с заклинанием", type: "trapping", _icon: own("book_documents/parchmentsheet.png"), img: icon("📜", "#a08050"),
        system: trapping({ ...inBag("g-case"), availability: { value: "scarce" } }) },
      { id: "g-salwort", name: "Солянка", type: "trapping", _icon: own("herbs_and_draughts/salwort.png"), img: icon("🌿", "#3a6a2a"),
        system: trapping({ ...inBag("g-pouch"), quantity: { value: 5 } }) },
      { id: "g-healing", name: "Целебное зелье", type: "trapping", _icon: own("herbs_and_draughts/healing-draught.png"), img: icon("🧪", "#8a2a2a"),
        system: trapping({ quantity: { value: 2 }, availability: { value: "scarce" } }) },
      { id: "g-lens", name: "Лупа", type: "trapping", _icon: own("tools_and_kits/reading-lens.png"), img: icon("🔍", "#5a5a5a"), system: trapping({}) }
    ]
  },
  {
    id: "vet",
    name: "Ветеран Гюнтер",
    img: portrait,
    career: { name: "Солдат", level: 3, class: "Воины" },
    skills: ["Melee (Basic)", "Melee (Parry)"],
    talents: [],
    system: {
      characteristics: { ws: ch(44, 5), bs: ch(30), s: ch(36), t: ch(41, 5), i: ch(32), ag: ch(29), dex: ch(27), int: ch(28), wp: ch(38), fel: ch(25) },
      status: stats(14), details: details("Серебро 1"), settings: { equipPoints: 2 }
    },
    items: [
      // Травмы: левой кисти нет (на культе крюк), правая нога сломана
      { id: "v-hand", name: "Потеря кисти", type: "injury", _icon: "icons:injuries/amputatedhand.png", img: icon("✋", "#7a2a1a"),
        system: { location: { value: "Левая рука", key: "lArm" }, penalty: { value: "-20 к проверкам, где нужны обе руки" }, duration: { value: "", active: false, permanent: true } } },
      { id: "v-leg", name: "Лёгкий перелом ноги", type: "injury", _icon: "icons:injuries/broken-leg.png", img: icon("🦴", "#7a4a2a"),
        system: { location: { value: "Правая нога", key: "rLeg" }, penalty: { value: "" }, duration: { value: "12", active: true, permanent: false } } },
      { id: "v-hook", name: "Крюк", type: "trapping", _icon: own("prosthetics/basic-hook.png"), img: icon("🪝", "#5a5a5a"),
        flags: { "wfrp4e-paperdoll": { limb: "lArm" } },
        system: trapping({ equipped: { value: true }, encumbrance: { value: 1 }, price: { ss: 3, bp: 4 } }) },
      { id: "v-leg-p", name: "Деревянная нога", type: "trapping", _icon: own("prosthetics/false-leg.png"), img: icon("🦵", "#6a4a2a"),
        system: trapping({ encumbrance: { value: 2 }, availability: { value: "rare" }, price: { ss: 16 } }) },
      { id: "v-marvel", name: "Инженерное чудо", type: "trapping", _icon: own("prosthetics/engineering-marvel.png"), img: icon("⚙️", "#6a6a7a"),
        system: trapping({ encumbrance: { value: 1 }, availability: { value: "exotic" }, price: { gc: 20 } }) },
      { id: "v-sword", name: "Меч", type: "weapon", _icon: own("weapons/sword-hand-weapon.png"), img: icon("⚔️", "#5a6a7a"),
        system: weapon({ equipped: { value: true }, damage: { value: "SB+4" }, encumbrance: { value: 1 } }) },
      { id: "v-shield", name: "Щит", type: "weapon", _icon: own("weapons/shield.png"), img: icon("🛡️", "#6a5a3a"),
        system: weapon({ weaponGroup: { value: "parry" }, reach: { value: "personal" }, damage: { value: "SB+2" }, _qualities: ["Щит 2", "Защитное"], encumbrance: { value: 1 } }) },
      { id: "v-axe", name: "Двуручная секира", type: "weapon", _icon: own("weapons/great-axe.png"), img: icon("🪓", "#5a6a7a"),
        system: weapon({ twohanded: { value: true }, weaponGroup: { value: "twohanded" }, damage: { value: "SB+5" }, encumbrance: { value: 2 } }) },
      { id: "v-jack", name: "Кожаная куртка", type: "armour", _icon: own("armour/leather-jack.png"), img: icon("🧥", "#7a5230"),
        system: armour({ body: 1, rArm: 1, lArm: 1 }, { equipped: { value: true }, encumbrance: { value: 1 } }) }
    ]
  }
];
