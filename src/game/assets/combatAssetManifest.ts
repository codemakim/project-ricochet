import type Phaser from 'phaser';
import { COMBAT_SOUNDS, MUSIC_KEYS } from '../audio/audioTuning';
import { FUSION_ORB_IDS } from '../orbs/orbFusionRules';
import { ACTOR_SKIN_PROFILES } from '../visuals/actorVisualProfiles';
import { COMBAT_VFX_PROFILES } from '../visuals/combatVfxProfiles';
import { ORB_VISUAL_PROFILES } from '../visuals/orbVisualProfiles';

export type CombatTextureSampling = 'nearest' | 'linear';

export const COMBAT_TEXTURE_FILTER = {
  linear: 0,
  nearest: 1,
} as const satisfies Record<CombatTextureSampling, Phaser.Textures.FilterMode>;

export interface CombatImageAsset {
  key: string;
  url: string;
  sampling: CombatTextureSampling;
}

export interface CombatSheetAsset extends CombatImageAsset {
  frameConfig: { frameWidth: number; frameHeight: number };
}

export type CombatRasterAsset = CombatImageAsset | CombatSheetAsset;

export interface CombatAudioAsset {
  key: string;
  urls: readonly string[];
}

export const COMBAT_STATIC_IMAGE_ASSETS = [
  { key: 'combat-background', url: '/assets/combat/pc/orbital-corridor.webp', sampling: 'linear' },
  { key: 'player', url: '/assets/combat/pc/player.png', sampling: 'linear' },
  { key: 'enemy-basic', url: '/assets/combat/pc/enemy-basic.png', sampling: 'linear' },
  { key: 'enemy-armored', url: '/assets/combat/pc/enemy-armored.png', sampling: 'linear' },
  { key: 'enemy-shooter', url: '/assets/combat/pc/enemy-shooter.png', sampling: 'linear' },
  { key: 'enemy-splitter', url: '/assets/combat/pc/enemy-splitter.png', sampling: 'linear' },
  { key: 'enemy-fragment-left', url: '/assets/combat/pc/enemy-fragment-left.png', sampling: 'linear' },
  { key: 'enemy-fragment-right', url: '/assets/combat/pc/enemy-fragment-right.png', sampling: 'linear' },
  { key: 'boss-body', url: '/assets/combat/pc/sentinel-body.png', sampling: 'linear' },
  { key: 'boss-left-weakpoint', url: '/assets/combat/pc/sentinel-left-weakpoint.png', sampling: 'linear' },
  { key: 'boss-right-weakpoint', url: '/assets/combat/pc/sentinel-right-weakpoint.png', sampling: 'linear' },
  { key: 'boss-core', url: '/assets/combat/pc/sentinel-core.png', sampling: 'linear' },
  { key: 'orb-echo', url: '/assets/combat/sprites/orb-echo.png', sampling: 'linear' },
  { key: 'orb-corrosion', url: '/assets/combat/sprites/orb-corrosion.png', sampling: 'linear' },
  { key: 'orb-conduction', url: '/assets/combat/sprites/orb-conduction.png', sampling: 'linear' },
  { key: 'orb-inertia', url: '/assets/combat/sprites/orb-inertia.png', sampling: 'linear' },
  { key: 'orb-split', url: '/assets/combat/sprites/orb-split.png', sampling: 'linear' },
  { key: 'orb-explosion', url: '/assets/combat/sprites/orb-explosion.png', sampling: 'linear' },
  ...FUSION_ORB_IDS.map((id) => ({
    key: `orb-${id}`,
    url: `/assets/combat/sprites/orb-${id}.png`,
    sampling: 'linear' as const,
  })),
  { key: 'orb-temporary', url: '/assets/combat/sprites/projectile-temporary.png', sampling: 'nearest' },
  { key: 'enemy-bullet', url: '/assets/combat/sprites/projectile-enemy.png', sampling: 'nearest' },
  { key: 'boss-basic-bullet', url: '/assets/combat/sprites/projectile-boss.png', sampling: 'nearest' },
  { key: 'boss-aimed-bullet', url: '/assets/combat/sprites/projectile-boss.png', sampling: 'nearest' },
  { key: 'boss-falling-hazard', url: '/assets/combat/sprites/projectile-hazard.png', sampling: 'nearest' },
  { key: 'hud-status-frame', url: '/assets/combat/sprites/hud-status-frame.png', sampling: 'nearest' },
  { key: 'hud-boss-frame', url: '/assets/combat/sprites/hud-boss-frame.png', sampling: 'nearest' },
] as const satisfies readonly CombatImageAsset[];

const ACTOR_SHEET_ASSETS: readonly CombatSheetAsset[] = ACTOR_SKIN_PROFILES.map((profile) => ({
  key: profile.textureKey,
  url: profile.url,
  sampling: profile.url.endsWith('/pc.png') ? 'linear' : 'nearest',
  frameConfig: {
    frameWidth: profile.frameWidth,
    frameHeight: profile.frameHeight,
  },
}));

const ORB_PRESENTATION_ASSETS: readonly CombatRasterAsset[] = Object.values(
  ORB_VISUAL_PROFILES,
).flatMap((profile) => [
  {
    key: profile.bodyTextureKey,
    url: profile.bodyUrl,
    sampling: 'linear' as const,
  },
  ...profile.layers.map((layer): CombatRasterAsset => ({
    key: layer.textureKey,
    url: layer.url,
    sampling: 'linear',
    ...(layer.frameConfig ? { frameConfig: layer.frameConfig } : {}),
  })),
]);

const COMBAT_VFX_ASSETS: readonly CombatSheetAsset[] = Object.values(
  COMBAT_VFX_PROFILES,
).map((profile) => ({
  key: profile.textureKey,
  url: profile.url,
  sampling: 'linear',
  frameConfig: { frameWidth: profile.frameWidth, frameHeight: profile.frameHeight },
}));

export const COMBAT_IMAGE_ASSETS: readonly CombatRasterAsset[] = [
  ...COMBAT_STATIC_IMAGE_ASSETS,
  ...ACTOR_SHEET_ASSETS,
  ...ORB_PRESENTATION_ASSETS,
  ...COMBAT_VFX_ASSETS,
];

export const COMBAT_AUDIO_ASSETS: readonly CombatAudioAsset[] = [
  ...Object.keys(COMBAT_SOUNDS).map((id) => `sfx-${id}`),
  ...MUSIC_KEYS,
].map((key) => ({ key, urls: [`/assets/combat/audio/${key}.wav`] }));

function isSheet(asset: CombatRasterAsset): asset is CombatSheetAsset {
  return 'frameConfig' in asset;
}

export function preloadCombatAssets(scene: Phaser.Scene): void {
  for (const asset of COMBAT_IMAGE_ASSETS) {
    if (isSheet(asset)) scene.load.spritesheet(asset.key, asset.url, asset.frameConfig);
    else scene.load.image(asset.key, asset.url);
  }
  for (const { key, urls } of COMBAT_AUDIO_ASSETS) scene.load.audio(key, [...urls]);
}

export function applyCombatTextureSampling(scene: Phaser.Scene): void {
  for (const { key, sampling } of COMBAT_IMAGE_ASSETS) {
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(COMBAT_TEXTURE_FILTER[sampling]);
  }
}
