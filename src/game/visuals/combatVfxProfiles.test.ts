import { describe, expect, it } from 'vitest';
import { REQUIRED_COMBAT_VFX_IDS } from './combatVfxIds';
import { COMBAT_VFX_PROFILES } from './combatVfxProfiles';

describe('combat VFX profiles', () => {
  it('defines exactly one complete bounded profile for every semantic ID', () => {
    const authoredIds = new Set([
      'player-launch', 'player-recover', 'player-hit', 'player-defeat',
      'orb-ricochet', 'enemy-break',
      'enemy-hit', 'orb-direct-hit', 'corrosion-cloud', 'split-burst', 'boss-defeat',
      'conduction-arc', 'explosion-burst',
    ]);
    expect(Object.keys(COMBAT_VFX_PROFILES).sort())
      .toEqual([...REQUIRED_COMBAT_VFX_IDS].sort());
    for (const id of REQUIRED_COMBAT_VFX_IDS) {
      expect(COMBAT_VFX_PROFILES[id]).toMatchObject({
        id,
        textureKey: `vfx-${id}`,
        frameWidth: 64,
        frameHeight: 64,
        frameCount: authoredIds.has(id) ? 8 : 4,
      });
      expect(COMBAT_VFX_PROFILES[id].frameRate).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].durationMs).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].scale).toBeGreaterThan(0);
      expect(COMBAT_VFX_PROFILES[id].maximumConcurrent).toBeGreaterThan(0);
    }
  });

  it('gives authored phenomena enough frames for readable motion', () => {
    expect(COMBAT_VFX_PROFILES['player-launch']).toMatchObject({
      frameCount: 8, durationMs: 420, scale: 1.3,
    });
    expect(COMBAT_VFX_PROFILES['player-recover']).toMatchObject({
      frameCount: 8, durationMs: 520, scale: 1.4,
    });
    expect(COMBAT_VFX_PROFILES['player-hit']).toMatchObject({
      frameCount: 8, durationMs: 480, scale: 1.3,
    });
    expect(COMBAT_VFX_PROFILES['player-defeat']).toMatchObject({
      frameCount: 8, durationMs: 900, scale: 1.8,
    });
    expect(COMBAT_VFX_PROFILES['orb-ricochet']).toMatchObject({
      frameCount: 8, durationMs: 380, scale: 1.25,
    });
    expect(COMBAT_VFX_PROFILES['enemy-break']).toMatchObject({
      frameCount: 8, durationMs: 680, scale: 1.5,
    });
    expect(COMBAT_VFX_PROFILES['enemy-hit']).toMatchObject({
      frameCount: 8, durationMs: 360, scale: 1.25,
    });
    expect(COMBAT_VFX_PROFILES['orb-direct-hit']).toMatchObject({
      frameCount: 8, durationMs: 400, scale: 1.4,
    });
    expect(COMBAT_VFX_PROFILES['corrosion-cloud']).toMatchObject({
      frameCount: 8, durationMs: 800, scale: 1.6,
    });
    expect(COMBAT_VFX_PROFILES['split-burst']).toMatchObject({
      frameCount: 8, durationMs: 520, scale: 1.5,
    });
    expect(COMBAT_VFX_PROFILES['boss-defeat']).toMatchObject({
      frameCount: 8, durationMs: 900, scale: 2.5,
    });
    expect(COMBAT_VFX_PROFILES['conduction-arc']).toMatchObject({
      frameCount: 8, durationMs: 500, scale: 1.25,
    });
    expect(COMBAT_VFX_PROFILES['explosion-burst']).toMatchObject({
      frameCount: 8, durationMs: 560, scale: 1.5,
    });
  });
});
