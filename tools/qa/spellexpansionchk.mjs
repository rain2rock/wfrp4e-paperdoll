import assert from 'node:assert/strict';
import fs from 'node:fs';
import {effectIconFor} from '../../scripts/icon-rules.js';
import {ICON_OVERRIDES} from '../../scripts/icon-index.js';
const rows=JSON.parse(fs.readFileSync(new URL('../../docs/spell-icon-expansion.json',import.meta.url)));
for(const r of rows){
 const expected=`magic/spells/${r.slug}.png`;
 for(const name of [r.name_en,r.name_ru]) assert.equal(effectIconFor('spell',{name},ICON_OVERRIDES),expected,name);
 assert.equal(effectIconFor('spell',{name:'Unknown',img:`modules/example/${r.slug}.webp`},ICON_OVERRIDES),expected);
}
console.log(`PASS: ${rows.length} new spells resolve by English/Russian name and image basename`);
