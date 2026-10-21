/**
 * Дополнение «Группа» для окна снаряжения WFRP4e.
 * Передача вещей: перетащи вещь из окна на токен на игровом столе - она перейдёт его персонажу.
 * Общий сундук: персонаж-склад, который выбирает (или создаёт) ГМ; окно сундука, положить и забрать перетаскиванием.
 * Чужому персонажу передачу выполняет ГМ через сокет. Требует модуль ядра wfrp4e-paperdoll.
 */
(() => {
  const ADDON = "party";

  function register(api) {
    const { PaperdollTooltip, util } = api;
    const { MODULE_ID, itemImg } = util;
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);

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

    /** Сама передача: выполняет владелец обоих персонажей или ГМ */
    async function doTransfer({ itemUuid, targetUuid, qty }) {
      const item = await fromUuid(itemUuid);
      const target = await fromUuid(targetUuid);
      if (!item || !target || item.parent === target) return;
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
      else if (game.users.activeGM) game.socket.emit(SOCKET, { action: "transfer", payload });
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
    const esc = (s) => foundry.utils.escapeHTML?.(String(s ?? "")) ?? String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
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
        if (!this._hooked) {
          this._hooked = true;
          const rerender = (doc) => {
            if (this.rendered && doc?.parent?.id === stashActor()?.id) this.render();
          };
          Hooks.on("createItem", rerender);
          Hooks.on("updateItem", rerender);
          Hooks.on("deleteItem", rerender);
        }
      }
    }


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
        await doTransfer(msg.payload);
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
  }

  if (globalThis.__PD_MOCK__) register(globalThis.__PD_API__);
  else Hooks.once("wfrp4e-paperdoll.init", register);
})();
