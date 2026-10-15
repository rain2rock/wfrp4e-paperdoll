/**
 * Сборка интерактивного мока: docs/paperdoll-mock.html
 *
 *   npm install            (один раз, ставит handlebars)
 *   npm run mock           демо-персонаж из tools/mock-data.mjs
 *   node tools/build-mock.mjs --snapshot tools/snapshot.json --out mock-hugo.html
 *                          персонаж из слепка, снятого скриптом из консоли Foundry
 *   --profile mage|metal|ulric|duelist
 *                          подменить навыки, таланты и бога (проверка ограничений)
 *   --effects              добавить тестовые состояния, эффект местности, травму, крит и болезнь
 *   --loot                 добавить тестовый лут (tools/mock-loot.mjs): все слоты и все редкости
 *   --icons-system DIR     иконки самой системы WFRP4e (static/icons из её репо) - для состояний
 *   --icons DIR --icons-core DIR
 *                          настоящие иконки: DIR с иконками wfrp4e-core и DIR со стандартными
 *                          иконками Foundry (см. tools/icon-fallbacks.mjs). Без них - эмодзи.
 *                          Мок с такими иконками не коммитим: это платный контент.
 *
 * Код модуля встраивается обычным скриптом (без blob/import), чтобы мок
 * открывался и в превью, где динамические импорты запрещены.
 * Мок запускает НАСТОЯЩИЙ код модуля (scripts/paperdoll-app.js) поверх
 * мини-«Foundry» из tools/mock-runtime.js, так что он всегда совпадает с модулем.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import { actorData as demoActor, config, systemStrings, PROFILES, TEST_EFFECTS } from "./mock-data.mjs";
import { PLACEHOLDER_HASHES, NAME_RULES } from "./icon-fallbacks.mjs";
import { LOOT, COINS } from "./mock-loot.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]?.startsWith("--") ? true : arr[i + 1]]] : acc), [])
);

// ---------- Персонаж ----------
let actor = demoActor;
if (args.snapshot) actor = fromSnapshot(JSON.parse(fs.readFileSync(args.snapshot, "utf8")));
if (args.profile) {
  const pr = PROFILES[args.profile];
  if (!pr) throw new Error(`Нет профиля «${args.profile}». Есть: ${Object.keys(PROFILES).join(", ")}`);
  actor = {
    ...actor,
    skills: pr.skills,
    talents: pr.talents,
    system: { ...actor.system, details: { ...actor.system.details, god: { value: pr.god } } }
  };
}
if ("effects" in args) {
  actor = {
    ...actor,
    effects: [...(actor.effects ?? []), ...structuredClone(TEST_EFFECTS.effects)],
    items: [...actor.items, ...structuredClone(TEST_EFFECTS.items)]
  };
}
if ("loot" in args) {
  // Эмодзи-заглушка на случай сборки без папок с иконками
  const GLYPH = { weapon: ["⚔️", "#5a6a7a"], armour: ["🛡️", "#6a5a4a"], trapping: ["💍", "#5a4a6a"], container: ["🎒", "#6a5530"] };
  const loot = structuredClone(LOOT).map((i) => ({ ...i, img: emojiIcon(...(GLYPH[i.type] ?? GLYPH.trapping)) }));
  actor = { ...actor, items: [...actor.items, ...loot] };
}
// Деньги: если в слепке их нет, кладём тестовый кошелёк
if (!actor.items.some((i) => i.type === "money")) actor = { ...actor, items: [...actor.items, ...structuredClone(COINS)] };
function emojiIcon(glyph, color) {
  return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0d0b09"/></radialGradient></defs><rect width="64" height="64" fill="url(#g)"/><text x="32" y="44" font-size="34" text-anchor="middle">${glyph}</text></svg>`);
}

// ---------- Иконки ----------
const CAREER_SLUG = { "флагеллант": "flagellant", "flagellant": "flagellant", "маг": "wizard", "жрец": "priest", "дуэлянт": "duellist" };
const ROOTS = { icons: args.icons, core: args["icons-core"], sys: args["icons-system"] };
const iconStats = { path: 0, rule: 0, placeholder: 0, emoji: 0 };
if (ROOTS.icons || ROOTS.core) {
  actor = { ...actor, items: actor.items.map((i) => ({ ...i, img: resolveIcon(i) })) };
  actor.effects = (actor.effects ?? []).map((e) => ({ ...e, img: (e._icon && fileFor(e._icon) && dataUri(fileFor(e._icon))) || e.img }));
  // Иконка карьеры: путь из слепка или icons/careers/<карьера>-0<уровень>.png
  const c = actor.career ?? {};
  const slug = CAREER_SLUG[(c.name ?? "").toLowerCase()] ?? (c.name ?? "").toLowerCase().replace(/[^a-z]+/g, "-");
  const ref = c.img?.startsWith("modules/wfrp4e-core/icons/")
    ? `icons:${c.img.slice("modules/wfrp4e-core/icons/".length)}`
    : `icons:careers/${slug}-0${Math.min(4, Math.max(1, c.level ?? 1))}.png`;
  const f = fileFor(ref);
  if (f) actor = { ...actor, career: { ...c, img: dataUri(f) } };
}

function fileFor(ref) {
  const [root, rel] = ref.split(":");
  const dir = ROOTS[root];
  if (!dir) return null;
  const f = path.join(dir, rel);
  return fs.existsSync(f) ? f : null;
}
function isPlaceholder(f) {
  return PLACEHOLDER_HASHES.has(crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex"));
}
function dataUri(f) {
  const ext = path.extname(f).slice(1).toLowerCase();
  const mime = { png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml" }[ext] ?? "image/png";
  return `data:${mime};base64,${fs.readFileSync(f).toString("base64")}`;
}
function resolveIcon(item) {
  // 0. Иконка, заданная явно (тестовый лут)
  if (item._icon) {
    const f = fileFor(item._icon);
    if (f) return iconStats.rule++, dataUri(f);
  }
  // 1. Путь из самого предмета
  const src = item._srcImg ?? "";
  let ref = null;
  if (src.startsWith("modules/wfrp4e-core/icons/")) ref = `icons:${src.slice("modules/wfrp4e-core/icons/".length)}`;
  else if (src.startsWith("icons/")) ref = `core:${src.slice("icons/".length)}`;
  const direct = ref && fileFor(ref);
  let placeholder = null;
  if (direct) {
    if (!isPlaceholder(direct)) return iconStats.path++, dataUri(direct);
    placeholder = direct;
  }
  // 2. Правила по названию: сначала wfrp4e-core, потом Foundry
  for (const [re, refs] of NAME_RULES) {
    if (!re.test(item.name)) continue;
    const sorted = [...refs.filter((r) => r.startsWith("icons:")), ...refs.filter((r) => r.startsWith("core:"))];
    for (const r of sorted) {
      const f = fileFor(r);
      if (f && !isPlaceholder(f)) return iconStats.rule++, dataUri(f);
    }
  }
  // 3. Заглушка wfrp4e-core или эмодзи
  if (placeholder) return iconStats.placeholder++, dataUri(placeholder);
  iconStats.emoji++;
  return item.img;
}

// ---------- Своя графика модуля (assets) ----------
// Картинки интерфейса и свои иконки предметов встраиваем как data URI:
// модуль берёт их через asset(), в моке asset() смотрит в window.__PD_ASSETS__.
const ASSETS = {};
const assetUri = (rel) => (ASSETS[rel] ??= dataUri(path.join(root, "assets", rel)));
for (const f of fs.readdirSync(path.join(root, "assets/ui"))) assetUri(`ui/${f}`);
const OVERRIDES = new Set();
(function walk(d, pre = "") {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(d, e.name), `${pre}${e.name}/`);
    else OVERRIDES.add(pre + e.name);
  }
})(path.join(root, "assets/icons"));
const overrideFor = (rel) => {
  if (!rel) return null;
  if (OVERRIDES.has(rel)) return rel;
  const base = rel.replace(/(-(fine|flaw)(-?\d+)?|\d+)(\.\w+)$/, "$4");
  return base !== rel && OVERRIDES.has(base) ? base : null;
};
let ownIcons = 0;
const withOwnIcon = (i) => {
  const src = i._srcImg?.startsWith("modules/wfrp4e-core/icons/")
    ? i._srcImg.slice("modules/wfrp4e-core/icons/".length)
    : i._icon?.startsWith("icons:") ? i._icon.slice(6) : null;
  const rel = overrideFor(src);
  if (!rel) return i;
  assetUri(`icons/${rel}`);
  ownIcons++;
  // Путь как в Foundry: модуль сам подменит его своей иконкой (itemImg)
  return { ...i, img: `modules/wfrp4e-core/icons/${src}` };
};
actor = { ...actor, items: actor.items.map(withOwnIcon) };

if (!(ROOTS.icons || ROOTS.core)) {
  const G = { injury: ["🦴", "#7a4a2a"], critical: ["🩸", "#7a1a1a"], disease: ["🤢", "#3a5a2a"] };
  actor = {
    ...actor,
    effects: (actor.effects ?? []).map((e) => ({ ...e, img: e.img ?? emojiIcon(e.statuses?.length ? "🩸" : "☠️", "#5a1a3a") })),
    items: actor.items.map((i) => (G[i.type] && !i.img ? { ...i, img: emojiIcon(...G[i.type]) } : i))
  };
}
// ---------- Сборка ----------
const require = createRequire(import.meta.url);
const handlebars = fs.readFileSync(require.resolve("handlebars/dist/handlebars.min.js"), "utf8");
const lang = JSON.parse(read("lang/ru.json"));
const css = read("styles/paperdoll.css").replace(/url\("\.\.\/assets\/([^"]+)"\)/g, (m, rel) => `url("${assetUri(rel)}")`);
const appSrc = read("scripts/icon-index.js") + "\n" + read("scripts/paperdoll-app.js").replace(/^import .*$/gm, "");
const template = read("templates/paperdoll.hbs");
const runtime = read("tools/mock-runtime.js");
const tplPath = "modules/wfrp4e-paperdoll/templates/paperdoll.hbs";
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Paperdoll Mock</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<style>
  html, body { margin: 0; background: #2f3237; font-family: "Signika", "Segoe UI", system-ui, sans-serif; }
  body { padding: 20px; }
  .mock-note { color: #cfcfcf; font-size: 13px; margin: 0 0 12px; max-width: 960px; line-height: 1.4; }
  #mock-reopen { margin-bottom: 12px; }
  .mock-gm { display: inline-flex; gap: 6px; align-items: center; color: #cfcfcf; font-size: 13px; margin: 0 0 12px; cursor: pointer; }
  .app.window-app { max-width: 100%; display: flex; flex-direction: column; border-radius: 6px; overflow: hidden;
    box-shadow: 0 10px 40px rgba(0,0,0,.6); border: 1px solid #000; }
  .window-header { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 8px 0 12px; background: #0b0a09;
    color: #e8dcc4; font-size: 14px; border-bottom: 1px solid #4a4339; flex: 0 0 auto; }
  .window-header .window-title { flex: 1; }
  .window-header .header-control { background: none; border: none; color: #e8dcc4; cursor: pointer; font-size: 14px; }
  .window-content { flex: 1; min-height: 0; }
  .mock-toast { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); padding: 8px 14px; border-radius: 4px;
    font-size: 13px; z-index: 20000; color: #fff; background: #6a1c14; box-shadow: 0 4px 12px rgba(0,0,0,.5); }
  .mock-toast--info { background: #2b3a55; }
  @media (max-width: 760px) {
    body { padding: 8px; }
    .app.window-app { height: auto !important; }
    .wfrp-paperdoll .pd-root { grid-template-columns: 1fr; }
    .wfrp-paperdoll .pd-side { min-height: 360px; border-left: none; border-top: 1px solid #4a4339; }
  }
${css}
</style>
</head>
<body>
<p class="mock-note">Мок окна модуля: работает настоящий код модуля поверх заглушки Foundry. ${ROOTS.icons || ROOTS.core ? "Иконки из wfrp4e-core и стандартного набора Foundry." : "Иконки предметов пока эмодзи."}
Наведи на слот - справа стрелочка быстрой смены. Перетаскивание, двойной клик, вкладка «Характеристики» и выпадашки статов тоже работают.</p>
<label class="mock-gm"><input type="checkbox" id="mock-gm"> Смотреть как ГМ (видна цена предметов)</label>
<label class="mock-gm"><input type="checkbox" id="mock-theme"> Тема «Пергамент»</label>
<button id="mock-reopen" hidden>Открыть окно снова</button>
<div id="mock-mount"></div>
<script>${handlebars}</script>
<script>
window.__PD_LANG__ = ${json(lang)};
window.__PD_SYSTEM_STRINGS__ = ${json(systemStrings)};
window.__PD_CONFIG__ = ${json(config)};
window.__PD_TEMPLATES__ = ${json({ [tplPath]: template })};
window.__PD_ASSETS__ = ${json(ASSETS)};
</script>
<script>${runtime}</script>
<script>
(() => {
${appSrc.replace(/^export /gm, "").replace(/<\/script/gi, "<\\/script")}
window.PaperdollApp = PaperdollApp;
})();
</script>
<script>
const PaperdollApp = window.PaperdollApp;
const actor = window.__PD_makeActor__(${json(actor)});
const open = () => { document.getElementById("mock-reopen").hidden = true; PaperdollApp.openFor(actor); };
document.getElementById("mock-reopen").addEventListener("click", open);
document.getElementById("mock-gm").addEventListener("change", (ev) => { game.user.isGM = ev.target.checked; });
document.getElementById("mock-theme").addEventListener("change", (ev) => game.settings.set("wfrp4e-paperdoll", "theme", ev.target.checked ? "parchment" : "dark"));
open();
</script>
</body>
</html>
`;

const out = path.resolve(args.out ?? path.join(root, "docs/paperdoll-mock.html"));
fs.writeFileSync(out, html);
console.log(`Мок собран: ${out} (${(html.length / 1024).toFixed(0)} КБ), персонаж: ${actor.name}, своих иконок: ${ownIcons}`);
if (ROOTS.icons || ROOTS.core)
  console.log(`Иконки: по пути предмета ${iconStats.path}, по названию ${iconStats.rule}, заглушки ${iconStats.placeholder}, эмодзи ${iconStats.emoji}`);

/* ---------- Слепок из Foundry -> данные мока ---------- */

function fromSnapshot(snap) {
  const QUAL = {
    distract: "Отвлекающее", wrap: "Обвивающее", undamaging: "Неразящее", unbalanced: "Несбалансированное",
    defensive: "Защитное", fast: "Быстрое", impact: "Ударное", penetrating: "Пробивающее", flexible: "Гибкое",
    durable: "Прочное", shield: "Щит", slow: "Медленное", tiring: "Изнуряющее", dangerous: "Опасное", partial: "Частичное"
  };
  const ICON = {
    weapon: ["🗡️", "#5a6a7a"], armour: ["🛡️", "#6a5a4a"], container: ["🎒", "#6a5530"],
    clothingAccessories: ["🧥", "#5a4a6a"], booksAndDocuments: ["📖", "#6a3a2a"], foodAndDrink: ["🍞", "#7a6030"],
    drugsPoisonsHerbsDraughts: ["🧪", "#3a6a4a"], ingredient: ["🌿", "#3a6a3a"], ammunition: ["🌱", "#3a5a3a"], misc: ["📦", "#5a5040"]
  };
  const BY_NAME = [
    [/flail|цеп/i, "⛓️"], [/club|дубин/i, "🏏"], [/cloak|плащ/i, "🧣"], [/glove|перчат/i, "🧤"], [/robe|ряс/i, "👘"],
    [/boot|сапог/i, "🥾"], [/coif|капюш/i, "🪖"], [/shirt|рубах/i, "👕"], [/ring|кольц/i, "💍"], [/onyx|оникс/i, "💎"],
    [/rope|верёв|верев/i, "🪢"], [/blanket|одеял/i, "🛏️"], [/tinder|огнив/i, "🔥"], [/ремень|belt/i, "🪢"], [/платок/i, "🧻"],
    [/свиток|scroll/i, "📜"], [/backpack|рюкзак/i, "🎒"], [/pouch|кошел/i, "👛"], [/сумк|bag/i, "👜"], [/clothes|clothing|одежд/i, "👔"]
  ];
  const iconData = (glyph, color) =>
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0d0b09"/></radialGradient></defs><rect width="64" height="64" fill="url(#g)"/><text x="32" y="44" font-size="34" text-anchor="middle">${glyph}</text></svg>`);
  const props = (list) =>
    (list ?? []).map((p) => `${QUAL[p.name] ?? p.name}${p.value ? ` ${p.value}` : ""}`);

  const items = snap.items.map((i) => {
    const kind = i.type === "trapping" ? i.system.trappingType?.value || "misc" : i.type;
    const [glyph0, color] = ICON[kind] ?? ICON.misc;
    const glyph = BY_NAME.find(([re]) => re.test(i.name))?.[1] ?? glyph0;
    const sys = structuredClone(i.system);
    sys._qualities = props(sys.qualities?.value);
    sys._flaws = props(sys.flaws?.value);
    sys.encumbrance ??= { value: 0 };
    if (!sys.availability?.value) sys.availability = { value: "None" };
    return { id: i.id, name: i.name, type: i.type, img: iconData(glyph, color), _srcImg: i.img, system: sys };
  });

  const chars = Object.fromEntries(Object.entries(snap.characteristics).map(([k, c]) => [k, { ...c }]));
  return {
    id: "snapshot",
    name: snap.name,
    img: demoActor.img,
    career: { name: snap.career?.name ?? "", level: snap.career?.level, img: snap.career?.img, class: snap.career?.class },
    skills: snap.skills ?? [],
    effects: (snap.effects ?? []).map((e) => ({ ...e, _icon: e.img?.startsWith("systems/wfrp4e/icons/") ? `sys:${e.img.slice("systems/wfrp4e/icons/".length)}` : e.img?.startsWith("icons/") ? `core:${e.img.slice(6)}` : null })),
    talents: (snap.talents ?? []).map((t) => (typeof t === "string" ? { name: t } : t)),
    spells: snap.spells ?? [],
    system: {
      characteristics: chars,
      status: {
        wounds: snap.wounds, criticalWounds: snap.crits, advantage: snap.advantage,
        fate: snap.fate, fortune: snap.fortune, resilience: snap.resilience, resolve: snap.resolve,
        corruption: snap.corruption, sin: snap.sin, encumbrance: { current: 0, max: 0 }
      },
      details: {
        species: { value: snap.species }, status: { value: snap.status }, god: { value: snap.god ?? "" },
        move: snap.move, experience: snap.experience
      },
      settings: { equipPoints: 2 }
    },
    items
  };
}
