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
  eq("кандидаты отсортированы по дистанции", cands.map((c) => Math.round(c.distance)), [1, 6, 20]);
  eq("в радиусе только ближний", cands.map((c) => c.inRange), [true, false, false]);

  // Таргет проставляется и снимается
  T.setTargets([cands[0].id]);
  eq("цель выбрана", [...game.user.targets].map((t) => t.name), ["Хьюго Брандлин"]);
  T.setTargets([]);
  eq("цель снята", game.user.targets.size, 0);

  return { fail, checks: 13 };
});

console.log(r.error ? `FAIL: ${r.error}` : r.fail.length ? `FAIL:\n${r.fail.join("\n")}` : `all pass (${r.checks} checks)`, "errors:", errs);
await b.close();
