#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIXEL="$ROOT/assets-source/combat/pixel"
PUBLIC="$ROOT/public/assets/combat"
# shellcheck source=combat_art_assets.sh
source "$ROOT/scripts/combat_art_assets.sh"

selection="$(select_art_assets "$@")"
while IFS='|' read -r key runtime_path master_size _runtime_size _colors _alpha _bounds; do
  source_file="$PIXEL/$key.png"
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
  magick "$source_file" -filter point -resize 200% -strip "$output_file"
done <<< "$selection"

echo 'combat pixel art exported'
