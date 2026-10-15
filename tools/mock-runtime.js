/* ==========================================================
   Мини-«Foundry» для мока в браузере.
   Ровно столько API, сколько нужно настоящему коду модуля
   (scripts/paperdoll-app.js), чтобы он работал без Foundry.
   ========================================================== */
(() => {
  const LANG = window.__PD_LANG__;
  const SYS = window.__PD_SYSTEM_STRINGS__;

  const lookup = (key) => key.split(".").reduce((o, p) => (o == null ? undefined : o[p]), LANG);
  const i18n = {
    lang: "ru",
    has: (k) => typeof lookup(k) === "string" || k in SYS,
    localize: (k) => {
      const v = lookup(k);
      if (typeof v === "string") return v;
      return SYS[k] ?? k;
    },
    format: (k, data = {}) => i18n.localize(k).replace(/\{(\w+)\}/g, (_, x) => data[x] ?? "")
  };

  // --- Уведомления ---
  const toast = (msg, kind = "warn") => {
    const t = document.createElement("div");
    t.className = `mock-toast mock-toast--${kind}`;
    t.textContent = msg;
    document.body.append(t);
    setTimeout(() => t.remove(), 2400);
  };
  window.ui = { notifications: { warn: (m) => toast(m), error: (m) => toast(m), info: (m) => toast(m, "info") } };

  // --- Hooks ---
  const hooks = new Map();
  let hookId = 0;
  window.Hooks = {
    on(name, fn) {
      const id = ++hookId;
      if (!hooks.has(name)) hooks.set(name, new Map());
      hooks.get(name).set(id, fn);
      return id;
    },
    once(name, fn) {
      const id = this.on(name, (...a) => {
        this.off(name, id);
        fn(...a);
      });
      return id;
    },
    off(name, id) {
      hooks.get(name)?.delete(id);
    },
    call(name, ...args) {
      for (const fn of [...(hooks.get(name)?.values() ?? [])]) fn(...args);
    }
  };

  if (!Math.clamp) Math.clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // --- Handlebars ---
  Handlebars.registerHelper("localize", (k) => i18n.localize(k));
  const templates = {};
  for (const [path, src] of Object.entries(window.__PD_TEMPLATES__)) templates[path] = Handlebars.compile(src);

  // --- ApplicationV2 (минимум) ---
  class ApplicationV2 {
    constructor(options = {}) {
      const chain = [];
      let c = this.constructor;
      while (c && c !== Object && c !== Function.prototype) {
        if (Object.hasOwn(c, "DEFAULT_OPTIONS")) chain.unshift(c.DEFAULT_OPTIONS);
        c = Object.getPrototypeOf(c);
      }
      const merged = { actions: {}, window: {}, position: {}, classes: [] };
      for (const o of [...chain, options]) {
        Object.assign(merged.actions, o.actions ?? {});
        Object.assign(merged.window, o.window ?? {});
        Object.assign(merged.position, o.position ?? {});
        merged.classes.push(...(o.classes ?? []));
        if (o.id) merged.id = o.id;
      }
      this.options = merged;
      this.element = null;
      this.rendered = false;
    }

    get title() {
      return "";
    }

    async render() {
      const ctx = await this._prepareContext({});
      if (!this.element) this._buildFrame();
      const content = this.element.querySelector(".window-content");
      const scrollSel = Object.values(this.constructor.PARTS ?? {}).flatMap((p) => p.scrollable ?? []);
      const scroll = scrollSel.map((s) => [s, content.querySelector(s)?.scrollTop ?? 0]);
      const part = Object.values(this.constructor.PARTS)[0];
      content.innerHTML = templates[part.template](ctx);
      for (const [s, top] of scroll) {
        const el = content.querySelector(s);
        if (el) el.scrollTop = top;
      }
      this.element.querySelector(".window-title").textContent = this.title;
      this.rendered = true;
      await this._onRender(ctx, {});
      return this;
    }

    _buildFrame() {
      const el = document.createElement("div");
      el.className = ["app", "window-app", ...this.options.classes].join(" ");
      if (this.options.id) el.id = this.options.id;
      el.style.width = `${this.options.position.width}px`;
      el.style.height = `${this.options.position.height}px`;
      el.innerHTML = `
        <header class="window-header">
          <i class="window-icon ${this.options.window.icon ?? ""}"></i>
          <span class="window-title"></span>
          <button type="button" class="header-control" data-mock-close title="Закрыть"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <section class="window-content"></section>`;
      el.querySelector("[data-mock-close]").addEventListener("click", () => this.close());
      el.addEventListener("click", (ev) => {
        const target = ev.target.closest("[data-action]");
        if (!target || !el.contains(target)) return;
        const handler = this.options.actions[target.dataset.action];
        if (handler) handler.call(this, ev, target);
      });
      document.getElementById("mock-mount").append(el);
      this.element = el;
    }

    bringToFront() {}

    async close() {
      await this._onClose({});
      this.element?.remove();
      this.element = null;
      this.rendered = false;
      document.getElementById("mock-reopen").hidden = false;
    }

    async _prepareContext() {
      return {};
    }
    async _onRender() {}
    async _onClose() {}
  }

  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  window.foundry = {
    applications: {
      api: { ApplicationV2, HandlebarsApplicationMixin: (Base) => class extends Base {} },
      ux: {
        TextEditor: {
          implementation: {
            getDragEventData(ev) {
              try {
                return JSON.parse(ev.dataTransfer.getData("text/plain"));
              } catch (e) {
                return {};
              }
            }
          }
        }
      }
    },
    utils: { debounce }
  };

  /* ---------- Фейковые документы ---------- */

  const setPath = (obj, path, value) => {
    const parts = path.split(".");
    let o = obj;
    for (const p of parts.slice(0, -1)) o = o[p] ??= {};
    o[parts.at(-1)] = value;
  };
  const flatten = (obj, prefix = "", out = {}) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
      else out[key] = v;
    }
    return out;
  };

  const LOCS = ["head", "body", "rArm", "lArm", "rLeg", "lLeg"];

  function makeSystem(item, data) {
    const sys = structuredClone(data);
    const type = item.type;
    const getters = {
      isPhysical: { get: () => true },
      isEquippable: { get: () => ["armour", "weapon", "trapping", "container"].includes(type) },
      isEquipped: { get: () => !!sys.equipped?.value },
      canEquip: { get: () => type !== "trapping" || sys.trappingType?.value === "clothingAccessories" },
      Qualities: { get: () => sys._qualities ?? [] },
      Flaws: { get: () => sys._flaws ?? [] },
      properties: {
        get: () => ({ qualities: Object.fromEntries((sys._qualities ?? []).map((q) => [q.split(" ")[0].toLowerCase() === "щит" ? "shield" : q, true])) })
      }
    };
    if (type === "armour") {
      getters.protects = { get: () => Object.fromEntries(LOCS.map((l) => [l, (sys.AP?.[l] ?? 0) > 0])) };
      getters.currentAP = { get: () => sys.AP };
    }
    if (type === "weapon") {
      getters.isMelee = { get: () => !sys._ranged };
      getters.isRanged = { get: () => !!sys._ranged };
      getters.WeaponGroup = { get: () => `WFRP4E.GroupType.${sys.weaponGroup?.value}` };
      getters.Reach = { get: () => (sys._ranged ? null : `WFRP4E.Reach.${sys.reach?.value}`) };
      getters.Range = { get: () => sys._range ?? null };
      getters.Damage = {
        get: () => {
          const sb = item.parent.system.characteristics.s.bonus;
          const f = String(sys.damage?.value || "0").replace("SB", sb);
          return f.split("+").reduce((a, b) => a + Number(b || 0), 0);
        }
      };
    }
    Object.defineProperties(sys, getters);
    return sys;
  }

  class FakeItem {
    constructor(actor, data) {
      this.parent = actor;
      this.id = data.id;
      this.uuid = `Actor.${actor.id}.Item.${data.id}`;
      this.name = data.name;
      this.img = data.img;
      this.type = data.type;
      this.system = makeSystem(this, data.system ?? {});
    }
    get actor() {
      return this.parent;
    }
    get sheet() {
      return { render: () => toast(`ПКМ: в Foundry тут откроется лист «${this.name}»`, "info") };
    }
    toDragData() {
      return { type: "Item", uuid: this.uuid };
    }
    async update(changes, { silent = false } = {}) {
      const flat = flatten(changes);
      // Как в системе: смена «надето» у оружия сбрасывает вторую руку
      if (this.type === "weapon" && "system.equipped.value" in flat && !("system.offhand.value" in flat))
        flat["system.offhand.value"] = false;
      for (const [k, v] of Object.entries(flat)) setPath(this, k, v);
      this.parent.prepare();
      if (!silent) Hooks.call("updateItem", this, changes);
      return this;
    }
  }

  class FakeActor {
    constructor(data) {
      this.id = data.id;
      this.uuid = `Actor.${data.id}`;
      this.name = data.name;
      this.img = data.img;
      this.type = "character";
      this.isOwner = true;
      this.system = structuredClone(data.system);
      const arr = data.items.map((d) => new FakeItem(this, d));
      arr.get = (id) => arr.find((i) => i.id === id);
      this.items = arr;
      this.career = data.career;
      const actor = this;
      Object.defineProperties(this.system, {
        currentCareer: { get: () => ({ name: actor.career.name, system: { level: { value: actor.career.level } } }) },
        equipPointsUsed: {
          get: () => actor.items.filter((i) => i.type === "weapon" && i.system.isEquipped).reduce((n, w) => n + (w.system.twohanded?.value ? 2 : 1), 0)
        }
      });
      this.prepare();
    }
    get itemTypes() {
      const out = {};
      for (const i of this.items) (out[i.type] ??= []).push(i);
      return out;
    }
    get sheet() {
      return { render: () => toast("В Foundry тут откроется лист персонажа", "info") };
    }
    async updateEmbeddedDocuments(type, updates) {
      for (const u of updates) {
        const { _id, ...rest } = u;
        await this.items.get(_id)?.update(rest, { silent: true });
      }
      Hooks.call("updateActor", this, {});
    }
    /** Пересчёт как в системе: AP по локациям и нагрузка */
    prepare() {
      const s = this.system;
      for (const c of Object.values(s.characteristics)) {
        if (c.initial !== undefined) c.value = c.initial + (c.modifier || 0) + (c.advances || 0);
        c.bonus ??= Math.floor(c.value / 10);
        if (c.initial !== undefined) c.bonus = Math.floor(c.value / 10);
      }
      s.status.armour = {};
      for (const l of LOCS) s.status.armour[l] = { value: 0 };
      let enc = 0;
      for (const i of this.items) {
        const sys = i.system;
        let e = (sys.encumbrance?.value ?? 0) * (sys.quantity?.value ?? 1);
        if (sys.isEquipped && ["armour", "trapping"].includes(i.type)) e = Math.max(0, e - 1);
        sys.encumbrance.total = e;
        enc += e;
        if (i.type === "armour" && sys.isEquipped) for (const l of LOCS) s.status.armour[l].value += sys.AP?.[l] ?? 0;
      }
      s.status.encumbrance.current = Math.round(enc * 100) / 100;
      s.status.encumbrance.max = s.characteristics.s.bonus + s.characteristics.t.bonus;
    }
  }

  window.__PD_makeActor__ = (data) => {
    const actor = new FakeActor(data);
    window.fromUuid = async (uuid) => actor.items.find((i) => i.uuid === uuid) ?? null;
    return actor;
  };

  window.game = {
    i18n,
    user: { isGM: true },
    wfrp4e: { config: window.__PD_CONFIG__ }
  };
  game.modules = new Map([["wfrp4e-paperdoll", {}]]);
})();
