import { GAME_TUNING, type ProjectileVisualTuning } from '../config/gameTuning';

type TextureShape =
  | 'outlinedCircle'
  | 'centeredCircle'
  | 'outlinedRoundedRect'
  | 'flash'
  | 'crackedRoundedRect'
  | 'fragmentLeft'
  | 'fragmentRight'
  | 'hiveCore'
  | 'hiveShooter'
  | 'reflectorWall';

export type CombatTextureDescriptor = ProjectileVisualTuning & { shape: TextureShape; deferred?: boolean };

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
    'enemy-splitter': { fill: 0xff5c70, accent: 0x6d1730, width: 38, height: 30, shape: 'crackedRoundedRect', deferred: true },
    'enemy-fragment-left': { fill: 0xff5c70, accent: 0x6d1730, width: 22, height: 18, shape: 'fragmentLeft', deferred: true },
    'enemy-fragment-right': { fill: 0xff5c70, accent: 0x6d1730, width: 22, height: 18, shape: 'fragmentRight', deferred: true },
    'hive-shooter-bullet': { ...hostile.enemyBullet, shape: 'centeredCircle', deferred: true },
    'hive-core-bullet': { fill: 0xff8a3d, accent: 0x5c1800, width: 10, height: 10, shape: 'centeredCircle', deferred: true },
    'hive-shooter-warning': { fill: 0xff4d5a, accent: 0xffb0a8, width: 18, height: 18, shape: 'flash', deferred: true },
    'hive-core-warning': { fill: 0xff8a3d, accent: 0xffd19a, width: 64, height: 64, shape: 'flash', deferred: true },
    'hive-core': {
      fill: 0xff5c70,
      accent: 0xffd19a,
      width: GAME_TUNING.hiveBoss.core.visualSize,
      height: GAME_TUNING.hiveBoss.core.visualSize,
      shape: 'hiveCore',
      deferred: true,
    },
    'hive-left-shooter': {
      fill: 0xff784f,
      accent: 0xffd19a,
      width: GAME_TUNING.hiveBoss.shooter.width,
      height: GAME_TUNING.hiveBoss.shooter.height,
      shape: 'hiveShooter',
      deferred: true,
    },
    'hive-right-shooter': {
      fill: 0xff784f,
      accent: 0xffd19a,
      width: GAME_TUNING.hiveBoss.shooter.width,
      height: GAME_TUNING.hiveBoss.shooter.height,
      shape: 'hiveShooter',
      deferred: true,
    },
    'hive-left-reflector': {
      fill: 0x8f2037,
      accent: 0xffb45c,
      width: GAME_TUNING.hiveBoss.reflector.width,
      height: GAME_TUNING.hiveBoss.reflector.height,
      shape: 'reflectorWall',
      deferred: true,
    },
    'hive-right-reflector': {
      fill: 0x8f2037,
      accent: 0xffb45c,
      width: GAME_TUNING.hiveBoss.reflector.width,
      height: GAME_TUNING.hiveBoss.reflector.height,
      shape: 'reflectorWall',
      deferred: true,
    },
  };
}

export function renderableCombatTextureDescriptors(): Record<string, CombatTextureDescriptor> {
  return combatProjectileTextureDescriptors();
}
