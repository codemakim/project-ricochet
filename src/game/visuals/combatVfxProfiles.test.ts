import { describe, expect, it } from 'vitest';
import { REQUIRED_COMBAT_VFX_IDS } from './combatVfxIds';
import { COMBAT_VFX_PROFILES } from './combatVfxProfiles';
import { HOSTILE_ACTION_DEPTH } from '../constants';

describe('combat VFX profiles', () => {
  it('defines exactly one complete bounded profile for every semantic ID', () => {
    expect(Object.keys(COMBAT_VFX_PROFILES).sort())
      .toEqual([...REQUIRED_COMBAT_VFX_IDS].sort());
    for (const id of REQUIRED_COMBAT_VFX_IDS) {
      expect(COMBAT_VFX_PROFILES[id]).toMatchObject({
        id,
        textureKey: `vfx-${id}`,
        frameWidth: 256,
        frameHeight: 256,
        frameCount: 8,
      });
      expect(COMBAT_VFX_PROFILES[id].frameRate).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].durationMs).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].scale).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].maximumConcurrent).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].depth).toBeLessThan(HOSTILE_ACTION_DEPTH);
      expect(COMBAT_VFX_PROFILES[id].alpha).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].alpha).toBeLessThanOrEqual(0.9);
    }
  });

  it('gives authored phenomena enough frames for readable motion', () => {
    expect(COMBAT_VFX_PROFILES['player-launch']).toMatchObject({
      frameCount: 8, durationMs: 240, scale: 0.8, alpha: 0.45, maximumConcurrent: 2,
    });
    expect(COMBAT_VFX_PROFILES['player-recover']).toMatchObject({
      frameCount: 8, durationMs: 280, scale: 1, alpha: 0.48, maximumConcurrent: 2,
    });
    expect(COMBAT_VFX_PROFILES['player-hit']).toMatchObject({
      frameCount: 8, durationMs: 320, scale: 1.1,
    });
    expect(COMBAT_VFX_PROFILES['player-defeat']).toMatchObject({
      frameCount: 8, durationMs: 900, scale: 1.8,
    });
    expect(COMBAT_VFX_PROFILES['orb-ricochet']).toMatchObject({
      frameCount: 8, durationMs: 240, scale: 0.9,
    });
    expect(COMBAT_VFX_PROFILES['enemy-break']).toMatchObject({
      frameCount: 8, durationMs: 680, scale: 1.5,
    });
    expect(COMBAT_VFX_PROFILES['shooter-charge']).toMatchObject({
      frameCount: 8, durationMs: 720, scale: 1.6,
    });
    expect(COMBAT_VFX_PROFILES['shooter-fire']).toMatchObject({
      frameCount: 8, durationMs: 420, scale: 1.4,
    });
    expect(COMBAT_VFX_PROFILES['armored-brace']).toMatchObject({
      frameCount: 8, durationMs: 600, scale: 1.6,
    });
    expect(COMBAT_VFX_PROFILES['splitter-fracture']).toMatchObject({
      frameCount: 8, durationMs: 600, scale: 1.5,
    });
    expect(COMBAT_VFX_PROFILES['boss-module-break']).toMatchObject({
      frameCount: 8, durationMs: 760, scale: 1.8,
    });
    expect(COMBAT_VFX_PROFILES['boss-core-rage']).toMatchObject({
      frameCount: 8, durationMs: 900, scale: 1.5,
    });
    expect(COMBAT_VFX_PROFILES['enemy-hit']).toMatchObject({
      frameCount: 8, durationMs: 200, scale: 0.9,
    });
    expect(COMBAT_VFX_PROFILES['orb-direct-hit']).toMatchObject({
      frameCount: 8, durationMs: 200, scale: 0.9,
    });
    expect(COMBAT_VFX_PROFILES['corrosion-cloud']).toMatchObject({
      frameCount: 8, durationMs: 800, scale: 1.6,
    });
    expect(COMBAT_VFX_PROFILES['split-burst']).toMatchObject({
      frameCount: 8, durationMs: 520, scale: 1.5,
    });
    expect(COMBAT_VFX_PROFILES['boss-defeat']).toMatchObject({
      frameCount: 8, durationMs: 900, scale: 3.75,
    });
    expect(COMBAT_VFX_PROFILES['conduction-arc']).toMatchObject({
      frameCount: 8, durationMs: 500, scale: 1.25,
    });
    expect(COMBAT_VFX_PROFILES['explosion-burst']).toMatchObject({
      frameCount: 8, durationMs: 560, scale: 1.5,
    });
  });
});
