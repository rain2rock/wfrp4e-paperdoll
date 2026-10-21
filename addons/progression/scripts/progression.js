/**
 * Дополнение «Развитие» для окна снаряжения WFRP4e.
 * Прокачка за опыт: «+» у характеристик и навыков (ПКМ - вернуть шаг), режим «дерево»,
 * вехи ступени карьеры, покупка талантов ступени.
 * Требует модуль ядра wfrp4e-paperdoll.
 */
(() => {
  const ADDON = "progression";

  function register(api) {
    const { PaperdollApp, PaperdollTooltip, util } = api;
    const { T, esc, safe, norm, option, talentImg, skillMatches, advanceCost, fitDropdown } = util;

    class Progression {
      /** Входит ли навык или характеристика в карьеру (null - карьера неизвестна) */
      _inCareer(kind, keyOrItem, career = this._careerInfo()) {
        if (!career) return null;
        if (kind === "char") return career.chars.has(keyOrItem);
        return career.skills.some((e) => skillMatches(keyOrItem.name, e));
      }

      /** Данные для кнопки «+» у навыка или характеристики */
      _advInfo(kind, keyOrItem, career = this._careerInfo()) {
        const F = (k, d) => game.i18n.format(k, d);
        const L = (k) => game.i18n.localize(k);
        const sys = this.actor.system;
        const adv = kind === "char"
          ? Number(sys.characteristics?.[keyOrItem]?.advances) || 0
          : Number(keyOrItem.system.advances?.value) || 0;
        const inCareer = this._inCareer(kind, keyOrItem, career);
        const mult = inCareer === false ? 2 : 1;
        const cost = advanceCost(adv, kind === "char" ? "characteristic" : "skill") * mult;
        const exp = sys.details?.experience ?? {};
        const free = (Number(exp.total) || 0) - (Number(exp.spent) || 0);
        const can = free >= cost;
        // Разметка подсказки: «## » - заголовок блока, «! » - предупреждение, «~ » - мелкая сноска, TAB - значение справа
        const lines = [
          F("WFRPPD.Adv.Step", { from: adv, to: adv + 1, cost }),
          inCareer === false ? `! ${L("WFRPPD.Adv.OutOfCareer")}` : inCareer ? L("WFRPPD.Adv.InCareer") : "",
          can ? F("WFRPPD.Adv.Free", { n: free }) : `! ${F("WFRPPD.Adv.NotEnough", { n: cost - free })}`,
          career && inCareer ? F("WFRPPD.Adv.Milestone", { adv, need: career.need }) : "",
          ...(kind === "char" ? this._charImpact(keyOrItem) : []),
          adv > 0 ? `~ ${L("WFRPPD.Adv.RefundHint")}` : ""
        ].filter(Boolean);
        return {
          kind,
          key: kind === "char" ? keyOrItem : keyOrItem.id,
          adv,
          cost,
          can: can && this.editable,
          inCareer,
          reached: !!(career && inCareer && adv >= career.need),
          // Прогресс к вехе ступени (только для того, что в карьере)
          goal: career && inCareer && adv < career.need ? `${adv}/${career.need}` : null,
          cls: [can && this.editable ? "" : "is-off", career && inCareer && adv >= career.need ? "is-reached" : "", inCareer === false ? "is-out" : ""].join(" ").trim(),
          hint: lines.join("\n")
        };
      }

      /** Что изменит +1 к характеристике: навыки на ней и, если сменится десяток, бонус и производные */
      _charImpact(key) {
        const L = (k) => game.i18n.localize(k);
        const F = (k, d) => game.i18n.format(k, d);
        const c = this.actor.system.characteristics?.[key] ?? {};
        const value = Number(c.value) || 0;
        const lines = [];
        // Навыки на этой характеристике - каждый своей строкой: было → станет
        const skills = this._skillsOf(key).sort((a, b) => a.name.localeCompare(b.name));
        if (skills.length) {
          lines.push(`## ${F("WFRPPD.Impact.SkillsHead", { n: skills.length })}`);
          for (const sk of skills.slice(0, 10)) {
            const t = Number(safe(() => sk.system.total?.value, null) ?? 0);
            lines.push(`· ${T(sk.name)}\t${t} → ${t + 1}`);
          }
          if (skills.length > 10) lines.push(`~ ${F("WFRPPD.Impact.More", { n: skills.length - 10 })}`);
        }
        // Бонус: сменится ли десяток
        const b0 = Math.floor(value / 10);
        const b1 = Math.floor((value + 1) / 10);
        lines.push(`## ${L("WFRPPD.Impact.BonusHead")}`);
        if (b1 > b0) {
          lines.push(`${L("WFRPPD.Bonus.Title").replace(/:.*$/, "")}\t${b0} → ${b1}`);
          for (const e of this._bonusEffects(key)) lines.push(`· ${e.label}\t+${e.n}`);
        } else {
          lines.push(F("WFRPPD.Impact.BonusLater", { n: (b0 + 1) * 10 - value }));
        }
        return lines;
      }

      /** Таланты текущей ступени карьеры, которые можно взять или поднять (100 опыта + 100 за каждый взятый уровень) */
      _talentOffers() {
        const F = (k, d) => game.i18n.format(k, d);
        const career = this._careerInfo();
        if (!career) return [];
        const exp = this.actor.system.details?.experience ?? {};
        const free = (Number(exp.total) || 0) - (Number(exp.spent) || 0);
        const owned = this.actor.itemTypes.talent ?? [];
        return [...new Set(career.talents ?? [])].map((name) => {
          const mine = owned.filter((t) => skillMatches(t.name, name) || skillMatches(name, t.name));
          const lvl = mine.reduce((n, t) => n + (Number(t.system.advances?.value) || 1), 0);
          const max = mine[0] ? this._talentMax(mine[0]) : null;
          const cost = 100 * (lvl + 1);
          const capped = !!(max && lvl >= max);
          const text = (mine[0] && this._talentText(mine[0])) || PaperdollApp._talentLib.get(norm(name)) || "";
          return {
            name,
            label: T(name),
            lvl,
            max,
            cost,
            costLabel: F("WFRPPD.TalentBuy.Cost", { n: cost }),
            capped,
            can: !capped && free >= cost,
            img: talentImg(mine[0]?.img ?? null, name),
            text: text.length > 220 ? `${text.slice(0, 220).trim()}…` : text,
            fullText: text,
            itemId: mine[0]?.id ?? ""
          };
        });
      }

      /** Подсказка таланта в меню покупки: крупная иконка, уровень и описание - как у купленного */
      _talentOfferTooltip(o) {
        const L = (k) => game.i18n.localize(k);
        const F = (k, d) => game.i18n.format(k, d);
        const level = o.max ? F("WFRPPD.Talent.Level", { lvl: o.lvl, max: o.max }) : F("WFRPPD.Talent.LevelNoMax", { lvl: o.lvl });
        const text = o.fullText ?? "";
        const short = text.length > 900 ? `${text.slice(0, 900).trim()}…` : text;
        const loading = !text && !PaperdollApp._talentLib.has(norm(o.name));
        return `
          <div class="pd-tt-head">
            <div class="pd-tt-icon rarity-${o.max && o.lvl >= o.max ? "rare" : "common"}"><img src="${esc(o.img)}" alt=""></div>
            <div class="pd-tt-title">
              <div class="pd-tt-name">${esc(o.label)}</div>
              <div class="pd-tt-sub">${esc(L("WFRPPD.Career.Talent"))} · ${esc(level)}</div>
            </div>
          </div>
          ${short ? `<div class="pd-tt-text pd-tr">${esc(short)}</div>` : `<div class="pd-tt-more">${esc(L(loading ? "WFRPPD.Talent.Loading" : "WFRPPD.Talent.NoText"))}</div>`}`;
      }

      /** Взять или поднять талант за опыт: копия своего таланта, иначе из компендиума, иначе пустой */
      async _buyTalent(name) {
        if (!this.editable) return;
        const L = (k) => game.i18n.localize(k);
        const F = (k, d) => game.i18n.format(k, d);
        const offer = this._talentOffers().find((o) => o.name === name);
        if (!offer || offer.capped) return;
        const actor = this.actor;
        const exp = actor.system.details?.experience ?? {};
        const spent = Number(exp.spent) || 0;
        const total = Number(exp.total) || 0;
        if (total - spent < offer.cost) return ui.notifications?.warn(F("WFRPPD.Adv.NotEnoughMsg", { n: offer.cost - (total - spent) }));
        let data = null;
        const own = offer.itemId ? actor.items.get(offer.itemId) : null;
        if (own) data = own.toObject();
        else {
          const base = (n) => norm(String(n ?? "").replace(/\s*\([^)]*\)\s*$/, ""));
          try {
            for (const pack of game.packs ?? []) {
              if (pack.documentName !== "Item") continue;
              const index = await pack.getIndex({ fields: ["type"] });
              const hit = index.find((e) => e.type === "talent" && norm(e.name) === norm(name)) ?? index.find((e) => e.type === "talent" && base(e.name) === base(name));
              if (hit) {
                data = (await pack.getDocument(hit._id)).toObject();
                break;
              }
            }
          } catch (err) {
            console.warn("wfrp4e-paperdoll | talent lookup", err);
          }
          data ??= { name, type: "talent", system: {} };
          data.name = name;
        }
        delete data._id;
        data.system ??= {};
        data.system.advances = { ...(data.system.advances ?? {}), value: 1 };
        await actor.createEmbeddedDocuments("Item", [data]);
        const newSpent = spent + offer.cost;
        const reason = F("WFRPPD.TalentBuy.Log", { name: offer.label, to: offer.lvl + 1 });
        const update = { "system.details.experience.spent": newSpent };
        const log = safe(() => actor.system.addToExpLog?.(offer.cost, reason, newSpent, total), null);
        if (Array.isArray(log)) update["system.details.experience.log"] = log;
        await actor.update(update);
        ui.notifications?.info(reason);
      }

      /** Режим прокачки: характеристика, под ней её бонус с производными и навыки на ней */
      _advanceTree(charRows) {
        const F = (k, d) => game.i18n.format(k, d);
        const L = (k) => game.i18n.localize(k);
        const career = this._careerInfo();
        const out = [];
        for (const r of charRows) {
          const key = r.key.replace(/^char\./, "");
          const c = this.actor.system.characteristics?.[key] ?? {};
          out.push({ ...r, cls: `${r.cls ?? ""} is-parent`.trim() });
          const bonus = Number(c.bonus ?? Math.floor((Number(c.value) || 0) / 10));
          const effects = this._bonusEffects(key);
          out.push({
            key: `${r.key}.bonus`,
            label: F("WFRPPD.Impact.BonusRow", { name: r.label }),
            value: bonus,
            child: true,
            derived: true,
            hint: this._bonusInfo(key).join("\n")
          });
          for (const sk of this._skillsOf(key).sort((a, b) => a.name.localeCompare(b.name))) {
            // По умолчанию - навыки карьеры и уже вкачанные; опция «все навыки» - как в подсказке плюса,
            // вне карьеры приглушены (шаг стоит ×2)
            const adv = this._advInfo("skill", sk, career);
            if (!option("showAllSkills") && adv.inCareer === false && adv.adv === 0) continue;
            out.push({
              key: sk.name,
              itemId: sk.id,
              skillRoll: true,
              label: T(sk.name),
              value: safe(() => sk.system.total?.value, null) ?? adv.adv,
              cls: adv.inCareer === false ? "is-outcareer" : "",
              done: adv.reached,
              child: true,
              adv
            });
          }
        }
        return out;
      }

      /** Вехи текущей ступени: что уже закрыто и что осталось */
      _milestones(career) {
        if (!career) return null;
        const L = (k) => game.i18n.localize(k);
        const F = (k, d) => game.i18n.format(k, d);
        const cfg = game.wfrp4e.config;
        const sys = this.actor.system;
        const need = career.need;
        const chars = [...career.chars].map((k) => ({
          label: L(cfg.characteristics?.[k] ?? k),
          adv: Number(sys.characteristics?.[k]?.advances) || 0
        }));
        const charsDone = chars.filter((c) => c.adv >= need);
        const skills = (this.actor.itemTypes.skill ?? [])
          .filter((sk) => career.skills.some((e) => skillMatches(sk.name, e)))
          .map((sk) => ({ label: T(sk.name), adv: Number(sk.system.advances?.value) || 0 }));
        const skillsDone = skills.filter((x) => x.adv >= need);
        const talents = (this.actor.itemTypes.talent ?? []).filter((t) => career.talents.some((e) => skillMatches(t.name, e)));
        const list = (arr) => arr.map((x) => `${x.adv >= need ? "✓" : "·"} ${x.label} ${x.adv}/${need}`).join("\n");
        const rows = [
          {
            key: "Career.Chars",
            label: L("WFRPPD.Career.Chars"),
            value: `${charsDone.length} / ${chars.length}`,
            done: charsDone.length >= chars.length,
            cls: charsDone.length >= chars.length ? "is-done" : "is-todo",
            hint: [F("WFRPPD.Career.CharsHint", { need }), list(chars)].join("\n")
          },
          {
            key: "Career.Skills",
            label: L("WFRPPD.Career.Skills"),
            value: `${Math.min(skillsDone.length, 8)} / 8`,
            done: skillsDone.length >= 8,
            cls: skillsDone.length >= 8 ? "is-done" : "is-todo",
            hint: [F("WFRPPD.Career.SkillsHint", { need }), list(skills)].join("\n")
          },
          {
            key: "Career.Talent",
            label: L("WFRPPD.Career.Talent"),
            value: `${Math.min(talents.length, 1)} / 1`,
            done: talents.length > 0,
            cls: talents.length ? "is-done" : "is-todo",
            hint: [L("WFRPPD.Career.TalentHint"), ...career.talents.map((t) => `${talents.some((x) => skillMatches(x.name, t)) ? "✓" : "·"} ${t}`)].join("\n")
          }
        ];
        const done = rows.every((r) => r.cls === "is-done") || !!career.item.system.complete?.value;
        return { rows, done };
      }

      /** Шаг развития за опыт: +1 (dir = 1) или вернуть последний шаг (dir = -1) */
      async _advance(kind, key, dir = 1) {
        if (!this.editable) return;
        const actor = this.actor;
        const L = (k) => game.i18n.localize(k);
        const F = (k, d) => game.i18n.format(k, d);
        const item = kind === "skill" ? actor.items.get(key) : null;
        if (kind === "skill" && !item) return;
        const name = item ? item.name : L(game.wfrp4e.config.characteristics?.[key] ?? key);
        const adv = item ? Number(item.system.advances?.value) || 0 : Number(actor.system.characteristics?.[key]?.advances) || 0;
        if (dir < 0 && adv <= 0) return;
        const career = this._careerInfo();
        const inCareer = this._inCareer(kind === "skill" ? "skill" : "char", item ?? key, career);
        const type = kind === "skill" ? "skill" : "characteristic";
        const cost = advanceCost(dir > 0 ? adv : adv - 1, type) * (inCareer === false ? 2 : 1);
        const exp = actor.system.details?.experience ?? {};
        const spent = Number(exp.spent) || 0;
        const total = Number(exp.total) || 0;
        if (dir > 0 && total - spent < cost) {
          ui.notifications?.warn(F("WFRPPD.Adv.NotEnoughMsg", { n: cost - (total - spent) }));
          return;
        }
        // Вне карьеры - только с одобрения ведущего, переспрашиваем
        if (dir > 0 && inCareer === false) {
          const Dialog = foundry.applications?.api?.DialogV2;
          const ok = Dialog
            ? await Dialog.confirm({ window: { title: L("WFRPPD.Adv.OutTitle") }, content: `<p>${F("WFRPPD.Adv.OutConfirm", { name, cost })}</p>` })
            : true;
          if (!ok) return;
        }
        const newSpent = spent + dir * cost;
        const reason = F(dir > 0 ? "WFRPPD.Adv.LogUp" : "WFRPPD.Adv.LogDown", { name, to: adv + dir });
        const update = { "system.details.experience.spent": newSpent };
        // Журнал опыта системы, если он есть
        const log = safe(() => actor.system.addToExpLog?.(dir * cost, reason, newSpent, total), null) ?? safe(() => actor._addToExpLog?.(dir * cost, reason, newSpent, total), null);
        if (Array.isArray(log)) update["system.details.experience.log"] = log;
        if (item) {
          await item.update({ "system.advances.value": adv + dir });
          await actor.update(update);
        } else {
          update[`system.characteristics.${key}.advances`] = adv + dir;
          await actor.update(update);
        }
      }

      /** Категория «Карьера»: ступень и вехи */
      _careerCategory(career = this._careerInfo()) {
        const ms = this._milestones(career);
        if (!career || !ms) return null;
        const levelRow = {
          key: "Career.Level",
          label: career.item.name,
          value: game.i18n.format("WFRPPD.Career.LevelValue", { n: career.level }),
          done: ms.done,
          cls: "",
          hint: career.levels.map((l) => `${l.current ? "▶" : l.past ? "✓" : "·"} ${l.n}. ${l.name ?? "?"}`).join("\n"),
          levels: career.levels
        };
        return { key: "career", rows: [levelRow, ...ms.rows] };
      }
    }
    api.mixin(Progression);

    api.registerAddon({
      id: ADDON,
      title: "WFRPPD.Addon.progression.Title",
      intro: "WFRPPD.Addon.progression.Intro",
      icon: "fa-arrow-trend-up",
      settings: [
        { key: "talentBuy", default: true },
        { key: "showAllSkills", default: false }
      ],
      onRender(app, root) {
        // Класс is-open ставит и шаблон (offersOpen), поэтому подгоняем высоту ПОСЛЕ каждой отрисовки,
        // а не только по клику: иначе перерисовка возвращает меню к раскрытию вниз за край окна
        if (app._talentMenuOpen) fitDropdown(root.querySelector(".pd-talentmenu"));
        // Таланты: «+» в заголовке - меню талантов ступени для покупки
        root.querySelector(".pd-talent-add")?.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          app._talentMenuOpen = !app._talentMenuOpen;
          const menu = root.querySelector(".pd-talentmenu");
          menu?.classList.toggle("is-open", app._talentMenuOpen);
          if (app._talentMenuOpen) fitDropdown(menu);
          // Описаний нет - подтягиваем из библиотеки и перерисовываем
          if (app._talentMenuOpen) {
            const need = app._talentOffers().filter((o) => !o.text && !PaperdollApp._talentLib.has(norm(o.name)));
            if (need.length) Promise.all(need.map((o) => app._loadTalentText({ name: o.name, system: {} }))).then(() => app.render());
          }
        });
        const offers = app._talentOffers();
        for (const el of root.querySelectorAll(".pd-talentmenu [data-buy]")) {
          el.addEventListener("click", async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (el.classList.contains("is-off")) return;
            await app._buyTalent(el.dataset.buy);
          });
          // Подсказка при наведении - крупная иконка и описание, как у вещи
          const offer = offers.find((o) => o.name === el.dataset.buy);
          if (!offer) continue;
          el.addEventListener("pointerover", (ev) => ev.stopPropagation());
          el.addEventListener("pointerenter", async (ev) => {
            PaperdollTooltip.showHtml(app._talentOfferTooltip(offer), ev);
            if (!offer.fullText && !PaperdollApp._talentLib.has(norm(offer.name))) {
              await app._loadTalentText({ name: offer.name, system: {} });
              if (el.matches(":hover")) {
                offer.fullText = PaperdollApp._talentLib.get(norm(offer.name)) || "";
                PaperdollTooltip.showHtml(app._talentOfferTooltip(offer), ev);
              }
            }
          });
          el.addEventListener("pointermove", (ev) => PaperdollTooltip.move(ev));
          el.addEventListener("pointerleave", () => PaperdollTooltip.hide());
        }

        // Шаг развития за опыт: ЛКМ +1, ПКМ вернуть последний шаг
        for (const el of root.querySelectorAll(".pd-adv")) {
          el.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            app._advance(el.dataset.kind, el.dataset.key, 1);
          });
          el.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            app._advance(el.dataset.kind, el.dataset.key, -1);
          });
        }
      }
    });
  }

  if (globalThis.__PD_MOCK__) register(globalThis.__PD_API__);
  else Hooks.once("wfrp4e-paperdoll.init", register);
})();
