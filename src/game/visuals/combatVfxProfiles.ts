import type { CombatVfxId } from './combatVfxIds';
import { REQUIRED_COMBAT_VFX_IDS } from './combatVfxIds';

export const COMBAT_VFX_DISPLAY_FRAME_SIZE = 64;

export interface CombatVfxProfile {
  id: CombatVfxId;
  textureKey: string;
  url: string;
  frameWidth: 256;
  frameHeight: 256;
  frameCount: 8;
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

const PC_VFX = new Set<CombatVfxId>([
  'corrosion-cloud', 'orb-direct-hit', 'enemy-break', 'explosion-burst',
]);

const AUTHORED_MOTION = {
  'player-launch': { durationMs: 240, scale: 0.8, alpha: 0.45, maximumConcurrent: 2 },
  'player-recover': { durationMs: 280, scale: 1, alpha: 0.48, maximumConcurrent: 2 },
  'player-hit': { durationMs: 320, scale: 1.1, alpha: 0.75 },
  'player-defeat': { durationMs: 900, scale: 1.8 },
  'orb-ricochet': { durationMs: 240, scale: 0.9, alpha: 0.7 },
  'enemy-break': { durationMs: 680, scale: 1.5 },
  'shooter-charge': { durationMs: 720, scale: 1.6 },
  'shooter-fire': { durationMs: 420, scale: 1.4 },
  'armored-brace': { durationMs: 600, scale: 1.6 },
  'splitter-fracture': { durationMs: 600, scale: 1.5 },
  'boss-module-break': { durationMs: 760, scale: 1.8 },
  'boss-core-rage': { durationMs: 900, scale: 1.5 },
  'enemy-hit': { durationMs: 200, scale: 0.9, alpha: 0.55 },
  'orb-direct-hit': { durationMs: 200, scale: 0.9, alpha: 0.62 },
  'corrosion-cloud': { durationMs: 800, scale: 1.1, alpha: 0.6 },
  'split-burst': { durationMs: 520, scale: 1.5 },
  'boss-defeat': { durationMs: 900, scale: 3.75, alpha: 0.82 },
  'conduction-arc': { durationMs: 500, scale: 1.25 },
  'explosion-burst': { durationMs: 560, scale: 1.5 },
} as const satisfies Partial<Record<
  CombatVfxId,
  Pick<CombatVfxProfile, 'durationMs' | 'scale'>
    & Partial<Pick<CombatVfxProfile, 'alpha' | 'maximumConcurrent'>>
>>;

export const COMBAT_VFX_PROFILES = Object.fromEntries(
  REQUIRED_COMBAT_VFX_IDS.map((id): [CombatVfxId, CombatVfxProfile] => {
    const authored: Partial<CombatVfxProfile> | undefined = AUTHORED_MOTION[id as keyof typeof AUTHORED_MOTION];
    const durationMs = authored?.durationMs ?? (LONG_LIVED.has(id) ? 640 : 320);
    const frameCount = 8;
    return [id, {
      id,
      textureKey: `vfx-${id}`,
      url: PC_VFX.has(id) ? `/assets/combat/pc/vfx/${id}.png` : `/assets/combat/vfx/${id}.png`,
      frameWidth: 256,
      frameHeight: 256,
      frameCount,
      frameRate: 1000 / durationMs * frameCount,
      durationMs,
      scale: authored?.scale ?? (LARGE.has(id) ? 1.5 : 1),
      alpha: authored?.alpha ?? (LONG_LIVED.has(id) ? 0.38 : 0.68),
      depth: 6,
      blendMode: id === 'enemy-break' ? 'NORMAL' : 'ADD',
      maximumConcurrent: authored?.maximumConcurrent ?? (LONG_LIVED.has(id) ? 4 : 8),
    }];
  }),
) as Record<CombatVfxId, CombatVfxProfile>;
