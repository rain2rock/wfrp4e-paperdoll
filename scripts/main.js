import { PaperdollApp, MODULE_ID, uiArt, PD_OPTIONS, option } from "./paperdoll-app.js";

const SUPPORTED_TYPES = ["character", "npc", "creature"];

Hooks.once("init", () => {
  const rerender = () => PaperdollApp.renderAll();
  game.settings.register(MODULE_ID, "itemIcons", {
    name: "WFRPPD.Settings.ItemIcons.Name",
    hint: "WFRPPD.Settings.ItemIcons.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: rerender
  });

  // Опции куколки - в настройках Foundry (вкладка модуля), у каждого игрока свои
  for (const [key, def] of Object.entries(PD_OPTIONS)) {
    game.settings.register(MODULE_ID, key, {
      name: `WFRPPD.Options.${key}.Name`,
      hint: `WFRPPD.Options.${key}.Hint`,
      scope: "client",
      config: true,
      type: Boolean,
      default: def,
      onChange: rerender
    });
  }

  // Доступ из макросов: game.modules.get("wfrp4e-paperdoll").api.open(actor)
  game.modules.get(MODULE_ID).api = {
    open: (actor) => PaperdollApp.openFor(actor)
  };
});

/**
 * Двойной клик по токену открывает снаряжение вместо листа (опция, у каждого игрока своя).
 * Alt + двойной клик - обычный лист. Без прав наблюдателя - как в Foundry.
 */
Hooks.once("ready", () => {
  if (game.system.id !== "wfrp4e") return;
  const TokenCls = foundry.canvas?.placeables?.Token ?? globalThis.Token;
  const proto = TokenCls?.prototype;
  if (!proto?._onClickLeft2) return;
  const original = proto._onClickLeft2;
  proto._onClickLeft2 = function (event) {
    try {
      const actor = this.actor;
      const alt = !!(event?.altKey ?? event?.nativeEvent?.altKey ?? event?.data?.originalEvent?.altKey);
      if (
        option("tokenDblClick") &&
        !alt &&
        actor &&
        SUPPORTED_TYPES.includes(actor.type) &&
        actor.testUserPermission?.(game.user, "OBSERVER")
      ) {
        PaperdollApp.openFor(actor);
        return;
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | token double-click`, err);
    }
    return original.call(this, event);
  };
});

/**
 * Кнопка в шапке листа персонажа.
 * Хук renderActorSheetV2 срабатывает для всех листов актёров на AppV2,
 * включая листы WFRP4e 9.x.
 */
Hooks.on("renderActorSheetV2", (app, element) => {
  if (game.system.id !== "wfrp4e") return;
  const actor = app.document;
  if (!actor || !SUPPORTED_TYPES.includes(actor.type)) return;

  const header = app.window?.header ?? element.querySelector(".window-header");
  if (!header || header.querySelector(".wfrp-paperdoll-open")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "header-control icon wfrp-paperdoll-open";
  btn.innerHTML = `<img src="${uiArt("ui-sheet-button")}" alt="">`;
  const label = game.i18n.localize("WFRPPD.Open");
  btn.dataset.tooltip = label;
  btn.setAttribute("aria-label", label);
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    PaperdollApp.openFor(actor);
  });
  btn.addEventListener("pointerdown", (event) => event.stopPropagation());

  const anchor =
    header.querySelector('[data-action="toggleControls"]') ??
    header.querySelector('[data-action="close"]');
  if (anchor) header.insertBefore(btn, anchor);
  else header.append(btn);
});
