const hooks = {};
class AppV2 { constructor() { this.options = this.constructor.DEFAULT_OPTIONS; } }
globalThis.foundry = { applications: { api: { ApplicationV2: AppV2, HandlebarsApplicationMixin: (B) => class extends B {}, DialogV2: null }, ux: { TextEditor: { implementation: {} } } }, utils: {} };
globalThis.Hooks = { on: (n, f) => ((hooks[n] ??= []).push(f)), once: (n, f) => ((hooks[n] ??= []).push(f)), call() {}, callAll() {} };
const settings = new Map(); const values = {};
globalThis.game = {
  i18n: { localize: (k) => k, format: (k) => k, lang: "ru", has: () => false },
  settings: { register: (m, k, d) => { settings.set(`${m}.${k}`, d); values[k] = d.default; }, registerMenu: (m, k, d) => (globalThis.__menu = d), get: (m, k) => values[k], set: async (m, k, v) => (values[k] = v), settings },
  keybindings: { register() {} }, modules: new Map([["wfrp4e-paperdoll", {}]]), system: { id: "wfrp4e" }, user: { isGM: true }, actors: []
};
globalThis.CONST = { KEYBINDING_PRECEDENCE: { NORMAL: 0 }, DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };
globalThis.CONFIG = { Token: { objectClass: { prototype: {} } } };
await import(new URL("../../scripts/main.js", import.meta.url).href);
for (const f of hooks.init ?? []) f();
console.log("settings", settings.size, "menu", !!globalThis.__menu, "dropCanvas hook", !!hooks.dropCanvasData);
const { PaperdollSettings } = await import(new URL("../../scripts/settings-menu.js", import.meta.url).href);
const app = new PaperdollSettings();
const html = await app._renderHTML();
console.log("tabs", (html.match(/data-pd-tab=/g) || []).length, "inputs", (html.match(/name="/g) || []).length);
const missing = [];
for (const c of (await import(new URL("../../scripts/settings-menu.js", import.meta.url).href)).SETTINGS_LAYOUT) for (const k of c.keys) if (!settings.has(`wfrp4e-paperdoll.${k}`)) missing.push(k);
console.log("missing settings", missing);
