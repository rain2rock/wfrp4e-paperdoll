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

// Individual spell art: exact title or original image basename; unknown titles keep their school icon.
const SPELL_ICON_BY_NAME = {
  "deciphercurse": "magic/spells/decipher-curse.png",
  "disruptmagic": "magic/spells/disrupt-magic.png",
  "flyinfestedrotweed": "magic/spells/fly-infested-rotweed.png",
  "lifebloomsilt": "magic/spells/lifebloom-silt.png",
  "belligerenceofthebloodmarsh": "magic/spells/belligerence-of-the-bloodmarsh.png",
  "collapseconstruct": "magic/spells/collapse-construct.png",
  "silence": "magic/spells/silence.png",
  "succourmagicalservant": "magic/spells/succour-magical-servant.png",
  "banishment": "magic/spells/banishment.png",
  "blindinglight": "magic/spells/blinding-light.png",
  "clarityofthought": "magic/spells/clarity-of-thought.png",
  "crevasse": "magic/spells/crevasse.png",
  "abullassnare": "magic/spells/abulla-s-snare.png",
  "assaultofstone": "magic/spells/assault-of-stone.png",
  "erecttheedifice": "magic/spells/erect-the-edifice.png",
  "eyesofvolans": "magic/spells/eyes-of-volans.png",
  "daemonbane": "magic/spells/daemonbane.png",
  "healinglight": "magic/spells/healing-light.png",
  "dazzlingbrightness": "magic/spells/dazzling-brightness.png",
  "drivingintent": "magic/spells/driving-intent.png",
  "meissnersinstantaneouslibrarian": "magic/spells/meissner-s-instantaneous-librarian.png",
  "netofamyntok": "magic/spells/net-of-amyntok.png",
  "orbofhysh": "magic/spells/orb-of-hysh.png",
  "handsofkarkora": "magic/spells/hands-of-karkora.png",
  "illuminatetheedifice": "magic/spells/illuminate-the-edifice.png",
  "lightofpurity": "magic/spells/light-of-purity.png",
  "speedofthought": "magic/spells/speed-of-thought.png",
  "timeamok": "magic/spells/time-amok.png",
  "perfectcomprehension": "magic/spells/perfect-comprehension.png",
  "phasprotection": "magic/spells/ph-s-protection.png",
  "phsprotection": "magic/spells/ph-s-protection.png",
  "piercetheveil": "magic/spells/pierce-the-veil.png",
  "shimmeringcloak": "magic/spells/shimmering-cloak.png",
  "crucibleofchamon": "magic/spells/crucible-of-chamon.png",
  "curseofrust": "magic/spells/curse-of-rust.png",
  "enchantweapon": "magic/spells/enchant-weapon.png",
  "armouroftin": "magic/spells/armour-of-tin.png",
  "breachtheunknown": "magic/spells/breach-the-unknown.png",
  "gehennasgoldenglobe": "magic/spells/gehenna-s-golden-globe.png",
  "gildedcage": "magic/spells/gilded-cage.png",
  "glitteringrobe": "magic/spells/glittering-robe.png",
  "goldentouch": "magic/spells/golden-touch.png",
  "faultofform": "magic/spells/fault-of-form.png",
  "featheroflead": "magic/spells/feather-of-lead.png",
  "foolsgold": "magic/spells/fool-s-gold.png",
  "forgeofchamon": "magic/spells/forge-of-chamon.png",
  "knotuntied": "magic/spells/knot-untied.png",
  "metalmended": "magic/spells/metal-mended.png",
  "meteoricironclad": "magic/spells/meteoric-ironclad.png",
  "goldsteelshielding": "magic/spells/goldsteel-shielding.png",
  "inscription": "magic/spells/inscription.png",
  "transmutationofchamon": "magic/spells/transmutation-of-chamon.png",
  "trialanderror": "magic/spells/trial-and-error.png",
  "mutablemetal": "magic/spells/mutable-metal.png",
  "prismaticrefractionofhabermas": "magic/spells/prismatic-refraction-of-habermas.png",
  "puchtassilvercompass": "magic/spells/puchta-s-silver-compass.png",
  "replicationoflevorg": "magic/spells/replication-of-levorg.png",
  "dwellersbelow": "magic/spells/dwellers-below.png",
  "earthblood": "magic/spells/earthblood.png",
  "earthpool": "magic/spells/earthpool.png",
  "almanac": "magic/spells/almanac.png",
  "barkskin": "magic/spells/barkskin.png",
  "geyser": "magic/spells/geyser.png",
  "invigoratingchant": "magic/spells/invigorating-chant.png",
  "jadecasket": "magic/spells/jade-casket.png",
  "fatoftheland": "magic/spells/fat-of-the-land.png",
  "fleshofstone": "magic/spells/flesh-of-stone.png",
  "forestofthorns": "magic/spells/forest-of-thorns.png",
  "gardenerswarcry": "magic/spells/gardener-s-warcry.png",
  "natureswhisper": "magic/spells/nature-s-whisper.png",
  "paranothspathway": "magic/spells/paranoth-s-pathway.png",
  "regenerate": "magic/spells/regenerate.png",
  "leaffall": "magic/spells/leaf-fall.png",
  "leyfinding": "magic/spells/leyfinding.png",
  "lieoftheland": "magic/spells/lie-of-the-land.png",
  "lifebloom": "magic/spells/lifebloom.png",
  "vitalgrowth": "magic/spells/vital-growth.png",
  "woodshape": "magic/spells/wood-shape.png",
  "spiralstair": "magic/spells/spiral-stair.png",
  "vauntedtransmogrificationofcolchis": "magic/spells/vaunted-transmogrification-of-colchis.png",
  "verdantapotheosis": "magic/spells/verdant-apotheosis.png",
  "azureblades": "magic/spells/azure-blades.png",
  "ceruleanshield": "magic/spells/cerulean-shield.png",
  "cometofcasandora": "magic/spells/comet-of-casandora.png",
  "fantasticforesight": "magic/spells/fantastic-foresight.png",
  "fatesficklefingers": "magic/spells/fate-s-fickle-fingers.png",
  "fateilluminated": "magic/spells/fate-illuminated.png",
  "curseoffate": "magic/spells/curse-of-fate.png",
  "divination": "magic/spells/divination.png",
  "enemyforeseen": "magic/spells/enemy-foreseen.png",
  "mysticmirror": "magic/spells/mystic-mirror.png",
  "polishandglean": "magic/spells/polish-and-glean.png",
  "projectspirit": "magic/spells/project-spirit.png",
  "sapphirearch": "magic/spells/sapphire-arch.png",
  "lensonthesky": "magic/spells/lens-on-the-sky.png",
  "letthefourwindsblow": "magic/spells/let-the-four-winds-blow.png",
  "mistralfromthestratosphere": "magic/spells/mistral-from-the-stratosphere.png",
  "tesslasarc": "magic/spells/t-essla-s-arc.png",
  "thefirstportentofamul": "magic/spells/the-first-portent-of-amul.png",
  "firstportentofamul": "magic/spells/the-first-portent-of-amul.png",
  "thesecondportentofamul": "magic/spells/the-second-portent-of-amul.png",
  "secondportentofamul": "magic/spells/the-second-portent-of-amul.png",
  "thethirdportentofamul": "magic/spells/the-third-portent-of-amul.png",
  "thirdportentofamul": "magic/spells/the-third-portent-of-amul.png",
  "thorsensthunderstorm": "magic/spells/thorsen-s-thunderstorm.png",
  "starcrossed": "magic/spells/starcrossed.png",
  "starshine": "magic/spells/starshine.png",
  "stormofshemtek": "magic/spells/storm-of-shemtek.png",
  "blackhorrors": "magic/spells/black-horrors.png",
  "bridgeofshadows": "magic/spells/bridge-of-shadows.png",
  "chokingshadows": "magic/spells/choking-shadows.png",
  "danceofdespair": "magic/spells/dance-of-despair.png",
  "bewilder": "magic/spells/bewilder.png",
  "hornofandar": "magic/spells/horn-of-andar.png",
  "hush": "magic/spells/hush.png",
  "illusion": "magic/spells/illusion.png",
  "deeppockets": "magic/spells/deep-pockets.png",
  "doppelganger": "magic/spells/doppelganger.png",
  "grandillusion": "magic/spells/grand-illusion.png",
  "greywings": "magic/spells/grey-wings.png",
  "pitoftarnus": "magic/spells/pit-of-tarnus.png",
  "ribauldsretroactiveillusion": "magic/spells/ribauld-s-retroactive-illusion.png",
  "shadowgrove": "magic/spells/shadow-grove.png",
  "mindslip": "magic/spells/mindslip.png",
  "mutablevisage": "magic/spells/mutable-visage.png",
  "mystifyingmiasma": "magic/spells/mystifying-miasma.png",
  "substanceofshadow": "magic/spells/substance-of-shadow.png",
  "traitoroftarn": "magic/spells/traitor-of-tarn.png",
  "wanderingshadow": "magic/spells/wandering-shadow.png",
  "shadowsteed": "magic/spells/shadowsteed.png",
  "shadowstep": "magic/spells/shadowstep.png",
  "shroudofinvisibility": "magic/spells/shroud-of-invisibility.png",
  "animusimprisoned": "magic/spells/animus-imprisoned.png",
  "ashesanddust": "magic/spells/ashes-and-dust.png",
  "acceptanceoffate": "magic/spells/acceptance-of-fate.png",
  "amaranth": "magic/spells/amaranth.png",
  "deathsrelease": "magic/spells/death-s-release.png",
  "dyingwords": "magic/spells/dying-words.png",
  "fateofbjuna": "magic/spells/fate-of-bjuna.png",
  "caressoflaniph": "magic/spells/caress-of-laniph.png",
  "compelspirits": "magic/spells/compel-spirits.png",
  "crystalmaze": "magic/spells/crystal-maze.png",
  "scytheofshyish": "magic/spells/scythe-of-shyish.png",
  "shyishuncovered": "magic/spells/shyish-uncovered.png",
  "soulvortex": "magic/spells/soul-vortex.png",
  "speedoflykos": "magic/spells/speed-of-lykos.png",
  "iyrtusembrace": "magic/spells/iyrtu-s-embrace.png",
  "limbwither": "magic/spells/limbwither.png",
  "purplepallofshyish": "magic/spells/purple-pall-of-shyish.png",
  "sanctify": "magic/spells/sanctify.png",
  "telepathy": "magic/spells/telepathy.png",
  "tideofyears": "magic/spells/tide-of-years.png",
  "wildkinofzandox": "magic/spells/wild-kin-of-zandox.png",
  "steallife": "magic/spells/steal-life.png",
  "swiftpassing": "magic/spells/swift-passing.png",
  "tasteofdeath": "magic/spells/taste-of-death.png",
  "boilingblood": "magic/spells/boiling-blood.png",
  "burninghead": "magic/spells/burning-head.png",
  "captivatingflame": "magic/spells/captivating-flame.png",
  "aqshysaegis": "magic/spells/aqshy-s-aegis.png",
  "bodyoffire": "magic/spells/body-of-fire.png",
  "flaminghearts": "magic/spells/flaming-hearts.png",
  "firewall": "magic/spells/firewall.png",
  "flamestorm": "magic/spells/flamestorm.png",
  "flamingswordofrhuin": "magic/spells/flaming-sword-of-rhuin.png",
  "cauterise": "magic/spells/cauterise.png",
  "choleric": "magic/spells/choleric.png",
  "crownofflame": "magic/spells/crown-of-flame.png",
  "kindleflame": "magic/spells/kindleflame.png",
  "kindredofthehearth": "magic/spells/kindred-of-the-hearth.png",
  "magmastorm": "magic/spells/magma-storm.png",
  "forgeoftarnus": "magic/spells/forge-of-tarnus.png",
  "greatfiresofuzhul": "magic/spells/great-fires-of-u-zhul.png",
  "ignite": "magic/spells/ignite.png",
  "inextinguishableflame": "magic/spells/inextinguishable-flame.png",
  "tasteoffire": "magic/spells/taste-of-fire.png",
  "witheringheat": "magic/spells/withering-heat.png",
  "ygethmorsflamingblizzard": "magic/spells/ygethmor-s-flaming-blizzard.png",
  "purge": "magic/spells/purge.png",
  "sanguineswords": "magic/spells/sanguine-swords.png",
  "awakeningofthewood": "magic/spells/awakening-of-the-wood.png",
  "beastform": "magic/spells/beast-form.png",
  "beastmaster": "magic/spells/beast-master.png",
  "ambertalons": "magic/spells/amber-talons.png",
  "ambertrance": "magic/spells/amber-trance.png",
  "curseofanraheir": "magic/spells/curse-of-anraheir.png",
  "eyesofthepack": "magic/spells/eyes-of-the-pack.png",
  "flockofdoom": "magic/spells/flock-of-doom.png",
  "beasttongue": "magic/spells/beast-tongue.png",
  "beastunbroken": "magic/spells/beast-unbroken.png",
  "quickpassage": "magic/spells/quick-passage.png",
  "summonmount": "magic/spells/summon-mount.png",
  "theamberspear": "magic/spells/the-amber-spear.png",
  "amberspear": "magic/spells/the-amber-spear.png",
  "followscent": "magic/spells/follow-scent.png",
  "huntershide": "magic/spells/hunter-s-hide.png",
  "huntersmoons": "magic/spells/hunter-s-moons.png",
  "merciwsmonstrousregiment": "magic/spells/merciw-s-monstrous-regiment.png",
  "muskspray": "magic/spells/musk-spray.png",
  "vengefulhood": "magic/spells/vengeful-hood.png",
  "wintercoat": "magic/spells/winter-coat.png",
  "writhingworm": "magic/spells/writhing-worm.png",
  "theoxstands": "magic/spells/the-ox-stands.png",
  "oxstands": "magic/spells/the-ox-stands.png",
  "wyssanswildform": "magic/spells/wyssan-s-wildform.png",
  "transformationofkadon": "magic/spells/transformation-of-kadon.png"
};
const spellArtKey = (value) => String(value ?? "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");

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
  if (kind === "spell") {
    const sourceName = String(info.img ?? "").split(/[?#]/)[0].split("/").pop().replace(/\.[^.]+$/, "");
    for (const candidate of [name, sourceName]) {
      const file = SPELL_ICON_BY_NAME[spellArtKey(candidate)];
      if (file) tries.push(file);
    }
  }
  if (kind === "spell" || kind === "prayer") {
    // god.value в системе - свободный текст, а не ключ. Непонятное имя оставляем как есть:
    // оно не должно ломать обычный подбор по виду молитвы или общей заглушке.
    if (kind === "prayer" && typeof info.god === "string") {
      const god = info.god.trim().toLowerCase();
      const aliases = [
        ["sigmar", "сигмар"], ["ulric", "ульрик"], ["shallya", "шаллия", "шалия"],
        ["morr", "морр"], ["ranald", "ранальд"], ["rhya", "рия", "риа"], ["taal", "таал"],
        ["verena", "верена"], ["manann", "мананн"], ["myrmidia", "мирмидия"]
      ];
      const match = aliases.find((names) => names.includes(god));
      if (match) tries.push(`magic/gods/god-${match[0]}.png`);
    }
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
