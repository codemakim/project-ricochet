#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/assets-source/combat/pc"
PUBLIC="$ROOT/public/assets/combat"
TMP="$(mktemp -d -t ricochet-pc-art.XXXXXX)"
ORB_BODY_SIZE=160
trap 'rm -rf "$TMP"' EXIT

check_image() {
  local file="$1" expected="$2"
  [[ "$(magick identify -format '%wx%h' "$file")" == "$expected" ]] || {
    echo "$file: expected $expected" >&2; exit 1;
  }
  [[ "$(magick identify -format '%[channels]' "$file")" == *a* ]] || {
    echo "$file: alpha channel missing" >&2; exit 1;
  }
}

build_actor() {
  local role="$1" width="$2" height="$3" count="$4" hurt="$5" death="$6"
  local frame opacity file
  local frames=()
  mkdir -p "$SOURCE/actors" "$PUBLIC/actors/$role" "$PUBLIC/pc"
  magick "$SOURCE/masters/$role.png" -trim +repage \
    -filter Lanczos -resize "$((width - 8))x$((height - 8))" \
    -background none -gravity center -extent "${width}x${height}" \
    -depth 8 -strip "$TMP/$role.png"
  cp "$TMP/$role.png" "$PUBLIC/pc/$role.png"
  for ((frame = 0; frame < count; frame++)); do
    file="$TMP/$role-$(printf '%03d' "$frame").png"
    # shortcut: rigid poses use tint/fade; author thruster and weapon frames after visual approval.
    if ((frame >= death)); then
      opacity="$(awk -v frame="$frame" -v death="$death" 'BEGIN { print 1 - (frame - death + 1) * 0.2 }')"
      magick "$TMP/$role.png" -channel A -evaluate multiply "$opacity" +channel "$file"
    elif ((frame >= hurt)); then
      magick "$TMP/$role.png" -fill '#e8ffff' -colorize 35 "$file"
    else
      cp "$TMP/$role.png" "$file"
    fi
    frames+=("$file")
  done
  magick "${frames[@]}" +append -depth 8 -strip "$SOURCE/actors/$role.png"
  check_image "$SOURCE/actors/$role.png" "$((width * count))x${height}"
  cp "$SOURCE/actors/$role.png" "$PUBLIC/actors/$role/pc.png"
}

mkdir -p "$SOURCE/orbs" "$SOURCE/vfx" "$PUBLIC/pc/orbs" "$PUBLIC/pc/vfx"
magick "$SOURCE/masters/background.png" -filter Lanczos -resize 900x1600! \
  -quality 90 -strip "$PUBLIC/pc/orbital-corridor.webp"
build_actor player 256 256 20 14 16
build_actor enemy-basic 280 240 9 3 5

for core in explosion split corrosion; do
  input="$SOURCE/masters/$core-components.png"
  read -r width height < <(magick identify -format '%w %h\n' "$input")
  ((width == height * 2)) || { echo "$input: expected two square cells" >&2; exit 1; }
  mkdir -p "$SOURCE/orbs/$core" "$PUBLIC/pc/orbs/$core"
  for cell in 0 1; do
    name=body; ((cell == 0)) || name=energy
    size=256; ((cell != 0)) || size="$ORB_BODY_SIZE"
    # Compact nuclei sit inside the original hit envelope indicated by the energy rim.
    magick "$input" -crop "${height}x${height}+$((cell * height))+0" +repage \
      -filter Lanczos -resize "${size}x${size}" -background none -gravity center -extent 256x256 \
      -depth 8 -strip "$SOURCE/orbs/$core/$name.png"
    check_image "$SOURCE/orbs/$core/$name.png" 256x256
    cp "$SOURCE/orbs/$core/$name.png" "$PUBLIC/pc/orbs/$core/$name.png"
  done
done

# Normalize the generated 4x2 grid before slicing; generated dimensions can be odd.
magick "$SOURCE/masters/corrosion-field-grid.png" -filter Lanczos -resize 2048x1024! "$TMP/field.png"
frames=()
for frame in {0..7}; do
  x=$((frame % 4 * 512)); y=$((frame / 4 * 512))
  magick "$TMP/field.png" -crop "512x512+$x+$y" +repage \
    -filter Lanczos -resize 230x230 -background none -gravity center -extent 256x256 \
    -depth 8 -strip "$TMP/field-$frame.png"
  frames+=("$TMP/field-$frame.png")
done
magick "${frames[@]}" +append -depth 8 -strip "$SOURCE/vfx/corrosion-cloud.png"
check_image "$SOURCE/vfx/corrosion-cloud.png" 2048x256
cp "$SOURCE/vfx/corrosion-cloud.png" "$PUBLIC/pc/vfx/corrosion-cloud.png"
echo 'PC combat art exported and dimensions/alpha checked'
