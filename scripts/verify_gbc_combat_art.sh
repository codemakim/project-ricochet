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

check_opaque_bounds() {
  local file="$ROOT/$1" expected="$2" bounds
  bounds="$(magick "$file" -alpha extract -trim -format '%@' info:)"
  [[ "$bounds" == "$expected+0+0" ]] || {
    echo "$file: opaque bounds expected $expected+0+0, got $bounds"
    exit 1
  }
}

check public/assets/combat/sprites/player.png 96x96 5 yes
check public/assets/combat/sprites/enemy-basic.png 84x72 5 yes
check public/assets/combat/sprites/enemy-armored.png 168x144 5 yes
check public/assets/combat/sprites/enemy-shooter.png 84x72 5 yes
check public/assets/combat/sprites/enemy-splitter.png 168x72 4 yes
check public/assets/combat/sprites/enemy-fragment-left.png 84x72 4 yes
check public/assets/combat/sprites/enemy-fragment-right.png 84x72 4 yes
check public/assets/combat/backgrounds/scrapyard-arena.webp 900x1440 12 no
check_blocks public/assets/combat/sprites/player.png
check_blocks public/assets/combat/sprites/enemy-basic.png
check_blocks public/assets/combat/sprites/enemy-armored.png
check_blocks public/assets/combat/sprites/enemy-shooter.png
check_blocks public/assets/combat/sprites/enemy-splitter.png
check_blocks public/assets/combat/sprites/enemy-fragment-left.png
check_blocks public/assets/combat/sprites/enemy-fragment-right.png
check_opaque_bounds public/assets/combat/sprites/enemy-basic.png 84x72
check_opaque_bounds public/assets/combat/sprites/enemy-armored.png 168x144
check_opaque_bounds public/assets/combat/sprites/enemy-shooter.png 84x72
check_opaque_bounds public/assets/combat/sprites/enemy-splitter.png 168x72
check_opaque_bounds public/assets/combat/sprites/enemy-fragment-left.png 84x72
check_opaque_bounds public/assets/combat/sprites/enemy-fragment-right.png 84x72
check public/assets/combat/sprites/sentinel-body.png 252x144 5 yes
check public/assets/combat/sprites/sentinel-left-weakpoint.png 56x120 5 yes
check public/assets/combat/sprites/sentinel-right-weakpoint.png 56x120 5 yes
check public/assets/combat/sprites/sentinel-core.png 64x64 5 yes
check_blocks public/assets/combat/sprites/sentinel-body.png
check_blocks public/assets/combat/sprites/sentinel-left-weakpoint.png
check_blocks public/assets/combat/sprites/sentinel-right-weakpoint.png
check_blocks public/assets/combat/sprites/sentinel-core.png
[[ "$(magick "$ROOT/public/assets/combat/sprites/sentinel-core.png" -alpha extract -trim -format '%wx%h%O' info:)" == '56x56+4+4' ]] || {
  echo 'sentinel core opaque bounds must match its centered 56x56 hitbox'
  exit 1
}
for core in echo corrosion conduction inertia split explosion; do
  check "public/assets/combat/sprites/orb-$core.png" 40x40 5 yes
  check_blocks "public/assets/combat/sprites/orb-$core.png"
done
check public/assets/combat/sprites/projectile-temporary.png 24x24 4 yes
check public/assets/combat/sprites/projectile-enemy.png 20x20 4 yes
check public/assets/combat/sprites/projectile-boss.png 20x20 4 yes
check public/assets/combat/sprites/projectile-hazard.png 32x48 4 yes
check_blocks public/assets/combat/sprites/projectile-temporary.png
check_blocks public/assets/combat/sprites/projectile-enemy.png
check_blocks public/assets/combat/sprites/projectile-boss.png
check_blocks public/assets/combat/sprites/projectile-hazard.png
check public/assets/combat/sprites/hud-status-frame.png 360x128 5 yes
check public/assets/combat/sprites/hud-boss-frame.png 480x80 5 yes
check_blocks public/assets/combat/sprites/hud-status-frame.png
check_blocks public/assets/combat/sprites/hud-boss-frame.png
echo 'GBC combat art verified'
