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

echo 'combat art asset selection verified'
