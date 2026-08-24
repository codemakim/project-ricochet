/// <reference types="vite/client" />

import { describe, expect, it, vi } from 'vitest';
import {
  COMBAT_AUDIO_ASSETS,
  COMBAT_IMAGE_ASSETS,
  COMBAT_STATIC_IMAGE_ASSETS,
  COMBAT_TEXTURE_FILTER,
  applyCombatTextureSampling,
  preloadCombatAssets,
} from './combatAssetManifest';
import {
  FALLBACK_COMBAT_TEXTURE_KEYS,
  missingCombatTextureKeys,
} from './createCombatFallbackTextures';
import { FUSION_ORB_IDS } from '../orbs/orbFusionRules';
import { ORB_CORE_IDS } from '../orbs/orbCoreRules';

describe('combat asset manifest', () => {
  it('uses one unique runtime path per production image key', () => {
    const keys = COMBAT_IMAGE_ASSETS.map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining([
      'combat-background', 'player',
      'enemy-basic', 'enemy-armored', 'enemy-shooter',
      'enemy-splitter', 'enemy-fragment-left', 'enemy-fragment-right',
      'boss-body', 'boss-left-weakpoint', 'boss-right-weakpoint', 'boss-core',
      'orb-echo', 'orb-corrosion', 'orb-conduction',
      'orb-inertia', 'orb-split', 'orb-explosion',
      'orb-temporary', 'enemy-bullet',
      'boss-basic-bullet', 'boss-aimed-bullet', 'boss-falling-hazard',
      'hud-status-frame', 'hud-boss-frame',
    ]));
  });

  it('preloads images and audio through Phaser loader methods', () => {
    const image = vi.fn();
    const spritesheet = vi.fn();
    const audio = vi.fn();
    preloadCombatAssets({ load: { image, spritesheet, audio } } as never);
    const sheetCount = COMBAT_IMAGE_ASSETS.filter((asset) => 'frameConfig' in asset).length;
    expect(image).toHaveBeenCalledTimes(COMBAT_IMAGE_ASSETS.length - sheetCount);
    expect(spritesheet).toHaveBeenCalledTimes(sheetCount);
    expect(audio).toHaveBeenCalledTimes(COMBAT_AUDIO_ASSETS.length);
  });

  it('loads actors and framed orb layers as sheets while static layers stay images', () => {
    const image = vi.fn();
    const spritesheet = vi.fn();
    preloadCombatAssets({ load: { image, spritesheet, audio: vi.fn() } } as never);

    expect(spritesheet).toHaveBeenCalledWith(
      'actor-player-default',
      '/assets/combat/actors/player/default.png',
      { frameWidth: 82, frameHeight: 82 },
    );
    expect(spritesheet).toHaveBeenCalledWith(
      'orb-conduction-arc',
      '/assets/combat/orbs/conduction/arc.png',
      { frameWidth: 64, frameHeight: 64 },
    );
    expect(image).toHaveBeenCalledWith(
      'orb-conduction-flow',
      '/assets/combat/orbs/conduction/flow.png',
    );
  });

  it('uses nearest actor sheets and linear permanent-orb presentation', () => {
    expect(COMBAT_TEXTURE_FILTER).toEqual({ linear: 0, nearest: 1 });
    const permanentKeys = new Set([...ORB_CORE_IDS, ...FUSION_ORB_IDS].map((id) => `orb-${id}`));
    for (const asset of COMBAT_IMAGE_ASSETS) {
      if (asset.key.startsWith('actor-')) expect(asset.sampling).toBe('nearest');
      if (asset.key.startsWith('orb-visual-') || permanentKeys.has(asset.key)) {
        expect(asset.sampling).toBe('linear');
      }
    }
  });

  it('declares every runtime texture key exactly once', () => {
    const keys = COMBAT_IMAGE_ASSETS.map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
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

  it('ships every declared production image', () => {
    const shippedAssets = new Set(Object.keys(import.meta.glob('/public/assets/combat/**/*')));
    for (const { url } of COMBAT_STATIC_IMAGE_ASSETS) {
      expect(shippedAssets.has(`/public${url}`), url).toBe(true);
    }
  });

  it('loads one stable production texture for every fusion orb', () => {
    for (const id of FUSION_ORB_IDS) {
      expect(COMBAT_IMAGE_ASSETS).toContainEqual({
        key: `orb-${id}`,
        url: `/assets/combat/sprites/orb-${id}.png`,
        sampling: 'linear',
      });
    }
  });
});
