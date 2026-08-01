import { GAME_TUNING, type ProjectileVisualTuning } from '../config/gameTuning';
import { GAME_HEIGHT } from '../constants';

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

export type OrbCoreSymbol =
  | 'wave' | 'drop' | 'bolt' | 'arrow' | 'fork' | 'burst'
  | 'beam' | 'swarm' | 'seed';

export type CombatTextureDescriptor = ProjectileVisualTuning & {
  shape: TextureShape;
  deferred?: boolean;
  symbol?: OrbCoreSymbol;
  notches?: number;
};

export function combatProjectileTextureDescriptors(): Record<string, CombatTextureDescriptor> {
  const { friendly, hostile } = GAME_TUNING.visual;
  const coreTexture = (
    core: keyof typeof GAME_TUNING.orbCores,
    symbol: OrbCoreSymbol,
  ): CombatTextureDescriptor => ({
    fill: GAME_TUNING.orbCores[core].fill,
    accent: GAME_TUNING.orbCores[core].accent,
    width: friendly.permanentOrb.width,
    height: friendly.permanentOrb.height,
    shape: 'outlinedCircle',
    symbol,
  });
  const coreTextures = {
    echo: coreTexture('echo', 'wave'),
    corrosion: coreTexture('corrosion', 'drop'),
    conduction: coreTexture('conduction', 'bolt'),
    inertia: coreTexture('inertia', 'arrow'),
    split: coreTexture('split', 'fork'),
    explosion: coreTexture('explosion', 'burst'),
  } as const;
  const leveledCores = Object.fromEntries(Object.entries(coreTextures).flatMap(
    ([core, descriptor]) => [1, 2, 3, 4, 5].map((level) => [
      `orb-${core}-lv${level}`,
      { ...descriptor, notches: level },
    ]),
  ));
  const fusionTextures = {
    'photon-orbit': {
      ...friendly.permanentOrb,
      fill: GAME_TUNING.orbFusions.photonOrbit.fill,
      accent: GAME_TUNING.orbFusions.photonOrbit.accent,
      shape: 'outlinedCircle' as const,
      symbol: 'beam' as const,
    },
    'resonant-swarm': {
      ...friendly.permanentOrb,
      fill: GAME_TUNING.orbFusions.resonantSwarm.fill,
      accent: GAME_TUNING.orbFusions.resonantSwarm.accent,
      shape: 'outlinedCircle' as const,
      symbol: 'swarm' as const,
    },
    'nano-proliferator': {
      ...friendly.permanentOrb,
      fill: GAME_TUNING.orbFusions.nanoProliferator.fill,
      accent: GAME_TUNING.orbFusions.nanoProliferator.accent,
      shape: 'outlinedCircle' as const,
      symbol: 'seed' as const,
    },
  };
  const leveledFusions = Object.fromEntries(Object.entries(fusionTextures).flatMap(
    ([fusion, descriptor]) => Array.from({ length: 9 }, (_, index) => [
      `orb-${fusion}-lv${index + 1}`,
      { ...descriptor, notches: index + 1 },
    ]),
  ));
  return {
    'orb-charged': { ...friendly.permanentOrb, shape: 'outlinedCircle' },
    'orb-echo': coreTextures.echo,
    'orb-corrosion': coreTextures.corrosion,
    'orb-conduction': coreTextures.conduction,
    'orb-inertia': coreTextures.inertia,
    'orb-split': coreTextures.split,
    'orb-explosion': coreTextures.explosion,
    ...leveledCores,
    ...leveledFusions,
    'orb-temporary': { ...friendly.temporaryOrb, shape: 'outlinedCircle' },
    'enemy-bullet': { ...hostile.enemyBullet, shape: 'centeredCircle' },
    'boss-basic-bullet': { ...hostile.bossBasic, shape: 'centeredCircle' },
    'boss-aimed-bullet': { ...hostile.bossAimed, shape: 'centeredCircle' },
    'boss-falling-hazard': { ...hostile.bossHazard, shape: 'outlinedRoundedRect' },
    'boss-muzzle-flash': { ...hostile.bossMuzzleFlash, shape: 'flash' },
    'siege-laser': {
      fill: 0xff355d,
      accent: 0xffd6df,
      width: GAME_TUNING.projectiles.siegeLaser.width,
      height: GAME_HEIGHT,
      shape: 'outlinedRoundedRect',
      deferred: true,
    },
    'siege-body': {
      fill: 0x30264f,
      accent: 0xc58cff,
      width: 210,
      height: 120,
      shape: 'outlinedRoundedRect',
      deferred: true,
    },
    'siege-left-weakpoint': {
      fill: 0x8a2b61,
      accent: 0xff87be,
      width: 32,
      height: 62,
      shape: 'outlinedRoundedRect',
      deferred: true,
    },
    'siege-right-weakpoint': {
      fill: 0x8a2b61,
      accent: 0xff87be,
      width: 32,
      height: 62,
      shape: 'outlinedRoundedRect',
      deferred: true,
    },
    'siege-core': {
      fill: 0xff355d,
      accent: 0xffffff,
      width: 42,
      height: 42,
      shape: 'outlinedCircle',
      deferred: true,
    },
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
