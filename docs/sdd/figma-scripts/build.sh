#!/usr/bin/env bash
# data/*.js + generator.js → dist/board-*.js (use_figma에 붙여넣는 실행 파일)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
for f in data/*.js; do
  id="$(basename "$f" .js)"
  out="dist/board-${id}.js"
  cat "$f" generator.js > "$out"
  echo "built: $out ($(wc -c < "$out") bytes)"
done
