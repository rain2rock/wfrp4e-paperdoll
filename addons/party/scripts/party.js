/**
 * Дополнение «Группа» для окна снаряжения WFRP4e.
 * Передача вещей: перетащи вещь из окна на токен на игровом столе - она перейдёт его персонажу.
 * Общий сундук: персонаж-склад, который выбирает (или создаёт) ГМ; окно сундука, положить и забрать перетаскиванием.
 * Окно группы (ГМ): раны, удача, броня, золото и эффекты всех персонажей разом (вид «Карточки» или «Таблица»), казна группы (деньги сундука).
 * Клики как в основной карточке: раны (ЛКМ +1, ПКМ -1, Shift ×5) и монетки (ЛКМ +1, ПКМ -1, Shift ×10, сдача разменивается сама).
 * Наведение на эффект - та же подробная карточка, что и в ленте эффектов основного окна (effectTooltip из ядра).
 * Кнопка «Начало сессии» - удача всем до судьбы; «+» у ленты эффектов - поиск и добавление стандартного состояния (actor.addCondition, зеркально removeCondition).
 * Чужому персонажу передачу выполняет ГМ через сокет. Требует модуль ядра wfrp4e-paperdoll.
 */
(() => {
  const ADDON = "party";
  const ADDON_MODULE_ID = "wfrp4e-paperdoll-party";

  function register(api) {
    const { PaperdollTooltip, util } = api;
    const { MODULE_ID, esc, itemImg, effectTooltip, effectRemaining, effectPolarity, stripTags, plainEnrichers } = util;
    // Общее с ядром: локализация, деньги, тир ран и диалог снятия эффекта - чтобы логика не разъезжалась
    const { L, F, COIN_VALUE, actorCoins, moneyPennies, formatMoney, changeActorMoney, woundsTier, confirmRemoveEffect, effectEntry } = util;

    const SOCKET = `module.${MODULE_ID}`;

    /** Токен под точкой сброса (верхний) */
    function tokenAt(x, y) {
      const hits = (canvas?.tokens?.placeables ?? []).filter((t) => {
        if (!t.actor || t.document.hidden && !game.user.isGM) return false;
        const b = t.bounds ?? { x: t.x, y: t.y, width: t.w, height: t.h };
        return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
      });
      return hits.sort((a, b) => (b.document.sort ?? 0) - (a.document.sort ?? 0))[0] ?? null;
    }

    /** Сколько отдать: у стопки спрашиваем, у одной вещи - сразу 1 */
    async function askQuantity(item) {
      const have = Number(item.system?.quantity?.value ?? 1) || 1;
      if (have <= 1) return 1;
      const Dialog = foundry.applications?.api?.DialogV2;
      if (!Dialog) return have;
      const n = await Dialog.prompt({
        window: { title: F("WFRPPD.Transfer.HowMany", { name: item.name }) },
        content: `<p>${F("WFRPPD.Transfer.HowManyHint", { have })}</p><input type="number" name="n" min="1" max="${have}" value="${have}" autofocus>`,
        ok: { label: L("WFRPPD.Transfer.Give"), callback: (ev, button) => button.form.elements.n.valueAsNumber },
        rejectClose: false
      });
      return n ? Math.max(1, Math.min(have, Math.floor(n))) : 0;
    }

    /**
     * Сама передача: выполняет владелец обоих персонажей или ГМ.
     * userId задан, если запрос пришёл по сокету: прежде чем трогать чужие вещи, ГМ проверяет права
     * заявившего игрока - иначе любой клиент мог бы попросить перенести что угодно откуда угодно.
     */
    async function doTransfer({ itemUuid, targetUuid, qty, userId }) {
      const item = await fromUuid(itemUuid);
      const target = await fromUuid(targetUuid);
      if (!item?.parent || !target || item.parent === target) return;
      if (userId !== undefined) {
        const user = game.users.get(userId);
        const mayTake = user && (user.isGM || item.parent.testUserPermission?.(user, "OWNER"));
        if (!mayTake) {
          console.warn(`${MODULE_ID} | передача отклонена: у пользователя нет прав на «${item.parent.name}»`);
          return;
        }
      }
      const source = item.parent;
      const qtyPath = item.system?.quantity !== undefined;
      const have = Number(item.system?.quantity?.value ?? 1) || 1;
      const n = Math.max(1, Math.min(have, Number(qty) || have));

      const data = item.toObject();
      delete data._id;
      if (qtyPath) data.system.quantity.value = n;
      // У нового владельца вещь лежит в общем инвентаре, ничего не надето
      if (data.system?.equipped && typeof data.system.equipped === "object") data.system.equipped.value = false;
      if (data.system?.location && typeof data.system.location === "object") data.system.location.value = "";
      if (data.system?.worn !== undefined) data.system.worn = false;
      if (data.flags?.[MODULE_ID]) delete data.flags[MODULE_ID];

      // Стопки складываем: та же вещь (тип и название) с количеством
      const same = qtyPath && item.type !== "container" ? target.items.find((i) => i.type === item.type && i.name === item.name && i.system?.quantity !== undefined) : null;
      if (same) await same.update({ "system.quantity.value": (Number(same.system.quantity.value) || 0) + n });
      else await target.createEmbeddedDocuments("Item", [data]);

      if (n >= have) await item.delete();
      else await item.update({ "system.quantity.value": have - n });

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker?.({ actor: source }),
        content: `<div class="wfrp-paperdoll-rest">${F("WFRPPD.Transfer.Chat", { from: source.name, to: target.name, item: item.name, n })}</div>`
      });
    }

    /** Передать вещь персонажу: спросить количество, выполнить сам или через ГМ */
    async function requestTransfer(item, target) {
      if (!item?.parent || !target || item.parent === target) return false;
      if (!item.parent.isOwner) {
        ui.notifications.warn(L("WFRPPD.Transfer.NotYours"));
        return false;
      }
      if (item.type === "container" && item.parent.items.some((i) => i.system?.location?.value === item.id)) {
        ui.notifications.warn(L("WFRPPD.Transfer.ContainerFull"));
        return false;
      }
      const qty = await askQuantity(item);
      if (!qty) return false;
      const payload = { itemUuid: item.uuid, targetUuid: target.uuid, qty };
      if (target.isOwner) await doTransfer(payload);
      // ГМ проверит права по userId: подпись сокетов Foundry не даёт, но без заявленного автора принимать запрос нельзя
      else if (game.users.activeGM) game.socket.emit(SOCKET, { action: "transfer", payload: { ...payload, userId: game.user.id } });
      else {
        ui.notifications.warn(L("WFRPPD.Transfer.NeedGM"));
        return false;
      }
      return true;
    }

    /** Сброс на стол: вещь из окна снаряжения на токен */
    async function onDropCanvas(cnv, data) {
      if (data?.type !== "Item" || !(data.fromPaperdoll || data.fromStash) || !data.uuid) return;
      if (!game.settings.get(MODULE_ID, "tokenTransfer")) return;
      const token = tokenAt(data.x, data.y);
      if (!token) return;
      const item = await fromUuid(data.uuid);
      await requestTransfer(item, token.actor);
    }




    const { ApplicationV2 } = foundry.applications.api;
    /** Что лежит в сундуке: только вещи, без навыков, талантов и прочего */
    const PHYSICAL = ["weapon", "armour", "trapping", "ammunition", "container", "money", "cargo"];

    /** Персонаж-сундук из настроек мира */
    function stashActor() {
      const id = game.settings.get(MODULE_ID, "stashActor");
      return (id && game.actors?.get(id)) || null;
    }

    /** ГМ: создать сундук - NPC, которым владеют все игроки */
    async function createStash() {
      if (!game.user.isGM) return null;
      const actor = await Actor.create({
        name: L("WFRPPD.Stash.DefaultName"),
        type: "npc",
        img: "icons/svg/chest.svg",
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }
      });
      if (actor) await game.settings.set(MODULE_ID, "stashActor", actor.id);
      return actor;
    }

    class StashApp extends ApplicationV2 {
      static DEFAULT_OPTIONS = {
        id: "wfrp4e-paperdoll-stash",
        classes: ["wfrp-paperdoll", "wfrp-paperdoll-stash", "pd-theme-parchment"],
        window: { title: "WFRPPD.Stash.Title", icon: "fa-solid fa-box-archive", resizable: true },
        position: { width: 420, height: 460 }
      };

      /** forActor - чей это сундук открыли (двойной клик забирает вещь ему) */
      static open(forActor) {
        const stash = stashActor();
        if (!stash) return ui.notifications.warn(L("WFRPPD.Stash.NotSet"));
        const app = (StashApp._app ??= new StashApp());
        app.forActor = forActor ?? game.user.character ?? null;
        app.render({ force: true });
        return app;
      }

      get title() {
        return stashActor()?.name ?? L("WFRPPD.Stash.Title");
      }

      async _renderHTML() {
        const stash = stashActor();
        const items = (stash?.items ?? []).filter((i) => PHYSICAL.includes(i.type)).sort((a, b) => a.name.localeCompare(b.name));
        const cells = items
          .map((i) => {
            const q = Number(i.system?.quantity?.value ?? 1);
            return `<div class="pd-stash-item" draggable="true" data-item-id="${i.id}"><img src="${esc(itemImg(i.img, i.name))}" alt="">${q > 1 ? `<span class="pd-qty">${q}</span>` : ""}</div>`;
          })
          .join("");
        return `<div class="pd-stash-drop">
          <div class="pd-stash-hint">${esc(L("WFRPPD.Stash.Hint"))}</div>
          <div class="pd-stash-grid">${cells || `<div class="pd-stash-empty">${esc(L("WFRPPD.Stash.Empty"))}</div>`}</div>
        </div>`;
      }

      _replaceHTML(result, content) {
        content.innerHTML = result;
      }

      _onRender() {
        const stash = stashActor();
        const root = this.element;
        for (const el of root.querySelectorAll(".pd-stash-item")) {
          const item = stash?.items.get(el.dataset.itemId);
          if (!item) continue;
          el.addEventListener("pointerenter", (ev) => PaperdollTooltip.show(item, ev, null));
          el.addEventListener("pointermove", (ev) => PaperdollTooltip.move(ev));
          el.addEventListener("pointerleave", () => PaperdollTooltip.hide());
          el.addEventListener("dragstart", (ev) => {
            PaperdollTooltip.hide();
            ev.dataTransfer.setData("text/plain", JSON.stringify({ ...item.toDragData(), fromStash: true }));
          });
          // Двойной клик - забрать себе
          el.addEventListener("dblclick", async () => {
            PaperdollTooltip.hide();
            if (this.forActor) await requestTransfer(item, this.forActor);
          });
          el.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            item.sheet?.render(true);
          });
        }
        // Положить: вещь из окна снаряжения (или листа) своего персонажа
        const drop = root.querySelector(".pd-stash-drop");
        drop?.addEventListener("dragover", (ev) => ev.preventDefault());
        drop?.addEventListener("drop", async (ev) => {
          ev.preventDefault();
          const TE = foundry.applications.ux.TextEditor.implementation;
          const data = TE.getDragEventData(ev);
          if (data?.type !== "Item" || !data.uuid || data.fromStash) return;
          const item = await fromUuid(data.uuid);
          if (item?.parent && item.parent !== stash) await requestTransfer(item, stash);
        });
        // Сундук обновляется сам, когда кто-то кладёт или забирает вещи
        if (!this._hooks) {
          const rerender = foundry.utils.debounce((doc) => {
            if (this.rendered && doc?.parent?.id === stashActor()?.id) this.render();
          }, 50);
          this._hooks = [
            ["createItem", Hooks.on("createItem", rerender)],
            ["updateItem", Hooks.on("updateItem", rerender)],
            ["deleteItem", Hooks.on("deleteItem", rerender)]
          ];
        }
      }

      async _onClose(options) {
        await super._onClose(options);
        // Окно закрыли - хуки больше не нужны, иначе они копятся на каждое открытие
        for (const [name, id] of this._hooks ?? []) Hooks.off(name, id);
        this._hooks = null;
        PaperdollTooltip.hide();
      }
    }


    /* ---------------- Окно группы (только ГМ) ---------------- */

    /**
     * Персонажи группы: токены на сцене, принадлежащие игрокам, которые сейчас в сети. В моке - все тестовые персонажи.
     * Обход сцены и пользователей недешёвый, а зовут это и при рисовании, и на каждый клик, поэтому держим
     * короткий кэш: его сбрасывает любая перерисовка окна (и хуки сцены, которые к ней ведут).
     */
    let partyCache = null;
    function partyMembers() {
      if (partyCache) return partyCache;
      if (globalThis.__PD_MOCK__) return (partyCache = (window.__PD_actors ?? []).filter((a) => a.type === "character"));
      const seen = new Set();
      const out = [];
      for (const t of canvas?.tokens?.placeables ?? []) {
        const a = t.actor;
        // Несвязанные токены - самостоятельные копии: у них свой uuid, по нему и различаем (у связанных он общий)
        if (!a || a.type !== "character" || !a.hasPlayerOwner || seen.has(a.uuid)) continue;
        if (!game.users.some((u) => !u.isGM && u.active && a.testUserPermission?.(u, "OWNER"))) continue;
        seen.add(a.uuid);
        out.push(a);
      }
      return (partyCache = out.sort((x, y) => x.name.localeCompare(y.name)));
    }
    const invalidateParty = () => { partyCache = null; };

    /** Монеты персонажа по номиналам для кликабельных иконок: стопка может отсутствовать - тогда ноль */
    function groupCoins(actor) {
      const coins = actorCoins(actor);
      return Object.keys(COIN_VALUE).map((key) => ({
        key,
        value: Number(coins[key]?.system.quantity?.value) || 0,
        img: coins[key]?.img ?? null
      }));
    }

    /** Изменить раны в пределах 0..максимум - как клики по полосе ран в основном окне (ЛКМ +1, ПКМ -1) */
    async function changeWounds(actor, delta) {
      const w = actor.system.status?.wounds ?? {};
      const max = Number(w.max) || 0;
      const now = Number(w.value) || 0;
      const next = Math.max(0, Math.min(max, now + delta));
      if (next !== now) await actor.update({ "system.status.wounds.value": next });
    }

    /**
     * Повесить состояние на персонажа. Системный addCondition есть не во всех версиях wfrp4e,
     * поэтому при его отсутствии создаём ActiveEffect сами - кнопка не должна молча ничего не делать.
     */
    async function addConditionTo(actor, key) {
      try {
        if (typeof actor.addCondition === "function") {
          await actor.addCondition(key, 1);
          return true;
        }
        const cfg = game.wfrp4e?.config ?? {};
        const status = (CONFIG.statusEffects ?? []).find((s) => s.id === key);
        await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: L(cfg.conditions?.[key] ?? key),
            img: status?.img ?? status?.icon,
            statuses: [key],
            flags: { core: { statusId: key } }
          }
        ]);
        return true;
      } catch (err) {
        console.warn(`${MODULE_ID} | addCondition failed`, err);
        ui.notifications.warn(F("WFRPPD.Group.AddFailed", { name: L(game.wfrp4e?.config?.conditions?.[key] ?? key) }));
        return false;
      }
    }

    /**
     * Мутации и травмы для меню «+»: берём из компендиумов предметов (кэш на сессию).
     * Показываем только то, за что отвечает установленное дополнение: мутации - mutations, травмы - injuries.
     */
    const itemLib = new Map();
    async function loadItemLib(type) {
      if (itemLib.has(type)) return itemLib.get(type);
      const out = [];
      itemLib.set(type, out);
      try {
        for (const pack of game.packs ?? []) {
          if (pack.documentName !== "Item") continue;
          const index = await pack.getIndex({ fields: ["type", "img"] });
          for (const e of index) {
            if (e.type !== type) continue;
            out.push({ name: e.name, img: e.img, uuid: `Compendium.${pack.collection}.${e._id}` });
          }
        }
        out.sort((a, b) => a.name.localeCompare(b.name));
      } catch (err) {
        console.warn(`${MODULE_ID} | compendium lookup failed (${type})`, err);
      }
      return out;
    }

    /** Какие разделы предлагать в меню «+»: состояния всегда, мутации и травмы - если их дополнение установлено */
    function addMenuSections() {
      const out = [{ type: "condition", label: "WFRPPD.Group.SectionConditions" }];
      if (api.hasAddon("mutations")) out.push({ type: "mutation", label: "WFRPPD.Group.SectionMutations" });
      if (api.hasAddon("injuries")) out.push({ type: "injury", label: "WFRPPD.Group.SectionInjuries" });
      return out;
    }

    /**
     * Разметка разделов меню «+». Строится отдельно от окна: после подгрузки компендиумов
     * обновляем только список, иначе перерисовка окна закрыла бы только что открытое меню.
     */
    function addMenuHtml() {
      const conditions = Object.entries(game.wfrp4e?.config?.conditions ?? {});
      return addMenuSections()
        .map((s) => {
          const items =
            s.type === "condition"
              ? conditions.map(([key, label]) => ({ key, name: L(label), img: null }))
              : (itemLib.get(s.type) ?? []).map((e) => ({ key: e.uuid, name: e.name, img: e.img }));
          const body = items.length
            ? items
                .map(
                  (e) =>
                    `<button type="button" data-add-type="${esc(s.type)}" data-add-key="${esc(e.key)}">${
                      e.img ? `<img src="${esc(e.img)}" alt="">` : ""
                    }${esc(e.name)}</button>`
                )
                .join("")
            : `<div class="pd-group-addmenu-empty">${esc(
                L(s.type === "condition" ? "WFRPPD.Group.AddConditionNone" : itemLib.has(s.type) ? "WFRPPD.Group.AddNone" : "WFRPPD.Group.AddLoading")
              )}</div>`;
          return `<div class="pd-group-addmenu-section" data-section="${esc(s.type)}">
              <div class="pd-group-addmenu-title">${esc(L(s.label))}</div>${body}
            </div>`;
        })
        .join("");
    }

    /** Выдать персонажу мутацию или травму из компендиума */
    async function addItemTo(actor, uuid) {
      try {
        const doc = await fromUuid(uuid);
        if (!doc) return false;
        const data = doc.toObject();
        delete data._id;
        await actor.createEmbeddedDocuments("Item", [data]);
        return true;
      } catch (err) {
        console.warn(`${MODULE_ID} | add item failed`, err);
        ui.notifications.warn(F("WFRPPD.Group.AddFailed", { name: uuid }));
        return false;
      }
    }

    /** Данные одной строки окна группы по персонажу */
    function groupRow(actor) {
      const st = actor.system.status ?? {};
      const wounds = { value: Number(st.wounds?.value) || 0, max: Number(st.wounds?.max) || 0 };
      const fate = Number(st.fate?.value) || 0;
      const fortune = Number(st.fortune?.value) || 0;
      const ap = (loc) => Number(st.armour?.[loc]?.value) || 0;
      const [rArm, lArm, rLeg, lLeg] = [ap("rArm"), ap("lArm"), ap("rLeg"), ap("lLeg")];
      // Разбор эффекта общий с лентой окна снаряжения: перенесённые с предметов пассивки оно вернёт как null -
      // их источник предмет, и снимать их отсюда нельзя, иначе Shift+ЛКМ снёс бы эффект самого таланта
      const effects = (actor.effects ?? [])
        .filter((e) => !e.disabled && !e.isSuppressed)
        .map((e) => effectEntry(e, actor))
        .filter(Boolean);
      return {
        uuid: actor.uuid,
        name: actor.name,
        img: itemImg(actor.img, actor.name),
        wounds: { ...wounds, tier: woundsTier(wounds.value, wounds.max) },
        fortune: { value: fortune, max: fate },
        ap: { head: ap("head"), body: ap("body"), rArm, lArm, rLeg, lLeg },
        money: groupCoins(actor),
        effects
      };
    }

    /** Начало сессии: удача всем в группе до значения судьбы, если сейчас ниже */
    async function restoreFortune() {
      const changed = [];
      for (const actor of partyMembers()) {
        const st = actor.system.status ?? {};
        const fate = Number(st.fate?.value) || 0;
        const now = Number(st.fortune?.value) || 0;
        if (fate > now) {
          await actor.update({ "system.status.fortune.value": fate });
          changed.push({ name: actor.name, from: now, to: fate });
        }
      }
      const lines = changed.length ? changed.map((c) => `${esc(c.name)}: ${c.from} → ${c.to}`).join("<br>") : esc(L("WFRPPD.Group.SessionNone"));
      await ChatMessage.create({ content: `<div class="wfrp-paperdoll-rest"><b>${esc(L("WFRPPD.Group.Session"))}</b><br>${lines}</div>` });
      return changed;
    }

    const pct = (value, max) => (max ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0);
    const upDown = (...vals) => (vals.some((v) => v > 0) ? "is-up" : "is-zero");

    /** Общие цветовые классы и доля заполнения для строки/карточки персонажа */
    function rowVisuals(r) {
      return {
        woundsCls: r.wounds.tier === "dying" || r.wounds.tier === "critical" ? "is-down" : r.wounds.tier === "full" ? "is-up" : "",
        woundsPct: pct(r.wounds.value, r.wounds.max),
        fortuneCls: r.fortune.max && r.fortune.value === 0 ? "is-down" : r.fortune.max && r.fortune.value >= r.fortune.max ? "is-up" : "",
        fortunePct: pct(r.fortune.value, r.fortune.max)
      };
    }

    /** Броня - 4 локации компактно, общая для карточки и таблицы */
    function groupApRow(r) {
      return `
        <span class="${upDown(r.ap.head)}" title="${esc(L("WFRPPD.Group.Head"))}">${esc(L("WFRPPD.Group.Abbr.Head"))} ${r.ap.head}</span>
        <span class="${upDown(r.ap.body)}" title="${esc(L("WFRPPD.Group.Torso"))}">${esc(L("WFRPPD.Group.Abbr.Torso"))} ${r.ap.body}</span>
        <span class="${upDown(r.ap.rArm, r.ap.lArm)}" title="${esc(L("WFRPPD.Stats.Arms"))}">${esc(L("WFRPPD.Group.Abbr.Arms"))} ${r.ap.rArm}/${r.ap.lArm}</span>
        <span class="${upDown(r.ap.rLeg, r.ap.lLeg)}" title="${esc(L("WFRPPD.Stats.Legs"))}">${esc(L("WFRPPD.Group.Abbr.Legs"))} ${r.ap.rLeg}/${r.ap.lLeg}</span>`;
    }

    /** Эффекты - иконки (подробности при наведении) + кнопка «+» добавить состояние, общие для карточки и таблицы */
    function groupFx(r) {
      const icons = r.effects.length
        ? r.effects.map((e) => `<img class="pd-group-fx-icon" data-actor-uuid="${esc(r.uuid)}" data-effect-id="${esc(e.id)}" src="${esc(itemImg(e.img, e.name))}" alt="">`).join("")
        : `<span class="pd-group-fx-none">-</span>`;
      return `${icons}<button type="button" class="pd-group-addfx-btn" data-actor-uuid="${esc(r.uuid)}" title="${esc(L("WFRPPD.Group.AddCondition"))}">+</button>`;
    }

    /** Монетки персонажа - кликабельные иконки, как в основном окне (ЛКМ +1, ПКМ -1, Shift ×10) */
    function groupCoinsHtml(r) {
      return r.money
        .map(
          (c) =>
            `<span class="pd-coin pd-coin--${c.key} ${c.img ? "has-img" : ""}" data-actor-uuid="${esc(r.uuid)}" data-coin="${c.key}" title="${esc(L(`WFRPPD.Money.Name.${c.key}`))}">${
              c.img ? `<img src="${esc(c.img)}" alt="">` : ""
            }${c.value}</span>`
        )
        .join("");
    }

    /** Строка таблицы - компактно, одна строка на персонажа */
    function groupTable(rows) {
      const row = (r) => {
        const v = rowVisuals(r);
        return `
          <div class="pd-group-row">
            <div class="pd-group-who"><img src="${esc(r.img)}" alt=""><span>${esc(r.name)}</span></div>
            <div class="pd-group-wounds" data-actor-uuid="${esc(r.uuid)}"><span class="${v.woundsCls}">${r.wounds.value} / ${r.wounds.max}</span></div>
            <div><span class="${v.fortuneCls}">${r.fortune.value} / ${r.fortune.max}</span></div>
            <div class="pd-group-ap">${groupApRow(r)}</div>
            <div class="pd-group-coins">${groupCoinsHtml(r)}</div>
            <div class="pd-group-fx">${groupFx(r)}</div>
          </div>`;
      };
      return `
        <div class="pd-group-head">
          <div></div>
          <div>${esc(L("WFRPPD.Wounds"))}</div>
          <div>${esc(L("WFRPPD.Stats.Fortune"))}</div>
          <div>${esc(L("WFRPPD.Group.Armour"))}</div>
          <div>${esc(L("WFRPPD.Money.Title"))}</div>
          <div>${esc(L("WFRPPD.Group.Effects"))}</div>
        </div>
        <div class="pd-group-body">${rows.map(row).join("")}</div>`;
    }

    /** Карточка персонажа - просторнее, с полосками вместо голых чисел */
    function groupCard(r) {
      const v = rowVisuals(r);
      const bar = (cls, p, value, max) => `
        <div class="pd-group-bar ${cls}"><div class="pd-group-bar-fill" style="width:${p}%"></div></div>
        <span class="pd-group-card-num">${value} / ${max}</span>`;
      return `
        <div class="pd-group-card">
          <div class="pd-group-card-head"><img src="${esc(r.img)}" alt=""><span>${esc(r.name)}</span></div>
          <div class="pd-group-card-stat pd-group-wounds" data-actor-uuid="${esc(r.uuid)}">
            <span class="pd-group-card-label">${esc(L("WFRPPD.Wounds"))}</span>${bar(v.woundsCls, v.woundsPct, r.wounds.value, r.wounds.max)}
          </div>
          <div class="pd-group-card-stat">
            <span class="pd-group-card-label">${esc(L("WFRPPD.Stats.Fortune"))}</span>${bar(v.fortuneCls, v.fortunePct, r.fortune.value, r.fortune.max)}
          </div>
          <div class="pd-group-card-ap">${groupApRow(r)}</div>
          <div class="pd-group-card-stat pd-group-card-money"><span class="pd-group-card-label">${esc(L("WFRPPD.Money.Title"))}</span><div class="pd-group-coins">${groupCoinsHtml(r)}</div></div>
          <div class="pd-group-card-fx">${groupFx(r)}</div>
        </div>`;
    }

    class GroupApp extends ApplicationV2 {
      static DEFAULT_OPTIONS = {
        id: "wfrp4e-paperdoll-group",
        classes: ["wfrp-paperdoll", "wfrp-paperdoll-group", "pd-theme-parchment"],
        window: { title: "WFRPPD.Group.Title", icon: "fa-solid fa-users", resizable: true },
        position: { width: 760, height: 480 }
      };

      static open() {
        if (!game.user.isGM) {
          ui.notifications?.warn(L("WFRPPD.Group.NeedGM"));
          return null;
        }
        const app = (GroupApp._app ??= new GroupApp());
        app.render({ force: true });
        return app;
      }

      get title() {
        return L("WFRPPD.Group.Title");
      }

      async _renderHTML() {
        invalidateParty();
        const rows = (this._rows = partyMembers().map(groupRow));
        const view = GroupApp.view ?? (GroupApp.view = "card");
        const body = !rows.length
          ? `<div class="pd-group-empty">${esc(L("WFRPPD.Group.Empty"))}</div>`
          : view === "card"
            ? `<div class="pd-group-cards">${rows.map(groupCard).join("")}</div>`
            : groupTable(rows);
        const stash = stashActor();
        const treasury = stash ? `<div class="pd-group-treasury"><i class="fa-solid fa-sack-dollar"></i> ${esc(L("WFRPPD.Group.Treasury"))}: ${esc(formatMoney(moneyPennies(stash), { compact: true }))}</div>` : "";
        return `
          <div class="pd-group">
            <div class="pd-group-toolbar">
              <button type="button" class="pd-group-session"><i class="fa-solid fa-sun"></i> ${esc(L("WFRPPD.Group.Session"))}</button>
              <div class="pd-group-viewtoggle">
                <button type="button" data-view="card" class="${view === "card" ? "is-active" : ""}">${esc(L("WFRPPD.Group.ViewCard"))}</button>
                <button type="button" data-view="table" class="${view === "table" ? "is-active" : ""}">${esc(L("WFRPPD.Group.ViewTable"))}</button>
              </div>
              ${treasury}
            </div>
            ${body}
            <div class="pd-group-addmenu" hidden>
              <input type="text" class="pd-group-addmenu-search" placeholder="${esc(L("WFRPPD.Group.AddConditionSearch"))}">
              <div class="pd-group-addmenu-list">${addMenuHtml()}</div>
            </div>
          </div>`;
      }

      _replaceHTML(result, content) {
        content.innerHTML = result;
      }

      _onRender() {
        const root = this.element;
        root.querySelector(".pd-group-session")?.addEventListener("click", async () => {
          const Dialog = foundry.applications?.api?.DialogV2;
          if (Dialog) {
            const ok = await Dialog.confirm({ window: { title: L("WFRPPD.Group.Session") }, content: `<p>${esc(L("WFRPPD.Group.SessionConfirm"))}</p>` });
            if (!ok) return;
          }
          await restoreFortune();
          this.render();
        });
        for (const btn of root.querySelectorAll(".pd-group-viewtoggle [data-view]")) {
          btn.addEventListener("click", () => {
            if (GroupApp.view === btn.dataset.view) return;
            GroupApp.view = btn.dataset.view;
            this.render();
          });
        }
        for (const el of root.querySelectorAll(".pd-group-fx-icon")) {
          const entryOf = () => this._rows?.find((r) => r.uuid === el.dataset.actorUuid)?.effects.find((e) => e.id === el.dataset.effectId);
          // ЛКМ - как в основном окне: у состояния снимает 1 уровень, у обычного эффекта открывает лист.
          // Shift+ЛКМ - снять совсем (с подтверждением, кроме состояния - для него это тоже частое действие, без лишнего диалога).
          el.addEventListener("click", async (ev) => {
            ev.preventDefault();
            const actor = partyMembers().find((a) => a.uuid === el.dataset.actorUuid);
            const effect = actor?.effects.get(el.dataset.effectId);
            if (!actor || !effect) return;
            const entry = entryOf();
            if (ev.shiftKey) {
              // Пассивку с предмета так не снять - её источник предмет или талант (та же защита, что в ядре)
              if (effect.transfer === true && effect.origin) {
                ui.notifications.info(L("WFRPPD.Effects.HintItemEffect"));
                return;
              }
              if (entry?.kind === "condition" || (await confirmRemoveEffect(effect.name))) await effect.delete();
              return;
            }
            if (entry?.kind === "condition") {
              if (typeof actor.removeCondition === "function") await actor.removeCondition(entry.key, 1);
              else await effect.delete();
              return;
            }
            effect.sheet?.render(true);
          });
          // ПКМ - всегда открыть лист
          el.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            const actor = partyMembers().find((a) => a.uuid === el.dataset.actorUuid);
            actor?.effects.get(el.dataset.effectId)?.sheet?.render(true);
          });
          // Подробности при наведении - та же карточка, что и в ленте эффектов основного окна
          el.addEventListener("pointerenter", (ev) => {
            const row = this._rows?.find((r) => r.uuid === el.dataset.actorUuid);
            const entry = row?.effects.find((e) => e.id === el.dataset.effectId);
            if (entry) PaperdollTooltip.showHtml(effectTooltip(entry), ev);
          });
          el.addEventListener("pointermove", (ev) => PaperdollTooltip.move(ev));
          el.addEventListener("pointerleave", () => PaperdollTooltip.hide());
        }
        // Раны: ЛКМ +1, ПКМ -1, с Shift - по 5, как в основном окне
        for (const el of root.querySelectorAll(".pd-group-wounds")) {
          const change = async (ev, dir) => {
            ev.preventDefault();
            const actor = partyMembers().find((a) => a.uuid === el.dataset.actorUuid);
            if (actor) await changeWounds(actor, dir * (ev.shiftKey ? 5 : 1));
          };
          el.addEventListener("click", (ev) => change(ev, 1));
          el.addEventListener("contextmenu", (ev) => change(ev, -1));
        }
        // Монеты: ЛКМ +1, ПКМ -1, с Shift - по 10, как в основном окне
        for (const el of root.querySelectorAll(".pd-coin")) {
          const step = (ev) => (ev.shiftKey ? 10 : 1);
          el.addEventListener("click", async (ev) => {
            ev.preventDefault();
            const actor = partyMembers().find((a) => a.uuid === el.dataset.actorUuid);
            if (actor) await changeActorMoney(actor, el.dataset.coin, step(ev));
          });
          el.addEventListener("contextmenu", async (ev) => {
            ev.preventDefault();
            const actor = partyMembers().find((a) => a.uuid === el.dataset.actorUuid);
            if (actor) await changeActorMoney(actor, el.dataset.coin, -step(ev));
          });
        }
        // «+» у ленты эффектов: поиск и выдача состояния, мутации или травмы (ГМ)
        const addMenu = root.querySelector(".pd-group-addmenu");
        const addSearch = addMenu?.querySelector(".pd-group-addmenu-search");
        const closeAddMenu = () => { if (addMenu) addMenu.hidden = true; };
        const filterAddMenu = (q) => {
          if (!addMenu) return;
          const nq = q.trim().toLowerCase();
          for (const sec of addMenu.querySelectorAll(".pd-group-addmenu-section")) {
            let shown = 0;
            for (const b of sec.querySelectorAll("[data-add-key]")) {
              const hit = !nq || b.textContent.toLowerCase().includes(nq);
              b.hidden = !hit;
              if (hit) shown++;
            }
            // Пустой раздел при поиске только мешает
            sec.hidden = !!nq && !shown;
          }
        };
        for (const btn of root.querySelectorAll(".pd-group-addfx-btn")) {
          btn.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            if (!addMenu) return;
            if (!addMenu.hidden && addMenu.dataset.actorUuid === btn.dataset.actorUuid) {
              closeAddMenu();
              return;
            }
            addMenu.dataset.actorUuid = btn.dataset.actorUuid;
            addMenu.hidden = false;
            const r = btn.getBoundingClientRect();
            const host = addMenu.offsetParent.getBoundingClientRect();
            addMenu.style.top = `${r.bottom - host.top + addMenu.offsetParent.scrollTop}px`;
            addMenu.style.left = `${Math.max(0, Math.min(r.left - host.left, host.width - addMenu.offsetWidth))}px`;
            addSearch.value = "";
            filterAddMenu("");
            addSearch.focus();
            // Мутации и травмы читаем из компендиумов один раз за сессию и дорисовываем прямо в открытое меню
            const lazy = addMenuSections().filter((s) => s.type !== "condition" && !itemLib.has(s.type));
            if (lazy.length) {
              await Promise.all(lazy.map((s) => loadItemLib(s.type)));
              const list = addMenu.querySelector(".pd-group-addmenu-list");
              if (list && !addMenu.hidden) {
                list.innerHTML = addMenuHtml();
                filterAddMenu(addSearch.value);
              }
            }
          });
        }
        addSearch?.addEventListener("input", (ev) => filterAddMenu(ev.target.value));
        addMenu?.addEventListener("click", async (ev) => {
          const btn = ev.target.closest("[data-add-key]");
          if (!btn) return;
          const actor = partyMembers().find((a) => a.uuid === addMenu.dataset.actorUuid);
          closeAddMenu();
          if (!actor) return;
          if (btn.dataset.addType === "condition") await addConditionTo(actor, btn.dataset.addKey);
          else await addItemTo(actor, btn.dataset.addKey);
        });
        // Слушатели на самом окне вешаем один раз: element живёт между перерисовками, иначе они копились бы
        if (!this._bound) {
          this._bound = true;
          root.addEventListener("click", (ev) => {
            if (!ev.target.closest(".pd-group-addfx-btn, .pd-group-addmenu")) this.element?.querySelector(".pd-group-addmenu")?.setAttribute("hidden", "");
          });
        }
        if (!this._hooks) {
          // Как в ядре: дебаунс, фильтр «касается ли это группы» и снятие хуков при закрытии
          const rerender = foundry.utils.debounce(() => { if (this.rendered) this.render(); }, 50);
          const inParty = (doc) => {
            const actor = doc?.actor ?? doc?.parent?.actor ?? doc?.parent ?? doc;
            return !!actor?.uuid && this._rows?.some((r) => r.uuid === actor.uuid);
          };
          const onParty = (doc) => inParty(doc) && rerender();
          this._hooks = [
            ["updateActor", Hooks.on("updateActor", onParty)],
            ["createItem", Hooks.on("createItem", onParty)],
            ["deleteItem", Hooks.on("deleteItem", onParty)],
            ["updateItem", Hooks.on("updateItem", onParty)],
            ["createActiveEffect", Hooks.on("createActiveEffect", onParty)],
            ["updateActiveEffect", Hooks.on("updateActiveEffect", onParty)],
            ["deleteActiveEffect", Hooks.on("deleteActiveEffect", onParty)],
            // Состав группы меняется вместе со сценой и выбором токенов - тут фильтровать нечего
            ["controlToken", Hooks.on("controlToken", rerender)],
            ["canvasReady", Hooks.on("canvasReady", rerender)],
            ["userConnected", Hooks.on("userConnected", rerender)]
          ];
        }
      }

      async _onClose(options) {
        await super._onClose(options);
        for (const [name, id] of this._hooks ?? []) Hooks.off(name, id);
        this._hooks = null;
        // Окно закрыто - его element уничтожен, при следующем открытии слушателей надо навесить заново
        this._bound = false;
        PaperdollTooltip.hide();
      }
    }

    game.keybindings?.register(ADDON_MODULE_ID, "openGroup", {
      name: "WFRPPD.Group.Hotkey.Name",
      hint: "WFRPPD.Group.Hotkey.Hint",
      editable: [{ key: "KeyG" }],
      restricted: true,
      onDown: () => {
        if (!game.user.isGM) return false;
        if (GroupApp._app?.rendered) GroupApp._app.close();
        else GroupApp.open();
        return true;
      }
    });

    // Сброс на стол: вещь из окна снаряжения (или сундука) на токен
    Hooks.on("dropCanvasData", (cnv, data) => {
      if (data?.type !== "Item" || !(data.fromPaperdoll || data.fromStash)) return;
      if (!util.option("tokenTransfer")) return;
      onDropCanvas(cnv, data);
      return false;
    });
    Hooks.once("ready", () => {
      game.socket?.on(SOCKET, async (msg) => {
        if (msg?.action !== "transfer" || !game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
        // Запрос из сети выполняем только от имени известного игрока - doTransfer проверит его права на вещь
        const userId = msg.payload?.userId;
        if (!userId || !game.users.get(userId)) return;
        await doTransfer({ ...msg.payload, userId });
      });
    });

    api.registerAddon({
      id: ADDON,
      title: "WFRPPD.Addon.party.Title",
      intro: "WFRPPD.Addon.party.Intro",
      icon: "fa-users",
      settings: [
        { key: "tokenTransfer", default: true },
        {
          key: "stashActor",
          scope: "world",
          type: String,
          default: "",
          name: "WFRPPD.Stash.Setting.Name",
          hint: "WFRPPD.Stash.Setting.Hint",
          actorSelect: { createLabel: "WFRPPD.Stash.Create", create: createStash }
        }
      ],
      // Кнопка сундука в сумке
      bagToolbar(app) {
        if (!app.editable || !stashActor()) return "";
        return `<button type="button" class="pd-stashbtn" title="${L("WFRPPD.Stash.Open")}" aria-label="${L("WFRPPD.Stash.Open")}"><i class="fa-solid fa-box-archive"></i></button>`;
      },
      onRender(app, root) {
        root.querySelector(".pd-stashbtn")?.addEventListener("click", (ev) => {
          ev.preventDefault();
          StashApp.open(app.actor);
        });
      },
      // Вещь из сундука, брошенная в сумку, - забрать себе
      async externalDrop(app, item, data) {
        if (!data?.fromStash || !app.editable) return false;
        await requestTransfer(item, app.actor);
        return true;
      }
    });
    api.openStash = (actor) => StashApp.open(actor);
    api.openGroup = () => GroupApp.open();
  }

  if (globalThis.__PD_MOCK__) register(globalThis.__PD_API__);
  else Hooks.once("wfrp4e-paperdoll.init", register);
})();
