import { describe, expect, it } from 'vitest';
import { BuildState } from './BuildState';

describe('BuildState', () => {
  it('derives exact firepower and kinetic values within their rank caps', () => {
    const build = new BuildState();
    for (let rank = 1; rank <= 5; rank += 1) {
      build.upgrade('firepower');
      expect(build.directDamageBonus()).toBe(rank * 0.25);
    }
    for (let rank = 1; rank <= 3; rank += 1) {
      build.upgrade('kinetic');
      expect(build.chargedSpeed()).toBe(400 + rank * 40);
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
});
