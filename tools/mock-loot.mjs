/* ==========================================================
   Тестовый лут для мока (флаг --loot).
   Набор покрывает каждый слот и каждую редкость, чтобы проверить
   быструю смену, слои брони, двуручники, щиты и свечение.
   Поле _icon - путь иконки (см. tools/icon-fallbacks.mjs).
   ========================================================== */

const base = (o) => ({
  quantity: { value: 1 },
  encumbrance: { value: 1 },
  price: { gc: 0, ss: 0, bp: 0 },
  availability: { value: "common" },
  description: { value: "" },
  equipped: { value: false },
  ...o
});
const weapon = (o) =>
  base({ twohanded: { value: false }, offhand: { value: false }, weaponGroup: { value: "basic" }, reach: { value: "average" }, damage: { value: "SB+4" }, ...o });
const armour = (AP, o) =>
  base({ armorType: { value: "plate" }, penalty: { value: "" }, AP: { head: 0, body: 0, rArm: 0, lArm: 0, rLeg: 0, lLeg: 0, ...AP }, ...o });
const accessory = (o) => base({ trappingType: { value: "clothingAccessories" }, encumbrance: { value: 0 }, ...o });
const desc = (t) => ({ value: `<p>${t}</p>` });

export const LOOT = [
  // --- Оружие: одноручное ---
  { id: "loot-axe", name: "Топор лесоруба", type: "weapon", _icon: "icons:equipment/weapons/axe.png",
    system: weapon({ price: { ss: 12 }, _qualities: ["Рубящее"] }) },
  { id: "loot-rapier", name: "Эсталийская рапира", type: "weapon", _icon: "icons:equipment/weapons/rapier.png",
    system: weapon({ weaponGroup: { value: "fencing" }, reach: { value: "long" }, availability: { value: "scarce" }, price: { gc: 5 },
      _qualities: ["Быстрое", "Колющее"], _flaws: ["Хрупкое"], description: desc("Тонкий клинок с гардой-корзиной. Таким фехтуют в Нульне на рассвете.") }) },
  { id: "loot-hammer", name: "Боевой молот храмовника", type: "weapon", _icon: "icons:equipment/weapons/warhammer.png",
    system: weapon({ availability: { value: "rare" }, damage: { value: "SB+5" }, price: { gc: 4 },
      _qualities: ["Оглушающее"], description: desc("На бойке выбита комета о двух хвостах.") }) },
  { id: "loot-knife", name: "Нож", type: "weapon", _icon: "icons:equipment/weapons/knife.png",
    system: weapon({ reach: { value: "vshort" }, damage: { value: "SB+1" }, encumbrance: { value: 0 }, price: { ss: 8 }, _flaws: ["Неразящее"] }) },

  // --- Оружие: двуручное ---
  { id: "loot-bastard", name: "Полуторный меч", type: "weapon", _icon: "icons:equipment/weapons/bastard-sword.png",
    system: weapon({ twohanded: { value: true }, weaponGroup: { value: "twohanded" }, reach: { value: "long" }, damage: { value: "SB+5" },
      availability: { value: "rare" }, encumbrance: { value: 2 }, price: { gc: 8 }, _qualities: ["Разящее"] }) },
  { id: "loot-zwei", name: "Цвайхендер «Последний довод»", type: "weapon", _icon: "icons:equipment/weapons/zweihander.png",
    system: weapon({ twohanded: { value: true }, weaponGroup: { value: "twohanded" }, reach: { value: "long" }, damage: { value: "SB+6" },
      availability: { value: "exotic" }, encumbrance: { value: 3 }, price: { gc: 25 }, _qualities: ["Разящее", "Рубящее"], _flaws: ["Медленное"],
      description: desc("Клинок длиной в рост гнома. Говорят, им рубили зверолюдов у Драквальда.") }) },
  { id: "loot-halberd", name: "Алебарда стражи", type: "weapon", _icon: "icons:equipment/weapons/halberd.png",
    system: weapon({ twohanded: { value: true }, weaponGroup: { value: "polearm" }, reach: { value: "vlong" }, availability: { value: "scarce" },
      encumbrance: { value: 3 }, price: { gc: 2 }, _qualities: ["Защитное", "Колющее"] }) },

  // --- Стрелковое ---
  { id: "loot-pistol", name: "Пистоль хохландской работы", type: "weapon", _icon: "icons:equipment/weapons/pistol.png",
    system: weapon({ weaponGroup: { value: "blackpowder" }, damage: { value: "+8" }, _ranged: true, _range: "20", availability: { value: "rare" },
      price: { gc: 8 }, _qualities: ["Пробивающее", "Пистолетное"], _flaws: ["Опасное"] }) },

  // --- Щиты ---
  { id: "loot-shield-gold", name: "Щит с гербом Альтдорфа", type: "weapon", _icon: "core:equipment/shield/heater-steel-gold.webp",
    system: weapon({ weaponGroup: { value: "parry" }, reach: { value: "vshort" }, damage: { value: "SB+2" }, availability: { value: "rare" },
      encumbrance: { value: 2 }, price: { gc: 3 }, _qualities: ["Щит 2", "Защитное"], _flaws: ["Неразящее"] }) },
  { id: "loot-buckler", name: "Деревянный баклер", type: "weapon", _icon: "core:equipment/shield/buckler-wooden-boss.webp",
    system: weapon({ weaponGroup: { value: "parry" }, reach: { value: "personal" }, damage: { value: "SB+1" }, encumbrance: { value: 0 },
      price: { ss: 18 }, _qualities: ["Щит 1", "Защитное"] }) },

  // --- Броня: голова ---
  { id: "loot-greathelm", name: "Топфхельм рыцаря Пантеры", type: "armour", _icon: "core:equipment/head/greathelm-banded-steel.webp",
    system: armour({ head: 2 }, { availability: { value: "rare" }, encumbrance: { value: 2 }, price: { gc: 5 }, penalty: { value: "-10 к Восприятию" },
      _flaws: ["Закрытое"], description: desc("Внутри шлема нацарапано: «Не снимать до победы».") }) },
  { id: "loot-cap", name: "Кожаная шапка", type: "armour", _icon: "core:equipment/head/cap-leather-brown.webp",
    system: armour({ head: 1 }, { armorType: { value: "softLeather" }, encumbrance: { value: 0 }, price: { ss: 8 }, _flaws: ["Частичное"] }) },

  // --- Броня: тело и руки ---
  { id: "loot-breastplate", name: "Стальная кираса", type: "armour", _icon: "core:equipment/chest/breastplate-banded-steel.webp",
    system: armour({ body: 2 }, { availability: { value: "scarce" }, encumbrance: { value: 3 }, price: { gc: 10 }, _flaws: ["Тяжёлое"] }) },
  { id: "loot-gromril", name: "Позолоченный громриловый панцирь", type: "armour", _icon: "core:equipment/chest/breastplate-layered-gold.webp",
    system: armour({ body: 3, rArm: 1, lArm: 1 }, { armorType: { value: "gromril" }, availability: { value: "exotic" }, encumbrance: { value: 2 }, price: { gc: 60 },
      _qualities: ["Прочное 2"], description: desc("Гномья работа. Лёгкий, как кожанка, и прочнее любого человеческого доспеха.") }) },
  { id: "loot-bracers", name: "Латные наручи", type: "armour", _icon: "core:equipment/hand/gauntlet-plate-steel-grey.webp",
    system: armour({ rArm: 2, lArm: 2 }, { availability: { value: "scarce" }, encumbrance: { value: 1 }, price: { gc: 4 } }) },

  // --- Броня: ноги ---
  { id: "loot-cuisses", name: "Сегментные набедренники", type: "armour", _icon: "core:equipment/leg/cuisses-reticulated-steel.webp",
    system: armour({ rLeg: 2, lLeg: 2 }, { availability: { value: "rare" }, encumbrance: { value: 2 }, price: { gc: 6 } }) },
  { id: "loot-boots", name: "Окованные сапоги", type: "armour", _icon: "core:equipment/feet/boots-armored-steel.webp",
    system: armour({ rLeg: 1, lLeg: 1 }, { armorType: { value: "boiledLeather" }, encumbrance: { value: 1 }, price: { ss: 30 } }) },

  // --- Одежда и аксессуары ---
  { id: "loot-cloak", name: "Плащ нульнского щёголя", type: "trapping", _icon: "core:equipment/back/cloak-collared-purple-gold.webp",
    system: accessory({ availability: { value: "exotic" }, encumbrance: { value: 1 }, price: { gc: 12 },
      description: desc("Бархат цвета вина и золотое шитьё. Слишком красиво для честного человека.") }) },
  { id: "loot-ring", name: "Перстень с аметистом", type: "trapping", _icon: "core:equipment/finger/ring-cabochon-gold-purple.webp",
    system: accessory({ availability: { value: "rare" }, price: { gc: 7 } }) },
  { id: "loot-amulet", name: "Амулет алой зари", type: "trapping", _icon: "core:equipment/neck/amulet-round-gold-red.webp",
    system: accessory({ availability: { value: "scarce" }, price: { gc: 2 } }) },

  // --- Контейнер ---
  { id: "loot-pack", name: "Купеческий ранец", type: "container", _icon: "core:containers/bags/pack-leather-gold-brown.webp",
    system: base({ availability: { value: "scarce" }, encumbrance: { value: 1 }, price: { gc: 1 }, carries: { value: 6 } }) },
  { id: "loot-sack", name: "Большой мешок", type: "container", _icon: "core:containers/bags/pack-simple-leather-brown.webp",
    system: base({ encumbrance: { value: 3 }, price: { ss: 1 }, carries: { value: 6 } }) },
  { id: "loot-pouch", name: "Кошель", type: "container", _icon: "core:containers/bags/pouch-leather-simple-tan.webp",
    system: base({ encumbrance: { value: 0 }, price: { bp: 4 }, carries: { value: 1 } }) }
];
