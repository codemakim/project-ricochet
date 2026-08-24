import type Phaser from 'phaser';
import { FUSION_ORB_IDS } from '../orbs/orbFusionRules';
import { ACTOR_SKIN_PROFILES } from '../visuals/actorVisualProfiles';
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
  urls: readonly [ogg: string, mp3: string];
}

export const COMBAT_STATIC_IMAGE_ASSETS = [
  { key: 'combat-background', url: '/assets/combat/backgrounds/scrapyard-arena.webp', sampling: 'nearest' },
  { key: 'player', url: '/assets/combat/sprites/player.png', sampling: 'nearest' },
  { key: 'enemy-basic', url: '/assets/combat/sprites/enemy-basic.png', sampling: 'nearest' },
  { key: 'enemy-armored', url: '/assets/combat/sprites/enemy-armored.png', sampling: 'nearest' },
  { key: 'enemy-shooter', url: '/assets/combat/sprites/enemy-shooter.png', sampling: 'nearest' },
  { key: 'enemy-splitter', url: '/assets/combat/sprites/enemy-splitter.png', sampling: 'nearest' },
  { key: 'enemy-fragment-left', url: '/assets/combat/sprites/enemy-fragment-left.png', sampling: 'nearest' },
  { key: 'enemy-fragment-right', url: '/assets/combat/sprites/enemy-fragment-right.png', sampling: 'nearest' },
  { key: 'boss-body', url: '/assets/combat/sprites/sentinel-body.png', sampling: 'nearest' },
  { key: 'boss-left-weakpoint', url: '/assets/combat/sprites/sentinel-left-weakpoint.png', sampling: 'nearest' },
  { key: 'boss-right-weakpoint', url: '/assets/combat/sprites/sentinel-right-weakpoint.png', sampling: 'nearest' },
  { key: 'boss-core', url: '/assets/combat/sprites/sentinel-core.png', sampling: 'nearest' },
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
  sampling: 'nearest',
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

export const COMBAT_IMAGE_ASSETS: readonly CombatRasterAsset[] = [
  ...COMBAT_STATIC_IMAGE_ASSETS,
  ...ACTOR_SHEET_ASSETS,
  ...ORB_PRESENTATION_ASSETS,
];

export const COMBAT_AUDIO_ASSETS: readonly CombatAudioAsset[] = [];

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
