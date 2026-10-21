import { launch } from "./browser.mjs";
import path from "node:path";
const b = await launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto("file://" + path.resolve(process.argv[2])); await p.waitForTimeout(1200);

const r = await p.evaluate(() => {
  const T = window.__PD_MAGIC_TARGETING__;
  if (!T) return { error: "targeting.js не загрузился" };
  const priest = (window.__PD_actors ?? []).find((a) => a.id === "priest");
  if (!priest) return { error: "в моке нет жрицы (нужен --cast)" };
  const fail = [];
  const eq = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail.push(`${what}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`); };

  // Разбор дальностей. СВБ жрицы = 5, значит «Willpower Bonus yards» = 5 ярдов
  const wpb = priest.system.characteristics.wp.bonus;
  eq("СВБ", wpb, 5);
  const kind = (s) => { const x = T.parseRange(s, priest); return [x.kind, x.yards]; };
  eq("You", kind("You"), ["self", 0]);
  eq("Touch", kind("Touch"), ["touch", 1]);
  eq("WPB yards", kind("Willpower Bonus yards"), ["ranged", 5]);
  eq("12 yards", kind("12 yards"), ["ranged", 12]);
  eq("AoE", kind("AoE (Willpower Bonus yards)"), ["area", 5]);
  // Нераспознанное не должно падать и не должно притворяться нулевой дальностью
  eq("мусор", kind("какая-то ерунда"), ["none", null]);
  eq("пусто", kind(""), ["none", null]);

  // План каста: на себя цель не нужна, у «бодрости» целей столько же, сколько СВБ
  const plan = (part) => T.castPlan(priest, priest.items.find((i) => i.type === "prayer" && i.name.includes(part)));
  eq("стойкость - цель не нужна", plan("стойкости").needsTarget, false);
  eq("защита - нужна 1 цель", [plan("защиты").needsTarget, plan("защиты").count], [true, 1]);
  eq("бодрость - целей по СВБ", plan("бодрости").count, wpb);

  // Кто в радиусе: Хьюго в 1 ярде попадает в 5, Гюнтер в 6 - нет
  const cands = T.targetsInRange(priest, plan("защиты").range);
  eq("кандидаты отсортированы по дистанции", cands.map((c) => Math.round(c.distance)), [1, 2, 6, 20]);
  eq("в радиусе только ближние", cands.map((c) => c.inRange), [true, true, false, false]);

  // Таргет проставляется и снимается
  T.setTargets([cands[0].id]);
  eq("цель выбрана", [...game.user.targets].map((t) => t.name), ["Хьюго Брандлин"]);
  T.setTargets([]);
  eq("цель снята", game.user.targets.size, 0);

  // --- Заклинания: ветвление по данным, а не по названиям ---
  const wiz = (window.__PD_actors ?? []).find((a) => a.id === "wizard");
  if (!wiz) fail.push("в моке нет мага (нужен --cast)");
  else {
    const sp = (part) => T.castPlan(wiz, wiz.items.find((i) => i.type === "spell" && i.name.includes(part)));
    const wpbW = wiz.system.characteristics.wp.bonus;

    // Множитель в дальности: «Willpower Bonus x2 yards»
    eq("шар - дальность СВБ x2", sp("шар").range.yards, wpbW * 2);
    // На себя: цель не нужна. Перекаст теперь берётся из данных системы, а не выводится по полям
    eq("броня - на себя", [sp("броня").needsTarget, sp("броня").count], [false, 0]);
    eq("броня - перекаст не включён", sp("броня").overcast.enabled, false);
    // Площадь: число в target - это радиус, а НЕ количество целей
    eq("шар - площадь без счётчика целей", [sp("шар").area, sp("шар").count], [true, null]);
    eq("шар - радиус области", sp("шар").areaRadius, 4);
    eq("полог - радиус области по СВБ", sp("Полог").areaRadius, wpbW);
    // Урон и ингредиент видны, когда они есть в данных
    eq("стрела - урон", sp("стрела").damage, "+4");
    eq("касание - ингредиент", sp("касание").ingredient, "Уголёк");
    eq("полог - без урона", sp("Полог").damage, null);
    eq("полог - перекаст со своим ярлыком", [sp("Полог").overcast.enabled, sp("Полог").overcast.label], [true, "Distance (yds.)"]);
    eq("перекаст: источник величины", sp("Полог").overcast.perOvercast.type, "characteristic");
    // ЧС и излишек УУ
    eq("стрела - ЧС", sp("стрела").cn, 4);
    eq("перекаст при 7 УУ", T.overcastBudget(sp("стрела"), 7), { success: true, spare: 3, need: 4, got: 7 });
    eq("провал при 2 УУ", T.overcastBudget(sp("стрела"), 2), { success: false, spare: 0, need: 4, got: 2 });
    // Длительность: мгновенное против длящегося
    eq("стрела - мгновенное", sp("стрела").duration.kind, "instant");
    eq("броня - длящееся", sp("броня").duration.kind, "lasting");

    // Готовое значение системы важнее сырой строки: у «Зова ветров» Range = 30, хотя в range.value стоит СВБ (5)
    eq("приоритет вычисленной дальности", sp("ветров").range.yards, 30);
    eq("вычисленная дальность - не СВБ", sp("ветров").range.yards !== wpbW, true);

    // --- Формы дальностей ИЗ ЖИВЫХ КОМПЕНДИУМОВ (снято diagnose-magic.js), а не придуманные ---
    const wp = wiz.system.characteristics.wp.value;
    const fel = wiz.system.characteristics.fel;
    const ini = wiz.system.characteristics.i.value;
    const rk = (str) => { const x = T.parseRange(str, wiz); return [x.kind, x.yards]; };
    eq("You or Touch - касание", rk("You or Touch"), ["touch", 1]);
    eq("Self - на себя", rk("Self"), ["self", 0]);
    eq("вся характеристика, не бонус", rk("Willpower yards"), ["ranged", wp]);
    eq("половина характеристики", rk("Half Willpower yards"), ["ranged", Math.floor(wp / 2)]);
    eq("деление косой чертой", rk("Willpower / 2 yards"), ["ranged", Math.floor(wp / 2)]);
    eq("множитель звёздочкой", rk("2 * Fellowship Bonus yards"), ["ranged", fel.bonus * 2]);
    eq("мили в ярды", rk("Fellowship Bonus miles"), ["ranged", fel.bonus * 1760]);
    eq("просто миля", rk("1 mile"), ["ranged", 1760]);
    eq("хвост в скобках не мешает", rk("20 yards (can't be extended)"), ["ranged", 20]);
    eq("слитное написание", rk("FellowshipBonus yards"), ["ranged", fel.bonus]);
    eq("инициатива пополам", rk("Initiative / 2 yards"), ["ranged", Math.floor(ini / 2)]);
    // Особые дальности: числа не выдумываем
    for (const str of ["Line of sight", "Special", "See text", "Random Vortex"]) {
      eq(`особая дальность «${str}»`, rk(str), ["none", null]);
    }
    eq("особая помечена флагом", T.parseRange("Line of sight", wiz).special, true);

    // Посчитанная СТРОКА от геттера (так отдаёт предмет С владельцем, проверено на «Bolt»):
    // берём 40 из "40 yards", а не 52 из характеристики по сырой строке "Willpower yards"
    eq("строка геттера важнее характеристики", sp("Молния").range.yards, 40);
    eq("не пересчитали СВ сами", sp("Молния").range.yards !== wiz.system.characteristics.wp.value, true);
    eq("урон из геттера числом", sp("Молния").damage, "8");

    // Ноль от геттера - «не посчитано» (у предмета из компендиума нет владельца), а не нулевая дальность.
    // Проверено на живом мире: у заклинания с range.value "Touch" система отдала Range = 0
    eq("ноль геттера не перебивает Touch", [sp("Касание без").range.kind, sp("Касание без").range.yards], ["touch", 1]);
    eq("ноль геттера не ломает длительность", sp("Касание без").duration.kind, "lasting");
    eq("ноль геттера не создаёт урон", sp("Касание без").damage, null);

    // --- Явные поля системы вместо догадок ---
    eq("площадь по флагу target.aoe", sp("шар").area, true);
    eq("перекаст из данных системы", sp("шар").overcast.enabled, true);
    eq("ярлык перекаста - свободный текст", sp("шар").overcast.label, "Targets");
    eq("магический снаряд флагом", sp("шар").magicMissile, true);
    eq("ингредиенты массивом", [sp("касание").ingredients.length, sp("касание").ingredient], [1, "Уголёк"]);
    eq("без перекаста - enabled false", sp("стрела").overcast.enabled, false);
  }

  // --- Форма lore из живого мира: это МАССИВ, а не строка ---
  const wiz2 = (window.__PD_actors ?? []).find((a) => a.id === "wizard");
  if (wiz2) {
    const app2 = [...window.PaperdollApp.instances.values()].find((a) => a.actor.id === "wizard")
      ?? window.PaperdollApp.openFor(wiz2);
    const sp0 = wiz2.items.find((i) => i.type === "spell");
    const saved = sp0.system.lore.value;
    sp0.system.lore.value = [""];           // так отдаёт живая система у «Bolt»
    const view = app2._magicView();
    eq("пустой массив lore не даёт пустую группу", view.groups.every((g) => String(g.label).trim() !== ""), true);
    let threw = false;
    try { app2._magicTooltip(sp0); } catch { threw = true; }
    eq("подсказка не падает на массиве lore", threw, false);
    sp0.system.lore.value = ["petty"];      // массив с настоящей школой
    eq("массив со школой распознаётся", app2._magicView().groups.some((g) => /прост|petty/i.test(String(g.label))), true);
    sp0.system.lore.value = saved;
    eq("у заклинания есть иконка", !!app2._magicView().groups[0]?.rows[0]?.img, true);
  }

  // --- Оружие: полосы дальности (та же машинка дистанций, что у магии, но из ядра) ---
  const U = window.__PD_API__?.util;
  const hugo = (window.__PD_actors ?? []).find((a) => a.id === "hugo");
  const sling = hugo?.items.find((i) => i.id === "sling");
  if (!U?.weaponRangeBand || !sling) fail.push("в ядре нет weaponRangeBand или в моке нет пращи");
  else {
    eq("дальность пращи из системы", U.weaponRangeYards(sling), 60);
    const band = (d) => { const x = U.weaponRangeBand(sling, d); return [x.key, x.mod]; };
    // Границы полос для дальности 60: в упор <=6, короткая <=30, обычная <=60, длинная <=120, запредельная <=180
    eq("6я - в упор", band(6), ["pointBlank", 20]);
    eq("7я - короткая", band(7), ["short", 10]);
    eq("30я - ещё короткая", band(30), ["short", 10]);
    eq("31я - обычная", band(31), ["normal", 0]);
    eq("60я - ещё обычная", band(60), ["normal", 0]);
    eq("61я - длинная", band(61), ["long", -10]);
    eq("120я - ещё длинная", band(120), ["long", -10]);
    eq("121я - запредельная", band(121), ["extreme", -30]);
    eq("181я - вне досягаемости", band(181), ["outOfRange", null]);
    // Нет цели - строки в подсказке просто не будет, а не ошибка
    eq("без дистанции - null", U.weaponRangeBand(sling, null), null);
    // Ближний бой: дальности нет, полос тоже
    const flail = hugo.items.find((i) => i.id === "flail");
    eq("ближний бой - без дальности", U.weaponRangeYards(flail), null);

    // --- Атака по выбранной цели: итог с учётом цели ---
    const app = [...window.PaperdollApp.instances.values()].find((a) => a.actor.id === "hugo");
    if (!app) fail.push("окно Хьюго не открыто");
    else {
      // Без цели - считать нечего
      U.tokensInRange(hugo).forEach(() => {});
      [...game.user.targets].forEach((t) => t.setTarget(false));
      eq("без цели - null", U.targetedAttack(app, sling), null);

      // Цель - Гюнтер в 5 ярдах: в упор (+20) для пращи 60я, стойкость 4 и броня корпуса 1
      const vet = canvas.tokens.placeables.find((t) => t.name.includes("Гюнтер"));
      vet.setTarget(true);
      const aim = U.targetedAttack(app, sling);
      eq("полоса до цели", aim.band.key, "pointBlank");
      // Систему модификаторов считает сама - мы их НЕ складываем, только перечисляем справочно
      eq("шанс остаётся базовым", [aim.hit.base, aim.hit.mod, aim.hit.total], [38, 0, 38]);
      eq("полоса дальности в справке", aim.willApply.some((x) => /упор/i.test(x)), true);
      eq("урон за вычетом стойкости и брони", [aim.damage.full, aim.damage.tb, aim.damage.ap, aim.damage.net], [6, 4, 1, 1]);
      eq("разбор урона непустой", aim.damage.parts.length > 0, true);

      // Ближний бой: полосы нет, но стойкость и броня учитываются
      const sword = hugo.items.find((i) => i.id === "sword");
      const melee = U.targetedAttack(app, sword);
      eq("ближний бой - без полосы", melee.band, null);
      eq("ближний бой - шанс без модификатора", melee.hit.mod, 0);
      eq("справка не пустая при окружении", Array.isArray(melee.willApply), true);
      eq("ближний бой - урон срезан бронёй", melee.damage.net, melee.damage.full - melee.damage.tb - melee.damage.ap);

      [...game.user.targets].forEach((t) => t.setTarget(false));
    }
  }

  return { fail, checks: 83 };
});

console.log(r.error ? `FAIL: ${r.error}` : r.fail.length ? `FAIL:\n${r.fail.join("\n")}` : `all pass (${r.checks} checks)`, "errors:", errs);
await b.close();
