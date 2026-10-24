/**
 * Отдых и восстановление: как это делает САМА система.
 *
 * Запуск: выбери токен своего персонажа -> F12 -> Console -> вставить -> Enter -> затем  copy(__pdRest)
 *
 * Зачем: лист персонажа системы по кнопке «Rest and Recover» пишет в чат карточку проверки
 * с кнопкой «Apply Healing», лечит уже по ней и позволяет перебросить. Наше окно вместо этого
 * кидает свой d100 и лечит сразу - без карточки, без переброса. Чтобы повторить поведение системы,
 * а не выдумывать своё, надо узнать: какой метод зовёт лист, чем проверка помечается как «отдых»
 * и кто вешает кнопку лечения.
 *
 * Скрипт ТОЛЬКО ЧИТАЕТ: ничего не кидает, не лечит и не пишет в чат. Прав ГМа не требует.
 */
(() => {
  const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
  if (!actor) return ui.notifications.warn("Select your character's token first");

  const out = { system: game.system?.version, foundry: game.version, actor: actor.name };
  const names = (obj) => {
    const seen = new Set();
    for (let o = obj; o && o !== Object.prototype; o = Object.getPrototypeOf(o))
      for (const k of Object.getOwnPropertyNames(o)) seen.add(k);
    return [...seen];
  };
  const like = (list, re) => list.filter((k) => re.test(k)).sort();
  const RE = /rest|recover|heal|wound|regen|sleep|fatigue/i;

  /* 1. Методы актёра и его листа, похожие на отдых и лечение ------------------ */
  out.actorMethods = like(names(actor), RE);
  out.sheetClass = actor.sheet?.constructor?.name ?? null;
  out.sheetMethods = actor.sheet ? like(names(actor.sheet), RE) : [];

  /* 2. Навык Стойкости - по нему идёт проверка ------------------------------- */
  const sk = actor.itemTypes.skill?.find((s) => /^(endurance|стойкость)$/i.test(s.name));
  out.endurance = sk
    ? { name: sk.name, id: sk.id, total: sk.system?.total?.value, advances: sk.system?.advances?.value }
    : "not found";
  out.toughnessBonus = actor.system?.characteristics?.t?.bonus;
  out.wounds = actor.system?.status?.wounds;

  /* 3. Точки расширения системы: чем помечается проверка и кто ставит кнопку -- */
  const cfg = game.wfrp4e?.config ?? {};
  out.configKeys = like(Object.keys(cfg), RE);
  out.utilityMethods = game.wfrp4e?.utility ? like(names(game.wfrp4e.utility), RE) : [];
  out.rollMethods = game.wfrp4e?.rolls ? like(names(game.wfrp4e.rolls), RE) : [];
  out.apiTop = Object.keys(game.wfrp4e ?? {});

  /* 4. Как выглядит setupSkill: какие поля принимает контекст ----------------- */
  out.setupSkillSource = typeof actor.setupSkill === "function"
    ? String(actor.setupSkill).slice(0, 1200)
    : "no setupSkill";

  /* 5. Последняя карточка проверки в чате: по каким флагам рисуется кнопка ---- */
  const last = [...game.messages].reverse().find((m) => m.flags?.wfrp4e?.data || m.flags?.wfrp4e?.context);
  if (last) {
    const f = last.flags.wfrp4e;
    out.lastTestFlags = Object.keys(f);
    out.lastTestContext = f.context ?? f.data?.context ?? null;
    out.lastTestHasHealButton = /apply\s*healing|примен\S*\s*лечен/i.test(last.content ?? "");
    out.lastTestButtons = [...(last.content ?? "").matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]);
  } else {
    out.lastTestFlags = "no test cards in chat - roll Rest and Recover from the classic sheet, then run this again";
  }

  /* 6. Кнопка отдыха на листе: что на ней написано и какое у неё действие ----- */
  const el = actor.sheet?.element?.[0] ?? actor.sheet?.element ?? null;
  if (el?.querySelectorAll) {
    out.sheetRestButtons = [...el.querySelectorAll("a,button,[data-action]")]
      .filter((b) => RE.test(`${b.dataset?.action ?? ""} ${b.textContent ?? ""} ${b.className ?? ""}`))
      .slice(0, 10)
      .map((b) => ({ action: b.dataset?.action ?? null, cls: b.className, text: (b.textContent ?? "").trim().slice(0, 40) }));
  } else {
    out.sheetRestButtons = "open the character sheet first, then run this again";
  }

  window.__pdRest = out;
  console.log("=== wfrp4e-paperdoll: rest diagnostics ===");
  console.log(out);
  console.log("Copy everything:  copy(__pdRest)");
})();
