import { PaperdollApp, MODULE_ID, uiArt, PD_OPTIONS, PD_API, option, isEnabled } from "./paperdoll-app.js";
import { PaperdollSettings } from "./settings-menu.js";

const SUPPORTED_TYPES = ["character", "npc", "creature"];

Hooks.once("init", () => {
  const rerender = () => PaperdollApp.renderAll();

  // Главный выключатель: модуль остаётся установленным, но не вмешивается в игру -
  // ни кнопки на листе, ни горячей клавиши, ни перехвата двойного клика по токену.
  // Настройка мира: выключает для всего стола, поэтому её меняет только ГМ.
  game.settings.register(MODULE_ID, "enabled", {
    name: "WFRPPD.Settings.Enabled.Name",
    hint: "WFRPPD.Settings.Enabled.Hint",
    scope: "world",
    config: false,
    type: Boolean,
    default: true,
    onChange: (on) => {
      if (!on) for (const app of [...PaperdollApp.instances.values()]) app.close();
      else rerender();
    }
  });

  // Отметка о показанном приветствии. Храним версию, а не флаг: если позже понадобится
  // сообщение «что нового», условие станет сравнением версий без миграции настройки
  game.settings.register(MODULE_ID, "welcomeShown", {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "itemIcons", {
    name: "WFRPPD.Settings.ItemIcons.Name",
    hint: "WFRPPD.Settings.ItemIcons.Hint",
    scope: "client",
    config: false,
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
      config: false,
      type: Boolean,
      default: def,
      onChange: rerender
    });
  }

  // Все настройки модуля - одним окном по категориям
  game.settings.registerMenu(MODULE_ID, "menu", {
    name: "WFRPPD.SettingsMenu.Title",
    label: "WFRPPD.SettingsMenu.Button",
    hint: "WFRPPD.SettingsMenu.Hint",
    icon: "fa-solid fa-user-shield",
    type: PaperdollSettings,
    restricted: false
  });

  // Вторая полоса под моделью (выбирается шестерёнкой на самой полосе)
  game.settings.register(MODULE_ID, "secondBar", {
    scope: "client",
    config: false,
    type: String,
    default: "fortune"
  });

  // Машинный перевод английских текстов в подсказках
  game.settings.register(MODULE_ID, "translateText", {
    name: "WFRPPD.Options.translateText.Name",
    hint: "WFRPPD.Options.translateText.Hint",
    scope: "client",
    config: false,
    type: String,
    choices: {
      off: "WFRPPD.Options.translateText.off",
      chrome: "WFRPPD.Options.translateText.chrome",
      google: "WFRPPD.Options.translateText.google"
    },
    default: "off",
    onChange: rerender
  });
  game.settings.register(MODULE_ID, "translateDescOnly", {
    name: "WFRPPD.Options.translateDescOnly.Name",
    hint: "WFRPPD.Options.translateDescOnly.Hint",
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
    onChange: rerender
  });

  // Горячая клавиша (по умолчанию I): открыть / закрыть снаряжение.
  // Клавишу меняют в «Настроить управление» Foundry, включают и выключают - в настройках модуля
  // Дополнения (магия, травмы, мутации, развитие, группа) подключаются здесь
  Hooks.callAll("wfrp4e-paperdoll.init", PD_API);

  game.keybindings?.register(MODULE_ID, "toggle", {
    name: "WFRPPD.Hotkey.Name",
    hint: "WFRPPD.Hotkey.Hint",
    editable: [{ key: "KeyI" }],
    precedence: CONST.KEYBINDING_PRECEDENCE?.NORMAL,
    onDown: () => {
      if (!isEnabled() || !option("hotkey") || game.system.id !== "wfrp4e") return false;
      const token = canvas?.tokens?.controlled?.find((t) => t.actor?.isOwner);
      const actor = token?.actor ?? game.user.character;
      if (!actor || !SUPPORTED_TYPES.includes(actor.type)) {
        ui.notifications?.info(game.i18n.localize("WFRPPD.Hotkey.NoActor"));
        return true;
      }
      const open = PaperdollApp.instances?.get(actor.uuid);
      if (open?.rendered) open.close();
      else PaperdollApp.openFor(actor);
      return true;
    }
  });

  // Доступ из макросов: game.modules.get("wfrp4e-paperdoll").api.open(actor)
  game.modules.get(MODULE_ID).api = {
    open: (actor) => PaperdollApp.openFor(actor),
    ...PD_API
  };
});

/**
 * Двойной клик по токену открывает снаряжение вместо листа (опция, у каждого игрока своя).
 * Alt + двойной клик - обычный лист. Без прав наблюдателя - как в Foundry.
 */
// Патчим на этапе setup: холст рисуется до «ready», и токены привязывают обработчик двойного клика при отрисовке
Hooks.once("setup", () => {
  if (game.system.id !== "wfrp4e") return;
  const TokenCls = CONFIG.Token?.objectClass ?? foundry.canvas?.placeables?.Token ?? globalThis.Token;
  const proto = TokenCls?.prototype;
  if (!proto?._onClickLeft2 || proto._pdPatched) return;
  proto._pdPatched = true;
  const original = proto._onClickLeft2;
  proto._onClickLeft2 = function (event) {
    try {
      const actor = this.actor;
      const alt = !!(event?.altKey ?? event?.nativeEvent?.altKey ?? event?.data?.originalEvent?.altKey);
      if (
        isEnabled() &&
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
  if (game.system.id !== "wfrp4e" || !isEnabled()) return;
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

/**
 * Приветствие в чат - один раз на мир, после установки модуля.
 * Пишет только активный ГМ: иначе сообщение продублировал бы каждый подключённый клиент.
 * Отметка в настройке мира, поэтому повторного показа не будет даже после перезахода.
 */
Hooks.once("ready", async () => {
  if (game.system.id !== "wfrp4e" || !isEnabled()) return;
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  if (game.settings.get(MODULE_ID, "welcomeShown")) return;

  const version = game.modules.get(MODULE_ID)?.version ?? "";
  // Ставим отметку СРАЗУ: если отправка сообщения упадёт, приветствие не полезет на каждый запуск
  await game.settings.set(MODULE_ID, "welcomeShown", version || "shown");

  // Клавиши берём из настроек Foundry - игрок мог их переназначить
  const keyOf = (action, fallback) => {
    try {
      const binding = game.keybindings?.get(MODULE_ID, action)?.[0]?.key;
      return binding ? String(binding).replace(/^Key/, "") : fallback;
    } catch {
      return fallback;
    }
  };
  const F = (k, d) => game.i18n.format(k, d);
  const L = (k) => game.i18n.localize(k);

  const lines = [
    `<p>${F("WFRPPD.Welcome.Open", { key: keyOf("toggle", "I") })}</p>`,
    game.modules.get(MODULE_ID)?.api?.hasAddon?.("party")
      ? `<p>${F("WFRPPD.Welcome.Group", { key: keyOf("openGroup", "G") })}</p>`
      : "",
    `<p>${L("WFRPPD.Welcome.Settings")}</p>`
  ];

  await ChatMessage.create({
    content: `<div class="wfrp-paperdoll-welcome">
        <h3>${L("WFRPPD.Welcome.Title")}</h3>
        ${lines.filter(Boolean).join("")}
      </div>`
  });
});
