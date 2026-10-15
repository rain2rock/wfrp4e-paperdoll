/**
 * Список своих иконок из assets/icons -> scripts/icon-index.js
 *
 *   node tools/build-icon-index.mjs
 *
 * Иконки в assets/icons лежат по тем же путям, что и в modules/wfrp4e-core/icons.
 * Модуль подменяет ими заглушки wfrp4e-core (см. itemImg в paperdoll-app.js).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "assets/icons");
const list = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(png|webp|jpg|svg)$/i.test(e.name)) list.push(path.relative(dir, p).split(path.sep).join("/"));
  }
};
if (fs.existsSync(dir)) walk(dir);
list.sort();
const src = `// Сгенерировано tools/build-icon-index.mjs - не править руками
export const ICON_OVERRIDES = new Set(${JSON.stringify(list, null, 0).replace(/","/g, '",\n  "').replace(/^\[/, "[\n  ").replace(/\]$/, "\n]")});
`;
fs.writeFileSync(path.join(root, "scripts/icon-index.js"), src);
console.log(`Иконок: ${list.length}`);
