/**
 * Дополнение «Магия и молитвы» для окна снаряжения WFRP4e.
 * Вкладка «Магия»: значения для сотворения и молитв, заклинания по лорам, благословения и чудеса,
 * сотворение по клику, штраф брони к касту (в статах и при выборе брони).
 * Требует модуль ядра wfrp4e-paperdoll.
 */
(() => {
  const ADDON = "magic";

  /**
   * Школа заклинания строкой. В живой системе `lore.value` - МАССИВ (`["petty"]`, у Bolt вообще `[""]`),
   * а код ждал строку: ярлык группы получался пустым, а `L(массив)` ронял подсказку при наведении.
   */
  const loreKey = (v) => {
    const raw = Array.isArray(v) ? v.find((x) => String(x ?? "").trim()) : v;
    return String(raw ?? "").trim();
  };

  function register(api) {
    const { PaperdollApp, PaperdollTooltip, util } = api;
    const { T, esc, safe, itemImg, option, uiArt, LOCATIONS, METAL_ARMOUR, LEATHER_ARMOUR, effectImg, stripTags } = util;
    const L = (k) => game.i18n.localize(k);
    const F = (k, d) => game.i18n.format(k, d);

    /**
     * Иконка заклинания или молитвы: своя по школе (у молитвы - по виду), иначе общая.
     * Путь у этих предметов ведёт в платный арт системы, поэтому itemImg тут бессилен -
     * решаем по сути записи, как у состояний и мутаций.
     */
    const magicImg = (it) => {
      const sys = it.system ?? {};
      const kind = it.type === "spell" ? "spell" : "prayer";
      const key = kind === "spell" ? loreKey(sys.lore?.value) || "petty" : loreKey(sys.type?.value) || "blessing";
      return effectImg(kind, { key, name: it.name }, it.img);
    };


    // Методы окна: сводка магии, подсказка, сотворение, штраф брони к касту
    class Magic {
      /** Вкладка «Магия и молитвы»: значения для сотворения, заклинания по лорам, благословения и чудеса */
      _magicView() {
        const actor = this.actor;
        const cfg = game.wfrp4e.config;
        const L = (k) => game.i18n.localize(k);
        if (!option("magicTab")) return null;
        const spells = actor.itemTypes.spell ?? [];
        const prayers = actor.itemTypes.prayer ?? [];
        const profile = this._profile();
        if (!spells.length && !prayers.length && !profile.caster) return null;
        const chars = actor.system.characteristics ?? {};
        const skills = actor.itemTypes.skill ?? [];
        const skillVal = (re, ch) => {
          const sk = skills.find((s) => re.test(s.name));
          return { name: sk ? T(sk.name) : L(cfg.characteristics?.[ch] ?? ch), value: Number(safe(() => sk.system.total?.value, null) ?? chars[ch]?.value) || 0 };
        };
        const stats = [];
        if (spells.length || profile.caster) {
          const cast = skillVal(/^language \(magick\)|^язык \(магическ/i, "int");
          const pen = this._castPenalty(profile);
          stats.push({ label: L("WFRPPD.Magic.Cast"), value: cast.value, sub: cast.name, cls: "" });
          for (const ch of skills.filter((s) => /^(channelling|концентрац)/i.test(s.name)))
            stats.push({ label: T(ch.name), value: Number(safe(() => ch.system.total?.value, 0)) || 0, sub: L("WFRPPD.Magic.Channel"), cls: "" });
          if (pen) stats.push({ label: L("WFRPPD.Stats.CastPenalty"), value: `-${pen} ${L("WFRPPD.Terms.Abbr.sl")}`, sub: L("WFRPPD.Magic.ArmourHint"), cls: "is-down" });
        }
        if (prayers.length) {
          const pray = skillVal(/^(pray|молитвослов)/i, "fel");
          stats.push({ label: L("WFRPPD.Magic.Pray"), value: pray.value, sub: pray.name, cls: "" });
          const sin = Number(actor.system.status?.sin?.value) || 0;
          stats.push({ label: L("WFRPPD.Stats.Sin"), value: sin, sub: L("WFRPPD.Magic.SinHint"), cls: sin ? "is-sin" : "is-zero" });
        }
        const row = (it) => {
          const sys = it.system;
          const cn = sys.cn?.value;
          // Голые значения нечитаемы: «6 yards · 1 · 6 Rounds» - что за «1»?
          // Подписываем то, что само себя не объясняет: число целей и ЧС. Дальность и длительность понятны как есть.
          const txt = (v) => String(v ?? "").trim();
          const target = txt(sys.target?.value);
          const bits = [
            txt(cn) ? `${L("WFRPPD.Magic.CN")} ${txt(cn)}` : "",
            txt(sys.range?.value),
            // «1» -> «цель: 1», но «Special» или «AoE (...)» оставляем как есть - они и так читаются
            target && /^\d+$/.test(target) ? `${L("WFRPPD.Magic.Target")}: ${target}` : target,
            txt(sys.duration?.value)
          ].filter(Boolean);
          // У заклинаний «на себя» дальность и цель совпадают («You · You») - повтор не несёт смысла
          const seen = new Set();
          const uniq = bits.filter((x) => (seen.has(x.toLowerCase()) ? false : seen.add(x.toLowerCase())));
          return { id: it.id, name: T(it.name), img: magicImg(it), info: uniq.join(" · "), memorized: !!sys.memorized?.value };
        };
        const groups = new Map();
        for (const sp of spells) {
          const lore = loreKey(sp.system.lore?.value) || "petty";
          const label = cfg.magicLores?.[lore] ? L(cfg.magicLores[lore]) : game.i18n.has?.(`WFRPPD.Magic.Lore.${lore}`) ? L(`WFRPPD.Magic.Lore.${lore}`) : lore;
          if (!groups.has(label)) groups.set(label, []);
          groups.get(label).push(row(sp));
        }
        for (const pr of prayers) {
          const t = pr.system.type?.value || "blessing";
          const label = cfg.prayerTypes?.[t] ? L(cfg.prayerTypes[t]) : game.i18n.has?.(`WFRPPD.Magic.Lore.${t}`) ? L(`WFRPPD.Magic.Lore.${t}`) : t;
          if (!groups.has(label)) groups.set(label, []);
          groups.get(label).push(row(pr));
        }
        return {
          stats,
          groups: [...groups].map(([label, rows]) => ({ label, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) })),
          empty: !spells.length && !prayers.length
        };
      }

      /** Подсказка заклинания или молитвы: крупная иконка, CN, дальность, цель, длительность, описание */
      _magicTooltip(it) {
        const L = (k) => game.i18n.localize(k);
        const sys = it.system;
        const cfg = game.wfrp4e.config;
        const key = it.type === "spell" ? loreKey(sys.lore?.value) : loreKey(sys.type?.value);
        const label = (it.type === "spell" ? cfg.magicLores : cfg.prayerTypes)?.[key];
        const kind = label ? L(label) : key;
        const kv = [
          [L("WFRPPD.Magic.CN"), sys.cn?.value],
          [L("WFRPPD.Magic.Range"), sys.range?.value],
          [L("WFRPPD.Magic.Target"), sys.target?.value],
          [L("WFRPPD.Magic.Duration"), sys.duration?.value]
        ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");
        const text = stripTags(sys.description?.value);
        const short = text.length > 700 ? `${text.slice(0, 700).trim()}…` : text;
        return `
          <div class="pd-tt-head">
            <div class="pd-tt-icon rarity-${it.type === "spell" ? "exotic" : "rare"}"><img src="${esc(magicImg(it))}" alt="" onerror="this.onerror=null;this.src='${esc(uiArt("ui-missing"))}'"></div>
            <div class="pd-tt-title">
              <div class="pd-tt-name">${esc(T(it.name))}</div>
              <div class="pd-tt-sub">${esc([L(it.type === "spell" ? "WFRPPD.Magic.Spell" : "WFRPPD.Magic.Prayer"), kind].filter(Boolean).join(" · "))}</div>
            </div>
          </div>
          ${kv.length ? `<div class="pd-tt-armour">${kv.map(([k, v]) => `<div class="pd-tt-ap-row"><span>${esc(k)}</span><span class="pd-tt-val is-text">${esc(v)}</span></div>`).join("")}</div>` : ""}
          ${it.type === "spell" ? `<div class="pd-tt-note ${sys.memorized?.value ? "is-good" : ""}">${esc(L(sys.memorized?.value ? "WFRPPD.Magic.Memorized" : "WFRPPD.Magic.NotMemorized"))}</div>` : ""}
          ${short ? `<div class="pd-tt-text pd-tr">${esc(short)}</div>` : ""}
          <div class="pd-tt-hint">${esc(L("WFRPPD.Magic.Hint"))}</div>`;
      }

      /** Сотворить заклинание или вознести молитву: через систему, иначе бросок против Языка (магического) / Молитвословия */
      async _castItem(it) {
        const actor = this.actor;
        const L = (k) => game.i18n.localize(k);
        try {
          const fn = it.type === "spell" ? actor.setupCast : actor.setupPrayer;
          if (!fn) throw new Error("no system test");
          const test = await fn.call(actor, it);
          if (test?.roll) await test.roll();
          return;
        } catch (err) {
          if (!/no system test/.test(String(err?.message))) console.warn("wfrp4e-paperdoll | cast", err);
        }
        const magic = this._magicView();
        const base = magic?.stats.find((s) => s.label === L(it.type === "spell" ? "WFRPPD.Magic.Cast" : "WFRPPD.Magic.Pray"))?.value ?? 0;
        const pen = it.type === "spell" ? this._castPenalty(this._profile()) : 0;
        const roll = await new Roll("1d100").evaluate();
        const r = roll.total;
        const ok = r <= 5 || (r <= base && r < 96);
        const sl = Math.floor(base / 10) - Math.floor(r / 10) - pen;
        const cn = Number(it.system.cn?.value) || 0;
        const done = it.type === "spell" ? ok && sl >= cn : ok;
        const content = `<div class="wfrp-paperdoll-rest"><b>${esc(T(it.name))}</b><br>${esc(
          game.i18n.format("WFRPPD.Rest.Roll", { r, target: base, sl: sl > 0 ? `+${sl}` : sl })
        )}${it.type === "spell" ? `<br>${esc(L("WFRPPD.Magic.CN"))} ${cn}` : ""}<br><b>${esc(done ? L("WFRPPD.Rest.Success") : L("WFRPPD.Rest.Fail"))}</b></div>`;
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }), content, rolls: [roll] });
      }

      /** Даёт ли эта броня штраф к касту этому магу */
      _castsThrough(item, profile) {
        const type = item.system.armorType?.value;
        if (profile.metalLore && (METAL_ARMOUR.includes(type) || item.system.isMetal)) return false;
        if (profile.beastLore && LEATHER_ARMOUR.includes(type)) return false;
        return true;
      }

      /** Штраф брони к касту: максимум AP по локациям среди «мешающей» брони */
      _castPenalty(profile, extra = null) {
        if (!profile.caster) return 0;
        const worn = this.actor.itemTypes.armour?.filter((a) => a.system.isEquipped) ?? [];
        const list = extra && !worn.includes(extra) ? [...worn, extra] : worn;
        let max = 0;
        for (const loc of LOCATIONS) {
          const ap = list
            .filter((a) => this._castsThrough(a, profile))
            .reduce((n, a) => n + (safe(() => a.system.currentAP?.[loc], null) ?? a.system.AP?.[loc] ?? 0), 0);
          max = Math.max(max, ap);
        }
        return max;
      }

    }
    api.mixin(Magic);

    /** Разметка вкладки */
    const renderTab = (app) => {
      const m = app._magicView();
      if (!m) return "";
      const stats = m.stats.map((s) => `<div class="pd-magic-stat"><span>${esc(s.label)}<small>${esc(s.sub)}</small></span><b class="${s.cls}">${esc(s.value)}</b></div>`).join("");
      const groups = m.groups
        .map(
          (g) => `<div class="pd-magic-group"><div class="pd-ecs-head">${esc(g.label)}</div>${g.rows
            .map(
              (r) => `<button type="button" class="pd-spell ${r.memorized ? "is-memorized" : ""}" data-item-id="${r.id}"><img src="${esc(itemImg(r.img, r.name))}" alt="" onerror="this.onerror=null;this.src='${esc(uiArt("ui-missing"))}'"><span class="pd-spell-body"><b>${esc(r.name)}${r.memorized ? ' <i class="pd-star">✦</i>' : ""}</b><small>${esc(r.info)}</small></span></button>`
            )
            .join("")}</div>`
        )
        .join("");
      return `<div class="pd-magic"><div class="pd-magic-stats">${stats}</div>${m.empty ? `<div class="pd-magic-empty">${esc(L("WFRPPD.Magic.Empty"))}</div>` : ""}${groups}</div>`;
    };

    /** Подсказки и сотворение по клику, ПКМ - лист */
    const bindTab = (app, el) => {
      for (const row of el.querySelectorAll(".pd-spell[data-item-id]")) {
        const it = app.actor.items.get(row.dataset.itemId);
        if (!it) continue;
        row.addEventListener("pointerenter", (ev) => PaperdollTooltip.showHtml(app._magicTooltip(it), ev));
        row.addEventListener("pointermove", (ev) => PaperdollTooltip.move(ev));
        row.addEventListener("pointerleave", () => PaperdollTooltip.hide());
        // Звёздочка: своя короткая подсказка, ушёл со звёздочки - снова подсказка заклинания
        const star = row.querySelector(".pd-star");
        star?.addEventListener("pointerenter", (ev) => PaperdollTooltip.showHtml(PaperdollTooltip.tipHtml(L("WFRPPD.Magic.StarTip")), ev, "tip"));
        star?.addEventListener("pointerleave", (ev) => PaperdollTooltip.showHtml(app._magicTooltip(it), ev));
        row.addEventListener("click", (ev) => {
          ev.preventDefault();
          PaperdollTooltip.hide();
          if (app.editable) app._castItem(it);
        });
        row.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          PaperdollTooltip.hide();
          it.sheet?.render(true);
        });
      }
    };

    api.registerAddon({
      id: ADDON,
      title: "WFRPPD.Addon.magic.Title",
      intro: "WFRPPD.Addon.magic.Intro",
      icon: "fa-hat-wizard",
      settings: [{ key: "magicTab", default: true }],
      tabs: [
        {
          id: "magic",
          label: "WFRPPD.Magic.Tab",
          icon: uiArt("stat-mind"),
          visible: (app) => !!app._magicView(),
          render: renderTab,
          onRender: bindTab
        }
      ],
      // Штраф брони к касту - в «Разуме», только у магов
      statSets(app, sets, { row, profile }) {
        if (!profile.caster) return;
        const pen = app._castPenalty(profile);
        sets.mental.push(row("WFRPPD.Stats.CastPenalty", pen ? `-${pen} ${L("WFRPPD.Terms.Abbr.sl")}` : "0", pen ? "is-down" : ""));
      },
      // Броня, которая мешает касту: предупреждение и минус к оценке в списке смены
      restrictions(app, item, slot, out, profile) {
        if (item.type !== "armour" || !profile.caster || item.system.isEquipped || !app._castsThrough(item, profile)) return;
        const delta = app._castPenalty(profile, item) - app._castPenalty(profile);
        if (delta > 0) {
          out.warn.push({ label: F("WFRPPD.Restr.Cast", { n: -delta }), hint: L("WFRPPD.Restr.CastHint") });
          out.score -= delta * 150;
        }
      }
    });
  }

  if (globalThis.__PD_MOCK__) register(globalThis.__PD_API__);
  else Hooks.once("wfrp4e-paperdoll.init", register);
})();
