/// <reference types="vite/client" />

import { describe, expect, it, vi } from 'vitest';
import {
  COMBAT_AUDIO_ASSETS,
  COMBAT_IMAGE_ASSETS,
  COMBAT_TEXTURE_FILTER,
  applyCombatTextureSampling,
  preloadCombatAssets,
} from './combatAssetManifest';
import {
  FALLBACK_COMBAT_TEXTURE_KEYS,
  missingCombatTextureKeys,
} from './createCombatFallbackTextures';

describe('combat asset manifest', () => {
  it('uses one unique runtime path per production image key', () => {
    const keys = COMBAT_IMAGE_ASSETS.map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining([
      'combat-background', 'player',
      'enemy-basic', 'enemy-armored', 'enemy-shooter',
      'boss-body', 'boss-left-weakpoint', 'boss-right-weakpoint', 'boss-core',
      'orb-echo', 'orb-corrosion', 'orb-conduction',
      'orb-inertia', 'orb-split', 'orb-explosion',
      'hud-status-frame', 'hud-boss-frame',
    ]));
  });

  it('preloads images and audio through Phaser loader methods', () => {
    const image = vi.fn();
    const audio = vi.fn();
    preloadCombatAssets({ load: { image, audio } } as never);
    expect(image).toHaveBeenCalledTimes(COMBAT_IMAGE_ASSETS.length);
    expect(audio).toHaveBeenCalledTimes(COMBAT_AUDIO_ASSETS.length);
  });

  it('assigns nearest sampling to pixel art and keeps linear available for smooth effects', () => {
    expect(COMBAT_TEXTURE_FILTER).toEqual({ linear: 0, nearest: 1 });
    expect(COMBAT_IMAGE_ASSETS.every(({ sampling }) => sampling === 'nearest')).toBe(true);
  });

  it('applies sampling only to loaded production textures', () => {
    const setFilter = vi.fn();
    const exists = vi.fn((key: string) => key === 'player');
    const get = vi.fn(() => ({ setFilter }));
    applyCombatTextureSampling({ textures: { exists, get } } as never);
    expect(get).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith('player');
    expect(setFilter).toHaveBeenCalledWith(COMBAT_TEXTURE_FILTER.nearest);
  });

  it('returns only missing fallback keys', () => {
    const loaded = new Set(FALLBACK_COMBAT_TEXTURE_KEYS.slice(1));
    expect(missingCombatTextureKeys((key) => loaded.has(key)))
      .toEqual([FALLBACK_COMBAT_TEXTURE_KEYS[0]]);
  });

  it('ships the arena, player, and common enemy files', () => {
    const shippedAssets = new Set(Object.keys(import.meta.glob('/public/assets/combat/**/*')));
    const taskKeys = new Set([
      'combat-background', 'player',
      'enemy-basic', 'enemy-armored', 'enemy-shooter',
    ]);
    for (const { key, url } of COMBAT_IMAGE_ASSETS.filter(({ key }) => taskKeys.has(key))) {
      expect(shippedAssets.has(`/public${url}`), url).toBe(true);
    }
  });
});
