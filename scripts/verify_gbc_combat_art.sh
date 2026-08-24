#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC="$ROOT/public/assets/combat"
TMP_SMALL="$(mktemp -t ricochet-small.XXXXXX.png)"
TMP_ROUND="$(mktemp -t ricochet-round.XXXXXX.png)"
trap 'rm -f "$TMP_SMALL" "$TMP_ROUND"' EXIT
# shellcheck source=combat_art_assets.sh
source "$ROOT/scripts/combat_art_assets.sh"

verify_animation_assets() {
  local source_root="$1" output_root="$2" scope="$3"
  local selection kind source_path runtime_path source_file runtime_file dimensions width height expected
  selection="$(select_animation_assets "$source_root" "$scope")"
  [[ -n "$selection" ]] || { echo "no animation assets for scope: $scope" >&2; return 1; }
  while IFS='|' read -r kind source_path runtime_path; do
    source_file="$source_root/$source_path"
    runtime_file="$output_root/$runtime_path"
    [[ -f "$runtime_file" ]] || { echo "$runtime_file: runtime asset missing" >&2; return 1; }
    read -r width height < <(magick identify -format '%w %h\n' "$source_file")
    if [[ "$kind" == actor ]]; then
      expected="$((width * 2))x$((height * 2))"
      check_file "$runtime_file" "$expected" - yes
      check_blocks "$runtime_file"
      continue
    fi
    (( height == 256 && width % 256 == 0 )) || {
      echo "$source_file: smooth source must contain horizontal 256px frames" >&2
      return 1
    }
    expected="${width}x${height}"
    check_file "$runtime_file" "$expected" - yes
    [[ "$(magick "$runtime_file" -format '%[pixel:p{0,0}]' info:)" == *',0)' ]] || {
      echo "$runtime_file: smooth animation corner must be transparent" >&2
      return 1
    }
  done <<< "$selection"
}

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

if [[ "${1:-}" == --fixture-directory ]]; then
  [[ $# == 2 ]] || { echo 'usage: --fixture-directory <path>' >&2; exit 1; }
  verify_animation_assets "$2/source" "$2/public" all
  echo 'combat animation fixtures verified'
  exit
fi

if [[ "${1:-}" == --animation-scope ]]; then
  [[ $# == 2 ]] || { echo 'usage: --animation-scope <scope>' >&2; exit 1; }
  verify_animation_assets "$ROOT/assets-source/combat" "$PUBLIC" "$2"
  echo 'combat animation art verified'
  exit
fi

selection="$(select_art_assets "$@")"
while IFS='|' read -r _key runtime_path _master_size runtime_size colors alpha bounds; do
  file="$PUBLIC/$runtime_path"
  check_file "$file" "$runtime_size" "$colors" "$alpha"
  [[ "$colors" == '-' ]] || check_blocks "$file"
  [[ "$bounds" == '-' ]] || check_opaque_bounds "$file" "$bounds"
done <<< "$selection"

echo 'combat art verified'
