#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=combat_art_assets.sh
source "$ROOT/scripts/combat_art_assets.sh"

fail() {
  echo "$1" >&2
  exit 1
}

[[ "$(select_art_assets player enemy-basic | cut -d'|' -f1 | paste -sd, -)" == 'player,enemy-basic' ]] \
  || fail 'explicit selection must preserve requested key order'

[[ "$(select_art_assets orb-echo orb-corrosion orb-conduction | cut -d'|' -f1 | paste -sd, -)" == 'orb-echo,orb-corrosion,orb-conduction' ]] \
  || fail 'representative base orbs must be registered'

[[ "$(select_art_assets orb-inertia orb-split orb-explosion | cut -d'|' -f1 | paste -sd, -)" == 'orb-inertia,orb-split,orb-explosion' ]] \
  || fail 'remaining base orbs must be registered'

[[ "$(select_art_assets orb-photon-orbit orb-vector-blade | cut -d'|' -f1 | paste -sd, -)" == 'orb-photon-orbit,orb-vector-blade' ]] \
  || fail 'fusion orbs must be registered'

[[ "$(select_art_assets | wc -l | tr -d ' ')" == '22' ]] \
  || fail 'no-argument selection must include every registered asset'

while IFS='|' read -r key runtime_path _master_size _runtime_size _colors _alpha _bounds; do
  [[ "$key" == orb-* ]] || continue
  [[ "$(magick identify -format '%wx%h' "$ROOT/public/assets/combat/$runtime_path")" == '64x64' ]] \
    || fail "$key must ship as a 64x64 smooth energy asset"
done < <(select_art_assets)

if select_art_assets unknown >/dev/null 2>&1; then
  fail 'unknown asset key must fail'
fi

if select_art_assets player player >/dev/null 2>&1; then
  fail 'duplicate asset key must fail'
fi

if bash "$ROOT/scripts/render_gbc_combat_art.sh" unknown >/dev/null 2>&1; then
  fail 'renderer must propagate unknown-key failure'
fi

if bash "$ROOT/scripts/verify_gbc_combat_art.sh" unknown >/dev/null 2>&1; then
  fail 'verifier must propagate unknown-key failure'
fi

ANIMATION_TMP="$(mktemp -d -t ricochet-animation.XXXXXX)"
trap 'rm -rf "$ANIMATION_TMP"' EXIT
mkdir -p \
  "$ANIMATION_TMP/source/actors/player" \
  "$ANIMATION_TMP/source/orbs-hd/conduction"
magick -size 82x41 xc:none -fill '#39d9ff' \
  -draw 'rectangle 4,4 36,36 rectangle 45,4 77,36' \
  "$ANIMATION_TMP/source/actors/player/default.png"
magick -size 512x256 xc:none -fill '#c58cff80' \
  -draw 'circle 128,128 128,32 circle 384,128 384,48' \
  "$ANIMATION_TMP/source/orbs-hd/conduction/arc.png"
magick -size 256x256 xc:none "$ANIMATION_TMP/source/orbs-hd/orb-legacy.png"

bash "$ROOT/scripts/render_gbc_combat_art.sh" --fixture-directory "$ANIMATION_TMP"
bash "$ROOT/scripts/verify_gbc_combat_art.sh" --fixture-directory "$ANIMATION_TMP"
[[ "$(magick identify -format '%wx%h' "$ANIMATION_TMP/public/actors/player/default.png")" == '164x82' ]] \
  || fail 'actor fixture must export at exact 2x size'
[[ "$(magick identify -format '%wx%h' "$ANIMATION_TMP/public/orbs/conduction/arc.png")" == '128x64' ]] \
  || fail 'smooth framed fixture must preserve two 64px frames'
[[ ! -e "$ANIMATION_TMP/public/orbs/orb-legacy.png" ]] \
  || fail 'legacy root masters must not be treated as animation assets'
cp "$ANIMATION_TMP/public/actors/player/default.png" "$ANIMATION_TMP/expected-actor.png"
cp "$ANIMATION_TMP/public/orbs/conduction/arc.png" "$ANIMATION_TMP/expected-layer.png"
bash "$ROOT/scripts/render_gbc_combat_art.sh" --fixture-directory "$ANIMATION_TMP"
cmp "$ANIMATION_TMP/expected-actor.png" "$ANIMATION_TMP/public/actors/player/default.png" \
  || fail 'actor export must be deterministic'
cmp "$ANIMATION_TMP/expected-layer.png" "$ANIMATION_TMP/public/orbs/conduction/arc.png" \
  || fail 'smooth export must be deterministic'

echo 'combat art asset selection verified'
