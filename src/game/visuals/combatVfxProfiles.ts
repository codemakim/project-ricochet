import type { CombatVfxId } from './combatVfxIds';
import { REQUIRED_COMBAT_VFX_IDS } from './combatVfxIds';

export interface CombatVfxProfile {
  id: CombatVfxId;
  textureKey: string;
  url: string;
  frameWidth: 64;
  frameHeight: 64;
  frameCount: 4;
  frameRate: number;
  durationMs: number;
  scale: number;
  alpha: number;
  depth: number;
  blendMode: 'ADD' | 'NORMAL';
  maximumConcurrent: number;
}

const LONG_LIVED = new Set<CombatVfxId>([
  'corrosion-cloud', 'photon-beam', 'photon-intersection', 'nano-spread',
  'mass-collapse', 'reactor-blast', 'mirror-intersection', 'meltdown-eruption',
]);

const LARGE = new Set<CombatVfxId>([
  'player-defeat', 'boss-defeat', 'explosion-burst', 'photon-intersection',
  'resonant-final', 'mass-collapse', 'reactor-blast', 'meltdown-eruption',
]);

export const COMBAT_VFX_PROFILES = Object.fromEntries(
  REQUIRED_COMBAT_VFX_IDS.map((id): [CombatVfxId, CombatVfxProfile] => {
    const durationMs = LONG_LIVED.has(id) ? 640 : 320;
    return [id, {
      id,
      textureKey: `vfx-${id}`,
      url: `/assets/combat/vfx/${id}.png`,
      frameWidth: 64,
      frameHeight: 64,
      frameCount: 4,
      frameRate: 1000 / durationMs * 4,
      durationMs,
      scale: LARGE.has(id) ? 1.5 : 1,
      alpha: 0.82,
      depth: 6,
      blendMode: 'ADD',
      maximumConcurrent: LONG_LIVED.has(id) ? 4 : 8,
    }];
  }),
) as Record<CombatVfxId, CombatVfxProfile>;
