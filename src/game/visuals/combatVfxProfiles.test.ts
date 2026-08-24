import { describe, expect, it } from 'vitest';
import { REQUIRED_COMBAT_VFX_IDS } from './combatVfxIds';
import { COMBAT_VFX_PROFILES } from './combatVfxProfiles';

describe('combat VFX profiles', () => {
  it('defines exactly one complete bounded profile for every semantic ID', () => {
    expect(Object.keys(COMBAT_VFX_PROFILES).sort())
      .toEqual([...REQUIRED_COMBAT_VFX_IDS].sort());
    for (const id of REQUIRED_COMBAT_VFX_IDS) {
      expect(COMBAT_VFX_PROFILES[id]).toMatchObject({
        id,
        textureKey: `vfx-${id}`,
        frameWidth: 64,
        frameHeight: 64,
        frameCount: 4,
      });
      expect(COMBAT_VFX_PROFILES[id].frameRate).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].durationMs).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].scale).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].maximumConcurrent).toBeGreaterThan(0);
    }
  });
});
