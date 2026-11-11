import assert from 'node:assert/strict';
import fs from 'node:fs';
import { effectIconFor } from '../../scripts/icon-rules.js';
import { ICON_OVERRIDES } from '../../scripts/icon-index.js';
const root = new URL('../../', import.meta.url);
const entries = JSON.parse(fs.readFileSync(new URL('docs/spell-icon-catalogue.json', root)));
assert.equal(entries.length, 265);
for (const r of entries) {
  assert.equal(effectIconFor('spell', {name:r.name,key:r.lore}, ICON_OVERRIDES), r.file, r.name);
  assert.equal(effectIconFor('spell', {name:'Локализованное название',key:r.lore,img:`modules/source/icons/${r.file.split('/').pop()}`}, ICON_OVERRIDES), r.file);
  assert.ok(fs.existsSync(new URL(`assets/icons/${r.file}`,root)));
}
assert.equal(effectIconFor('spell',{name:"Gehenna's Golden Globe",key:'metal'},ICON_OVERRIDES),'magic/spells/gehenna-s-golden-globe.png');
assert.equal(effectIconFor('spell',{name:'Unknown custom spell',key:'fire'},ICON_OVERRIDES),'magic/spell-fire.png');
assert.equal(effectIconFor('spell',{name:'Unknown custom spell',key:'unknown'},ICON_OVERRIDES),'magic/spell.png');
assert.equal(effectIconFor('prayer',{name:'Banishment',key:'blessing',god:'Sigmar'},ICON_OVERRIDES),'magic/gods/god-sigmar.png');
const withoutArt = new Set([...ICON_OVERRIDES].filter(p=>!p.startsWith('magic/spells/')));
assert.equal(effectIconFor('spell',{name:'Banishment',key:'light'},withoutArt),'magic/spell-light.png');
console.log('PASS 265 title matches, 265 localized-title source-image matches, assets, punctuation and school/prayer fallbacks');
