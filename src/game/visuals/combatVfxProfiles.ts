import type { CombatVfxId } from './combatVfxIds';
import { REQUIRED_COMBAT_VFX_IDS } from './combatVfxIds';

export interface CombatVfxProfile {
  id: CombatVfxId;
  textureKey: string;
  url: string;
  frameWidth: 64;
  frameHeight: 64;
  frameCount: 4 | 8;
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

const AUTHORED_MOTION = {
  'conduction-arc': { frameCount: 8, durationMs: 500, scale: 1.25 },
  'explosion-burst': { frameCount: 8, durationMs: 560, scale: 1.5 },
} as const satisfies Partial<Record<
  CombatVfxId,
  { frameCount: 4 | 8; durationMs: number; scale: number }
>>;

export const COMBAT_VFX_PROFILES = Object.fromEntries(
  REQUIRED_COMBAT_VFX_IDS.map((id): [CombatVfxId, CombatVfxProfile] => {
    const authored = AUTHORED_MOTION[id as keyof typeof AUTHORED_MOTION];
    const durationMs = authored?.durationMs ?? (LONG_LIVED.has(id) ? 640 : 320);
    const frameCount = authored?.frameCount ?? 4;
    return [id, {
      id,
      textureKey: `vfx-${id}`,
      url: `/assets/combat/vfx/${id}.png`,
      frameWidth: 64,
      frameHeight: 64,
      frameCount,
      frameRate: 1000 / durationMs * frameCount,
      durationMs,
      scale: authored?.scale ?? (LARGE.has(id) ? 1.5 : 1),
      alpha: 0.82,
      depth: 6,
      blendMode: 'ADD',
      maximumConcurrent: LONG_LIVED.has(id) ? 4 : 8,
    }];
  }),
) as Record<CombatVfxId, CombatVfxProfile>;
