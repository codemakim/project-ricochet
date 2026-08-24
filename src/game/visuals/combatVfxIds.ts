export const REQUIRED_COMBAT_VFX_IDS = [
  'player-launch', 'player-recover', 'player-hit', 'player-defeat',
  'orb-ricochet', 'orb-direct-hit',
  'enemy-hit', 'enemy-break', 'shooter-charge', 'shooter-fire',
  'armored-brace', 'splitter-fracture',
  'boss-module-break', 'boss-core-rage', 'boss-defeat',
  'echo-ring', 'corrosion-cloud', 'conduction-arc',
  'inertia-compression', 'split-burst', 'explosion-burst',
  'photon-beam', 'photon-intersection',
  'resonant-spawn', 'resonant-final',
  'nano-seed', 'nano-spread', 'mass-collapse',
  'reactor-charge', 'reactor-blast',
  'cluster-projectile', 'cluster-impact',
  'mirror-node', 'mirror-intersection',
  'meltdown-eruption', 'vector-blade',
] as const;

export type CombatVfxId = (typeof REQUIRED_COMBAT_VFX_IDS)[number];
