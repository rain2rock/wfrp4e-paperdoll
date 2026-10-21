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
 *   --blank                чистый персонаж: скромное снаряжение без перевеса и пара сумок
 *   --cast                 добавить в мок переключатель тестовых персонажей (наёмник, маг)
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
import { actorData as demoActor, blankActor, CAST, config, systemStrings, PROFILES, TEST_EFFECTS, MOCK_TOKENS } from "./mock-data.mjs";
import { PLACEHOLDER_HASHES, NAME_RULES } from "./icon-fallbacks.mjs";
import { LOOT, COINS } from "./mock-loot.mjs";
import { ownIconFor, talentSlug } from "../scripts/icon-rules.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]?.startsWith("--") ? true : arr[i + 1]]] : acc), [])
);

// ---------- Персонаж ----------
let actor = "blank" in args ? structuredClone(blankActor) : demoActor;
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
function emojiIcon(glyph, color) {
  return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0d0b09"/></radialGradient></defs><rect width="64" height="64" fill="url(#g)"/><text x="32" y="44" font-size="34" text-anchor="middle">${glyph}</text></svg>`);
}

// ---------- Иконки ----------
const CAREER_SLUG = { "флагеллант": "flagellant", "flagellant": "flagellant", "маг": "wizard", "наёмник": "soldier", "наемник": "soldier", "жрец": "priest", "дуэлянт": "duellist" };
const ROOTS = { icons: args.icons, core: args["icons-core"], sys: args["icons-system"] };
const iconStats = { path: 0, rule: 0, placeholder: 0, emoji: 0 };
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

let ownIcons = 0;
const withOwnIcon = (i) => {
  const src = i._srcImg?.startsWith("modules/wfrp4e-core/icons/")
    ? i._srcImg.slice("modules/wfrp4e-core/icons/".length)
    : i._icon?.startsWith("icons:") ? i._icon.slice(6) : null;
  const rel = src && ownIconFor(src, i.name, OVERRIDES);
  if (!rel) return i;
  assetUri(`icons/${rel}`);
  ownIcons++;
  // Путь как в Foundry: модуль сам подменит его своей иконкой (itemImg)
  return { ...i, img: `modules/wfrp4e-core/icons/${src}` };
};

/**
 * Довести персонажа до мока: кошелёк, иконки из папок, свои иконки модуля, эмодзи-заглушки.
 * Для основного персонажа и для каждого из --cast.
 */
function finishActor(actor) {
  // Деньги: если их нет, кладём тестовый кошелёк
  if (!actor.items.some((i) => i.type === "money")) actor = { ...actor, items: [...actor.items, ...structuredClone(COINS)] };
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
  actor = { ...actor, items: actor.items.map(withOwnIcon) };
  // Таланты: путь иконки как в wfrp4e-core, свою иконку модуль подставит сам
  actor = {
    ...actor,
    talents: (actor.talents ?? []).map((t) => {
      const name = t.name ?? t;
      const rel = `talents/${talentSlug(name)}.png`;
      if (!OVERRIDES.has(rel)) return t;
      assetUri(`icons/${rel}`);
      return { ...(typeof t === "string" ? { name } : t), img: `modules/wfrp4e-core/icons/${rel}` };
    })
  };
  // Таланты ступеней карьеры (меню покупки «Развития») - ещё не куплены, своей картинки у них нет вообще,
  // модуль подберёт иконку по названию сам (talentImg) - ей только нужно попасть в __PD_ASSETS__ заранее
  for (const name of (actor.careers ?? []).flatMap((c) => c.talents ?? [])) {
    const rel = `talents/${talentSlug(name)}.png`;
    if (OVERRIDES.has(rel)) assetUri(`icons/${rel}`);
  }
  if (!(ROOTS.icons || ROOTS.core)) {
    const G = { injury: ["🦴", "#7a4a2a"], critical: ["🩸", "#7a1a1a"], disease: ["🤢", "#3a5a2a"], money: ["🪙", "#6a5a20"] };
    actor = {
      ...actor,
      effects: (actor.effects ?? []).map((e) => ({ ...e, img: e.img ?? emojiIcon(e.statuses?.length ? "🩸" : "☠️", "#5a1a3a") })),
      items: actor.items.map((i) => (G[i.type] && !i.img ? { ...i, img: emojiIcon(...G[i.type]) } : i))
    };
  }
  return actor;
}
actor = finishActor(actor);
const cast = "cast" in args ? CAST.map((a) => finishActor(structuredClone(a))) : [];

// ---------- Сборка ----------
const require = createRequire(import.meta.url);
const handlebars = fs.readFileSync(require.resolve("handlebars/dist/handlebars.min.js"), "utf8");
// Дополнения из addons/<id>: по умолчанию все, --addons none - только ядро, --addons magic,party - выбранные
const ADDON_DIR = path.join(root, "addons");
const addonIds = fs.existsSync(ADDON_DIR) ? fs.readdirSync(ADDON_DIR).filter((d) => fs.existsSync(path.join(ADDON_DIR, d, "module.json"))).sort() : [];
const wantAddons = args.addons === "none" ? [] : args.addons && args.addons !== true && args.addons !== "all" ? String(args.addons).split(",") : addonIds;
const activeAddons = addonIds.filter((id) => wantAddons.includes(id));
const deepMerge = (a, b) => {
  for (const [k, v] of Object.entries(b ?? {})) a[k] = v && typeof v === "object" && !Array.isArray(v) ? deepMerge(a[k] ?? {}, v) : v;
  return a;
};
const lang = JSON.parse(read("lang/ru.json"));
for (const id of activeAddons) {
  const f = path.join(ADDON_DIR, id, "lang/ru.json");
  if (fs.existsSync(f)) deepMerge(lang, JSON.parse(fs.readFileSync(f, "utf8")));
}
const addonFiles = (id, sub, ext) => {
  const d = path.join(ADDON_DIR, id, sub);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(ext)).sort().map((f) => fs.readFileSync(path.join(d, f), "utf8")) : [];
};
const css = [read("styles/paperdoll.css"), ...activeAddons.flatMap((id) => addonFiles(id, "styles", ".css"))]
  .join("\n")
  .replace(/url\("(?:\.\.\/)+(?:wfrp4e-paperdoll\/)?assets\/([^"]+)"\)/g, (m, rel) => `url("${assetUri(rel)}")`)
  .replace(/url\("\.\.\/assets\/([^"]+)"\)/g, (m, rel) => `url("${assetUri(rel)}")`);
const addonSrc = activeAddons.flatMap((id) => addonFiles(id, "scripts", ".js")).join("\n");
const appSrc = [read("scripts/icon-index.js"), read("scripts/icon-rules.js").replace(/^export /gm, ""), read("scripts/glossary-ru.js").replace(/^export /gm, ""), read("scripts/translate.js").replace(/^export /gm, ""), read("scripts/paperdoll-app.js").replace(/^import .*$/gm, "")].join("\n");
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
Клик по слоту открывает список быстрой смены. Перетаскивание, двойной клик, вкладка «Характеристики» и выпадашки статов тоже работают.</p>
<label class="mock-gm"><input type="checkbox" id="mock-gm"> Смотреть как ГМ (видна цена предметов)</label>
${cast.length ? `<label class="mock-gm">Персонаж: <select id="mock-cast">${[actor, ...cast].map((a, i) => `<option value="${i}">${a.name}</option>`).join("")}</select></label>` : ""}
<button id="mock-group" class="mock-gm" type="button">Окно группы (ГМ)</button>
<a class="mock-gm" href="paperdoll-mock-settings.html" target="_blank">Окно настроек →</a>
<button id="mock-reopen" hidden>Открыть окно снова</button>
<div id="mock-mount"></div>
<script>${handlebars}</script>
<script>
window.__PD_LANG__ = ${json(lang)};
window.__PD_SYSTEM_STRINGS__ = ${json(systemStrings)};
window.__PD_CONFIG__ = ${json(config)};
window.__PD_TEMPLATES__ = ${json({ [tplPath]: template })};
window.__PD_ASSETS__ = ${json(ASSETS)};
window.__PD_TOKENS__ = ${json(cast.length ? MOCK_TOKENS : [])};
</script>
<script>${runtime}</script>
<script>
(() => {
${appSrc.replace(/^export /gm, "").replace(/<\/script/gi, "<\\/script")}
window.PaperdollApp = PaperdollApp;
globalThis.__PD_MOCK__ = true;
globalThis.__PD_API__ = PD_API;
${addonSrc.replace(/^export /gm, "").replace(/<\/script/gi, "<\\/script")}
})();
</script>
<script>
const PaperdollApp = window.PaperdollApp;
const actors = ${json([actor, ...cast])}.map((a) => window.__PD_makeActor__(a));
let actor = actors[0];
const open = () => { document.getElementById("mock-reopen").hidden = true; PaperdollApp.openFor(actor); };
document.getElementById("mock-cast")?.addEventListener("change", async (ev) => {
  for (const app of [...PaperdollApp.instances.values()]) await app.close();
  actor = actors[Number(ev.target.value)];
  open();
});
document.getElementById("mock-reopen").addEventListener("click", open);
document.getElementById("mock-gm").addEventListener("change", (ev) => { game.user.isGM = ev.target.checked; });
document.getElementById("mock-group").addEventListener("click", () => window.__PD_API__?.openGroup?.());
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

/* ---------- Окно настроек: отдельная страница (docs/paperdoll-mock-settings.html) ---------- */
{
  const settingsSrc = read("scripts/settings-menu.js")
    .replace(/^import .*$/gm, "")
    .replace(/^export /gm, "")
    // ApplicationV2, esc, L - уже объявлены в appSrc (paperdoll-app.js): то же самое, но при склейке
    // в одну область видимости это «Identifier has already been declared» и мок настроек не грузится
    .replace(/^const \{ ApplicationV2 \} = foundry\.applications\.api;$/m, "")
    .replace(/^const L = \(\w+\) => game\.i18n\.localize\(\w+\);$/m, "")
    .replace(/^const esc = \(s\) => String\(s \?\? ""\)\.replace\(\/\[&<>"\]\/g, \(c\) => \(\{ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" \}\)\[c\]\);$/m, "");
  // Регистрация настроек ядра - как в scripts/main.js (хук init), без хоткея и патча токена: тут не нужны
  const coreSettings = `
    game.settings.register(MODULE_ID, "itemIcons", {
      name: "WFRPPD.Settings.ItemIcons.Name", hint: "WFRPPD.Settings.ItemIcons.Hint",
      scope: "client", config: false, type: Boolean, default: true
    });
    for (const [key, def] of Object.entries(PD_OPTIONS)) {
      game.settings.register(MODULE_ID, key, {
        name: \`WFRPPD.Options.\${key}.Name\`, hint: \`WFRPPD.Options.\${key}.Hint\`,
        scope: "client", config: false, type: Boolean, default: def
      });
    }
    game.settings.register(MODULE_ID, "secondBar", { scope: "client", config: false, type: String, default: "fortune" });
    game.settings.register(MODULE_ID, "translateText", {
      name: "WFRPPD.Options.translateText.Name", hint: "WFRPPD.Options.translateText.Hint",
      scope: "client", config: false, type: String, default: "off",
      choices: { off: "WFRPPD.Options.translateText.off", chrome: "WFRPPD.Options.translateText.chrome", google: "WFRPPD.Options.translateText.google" }
    });
    game.settings.register(MODULE_ID, "translateDescOnly", {
      name: "WFRPPD.Options.translateDescOnly.Name", hint: "WFRPPD.Options.translateDescOnly.Hint",
      scope: "client", config: false, type: Boolean, default: false
    });
  `;
  const settingsHtml = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Paperdoll Mock - настройки</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<style>
  html, body { margin: 0; background: #2f3237; font-family: "Signika", "Segoe UI", system-ui, sans-serif; color: #e8dcc4; }
  body { padding: 20px; }
  .mock-note { color: #cfcfcf; font-size: 13px; margin: 0 0 12px; max-width: 760px; line-height: 1.4; }
  .app.window-app { max-width: 100%; display: flex; flex-direction: column; border-radius: 6px; overflow: hidden;
    box-shadow: 0 10px 40px rgba(0,0,0,.6); border: 1px solid #000; }
  .window-header { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 8px 0 12px; background: #0b0a09;
    color: #e8dcc4; font-size: 14px; border-bottom: 1px solid #4a4339; flex: 0 0 auto; }
  .window-header .window-title { flex: 1; }
  .window-header .header-control { background: none; border: none; color: #e8dcc4; cursor: pointer; font-size: 14px; }
  .window-content { flex: 1; min-height: 0; padding: 12px 16px; overflow: auto; }
  .form-group { margin: 0 0 10px; }
  .form-group label { display: block; font-weight: 700; margin-bottom: 2px; }
  .form-group .hint { margin: 2px 0 0; font-size: 12px; opacity: .75; }
  .form-group select, .form-group input[type="text"] { width: 100%; max-width: 320px; padding: 3px 6px; }
  .form-footer { margin-top: 12px; padding-top: 10px; border-top: 1px solid #4a4339; }
  .form-footer button { padding: 5px 12px; cursor: pointer; }
  .pd-actor-create { margin-left: 6px; }
${css}
</style>
</head>
<body>
<p class="mock-note">Мок окна настроек: тот же настоящий код модуля (scripts/settings-menu.js), вкладки ядра + по одной на каждое включённое дополнение.</p>
<div id="mock-mount"></div>
<script>${handlebars}</script>
<script>
window.__PD_LANG__ = ${json(lang)};
window.__PD_SYSTEM_STRINGS__ = ${json(systemStrings)};
window.__PD_CONFIG__ = ${json(config)};
window.__PD_TEMPLATES__ = ${json({})};
window.__PD_ASSETS__ = ${json({})};
</script>
<script>${runtime}</script>
<script>
(() => {
${appSrc.replace(/^export /gm, "").replace(/<\/script/gi, "<\\/script")}
${settingsSrc.replace(/<\/script/gi, "<\\/script")}
window.PaperdollApp = PaperdollApp;
window.PaperdollSettings = PaperdollSettings;
globalThis.__PD_MOCK__ = true;
globalThis.__PD_API__ = PD_API;
${coreSettings}
${addonSrc.replace(/^export /gm, "").replace(/<\/script/gi, "<\\/script")}
})();
</script>
<script>
game.user.isGM = true;
new PaperdollSettings().render();
</script>
</body>
</html>
`;
  const settingsOut = path.resolve(root, "docs/paperdoll-mock-settings.html");
  fs.writeFileSync(settingsOut, settingsHtml);
  console.log(`Настройки собраны: ${settingsOut} (${(settingsHtml.length / 1024).toFixed(0)} КБ)`);
}

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
