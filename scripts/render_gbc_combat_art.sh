#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIXEL="$ROOT/assets-source/combat/pixel"
ENERGY="$ROOT/assets-source/combat/orbs-hd"
PUBLIC="$ROOT/public/assets/combat"
# shellcheck source=combat_art_assets.sh
source "$ROOT/scripts/combat_art_assets.sh"

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
