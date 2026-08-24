#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/assets-source/combat/orbs-hd"
TMP="$(mktemp -d -t ricochet-fusions.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

glow() {
  local sharp="$1" output="$2" blur="${3:-9}"
  magick "$sharp" -channel RGBA -blur "0x$blur" "$TMP/glow.png"
  magick "$TMP/glow.png" "$sharp" -compose over -composite -depth 8 -strip "$output"
}

for id in photon-orbit resonant-swarm nano-proliferator mass-collapse reactor-orb cluster-bombardment mirror-circuit meltdown-core vector-blade; do
  mkdir -p "$SOURCE/$id"
  magick "$SOURCE/orb-$id.png" -depth 8 -strip "$SOURCE/$id/body.png"
done

# Photon orbit: clean optical halo and a counter-rotating beam axis.
magick -size 256x256 xc:none -fill none -stroke 'rgba(118,246,255,0.88)' -strokewidth 11 \
  -draw 'arc 28,28 228,228 12,168 arc 42,42 214,214 192,336' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/photon-orbit/halo.png" 10
magick -size 256x256 xc:none -fill none -stroke 'rgba(255,255,238,0.9)' -strokewidth 8 \
  -draw 'line 42,128 214,128 line 128,64 128,192' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/photon-orbit/axis.png" 8

# Resonant swarm: three large nodes and one broad phase ring.
magick -size 256x256 xc:none -fill 'rgba(247,114,255,0.82)' -stroke 'rgba(255,238,255,0.9)' -strokewidth 5 \
  -draw 'circle 128,82 128,64 circle 88,150 88,132 circle 168,150 168,132' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/resonant-swarm/nuclei.png" 11
magick -size 256x256 xc:none -fill none -stroke 'rgba(125,122,255,0.78)' -strokewidth 15 \
  -draw 'circle 128,128 128,38' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/resonant-swarm/phase.png" 13

# Nano proliferator: a four-stage chunky branch cycle and breathing seed.
for frame in 0 1 2 3; do
  reach=$((28 + frame * 15))
  magick -size 256x256 xc:none -fill none -stroke 'rgba(121,255,167,0.9)' -strokewidth 10 \
    -draw "line 128,164 128,$((164-reach)) line 128,$((150-reach/2)) $((128-reach)), $((132-reach/2)) line 128,$((150-reach/2)) $((128+reach)),$((132-reach/2))" \
    "$TMP/branches-$frame.png"
  glow "$TMP/branches-$frame.png" "$TMP/branches-glow-$frame.png" 8
done
magick "$TMP"/branches-glow-{0,1,2,3}.png +append "$SOURCE/nano-proliferator/branches.png"
magick -size 256x256 xc:none -fill 'rgba(184,255,109,0.55)' -stroke 'rgba(244,255,218,0.9)' -strokewidth 6 \
  -draw 'circle 128,146 128,104' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/nano-proliferator/growth.png" 15

# Mass collapse: contracting gravity ring and asymmetric rotating lens.
magick -size 256x256 xc:none -fill none -stroke 'rgba(174,108,255,0.84)' -strokewidth 15 \
  -draw 'circle 128,128 128,38 circle 128,128 128,66' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/mass-collapse/gravity-ring.png" 13
magick -size 256x256 xc:none -fill none -stroke 'rgba(92,85,255,0.72)' -strokewidth 22 \
  -draw 'arc 46,46 210,210 205,340' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/mass-collapse/shadow.png" 15

# Reactor orb: three broad coolant channels and a pulsing central charge.
magick -size 256x256 xc:none -fill none -stroke 'rgba(61,246,255,0.82)' -strokewidth 12 \
  -draw 'line 128,128 128,48 line 128,128 58,174 line 128,128 198,174' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/reactor-orb/channels.png" 10
magick -size 256x256 xc:none -fill 'rgba(255,232,86,0.6)' -stroke 'rgba(255,255,224,0.92)' -strokewidth 6 \
  -draw 'circle 128,128 128,88' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/reactor-orb/charge.png" 15

# Cluster bombardment: four outer pods and a clear sequential armed-pod cycle.
magick -size 256x256 xc:none -fill 'rgba(255,148,72,0.66)' -stroke 'rgba(255,238,185,0.9)' -strokewidth 5 \
  -draw 'circle 128,48 128,28 circle 208,128 188,128 circle 128,208 128,188 circle 48,128 68,128' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/cluster-bombardment/pods.png" 10
positions=('128,48' '208,128' '128,208' '48,128')
for frame in 0 1 2 3; do
  point="${positions[$frame]}"
  magick -size 256x256 xc:none -fill 'rgba(255,247,160,0.9)' -stroke 'rgba(255,255,240,0.95)' -strokewidth 5 \
    -draw "circle $point ${point%,*},$(( ${point#*,} - 13 ))" "$TMP/sequence-$frame.png"
  glow "$TMP/sequence-$frame.png" "$TMP/sequence-glow-$frame.png" 9
done
magick "$TMP"/sequence-glow-{0,1,2,3}.png +append "$SOURCE/cluster-bombardment/sequence.png"

# Mirror circuit: four switching mirror facets and one rotating square circuit.
for frame in 0 1 2 3; do
  offset=$((frame % 2 * 18))
  magick -size 256x256 xc:none -fill 'rgba(191,244,255,0.68)' -stroke 'rgba(255,255,255,0.9)' -strokewidth 5 \
    -draw "polygon $((70+offset)),92 $((112+offset)),72 $((126+offset)),94 $((84+offset)),114 polygon $((130-offset)),162 $((172-offset)),142 $((186-offset)),164 $((144-offset)),184" \
    "$TMP/mirror-$frame.png"
  glow "$TMP/mirror-$frame.png" "$TMP/mirror-glow-$frame.png" 8
done
magick "$TMP"/mirror-glow-{0,1,2,3}.png +append "$SOURCE/mirror-circuit/mirror.png"
magick -size 256x256 xc:none -fill none -stroke 'rgba(84,227,255,0.78)' -strokewidth 10 \
  -draw 'polygon 128,38 218,128 128,218 38,128 128,38' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/mirror-circuit/circuit.png" 10

# Meltdown core: circulating molten band and broad heat pulse.
magick -size 256x256 xc:none -fill none -stroke 'rgba(255,118,35,0.88)' -strokewidth 18 \
  -draw 'arc 38,38 218,218 30,170 arc 38,38 218,218 210,350' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/meltdown-core/molten-band.png" 14
magick -size 256x256 xc:none -fill 'rgba(255,62,26,0.38)' -stroke 'rgba(255,207,75,0.72)' -strokewidth 7 \
  -draw 'circle 128,128 128,62' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/meltdown-core/heat.png" 18

# Vector blade: one long rotating blade and a separate orbiting direction head.
magick -size 256x256 xc:none -fill 'rgba(112,238,255,0.62)' -stroke 'rgba(238,255,255,0.95)' -strokewidth 5 \
  -draw 'polygon 38,128 112,108 218,128 112,148' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/vector-blade/blade-axis.png" 9
magick -size 256x256 xc:none -fill 'rgba(255,235,99,0.82)' -stroke 'rgba(255,255,225,0.95)' -strokewidth 5 \
  -draw 'polygon 128,86 158,128 128,170 136,128' "$TMP/sharp.png"
glow "$TMP/sharp.png" "$SOURCE/vector-blade/direction.png" 9

for directory in photon-orbit resonant-swarm nano-proliferator mass-collapse reactor-orb cluster-bombardment mirror-circuit meltdown-core vector-blade; do
  while IFS= read -r layer; do
    magick "$layer" -channel A -evaluate multiply 0.24 +channel "$TMP/attenuated.png"
    mv "$TMP/attenuated.png" "$layer"
  done < <(find "$SOURCE/$directory" -type f -name '*.png' ! -name body.png | LC_ALL=C sort)
done

echo 'fusion orb animation sources built'
