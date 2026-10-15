import { PaperdollApp, MODULE_ID, ui } from "./paperdoll-app.js";

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

  // Доступ из макросов: game.modules.get("wfrp4e-paperdoll").api.open(actor)
  game.modules.get(MODULE_ID).api = {
    open: (actor) => PaperdollApp.openFor(actor)
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
  btn.innerHTML = `<img src="${ui("ui-sheet-button")}" alt="">`;
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
