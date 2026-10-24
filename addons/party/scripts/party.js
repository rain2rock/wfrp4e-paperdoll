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

  function register(api) {
    const { PaperdollTooltip, util } = api;
    const { MODULE_ID, esc, itemImg, effectTooltip } = util;
    // Общее с ядром: локализация, деньги, тир ран и диалог снятия эффекта - чтобы логика не разъезжалась
    const { L, F, COIN_VALUE, actorCoins, changeActorMoney, woundsTier } = util;
    // Сундок рисуем разметкой ядра (сетка «При себе»), поэтому берём оттуда же сортировку, редкость и арт
    const { sortItems, SORT_KEYS, itemRarity, uiArt, fitDropdown } = util;
    // Действие по эффекту берём из ядра - одно на все окна
    const { effectAction, effectSheetFor, secondBarData, matchesFilter, BAG_FILTERS } = util;

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
        // Из общего сундука брать можно, но только СЕБЕ: иначе клиент мог бы гонять чужие вещи между актёрами
        const fromStash = item.parent.id === stashActor()?.id && target.testUserPermission?.(user, "OWNER");
        const mayTake = user && (user.isGM || item.parent.testUserPermission?.(user, "OWNER") || fromStash);
        if (!mayTake) {
          console.warn(`${MODULE_ID} | transfer refused: user has no ownership of "${item.parent.name}"`);
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
      // Сундук группы - общий ящик: из него берут все, даже без прав на самого актёра-сундук.
      // В этом случае просим ГМ, он и проверит права. Без ГМ в сети взять нечем - честно говорим об этом.
      const fromStash = item.parent.id === stashActor()?.id;
      if (!item.parent.isOwner && !fromStash) {
        ui.notifications.warn(L("WFRPPD.Transfer.NotYours"));
        return false;
      }
      if (!item.parent.isOwner && !game.users.activeGM) {
        ui.notifications.warn(L("WFRPPD.Transfer.NeedGM"));
        return false;
      }
      if (item.type === "container" && item.parent.items.some((i) => i.system?.location?.value === item.id)) {
        ui.notifications.warn(L("WFRPPD.Transfer.ContainerFull"));
        return false;
      }
      const qty = await askQuantity(item);
      if (!qty) return false;
      const payload = { itemUuid: item.uuid, targetUuid: target.uuid, qty };
      if (target.isOwner && item.parent.isOwner) await doTransfer(payload);
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

    /** Вещи сундука (без денег - они показаны монетами) и их суммарный вес */
    function stashContents(stash) {
      const items = (stash?.items ?? []).filter((i) => PHYSICAL.includes(i.type) && i.type !== "money");
      const weight = Math.round(items.reduce((n, i) => n + (Number(i.system?.encumbrance?.value) || 0) * (Number(i.system?.quantity?.value) || 1), 0) * 100) / 100;
      return { items, weight };
    }

    /** Меню сортировки сундука - одно и в его окне, и в заголовке ката окна группы */
    function stashSortMenuHtml() {
      return `
        <div class="pd-sortmenu-title">${esc(L("WFRPPD.Sort.Title"))}</div>
        ${SORT_KEYS.map((k) => `<button type="button" class="pd-sortopt ${k === StashApp.sort ? "is-active" : ""}" data-stash-sort="${k}">${esc(L(`WFRPPD.Sort.${k}`))}</button>`).join("")}
        ${stashViewMenu()}`;
    }

    /** Раздел «Вид» меню сундука: сетка или список с названиями - ключи локализации ядра */
    function stashViewMenu() {
      return `
        <div class="pd-sortmenu-title">${esc(L("WFRPPD.View.Title"))}</div>
        <button type="button" class="pd-sortopt ${StashApp.view !== "list" ? "is-active" : ""}" data-stash-view="grid">${esc(L("WFRPPD.View.grid"))}</button>
        <button type="button" class="pd-sortopt ${StashApp.view === "list" ? "is-active" : ""}" data-stash-view="list">${esc(L("WFRPPD.View.list"))}</button>`;
    }

    /** Разметка сундука - одна и для своего окна, и для «ката» в окне группы */
    function stashHtml() {
      const stash = stashActor();
  // Деньги показываем отдельной строкой сверху, как в карточке персонажа, а не ячейками в сетке
  const all = stashContents(stash).items;
  // Фильтры как в сумке игрока: пустые категории спрятаны, опустевший активный сбрасывается
  const filterCount = (key) => all.filter((i) => matchesFilter(i, key)).length;
  if (StashApp.filter !== "all" && !filterCount(StashApp.filter)) StashApp.filter = "all";
  const filters = BAG_FILTERS.map((key) => ({ key, label: L(`WFRPPD.Filter.${key}`), active: key === StashApp.filter, count: filterCount(key) }))
    .filter((f) => f.key === "all" || f.count > 0);
  const items = sortItems(all.filter((i) => matchesFilter(i, StashApp.filter)), StashApp.sort);
  const cells = items
    .map((i) => {
      const q = Number(i.system?.quantity?.value ?? 1);
      return `<div class="pd-item pd-stash-item rarity-${esc(itemRarity(i))}" draggable="true" data-item-id="${esc(i.id)}">
        <img src="${esc(itemImg(i.img, i.name))}" alt="">
        ${q > 1 ? `<span class="pd-qty">${q}</span>` : ""}
        <span class="pd-item-name rarity-${esc(itemRarity(i))}">${esc(i.name)}</span>
      </div>`;
    })
    .join("");
  // Пустые ячейки, как в блоке «При себе»: сетка всегда дорисована до ряда
  const perRow = 5;
  const empty = items.length ? (perRow - (items.length % perRow)) % perRow : perRow;
  const money = stash ? coinsHtml(groupCoins(stash), stash.uuid) : "";
  const weight = stashContents(stash).weight;

  return `<div class="pd-stash">
    <div class="pd-stash-top">
      <div class="pd-group-coins pd-stash-money" title="${esc(L("WFRPPD.Group.TreasuryHint"))}">${money}</div>
    </div>
    <section class="pd-bagsec pd-bagsec--loose pd-stash-drop">
      <header class="pd-bagsec-head">
        <img class="pd-bagsec-icon is-carried" src="${esc(uiArt("ui-carried"))}" alt="">
        <div class="pd-bagsec-title"><span class="pd-bagsec-name">${esc(stash?.name ?? L("WFRPPD.Stash.Title"))}</span></div>
        <span class="pd-bagsec-cap">${esc(L("WFRPPD.Bags.LooseShort"))} ${Math.round(weight * 100) / 100}</span>
      </header>
      <div class="pd-filters pd-stash-filters">
        <div class="pd-filter-chips">
          ${filters.map((f) => `<button type="button" class="pd-filter ${f.active ? "is-active" : ""}" data-stash-filter="${f.key}">${esc(f.label)} <span class="pd-filter-count">${f.count}</span></button>`).join("")}
        </div>
        <div class="pd-sort">
          <button type="button" class="pd-btn pd-sortbtn pd-stash-sortbtn" title="${esc(L("WFRPPD.Sort.Title"))}" aria-label="${esc(L("WFRPPD.Sort.Title"))}">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11M1.8 11.2 4 13.5l2.2-2.3M9 4h6M9 8h4.5M9 12h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="pd-sortmenu ${StashApp.sortOpen ? "is-open" : ""}">
            ${stashSortMenuHtml()}
          </div>
        </div>
      </div>
      <div class="pd-bag-list ${StashApp.view === "list" ? "is-list" : ""}">
        <div class="pd-bag-grid">
          ${cells}
          ${Array.from({ length: empty }, () => `<div class="pd-bag-cell"></div>`).join("")}
        </div>
      </div>
      <div class="pd-stash-hint">${esc(L("WFRPPD.Stash.Hint"))}</div>
    </section>
  </div>`;
    }

    /**
     * Обработчики сундука: подсказки, перетаскивание, забрать двойным кликом, монеты и сортировка.
     * Одни и те же для своего окна и для «ката» в окне группы - логика не двоится.
     * bindCoins=false, если окно уже обрабатывает .pd-coin само (окно группы).
     */
    function bindStash(root, { forActor = null, rerender = () => {}, bindCoins = true } = {}) {
      const stash = stashActor();
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
            if (forActor) await requestTransfer(item, forActor);
          });
        el.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            item.sheet?.render(true);
          });
      }
      // Монеты казны: ЛКМ прибавить, ПКМ убавить, с Shift - по 10 (как в карточке персонажа).
      // В окне группы (bindCoins: false) не вешаем - там свой общий обработчик всех .pd-coin
      for (const el of bindCoins ? root.querySelectorAll(".pd-stash-money .pd-coin") : []) {
        const step = (ev) => (ev.shiftKey ? 10 : 1);
        el.addEventListener("click", async (ev) => {
            ev.preventDefault();
            const a = actorByUuid(el.dataset.actorUuid);
            if (a) await changeActorMoney(a, el.dataset.coin, step(ev));
          });
        el.addEventListener("contextmenu", async (ev) => {
            ev.preventDefault();
            const a = actorByUuid(el.dataset.actorUuid);
            if (a) await changeActorMoney(a, el.dataset.coin, -step(ev));
          });
      }

      // Сортировка - та же, что в сумке
      const sortMenu = root.querySelector(".pd-sortmenu");
      if (StashApp.sortOpen && sortMenu) fitDropdown(sortMenu);
      root.querySelector(".pd-stash-sortbtn")?.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          StashApp.sortOpen = !StashApp.sortOpen;
          sortMenu?.classList.toggle("is-open", StashApp.sortOpen);
          if (StashApp.sortOpen && sortMenu) fitDropdown(sortMenu);
        });
      for (const b of root.querySelectorAll("[data-stash-filter]")) {
        b.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          StashApp.filter = b.dataset.stashFilter;
          rerender();
        });
      }
      for (const b of root.querySelectorAll("[data-stash-view]")) {
        b.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          StashApp.view = b.dataset.stashView;
          StashApp.sortOpen = false;
          rerender();
        });
      }
      for (const b of root.querySelectorAll("[data-stash-sort]")) {
        b.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            StashApp.sort = b.dataset.stashSort;
            StashApp.sortOpen = false;
            rerender();
          });
      }
      if (!root.dataset.pdStashBound) {
        root.dataset.pdStashBound = "1";
        root.addEventListener("click", (ev) => {
            if (ev.target.closest(".pd-sort")) return;
            StashApp.sortOpen = false;
            root.querySelector(".pd-sortmenu")?.classList.remove("is-open");
          });
      }

      // Положить: вещь из окна снаряжения (или листа) своего персонажа
      const drop = root.querySelector(".pd-stash-drop");
      drop?.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          drop.classList.add("is-drop");
        });
      drop?.addEventListener("dragleave", (ev) => {
          if (!drop.contains(ev.relatedTarget)) drop.classList.remove("is-drop");
        });
      drop?.addEventListener("drop", async (ev) => {
          ev.preventDefault();
          drop.classList.remove("is-drop");
          const TE = foundry.applications.ux.TextEditor.implementation;
          const data = TE.getDragEventData(ev);
          if (data?.type !== "Item" || !data.uuid || data.fromStash) return;
          const item = await fromUuid(data.uuid);
          if (item?.parent && item.parent !== stash) await requestTransfer(item, stash);
        });
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

      /** Сортировка, вид и фильтр сундука - свои, но ключи и код общие с сумкой (PD_UTIL) */
      static sort = "type";
      static sortOpen = false;
      static view = "grid";
      static filter = "all";

      async _renderHTML() {
        return stashHtml();
      }

      _replaceHTML(result, content) {
        content.innerHTML = result;
      }

      _onRender() {
        bindStash(this.element, { forActor: this.forActor, rerender: () => this.render() });

        // Сундук обновляется сам, когда кто-то кладёт или забирает вещи.
        // Хуки переподключаем на каждой перерисовке (сняв прежние): окно - синглтон, и при
        // переоткрытии старые замыкания иначе остаются висеть, а новые могут не встать.
        for (const [name, id] of this._hooks ?? []) Hooks.off(name, id);
        const stashUuid = () => stashActor()?.uuid ?? null;
        // Сверяем по uuid, а не по id: у несвязанных токенов id совпадают, uuid - нет
        const touchesStash = (doc) => {
          const u = stashUuid();
          if (!u) return false;
          const actor = doc?.parent?.actor ?? doc?.parent ?? doc;
          return actor?.uuid === u || doc?.uuid === u;
        };
        const rerender = foundry.utils.debounce((doc) => {
          if (this.rendered && touchesStash(doc)) this.render();
        }, 50);
        this._hooks = [
          ["createItem", Hooks.on("createItem", rerender)],
          ["updateItem", Hooks.on("updateItem", rerender)],
          ["deleteItem", Hooks.on("deleteItem", rerender)],
          ["updateActor", Hooks.on("updateActor", rerender)]
        ];
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
    /** Кто из игроков владеет персонажем и в сети ли он (для значка статуса) */
    function ownersOf(actor) {
      return (game.users ?? []).filter((u) => !u.isGM && actor.testUserPermission?.(u, "OWNER"));
    }

    function partyMembers() {
      if (partyCache) return partyCache;
      if (globalThis.__PD_MOCK__) return (partyCache = (window.__PD_actors ?? []).filter((a) => a.type === "character"));
      const onlyOnline = util.setting("groupScope", "all") === "online";
      const seen = new Set();
      const out = [];
      for (const t of canvas?.tokens?.placeables ?? []) {
        const a = t.actor;
        // Несвязанные токены - самостоятельные копии: у них свой uuid, по нему и различаем (у связанных он общий)
        if (!a || a.type !== "character" || !a.hasPlayerOwner || seen.has(a.uuid)) continue;
        // «Только онлайн» отсеивает здесь; «все» и «все со статусом» берут любых игровых персонажей
        if (onlyOnline && !ownersOf(a).some((u) => u.active)) continue;
        seen.add(a.uuid);
        out.push(a);
      }
      // Сначала те, чьи игроки в сети, потом остальные - внутри каждой группы по алфавиту
      const online = (a) => (globalThis.__PD_MOCK__ ? true : ownersOf(a).some((u) => u.active));
      return (partyCache = out.sort(
        (x, y) => Number(online(y)) - Number(online(x)) || x.name.localeCompare(y.name, game.i18n?.lang)
      ));
    }
    const invalidateParty = () => { partyCache = null; };

    /** Персонаж по uuid: участник группы или сундук - на него тоже кликают и бросают вещи */
    function actorByUuid(uuid) {
      if (!uuid) return null;
      const stash = stashActor();
      if (stash?.uuid === uuid) return stash;
      return partyMembers().find((a) => a.uuid === uuid) ?? null;
    }

    /** Токен персонажа на сцене: клик - выбрать, двойной - ещё и перевести камеру */
    function pickToken(uuid, pan) {
      const token = (canvas?.tokens?.placeables ?? []).find((t) => t.actor?.uuid === uuid);
      if (!token) {
        ui.notifications?.info(L("WFRPPD.Group.NoToken"));
        return;
      }
      token.control({ releaseOthers: true });
      if (pan) canvas.animatePan({ x: token.center.x, y: token.center.y });
    }

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
    async function addConditionTo(actor, key, count = 1) {
      const n = Math.max(1, Math.floor(Number(count) || 1));
      try {
        if (typeof actor.addCondition === "function") {
          // Принимает ли системный метод количество - на живом мире не проверено,
          // поэтому не надеемся на второй аргумент, а зовём по разу: результат одинаков в обоих случаях
          for (let i = 0; i < n; i++) await actor.addCondition(key, 1);
          return true;
        }
        const cfg = game.wfrp4e?.config ?? {};
        const status = (CONFIG.statusEffects ?? []).find((s) => s.id === key);
        await actor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: L(cfg.conditions?.[key] ?? key),
            img: status?.img ?? status?.icon,
            statuses: [key],
            conditionValue: n,
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
      // Лента - ТЕМ ЖЕ конвейером, что в окне куколки (PaperdollApp.effectsFor): иначе травмы,
      // мутации, криты и болезни (это предметы, а не ActiveEffects) в окне группы не показывались
      const effects = api.PaperdollApp.effectsFor(actor, { editable: true });
      return {
        uuid: actor.uuid,
        name: actor.name,
        img: itemImg(actor.img, actor.name),
        wounds: { ...wounds, tier: woundsTier(wounds.value, wounds.max) },
        fortune: { value: fortune, max: fate },
        ap: { head: ap("head"), body: ap("body"), rArm, lArm, rLeg, lLeg },
        money: groupCoins(actor),
        // Кто за персонажем и в сети ли: нужно для режима «все со статусом»
        online: globalThis.__PD_MOCK__ ? true : ownersOf(actor).some((u) => u.active),
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

    /** Общие цветовые классы и доля заполнения для строки/карточки персонажа */
    function rowVisuals(r) {
      return {
        // По макету: 3/11 красным, 9/11 оранжевым, целый - обычным цветом
        woundsCls: ["dying", "critical"].includes(r.wounds.tier) ? "is-down" : ["heavy", "wounded"].includes(r.wounds.tier) ? "is-warn" : "",
        woundsPct: pct(r.wounds.value, r.wounds.max),
        fortuneCls: r.fortune.max && r.fortune.value === 0 ? "is-down" : r.fortune.max && r.fortune.value >= r.fortune.max ? "is-up" : "",
        fortunePct: pct(r.fortune.value, r.fortune.max)
      };
    }

    /**
     * Фото персонажа со значком «в сети / не в сети» в правом нижнем углу.
     * Значок показываем всегда: отдельный режим «со статусом» убран, он только плодил варианты.
     */
    function portrait(r, cls = "") {
      const on = r.online;
      return `<span class="pd-group-portrait ${cls}">
        <img src="${esc(r.img)}" alt="">
        <i class="pd-group-dot ${on ? "is-on" : "is-off"}" title="${esc(L(on ? "WFRPPD.Group.Online" : "WFRPPD.Group.Offline"))}"></i>
      </span>`;
    }

    /** Эффекты - иконки (подробности при наведении) + кнопка «+» добавить состояние, общие для карточки и таблицы */
    function groupFx(r) {
      // Разметка как в ленте эффектов основного окна: иконка плюс значки уровня и длительности.
      // Раньше тут была голая картинка, поэтому у ГМ не было видно ни уровня, ни «сколько осталось».
      const icons = r.effects.length
        ? r.effects
            .map(
              (e) => `<span class="pd-group-fx-icon pd-effect pd-effect--${esc(e.kind)} ${e.passive ? "is-passive" : ""}"
                        data-actor-uuid="${esc(r.uuid)}" data-effect-id="${esc(e.id)}" title="${esc(e.name)}">
                        <img src="${esc(itemImg(e.img, e.name))}" alt="">
                        ${e.value ? `<span class="pd-effect-value">${esc(e.value)}</span>` : ""}
                        ${e.left?.short ? `<span class="pd-effect-left">${esc(e.left.short)}</span>` : ""}
                      </span>`
            )
            .join("")
        : "";
      return `${icons}<button type="button" class="pd-group-addfx-btn" data-actor-uuid="${esc(r.uuid)}" title="${esc(L("WFRPPD.Group.AddCondition"))}" aria-label="${esc(L("WFRPPD.Group.AddCondition"))}">+</button>`;
    }

    /** Монетки персонажа - кликабельные иконки, как в основном окне (ЛКМ +1, ПКМ -1, Shift ×10) */
    function groupCoinsHtml(r) {
      return coinsHtml(r.money, r.uuid);
    }

    /** Кликабельные монеты по номиналам - одинаково у персонажа и у казны группы */
    function coinsHtml(money, uuid) {
      return money
        .map(
          (c) =>
            `<span class="pd-coin pd-coin--${c.key} ${c.img ? "has-img" : ""}" data-actor-uuid="${esc(uuid)}" data-coin="${c.key}" title="${esc(L(`WFRPPD.Money.Name.${c.key}`))}">${
              c.img ? `<img src="${esc(c.img)}" alt="">` : ""
            }${c.value}</span>`
        )
        .join("");
    }

    /** Что показывать: имя и фото всегда, остальное - по настройкам; карточки и таблица отдельно */
    const show = (what) => util.option(`groupShow${what}`) !== false;
    const showT = (what) => util.option(`groupTableShow${what}`) !== false;

    /** Доп. колонки таблицы: значение и максимум считает тот же код, что вторую полосу карточек */
    const TABLE_EXTRA = ["Xp", "Resolve", "Corruption", "Advantage"];
    const extraKind = { Xp: "xp", Resolve: "resolve", Corruption: "corruption", Advantage: "advantage" };

    /**
     * Таблица - CSS Grid с одним шаблоном колонок на шапку и все строки разом:
     * «Персонаж» по содержимому, числовые колонки по заголовку, всё оставшееся - эффектам.
     * Шаблон собирается здесь же из включённых колонок, поэтому скрытие ничего не ломает.
     */
    function groupTable(rows) {
      const big = util.option("groupBigFx") !== false;
      // [заголовок, html-ячейки]
      const cols = [];
      if (showT("Wounds"))
        cols.push([
          L("WFRPPD.Wounds"),
          (r, v) => `<div class="pd-group-cell pd-group-cell--num pd-group-wounds" data-actor-uuid="${esc(r.uuid)}"><span class="${v.woundsCls}">${r.wounds.value} / ${r.wounds.max}</span></div>`
        ]);
      if (showT("Fortune"))
        cols.push([L("WFRPPD.Stats.Fortune"), (r, v) => `<div class="pd-group-cell pd-group-cell--num pd-group-cell--fortune"><span class="${v.fortuneCls}">${r.fortune.value} / ${r.fortune.max}</span></div>`]);
      for (const k of TABLE_EXTRA.filter(showT))
        cols.push([
          L(`WFRPPD.Vitals.Second.${extraKind[k]}`),
          (r, v, actor) => {
            const d = secondBarData(actor, extraKind[k]);
            // Опыт - просто свободный, дробь «из заработанного» тут только шумит
            const text = extraKind[k] === "xp" ? d.value : `${d.value}${d.max ? ` / ${d.max}` : ""}`;
            return `<div class="pd-group-cell pd-group-cell--num pd-group-cell--extra" title="${esc(d.hint)}">${text}</div>`;
          }
        ]);
      const fx = showT("Effects");
      const template = `minmax(170px, max-content)${cols.map(() => " max-content").join("")}${fx ? " minmax(190px, 1fr)" : ""}`;
      const row = (r) => {
        const v = rowVisuals(r);
        const actor = actorByUuid(r.uuid);
        return `
          <div class="pd-group-row pd-group-drop" data-actor-uuid="${esc(r.uuid)}">
            <div class="pd-group-cell pd-group-who pd-group-pick" data-actor-uuid="${esc(r.uuid)}" title="${esc(L("WFRPPD.Group.PickHint"))}">
              ${portrait(r)}
              <div class="pd-group-card-id">
                <span class="pd-group-name">${esc(r.name)}</span>
                ${showT("Money") ? `<div class="pd-group-coins pd-group-card-money">${groupCoinsHtml(r)}</div>` : ""}
              </div>
            </div>
            ${cols.map(([, cell]) => cell(r, v, actor)).join("")}
            ${fx ? `<div class="pd-group-cell"><div class="pd-group-fx ${big ? "is-big" : ""}">${groupFx(r)}</div></div>` : ""}
          </div>`;
      };
      return `
        <div class="pd-group-table">
          <div class="pd-group-tbl" style="grid-template-columns: ${template}">
            <div class="pd-group-head">
              <div class="pd-group-cell">${esc(L("WFRPPD.Group.Character"))}</div>
              ${cols
                .map((c, i) => [c[0], i])
                .map(([label, i]) => `<div class="pd-group-cell pd-group-cell--num ${i >= (showT("Wounds") ? 1 : 0) + (showT("Fortune") ? 1 : 0) ? "pd-group-cell--extra" : ""}">${esc(label)}</div>`)
                .join("")}
              ${fx ? `<div class="pd-group-cell">${esc(L("WFRPPD.Group.Effects"))}</div>` : ""}
            </div>
            ${rows.map(row).join("")}
          </div>
        </div>`;
    }

    /**
     * Карточка персонажа - по макету: фото с точкой статуса, рядом имя и монеты,
     * ниже полосы ран и удачи с подписью прямо внутри, ниже сетка эффектов.
     * Полоса показывает и заполнение, и число - цифры дублируются в подписи.
     */
    function groupCard(r) {
      // Полосы - та же разметка .pd-vital, что в основном окне: градиентные текстуры,
      // тот же шрифт и цвет подписи. Вторая полоса выбирается шестерёнкой, как там же.
      const actor = actorByUuid(r.uuid);
      const second = secondBarData(actor, (util.setting("groupSecondBars", {}) ?? {})[r.uuid] ?? "fortune");
      const vital = (cls, pct, label, value, max, extra = "") => `
        <div class="pd-vital ${cls}">
          <div class="pd-vital-fill" style="width: ${pct}%"></div>
          <span>${esc(label)} ${value} / ${max}</span>
          ${extra}
        </div>`;
      const opts = `
        <button type="button" class="pd-vital-opts pd-group-vopts" title="${esc(L("WFRPPD.Vitals.SecondPick"))}"><img src="${esc(uiArt("ui-options"))}" alt=""></button>
        <div class="pd-sortmenu pd-group-barmenu">
          <div class="pd-sortmenu-title">${esc(L("WFRPPD.Vitals.SecondPick"))}</div>
          ${second.options.map((o) => `<button type="button" class="pd-sortopt ${o.active ? "is-active" : ""}" data-gbar="${o.key}">${esc(o.label)}</button>`).join("")}
        </div>`;
      return `
        <div class="pd-group-card pd-group-drop" data-actor-uuid="${esc(r.uuid)}">
          <div class="pd-group-card-head pd-group-pick" data-actor-uuid="${esc(r.uuid)}" title="${esc(L("WFRPPD.Group.PickHint"))}">
            ${portrait(r, "is-large")}
            <div class="pd-group-card-id">
              <span class="pd-group-name">${esc(r.name)}</span>
              ${show("Money") ? `<div class="pd-group-coins pd-group-card-money">${groupCoinsHtml(r)}</div>` : ""}
            </div>
          </div>
          ${show("Wounds") ? `<div class="pd-group-wounds" data-actor-uuid="${esc(r.uuid)}">${vital(`pd-vital--wounds is-${r.wounds.tier}`, rowVisuals(r).woundsPct, L("WFRPPD.Wounds"), r.wounds.value, r.wounds.max)}</div>` : ""}
          ${show("Fortune") ? vital(`pd-vital--second pd-vital--${esc(second.kind)}`, second.pct, second.label, second.value, second.max, opts) : ""}
          ${show("Effects") ? `<div class="pd-group-card-fx ${util.option("groupBigFx") !== false ? "is-big" : ""}">${groupFx(r)}</div>` : ""}
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
        const view = util.setting("groupView", "card");
        const scope = util.setting("groupScope", "all");
        const body = !rows.length
          ? `<div class="pd-group-empty">${esc(L(scope === "online" ? "WFRPPD.Group.EmptyOnline" : "WFRPPD.Group.Empty"))}</div>`
          : view === "card"
            ? `<div class="pd-group-cards size-${esc(util.setting("groupCardSize", "m"))}">${rows.map(groupCard).join("")}</div>`
            : groupTable(rows);
        const stash = stashActor();
        // Казна - такие же кликабельные монеты, как у персонажей. Сам сундук - аккордеоном ниже списка
        const treasury = stash
          ? `<div class="pd-group-treasury">
              <div class="pd-group-coins" title="${esc(L("WFRPPD.Group.TreasuryHint"))}">${coinsHtml(groupCoins(stash), stash.uuid)}</div>
            </div>`
          : "";
        // Сундук «под катом»: заголовок с числом предметов, внутри - та же разметка, что в отдельном окне
        const { items: stashList, weight: stashWeight } = stashContents(stash);
        const stashItems = stashList.length;
        const stashBlock = stash
          ? `<details class="pd-group-stashcut" ${GroupApp.stashOpen ? "open" : ""}>
              <summary>
                <i class="fa-solid fa-box-archive"></i> ${esc(stash.name)} <span class="pd-group-stashcount">${stashItems}</span>
                <span class="pd-group-stashweight">${esc(L("WFRPPD.Bags.LooseShort"))} ${stashWeight}</span>
              </summary>
              <div class="pd-group-stashbody">${stashHtml()}</div>
            </details>`
          : "";
        return `
          <div class="pd-group">
            <div class="pd-group-toolbar">
              <button type="button" class="pd-btn pd-group-session"><i class="fa-solid fa-sun"></i> ${esc(L("WFRPPD.Group.Session"))}</button>
              <div class="pd-group-display">
                <button type="button" class="pd-btn pd-group-display-btn" title="${esc(L("WFRPPD.Group.DisplayHint"))}">
                  <i class="fa-solid fa-sliders"></i> ${esc(L("WFRPPD.Group.Display"))}
                </button>
                <div class="pd-sortmenu pd-group-displaymenu ${GroupApp.displayOpen ? "is-open" : ""}">
                  <div class="pd-sortmenu-title">${esc(L("WFRPPD.Group.View"))}</div>
                  ${["card", "table"]
                    .map((k) => `<button type="button" class="pd-sortopt ${view === k ? "is-active" : ""}" data-view="${k}">${esc(L(k === "card" ? "WFRPPD.Group.ViewCard" : "WFRPPD.Group.ViewTable"))}</button>`)
                    .join("")}
                  <div class="pd-sortmenu-title">${esc(L("WFRPPD.Group.ScopeTitle"))}</div>
                  ${["all", "online"]
                    .map((k) => `<button type="button" class="pd-sortopt ${scope === k ? "is-active" : ""}" data-scope="${k}"
                          title="${esc(L(`WFRPPD.Group.Scope.${k}Hint`))}">${esc(L(`WFRPPD.Group.Scope.${k}`))}</button>`)
                    .join("")}
                  ${view === "card"
                    ? `<div class="pd-sortmenu-title">${esc(L("WFRPPD.Group.Show"))}</div>
                       ${["Wounds", "Fortune", "Money", "Effects"]
                         .map((k) => `<button type="button" class="pd-sortopt pd-group-toggle ${show(k) ? "is-active" : ""}" data-show="${k}">${esc(
                           L(k === "Fortune" ? "WFRPPD.Group.ShowSecond" : `WFRPPD.Group.Show${k}`)
                         )}</button>`)
                         .join("")}`
                    : `<div class="pd-sortmenu-title">${esc(L("WFRPPD.Group.ShowTable"))}</div>
                       ${["Wounds", "Fortune", "Money", "Effects", "Xp", "Resolve", "Corruption", "Advantage"]
                         .map((k) => `<button type="button" class="pd-sortopt pd-group-toggle ${showT(k) ? "is-active" : ""}" data-show-table="${k}">${esc(
                           ["Xp", "Resolve", "Corruption", "Advantage"].includes(k) ? L(`WFRPPD.Vitals.Second.${extraKind[k]}`) : L(`WFRPPD.Group.Show${k}`)
                         )}</button>`)
                         .join("")}`}
                  ${(view === "card" ? show("Effects") : showT("Effects"))
                    ? `<div class="pd-sortmenu-title">${esc(L("WFRPPD.Group.FxSize"))}</div>
                       <button type="button" class="pd-sortopt ${util.option("groupBigFx") !== false ? "is-active" : ""}" data-bigfx="big">${esc(L("WFRPPD.Group.FxBig"))}</button>
                       <button type="button" class="pd-sortopt ${util.option("groupBigFx") !== false ? "" : "is-active"}" data-bigfx="small">${esc(L("WFRPPD.Group.FxSmall"))}</button>`
                    : ""}
                </div>
              </div>
              ${treasury}
            </div>
            ${body}
            ${stashBlock}
            <div class="pd-group-addmenu" hidden>
              <div class="pd-group-addmenu-top">
                <input type="text" class="pd-group-addmenu-search" placeholder="${esc(L("WFRPPD.Group.AddConditionSearch"))}">
                <label class="pd-group-addmenu-count" title="${esc(L("WFRPPD.Group.AddCountHint"))}">
                  ×<input type="number" min="1" max="20" value="1">
                </label>
              </div>
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
        // Одна панель «Отображение»: вид, состав и какие данные показывать.
        // Всё хранится в настройках, поэтому выбор переживает закрытие окна.
        const displayMenu = root.querySelector(".pd-group-displaymenu");
        if (GroupApp.displayOpen && displayMenu) fitDropdown(displayMenu);
        root.querySelector(".pd-group-display-btn")?.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          GroupApp.displayOpen = !GroupApp.displayOpen;
          displayMenu?.classList.toggle("is-open", GroupApp.displayOpen);
          if (GroupApp.displayOpen && displayMenu) fitDropdown(displayMenu);
        });
        const setAndRender = async (key, value, dropCache = false) => {
          await game.settings.set(MODULE_ID, key, value);
          if (dropCache) invalidateParty();
          this.render();
        };
        for (const btn of root.querySelectorAll(".pd-group-displaymenu [data-view]"))
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            setAndRender("groupView", btn.dataset.view);
          });
        for (const btn of root.querySelectorAll(".pd-group-displaymenu [data-scope]"))
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            setAndRender("groupScope", btn.dataset.scope, true);
          });
        for (const btn of root.querySelectorAll(".pd-group-displaymenu [data-show]"))
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const key = `groupShow${btn.dataset.show}`;
            setAndRender(key, !(util.option(key) !== false));
          });
        for (const btn of root.querySelectorAll(".pd-group-displaymenu [data-show-table]"))
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const key = `groupTableShow${btn.dataset.showTable}`;
            setAndRender(key, !(util.option(key) !== false));
          });
        // Выбор второй полосы в карточках: шестерёнка на полосе, как в основном окне
        for (const btn of root.querySelectorAll(".pd-group-vopts"))
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const menu = btn.parentElement.querySelector(".pd-group-barmenu");
            const wasOpen = menu?.classList.contains("is-open");
            for (const m of root.querySelectorAll(".pd-group-barmenu")) m.classList.remove("is-open");
            if (!wasOpen && menu) {
              menu.classList.add("is-open");
              fitDropdown(menu);
            }
          });
        for (const btn of root.querySelectorAll(".pd-group-barmenu [data-gbar]"))
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            // Выбор - только для этого персонажа: у каждого может быть свой показатель
            const uuid = btn.closest(".pd-group-card")?.dataset.actorUuid;
            if (!uuid) return;
            const map = { ...(util.setting("groupSecondBars", {}) ?? {}) };
            map[uuid] = btn.dataset.gbar;
            setAndRender("groupSecondBars", map);
          });
        for (const btn of root.querySelectorAll(".pd-group-displaymenu [data-bigfx]"))
          btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            setAndRender("groupBigFx", btn.dataset.bigfx === "big");
          });
        for (const el of root.querySelectorAll(".pd-group-fx-icon")) {
          const actorOf = () => partyMembers().find((a) => a.uuid === el.dataset.actorUuid);
          const entryOf = () => this._rows?.find((r) => r.uuid === el.dataset.actorUuid)?.effects.find((e) => e.id === el.dataset.effectId);
          // Поведение общее с лентой эффектов основного окна - один и тот же effectAction,
          // чтобы «ЛКМ - снять, Shift+ЛКМ - снять совсем, ПКМ - подробнее» не разъезжалось по окнам
          el.addEventListener("click", async (ev) => {
            ev.preventDefault();
            PaperdollTooltip.hide();
            const actor = actorOf();
            const entry = entryOf();
            if (actor && entry) await effectAction(actor, entry, ev);
          });
          el.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            PaperdollTooltip.hide();
            const actor = actorOf();
            const entry = entryOf();
            if (actor && entry) effectSheetFor(actor, entry);
          });
          // Подробности при наведении - та же карточка, что и в ленте эффектов основного окна
          el.addEventListener("pointerenter", (ev) => {
            const entry = entryOf();
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
            const actor = actorByUuid(el.dataset.actorUuid);
            if (actor) await changeActorMoney(actor, el.dataset.coin, step(ev));
          });
          el.addEventListener("contextmenu", async (ev) => {
            ev.preventDefault();
            const actor = actorByUuid(el.dataset.actorUuid);
            if (actor) await changeActorMoney(actor, el.dataset.coin, -step(ev));
          });
        }
        // Имя и фото: ЛКМ - выбрать токен на сцене, двойной клик - ещё и перевести к нему камеру.
        // Таймер не нужен: двойной клик сначала выберет токен (дважды, что безвредно), потом переведёт камеру.
        for (const el of root.querySelectorAll(".pd-group-pick")) {
          // Монеты лежат внутри кликабельной шапки: их клики - про деньги, не про выбор токена
          const notCoin = (ev) => !ev.target.closest(".pd-coin");
          el.addEventListener("click", (ev) => {
            if (!notCoin(ev)) return;
            ev.preventDefault();
            pickToken(el.dataset.actorUuid, false);
          });
          el.addEventListener("dblclick", (ev) => {
            if (!notCoin(ev)) return;
            ev.preventDefault();
            pickToken(el.dataset.actorUuid, true);
          });
        }

        // Перетаскивание вещи из окна снаряжения (или сундука) прямо на карточку персонажа
        for (const el of root.querySelectorAll(".pd-group-drop")) {
          el.addEventListener("dragover", (ev) => {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
            el.classList.add("is-drop");
          });
          el.addEventListener("dragleave", () => el.classList.remove("is-drop"));
          el.addEventListener("drop", async (ev) => {
            ev.preventDefault();
            el.classList.remove("is-drop");
            let data = null;
            try {
              data = JSON.parse(ev.dataTransfer.getData("text/plain"));
            } catch {
              return;
            }
            if (data?.type !== "Item" || !data.uuid) return;
            const target = actorByUuid(el.dataset.actorUuid);
            const item = await fromUuid(data.uuid);
            if (item && target) await requestTransfer(item, target);
          });
        }

        // Сундук под катом: та же разметка и те же обработчики, что в отдельном окне.
        // Монеты не вешаем (bindCoins: false) - окно группы уже обрабатывает все .pd-coin у себя.
        const cut = root.querySelector(".pd-group-stashcut");
        if (cut) {
          cut.addEventListener("toggle", () => {
            GroupApp.stashOpen = cut.open;
          });
          bindStash(cut, { forActor: game.user.character ?? null, rerender: () => this.render(), bindCoins: false });
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
          const count = Number(addMenu.querySelector(".pd-group-addmenu-count input")?.value) || 1;
          if (btn.dataset.addType === "condition") await addConditionTo(actor, btn.dataset.addKey, count);
          else await addItemTo(actor, btn.dataset.addKey);
        });
        // Слушатели на самом окне вешаем один раз: element живёт между перерисовками, иначе они копились бы
        if (!this._bound) {
          this._bound = true;
          root.addEventListener("click", (ev) => {
            if (!ev.target.closest(".pd-group-addfx-btn, .pd-group-addmenu")) this.element?.querySelector(".pd-group-addmenu")?.setAttribute("hidden", "");
            if (!ev.target.closest(".pd-group-display")) {
              GroupApp.displayOpen = false;
              this.element?.querySelector(".pd-group-displaymenu")?.classList.remove("is-open");
            }
          });
        }
        if (!this._hooks) {
          // Как в ядре: дебаунс, фильтр «касается ли это группы» и снятие хуков при закрытии
          const rerender = foundry.utils.debounce(() => { if (this.rendered) this.render(); }, 50);
          const inParty = (doc) => {
            const actor = doc?.actor ?? doc?.parent?.actor ?? doc?.parent ?? doc;
            if (!actor?.uuid) return false;
            // Сундука нет среди строк, но его казна висит в шапке - иначе она обновлялась бы только при переоткрытии
            return actor.uuid === stashActor()?.uuid || !!this._rows?.some((r) => r.uuid === actor.uuid);
          };
          // Вещи сундука видны в аккордеоне, значит их создание и удаление тоже перерисовывает окно
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

    // Неймспейс ЯДРА: модуль теперь единый, отдельного "wfrp4e-paperdoll-party" у пользователя нет,
    // а чужой неймспейс Foundry отвергает с ошибкой - из-за этого у чистой установки падал весь register()
    game.keybindings?.register(MODULE_ID, "openGroup", {
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
        // Ширина карточки в окне группы: от неё же зависит, сколько их влезет в ряд
        { key: "groupCardSize", type: String, default: "m", choices: { s: "WFRPPD.Group.Size.s", m: "WFRPPD.Group.Size.m", l: "WFRPPD.Group.Size.l" } },
        // Вид и состав окна группы - запоминаются между сессиями, меняются из самого окна («Отображение»)
        { key: "groupView", type: String, default: "card", choices: { card: "WFRPPD.Group.ViewCard", table: "WFRPPD.Group.ViewTable" } },
        { key: "groupScope", type: String, default: "all", choices: { all: "WFRPPD.Group.Scope.all", online: "WFRPPD.Group.Scope.online" } },
        // Что показывать в строке персонажа. Имя и фото скрыть нельзя - без них строку не опознать
        // Крупные иконки эффектов: видно длительность и стаки прямо на карточке
        { key: "groupBigFx", default: true },
        // Вторая полоса карточек ГМ - как в основном окне; выбор хранится НА КАЖДОГО персонажа
        { key: "groupSecondBars", type: Object, default: {} },
        // Карточки и таблица настраиваются отдельно - у таблицы колонок больше
        { key: "groupShowWounds", default: true },
        { key: "groupShowFortune", default: true },
        { key: "groupShowMoney", default: true },
        { key: "groupShowEffects", default: true },
        { key: "groupTableShowWounds", default: true },
        { key: "groupTableShowFortune", default: true },
        { key: "groupTableShowMoney", default: true },
        { key: "groupTableShowEffects", default: true },
        { key: "groupTableShowXp", default: false },
        { key: "groupTableShowResolve", default: false },
        { key: "groupTableShowCorruption", default: false },
        { key: "groupTableShowAdvantage", default: false },
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
      // Сундук теперь не кнопка в панели, а отдельный блок под «При себе (вне сумок)» -
      // рисуем его разметкой ядра, но вместо ячеек внутри одна кнопка «Открыть сундук группы»
      onRender(app, root) {
        const list = root.querySelector(".pd-bag-list");
        if (!list || !app.editable || !stashActor()) return;
        if (list.querySelector(".pd-stash-section")) return;
        const sec = document.createElement("section");
        sec.className = "pd-bagsec pd-bagsec--loose pd-stash-section";
        sec.innerHTML = `
          <header class="pd-bagsec-head">
            <img class="pd-bagsec-icon is-carried" src="${esc(uiArt("ui-carried"))}" alt="">
            <div class="pd-bagsec-title"><span class="pd-bagsec-name">${esc(stashActor()?.name ?? L("WFRPPD.Stash.Title"))}</span></div>
          </header>
          <div class="pd-bag-grid pd-stash-section-body">
            <button type="button" class="pd-btn pd-stash-open">${esc(L("WFRPPD.Group.OpenStashBlock"))}</button>
          </div>`;
        list.append(sec);
        sec.querySelector(".pd-stash-open")?.addEventListener("click", (ev) => {
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
