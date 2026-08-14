import type Phaser from 'phaser';

export interface CombatImageAsset {
  key: string;
  url: string;
}

export interface CombatAudioAsset {
  key: string;
  urls: readonly [ogg: string, mp3: string];
}

export const COMBAT_IMAGE_ASSETS = [
  { key: 'combat-background', url: '/assets/combat/backgrounds/scrapyard-arena.webp' },
  { key: 'player', url: '/assets/combat/sprites/player.png' },
  { key: 'enemy-basic', url: '/assets/combat/sprites/enemy-basic.png' },
  { key: 'enemy-armored', url: '/assets/combat/sprites/enemy-armored.png' },
  { key: 'enemy-shooter', url: '/assets/combat/sprites/enemy-shooter.png' },
  { key: 'boss-body', url: '/assets/combat/sprites/sentinel-body.png' },
  { key: 'boss-left-weakpoint', url: '/assets/combat/sprites/sentinel-left-weakpoint.png' },
  { key: 'boss-right-weakpoint', url: '/assets/combat/sprites/sentinel-right-weakpoint.png' },
  { key: 'boss-core', url: '/assets/combat/sprites/sentinel-core.png' },
  { key: 'orb-echo', url: '/assets/combat/sprites/orb-echo.png' },
  { key: 'orb-corrosion', url: '/assets/combat/sprites/orb-corrosion.png' },
  { key: 'orb-conduction', url: '/assets/combat/sprites/orb-conduction.png' },
  { key: 'orb-inertia', url: '/assets/combat/sprites/orb-inertia.png' },
  { key: 'orb-split', url: '/assets/combat/sprites/orb-split.png' },
  { key: 'orb-explosion', url: '/assets/combat/sprites/orb-explosion.png' },
  { key: 'hud-status-frame', url: '/assets/combat/sprites/hud-status-frame.png' },
  { key: 'hud-boss-frame', url: '/assets/combat/sprites/hud-boss-frame.png' },
] as const satisfies readonly CombatImageAsset[];

export const COMBAT_AUDIO_ASSETS: readonly CombatAudioAsset[] = [];

export function preloadCombatAssets(scene: Phaser.Scene): void {
  for (const { key, url } of COMBAT_IMAGE_ASSETS) scene.load.image(key, url);
  for (const { key, urls } of COMBAT_AUDIO_ASSETS) scene.load.audio(key, [...urls]);
}
