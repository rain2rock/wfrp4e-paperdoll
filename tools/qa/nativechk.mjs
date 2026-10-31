import assert from "node:assert/strict";
import path from "node:path";
import { launch } from "./browser.mjs";
import { effectIconFor } from "../../scripts/icon-rules.js";
import { ICON_OVERRIDES } from "../../scripts/icon-index.js";

// Не просто наличие PNG: проверяем выбор своей картинки для реальных форм данных.
assert.equal(effectIconFor("spell", { key: "fire" }, ICON_OVERRIDES), "magic/spell-fire.png");
assert.equal(effectIconFor("spell", { key: "unknown" }, ICON_OVERRIDES), "magic/spell.png");
assert.equal(effectIconFor("prayer", { key: "blessing", god: "Shallya" }, ICON_OVERRIDES), "magic/gods/god-shallya.png");
assert.equal(effectIconFor("prayer", { key: "miracle", god: "Сигмар" }, ICON_OVERRIDES), "magic/gods/god-sigmar.png");
assert.equal(effectIconFor("prayer", { key: "blessing", god: "unknown" }, ICON_OVERRIDES), "magic/prayer-blessing.png");
assert.equal(effectIconFor("mutation", { type: "mental", name: "Unknown mutation" }, ICON_OVERRIDES), "mutations/mutation-mental.png");

const browser = await launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + path.resolve(process.argv[2]));
  await page.waitForFunction(() => globalThis.__PD_API__?.PaperdollApp?.instances?.size);
  const result = await page.evaluate(async () => {
    const api = globalThis.__PD_API__;
    const app = [...api.PaperdollApp.instances.values()][0];
    const actor = app.actor;
    const fail = [];
    let checks = 0;
    const eq = (name, actual, expected) => {
      checks++;
      if (JSON.stringify(actual) !== JSON.stringify(expected)) fail.push(`${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    };
    const tb = actor.system.characteristics.t.bonus;
    const initial = actor.system.status.wounds.value;
    const max = actor.system.status.wounds.max;
    const originalRoll = globalThis.Roll;
    let fallbackRolls = 0;
    globalThis.Roll = class extends originalRoll {
      constructor(...args) { super(...args); fallbackRolls++; }
    };
    try {
      let ctx;
      let rolls = 0;
      actor.setupSkill = async (skill, context) => {
        ctx = { skill: skill.name, ...context };
        return { roll: async () => { rolls++; } };
      };
      await actor.update({ "system.status.wounds.value": 1 });
      eq("native rest accepted", await app._restRecover(), true);
      eq("native rest uses Endurance", /endurance|стойкость/i.test(ctx.skill), true);
      eq("native rest context", [ctx.rest, ctx.tb, ctx.skipTargets, ctx.modifier], [true, tb, true, undefined]);
      eq("native test rolled once", rolls, 1);
      eq("healing waits for the system card", actor.system.status.wounds.value, 1);
      eq("no custom rest roll", fallbackRolls, 0);

      actor.setupSkill = async () => null;
      eq("cancelled rest returns false", await app._restRecover(true), false);
      eq("cancelled day gives no bonus", actor.system.status.wounds.value, 1);
      eq("cancelled rest does not roll", fallbackRolls, 0);

      actor.setupSkill = async () => { throw new Error("intentional setup failure"); };
      eq("setup failure returns false", await app._restRecover(), false);
      eq("setup failure does not roll or heal", [fallbackRolls, actor.system.status.wounds.value], [0, 1]);

      actor.setupSkill = async () => ({ roll: async () => { throw new Error("intentional roll failure"); } });
      eq("roll failure returns false", await app._restRecover(true), false);
      eq("roll failure gives no fallback or day bonus", [fallbackRolls, actor.system.status.wounds.value], [0, 1]);

      let release;
      actor.setupSkill = () => new Promise((resolve) => { release = resolve; });
      const first = app._restRecover();
      eq("double click does not start another test", await app._restRecover(), false);
      release({ roll: async () => { rolls++; } });
      await first;
      eq("pending lock released", app._restPending, false);

      delete actor.setupSkill;
      actor.setupCharacteristic = async (key, context) => {
        ctx = { key, ...context };
        return { roll: async () => { rolls++; } };
      };
      eq("characteristic fallback accepted", await app._restRecover(), true);
      eq("characteristic is Toughness with native rest flag", [ctx.key, ctx.rest, ctx.tb], ["t", true, tb]);
      await app._restRecover(true);
      eq("full day adds only its fixed bonus immediately", actor.system.status.wounds.value, Math.min(max, 1 + tb));
      await actor.update({ "system.status.wounds.value": max - 1 });
      await app._restRecover(true);
      eq("day bonus cannot exceed max wounds", actor.system.status.wounds.value, max);
      eq("all native rest paths avoid custom d100", fallbackRolls, 0);

      const result = api.util.testResult;
      eq("96 vs 99 is failure with negative SL", [result(96, 99).ok, result(96, 99).sl], [false, -1]);
      eq("01 vs 01 gives at least one SL", [result(1, 1).ok, result(1, 1).sl], [true, 1]);
      eq("ordinary failed SL remains arithmetic", result(71, 65).sl, -1);

      for (const [kind, method] of [["weapon", "setupWeapon"], ["skill", "setupSkill"], ["char", "setupCharacteristic"]]) {
        let rolled = 0;
        actor[method] = async () => ({ roll: async () => { rolled++; } });
        eq(`${kind}: native check succeeds`, await app._rollTest(kind, "test-ref"), true);
        eq(`${kind}: native check rolls once`, rolled, 1);
        actor[method] = async () => null;
        eq(`${kind}: native check cancellation`, await app._rollTest(kind, "test-ref"), false);
        actor[method] = async () => { throw new Error("intentional native check setup failure"); };
        eq(`${kind}: native check setup error`, await app._rollTest(kind, "test-ref"), false);
        actor[method] = async () => ({ roll: async () => { throw new Error("intentional native check roll failure"); } });
        eq(`${kind}: native check roll error`, await app._rollTest(kind, "test-ref"), false);
        delete actor[method];
      }
      eq("no failed check triggers fallback d100", fallbackRolls, 0);

      const createEffects = actor.createEmbeddedDocuments;
      try {
        const copied = [];
        actor.createEmbeddedDocuments = async (kind, data) => { copied.push(...data); return data; };
        let releaseItem;
        let quantityUpdates = 0;
        const item = {
          id: "native-consumable", uuid: "Actor.hugo.Item.native-consumable", name: "Test draught",
          type: "trapping", system: { consumable: true, quantity: { value: 1 } },
          effects: [
            { name: "dose effect", transfer: false, changes: [], duration: {} },
            { name: "legacy passive", transfer: true },
            { name: "system passive", system: { transferData: { type: "document" } } },
            { name: "disabled", disabled: true }
          ],
          postItem: () => new Promise((resolve) => { releaseItem = resolve; }),
          update: async (data) => { quantityUpdates++; item.system.quantity.value = data["system.quantity.value"]; }
        };
        const firstUse = app._useItem(item);
        eq("duplicate item click is ignored while posting", await app._useItem(item), false);
        releaseItem();
        eq("first use succeeds", await firstUse, true);
        eq("one dose deducted once", [item.system.quantity.value, quantityUpdates], [0, 1]);
        eq("only active dose effect is copied", copied.map((e) => e.name), ["dose effect"]);
        eq("effect remembers item origin", copied[0]?.origin, item.uuid);
        eq("empty stack cannot be consumed", await app._useItem(item), false);
        eq("empty stack creates no second effect", copied.length, 1);
        eq("consumable lock cleared", app._usingItems.size, 0);
        item.system.quantity.value = 1;
        item.postItem = async () => { throw new Error("intentional item post failure"); };
        eq("failed item post stops use", await app._useItem(item), false);
        eq("failed item post preserves quantity", item.system.quantity.value, 1);
        eq("failed item post releases lock", app._usingItems.size, 0);
        item.postItem = () => { throw new Error("intentional synchronous post failure"); };
        eq("synchronous post failure stops use", await app._useItem(item), false);
        eq("synchronous post failure preserves quantity", item.system.quantity.value, 1);
        item.postItem = async () => {};
        actor.createEmbeddedDocuments = async () => { throw new Error("intentional effect failure"); };
        eq("effect failure stops use", await app._useItem(item), false);
        eq("effect failure preserves quantity", item.system.quantity.value, 1);
      } finally {
        actor.createEmbeddedDocuments = createEffects;
      }

      if (typeof app._castItem === "function") {
        eq("spell icon embedded in standalone mock", !!globalThis.__PD_ASSETS__["icons/magic/spell-fire.png"], true);
        eq("nested deity icon embedded in standalone mock", !!globalThis.__PD_ASSETS__["icons/magic/gods/god-shallya.png"], true);
        const wizard = globalThis.__PD_actors.find((a) => a.id === "wizard");
        const wizardApp = api.PaperdollApp.openFor(wizard);
        const fireSpell = wizard.items.find((i) => i.type === "spell" && i.name.includes("Огненная стрела"));
        const row = wizardApp._magicView().groups.flatMap((g) => g.rows).find((r) => r.id === fireSpell.id);
        eq("spell row uses actual school image, not missing fallback", row.img, globalThis.__PD_ASSETS__["icons/magic/spell-fire.png"]);
        for (const [kind, method] of [["spell", "setupCast"], ["prayer", "setupPrayer"]]) {
          const item = { type: kind, name: "Native integration check", system: {} };
          let castRolls = 0;
          actor[method] = async () => ({ roll: async () => { castRolls++; } });
          eq(`${kind}: system roll accepted`, await app._castItem(item), true);
          eq(`${kind}: rolled once`, castRolls, 1);
          actor[method] = async () => null;
          eq(`${kind}: cancellation respected`, await app._castItem(item), false);
          actor[method] = async () => { throw new Error("intentional cast setup failure"); };
          eq(`${kind}: system error stops the cast`, await app._castItem(item), false);
          actor[method] = async () => ({ roll: async () => { throw new Error("intentional cast roll failure"); } });
          eq(`${kind}: roll error stops the cast`, await app._castItem(item), false);
          let releaseCast;
          actor[method] = () => new Promise((resolve) => { releaseCast = resolve; });
          const firstCast = app._castItem(item);
          eq(`${kind}: duplicate cast click ignored`, await app._castItem(item), false);
          releaseCast({ roll: async () => { castRolls++; } });
          await firstCast;
          eq(`${kind}: pending cast lock cleared`, app._castingItems.size, 0);
          delete actor[method];
        }
        eq("failed or cancelled native casts never roll fallback", fallbackRolls, 0);
      }
    } finally {
      delete actor.setupSkill;
      delete actor.setupCharacteristic;
      globalThis.Roll = originalRoll;
      await actor.update({ "system.status.wounds.value": initial });
    }
    return { checks, fail };
  });
  assert.deepEqual(result.fail, [], result.fail.join("\n"));
  assert.deepEqual(errors, [], "Browser errors");
  console.log(`all pass (${result.checks + 6} native integration and icon checks)`);
} finally {
  await browser.close();
}
