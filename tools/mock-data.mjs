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
  career: { name: "Флагеллант", level: 1 },
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
      system: base({ equipped: { value: true }, encumbrance: { value: 1 }, price: { ss: 4 } }) },
    { id: "relic", name: "Палец святого", type: "trapping", img: icon("☝️", "#c9a45c"),
      system: trapping({ availability: { value: "exotic" }, price: { gc: 10 },
        description: { value: "<p>Высохший палец в серебряном ковчежце. Говорят, принадлежал мученику из Нульна.</p>" } }) },
    { id: "tome", name: "Молитвенник Зигмара", type: "trapping", img: icon("📖", "#8a3a2a"),
      system: trapping({ availability: { value: "rare" }, trappingType: { value: "booksAndDocuments" }, price: { gc: 1 } }) },
    { id: "candle", name: "Свечи", type: "trapping", img: icon("🕯️", "#a08050"), system: trapping({ quantity: { value: 6 }, price: { bp: 1 } }) },
    { id: "bandage", name: "Бинты", type: "trapping", img: icon("🩹", "#a09080"), system: trapping({ quantity: { value: 4 }, price: { bp: 2 } }) },
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
  species: { human: "Человек" }
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
  "CHAR.Ag": "Ловкость", "CHAR.Dex": "Проворство", "CHAR.Int": "Интеллект", "CHAR.WP": "Сила воли", "CHAR.Fel": "Харизма",
  "CHARAbbrev.WS": "ББ", "CHARAbbrev.BS": "ДБ", "CHARAbbrev.S": "С", "CHARAbbrev.T": "В", "CHARAbbrev.I": "И",
  "CHARAbbrev.Ag": "Л", "CHARAbbrev.Dex": "Пр", "CHARAbbrev.Int": "Инт", "CHARAbbrev.WP": "СВ", "CHARAbbrev.Fel": "Х",
  "WFRP4E.Availability.Common": "Обычное", "WFRP4E.Availability.Scarce": "Дефицит", "WFRP4E.Availability.Rare": "Редкое",
  "WFRP4E.Availability.Exotic": "Экзотика", "WFRP4E.Availability.Special": "Особое",
  "WFRP4E.ArmourType.SLeather": "Мягкая кожа", "WFRP4E.ArmourType.Mail": "Кольчуга",
  "WFRP4E.GroupType.basic": "Обычное", "WFRP4E.GroupType.flail": "Цепы", "WFRP4E.GroupType.parry": "Парирующее", "WFRP4E.GroupType.sling": "Пращи",
  "WFRP4E.Reach.average": "Средняя", "WFRP4E.Reach.vshort": "Очень короткая", "WFRP4E.Reach.long": "Длинная", "WFRP4E.Reach.personal": "Личная",
  "TYPES.Item.weapon": "Оружие", "TYPES.Item.armour": "Броня", "TYPES.Item.trapping": "Снаряжение", "TYPES.Item.container": "Контейнер"
};
