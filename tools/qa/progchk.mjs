import { launch } from "./browser.mjs";
import path from "node:path";
const b = await launch();
const p = await b.newPage({ viewport: { width: 1100, height: 950 } });
// Проверка перевода нарочно зовёт Google: из file:// это всегда CORS - свой же шум не ловим
const noise = (t) => /translate\.googleapis\.com|net::ERR_FAILED/.test(t);
const errs=[]; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type()==="error" && !noise(m.text()) && errs.push(m.text()));
await p.goto("file://" + path.resolve(process.argv[2])); await p.waitForTimeout(1000);
const opts = await p.$$eval('#mock-cast option', e=>e.map(o=>o.textContent));
await p.selectOption('#mock-cast', String(opts.findIndex(o=>/Гюнтер/.test(o)))); await p.waitForTimeout(600);
await p.click('.pd-tab[data-tab="stats"]'); await p.waitForTimeout(300);
const xp = () => p.$eval('.pd-ecs', e => e.textContent.match(/Потрачено\s*(\d+)/)?.[1]).catch(()=>null);
const r = { views: await p.$$eval('.pd-ecs-view', e=>e.length), xp0: await xp() };
await p.click('.pd-adv:not(.is-off)'); await p.waitForTimeout(400); r.xp1 = await xp();
await p.click('.pd-ecs-view[data-view="tree"]'); await p.waitForTimeout(300);
r.tree = await p.$$eval('.pd-ecs-cat--tree .pd-adv', e=>e.length); r.career = await p.$$eval('.pd-ecs-cat--career', e=>e.length);
await p.click('.pd-talent-add'); await p.waitForTimeout(300);
r.offers = await p.$$eval('.pd-talentmenu [data-buy]', e=>e.length);
const t0 = await p.$$eval('.pd-ecs-cat--talents .pd-ecs-row, .pd-ecs-cat--talents [data-talent]', e=>e.length);
await p.click('.pd-talentmenu [data-buy]:not(.is-off)'); await p.waitForTimeout(500);
r.talentsBefore=t0; r.talentsAfter = await p.$$eval('.pd-ecs-cat--talents .pd-ecs-row, .pd-ecs-cat--talents [data-talent]', e=>e.length); r.xp2 = await xp();
// Описания в списке покупки талантов должны проходить через тот же перевод, что и подсказки:
// для этого они помечены классом .pd-tr, а окно прогоняется через PaperdollTooltip.translate
// В моке компендиум талантов пуст, поэтому описания подкладываем сами - тем же ключом (norm)
await p.evaluate(() => {
  const norm = (x) => String(x ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  for (const b of document.querySelectorAll(".pd-talentmenu [data-buy]"))
    window.PaperdollApp._talentLib.set(norm(b.dataset.buy), "You gain a permanent bonus to your Wounds, equal to your Toughness Bonus.");
  [...window.PaperdollApp.instances.values()].forEach((x) => x.render());
});
await p.waitForTimeout(500);
await p.click('.pd-talent-add').catch(() => {}); await p.waitForTimeout(300);
r.offerDescTagged = await p.$$eval('.pd-talentmenu [data-buy] small.pd-tr', (e) => e.length);
r.offerDescTotal = await p.$$eval('.pd-talentmenu [data-buy] small', (e) => e.length);
// Включаем перевод описаний и смотрим наблюдаемый признак: ядро помечает текст
// классом is-translating ровно перед отправкой провайдеру. Сеть при этом не нужна.
r.offerDescTranslating = await p.evaluate(async () => {
  await game.settings.set("wfrp4e-paperdoll", "translateText", "google");
  const app = [...window.PaperdollApp.instances.values()][0];
  app.render();
  await new Promise((res) => setTimeout(res, 500));
  const n = document.querySelectorAll(".pd-talentmenu small.pd-tr.is-translating, .pd-talentmenu small.pd-tr[title]").length;
  await game.settings.set("wfrp4e-paperdoll", "translateText", "off");
  return n;
});
// Настройка мира «Только навыки карьеры»: шаг вне карьеры игроку запрещён, ведущему - нет.
// Берём характеристику: у Гюнтера все навыки карьерные, а характеристик вне карьеры пять
Object.assign(r, await p.evaluate(async () => {
  const S = (k, v) => game.settings.set("wfrp4e-paperdoll", k, v);
  const app = [...window.PaperdollApp.instances.values()][0];
  const chars = Object.keys(app.actor.system.characteristics ?? {});
  const key = chars.find((k) => app._inCareer("char", k) === false);
  const adv = () => Number(app.actor.system.characteristics[key].advances) || 0;
  const info = () => { app.render(); return app._advInfo("char", key); };
  const res = { outChar: key };

  game.user.isGM = false;
  await S("careerOnly", false);
  res.clsUnlocked = info().cls;
  const a0 = adv();
  await app._advance("char", key, 1);
  res.advUnlocked = adv() - a0;

  await S("careerOnly", true);
  const locked = info();
  res.clsLocked = locked.cls;
  // Сверяем не с русским текстом, а с самой строкой локализации - перевод может поменяться
  res.hintLocked = locked.hint.includes(game.i18n.localize("WFRPPD.Adv.Locked"));
  const a1 = adv();
  await app._advance("char", key, 1);
  res.advLocked = adv() - a1;
  // Возврат шага остаётся доступен даже при запрете
  await app._advance("char", key, -1);
  res.refundLocked = adv() - a1;

  // Ведущему запрет не мешает
  game.user.isGM = true;
  res.clsGM = info().cls;
  const a2 = adv();
  await app._advance("char", key, 1);
  res.advGM = adv() - a2;

  game.user.isGM = false;
  await S("careerOnly", false);
  return res;
}));
// Подсказка навыка и видимость «+» (дерево уже открыто на Гюнтере)
Object.assign(r, await p.evaluate(() => {
  const app = [...window.PaperdollApp.instances.values()][0];
  const sk = app.actor.itemTypes.skill[0];
  const hint = app._skillHint(sk, app._advInfo("skill", sk));
  const rows = [...document.querySelectorAll(".pd-ecs-row")].filter((x) => x.querySelector(".pd-adv:not(.is-off)"));
  const op = (x) => Number(getComputedStyle(x.querySelector(".pd-adv")).opacity);
  const goal = rows.filter((x) => x.querySelector(".pd-goal"));
  const plain = rows.filter((x) => !x.querySelector(".pd-goal"));
  // Подсказка должна висеть на самой строке навыка, а не только возвращаться методом
  const skillRow = [...document.querySelectorAll(".pd-ecs-row.is-child .pd-ecs-main[data-pd-tip]")]
    .find((x) => /На характеристике/.test(x.dataset.pdTip));
  return {
    skillHintChar: /На характеристике/.test(hint),
    skillHintSteps: /Шаги развития/.test(hint),
    // Цена шага - на всей строке, а не только в подсказке мелкого «+»
    skillHintCost: /Шаг развития .+опыта/.test(hint),
    skillHintFree: /Доступно опыта/.test(hint),
    charHintCost: (() => {
      const row = [...document.querySelectorAll(".pd-ecs-row .pd-ecs-main[data-pd-tip]")]
        .find((x) => /^Бонус:/.test(x.dataset.pdTip));
      return !!row && /Шаг развития .+опыта/.test(row.dataset.pdTip);
    })(),
    skillHintInDom: !!skillRow,
    advGoalRows: goal.length,
    advGoalShown: goal.length > 0 && goal.every((x) => op(x) > 0),
    advPlainHidden: plain.length > 0 && plain.every((x) => op(x) === 0)
  };
}));
// Навык, которым бьёт оружие, и Стойкость для отдыха - что окно считает по навыку
Object.assign(r, await p.evaluate(() => {
  const app = [...window.PaperdollApp.instances.values()][0];
  const find = (re) => app.actor.itemTypes.skill.find((s) => re.test(s.name));
  const hint = (s) => (s ? app._skillHint(s, null) : "");
  return {
    skillUsesWeapon: /Шанс попасть/.test(hint(find(/^Melee \(Basic\)/))),
    skillUsesRest: /Отдых/.test(hint(find(/^Endurance/)))
  };
}));
// Настройка мира видна в окне настроек только ведущему
const sp = await b.newPage({ viewport: { width: 900, height: 800 } });
sp.on("pageerror", (e) => errs.push(e.message));
await sp.goto("file://" + path.resolve(process.argv[2]).replace(/\.html$/, "-settings.html"));
await sp.waitForTimeout(800);
Object.assign(r, await sp.evaluate(async () => {
  const draw = async () => {
    const html = await new window.PaperdollSettings()._renderHTML();
    return String(typeof html === "string" ? html : (html?.content ?? html?.innerHTML ?? ""));
  };
  game.user.isGM = true;
  const gm = await draw();
  game.user.isGM = false;
  const player = await draw();
  game.user.isGM = true;
  return { setupGM: gm.includes('name="careerOnly"'), setupPlayer: player.includes('name="careerOnly"') };
}));
console.log(JSON.stringify(r), errs); await b.close();
