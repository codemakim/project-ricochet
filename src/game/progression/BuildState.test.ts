import { describe, expect, it } from 'vitest';
import { BuildState } from './BuildState';

describe('BuildState', () => {
  it('derives exact firepower and kinetic values within their rank caps', () => {
    const build = new BuildState();
    for (let rank = 1; rank <= 5; rank += 1) {
      build.upgrade('firepower');
      expect(build.directDamageBonus()).toBeCloseTo(rank * 0.12);
    }
    for (let rank = 1; rank <= 3; rank += 1) {
      build.upgrade('kinetic');
      expect(build.chargedSpeed()).toBeCloseTo(400 * (1 + rank * 0.07));
    }
    expect(() => build.upgrade('kinetic')).toThrow('kinetic is already rank 3');
  });

  it('unlocks fixed explosion and split specs once', () => {
    const build = new BuildState();
    expect(build.explosion()).toBeNull();
    expect(build.split()).toBeNull();

    build.upgrade('explosion');
    build.upgrade('split');

    expect(build.explosion()).toEqual({
      chance: 0.2,
      cooldownMs: 120,
      radius: 48,
      damage: 0.45,
    });
    expect(build.split()).toEqual({
      chance: 0.25,
      cooldownMs: 120,
      count: 2,
    });
    expect(() => build.upgrade('explosion')).toThrow('explosion is already rank 1');
    expect(() => build.upgrade('split')).toThrow('split is already rank 1');
    expect(build.ownedAbilityKindCount()).toBe(2);
  });

  it('rejects a sixth rank', () => {
    const build = new BuildState({ firepower: 5, kinetic: 0, explosion: 0, split: 0 });
    expect(() => build.upgrade('firepower')).toThrow('firepower is already rank 5');
    expect(() => new BuildState({ kinetic: 4 })).toThrow(
      'kinetic rank must be an integer from 0 through 3',
    );
    expect(() => new BuildState({ explosion: 2 })).toThrow(
      'explosion rank must be an integer from 0 through 1',
    );
  });

  it('combines near, precision, and excess-speed direct-hit bonuses', () => {
    const build = new BuildState({
      'near-amplification': 2,
      'precision-hit': 1,
      'kinetic-conversion': 1,
    });

    expect(build.conditionalDirectDamageBonus({
      distanceFromPlayer: 150,
      wallHits: 0,
      speed: 480,
    })).toBeCloseTo(0.62);
    expect(build.conditionalDirectDamageBonus({
      distanceFromPlayer: 151,
      wallHits: 1,
      speed: 400,
    })).toBe(0);
  });

  it('caps wall acceleration at five stacks', () => {
    const build = new BuildState({ 'wall-acceleration': 2 });

    expect(build.wallSpeedMultiplier(1)).toBeCloseTo(1.08);
    expect(build.wallSpeedMultiplier(7)).toBeCloseTo(1.4);
  });

  it('unlocks trigger weapons and ranks recovery shockwave damage twice', () => {
    const build = new BuildState({
      'horizontal-cutter': 1,
      'vertical-cutter': 1,
      'destruction-reaction': 1,
      'micro-missile': 1,
      'recovery-shockwave': 2,
    });

    expect(build.horizontalCutter()).toMatchObject({ chance: 0.15, damage: 0.7 });
    expect(build.verticalCutter()).toMatchObject({ chance: 0.15, damage: 0.7 });
    expect(build.destructionReaction()).toMatchObject({ chance: 0.25, radius: 56, damage: 0.8 });
    expect(build.microMissile()).toMatchObject({ hitsRequired: 6, damage: 1.2 });
    expect(build.recoveryShockwave()).toMatchObject({ recoveriesRequired: 4, radius: 72, damage: 1.25 });
  });

  it('derives all basic growth stats from their ranks', () => {
    const build = new BuildState({
      'additional-core': 2,
      'core-expansion': 2,
      'recovery-field': 3,
      'mobility-motor': 2,
      'armor-reinforcement': 3,
    });

    expect(build.orbLimit(3)).toBe(5);
    expect(build.orbLimit(5)).toBe(6);
    expect(build.orbRadius()).toBeCloseTo(8 * 1.16);
    expect(build.recoveryRadius()).toBe(74);
    expect(build.playerSpeed()).toBeCloseTo(420 * 1.16);
    expect(build.maximumHealth()).toBe(13);
  });

  it('derives direct-hit flight bonuses without affecting inactive states', () => {
    const build = new BuildState({
      'reload-overcharge': 2,
      'consecutive-impact': 3,
      'kill-overclock': 2,
      'collision-acceleration': 2,
      'tracking-magnet': 2,
      'high-speed-impact': 1,
    });

    expect(build.conditionalDirectDamageBonus({
      distanceFromPlayer: 999,
      wallHits: 1,
      speed: 400,
      firstHitAfterProximity: true,
      consecutiveHits: 3,
      killOverclockActive: true,
    })).toBeCloseTo(0.86);
    expect(build.flightSpeedMultiplier(true, true)).toBeCloseTo(1.32);
    expect(build.trackingRadiusBonus(true)).toBe(32);
    expect(build.trackingRadiusBonus(false)).toBe(0);
    expect(build.highSpeedImpact()).toEqual({
      speedRatio: 1.3,
      hitsRequired: 5,
      radius: 44,
      damage: 0.65,
    });
  });
});
