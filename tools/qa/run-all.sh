#!/usr/bin/env bash
# Полная проверка: мок со всеми дополнениями и без них, автопроверки, импорт main.js
set -e
cd "$(dirname "$0")/../.."
OUT="${TMPDIR:-/tmp}/pd-qa"; mkdir -p "$OUT"
for a in all none; do
  node tools/build-mock.mjs --cast --addons "$a" --out "$OUT/mock-$a.html" >/dev/null
  echo "== addons: $a"
  node tools/qa/qa.mjs "$OUT/mock-$a.html" | head -3
  node tools/qa/addchk.mjs "$OUT/mock-$a.html" | tail -1
done
node tools/qa/mutchk.mjs "$OUT/mock-all.html"
node tools/qa/progchk.mjs "$OUT/mock-all.html"
node tools/qa/partychk.mjs "$OUT/mock-all.html"
node tools/qa/sfxchk.mjs "$OUT/mock-all.html"
node tools/qa/smoke.mjs
