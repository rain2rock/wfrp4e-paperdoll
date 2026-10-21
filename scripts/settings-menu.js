/**
 * Настройки модуля одним окном, по категориям (вкладки).
 * Отдельные настройки в списке Foundry скрыты (config: false) - всё меняется здесь.
 * Вкладка «Группа» (сундук) - только у ГМ: это настройки мира.
 */
import { MODULE_ID, PaperdollApp, ADDONS } from "./paperdoll-app.js";

const { ApplicationV2 } = foundry.applications.api;
const L = (k) => game.i18n.localize(k);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Категории ядра. Каждое установленное дополнение добавляет свою вкладку со своими настройками */
export const SETTINGS_LAYOUT = [
  // Главный выключатель - настройка мира, поэтому вкладка только у ГМ (см. settingsLayout)
  { id: "general", icon: "fa-power-off", keys: ["enabled"], gmOnly: true },
  { id: "display", icon: "fa-eye", keys: ["itemIcons", "detailedStats", "passiveBuffs", "effectDurations", "prices", "sounds"] },
  { id: "rules", icon: "fa-scale-balanced", keys: ["unarmed", "restButton"] },
  { id: "controls", icon: "fa-computer-mouse", keys: ["hotkey", "tokenDblClick", "rolls", "shiftCompare"] },
  { id: "translate", icon: "fa-language", keys: ["translateTerms", "translateText", "translateDescOnly"] }
];

/** Все категории: ядро + дополнения (вкладка дополнения - его название; настройки мира видит только ГМ) */
export function settingsLayout() {
  const addonCats = [...ADDONS.values()]
    .filter((a) => a.settings?.length)
    .map((a) => ({
      id: `addon-${a.id}`,
      icon: a.icon ?? "fa-puzzle-piece",
      label: a.title,
      intro: a.intro,
      keys: a.settings.filter((d) => d.scope !== "world" || game.user.isGM).map((d) => d.key),
      extra: a.settingsExtra
    }))
    .filter((c) => c.keys.length);
  const core = SETTINGS_LAYOUT.filter((c) => !c.gmOnly || game.user.isGM);
  return [...core, ...addonCats];
}

/** Описание настройки из дополнения (там могут быть свои поля, например actorSelect) */
const addonSetting = (key) => [...ADDONS.values()].flatMap((a) => a.settings ?? []).find((d) => d.key === key) ?? null;

export class PaperdollSettings extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "wfrp4e-paperdoll-settings",
    tag: "form",
    classes: ["wfrp-paperdoll-settings"],
    window: { title: "WFRPPD.SettingsMenu.Title", icon: "fa-solid fa-user-shield", contentClasses: ["standard-form"] },
    position: { width: 600, height: "auto" },
    form: { handler: PaperdollSettings.onSubmit, closeOnSubmit: true }
  };

  _tab = "display";

  get layout() {
    return settingsLayout();
  }

  /** Одна строка настройки: флажок, выпадашка или выбор персонажа */
  field(key) {
    const def = game.settings.settings.get(`${MODULE_ID}.${key}`);
    if (!def) return "";
    const value = game.settings.get(MODULE_ID, key);
    const name = L(def.name ?? key);
    const hint = def.hint ? `<p class="hint">${esc(L(def.hint))}</p>` : "";
    let input;
    const meta = addonSetting(key);
    if (meta?.actorSelect) {
      const opts = [`<option value="">${esc(L("WFRPPD.Stash.None"))}</option>`]
        .concat((game.actors ?? []).map((a) => `<option value="${a.id}" ${a.id === value ? "selected" : ""}>${esc(a.name)}</option>`))
        .join("");
      input = `<select name="${key}">${opts}</select>${meta.actorSelect.createLabel ? `<button type="button" class="pd-actor-create" data-key="${key}"><i class="fa-solid fa-plus"></i> ${esc(L(meta.actorSelect.createLabel))}</button>` : ""}`;
    } else if (def.choices) {
      input = `<select name="${key}">${Object.entries(def.choices)
        .map(([k, v]) => `<option value="${k}" ${k === value ? "selected" : ""}>${esc(L(v))}</option>`)
        .join("")}</select>`;
    } else if (def.type === Boolean) {
      input = `<input type="checkbox" name="${key}" ${value ? "checked" : ""}>`;
    } else {
      input = `<input type="text" name="${key}" value="${esc(value)}">`;
    }
    return `<div class="form-group"><label>${esc(name)}</label><div class="form-fields">${input}</div>${hint}</div>`;
  }

  async _renderHTML() {
    const cats = this.layout;
    const nav = cats
      .map((c) => `<a class="item ${c.id === this._tab ? "active" : ""}" data-pd-tab="${c.id}"><i class="fa-solid ${c.icon}"></i> ${esc(L(c.label ?? `WFRPPD.SettingsMenu.Tab.${c.id}`))}</a>`)
      .join("");
    const tabs = cats
      .map(
        (c) => `<section class="tab ${c.id === this._tab ? "active" : ""}" data-pd-tab="${c.id}">
          <p class="pd-set-intro">${esc(L(c.intro ?? `WFRPPD.SettingsMenu.Intro.${c.id}`))}</p>
          ${c.keys.map((k) => this.field(k)).join("")}
        </section>`
      )
      .join("");
    return `<nav class="sheet-tabs tabs pd-set-tabs">${nav}</nav><div class="pd-set-body">${tabs}</div>
      <footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> ${esc(L("WFRPPD.SettingsMenu.Save"))}</button></footer>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender() {
    const root = this.element;
    for (const a of root.querySelectorAll(".pd-set-tabs [data-pd-tab]")) {
      a.addEventListener("click", () => {
        this._tab = a.dataset.pdTab;
        for (const el of root.querySelectorAll("[data-pd-tab]")) el.classList.toggle("active", el.dataset.pdTab === this._tab);
        this.setPosition({ height: "auto" });
      });
    }
    // «Создать» у выбора персонажа (например, сундук группы): создаёт и сразу выбирает
    for (const btn of root.querySelectorAll(".pd-actor-create")) {
      btn.addEventListener("click", async () => {
        const actor = await addonSetting(btn.dataset.key)?.actorSelect?.create?.();
        if (actor) this.render();
      });
    }
  }

  static async onSubmit(event, form, formData) {
    const data = formData.object;
    for (const cat of settingsLayout()) {
      for (const key of cat.keys) {
        const def = game.settings.settings.get(`${MODULE_ID}.${key}`);
        if (!def) continue;
        const value = def.type === Boolean ? !!data[key] : (data[key] ?? def.default);
        if (game.settings.get(MODULE_ID, key) !== value) await game.settings.set(MODULE_ID, key, value);
      }
    }
    PaperdollApp.renderAll?.();
  }
}
