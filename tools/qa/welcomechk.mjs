/**
 * Приветствие в чат: показывается один раз на мир, только активному ГМ, только при включённом модуле.
 * Заглушка Foundry в моке не вызывает хук ready, поэтому исполняем тело хука из scripts/main.js
 * на её окружении - проверяем именно условия показа и текст.
 */
import { launch } from "./browser.mjs";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const src = fs.readFileSync(path.join(root, "scripts/main.js"), "utf8");
const body = src.slice(src.indexOf('Hooks.once("ready"'));
const fnBody = body.slice(body.indexOf("async () => {") + "async () => {".length, body.lastIndexOf("});"));

const b = await launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
await p.goto("file://" + path.join(root, process.argv[2] ?? "docs/paperdoll-mock.html"));
await p.waitForTimeout(1200);

const r = await p.evaluate(async (fn) => {
  const MODULE_ID = "wfrp4e-paperdoll";
  const isEnabled = () => game.settings.get(MODULE_ID, "enabled") !== false;
  window.__chat = [];
  const orig = ChatMessage.create;
  ChatMessage.create = (d) => { window.__chat.push(d); return orig?.(d); };
  game.system = { id: "wfrp4e" };
  game.users.activeGM = game.user;
  game.user.isGM = true;
  game.modules.get(MODULE_ID).version = "9.9.9";
  game.modules.get(MODULE_ID).api = { hasAddon: (id) => id === "party" };
  // Разные клавиши у разных действий: проверяем, что каждая строка берёт свою
  game.keybindings = { get: (ns, action) => [{ key: action === "openGroup" ? "KeyG" : "KeyI" }] };
  const run = new Function("MODULE_ID", "isEnabled", `return (async () => {${fn}})()`);
  const out = {};

  await run(MODULE_ID, isEnabled);
  out.firstPost = window.__chat.length;
  out.mark = game.settings.get(MODULE_ID, "welcomeShown");
  const text = (window.__chat[0]?.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  out.hasOpenKey = text.includes("«I»");
  out.hasGroupKey = text.includes("«G»");

  await run(MODULE_ID, isEnabled);
  out.afterRepeat = window.__chat.length;

  const reset = async () => { window.__chat.length = 0; await game.settings.set(MODULE_ID, "welcomeShown", ""); };
  await reset();
  await game.settings.set(MODULE_ID, "enabled", false);
  await run(MODULE_ID, isEnabled);
  out.whenDisabled = window.__chat.length;
  await game.settings.set(MODULE_ID, "enabled", true);

  await reset();
  game.user.isGM = false;
  await run(MODULE_ID, isEnabled);
  out.asPlayer = window.__chat.length;

  await reset();
  game.user.isGM = true;
  game.users.activeGM = { id: "another-gm" };
  await run(MODULE_ID, isEnabled);
  out.asSecondGM = window.__chat.length;
  return out;
}, fnBody);

const fail = [];
if (r.firstPost !== 1) fail.push(`первый запуск должен дать 1 сообщение, дал ${r.firstPost}`);
if (!r.mark) fail.push("отметка о показе не выставлена");
if (!r.hasOpenKey || !r.hasGroupKey) fail.push("клавиши в тексте не подставились");
if (r.afterRepeat !== 1) fail.push(`повторный запуск продублировал сообщение (${r.afterRepeat})`);
if (r.whenDisabled !== 0) fail.push("выключенный модуль прислал приветствие");
if (r.asPlayer !== 0) fail.push("игрок прислал приветствие");
if (r.asSecondGM !== 0) fail.push("неактивный ГМ продублировал приветствие");
console.log(fail.length ? "FAIL " + fail.join("; ") : "all pass (7 checks)", JSON.stringify(r), "errors:", errs);
await b.close();
process.exit(fail.length ? 1 : 0);
