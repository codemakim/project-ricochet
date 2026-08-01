import { describe, expect, it } from 'vitest';
import {
  ORB_CORE_DEFINITIONS,
  ORB_CORE_IDS,
  applyCoreWallBounce,
  coreLaunchSpeedMultiplier,
  coreDirectEffectProfile,
  conductionFlightProfile,
  createOrbCoreState,
  explosionProfile,
  resolveExplosionOutcome,
  resolveCoreDirectHit,
  resolveCoreRecovery,
  splitProfile,
} from './orbCoreRules';

describe('orb core rules', () => {
  it('defines one complete catalog for all six permanent cores', () => {
    expect(ORB_CORE_IDS).toEqual([
      'echo',
      'corrosion',
      'conduction',
      'inertia',
      'split',
      'explosion',
    ]);
    expect(Object.keys(ORB_CORE_DEFINITIONS)).toEqual(ORB_CORE_IDS);
    expect(Object.values(ORB_CORE_DEFINITIONS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '분열 구슬', maximumLevel: 5 }),
        expect.objectContaining({ label: '폭발 구슬', maximumLevel: 5 }),
      ]),
    );
  });

  it('chains conduction on every direct hit', () => {
    expect(resolveCoreDirectHit('conduction', 1, createOrbCoreState()).conductionTriggered)
      .toBe(true);
  });

  it('caps and spends echo stacks on the next direct hit', () => {
    let state = createOrbCoreState();
    for (let bounce = 0; bounce < 7; bounce += 1) {
      state = applyCoreWallBounce('echo', 1, state);
    }

    expect(resolveCoreDirectHit('echo', 1, state)).toMatchObject({
      directDamageBonus: 0.4,
      conductionTriggered: false,
      next: { echoStacks: 0 },
    });
  });

  it('uses level-two echo and inertia values', () => {
    let echo = createOrbCoreState();
    for (let bounce = 0; bounce < 9; bounce += 1) {
      echo = applyCoreWallBounce('echo', 2, echo);
    }
    expect(resolveCoreDirectHit('echo', 2, echo).directDamageBonus).toBeCloseTo(0.7);
    expect(resolveCoreDirectHit('inertia', 2, createOrbCoreState(), 2).directDamageBonus)
      .toBeCloseTo(0.32);
  });

  it('applies the inertia base speed by level', () => {
    expect(coreLaunchSpeedMultiplier('inertia', 1)).toBe(1);
    expect(coreLaunchSpeedMultiplier('inertia', 2)).toBe(1.08);
    expect(coreLaunchSpeedMultiplier('echo', 5)).toBe(1);
  });

  it('builds native and generic split profiles through one merged roll', () => {
    expect(splitProfile('split', 1, null)).toMatchObject({ chance: 0.22, count: 2 });
    expect(splitProfile('echo', 1, { chance: 0.25, cooldownMs: 120, count: 2 }))
      .toMatchObject({ chance: 0.25, count: 2 });
    expect(splitProfile('split', 2, { chance: 0.25, cooldownMs: 120, count: 2 }))
      .toMatchObject({ chance: 0.38, count: 3 });
    expect(splitProfile('echo', 1, null)).toBeNull();
  });

  it('builds native and generic explosion profiles through one clamped roll', () => {
    expect(explosionProfile('explosion', 1, null, 0)).toMatchObject({
      chance: 0.2,
      damage: 0.45,
      radius: 48,
    });
    expect(explosionProfile('echo', 1, {
      chance: 0.3, cooldownMs: 120, damage: 0.5, radius: 50,
    }, 0)).toMatchObject({ chance: 0.3, damage: 0.5, radius: 50 });
    expect(explosionProfile('explosion', 2, {
      chance: 0.99, cooldownMs: 120, damage: 0.5, radius: 50,
    }, 0)).toMatchObject({ chance: 0.99, damage: 0.72, radius: 48 });
  });

  it('tracks explosion pity only on its physical dedicated orb', () => {
    const state = createOrbCoreState();
    const failed = resolveExplosionOutcome('explosion', state, false);
    expect(failed.explosionFailures).toBe(1);
    expect(explosionProfile('explosion', 3, null, failed.explosionFailures)?.chance)
      .toBeCloseTo(0.25);
    expect(resolveExplosionOutcome('explosion', failed, true).explosionFailures).toBe(0);
    expect(resolveExplosionOutcome('echo', state, false).explosionFailures).toBe(0);
  });

  it('rejects core levels outside one through five', () => {
    expect(() => splitProfile('split', 0, null)).toThrow('core level');
    expect(() => explosionProfile('explosion', 6, null, 0)).toThrow('core level');
  });

  it('unlocks echo shockwave, cutter, and bounded path replay by level', () => {
    expect(coreDirectEffectProfile('echo', 2, true, 7)).toMatchObject({
      shockwave: null,
      replayPath: false,
    });
    expect(coreDirectEffectProfile('echo', 3, true, 7).shockwave).toEqual({
      radius: 44,
      damage: 0.5,
    });
    expect(coreDirectEffectProfile('echo', 5, true, 9)).toMatchObject({
      replayPath: true,
    });
  });

  it('unlocks inertia precision effects without wall-hit ambiguity', () => {
    expect(coreDirectEffectProfile('inertia', 3, false, 0).shockwave).toBeNull();
    expect(coreDirectEffectProfile('inertia', 3, true, 0).shockwave).toEqual({
      radius: 42,
      damage: 0.5,
    });
    expect(coreDirectEffectProfile('inertia', 5, true, 0)).toMatchObject({
      holdTopSpeedMs: 800,
      pierce: true,
      kineticExplosion: { radius: 40, damage: 0.6 },
    });
  });

  it('scales conduction direct and flight links by level', () => {
    expect(coreDirectEffectProfile('conduction', 1, false, 0).chain).toEqual({
      targets: 1,
      radius: 120,
      damage: 0.25,
      overchargeDamage: 0,
    });
    expect(coreDirectEffectProfile('conduction', 5, false, 0).chain).toEqual({
      targets: 3,
      radius: 180,
      damage: 0.35,
      overchargeDamage: 0.35,
    });
    expect(conductionFlightProfile(2)).toBeNull();
    expect(conductionFlightProfile(3)).toEqual({ targets: 1, radius: 150, tickMs: 600, damage: 0.08 });
    expect(conductionFlightProfile(4)).toEqual({ targets: 2, radius: 180, tickMs: 400, damage: 0.1 });
  });

  it('clears echo resonance on every recovery source', () => {
    const resonating = {
      ...createOrbCoreState(),
      echoStacks: 4,
    };

    expect(resolveCoreRecovery('echo', resonating, 'proximity').echoStacks).toBe(0);
    expect(resolveCoreRecovery('echo', resonating, 'timeoutRecall').echoStacks).toBe(0);
  });
});
