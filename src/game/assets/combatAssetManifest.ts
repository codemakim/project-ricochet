import type Phaser from 'phaser';

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

export interface CombatAudioAsset {
  key: string;
  urls: readonly [ogg: string, mp3: string];
}

export const COMBAT_IMAGE_ASSETS = [
  { key: 'combat-background', url: '/assets/combat/backgrounds/scrapyard-arena.webp', sampling: 'nearest' },
  { key: 'player', url: '/assets/combat/sprites/player.png', sampling: 'nearest' },
  { key: 'enemy-basic', url: '/assets/combat/sprites/enemy-basic.png', sampling: 'nearest' },
  { key: 'enemy-armored', url: '/assets/combat/sprites/enemy-armored.png', sampling: 'nearest' },
  { key: 'enemy-shooter', url: '/assets/combat/sprites/enemy-shooter.png', sampling: 'nearest' },
  { key: 'boss-body', url: '/assets/combat/sprites/sentinel-body.png', sampling: 'nearest' },
  { key: 'boss-left-weakpoint', url: '/assets/combat/sprites/sentinel-left-weakpoint.png', sampling: 'nearest' },
  { key: 'boss-right-weakpoint', url: '/assets/combat/sprites/sentinel-right-weakpoint.png', sampling: 'nearest' },
  { key: 'boss-core', url: '/assets/combat/sprites/sentinel-core.png', sampling: 'nearest' },
  { key: 'orb-echo', url: '/assets/combat/sprites/orb-echo.png', sampling: 'nearest' },
  { key: 'orb-corrosion', url: '/assets/combat/sprites/orb-corrosion.png', sampling: 'nearest' },
  { key: 'orb-conduction', url: '/assets/combat/sprites/orb-conduction.png', sampling: 'nearest' },
  { key: 'orb-inertia', url: '/assets/combat/sprites/orb-inertia.png', sampling: 'nearest' },
  { key: 'orb-split', url: '/assets/combat/sprites/orb-split.png', sampling: 'nearest' },
  { key: 'orb-explosion', url: '/assets/combat/sprites/orb-explosion.png', sampling: 'nearest' },
  { key: 'hud-status-frame', url: '/assets/combat/sprites/hud-status-frame.png', sampling: 'nearest' },
  { key: 'hud-boss-frame', url: '/assets/combat/sprites/hud-boss-frame.png', sampling: 'nearest' },
] as const satisfies readonly CombatImageAsset[];

export const COMBAT_AUDIO_ASSETS: readonly CombatAudioAsset[] = [];

export function preloadCombatAssets(scene: Phaser.Scene): void {
  for (const { key, url } of COMBAT_IMAGE_ASSETS) scene.load.image(key, url);
  for (const { key, urls } of COMBAT_AUDIO_ASSETS) scene.load.audio(key, [...urls]);
}

export function applyCombatTextureSampling(scene: Phaser.Scene): void {
  for (const { key, sampling } of COMBAT_IMAGE_ASSETS) {
    if (!scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(COMBAT_TEXTURE_FILTER[sampling]);
  }
}
