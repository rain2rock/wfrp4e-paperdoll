// Слепок персонажа для мока. Вставить в консоль Foundry (F12 -> Console).
// Результат копируется в буфер обмена: сохранить как tools/snapshot.json.
// Имя персонажа поправь в первой строке.
const a = game.actors.getName("Хьюго Брандлин");
const s = a.system;
const career = a.currentCareer;
const dump = {
  foundry: game.version,
  wfrp4e: game.system.version,
  name: a.name,
  type: a.type,
  career: career ? { name: career.name, level: career.system.level?.value, img: career.img, class: career.system.class?.value } : null,
  species: s.details?.species?.value,
  status: s.details?.status?.value,
  god: s.details?.god?.value ?? "",
  characteristics: Object.fromEntries(Object.entries(s.characteristics).map(([k, c]) => [k, { value: c.value, bonus: c.bonus, modifier: c.modifier }])),
  wounds: s.status.wounds,
  crits: s.status.criticalWounds,
  armour: Object.fromEntries(Object.entries(s.status.armour ?? {}).map(([k, v]) => [k, v.value])),
  fate: s.status.fate, fortune: s.status.fortune, resilience: s.status.resilience, resolve: s.status.resolve,
  corruption: s.status.corruption, sin: s.status.sin, advantage: s.status.advantage,
  encumbrance: s.status.encumbrance,
  move: s.details?.move,
  experience: s.details?.experience && { total: s.details.experience.total, spent: s.details.experience.spent, current: s.details.experience.current },
  skills: a.itemTypes.skill.map((i) => i.name),
  talents: a.itemTypes.talent.map((i) => ({ name: i.name, advances: i.system.advances?.value ?? 1 })),
  spells: (a.itemTypes.spell ?? []).map((i) => i.name),
  items: a.items
    .filter((i) => i.system.isPhysical && i.type !== "money")
    .map((i) => ({ id: i.id, name: i.name, type: i.type, img: i.img, system: i.system.toObject?.() ?? i.system }))
};
copy(JSON.stringify(dump, null, 2));
console.log("Скопировано. Навыков:", dump.skills.length, "талантов:", dump.talents.length, "предметов:", dump.items.length);
