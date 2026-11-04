// Check packaged icon inventory and preserve external item artwork URLs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ICON_OVERRIDES } from '../../scripts/icon-index.js';
import { NAME_ICON_RULES, ownIconFor } from '../../scripts/icon-rules.js';
const dir = new URL('../../assets/icons/', import.meta.url);
const files = fs.readdirSync(dir, { recursive: true }).filter(p => /\.(png|webp|jpg|svg)$/i.test(p));
assert.deepEqual([...ICON_OVERRIDES].sort(), files.map(p => p.split(path.sep).join('/')).sort(), 'icon index must match packaged files');
for (const rel of ICON_OVERRIDES) {
  assert.ok(fs.statSync(new URL(rel, dir)).size > 0, rel);
  assert.equal(ownIconFor(rel, '', ICON_OVERRIDES), rel, rel);
}
for (const [, rel] of NAME_ICON_RULES) assert.ok(ICON_OVERRIDES.has(rel), rel);
// Use the normal Foundry smoke environment to import the real itemImg resolver.
await import('./smoke.mjs');
const { itemImg } = await import('../../scripts/paperdoll-app.js');
for (const rel of ICON_OVERRIDES) {
  assert.equal(itemImg(`modules/wfrp4e-core/icons/${rel}`), `modules/wfrp4e-paperdoll/assets/icons/${rel}`);
}
assert.equal(itemImg('worlds/custom/art.png', 'Custom item'), 'worlds/custom/art.png');
let legacyCount = 0;
if (process.argv[2]) {
  const rb = path.resolve(process.argv[2]);
  const legacy = JSON.parse(fs.readFileSync(path.join(rb, 'docs/legacy-icon-paths.json')));
  for (const rel of legacy.paths) {
    const url = `modules/wfrp4e-recipe-book/${rel}`;
    assert.equal(itemImg(url, 'Existing crafted item'), url);
    assert.ok(fs.statSync(path.join(rb, rel)).size > 0, url);
    legacyCount++;
  }
}
console.log(`PASS: ${files.length} Paperdoll icons, index, name rules, real item resolver and custom URL preservation; ${legacyCount} legacy Recipe Book paths checked.`);
