#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/assets-source/combat/orbs-hd"
TMP="$(mktemp -d -t ricochet-orbs.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

glow() {
  local sharp="$1" output="$2" blur="${3:-10}"
  magick "$sharp" -channel RGBA -blur "0x$blur" "$TMP/glow.png"
  magick "$TMP/glow.png" "$sharp" -compose over -composite -depth 8 -strip "$output"
}

base_dir() {
  local id="$1" directory="$SOURCE/$id"
  mkdir -p "$directory"
  magick "$SOURCE/orb-$id.png" -depth 8 -strip "$directory/body.png"
}

for id in echo corrosion conduction inertia split explosion; do base_dir "$id"; done

# Echo: one breathing lens and two broad outer arcs.
magick -size 256x256 xc:none \
  -fill 'rgba(238,218,255,0.52)' -stroke 'rgba(255,255,255,0.86)' -strokewidth 5 \
  -draw 'ellipse 128,128 62,38 0,360' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/echo/lens.png" 15
magick -size 256x256 xc:none -fill none -strokewidth 11 \
  -stroke 'rgba(208,115,255,0.78)' -draw 'arc 28,28 228,228 18,150 arc 28,28 228,228 198,330' \
  "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/echo/ring.png" 9

# Corrosion: three large readable bubbles rise across four frames; gas remains one broad band.
for frame in 0 1 2 3; do
  y1=$((174 - frame * 16)); y2=$((132 - frame * 12)); y3=$((92 - frame * 9))
  magick -size 256x256 xc:none -fill 'rgba(192,255,70,0.34)' \
    -stroke 'rgba(225,255,132,0.9)' -strokewidth 6 \
    -draw "circle 86,$y1 108,$y1 circle 150,$y2 166,$y2 circle 112,$y3 126,$y3" \
    "$TMP/bubbles-$frame.png"
  glow "$TMP/bubbles-$frame.png" "$TMP/bubbles-glow-$frame.png" 7
done
magick "$TMP"/bubbles-glow-{0,1,2,3}.png +append "$SOURCE/corrosion/bubbles.png"
magick -size 256x256 xc:none -fill 'rgba(112,255,42,0.23)' \
  -draw 'ellipse 104,150 76,34 0,360 ellipse 166,112 54,28 0,360 ellipse 84,92 40,22 0,360' \
  "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/corrosion/gas.png" 20

# Conduction: a four-step crawling lightning arc and one asymmetric flow band.
for frame in 0 1 2 3; do
  shift=$((frame * 8))
  magick -size 256x256 xc:none -fill none \
    -stroke 'rgba(110,242,255,0.98)' -strokewidth 7 \
    -draw "polyline $((48 + shift)),154 $((82 + shift)),116 $((110 + shift)),132 $((146 + shift)),78 $((194 + shift)),100" \
    -stroke 'rgba(255,255,255,0.95)' -strokewidth 3 \
    -draw "polyline $((48 + shift)),154 $((82 + shift)),116 $((110 + shift)),132 $((146 + shift)),78 $((194 + shift)),100" \
    "$TMP/arc-$frame.png"
  glow "$TMP/arc-$frame.png" "$TMP/arc-glow-$frame.png" 9
done
magick "$TMP"/arc-glow-{0,1,2,3}.png +append "$SOURCE/conduction/arc.png"
magick -size 256x256 xc:none -fill none -stroke 'rgba(52,201,255,0.68)' -strokewidth 13 \
  -draw 'arc 34,34 222,222 214,350' -stroke 'rgba(218,252,255,0.9)' -strokewidth 5 \
  -draw 'arc 34,34 222,222 214,350' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/conduction/flow.png" 10

# Inertia: chunky inner flywheel and eight outer counter-rotating ticks.
magick -size 256x256 xc:none -fill none -stroke 'rgba(255,220,88,0.88)' -strokewidth 10 \
  -draw 'circle 128,128 128,74 line 128,74 128,182 line 74,128 182,128 line 90,90 166,166 line 166,90 90,166' \
  "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/inertia/flywheel.png" 7
magick -size 256x256 xc:none -fill none -stroke 'rgba(255,167,42,0.9)' -strokewidth 12 \
  -draw 'line 128,24 128,48 line 128,208 128,232 line 24,128 48,128 line 208,128 232,128 line 55,55 72,72 line 184,184 201,201 line 201,55 184,72 line 72,184 55,201' \
  "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/inertia/shell.png" 8

# Split: two unmistakable nuclei; OrbVisuals supplies the opposing orbit.
magick -size 256x256 xc:none -fill 'rgba(255,120,244,0.8)' -stroke 'rgba(255,240,255,0.98)' -strokewidth 5 \
  -draw 'circle 128,128 128,98' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/split/nucleus-a.png" 12
magick -size 256x256 xc:none -fill 'rgba(111,117,255,0.78)' -stroke 'rgba(224,240,255,0.98)' -strokewidth 5 \
  -draw 'circle 128,128 128,102' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/split/nucleus-b.png" 12

# Explosion: one breathing heat core and sparse four-step radial sparks.
magick -size 256x256 xc:none \
  -fill 'rgba(255,90,18,0.36)' -draw 'circle 128,128 128,58' \
  -fill 'rgba(255,220,85,0.62)' -draw 'circle 128,128 128,88' \
  -fill 'rgba(255,255,226,0.9)' -draw 'circle 128,128 128,108' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/explosion/heat.png" 18
for frame in 0 1 2 3; do
  inner=$((54 + frame * 9)); outer=$((78 + frame * 13))
  magick -size 256x256 xc:none -fill none -stroke 'rgba(255,226,112,0.95)' \
    -strokewidth 7 \
    -draw "line 128,$((128-inner)) 128,$((128-outer)) line 128,$((128+inner)) 128,$((128+outer)) line $((128-inner)),128 $((128-outer)),128 line $((128+inner)),128 $((128+outer)),128 line $((128-inner*7/10)),$((128-inner*7/10)) $((128-outer*7/10)),$((128-outer*7/10)) line $((128+inner*7/10)),$((128+inner*7/10)) $((128+outer*7/10)),$((128+outer*7/10))" \
    "$TMP/sparks-$frame.png"
  glow "$TMP/sparks-$frame.png" "$TMP/sparks-glow-$frame.png" 8
done
magick "$TMP"/sparks-glow-{0,1,2,3}.png +append "$SOURCE/explosion/sparks.png"

for directory in echo corrosion conduction inertia split explosion; do
  while IFS= read -r layer; do
    magick "$layer" -channel A -evaluate multiply 0.24 +channel "$TMP/attenuated.png"
    mv "$TMP/attenuated.png" "$layer"
  done < <(find "$SOURCE/$directory" -type f -name '*.png' ! -name body.png | LC_ALL=C sort)
done

echo 'base orb animation sources built'
