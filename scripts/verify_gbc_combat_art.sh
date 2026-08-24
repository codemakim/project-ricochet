#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC="$ROOT/public/assets/combat"
TMP_SMALL="$(mktemp -t ricochet-small.XXXXXX.png)"
TMP_ROUND="$(mktemp -t ricochet-round.XXXXXX.png)"
trap 'rm -f "$TMP_SMALL" "$TMP_ROUND"' EXIT
# shellcheck source=combat_art_assets.sh
source "$ROOT/scripts/combat_art_assets.sh"

selection="$(select_art_assets "$@")"

check_file() {
  local file="$1" expected="$2" maximum_colors="$3" alpha="$4"
  local dimensions colors channels
  [[ -f "$file" ]] || { echo "$file: runtime asset missing" >&2; exit 1; }
  read -r dimensions colors channels < <(magick identify -format '%wx%h %k %[channels]\n' "$file")
  [[ "$dimensions" == "$expected" ]] || {
    echo "$file: expected $expected, got $dimensions" >&2
    exit 1
  }
  if [[ "$maximum_colors" != '-' ]]; then
    (( colors <= maximum_colors )) || {
      echo "$file: $colors colors exceeds $maximum_colors" >&2
      exit 1
    }
  fi
  if [[ "$alpha" == yes ]]; then
    [[ "$channels" == *a* ]] || { echo "$file: alpha channel missing" >&2; exit 1; }
    [[ "$(magick "$file" -format '%[pixel:p{0,0}]' info:)" == *',0)' ]] || {
      echo "$file: opaque corner" >&2
      exit 1
    }
  fi
}

check_blocks() {
  local file="$1" difference
  magick "$file" -filter point -resize 50% "$TMP_SMALL"
  magick "$TMP_SMALL" -filter point -resize 200% "$TMP_ROUND"
  difference="$(magick compare -metric AE "$file" "$TMP_ROUND" null: 2>&1 || true)"
  [[ "$difference" == '0 (0)' ]] || {
    echo "$file: pixels are not exact 2x blocks ($difference changed pixels)" >&2
    exit 1
  }
}

check_opaque_bounds() {
  local file="$1" expected="$2" bounds
  bounds="$(magick "$file" -alpha extract -trim -format '%@' info:)"
  [[ "$bounds" == "$expected+0+0" ]] || {
    echo "$file: opaque bounds expected $expected+0+0, got $bounds" >&2
    exit 1
  }
}

while IFS='|' read -r _key runtime_path _master_size runtime_size colors alpha bounds; do
  file="$PUBLIC/$runtime_path"
  check_file "$file" "$runtime_size" "$colors" "$alpha"
  [[ "$colors" == '-' ]] || check_blocks "$file"
  [[ "$bounds" == '-' ]] || check_opaque_bounds "$file" "$bounds"
done <<< "$selection"

echo 'combat art verified'
