/**
 * Какую свою иконку (assets/icons) показать для предмета.
 * Общий код для модуля и сборщика мока (tools/build-mock.mjs), без зависимостей от Foundry.
 */

/**
 * Правила по названию: у самодельных предметов в Foundry часто стоит чужая картинка
 * (сапоги с картинкой кожаной куртки, кольцо с общей заглушкой). Название точнее пути.
 * Порядок важен: первое совпадение побеждает.
 */
export const NAME_ICON_RULES = [
  [/сапог|ботин|\bboots?\b/i, "equipment/clothing_and_accessories/boots.png"],
  [/туфл|башмак|\bshoes?\b/i, "equipment/clothing_and_accessories/shoes.png"],
  [/перчат|рукавиц|\bgloves?\b|gauntlet/i, "equipment/clothing_and_accessories/gloves.png"],
  [/плащ|накидк|\bcloak\b|\bcape\b/i, "equipment/clothing_and_accessories/cloak.png"],
  [/капюшон|\bhood\b/i, "equipment/clothing_and_accessories/hood.png"],
  [/шляп|берет|\bhat\b|\bcap\b/i, "equipment/clothing_and_accessories/hat.png"],
  [/мантия|\bроб[аы]\b|\brobes?\b/i, "equipment/clothing_and_accessories/robes.png"],
  [/кольц|перстен|\bring\b/i, "equipment/clothing_and_accessories/signet-ring.png"],
  [/амулет|талисман|\bamulet\b|\btalisman\b/i, "equipment/clothing_and_accessories/amulet.png"],
  [/оникс|самоцвет|драгоцен|изумруд|рубин|сапфир|\bonyx\b|\bgem|\bjewel/i, "equipment/clothing_and_accessories/jewellery.png"],
  [/маска|\bmask\b/i, "equipment/clothing_and_accessories/mask.png"],
  [/одежд|\bclothes\b|\bclothing\b/i, "equipment/clothing_and_accessories/clothing.png"],
  [/гримуар|\bgrimoire\b|spellbook/i, "equipment/book_documents/book-magic.png"],
  [/свиток|\bscroll\b/i, "equipment/book_documents/parchmentsheet.png"]
];

/** Вариант предмета (-fine, -flaw, dagger2) -> путь базового предмета */
export const baseVariant = (rel) => rel.replace(/(-(fine|flaw)(-?\d+)?|\d+)(\.\w+)$/, "$4");

/**
 * Путь своей иконки относительно assets/icons или null.
 * @param {string} rel   путь картинки предмета относительно modules/wfrp4e-core/icons/
 * @param {string} name  название предмета
 * @param {Set<string>} has  какие иконки есть в assets/icons
 */
export function ownIconFor(rel, name, has) {
  for (const [re, icon] of NAME_ICON_RULES) if (re.test(name ?? "") && has.has(icon)) return icon;
  if (has.has(rel)) return rel;
  const base = baseVariant(rel);
  return base !== rel && has.has(base) ? base : null;
}
