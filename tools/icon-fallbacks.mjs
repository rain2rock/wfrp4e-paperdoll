/* ==========================================================
   Подбор иконок для мока.

   Порядок:
   1. Путь из самого предмета (item.img), если файл есть локально:
        modules/wfrp4e-core/icons/...  ->  <icons>/...
        icons/...                      ->  <icons_core>/...
      Но заглушки из wfrp4e-core (одна картинка на сотни предметов)
      пропускаем - для них ищем что-то осмысленнее.
   2. Правила по названию предмета ниже - сначала из <icons> (wfrp4e-core),
      потом из <icons_core> (стандартные иконки Foundry).
   3. Если ничего не нашлось - заглушка из <icons> или эмодзи.

   Пути пишутся с префиксом корня: "icons:" или "core:".
   ========================================================== */

/** md5 картинок-заглушек wfrp4e-core: одна иконка на целую категорию */
export const PLACEHOLDER_HASHES = new Set([
  "50dabf1dfe3a5b08ff7b21c7bfb74f0a", // мешок: снаряжение, одежда, контейнеры
  "3338e7ee8a8edbcd57451c4e7aedabb7", // меч: ближнее оружие
  "57c1ad8bf17309d15a7c44c2c023fcb3", // лук: стрелковое оружие
  "4e1c423d82dc755860ddbc71f92162f5"  // силуэт брони
]);

/** [регулярка по названию, кандидаты по порядку] */
export const NAME_RULES = [
  // --- Оружие ---
  [/flail|цеп/i, ["icons:equipment/weapons/flail.png"]],
  [/club|дубин|bludgeon/i, ["icons:equipment/weapons/bludgeon-hw.png", "core:weapons/clubs/club-banded-brown.webp"]],
  [/dagger|кинжал/i, ["icons:equipment/weapons/dagger.png"]],
  [/knife|нож/i, ["icons:equipment/weapons/knife.png"]],
  [/sling|праща/i, ["icons:equipment/weapons/sling.png"]],
  [/whip|плеть|кнут/i, ["core:weapons/misc/whip-leather.webp"]],
  [/buckler|баклер/i, ["core:equipment/shield/buckler-wooden-boss-steel.webp"]],
  [/shield|щит/i, ["core:equipment/shield/heater-wooden-steel-boss.webp"]],
  [/sword|меч/i, ["core:weapons/swords/sword-guard-brass-worn.webp"]],

  // --- Броня ---
  [/coif/i, ["core:equipment/head/helm-norman-padded-leather.webp"]],
  [/капюш|hood/i, ["core:equipment/head/hood-leather-brown.webp"]],
  [/gambeson.*shirt|стёган|стеган/i, ["core:equipment/chest/breastplate-quilted-brown.webp"]],
  [/mail|кольч/i, ["core:equipment/chest/breastplate-scale-grey.webp"]],
  [/jack|jerkin|куртк/i, ["core:equipment/chest/breastplate-layered-leather-brown.webp"]],
  [/legging|штан|leg/i, ["core:equipment/leg/pants-breeches-leather-brown.webp"]],
  [/boot|сапог/i, ["core:equipment/feet/boots-leather-laced-brown.webp"]],

  // --- Одежда и аксессуары ---
  [/cloak|плащ/i, ["core:equipment/back/cloak-brown.webp"]],
  [/robe|ряс/i, ["core:equipment/chest/robe-layered-red.webp"]],
  [/glove|перчат/i, ["core:equipment/hand/gauntlet-simple-leather-brown.webp"]],
  [/clothes,? fine|изящн.*одежд/i, ["core:equipment/chest/coat-collared-red-gold.webp"]],
  [/clothing|одежд/i, ["core:equipment/chest/shirt-simple-white.webp"]],
  [/belt|ремень|пояс/i, ["core:equipment/waist/belt-leather-brown.webp"]],
  [/ring|кольц/i, ["core:equipment/finger/ring-band-engraved-silver.webp"]],
  [/молот|hammer.*pend|подвеск/i, ["core:equipment/neck/amulet-carved-stone-hammer.webp"]],
  [/платок|handkerchief/i, ["core:equipment/neck/handkerchief-bandana-blue.webp"]],

  // --- Контейнеры ---
  [/backpack|рюкзак/i, ["core:containers/bags/pack-leather-brown.webp"]],
  [/sling.?bag|наплечн/i, ["core:containers/bags/case-simple-leather-brown.webp"]],
  [/pouch|кошел/i, ["core:containers/bags/pouch-leather-simple-tan.webp"]],
  [/sack|котомк|мешок/i, ["core:containers/bags/pack-simple-leather-brown.webp"]],

  // --- Прочее ---
  [/blanket|одеял/i, ["core:sundries/survival/bedroll-brown.webp"]],
  [/tinder|огнив/i, ["core:sundries/survival/fire-lighter-brass-lit.webp"]],
  [/rope|верёв|верев/i, ["core:sundries/survival/rope-coiled-brown.webp"]],
  [/ration|паёк|паек/i, ["core:consumables/grains/breadsticks-crackers-wrapped-ration-brown.webp"]],
  [/гримуар|grimoire/i, ["core:sundries/books/book-black-grey.webp"]],
  [/молитвен|prayer.?book/i, ["core:sundries/books/book-symbol-canterbury-cross.webp"]],
  [/свиток|scroll/i, ["core:sundries/scrolls/scroll-writing-tan-grey.webp"]],
  [/onyx|оникс/i, ["core:commodities/gems/gem-faceted-round-black.webp"]],
  [/candle|свеч/i, ["core:sundries/lights/candle-unlit-tan.webp"]],
  [/bandage|бинт/i, ["core:tools/medical/bandage-rough.webp"]],
  [/water|фляг/i, ["core:sundries/survival/waterskin-leather-brown.webp"]],
  [/палец|relic|реликв/i, ["core:magic/holy/saint-glass-portrait-halo.webp"]]
];
