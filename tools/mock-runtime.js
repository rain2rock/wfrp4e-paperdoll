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
      el.className = ["application", "app", "window-app", ...this.options.classes].join(" ");
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
  const GROUP_SPEC = {
    basic: "basic", cavalry: "cavalry", fencing: "fencing", brawling: "brawling", flail: "flail", parry: "parry",
    polearm: "polearm", twohanded: "two-handed", blackpowder: "blackpowder", bow: "bow", crossbow: "crossbow",
    entangling: "entangling", engineering: "engineering", explosives: "explosives", sling: "sling", throwing: "throwing"
  };

  function makeSystem(item, data) {
    const sys = structuredClone(data);
    const type = item.type;
    const getters = {
      isPhysical: { get: () => ["armour", "weapon", "trapping", "container", "ammunition"].includes(type) },
      isEquippable: { get: () => ["armour", "weapon", "trapping", "container"].includes(type) },
      isEquipped: { get: () => !!sys.equipped?.value },
      canEquip: { get: () => type !== "trapping" || sys.trappingType?.value === "clothingAccessories" },
      // Как в системе: без навыка оружие ближнего боя теряет достоинства, цепы становятся опасными
      Qualities: { get: () => (type === "weapon" && !sys._ranged && item.parent._hasSkills && !sys.skillToUse ? [] : sys._qualities ?? []) },
      Flaws: {
        get: () => {
          const f = sys._flaws ?? [];
          const untrainedFlail = type === "weapon" && sys.weaponGroup?.value === "flail" && item.parent._hasSkills && !sys.skillToUse;
          return untrainedFlail && !f.includes("Опасное") ? [...f, "Опасное"] : f;
        }
      },
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
      // Навык, которым владеет персонаж для этой группы (как getSkillToUse в системе)
      getters.skillToUse = {
        get: () => {
          const spec = GROUP_SPEC[sys.weaponGroup?.value];
          if (!spec) return undefined;
          return item.parent.items.find((i) => i.type === "skill" && i.name.toLowerCase().includes(`(${spec})`));
        }
      };
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
      this.flags = structuredClone(data.flags ?? {});
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
    async delete() {
      const list = this.parent.items;
      const i = list.indexOf(this);
      if (i >= 0) list.splice(i, 1);
      this.parent.prepare();
      Hooks.call("deleteItem", this);
    }
  }

  class FakeEffect {
    constructor(actor, data) {
      this.parent = actor;
      this.id = data.id;
      this.name = data.name;
      this.img = data.img;
      this.description = data.description ?? "";
      this.statuses = new Set(data.statuses ?? []);
      this.disabled = !!data.disabled;
      this.conditionValue = data.value ?? null;
    }
    get sheet() {
      return { render: () => toast(`ПКМ: в Foundry тут откроется эффект «${this.name}»`, "info") };
    }
    async update(changes) {
      Object.assign(this, changes);
      // Как в Foundry: эффект - свой документ, у актёра updateActor не вызывается
      Hooks.call("updateActiveEffect", this, changes);
      return this;
    }
    async delete() {
      const list = this.parent.effects;
      list.splice(list.indexOf(this), 1);
      Hooks.call("deleteActiveEffect", this);
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
      // Навыки и таланты - обычные предметы актёра, как в Foundry
      const extra = [
        ...(data.skills ?? []).map((sk, i) => ({
          id: `skill-${i}`,
          name: sk.name ?? sk,
          type: "skill",
          system: { characteristic: { value: sk.ch ?? "ws" }, advances: { value: sk.adv ?? 0 }, total: { value: 0 } }
        })),
        // Ступени карьеры - отдельные предметы, как в системе
        ...(data.careers ?? []).map((c, i) => ({
          id: `career-${i}`,
          name: c.name,
          type: "career",
          system: {
            careergroup: { value: c.group },
            level: { value: c.level },
            current: { value: !!c.current },
            complete: { value: !!c.complete },
            class: { value: c.class ?? "" },
            characteristics: Object.fromEntries((c.chars ?? []).map((k) => [k, true])),
            skills: c.skills ?? [],
            talents: c.talents ?? []
          }
        })),
        ...(data.talents ?? []).map((t, i) => ({ id: `talent-${i}`, name: t.name ?? t, type: "talent", system: { advances: { value: t.advances ?? 1 }, max: { value: t.max ?? "1" } } })),
        ...(data.spells ?? []).map((name, i) => ({ id: `spell-${i}`, name, type: "spell", system: {} }))
      ];
      this._hasSkills = extra.some((e) => e.type === "skill");
      const arr = [...data.items, ...extra].map((d) => new FakeItem(this, d));
      arr.get = (id) => arr.find((i) => i.id === id);
      this.items = arr;
      const effects = (data.effects ?? []).map((e) => new FakeEffect(this, e));
      effects.get = (id) => effects.find((e) => e.id === id);
      this.effects = effects;
      this.career = data.career;
      const actor = this;
      Object.defineProperties(this.system, {
        currentCareer: {
          get: () => actor.items.find((i) => i.type === "career" && i.system.current?.value) ?? (actor.career && {
            name: actor.career.name,
            img: actor.career.img,
            system: { level: { value: actor.career.level }, class: { value: actor.career.class } }
          })
        },
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
    /** Как в системе: снять N уровней состояния, на нуле состояние исчезает */
    async removeCondition(key, value = 1) {
      const effect = this.effects.find((e) => e.statuses.has(key));
      if (!effect) return;
      const left = (effect.conditionValue ?? 1) - value;
      if (left > 0 && effect.conditionValue) await effect.update({ conditionValue: left });
      else await effect.delete();
    }
    /** Как Actor.update: точечные пути, пересчёт, хук */
    async update(changes) {
      for (const [k, v] of Object.entries(flatten(changes))) setPath(this, k, v);
      this.prepare();
      Hooks.call("updateActor", this, changes);
      return this;
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
      // Навыки: характеристика + шаги развития; опыт: доступно = всего - потрачено
      for (const i of this.items ?? []) {
        if (i.type !== "skill") continue;
        const ch = s.characteristics[i.system.characteristic?.value ?? "ws"];
        i.system.total = { value: (ch?.value ?? 0) + (Number(i.system.advances?.value) || 0) };
      }
      const xp = s.details?.experience;
      if (xp) xp.current = (Number(xp.total) || 0) - (Number(xp.spent) || 0);
      s.status.armour = {};
      for (const l of LOCS) s.status.armour[l] = { value: 0 };
      let enc = 0;
      for (const i of this.items) {
        const sys = i.system;
        if (!sys.isPhysical) continue;
        // Как в системе: AP считается по всей надетой броне, где бы она ни «лежала»
        if (i.type === "armour" && sys.isEquipped) for (const l of LOCS) s.status.armour[l].value += sys.AP?.[l] ?? 0;
        // Как в системе: вещи внутри контейнеров не считаются в нагрузку напрямую, только сам контейнер
        if (sys.location?.value) {
          sys.encumbrance.total = (sys.encumbrance?.value ?? 0) * (sys.quantity?.value ?? 1);
          continue;
        }
        let e = (sys.encumbrance?.value ?? 0) * (sys.quantity?.value ?? 1);
        if (sys.isEquipped && ["armour", "trapping"].includes(i.type)) e = Math.max(0, e - 1);
        sys.encumbrance.total = e;
        enc += e;
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
    user: { isGM: false },
    wfrp4e: { config: window.__PD_CONFIG__ },
    // Настройки модуля: тема и свои иконки
    settings: {
      _values: { "wfrp4e-paperdoll.itemIcons": true },
      get(ns, key) {
        return this._values[`${ns}.${key}`];
      },
      async set(ns, key, value) {
        this._values[`${ns}.${key}`] = value;
        window.PaperdollApp?.renderAll?.();
        return value;
      }
    }
  };
  game.modules = new Map([["wfrp4e-paperdoll", {}]]);
})();
