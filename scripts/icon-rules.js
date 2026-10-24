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
  // \b в JS работает только с латиницей, поэтому у кириллицы граница через \p{L} и флаг u:
  // иначе «роба» не ловилась вовсе, а без границы цеплялся бы «гардероба»
  [/мантия|ряс[аыу]|облачени|сутан|хламид|(?<!\p{L})роб[аы](?!\p{L})|\brobes?\b|\bcassock\b|vestment/iu, "equipment/clothing_and_accessories/robes.png"],
  [/кольц|перстен|\bring\b/i, "equipment/clothing_and_accessories/signet-ring.png"],
  [/амулет|талисман|\bamulet\b|\btalisman\b/i, "equipment/clothing_and_accessories/amulet.png"],
  [/оникс|самоцвет|драгоцен|изумруд|рубин|сапфир|\bonyx\b|\bgem|\bjewel/i, "equipment/clothing_and_accessories/jewellery.png"],
  [/маска|\bmask\b/i, "equipment/clothing_and_accessories/mask.png"],
  [/одежд|\bclothes\b|\bclothing\b/i, "equipment/clothing_and_accessories/clothing.png"],
  [/гримуар|\bgrimoire\b|spellbook/i, "equipment/book_documents/book-magic.png"],
  [/свиток|\bscroll\b/i, "equipment/book_documents/parchmentsheet.png"]
];

/**
 * Запись ленты эффектов -> своя иконка. Путь у этих предметов почти всегда чужой
 * (состояния лежат в системе, мутации и криты - в компендиуме ядра), поэтому идём
 * по сути записи: состояние по ключу системы, крит по локации, мутация и болезнь
 * по названию, а если ничего не подошло - общая заглушка своего вида.
 */
const CRIT_LOC = { head: "head", body: "body", rArm: "arm", lArm: "arm", rLeg: "leg", lLeg: "leg" };

/** Темы мутаций и болезней: названия в мирах бывают и английские, и русские */
const FX_NAME_RULES = {
  mutation: [
    [/tentacl|щупальц/i, "tentacle"], [/\bhorns?\b|рог[аи]?\b/i, "horns"], [/\btail\b|хвост/i, "tail"],
    [/claw|коготь|когт/i, "claws"], [/fang|клык/i, "fangs"], [/scale|чешу/i, "scales"],
    [/\bfur\b|шерст|мех\b/i, "fur"], [/wing|крыл/i, "wings"], [/one eye|cyclop|один глаз|циклоп/i, "one-eye"],
    [/extra eyes|лишние глаза|третий глаз/i, "extra-eyes"], [/hoof|hooves|копыт/i, "hooves"],
    [/\bbeak\b|клюв/i, "beak"], [/bestial|звериная морда|звериное лицо/i, "bestial-face"],
    [/hunchback|горб/i, "hunchback"], [/albino|альбинос/i, "albino"],
    [/rotting|гниющ|гнилая плоть/i, "rotting-flesh"], [/brand|клеймо/i, "chaos-brand"],
    [/stench|smell|вонь|зловон/i, "stench"], [/oversized|огромн|непомерн/i, "oversized-limb"],
    [/melted|оплавл|расплав/i, "melted-face"], [/extra arm|лишняя рука|третья рука/i, "extra-arm"],
    [/extra head|лишняя голова|втора[яй] голова/i, "extra-head"],
    [/paranoi|параной/i, "paranoia"], [/bloodlust|жажда крови|кровожадн/i, "bloodlust"],
    [/hallucin|галлюцин/i, "hallucinations"], [/voices|голоса/i, "voices"],
    [/compulsion|одержим|навязчив/i, "compulsion"], [/phobia|фоби/i, "phobia"],
    [/megaloman|мегаломан|величи/i, "megalomania"], [/amnesia|амнези|беспамят/i, "amnesia"]
  ],
  disease: [
    [/fever|лихорад|жар\b/i, "fever"], [/plague|чум/i, "plague"],
    [/infect|заражен|воспален/i, "infection"], [/\brot\b|гнил|гниен/i, "rot"]
  ]
};

/**
 * @param {string} kind  condition | mutation | disease | critical
 * @param {{name?: string, key?: string, type?: string, location?: string}} info
 * @param {Set<string>} has  какие иконки есть в assets/icons
 * @returns {string|null} путь относительно assets/icons
 */
export function effectIconFor(kind, info = {}, has) {
  const { name = "", key = "", type = "", location = "" } = info;
  const tries = [];
  if (kind === "condition" && key) tries.push(`conditions/${key}.png`);
  if (kind === "mutation" || kind === "disease") {
    const dir = kind === "mutation" ? "mutations" : "diseases";
    const slug = talentSlug(name);
    if (slug) tries.push(`${dir}/${slug}.png`);
    for (const [re, file] of FX_NAME_RULES[kind]) if (re.test(name)) tries.push(`${dir}/${file}.png`);
    tries.push(kind === "mutation"
      ? `mutations/mutation-${type === "mental" ? "mental" : "physical"}.png`
      : "diseases/disease.png");
    // Своей ментальной заглушки может не быть - тогда лучше общая физическая, чем чужая картинка
    if (kind === "mutation") tries.push("mutations/mutation-physical.png");
  }
  if (kind === "spell" || kind === "prayer") {
    // Школа заклинания или вид молитвы - ключ из game.wfrp4e.config, он же имя файла
    if (key) tries.push(`magic/${kind}-${key}.png`);
    tries.push(`magic/${kind}.png`);
  }
  if (kind === "critical") {
    if (/fatal|смертельн/i.test(name)) tries.push("criticals/critical-fatal.png");
    const loc = CRIT_LOC[location];
    if (loc) tries.push(`criticals/critical-${loc}.png`);
    tries.push("criticals/critical.png");
  }
  return tries.find((t) => has.has(t)) ?? null;
}

/** Вариант предмета (-fine, -flaw, dagger2) -> путь базового предмета */
export const baseVariant = (rel) => rel.replace(/(-(fine|flaw)(-?\d+)?|\d+)(\.\w+)$/, "$4");

/**
 * Английское название таланта -> имя файла в assets/icons/talents (без расширения).
 * У всех талантов в wfrp4e-core одна и та же заглушка-картинка, своя иконка подбирается только по названию.
 */
/**
 * Название без уточнения в скобках и завершающего двоеточия:
 * «Melee (Flail)» -> «Melee», «Lore (Empire):» -> «Lore».
 * Двоеточие снимаем ПЕРВЫМ, иначе скобки не окажутся в конце строки.
 */
export const baseName = (name) =>
  String(name ?? "").replace(/:\s*$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();

export function talentSlug(name) {
  return baseName(name)
    .toLowerCase()
    .replace(/[^a-z!]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
