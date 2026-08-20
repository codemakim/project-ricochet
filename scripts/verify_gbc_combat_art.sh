#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_SMALL="$(mktemp -t ricochet-small.XXXXXX.png)"
TMP_ROUND="$(mktemp -t ricochet-round.XXXXXX.png)"
trap 'rm -f "$TMP_SMALL" "$TMP_ROUND"' EXIT

check() {
  local file="$ROOT/$1" expected="$2" maximum_colors="$3" alpha="$4"
  local dimensions colors channels
  read -r dimensions colors channels < <(magick identify -format '%wx%h %k %[channels]\n' "$file")
  [[ "$dimensions" == "$expected" ]] || { echo "$file: expected $expected, got $dimensions"; exit 1; }
  (( colors <= maximum_colors )) || { echo "$file: $colors colors exceeds $maximum_colors"; exit 1; }
  if [[ "$alpha" == yes ]]; then
    [[ "$channels" == *a* ]] || { echo "$file: alpha channel missing"; exit 1; }
    [[ "$(magick "$file" -format '%[pixel:p{0,0}]' info:)" == *',0)' ]] || { echo "$file: opaque corner"; exit 1; }
  fi
}

check_blocks() {
  local file="$ROOT/$1"
  magick "$file" -filter point -resize 25% "$TMP_SMALL"
  magick "$TMP_SMALL" -filter point -resize 400% "$TMP_ROUND"
  [[ "$(compare -metric AE "$file" "$TMP_ROUND" null: 2>&1)" == '0 (0)' ]]
}

check public/assets/combat/sprites/player.png 72x72 5 yes
check public/assets/combat/sprites/enemy-basic.png 72x56 5 yes
check public/assets/combat/sprites/enemy-armored.png 80x64 5 yes
check public/assets/combat/sprites/enemy-shooter.png 76x60 5 yes
check public/assets/combat/backgrounds/scrapyard-arena.webp 900x1440 12 no
check_blocks public/assets/combat/sprites/player.png
check_blocks public/assets/combat/sprites/enemy-basic.png
check_blocks public/assets/combat/sprites/enemy-armored.png
check_blocks public/assets/combat/sprites/enemy-shooter.png
echo 'GBC combat art verified'
