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

magick -size 18x18 xc:none +antialias \
  -fill "$INK" -draw 'polygon 5,2 12,2 12,3 14,3 14,4 15,4 15,13 13,13 13,15 4,15 4,13 2,13 2,4 4,4 4,3 5,3' \
  -fill "$AMBER" -draw 'rectangle 5,3 12,14 rectangle 3,5 14,12' \
  -fill "$CERAMIC" -draw 'rectangle 5,5 12,9' \
  -fill "$CYAN" -draw 'point 7,7 point 10,7 rectangle 8,12 9,13' \
  -strip "$SOURCE/player-master.png"
export_sprite "$SOURCE/player-master.png" "$SPRITES/player.png"

magick -size 18x14 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 3,3 14,12 rectangle 2,5 15,11' \
  -fill "$GREEN" -draw 'rectangle 4,4 13,11 rectangle 3,6 14,10' \
  -fill "$INK" -draw 'rectangle 5,6 12,9' \
  -fill "$CORAL" -draw 'point 7,8 point 10,8' \
  -strip "$SOURCE/enemy-basic-master.png"
export_sprite "$SOURCE/enemy-basic-master.png" "$SPRITES/enemy-basic.png"

magick -size 20x16 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 3,3 16,14 rectangle 1,5 18,13' \
  -fill "$VIOLET" -draw 'rectangle 4,4 15,13 rectangle 2,6 17,12' \
  -fill "$BLUE_STEEL" -draw 'rectangle 5,5 14,9' \
  -fill "$INK" -draw 'rectangle 7,8 12,12' \
  -strip "$SOURCE/enemy-armored-master.png"
export_sprite "$SOURCE/enemy-armored-master.png" "$SPRITES/enemy-armored.png"

magick -size 19x15 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 7,0 11,14 rectangle 5,2 13,12' \
  -fill "$ORANGE" -draw 'rectangle 8,1 10,13 rectangle 6,3 12,11' \
  -fill "$YELLOW" -draw 'rectangle 8,2 10,3' \
  -fill "$INK" -draw 'rectangle 7,6 11,11' \
  -strip "$SOURCE/enemy-shooter-master.png"
export_sprite "$SOURCE/enemy-shooter-master.png" "$SPRITES/enemy-shooter.png"

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

magick -size 88x48 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 4,6 83,43 rectangle 0,13 87,36' \
  -fill "$VIOLET" -draw 'rectangle 7,8 80,41 rectangle 2,15 85,34' \
  -fill "$BLUE_STEEL" -draw 'rectangle 14,10 73,18 rectangle 10,27 77,38' \
  -fill "$INK" -draw 'rectangle 34,16 53,35 rectangle 0,18 10,31 rectangle 77,18 87,31' \
  -strip "$SOURCE/sentinel-body-master.png"
export_sprite "$SOURCE/sentinel-body-master.png" "$SPRITES/sentinel-body.png"

magick -size 15x32 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 2,1 12,30 rectangle 0,6 14,25' \
  -fill "$VIOLET" -draw 'rectangle 3,2 11,29 rectangle 1,7 13,24' \
  -fill "$YELLOW" -draw 'rectangle 4,9 10,21' \
  -fill "$INK" -draw 'rectangle 6,11 8,19' \
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

magick -size 8x8 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 6,6' -fill "$CYAN" -draw 'rectangle 2,2 5,5' -fill "$CERAMIC" -draw 'point 2,4 point 3,3 point 4,4 point 5,3' -strip "$SOURCE/orb-echo-master.png"
export_sprite "$SOURCE/orb-echo-master.png" "$SPRITES/orb-echo.png"
magick -size 8x8 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 6,6' -fill "$ACID" -draw 'rectangle 2,2 5,5' -fill "$CERAMIC" -draw 'point 4,2 point 3,3 point 3,4 point 4,5' -strip "$SOURCE/orb-corrosion-master.png"
export_sprite "$SOURCE/orb-corrosion-master.png" "$SPRITES/orb-corrosion.png"
magick -size 8x8 xc:none +antialias -fill "$BLUE_STEEL" -draw 'rectangle 1,1 6,6' -fill "$CYAN" -draw 'rectangle 2,2 5,5' -fill "$CERAMIC" -draw 'point 3,2 point 3,3 point 2,4 point 4,4 point 4,5' -strip "$SOURCE/orb-conduction-master.png"
export_sprite "$SOURCE/orb-conduction-master.png" "$SPRITES/orb-conduction.png"
magick -size 8x8 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 6,6' -fill "$CERAMIC" -draw 'rectangle 2,2 5,5' -fill "$CYAN" -draw 'point 2,5 point 3,4 point 4,3 point 5,2 point 4,2 point 5,3' -strip "$SOURCE/orb-inertia-master.png"
export_sprite "$SOURCE/orb-inertia-master.png" "$SPRITES/orb-inertia.png"
magick -size 8x8 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 6,6' -fill "$MAGENTA" -draw 'rectangle 2,2 5,5' -fill "$CERAMIC" -draw 'point 3,5 point 3,4 point 2,3 point 4,3 point 5,2' -strip "$SOURCE/orb-split-master.png"
export_sprite "$SOURCE/orb-split-master.png" "$SPRITES/orb-split.png"
magick -size 8x8 xc:none +antialias -fill "$INK" -draw 'rectangle 1,1 6,6' -fill "$ORANGE" -draw 'rectangle 2,2 5,5' -fill "$YELLOW" -draw 'point 3,2 point 3,5 point 2,3 point 5,3 point 3,3' -strip "$SOURCE/orb-explosion-master.png"
export_sprite "$SOURCE/orb-explosion-master.png" "$SPRITES/orb-explosion.png"

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
