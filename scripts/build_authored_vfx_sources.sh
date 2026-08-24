#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MASTER="$ROOT/assets-source/combat/vfx-masters"
SOURCE="$ROOT/assets-source/combat/vfx"
TMP="$(mktemp -d -t ricochet-authored-vfx.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

build_strip() {
  local id="$1" frame row column x y
  local input="$MASTER/$id-grid.png"
  [[ "$(magick identify -format '%wx%h' "$input")" == 1536x1024 ]] || {
    echo "$input: expected 1536x1024 4x2 master" >&2
    return 1
  }
  local frames=()
  for frame in {0..7}; do
    row=$((frame / 4)); column=$((frame % 4)); x=$((column * 384)); y=$((row * 512))
    magick "$input" -crop "384x512+$x+$y" +repage \
      -alpha on -channel A -fx 'max(r,max(g,b))' +channel \
      -filter Lanczos -resize 192x256 \
      -background none -gravity center -extent 256x256 \
      -depth 8 -strip "$TMP/$id-$frame.png"
    frames+=("$TMP/$id-$frame.png")
  done
  magick "${frames[@]}" +append -depth 8 -strip "$SOURCE/$id.png"
  [[ "$(magick identify -format '%wx%h' "$SOURCE/$id.png")" == 2048x256 ]] || {
    echo "$id: authored strip must be 2048x256" >&2
    return 1
  }
  [[ "$(magick identify -format '%[channels]' "$SOURCE/$id.png")" == *a* ]] || {
    echo "$id: authored strip must retain alpha" >&2
    return 1
  }
}

mkdir -p "$SOURCE"
build_strip explosion-burst
build_strip conduction-arc

echo 'authored combat VFX sources built'
