#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIXEL="$ROOT/assets-source/combat/pixel"
ENERGY="$ROOT/assets-source/combat/orbs-hd"
PUBLIC="$ROOT/public/assets/combat"
# shellcheck source=combat_art_assets.sh
source "$ROOT/scripts/combat_art_assets.sh"

render_animation_assets() {
  local source_root="$1" output_root="$2" scope="$3"
  local selection kind source_path runtime_path source_file output_file dimensions width height
  selection="$(select_animation_assets "$source_root" "$scope")"
  [[ -n "$selection" ]] || { echo "no animation assets for scope: $scope" >&2; return 1; }
  while IFS='|' read -r kind source_path runtime_path; do
    source_file="$source_root/$source_path"
    output_file="$output_root/$runtime_path"
    mkdir -p "$(dirname "$output_file")"
    if [[ "$kind" == actor ]]; then
      magick "$source_file" -filter point -resize 200% -depth 8 -strip "$output_file"
      continue
    fi
    dimensions="$(magick identify -format '%w %h' "$source_file")"
    read -r width height <<< "$dimensions"
    (( height == 256 && width % 256 == 0 )) || {
      echo "$source_file: smooth source must contain horizontal 256px frames" >&2
      return 1
    }
    magick "$source_file" -filter Lanczos -resize 25% -depth 8 -strip "$output_file"
  done <<< "$selection"
}

if [[ "${1:-}" == --fixture-directory ]]; then
  [[ $# == 2 ]] || { echo 'usage: --fixture-directory <path>' >&2; exit 1; }
  render_animation_assets "$2/source" "$2/public" all
  echo 'combat animation fixtures exported'
  exit
fi

if [[ "${1:-}" == --animation-scope ]]; then
  [[ $# == 2 ]] || { echo 'usage: --animation-scope <scope>' >&2; exit 1; }
  render_animation_assets "$ROOT/assets-source/combat" "$PUBLIC" "$2"
  echo 'combat animation art exported'
  exit
fi

selection="$(select_art_assets "$@")"
while IFS='|' read -r key runtime_path master_size runtime_size colors _alpha _bounds; do
  if [[ "$colors" == '-' ]]; then source_file="$ENERGY/$key.png"; else source_file="$PIXEL/$key.png"; fi
  output_file="$PUBLIC/$runtime_path"
  [[ -f "$source_file" ]] || {
    echo "$source_file: authored pixel master missing" >&2
    exit 1
  }
  [[ "$(magick identify -format '%wx%h' "$source_file")" == "$master_size" ]] || {
    echo "$source_file: expected master size $master_size" >&2
    exit 1
  }
  mkdir -p "$(dirname "$output_file")"
  if [[ "$colors" == '-' ]]; then
    magick "$source_file" -filter Lanczos -resize "$runtime_size" -strip "$output_file"
  else
    magick "$source_file" -filter point -resize 200% -strip "$output_file"
  fi
done <<< "$selection"

echo 'combat art exported'
