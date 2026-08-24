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
  role="$1"
  seed="$SEEDS/$2.png"
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

echo 'default actor animation sources built'
