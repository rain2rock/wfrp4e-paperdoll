/**
 * Дополнение «Мутации» для окна снаряжения WFRP4e.
 * Мутации в ленте эффектов (рамка Хаоса), лишние руки и головы как дополнительные слоты,
 * ГМ по Shift+ЛКМ отмечает, что даёт мутация.
 * Требует модуль ядра wfrp4e-paperdoll.
 */
(() => {
  const ADDON = "mutations";

  function register(api) {
    const { util } = api;
    const { MODULE_ID, EXTRA_HANDS, EXTRA_HEADS, option, itemImg, stripTags, plainEnrichers } = util;
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);

    /**
     * Что мутация даёт персонажу: "hand" - лишняя рука, "head" - лишняя голова, "none" - ничего (решение ГМ), null - не знаем.
     * Сначала флаг, который ставит ГМ, потом название.
     */
    function mutationGrant(item) {
      const flag = item.flags?.[MODULE_ID]?.grants;
      if (flag) return flag;
      const name = String(item.name ?? "").toLowerCase();
      if (/(extra|additional|third|fourth|second)\s+(arm|hand)s?|(третья|четв\S+|лишн\S+|дополнит\S+|втор\S+)\s+(рук|кист)|многорук/.test(name)) return "hand";
      if (/(extra|additional|second|two|third)\s+heads?|(втор\S+|лишн\S+|дополнит\S+|треть\S+)\s+голов|двухголов|две головы|многоголов/.test(name)) return "head";
      return null;
    }

    class Mutations {
      /** Дополнительные слоты от мутаций: { hands: ["hand3"], heads: ["head2"], source: { hand3: mutation } } */
      _extraSlots() {
        const out = { hands: [], heads: [], source: {} };
        if (!option("mutations")) return out;
        for (const m of this.actor.itemTypes.mutation ?? []) {
          const grant = mutationGrant(m);
          const list = grant === "hand" ? EXTRA_HANDS : grant === "head" ? EXTRA_HEADS : null;
          const target = grant === "hand" ? out.hands : out.heads;
          if (!list || target.length >= list.length) continue;
          const key = list[target.length];
          target.push(key);
          out.source[key] = m;
        }
        return out;
      }
    }
    api.mixin(Mutations);

    api.registerAddon({
      id: ADDON,
      title: "WFRPPD.Addon.mutations.Title",
      intro: "WFRPPD.Addon.mutations.Intro",
      icon: "fa-dna",
      settings: [{ key: "mutations", default: true }],
      mutationGrant,
      // Мутации в ленте эффектов - всегда (это дебаффы); опция отвечает только за лишние слоты
      effects(app, out) {
        const cfg = game.wfrp4e?.config ?? {};
        for (const m of app.actor.itemTypes.mutation ?? []) {
          const sys = m.system ?? {};
          const type = sys.mutationType?.value;
          const grant = mutationGrant(m);
          out.push({
            kind: "mutation",
            id: m.id,
            name: m.name,
            img: itemImg(m.img, m.name),
            debuff: true,
            grant,
            lines: [
              type ? L(cfg.mutationTypes?.[type] ?? `WFRPPD.Mutation.Type.${type}`) : "",
              sys.modifier?.value ?? "",
              sys.description?.value ? plainEnrichers(stripTags(sys.description.value)) : "",
              grant === "hand" || grant === "head" ? F("WFRPPD.Mutation.Grants", { slot: L(`WFRPPD.Mutation.Grant.${grant}`) }) : ""
            ],
            hint: L(game.user?.isGM ? "WFRPPD.Mutation.GMHint" : "WFRPPD.Mutation.Hint")
          });
        }
      },
      // ГМ: Shift+ЛКМ по мутации переключает, что она даёт: рука -> голова -> ничего -> по названию
      async effectClick(app, entry, ev) {
        if (entry.kind !== "mutation" || !game.user?.isGM || !ev?.shiftKey) return false;
        const order = [null, "hand", "head", "none"];
        const item = app.actor.items.get(entry.id);
        const now = item?.flags?.[MODULE_ID]?.grants ?? null;
        const next = order[(order.indexOf(now) + 1) % order.length];
        if (next === null) await item?.unsetFlag?.(MODULE_ID, "grants");
        else await item?.update({ [`flags.${MODULE_ID}.grants`]: next });
        ui.notifications.info(F("WFRPPD.Mutation.Set", { name: item?.name ?? "", slot: L(`WFRPPD.Mutation.Grant.${next ?? "auto"}`) }));
        return true;
      }
    });
  }

  if (globalThis.__PD_MOCK__) register(globalThis.__PD_API__);
  else Hooks.once("wfrp4e-paperdoll.init", register);
})();
