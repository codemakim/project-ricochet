import { GAME_TUNING, type ProjectileVisualTuning } from '../config/gameTuning';

type TextureShape =
  | 'outlinedCircle'
  | 'centeredCircle'
  | 'outlinedRoundedRect'
  | 'flash'
  | 'crackedRoundedRect'
  | 'fragmentLeft'
  | 'fragmentRight';

export type CombatTextureDescriptor = ProjectileVisualTuning & { shape: TextureShape };

export function combatProjectileTextureDescriptors(): Record<string, CombatTextureDescriptor> {
  const { friendly, hostile } = GAME_TUNING.visual;
  return {
    'orb-charged': { ...friendly.permanentOrb, shape: 'outlinedCircle' },
    'orb-temporary': { ...friendly.temporaryOrb, shape: 'outlinedCircle' },
    'enemy-bullet': { ...hostile.enemyBullet, shape: 'centeredCircle' },
    'boss-basic-bullet': { ...hostile.bossBasic, shape: 'centeredCircle' },
    'boss-aimed-bullet': { ...hostile.bossAimed, shape: 'centeredCircle' },
    'boss-falling-hazard': { ...hostile.bossHazard, shape: 'outlinedRoundedRect' },
    'boss-muzzle-flash': { ...hostile.bossMuzzleFlash, shape: 'flash' },
    'enemy-splitter': { fill: 0xff5c70, accent: 0x6d1730, width: 38, height: 30, shape: 'crackedRoundedRect' },
    'enemy-fragment-left': { fill: 0xff5c70, accent: 0x6d1730, width: 22, height: 18, shape: 'fragmentLeft' },
    'enemy-fragment-right': { fill: 0xff5c70, accent: 0x6d1730, width: 22, height: 18, shape: 'fragmentRight' },
  };
}
