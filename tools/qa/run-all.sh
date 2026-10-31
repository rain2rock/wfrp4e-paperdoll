#!/usr/bin/env bash
# Полная проверка: мок со всеми дополнениями и без них, автопроверки, импорт main.js
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${TMPDIR:-/tmp}/pd-qa"; mkdir -p "$OUT"
for a in all none; do
  # Те же ключи, что у npm run mock: прогон обязан проверять ту сборку, которую открывают в браузере.
  # Раньше здесь не было --loot --effects, и падение partychk на полной сборке прогон не видел
  node tools/build-mock.mjs --cast --loot --effects --addons "$a" --out "$OUT/mock-$a.html" >/dev/null
  echo "== addons: $a"
  node tools/qa/qa.mjs "$OUT/mock-$a.html"
  node tools/qa/addchk.mjs "$OUT/mock-$a.html"
  node tools/qa/nativechk.mjs "$OUT/mock-$a.html"
done
node tools/qa/mutchk.mjs "$OUT/mock-all.html"
node tools/qa/progchk.mjs "$OUT/mock-all.html"
node tools/qa/partychk.mjs "$OUT/mock-all.html"
node tools/qa/sfxchk.mjs "$OUT/mock-all.html"
node tools/qa/magicchk.mjs "$OUT/mock-all.html"
node tools/qa/smoke.mjs
node tools/qa/welcomechk.mjs
node tools/qa/dslint.mjs
