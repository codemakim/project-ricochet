#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/assets-source/combat/pc"
PUBLIC="$ROOT/public/assets/combat"
TMP="$(mktemp -d -t ricochet-pc-art.XXXXXX)"
ORB_BODY_SIZE=160
SPLITTER_COUPLING_HALF_WIDTH=28
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
  local frame opacity file bounds ink_width ink_height input="$SOURCE/masters/$1.png"
  local resize="$((width - 8))x$((height - 8))"
  local frames=()
  mkdir -p "$SOURCE/actors" "$PUBLIC/actors/$role" "$PUBLIC/pc"
  if [[ "$role" == hive-* || "$role" == siege-* ]]; then
    # Faint stray pixels must not shrink the hull inside its authored collision envelope.
    bounds="$(magick "$input" -alpha extract -threshold 5% -format '%@' info:)"
    magick "$input" -crop "$bounds" +repage "$TMP/$role-source.png"
    input="$TMP/$role-source.png"; resize+="!"
  fi
  magick "$input" -trim +repage \
    -filter Lanczos -resize "$resize" \
    -background none -gravity center -extent "${width}x${height}" \
    -depth 8 -strip "$TMP/$role.png"
  if [[ "$role" == hive-* || "$role" == siege-* ]]; then
    read -r ink_width ink_height < <(magick "$TMP/$role.png" -alpha extract \
      -threshold 5% -trim -format '%w %h\n' info:)
    ((ink_width * 10 >= width * 9 && ink_height * 10 >= height * 9)) || {
      echo "$role: visible hull is too small for its frame" >&2; exit 1;
    }
  fi
  cp "$TMP/$role.png" "$PUBLIC/pc/$role.png"
  for ((frame = 0; frame < count; frame++)); do
    file="$TMP/$role-$(printf '%03d' "$frame").png"
    # shortcut: rigid poses use tint/fade; author thruster and weapon frames after visual approval.
    if [[ "$role" == enemy-splitter ]] && ((frame >= hurt && frame < death)); then
      # The retiring parent fades quickly so the two live fragments remain legible.
      opacity="$(awk -v frame="$frame" 'BEGIN { print (frame <= 5 ? 1 - (frame - 2) * 0.25 : 1 - (frame - 5) * 0.2) }')"
      magick "$TMP/$role.png" -fill '#e8ffff' -colorize 20 \
        -channel A -evaluate multiply "$opacity" +channel "$file"
    elif ((frame >= death)); then
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
build_actor enemy-armored 280 240 11 5 7
build_actor enemy-shooter 280 240 15 9 11
build_actor enemy-splitter 560 240 14 3 10
for side in left right; do
  width=$((280 - SPLITTER_COUPLING_HALF_WIDTH))
  x=0; [[ "$side" == left ]] || x=$((280 + SPLITTER_COUPLING_HALF_WIDTH))
  # Discard the joining neck so adjacent children read as independent drones.
  magick "$TMP/enemy-splitter.png" -crop "${width}x240+$x+0" +repage \
    -background none -gravity center -extent 280x240 \
    -depth 8 -strip "$SOURCE/masters/enemy-fragment-$side.png"
  build_actor "enemy-fragment-$side" 280 240 7 2 4
done
build_actor sentinel-body 504 288 12 6 8
build_actor sentinel-left-weakpoint 112 240 11 5 7
magick "$SOURCE/masters/sentinel-left-weakpoint.png" -flop "$TMP/right-pod.png"
# Mirrored pod shares the generated source; retain the original master unchanged.
cp "$TMP/right-pod.png" "$SOURCE/masters/sentinel-right-weakpoint.png"
build_actor sentinel-right-weakpoint 112 240 11 5 7
build_actor sentinel-core 256 256 14 10 10
build_actor hive-core 448 448 14 10 10
build_actor hive-left-shooter 280 224 14 8 10
build_actor hive-left-reflector 144 768 12 6 8
build_actor siege-body 504 288 12 6 8
build_actor siege-left-weakpoint 112 240 11 5 7
build_actor siege-core 256 256 14 10 10
for spec in 'hive-shooter 280 224 14 8 10' 'hive-reflector 144 768 12 6 8' 'siege-weakpoint 112 240 11 5 7'; do
  read -r role width height count hurt death <<< "$spec"
  family="${role%%-*}"; part="${role#*-}"
  magick "$SOURCE/masters/$family-left-$part.png" -flop -strip \
    "$SOURCE/masters/$family-right-$part.png"
  build_actor "$family-right-$part" "$width" "$height" "$count" "$hurt" "$death"
done

for core in echo corrosion conduction inertia split explosion \
  photon-orbit resonant-swarm nano-proliferator mass-collapse reactor-orb \
  cluster-bombardment mirror-circuit meltdown-core vector-blade; do
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

for effect in orb-direct-hit enemy-break explosion-burst; do
  magick "$SOURCE/masters/$effect-grid.png" -filter Lanczos -resize 2048x1024! "$TMP/$effect-grid.png"
  frames=()
  for frame in {0..7}; do
    x=$((frame % 4 * 512)); y=$((frame / 4 * 512))
    opacity=1; ((frame != 7)) || opacity=0.2
    magick "$TMP/$effect-grid.png" -crop "512x512+$x+$y" +repage \
      -filter Lanczos -resize 230x230 -background none -gravity center -extent 256x256 \
      -channel A -evaluate multiply "$opacity" +channel \
      -depth 8 -strip "$TMP/$effect-$frame.png"
    frames+=("$TMP/$effect-$frame.png")
  done
  magick "${frames[@]}" +append -depth 8 -strip "$SOURCE/vfx/$effect.png"
  check_image "$SOURCE/vfx/$effect.png" 2048x256
  cp "$SOURCE/vfx/$effect.png" "$PUBLIC/pc/vfx/$effect.png"
done
echo 'PC combat art exported and dimensions/alpha checked'
