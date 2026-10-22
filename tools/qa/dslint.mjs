/**
 * Линт дизайн-системы: ловит «сырые» пиксели в CSS, которые должны быть токенами
 * (см. styles/pd-system.css). Нарушением считается:
 *   - border-radius с px-литералом (нужен var(--pd-radius*) | 50% | 0);
 *   - font-size с px-литералом (нужна шкала var(--pd-fs-*));
 *   - padding / margin / gap со значением 4px и больше (нужен var(--pd-space-*);
 *     1-3px - микросдвиги бейджей, их не трогаем).
 *
 * Старый код чинится постепенно, поэтому линт сравнивает с базлайном:
 * FAIL - только если нарушений стало БОЛЬШЕ, чем в tools/qa/dslint-baseline.json.
 * Починил часть - обнови базлайн: node tools/qa/dslint.mjs --update
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE = path.join(root, "tools/qa/dslint-baseline.json");
const FILES = [
  "styles/pd-system.css",
  "styles/paperdoll.css",
  ...fs.readdirSync(path.join(root, "addons")).map((id) => `addons/${id}/styles/${id}.css`).filter((p) => fs.existsSync(path.join(root, p)))
];

const RULES = [
  { name: "border-radius в px", re: /border-radius:[^;}]*?\b([4-9]|\d{2,})px/g },
  { name: "font-size в px", re: /font-size:\s*\d+(\.\d+)?px/g },
  { name: "отступ в px (4px и больше)", re: /(?:padding|margin|gap|column-gap|row-gap):[^;}]*?\b(?:[4-9]|\d{2,})(?:\.\d+)?px/g }
];

const count = (file) => {
  // Комментарии не считаем - в них примеры и пояснения
  const css = fs.readFileSync(path.join(root, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const out = {};
  for (const r of RULES) out[r.name] = [...css.matchAll(r.re)].length;
  return out;
};

const current = Object.fromEntries(FILES.map((f) => [f, count(f)]));

if (process.argv.includes("--update")) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log("базлайн обновлён:", BASELINE);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : {};
let failed = false;
for (const [file, byRule] of Object.entries(current)) {
  for (const [rule, n] of Object.entries(byRule)) {
    const was = baseline[file]?.[rule] ?? 0;
    if (n > was) {
      failed = true;
      console.log(`FAIL ${file}: «${rule}» ${was} -> ${n}. Используй токены из styles/pd-system.css`);
    } else if (n < was) {
      console.log(`меньше нарушений в ${file} («${rule}» ${was} -> ${n}) - обнови базлайн: node tools/qa/dslint.mjs --update`);
    }
  }
}
console.log(failed ? "dslint: FAIL" : "dslint: ok");
process.exit(failed ? 1 : 0);
