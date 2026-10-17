/**
 * Богатый тестовый персонаж для мока: куча опыта и по предмету на каждую свою иконку снаряжения.
 * Нужен, чтобы посмотреть все иконки и покачать статы.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "assets/icons/equipment");
const RARITY = ["common", "scarce", "rare", "exotic"];
const title = (f) => f.replace(/\.png$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const base = (o) => ({ quantity: { value: 1 }, encumbrance: { value: 0 }, price: { gc: 0, ss: 0, bp: 0 }, availability: { value: "common" }, description: { value: "" }, ...o });
const ch = (initial, advances = 0, modifier = 0) => ({ initial, advances, modifier });

const GROUP = [
  [/bow/, "bow"], [/crossbow/, "crossbow"], [/blunderbuss|handgun|pistol|gun/, "blackpowder"], [/sling/, "sling"],
  [/throw|dart|rock|javelin/, "throwing"], [/bolas|lasso|net|whip/, "entangling"], [/flail/, "flail"],
  [/halberd|spear|pike|polearm/, "polearm"], [/great|zweih|two/, "twohanded"], [/rapier|foil|smallsword/, "fencing"],
  [/shield|buckler|main-gauche|swordbreaker/, "parry"], [/knuckle|unarmed|cestus/, "brawling"], [/lance/, "cavalry"]
];
const RANGED = new Set(["bow", "crossbow", "blackpowder", "sling", "throwing", "entangling"]);
const AP_BY = [
  [/helm|coif|cap|hood|sallet|bascinet/, { head: 2 }], [/leggings|chausses|greaves|legs/, { rLeg: 2, lLeg: 2 }],
  [/sleeves|bracers|vambrace|arm/, { rArm: 2, lArm: 2 }], [/.*/, { body: 2 }]
];
let n = 0;
const items = [];
// Две большие сумки, чтобы всё влезло
items.push(
  { id: "r-pack", name: "Большой рюкзак", type: "container", _icon: "icons:equipment/packs_and_containers/backpack.png",
    flags: { "wfrp4e-paperdoll": { bagSlot: "bag1" } }, system: base({ equipped: { value: true }, carries: { value: 400 } }) },
  { id: "r-chest", name: "Сундук на колёсах", type: "container", _icon: "icons:equipment/packs_and_containers/chest.png",
    flags: { "wfrp4e-paperdoll": { bagSlot: "bag2" } }, system: base({ equipped: { value: true }, carries: { value: 400 } }) }
);
for (const cat of fs.readdirSync(dir).sort().filter((c) => fs.statSync(path.join(dir, c)).isDirectory())) {
  for (const f of fs.readdirSync(path.join(dir, cat)).sort()) {
    if (!f.endsWith(".png")) continue;
    const id = `r${n++}`;
    const rel = `icons:equipment/${cat}/${f}`;
    const availability = { value: RARITY[Math.floor(n / 2) % RARITY.length] };
    const loc = { value: n % 2 ? "r-pack" : "r-chest" };
    if (cat === "weapons") {
      const group = GROUP.find(([re]) => re.test(f))?.[1] ?? "basic";
      items.push({ id, name: title(f), type: "weapon", _icon: rel, system: base({
        equipped: { value: false }, twohanded: { value: group === "twohanded" || group === "polearm" }, offhand: { value: false },
        weaponGroup: { value: group }, reach: { value: "average" }, damage: { value: RANGED.has(group) ? "+8" : "SB+4" },
        _ranged: RANGED.has(group), _range: RANGED.has(group) ? "30" : undefined, availability, location: loc }) });
    } else if (cat === "armour") {
      const AP = AP_BY.find(([re]) => re.test(f))[1];
      items.push({ id, name: title(f), type: "armour", _icon: rel, system: base({
        equipped: { value: false }, armorType: { value: /plate|helm/.test(f) ? "plate" : /mail|coif|chausses/.test(f) ? "mail" : "softLeather" },
        penalty: { value: "" }, AP: { head: 0, body: 0, rArm: 0, lArm: 0, rLeg: 0, lLeg: 0, ...AP }, availability, location: loc }) });
    } else if (cat === "ammunition") {
      items.push({ id, name: title(f), type: "ammunition", _icon: rel, system: base({ quantity: { value: 12 }, availability, location: loc }) });
    } else {
      items.push({ id, name: title(f), type: "trapping", _icon: rel, system: base({
        equipped: { value: false }, trappingType: { value: cat === "clothing_and_accessories" ? "clothingAccessories" : "misc" }, availability, location: loc }) });
    }
  }
}

const SKILLS = [
  ["Art", "dex", 5], ["Athletics", "ag", 15], ["Bribery", "fel", 5], ["Charm", "fel", 10], ["Charm Animal", "wp", 0], ["Climb", "s", 10],
  ["Cool", "wp", 20], ["Consume Alcohol", "t", 10], ["Dodge", "ag", 20], ["Drive", "ag", 0], ["Endurance", "t", 20], ["Entertain (Storytelling)", "fel", 5],
  ["Gamble", "int", 5], ["Gossip", "fel", 10], ["Haggle", "fel", 5], ["Intimidate", "s", 15], ["Intuition", "i", 15], ["Leadership", "fel", 20],
  ["Melee (Basic)", "ws", 25], ["Melee (Two-handed)", "ws", 15], ["Melee (Parry)", "ws", 10], ["Navigation", "i", 0], ["Outdoor Survival", "int", 10],
  ["Perception", "i", 20], ["Ride (Horse)", "ag", 10], ["Row", "s", 0], ["Stealth (Urban)", "ag", 5],
  ["Heal", "int", 10], ["Language (Battle)", "int", 15], ["Lore (Warfare)", "int", 10], ["Ranged (Crossbow)", "bs", 15], ["Ranged (Blackpowder)", "bs", 5],
  ["Trade (Smith)", "dex", 0], ["Track", "i", 5], ["Swim", "s", 0]
];
const TALENTS = [
  ["Strike Mighty Blow", 2, "s"], ["Combat Aware", 1, "i"], ["Warrior Born", 1, "1"], ["Hardy", 2, "t"], ["Resolute", 1, "s"], ["Unshakable", 1, "1"],
  ["Warleader", 1, "fel"], ["Enclosed Fighter", 1, "dex"], ["Very Strong", 1, "1"], ["Very Resilient", 1, "1"], ["Robust", 1, "t"],
  ["Rapid Reload", 2, "dex"], ["Marksman", 1, "1"], ["Strong Back", 1, "s"], ["Iron Will", 1, "wp"], ["Disarm", 1, "i"]
];
const TALENT_DESC = {
  "Strike Mighty Blow": "<p>You know how to hit hard! Your melee strikes deal +1 Damage for every level of this Talent.</p>",
  "Hardy": "<p>You gain a permanent addition to your Wounds equal to your Toughness Bonus. If your Toughness Bonus should increase, then the number of Wounds Hardy provides also increases.</p>",
  "Combat Aware": "<p>You are used to scanning the battlefield to make snap decisions informed by the shifting tides of war. You may take a Challenging (+0) Perception Test to ignore Surprise, which is modified by circumstance as normal.</p>",
  "Warrior Born": "<p>You gain a permanent +5 bonus to your starting Weapon Skill, which does not count towards your Advances.</p>"
};
const CAREER = [
  { name: "Рекрут", group: "Солдат", level: 1, chars: ["ws", "t", "wp"], skills: ["Athletics", "Climb", "Cool", "Dodge", "Endurance", "Language (Battle)", "Melee (Basic)", "Play (Drum)"], talents: ["Diceman", "Marksman", "Strong Back", "Warrior Born"] },
  { name: "Солдат", group: "Солдат", level: 2, chars: ["ws", "t", "wp", "bs"], skills: ["Consume Alcohol", "Gamble", "Gossip", "Melee (Any)", "Ranged (Any)", "Outdoor Survival"], talents: ["Diceman", "Etiquette (Soldiers)", "Rapid Reload", "Strike Mighty Blow"] },
  { name: "Сержант", group: "Солдат", level: 3, chars: ["ws", "t", "wp", "bs", "i"], skills: ["Heal", "Intuition", "Leadership", "Perception"], talents: ["Combat Aware", "Enclosed Fighter", "Unshakable", "Warleader"] },
  { name: "Офицер", group: "Солдат", level: 4, chars: ["ws", "t", "wp", "bs", "i", "fel"], skills: ["Lore (Warfare)", "Navigation"], talents: ["Inspiring", "Public Speaker", "Seasoned Traveller", "Stout-hearted"] }
];

export const RICH = {
  id: "rich",
  name: "Капитан Рейнхард (тест иконок)",
  career: { name: "Офицер", level: 4, class: "Воины" },
  careers: CAREER.map((c, i) => ({ ...c, ...(i < 3 ? { complete: true } : { current: true }) })),
  skills: SKILLS.map(([name, chk, adv]) => ({ name, ch: chk, adv })),
  talents: TALENTS.map(([name, advances, max]) => ({ name, advances, max, desc: TALENT_DESC[name] })),
  system: {
    characteristics: { ws: ch(38, 20), bs: ch(33, 15), s: ch(36, 10), t: ch(37, 15), i: ch(35, 15), ag: ch(32, 5), dex: ch(30), int: ch(31, 5), wp: ch(34, 20), fel: ch(33, 15) },
    status: {
      wounds: { value: 18, max: 18 }, criticalWounds: { value: 0, max: 5 }, advantage: { value: 3, max: 10 },
      fate: { value: 3 }, fortune: { value: 3 }, resilience: { value: 3 }, resolve: { value: 3 },
      corruption: { value: 2, max: 8 }, sin: { value: 0 }, encumbrance: { current: 0, max: 0 }
    },
    details: { species: { value: "human" }, status: { value: "Серебро 5" }, move: { value: 4, walk: "8", run: "16" }, experience: { total: 12000, spent: 4500, current: 7500 } },
    settings: { equipPoints: 2 }
  },
  items
};
