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
});
