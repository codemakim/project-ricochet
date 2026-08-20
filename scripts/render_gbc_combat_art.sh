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
  magick "$1" -filter point -resize 400% "$2"
}

magick -size 18x18 xc:none +antialias \
  -fill "$INK" -draw 'polygon 5,2 12,2 12,3 14,3 14,4 15,4 15,13 13,13 13,15 4,15 4,13 2,13 2,4 4,4 4,3 5,3' \
  -fill "$AMBER" -draw 'rectangle 5,3 12,14 rectangle 3,5 14,12' \
  -fill "$CERAMIC" -draw 'rectangle 5,5 12,9' \
  -fill "$CYAN" -draw 'point 7,7 point 10,7 rectangle 8,12 9,13' \
  "$SOURCE/player-master.png"
export_sprite "$SOURCE/player-master.png" "$SPRITES/player.png"

magick -size 18x14 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 3,3 14,12 rectangle 2,5 15,11' \
  -fill "$GREEN" -draw 'rectangle 4,4 13,11 rectangle 3,6 14,10' \
  -fill "$INK" -draw 'rectangle 5,6 12,9' \
  -fill "$CORAL" -draw 'point 7,8 point 10,8' \
  "$SOURCE/enemy-basic-master.png"
export_sprite "$SOURCE/enemy-basic-master.png" "$SPRITES/enemy-basic.png"

magick -size 20x16 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 3,3 16,14 rectangle 1,5 18,13' \
  -fill "$VIOLET" -draw 'rectangle 4,4 15,13 rectangle 2,6 17,12' \
  -fill "$BLUE_STEEL" -draw 'rectangle 5,5 14,9' \
  -fill "$INK" -draw 'rectangle 7,8 12,12' \
  "$SOURCE/enemy-armored-master.png"
export_sprite "$SOURCE/enemy-armored-master.png" "$SPRITES/enemy-armored.png"

magick -size 19x15 xc:none +antialias \
  -fill "$INK" -draw 'rectangle 7,0 11,14 rectangle 5,2 13,12' \
  -fill "$ORANGE" -draw 'rectangle 8,1 10,13 rectangle 6,3 12,11' \
  -fill "$YELLOW" -draw 'rectangle 8,2 10,3' \
  -fill "$INK" -draw 'rectangle 7,6 11,11' \
  "$SOURCE/enemy-shooter-master.png"
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
  "$SOURCE/scrapyard-arena-master.png"
magick "$SOURCE/scrapyard-arena-master.png" -filter point -resize 400% -define webp:lossless=true "$BACKGROUNDS/scrapyard-arena.webp"
