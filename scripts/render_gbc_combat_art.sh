#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/assets-source/combat/graphics"
SPRITES="$ROOT/public/assets/combat/sprites"
BACKGROUNDS="$ROOT/public/assets/combat/backgrounds"
mkdir -p "$SOURCE" "$SPRITES" "$BACKGROUNDS"

INK='#101018'
FLOOR='#111923'
FLOOR_ALT='#151f2a'
EDGE='#090d13'
STEEL='#263342'
STEEL_LIGHT='#35485a'
CYAN='#40dcf2'
MAGENTA='#d64fa8'
ACID='#9fcf45'
AMBER='#c8891c'
CERAMIC='#eee3c8'
GREEN='#4f7d2d'
CORAL='#f05b43'
VIOLET='#49397d'
BLUE_STEEL='#7580a8'
ORANGE='#c53a17'
YELLOW='#ffae2b'

export_sprite() {
  magick "$1" -filter point -resize 400% -strip "$2"
}

magick -size 24x24 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 3,0 20,23 rectangle 0,3 23,20' \
  -fill "$AMBER" -draw 'rectangle 4,1 19,22 rectangle 1,4 22,19' \
  -fill "$CERAMIC" -draw 'rectangle 4,5 19,13' \
  -fill "$CYAN" -draw 'rectangle 7,8 8,9 rectangle 15,8 16,9 rectangle 9,17 14,21' \
  -strip "$SOURCE/player-master.png"
export_sprite "$SOURCE/player-master.png" "$SPRITES/player.png"

magick -size 21x18 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 1,0 19,17 rectangle 0,1 20,16' \
  -fill "$GREEN" -draw 'rectangle 2,1 18,16 rectangle 1,2 19,15' \
  -fill "$INK" -draw 'rectangle 4,6 16,11' \
  -fill "$CORAL" -draw 'rectangle 6,8 7,9 rectangle 13,8 14,9' \
  -strip "$SOURCE/enemy-basic-master.png"
export_sprite "$SOURCE/enemy-basic-master.png" "$SPRITES/enemy-basic.png"

magick -size 42x36 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 2,0 39,35 rectangle 0,2 41,33' \
  -fill "$VIOLET" -draw 'rectangle 3,1 38,34 rectangle 1,3 40,32' \
  -fill "$BLUE_STEEL" -draw 'rectangle 5,5 36,23' \
  -fill "$INK" -draw 'rectangle 13,13 28,29' \
  -strip "$SOURCE/enemy-armored-master.png"
export_sprite "$SOURCE/enemy-armored-master.png" "$SPRITES/enemy-armored.png"

magick -size 21x18 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 1,0 19,17 rectangle 0,1 20,16' \
  -fill "$ORANGE" -draw 'rectangle 2,1 18,16 rectangle 1,2 19,15' \
  -fill "$YELLOW" -draw 'rectangle 8,2 12,4' \
  -fill "$INK" -draw 'rectangle 5,6 15,15' \
  -strip "$SOURCE/enemy-shooter-master.png"
export_sprite "$SOURCE/enemy-shooter-master.png" "$SPRITES/enemy-shooter.png"

magick -size 42x18 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 1,0 40,17 rectangle 0,1 41,16' \
  -fill "$CORAL" -draw 'rectangle 2,1 39,16 rectangle 1,2 40,15' \
  -fill "$INK" -draw 'polygon 20,0 23,4 20,8 23,12 20,17 18,17 20,12 17,8 20,4 18,0' \
  -strip "$SOURCE/enemy-splitter-master.png"
export_sprite "$SOURCE/enemy-splitter-master.png" "$SPRITES/enemy-splitter.png"

magick -size 21x18 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 1,0 19,17 rectangle 0,1 20,16' \
  -fill "$CORAL" -draw 'rectangle 2,1 18,16 rectangle 1,2 19,15' \
  -fill "$INK" -draw 'polygon 20,1 16,4 19,8 15,12 20,16 20,1' \
  -strip "$SOURCE/enemy-fragment-left-master.png"
export_sprite "$SOURCE/enemy-fragment-left-master.png" "$SPRITES/enemy-fragment-left.png"
magick "$SOURCE/enemy-fragment-left-master.png" -flop -strip \
  "$SOURCE/enemy-fragment-right-master.png"
export_sprite "$SOURCE/enemy-fragment-right-master.png" "$SPRITES/enemy-fragment-right.png"

magick -size 225x360 "xc:$FLOOR" +antialias \
  -fill "$FLOOR_ALT" -draw 'rectangle 22,24 109,118 rectangle 112,24 202,118 rectangle 22,121 202,235 rectangle 22,238 109,335 rectangle 112,238 202,335' \
  -fill "$STEEL" -draw 'rectangle 22,119 202,120 rectangle 110,24 111,335 rectangle 22,236 202,237' \
  -fill "$EDGE" -draw 'rectangle 0,0 17,359 rectangle 207,0 224,359 rectangle 0,0 224,18 rectangle 0,341 224,359' \
  -fill "$STEEL" -draw 'rectangle 3,28 15,78 rectangle 3,102 15,154 rectangle 3,202 15,258 rectangle 3,282 15,332 rectangle 209,28 221,78 rectangle 209,102 221,154 rectangle 209,202 221,258 rectangle 209,282 221,332 rectangle 27,3 78,15 rectangle 100,3 153,15 rectangle 176,3 202,15 rectangle 27,344 78,356 rectangle 100,344 153,356 rectangle 176,344 202,356' \
  -fill "$STEEL_LIGHT" -draw 'rectangle 6,34 12,70 rectangle 212,34 218,70 rectangle 6,208 12,250 rectangle 212,208 218,250 rectangle 34,6 70,12 rectangle 182,6 198,12' \
  -fill "$CYAN" -draw 'rectangle 10,42 12,55 rectangle 212,116 214,131 rectangle 42,348 60,350 rectangle 184,348 197,350' \
  -fill "$MAGENTA" -draw 'rectangle 10,221 12,230 rectangle 212,296 214,307' \
  -fill "$ACID" -draw 'rectangle 10,306 12,319 rectangle 212,48 214,57' \
  -fill "$YELLOW" -draw 'rectangle 109,8 115,12 rectangle 109,347 115,351' \
  -strip "$SOURCE/scrapyard-arena-master.png"
magick "$SOURCE/scrapyard-arena-master.png" -filter point -resize 400% -strip -define webp:lossless=true "$BACKGROUNDS/scrapyard-arena.webp"

magick -size 63x36 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 2,0 60,35 rectangle 0,2 62,33' \
  -fill "$VIOLET" -draw 'rectangle 3,1 59,34 rectangle 1,3 61,32' \
  -fill "$BLUE_STEEL" -draw 'rectangle 8,5 54,12 rectangle 7,22 55,30' \
  -fill "$INK" -draw 'rectangle 24,10 38,28' \
  -strip "$SOURCE/sentinel-body-master.png"
export_sprite "$SOURCE/sentinel-body-master.png" "$SPRITES/sentinel-body.png"

magick -size 14x30 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 1,0 12,29 rectangle 0,1 13,28' \
  -fill "$VIOLET" -draw 'rectangle 2,1 11,28 rectangle 1,2 12,27' \
  -fill "$YELLOW" -draw 'rectangle 3,6 10,23' \
  -fill "$INK" -draw 'rectangle 6,9 7,20' \
  -strip "$SOURCE/sentinel-weakpoint-master.png"
export_sprite "$SOURCE/sentinel-weakpoint-master.png" "$SPRITES/sentinel-left-weakpoint.png"
magick "$SPRITES/sentinel-left-weakpoint.png" -flop -strip "$SPRITES/sentinel-right-weakpoint.png"

magick -size 16x16 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 2,2 13,13' \
  -fill "$YELLOW" -draw 'rectangle 4,4 11,11' \
  -fill "$CERAMIC" -draw 'rectangle 6,5 9,10' \
  -fill "$MAGENTA" -draw 'rectangle 7,7 8,8' \
  -strip "$SOURCE/sentinel-core-master.png"
export_sprite "$SOURCE/sentinel-core-master.png" "$SPRITES/sentinel-core.png"

orb_shell() {
  local fill="$1" motif="$2" output="$3"
  magick -size 10x10 xc:none +antialias \
    -fill "$INK" -draw 'rectangle 3,0 6,9 rectangle 0,3 9,6 rectangle 1,1 8,8' \
    -fill "$fill" -draw 'rectangle 3,1 6,8 rectangle 1,3 8,6 rectangle 2,2 7,7' \
    -fill "$CERAMIC" -draw "$motif" -strip "$output"
}

orb_shell "$CYAN" 'rectangle 2,2 7,3 rectangle 3,6 6,7' "$SOURCE/orb-echo-master.png"
orb_shell "$ACID" 'polygon 5,2 3,5 4,7 6,7 7,5' "$SOURCE/orb-corrosion-master.png"
orb_shell "$CYAN" 'polygon 5,1 3,5 5,5 4,8 7,4 5,4' "$SOURCE/orb-conduction-master.png"
orb_shell "$BLUE_STEEL" 'polygon 2,4 6,2 8,5 6,8' "$SOURCE/orb-inertia-master.png"
orb_shell "$MAGENTA" 'rectangle 2,3 4,7 rectangle 6,2 7,6' "$SOURCE/orb-split-master.png"
orb_shell "$ORANGE" 'rectangle 4,1 5,8 rectangle 1,4 8,5' "$SOURCE/orb-explosion-master.png"
for core in echo corrosion conduction inertia split explosion; do
  export_sprite "$SOURCE/orb-$core-master.png" "$SPRITES/orb-$core.png"
done

magick -size 6x6 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 4,4' -fill "$CYAN" -draw 'rectangle 2,2 3,3' -strip "$SOURCE/projectile-temporary-master.png"
export_sprite "$SOURCE/projectile-temporary-master.png" "$SPRITES/projectile-temporary.png"
magick -size 5x5 xc:none +antialias -fill "$CORAL" -draw 'rectangle 0,1 4,3 rectangle 1,0 3,4' -fill "$YELLOW" -draw 'point 2,2' -strip "$SOURCE/projectile-enemy-master.png"
export_sprite "$SOURCE/projectile-enemy-master.png" "$SPRITES/projectile-enemy.png"
magick -size 5x5 xc:none +antialias -fill "$INK" -draw 'rectangle 0,1 4,3 rectangle 1,0 3,4' -fill "$CORAL" -draw 'rectangle 1,1 3,3' -fill "$YELLOW" -draw 'point 2,2' -strip "$SOURCE/projectile-boss-master.png"
export_sprite "$SOURCE/projectile-boss-master.png" "$SPRITES/projectile-boss.png"
magick -size 8x12 xc:none +antialias -fill "$INK" -draw 'rectangle 1,0 6,11' -fill "$CORAL" -draw 'rectangle 2,1 5,10' -fill "$YELLOW" -draw 'rectangle 3,2 4,5' -strip "$SOURCE/projectile-hazard-master.png"
export_sprite "$SOURCE/projectile-hazard-master.png" "$SPRITES/projectile-hazard.png"

magick -size 90x32 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 2,0 87,1 rectangle 2,30 87,31 rectangle 0,2 1,29 rectangle 88,2 89,29' \
  -fill "$STEEL" -draw 'rectangle 2,2 87,2 rectangle 2,29 87,29 rectangle 2,2 2,29 rectangle 87,2 87,29' \
  -fill "$CYAN" -draw 'rectangle 3,3 8,4 rectangle 3,27 8,28 rectangle 81,3 86,4 rectangle 81,27 86,28' \
  -strip "$SOURCE/hud-status-frame-master.png"
export_sprite "$SOURCE/hud-status-frame-master.png" "$SPRITES/hud-status-frame.png"

magick -size 120x20 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 2,0 117,1 rectangle 2,18 117,19 rectangle 0,2 1,17 rectangle 118,2 119,17' \
  -fill "$STEEL" -draw 'rectangle 2,2 117,2 rectangle 2,17 117,17 rectangle 2,2 2,17 rectangle 117,2 117,17' \
  -fill "$YELLOW" -draw 'rectangle 3,3 10,4 rectangle 3,15 10,16 rectangle 109,3 116,4 rectangle 109,15 116,16' \
  -strip "$SOURCE/hud-boss-frame-master.png"
export_sprite "$SOURCE/hud-boss-frame-master.png" "$SPRITES/hud-boss-frame.png"
