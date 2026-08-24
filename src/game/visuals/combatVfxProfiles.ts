import type { CombatVfxId } from './combatVfxIds';
import { REQUIRED_COMBAT_VFX_IDS } from './combatVfxIds';

export const COMBAT_VFX_DISPLAY_FRAME_SIZE = 64;

export interface CombatVfxProfile {
  id: CombatVfxId;
  textureKey: string;
  url: string;
  frameWidth: 256;
  frameHeight: 256;
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
  'player-launch': { frameCount: 8, durationMs: 420, scale: 1.3 },
  'player-recover': { frameCount: 8, durationMs: 520, scale: 1.4 },
  'player-hit': { frameCount: 8, durationMs: 480, scale: 1.3 },
  'player-defeat': { frameCount: 8, durationMs: 900, scale: 1.8 },
  'orb-ricochet': { frameCount: 8, durationMs: 380, scale: 1.25 },
  'enemy-break': { frameCount: 8, durationMs: 680, scale: 1.5 },
  'shooter-charge': { frameCount: 8, durationMs: 720, scale: 1.6 },
  'shooter-fire': { frameCount: 8, durationMs: 420, scale: 1.4 },
  'armored-brace': { frameCount: 8, durationMs: 600, scale: 1.6 },
  'splitter-fracture': { frameCount: 8, durationMs: 600, scale: 1.5 },
  'boss-module-break': { frameCount: 8, durationMs: 760, scale: 1.8 },
  'boss-core-rage': { frameCount: 8, durationMs: 900, scale: 1.5 },
  'enemy-hit': { frameCount: 8, durationMs: 360, scale: 1.25 },
  'orb-direct-hit': { frameCount: 8, durationMs: 400, scale: 1.4 },
  'corrosion-cloud': { frameCount: 8, durationMs: 800, scale: 1.6 },
  'split-burst': { frameCount: 8, durationMs: 520, scale: 1.5 },
  'boss-defeat': { frameCount: 8, durationMs: 900, scale: 2.5 },
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
      frameWidth: 256,
      frameHeight: 256,
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
