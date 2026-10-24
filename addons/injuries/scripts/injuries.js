/**
 * Дополнение «Травмы» для окна снаряжения WFRP4e.
 * Ампутации, переломы и разрывы мышц выключают конечность: значок на слоте, запрет держать оружие,
 * протезы (крюк, деревянная нога, инженерное чудо) в слотах конечностей.
 * Требует модуль ядра wfrp4e-paperdoll.
 */
(() => {
  const ADDON = "injuries";

  function register(api) {
    const { util } = api;
    const { MODULE_ID, LIMB_LOCS, isArmLoc, fileStem, itemImg, shieldValue, option } = util;
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);

    /**
     * Что травма делает с конечностью. Узнаём по картинке wfrp4e-core (не зависит от перевода),
     * потом по названию на английском и русском.
     * arm / hand / leg / foot - ампутация, broken / torn - временно не действует (книга: как ампутация, пока не заживёт)
     */
    function injuryLimbKind(item) {
      const img = fileStem(item.img);
      const name = String(item.name ?? "").toLowerCase();
      const test = (imgRe, nameRe) => imgRe.test(img) || nameRe.test(name);
      if (test(/^amputatedhand/, /amputated hand|lost hand|кист/)) return "hand";
      if (test(/^amputatedarm/, /amputated arm|lost arm|потер\S* рук|ампутац\S* рук/)) return "arm";
      if (test(/^amputatedfoot/, /amputated foot|lost foot|стоп/)) return "foot";
      if (test(/^amputatedleg/, /amputated leg|lost leg|потер\S* ног|ампутац\S* ног/)) return "leg";
      if (test(/^broken-(arm|leg)/, /broken bone|перелом/)) return "broken";
      if (test(/^torn(arm|leg)/, /torn muscle \(major\)|серь\S* разрыв|разрыв\S* мышц\S* \(серь/)) return "torn";
      return null;
    }

    /** Какая конечность: rArm / lArm / rLeg / lLeg или null, если по данным не понять */
    function injuryLimbLoc(item, kind) {
      const key = item.system?.location?.key;
      if (LIMB_LOCS.includes(key)) return key;
      const text = `${item.system?.location?.value ?? ""} ${item.name ?? ""} ${fileStem(item.img)}`.toLowerCase();
      const side = /\bleft\b|лев/.test(text) ? "l" : /\bright\b|прав/.test(text) ? "r" : null;
      const arm = ["hand", "arm"].includes(kind) || /arm|hand|рук|кист/.test(text);
      const leg = ["foot", "leg"].includes(kind) || /leg|foot|ног|стоп/.test(text);
      if (!side || arm === leg) return null;
      return `${side}${arm ? "Arm" : "Leg"}`;
    }

    /** Протез: hook - крюк, leg - деревянная нога или стопа, marvel - инженерное чудо */
    function prostheticKind(item) {
      if (item.type !== "trapping") return null;
      const img = fileStem(item.img);
      const name = String(item.name ?? "").toLowerCase();
      if (/engineering-marvel/.test(img) || /engineering marvel|инженерн\S* чуд/.test(name)) return "marvel";
      if (/hook/.test(img) || /\bhook\b|крюк/.test(name)) return "hook";
      if (/false-leg|wooden-leg/.test(img) || /false (leg|foot)|wooden leg|peg leg|деревянн\S* ног|искусственн\S* (ног|стоп)/.test(name)) return "leg";
      return null;
    }

    class Injuries {
    /**
     * Состояние конечностей: какие травмы, какой протез надет, работает ли рука или нога.
     * Инженерное чудо отменяет все последствия для своей конечности.
     */
    _limbState() {
      const state = Object.fromEntries(LIMB_LOCS.map((loc) => [loc, { injuries: [], prosthetic: null }]));
      // Учёт травм выключен в опциях: конечности считаем целыми
      for (const item of option("injuries") ? this.actor.items : []) {
        if (item.type === "injury") {
          const kind = injuryLimbKind(item);
          const loc = kind && injuryLimbLoc(item, kind);
          if (loc) state[loc].injuries.push({ item, kind });
        } else if (item.system?.isEquipped && prostheticKind(item)) {
          const loc = item.flags?.[MODULE_ID]?.limb;
          if (LIMB_LOCS.includes(loc)) state[loc].prosthetic = item;
        }
      }
      for (const [loc, st] of Object.entries(state)) {
        const kinds = st.injuries.map((x) => x.kind);
        st.marvel = prostheticKind(st.prosthetic ?? {}) === "marvel";
        st.lost = !st.marvel && kinds.some((k) => ["arm", "hand", "leg", "foot"].includes(k));
        st.disabled = !st.marvel && kinds.some((k) => ["broken", "torn"].includes(k));
        // Рука: держать оружие нечем. Щит можно привязать к культе, если потеряна только кисть
        st.noHand = isArmLoc(loc) && (st.lost || st.disabled);
        st.stump = isArmLoc(loc) && !st.disabled && kinds.includes("hand") && !kinds.includes("arm") && !st.marvel;
        st.hook = st.stump && prostheticKind(st.prosthetic ?? {}) === "hook";
        st.any = st.injuries.length > 0;
      }
      return state;
    }

      /** Какую конечность задела травма (rArm / lArm / rLeg / lLeg) или null */
      _injuryLimb(item) {
        const kind = injuryLimbKind(item);
        return (kind && injuryLimbLoc(item, kind)) || null;
      }

    /** Значок на слоте: что не так с конечностью (и чем она заменена) */
    _maimView(loc, limbs) {
      const st = limbs[loc];
      if (!st?.any) return null;
      const L = (k) => game.i18n.localize(k);
      const F = (k, d) => game.i18n.format(k, d);
      const top = st.injuries[0].item;
      const lines = st.injuries.map((x) => `${x.item.name} - ${L(`WFRPPD.Limb.Kind.${x.kind}`)}`);
      if (st.prosthetic) lines.push(F("WFRPPD.Limb.Prosthetic", { name: st.prosthetic.name }));
      if (st.marvel) lines.push(L("WFRPPD.Limb.MarvelHint"));
      else if (isArmLoc(loc)) {
        if (st.noHand) lines.push(L(st.stump ? "WFRPPD.Limb.StumpHint" : "WFRPPD.Limb.NoHandHint"));
        if (st.hook) lines.push(L("WFRPPD.Limb.HookHint"));
      } else if (st.lost) lines.push(L(prostheticKind(st.prosthetic ?? {}) === "leg" ? "WFRPPD.Limb.LegProsthesisHint" : "WFRPPD.Limb.NoLegHint"));
      else if (st.disabled) lines.push(L("WFRPPD.Limb.LegDisabledHint"));
      if (st.disabled) lines.push(L("WFRPPD.Limb.TempHint"));
      const view = {
        loc,
        img: itemImg(st.prosthetic && !st.marvel ? st.prosthetic.img : top.img, st.prosthetic && !st.marvel ? st.prosthetic.name : top.name),
        // В подсказке - крупно сама травма
        bigImg: itemImg(top.img, top.name),
        name: top.name,
        lines,
        prostheticName: st.prosthetic?.name ?? "",
        ok: st.marvel,
        // Обычный протез (деревянная нога, крюк): заменено, но штрафы остаются
        partial: !!st.prosthetic && !st.marvel
      };
      (this._maimCache ??= {})[loc] = view;
      return view;
    }
    }
    api.mixin(Injuries);

    api.registerAddon({
      id: ADDON,
      title: "WFRPPD.Addon.injuries.Title",
      intro: "WFRPPD.Addon.injuries.Intro",
      icon: "fa-bone",
      settings: [{ key: "injuries", default: true }],
      prostheticKind,
      injuryLimbKind,
      injuryLimbLoc,
      // Рука без кисти или сломана: держать оружие нечем (перетащить всё равно можно - вдруг ГМ разрешит)
      restrictions(app, item, slot, out) {
        if (item.type !== "weapon" || (slot !== "main" && slot !== "off")) return;
        const limbs = app._limbState();
        const hand = limbs[app._handLoc(slot)];
        const other = limbs[app._handLoc(slot === "main" ? "off" : "main")];
        if (hand.noHand) {
          if (shieldValue(item) && hand.stump) out.warn.push({ label: L("WFRPPD.Limb.ShieldStrapped"), info: true });
          else out.forbid.push({ label: L(hand.disabled ? "WFRPPD.Limb.HandBroken" : "WFRPPD.Limb.NoHand"), hint: L("WFRPPD.Limb.NoHandHint") });
        }
        if (item.system?.twohanded?.value && (hand.noHand || other.noHand)) out.forbid.push({ label: L("WFRPPD.Limb.NeedTwoHands") });
      }
    });
  }

  if (globalThis.__PD_MOCK__) register(globalThis.__PD_API__);
  else Hooks.once("wfrp4e-paperdoll.init", register);
})();
