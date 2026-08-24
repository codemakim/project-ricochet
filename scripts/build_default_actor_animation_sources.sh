#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEEDS="$ROOT/assets-source/combat/pixel"
OUTPUT="$ROOT/assets-source/combat/actors"
FRAMES="$(mktemp -d -t ricochet-actor-frames.XXXXXX)"
trap 'rm -rf "$FRAMES"' EXIT

role=''
seed=''
width=0
height=0
frame_index=0
last_frame=''

begin_role() {
  begin_seed "$1" "$SEEDS/$2.png"
}

begin_seed() {
  role="$1"
  seed="$2"
  [[ -f "$seed" ]] || { echo "$seed: seed missing" >&2; exit 1; }
  read -r width height < <(magick identify -format '%w %h\n' "$seed")
  frame_index=0
}

add_frame() {
  local dx="$1" dy="$2" scale_x="$3" scale_y="$4"
  local tint="$5" colorize="$6" opacity="$7" geometry
  last_frame="$FRAMES/${role}-$(printf '%03d' "$frame_index").png"
  geometry="$(printf '%+d%+d' "$dx" "$dy")"
  if [[ "$tint" == '-' ]]; then
    magick -size "${width}x${height}" canvas:none \
      \( "$seed" -filter point -resize "${scale_x}%x${scale_y}%!" \
        -channel A -evaluate multiply "$opacity" +channel \) \
      -gravity center -geometry "$geometry" -composite -strip "$last_frame"
  else
    magick -size "${width}x${height}" canvas:none \
      \( "$seed" -filter point -resize "${scale_x}%x${scale_y}%!" \
        -fill "$tint" -colorize "${colorize}%" \
        -channel A -evaluate multiply "$opacity" +channel \) \
      -gravity center -geometry "$geometry" -composite -strip "$last_frame"
  fi
  frame_index=$((frame_index + 1))
}

add_split_frame() {
  local gap="$1" tint="$2" colorize="$3" opacity="$4"
  local half_width=$((width / 2)) part_width=$((width / 2 - gap))
  last_frame="$FRAMES/${role}-$(printf '%03d' "$frame_index").png"
  magick -size "${width}x${height}" canvas:none \
    \( "$seed" -crop "${half_width}x${height}+0+0" +repage \
      -filter point -resize "${part_width}x${height}!" \) -geometry +0+0 -composite \
    \( "$seed" -crop "${half_width}x${height}+${half_width}+0" +repage \
      -filter point -resize "${part_width}x${height}!" \) \
      -geometry "+$((half_width + gap))+0" -composite \
    -fill "$tint" -colorize "${colorize}%" \
    -channel A -evaluate multiply "$opacity" +channel -strip "$last_frame"
  frame_index=$((frame_index + 1))
}

finish_role() {
  mkdir -p "$OUTPUT/$role"
  magick "$FRAMES/${role}-"*.png +append -depth 8 -strip "$OUTPUT/$role/default.png"
}

destroyed_frames() {
  add_frame 0 0 98 98 '#35404c' 25 1
  add_frame 0 1 94 94 '#2a313a' 45 0.9
  add_frame 0 1 90 90 '#1d232a' 65 0.75
  add_frame 0 2 84 84 '#12171d' 80 0.55
}

begin_role player player
add_frame 0 0 100 100 - 0 1
add_frame 0 -1 100 98 - 0 1
add_frame 0 0 100 100 '#8cf7ff' 12 1
add_frame 0 0 100 100 - 0 1
add_frame -1 0 96 100 - 0 1
add_frame 0 -1 98 98 - 0 1
add_frame 1 0 96 100 - 0 1
add_frame 0 0 100 100 - 0 1
add_frame 0 0 98 98 '#8cf7ff' 18 1
add_frame 0 0 94 100 '#8cf7ff' 36 1
add_frame 0 1 98 96 '#e8ffff' 24 1
add_frame 0 1 96 96 '#8cf7ff' 28 1
add_frame 0 0 98 98 '#8cf7ff' 14 1
add_frame 0 0 100 100 - 0 1
add_frame 1 0 98 98 '#ffffff' 55 1
add_frame -1 0 98 98 '#ff9b83' 58 1
destroyed_frames
finish_role

begin_role enemy-basic enemy-basic
add_frame 0 0 100 100 - 0 1
add_frame 0 -1 100 96 - 0 1
add_frame 0 0 100 100 '#ffad49' 8 1
add_frame 1 0 98 98 '#ffffff' 52 1
add_frame -1 0 98 98 '#ff8a70' 56 1
destroyed_frames
finish_role

begin_role enemy-armored enemy-armored
add_frame 0 0 100 100 - 0 1
add_frame 0 -1 100 98 - 0 1
add_frame 0 0 98 100 - 0 1
add_frame 0 0 92 100 '#d7f1ff' 12 1
add_frame 0 1 90 96 '#ffffff' 20 1
add_frame 1 0 98 98 '#ffffff' 48 1
add_frame -1 0 98 98 '#ff8a70' 52 1
destroyed_frames
finish_role

begin_role enemy-shooter enemy-shooter
add_frame 0 0 100 100 - 0 1
add_frame 0 -1 100 96 - 0 1
add_frame 0 0 100 100 - 0 1
add_frame 0 0 98 98 '#ffad49' 12 1
add_frame 0 0 96 96 '#ffad49' 26 1
add_frame 0 0 94 94 '#fff1b0' 38 1
add_frame 0 1 92 98 '#ffffff' 48 1
add_frame 0 1 96 98 '#ffad49' 24 1
add_frame 0 0 100 100 - 0 1
add_frame 1 0 98 98 '#ffffff' 52 1
add_frame -1 0 98 98 '#ff8a70' 56 1
destroyed_frames
finish_role

begin_role enemy-splitter enemy-splitter
add_frame 0 0 100 100 - 0 1
add_frame 0 -1 100 96 - 0 1
add_frame 0 0 100 100 - 0 1
add_frame 0 0 98 100 '#ffad49' 12 1
add_frame 0 0 94 100 '#ff8a70' 24 1
add_frame 0 0 90 100 '#ffffff' 34 1
add_split_frame 1 '#ffad49' 18 1
add_split_frame 2 '#ffad49' 24 1
add_split_frame 4 '#ff8a70' 30 0.95
add_split_frame 6 '#ffffff' 36 0.88
destroyed_frames
finish_role

for side in left right; do
  begin_role "enemy-fragment-$side" "enemy-fragment-$side"
  add_frame 0 0 100 100 - 0 1
  add_frame 0 -1 98 96 - 0 1
  add_frame 1 0 98 98 '#ffffff' 52 1
  add_frame -1 0 98 98 '#ff8a70' 56 1
  add_frame 0 0 96 96 '#35404c' 35 0.9
  add_frame 0 1 90 90 '#222a32' 60 0.72
  add_frame 0 2 82 82 '#12171d' 80 0.5
  finish_role
done

BOSS_SEEDS="$FRAMES/boss-seeds"
mkdir -p "$BOSS_SEEDS"

magick -size 126x72 canvas:none +antialias \
  -fill '#171324' -draw 'polygon 4,0 121,0 125,4 125,67 121,71 4,71 0,67 0,4' \
  -fill '#4d4380' -draw 'rectangle 4,4 121,67' \
  -fill '#756aa8' -draw 'rectangle 8,8 117,20 rectangle 8,54 117,63' \
  -fill '#211b35' -draw 'rectangle 31,22 94,50' \
  -fill '#090a13' -draw 'rectangle 38,12 87,28' \
  -fill '#69efff' -draw 'rectangle 48,18 54,22 rectangle 71,18 77,22' \
  -fill '#a26cff' -draw 'circle 62,38 62,28' \
  -fill '#f3dcff' -draw 'rectangle 60,34 64,42' \
  -fill '#30284f' -draw 'rectangle 8,24 25,50 rectangle 100,24 117,50' \
  -depth 8 -strip "$BOSS_SEEDS/sentinel-body.png"

magick -size 28x60 canvas:none +antialias \
  -fill '#171324' -draw 'polygon 4,0 23,0 27,4 27,55 23,59 4,59 0,55 0,4' \
  -fill '#54478b' -draw 'rectangle 4,4 23,55' \
  -fill '#201a36' -draw 'rectangle 8,8 19,51' \
  -fill '#ffb347' -draw 'rectangle 11,12 16,47' \
  -fill '#fff2bd' -draw 'rectangle 12,19 15,40' \
  -depth 8 -strip "$BOSS_SEEDS/sentinel-left-weakpoint.png"
magick "$BOSS_SEEDS/sentinel-left-weakpoint.png" -flop -depth 8 -strip \
  "$BOSS_SEEDS/sentinel-right-weakpoint.png"

magick -size 32x32 canvas:none +antialias \
  -fill '#171324' -draw 'polygon 8,0 23,0 31,8 31,23 23,31 8,31 0,23 0,8' \
  -fill '#6b55a0' -draw 'rectangle 5,5 26,26' \
  -fill '#ff9cff' -draw 'circle 16,16 16,7' \
  -fill '#ffffff' -draw 'rectangle 14,12 18,20' \
  -depth 8 -strip "$BOSS_SEEDS/sentinel-core.png"

magick -size 56x56 canvas:none +antialias \
  -fill '#181124' -draw 'polygon 12,0 43,0 55,12 55,43 43,55 12,55 0,43 0,12' \
  -fill '#63315f' -draw 'rectangle 5,10 50,45' \
  -fill '#a74386' -draw 'circle 28,28 28,6' \
  -fill '#17111f' -draw 'rectangle 12,16 43,29' \
  -fill '#7ff8ff' -draw 'rectangle 18,21 23,25 rectangle 33,21 38,25' \
  -fill '#ff78c8' -draw 'circle 28,38 28,31' \
  -fill '#ffe1f5' -draw 'rectangle 26,34 30,42' \
  -depth 8 -strip "$BOSS_SEEDS/hive-core.png"

magick -size 35x28 canvas:none +antialias \
  -fill '#20141d' -draw 'polygon 4,0 30,0 34,4 34,27 0,27 0,4' \
  -fill '#a84a32' -draw 'rectangle 4,4 30,23' \
  -fill '#f28b45' -draw 'rectangle 7,7 27,14' \
  -fill '#160d12' -draw 'rectangle 10,9 25,13' \
  -fill '#ffe0a3' -draw 'rectangle 13,10 16,12 rectangle 20,10 23,12' \
  -fill '#35131b' -draw 'rectangle 13,17 22,27' \
  -fill '#ffb052' -draw 'rectangle 16,19 19,26' \
  -depth 8 -strip "$BOSS_SEEDS/hive-left-shooter.png"
magick "$BOSS_SEEDS/hive-left-shooter.png" -flop -depth 8 -strip \
  "$BOSS_SEEDS/hive-right-shooter.png"

magick -size 18x96 canvas:none +antialias \
  -fill '#1b1220' -draw 'polygon 3,0 14,0 17,3 17,92 14,95 3,95 0,92 0,3' \
  -fill '#7d2853' -draw 'rectangle 3,4 14,91' \
  -fill '#e35e9f' -draw 'rectangle 6,8 11,87' \
  -fill '#ffe1f5' -draw 'rectangle 7,14 10,31 rectangle 7,40 10,57 rectangle 7,66 10,83' \
  -depth 8 -strip "$BOSS_SEEDS/hive-left-reflector.png"
magick "$BOSS_SEEDS/hive-left-reflector.png" -flop -depth 8 -strip \
  "$BOSS_SEEDS/hive-right-reflector.png"

magick -size 126x72 canvas:none +antialias \
  -fill '#1a1320' -draw 'polygon 4,0 121,0 125,4 125,67 121,71 4,71 0,67 0,4' \
  -fill '#493052' -draw 'rectangle 4,4 121,67' \
  -fill '#66406d' -draw 'rectangle 8,8 117,20 rectangle 8,54 117,63' \
  -fill '#171019' -draw 'rectangle 38,10 87,27' \
  -fill '#7ff8ff' -draw 'rectangle 48,16 54,21 rectangle 71,16 77,21' \
  -fill '#2b1c30' -draw 'rectangle 8,24 30,52 rectangle 95,24 117,52' \
  -fill '#ff713d' -draw 'circle 62,40 62,27' \
  -fill '#fff0b0' -draw 'rectangle 58,34 66,46' \
  -fill '#8d4a34' -draw 'rectangle 34,30 45,50 rectangle 80,30 91,50' \
  -depth 8 -strip "$BOSS_SEEDS/siege-body.png"

magick -size 28x60 canvas:none +antialias \
  -fill '#1a1320' -draw 'polygon 4,0 23,0 27,4 27,55 23,59 4,59 0,55 0,4' \
  -fill '#57345e' -draw 'rectangle 4,4 23,55' \
  -fill '#25172a' -draw 'rectangle 7,8 20,51' \
  -fill '#ff6e45' -draw 'rectangle 10,13 17,46' \
  -fill '#fff0b0' -draw 'rectangle 12,19 15,40' \
  -depth 8 -strip "$BOSS_SEEDS/siege-left-weakpoint.png"
magick "$BOSS_SEEDS/siege-left-weakpoint.png" -flop -depth 8 -strip \
  "$BOSS_SEEDS/siege-right-weakpoint.png"

magick -size 32x32 canvas:none +antialias \
  -fill '#1a1320' -draw 'polygon 8,0 23,0 31,8 31,23 23,31 8,31 0,23 0,8' \
  -fill '#663950' -draw 'rectangle 5,5 26,26' \
  -fill '#ff5c32' -draw 'circle 16,16 16,7' \
  -fill '#fff0b0' -draw 'rectangle 14,11 18,21' \
  -depth 8 -strip "$BOSS_SEEDS/siege-core.png"

build_boss_body() {
  begin_seed "$1" "$BOSS_SEEDS/$1.png"
  add_frame 0 0 100 100 - 0 1
  add_frame 0 -1 100 98 - 0 1
  add_frame 0 0 100 100 '#c58cff' 8 1
  add_frame 0 0 98 98 '#ffad49' 14 1
  add_frame 0 0 96 96 '#ffad49' 26 1
  add_frame 0 1 98 96 '#ffffff' 32 1
  add_frame 1 0 98 98 '#ffffff' 48 1
  add_frame -1 0 98 98 '#ff8a70' 52 1
  destroyed_frames
  finish_role
}

build_boss_weakpoint() {
  begin_seed "$1" "$BOSS_SEEDS/$1.png"
  add_frame 0 0 100 100 - 0 1
  add_frame 0 0 98 100 '#ffffff' 10 1
  add_frame 0 0 96 98 '#ffad49' 18 1
  add_frame 0 0 92 96 '#ffad49' 32 1
  add_frame 0 1 96 96 '#ffffff' 42 1
  add_frame 1 0 98 98 '#ffffff' 50 1
  add_frame -1 0 98 98 '#ff8a70' 54 1
  destroyed_frames
  finish_role
}

build_boss_core() {
  begin_seed "$1" "$BOSS_SEEDS/$1.png"
  add_frame 0 0 100 100 - 0 1
  add_frame 0 0 96 96 '#ffffff' 12 1
  add_frame 0 0 100 100 - 0 1
  add_frame 0 0 94 94 '#ffffff' 18 1
  add_frame 0 0 98 98 '#ff8cff' 26 1
  add_frame 0 0 100 100 '#ffffff' 34 1
  add_frame 0 0 94 94 '#ff744f' 28 1
  add_frame 0 0 100 100 '#ffffff' 42 1
  add_frame 0 0 96 96 '#ff744f' 36 1
  add_frame 0 0 100 100 '#fff0b0' 46 1
  destroyed_frames
  finish_role
}

build_hive_shooter() {
  begin_seed "$1" "$BOSS_SEEDS/$1.png"
  add_frame 0 0 100 100 - 0 1
  add_frame 0 -1 100 96 - 0 1
  add_frame 0 0 98 98 '#ffad49' 16 1
  add_frame 0 0 94 94 '#ffad49' 30 1
  add_frame 0 0 92 92 '#ffffff' 38 1
  add_frame 0 1 90 96 '#ffffff' 48 1
  add_frame 0 1 94 98 '#ffad49' 28 1
  add_frame 0 0 100 100 - 0 1
  add_frame 1 0 98 98 '#ffffff' 50 1
  add_frame -1 0 98 98 '#ff8a70' 54 1
  destroyed_frames
  finish_role
}

for boss in sentinel siege; do
  build_boss_body "$boss-body"
  build_boss_weakpoint "$boss-left-weakpoint"
  build_boss_weakpoint "$boss-right-weakpoint"
  build_boss_core "$boss-core"
done
build_boss_core hive-core
build_hive_shooter hive-left-shooter
build_hive_shooter hive-right-shooter
build_boss_body hive-left-reflector
build_boss_body hive-right-reflector

echo 'default actor animation sources built'
