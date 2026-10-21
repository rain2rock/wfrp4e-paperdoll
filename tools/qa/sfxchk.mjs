import { launch } from "./browser.mjs";
import path from "node:path";
const b = await launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
// Звук синтезируется через Web Audio: считаем созданные источники - столько «сыграло»
await p.addInitScript(() => {
  window.__sfx = [];
  const AC = window.AudioContext;
  const o = AC.prototype.createOscillator, bs = AC.prototype.createBufferSource;
  AC.prototype.createOscillator = function () { window.__sfx.push("osc"); return o.call(this); };
  AC.prototype.createBufferSource = function () { window.__sfx.push("noise"); return bs.call(this); };
});
await p.goto("file://" + path.resolve(process.argv[2])); await p.waitForTimeout(1200);

const r = await p.evaluate(async () => {
  const app = [...window.PaperdollApp.instances.values()][0];
  const actor = window.__PD_actors[0];
  const wait = () => new Promise((res) => setTimeout(res, 200));
  const out = {};
  const armour = actor.items.find((i) => i.type === "armour" && !i.system.isEquipped);
  const slot = armour && app._defaultSlot(armour);
  // Без подходящей вещи проверка бессмысленна - лучше честно упасть, чем молча «пройти»
  if (!slot) return { error: "в моке не нашлось ненадетой брони со слотом" };

  window.__sfx = [];
  await app._equipTo(armour, slot); await wait();
  out.equip = window.__sfx.slice();

  window.__sfx = [];
  await app._unequip(armour); await wait();
  out.unequip = window.__sfx.slice();

  const loose = actor.items.find((i) => i.system?.isPhysical && i.type !== "container" && !(i.system.location?.value) && !i.system.isEquipped);
  const bag = actor.items.find((i) => i.type === "container");
  window.__sfx = [];
  await app._moveToContainer(loose, bag.id); await wait();
  out.move = window.__sfx.slice();

  window.__sfx = [];
  await app._changeMoney("gc", 1); await wait();
  out.coin = window.__sfx.slice();
  return out;
});

// Монеты в окне группы ГМ (то же, что и в основном окне)
await p.check("#mock-gm"); await p.waitForTimeout(150);
await p.click("#mock-group"); await p.waitForTimeout(500);
await p.evaluate(() => { window.__sfx = []; });
await p.click(".pd-group-card:nth-child(1) .pd-coin--gc"); await p.waitForTimeout(400);
r.coinInGroupWindow = await p.evaluate(() => window.__sfx.length);

console.log(JSON.stringify(r), "errors:", errs);
await b.close();
