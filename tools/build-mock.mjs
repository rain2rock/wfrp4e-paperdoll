/**
 * Сборка интерактивного мока: docs/paperdoll-mock.html
 *
 *   npm install            (один раз, ставит handlebars)
 *   npm run mock           демо-персонаж из tools/mock-data.mjs
 *   node tools/build-mock.mjs --snapshot tools/snapshot.json --out mock-hugo.html
 *                          персонаж из слепка, снятого скриптом из консоли Foundry
 *
 * Мок запускает НАСТОЯЩИЙ код модуля (scripts/paperdoll-app.js) поверх
 * мини-«Foundry» из tools/mock-runtime.js, так что он всегда совпадает с модулем.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { actorData as demoActor, config, systemStrings } from "./mock-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);

// ---------- Персонаж ----------
let actor = demoActor;
if (args.snapshot) actor = fromSnapshot(JSON.parse(fs.readFileSync(args.snapshot, "utf8")));

// ---------- Сборка ----------
const require = createRequire(import.meta.url);
const handlebars = fs.readFileSync(require.resolve("handlebars/dist/handlebars.min.js"), "utf8");
const lang = JSON.parse(read("lang/ru.json"));
const css = read("styles/paperdoll.css");
const appSrc = read("scripts/paperdoll-app.js");
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
<p class="mock-note">Мок окна модуля: работает настоящий код модуля поверх заглушки Foundry. Иконки предметов пока эмодзи.
Наведи на слот - справа стрелочка быстрой смены. Перетаскивание, двойной клик, вкладка «Характеристики» и выпадашки статов тоже работают.</p>
<button id="mock-reopen" hidden>Открыть окно снова</button>
<div id="mock-mount"></div>
<script>${handlebars}</script>
<script>
window.__PD_LANG__ = ${json(lang)};
window.__PD_SYSTEM_STRINGS__ = ${json(systemStrings)};
window.__PD_CONFIG__ = ${json(config)};
window.__PD_TEMPLATES__ = ${json({ [tplPath]: template })};
</script>
<script>${runtime}</script>
<script type="module">
const src = ${json(appSrc)};
const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
const { PaperdollApp } = await import(url);
const actor = window.__PD_makeActor__(${json(actor)});
const open = () => { document.getElementById("mock-reopen").hidden = true; PaperdollApp.openFor(actor); };
document.getElementById("mock-reopen").addEventListener("click", open);
open();
window.__PD_APP__ = PaperdollApp;
</script>
</body>
</html>
`;

const out = path.resolve(args.out ?? path.join(root, "docs/paperdoll-mock.html"));
fs.writeFileSync(out, html);
console.log(`Мок собран: ${out} (${(html.length / 1024).toFixed(0)} КБ), персонаж: ${actor.name}`);

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
    return { id: i.id, name: i.name, type: i.type, img: iconData(glyph, color), system: sys };
  });

  const chars = Object.fromEntries(Object.entries(snap.characteristics).map(([k, c]) => [k, { ...c }]));
  return {
    id: "snapshot",
    name: snap.name,
    img: demoActor.img,
    career: { name: snap.career?.name ?? "", level: snap.career?.level },
    system: {
      characteristics: chars,
      status: {
        wounds: snap.wounds, criticalWounds: snap.crits, advantage: snap.advantage,
        fate: snap.fate, fortune: snap.fortune, resilience: snap.resilience, resolve: snap.resolve,
        corruption: snap.corruption, sin: snap.sin, encumbrance: { current: 0, max: 0 }
      },
      details: {
        species: { value: snap.species }, status: { value: snap.status },
        move: snap.move, experience: snap.experience
      },
      settings: { equipPoints: 2 }
    },
    items
  };
}
