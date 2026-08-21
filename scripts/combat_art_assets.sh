#!/usr/bin/env bash

# key|runtime path|master size|runtime size|max colors|alpha|opaque bounds
COMBAT_ART_ASSETS=(
  'player|sprites/player.png|41x41|82x82|12|yes|-'
  'enemy-basic|sprites/enemy-basic.png|35x30|70x60|12|yes|70x60'
  'enemy-shooter|sprites/enemy-shooter.png|35x30|70x60|12|yes|70x60'
  'enemy-armored|sprites/enemy-armored.png|70x60|140x120|12|yes|140x120'
  'enemy-splitter|sprites/enemy-splitter.png|70x30|140x60|12|yes|140x60'
  'enemy-fragment-left|sprites/enemy-fragment-left.png|35x30|70x60|12|yes|70x60'
  'enemy-fragment-right|sprites/enemy-fragment-right.png|35x30|70x60|12|yes|70x60'
  'orb-echo|sprites/orb-echo.png|16x16|32x32|10|yes|-'
  'orb-corrosion|sprites/orb-corrosion.png|16x16|32x32|10|yes|-'
  'orb-conduction|sprites/orb-conduction.png|16x16|32x32|10|yes|-'
  'orb-inertia|sprites/orb-inertia.png|16x16|32x32|10|yes|-'
  'orb-split|sprites/orb-split.png|16x16|32x32|10|yes|-'
  'orb-explosion|sprites/orb-explosion.png|16x16|32x32|10|yes|-'
  'orb-photon-orbit|sprites/orb-photon-orbit.png|16x16|32x32|10|yes|-'
  'orb-resonant-swarm|sprites/orb-resonant-swarm.png|16x16|32x32|10|yes|-'
  'orb-nano-proliferator|sprites/orb-nano-proliferator.png|16x16|32x32|10|yes|-'
  'orb-mass-collapse|sprites/orb-mass-collapse.png|16x16|32x32|10|yes|-'
  'orb-reactor-orb|sprites/orb-reactor-orb.png|16x16|32x32|10|yes|-'
  'orb-cluster-bombardment|sprites/orb-cluster-bombardment.png|16x16|32x32|10|yes|-'
  'orb-mirror-circuit|sprites/orb-mirror-circuit.png|16x16|32x32|10|yes|-'
  'orb-meltdown-core|sprites/orb-meltdown-core.png|16x16|32x32|10|yes|-'
  'orb-vector-blade|sprites/orb-vector-blade.png|16x16|32x32|10|yes|-'
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
