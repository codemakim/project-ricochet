import { describe, expect, it } from 'vitest';
import { BuildState } from './BuildState';

describe('BuildState', () => {
  it('derives exact firepower and kinetic values', () => {
    const build = new BuildState();
    for (let rank = 1; rank <= 5; rank += 1) {
      build.upgrade('firepower');
      build.upgrade('kinetic');
      expect(build.directDamageBonus()).toBe(rank * 0.25);
      expect(build.chargedSpeed()).toBe(400 + rank * 40);
    }
  });

  it('derives exact explosion and split tables', () => {
    const build = new BuildState();
    const explosions = [
      { radius: 48, damage: 0.5 },
      { radius: 56, damage: 0.75 },
      { radius: 64, damage: 1 },
      { radius: 72, damage: 1.25 },
      { radius: 80, damage: 1.5 },
    ];
    const splitCounts = [1, 1, 2, 2, 3];
    for (let rank = 0; rank < 5; rank += 1) {
      build.upgrade('explosion');
      build.upgrade('split');
      expect(build.explosion()).toEqual(explosions[rank]);
      expect(build.splitCount()).toBe(splitCounts[rank]);
    }
  });

  it('rejects a sixth rank', () => {
    const build = new BuildState({ firepower: 5, kinetic: 0, explosion: 0, split: 0 });
    expect(() => build.upgrade('firepower')).toThrow('firepower is already rank 5');
  });
});
