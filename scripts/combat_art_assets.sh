#!/usr/bin/env bash

# key|runtime path|master size|runtime size|max colors (- = smooth)|alpha|opaque bounds
COMBAT_ART_ASSETS=(
  'player|sprites/player.png|41x41|82x82|12|yes|-'
  'enemy-basic|sprites/enemy-basic.png|35x30|70x60|12|yes|70x60'
  'enemy-shooter|sprites/enemy-shooter.png|35x30|70x60|12|yes|70x60'
  'enemy-armored|sprites/enemy-armored.png|70x60|140x120|12|yes|140x120'
  'enemy-splitter|sprites/enemy-splitter.png|70x30|140x60|12|yes|140x60'
  'enemy-fragment-left|sprites/enemy-fragment-left.png|35x30|70x60|12|yes|70x60'
  'enemy-fragment-right|sprites/enemy-fragment-right.png|35x30|70x60|12|yes|70x60'
  'orb-echo|sprites/orb-echo.png|256x256|256x256|-|yes|-'
  'orb-corrosion|sprites/orb-corrosion.png|256x256|256x256|-|yes|-'
  'orb-conduction|sprites/orb-conduction.png|256x256|256x256|-|yes|-'
  'orb-inertia|sprites/orb-inertia.png|256x256|256x256|-|yes|-'
  'orb-split|sprites/orb-split.png|256x256|256x256|-|yes|-'
  'orb-explosion|sprites/orb-explosion.png|256x256|256x256|-|yes|-'
  'orb-photon-orbit|sprites/orb-photon-orbit.png|256x256|256x256|-|yes|-'
  'orb-resonant-swarm|sprites/orb-resonant-swarm.png|256x256|256x256|-|yes|-'
  'orb-nano-proliferator|sprites/orb-nano-proliferator.png|256x256|256x256|-|yes|-'
  'orb-mass-collapse|sprites/orb-mass-collapse.png|256x256|256x256|-|yes|-'
  'orb-reactor-orb|sprites/orb-reactor-orb.png|256x256|256x256|-|yes|-'
  'orb-cluster-bombardment|sprites/orb-cluster-bombardment.png|256x256|256x256|-|yes|-'
  'orb-mirror-circuit|sprites/orb-mirror-circuit.png|256x256|256x256|-|yes|-'
  'orb-meltdown-core|sprites/orb-meltdown-core.png|256x256|256x256|-|yes|-'
  'orb-vector-blade|sprites/orb-vector-blade.png|256x256|256x256|-|yes|-'
)

select_art_assets() {
  if (( $# == 0 )); then
    printf '%s\n' "${COMBAT_ART_ASSETS[@]}"
    return
  fi

  local selected='|' key spec found
  for key in "$@"; do
    [[ "$selected" != *"|$key|"* ]] || {
      echo "duplicate combat art key: $key" >&2
      return 1
    }
    found=''
    for spec in "${COMBAT_ART_ASSETS[@]}"; do
      if [[ "${spec%%|*}" == "$key" ]]; then
        printf '%s\n' "$spec"
        found=yes
        break
      fi
    done
    [[ -n "$found" ]] || {
      echo "unknown combat art key: $key" >&2
      return 1
    }
    selected="${selected}${key}|"
  done
}

select_animation_assets() {
  local source_root="$1" scope="$2" file relative role orb_id
  case "$scope" in
    actor-core|actor-boss|orb-base|orb-fusion|vfx|all) ;;
    *) echo "unknown animation asset scope: $scope" >&2; return 1 ;;
  esac

  if [[ "$scope" == actor-core || "$scope" == actor-boss || "$scope" == all ]]; then
    while IFS= read -r file; do
      relative="${file#"$source_root/"}"
      role="${relative#actors/}"
      role="${role%%/*}"
      if [[ "$scope" == actor-core && "$role" != player && "$role" != enemy-* ]]; then continue; fi
      if [[ "$scope" == actor-boss && "$role" != sentinel-* && "$role" != hive-* && "$role" != siege-* ]]; then continue; fi
      printf 'actor|%s|%s\n' "$relative" "$relative"
    done < <(find "$source_root/actors" -type f -name '*.png' 2>/dev/null | LC_ALL=C sort)
  fi

  if [[ "$scope" == orb-base || "$scope" == orb-fusion || "$scope" == all ]]; then
    while IFS= read -r file; do
      relative="${file#"$source_root/"}"
      [[ "$relative" == orbs-hd/*/* ]] || continue
      orb_id="${relative#orbs-hd/}"
      orb_id="${orb_id%%/*}"
      case "$orb_id" in
        echo|corrosion|conduction|inertia|split|explosion)
          [[ "$scope" == orb-fusion ]] && continue
          ;;
        *)
          [[ "$scope" == orb-base ]] && continue
          ;;
      esac
      printf 'smooth|%s|orbs/%s\n' "$relative" "${relative#orbs-hd/}"
    done < <(find "$source_root/orbs-hd" -type f -name '*.png' 2>/dev/null | LC_ALL=C sort)
  fi

  if [[ "$scope" == vfx || "$scope" == all ]]; then
    while IFS= read -r file; do
      relative="${file#"$source_root/"}"
      printf 'smooth|%s|%s\n' "$relative" "$relative"
    done < <(find "$source_root/vfx" -type f -name '*.png' 2>/dev/null | LC_ALL=C sort)
  fi
}
