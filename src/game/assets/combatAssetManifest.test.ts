import { describe, expect, it, vi } from 'vitest';
import {
  COMBAT_AUDIO_ASSETS,
  COMBAT_IMAGE_ASSETS,
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

  it('returns only missing fallback keys', () => {
    const loaded = new Set(FALLBACK_COMBAT_TEXTURE_KEYS.slice(1));
    expect(missingCombatTextureKeys((key) => loaded.has(key)))
      .toEqual([FALLBACK_COMBAT_TEXTURE_KEYS[0]]);
  });
});
