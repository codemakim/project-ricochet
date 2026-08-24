#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/assets-source/combat/vfx"
TMP="$(mktemp -d -t ricochet-vfx.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$SOURCE"
bash "$ROOT/scripts/build_authored_vfx_sources.sh"

ids=(
  player-launch player-recover player-hit player-defeat orb-ricochet orb-direct-hit
  enemy-hit enemy-break shooter-charge shooter-fire armored-brace splitter-fracture
  boss-module-break boss-core-rage boss-defeat echo-ring corrosion-cloud conduction-arc
  inertia-compression split-burst explosion-burst photon-beam photon-intersection
  resonant-spawn resonant-final nano-seed nano-spread mass-collapse reactor-charge
  reactor-blast cluster-projectile cluster-impact mirror-node mirror-intersection
  meltdown-eruption vector-blade
)

# These effects are authored from image masters by
# build_authored_vfx_sources.sh; never overwrite them with geometric fallbacks.

palette() {
  case "$1" in
    player-*|orb-*|echo-*|conduction-*|photon-*|mirror-*) echo '#65f6ff' ;;
    corrosion-*|nano-*) echo '#9cff55' ;;
    inertia-*|reactor-*|cluster-*) echo '#ffd45c' ;;
    split-*|resonant-*) echo '#d876ff' ;;
    explosion-*|enemy-*|shooter-*|armored-*|splitter-*|boss-*|meltdown-*|vector-*) echo '#ff704d' ;;
    *) echo '#ffffff' ;;
  esac
}

shape() {
  case "$1" in
    *beam|*arc|*blade|shooter-fire|cluster-projectile) echo line ;;
    *cloud|nano-spread) echo cloud ;;
    *charge|*compression|*node|resonant-spawn|nano-seed) echo orbit ;;
    *break|*defeat|*burst|*blast|*fracture|*eruption|*impact|*intersection) echo burst ;;
    *) echo ring ;;
  esac
}

for id in "${ids[@]}"; do
  case "$id" in
    explosion-burst|conduction-arc|enemy-hit|orb-direct-hit|corrosion-cloud|split-burst|boss-defeat) continue ;;
  esac
  color="$(palette "$id")"
  kind="$(shape "$id")"
  frames=()
  for frame in 0 1 2 3; do
    sharp="$TMP/$id-sharp-$frame.png"
    output="$TMP/$id-$frame.png"
    progress=$((frame + 1))
    case "$kind" in
      line)
        half=$((42 + frame * 18)); spread=$((8 + frame * 3))
        magick -size 256x256 xc:none -fill none -stroke "$color" -strokewidth "$((15 - frame * 2))" \
          -draw "line $((128-half)),128 $((128+half)),128 line $((128-half/2)),${spread} $((128+half/2)),$((256-spread))" "$sharp"
        ;;
      cloud)
        radius=$((24 + frame * 11)); offset=$((16 + frame * 4))
        magick -size 256x256 xc:none -fill "$color" -stroke white -strokewidth 3 \
          -draw "circle $((128-offset)),128 $((128-offset+radius)),128 circle $((128+offset)),118 $((128+offset+radius)),118 circle 128,$((128-offset)) $((128+radius)),$((128-offset))" "$sharp"
        ;;
      orbit)
        radius=$((34 + frame * 12)); dot=$((8 + frame))
        magick -size 256x256 xc:none -fill none -stroke "$color" -strokewidth 8 \
          -draw "circle 128,128 $((128+radius)),128" -fill white -stroke none \
          -draw "circle $((128+radius)),128 $((128+radius+dot)),128 circle $((128-radius)),128 $((128-radius-dot)),128" "$sharp"
        ;;
      burst)
        inner=$((18 + frame * 9)); outer=$((52 + frame * 20)); width=$((14 - frame * 2))
        magick -size 256x256 xc:none -fill none -stroke "$color" -strokewidth "$width" \
          -draw "line 128,$((128-inner)) 128,$((128-outer)) line 128,$((128+inner)) 128,$((128+outer)) line $((128-inner)),128 $((128-outer)),128 line $((128+inner)),128 $((128+outer)),128 line $((128-inner*7/10)),$((128-inner*7/10)) $((128-outer*7/10)),$((128-outer*7/10)) line $((128+inner*7/10)),$((128+inner*7/10)) $((128+outer*7/10)),$((128+outer*7/10)) line $((128+inner*7/10)),$((128-inner*7/10)) $((128+outer*7/10)),$((128-outer*7/10)) line $((128-inner*7/10)),$((128+inner*7/10)) $((128-outer*7/10)),$((128+outer*7/10))" "$sharp"
        ;;
      ring)
        radius=$((24 + frame * 19)); width=$((14 - frame * 2))
        magick -size 256x256 xc:none -fill none -stroke "$color" -strokewidth "$width" \
          -draw "circle 128,128 $((128+radius)),128" -stroke white -strokewidth 3 \
          -draw "arc $((128-radius)),$((128-radius)) $((128+radius)),$((128+radius)) $((frame*38)),$((frame*38+92))" "$sharp"
        ;;
    esac
    magick "$sharp" -channel RGBA -blur 0x12 "$TMP/glow.png"
    magick "$TMP/glow.png" "$sharp" -compose over -composite \
      -channel A -evaluate multiply 0.62 +channel -depth 8 -strip "$output"
    frames+=("$output")
  done
  magick "${frames[@]}" +append "$SOURCE/$id.png"
done

echo 'combat VFX animation sources built'
