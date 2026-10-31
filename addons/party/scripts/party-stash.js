/**
 * Общий сундук группы: персонаж-склад, окно сундука, выдача и возврат вещей.
 *
 * Отделено от party.js потому, что сундуку нужно снаружи всего шесть имён - это настоящая граница.
 * Окно группы так не вынести: ему требуется тридцать два, то есть почти весь остальной файл;
 * его разделение - это переделка самого GroupApp, а не перенос текста.
 *
 * Фабрика, а не обычный модуль: ядро отдаёт свои помощники через api.util уже в момент init,
 * импортом их не получить.
 */
export function makeStash(api, deps) {
  const { util } = api;
  const { MODULE_ID, esc, itemImg, L, F, COIN_VALUE, actorCoins } = util;
  const { sortItems, SORT_KEYS, itemRarity, uiArt, fitDropdown, matchesFilter, BAG_FILTERS } = util;
  const { PHYSICAL, actorByUuid, coinsHtml, groupCoins, requestTransfer, show } = deps;


  /** Персонаж-сундук из настроек мира */
  function stashActor() {
    const id = game.settings.get(MODULE_ID, "stashActor");
    return (id && game.actors?.get(id)) || null;
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

  return { stashActor, stashContents, stashSortMenuHtml, stashViewMenu, stashHtml, bindStash, StashApp };
}
