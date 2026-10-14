import { describe, expect, it } from 'vitest';
import { defaultCombatSandboxSettings, parseCombatSandboxSettings, sandboxEnemies } from './combatSandbox';

describe('combat sandbox', () => {
  it('validates per-core level bounds and finite reproducible settings', () => {
    const settings = defaultCombatSandboxSettings();
    expect(parseCombatSandboxSettings(settings)).toEqual(settings);
    expect(parseCombatSandboxSettings({ ...settings, coreType: 'photon-orbit', orbLevel: 9 }).orbLevel).toBe(9);
    for (const override of [
      { coreType: 'unknown' }, { scenario: 'unknown' }, { enemyKind: 'fragment' },
      { orbLevel: 6 }, { orbCount: 7 }, { orbCount: 1.5 }, { seed: -1 },
      { hpMultiplier: NaN }, { invulnerable: 'true' },
    ]) expect(() => parseCombatSandboxSettings({ ...settings, ...override })).toThrow(RangeError);
  });

  it('creates fixed isolated trial targets with explicit HP scaling', () => {
    const settings = defaultCombatSandboxSettings();
    expect(sandboxEnemies(settings)).toMatchObject([{ kind: 'basic', hp: 1.482, x: 225, y: 220, speed: 0 }]);
    expect(sandboxEnemies({ ...settings, hpMultiplier: 2 })[0]!.hp).toBeCloseTo(2.964);
    const dense = sandboxEnemies({ ...settings, scenario: 'dense' });
    expect(dense).toHaveLength(8);
    expect(dense.every(({ y, speed }) => y > 0 && speed === 0)).toBe(true);
    expect(sandboxEnemies({ ...settings, scenario: 'sentinel' })).toEqual([]);
  });
});
