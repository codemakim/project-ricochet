import { describe, expect, it } from 'vitest';
import {
  selectAbilityOptions,
  xpForEnemy,
  xpRequiredForLevel,
  type AbilityRanks,
} from './progressionRules';

const empty: AbilityRanks = { firepower: 0, kinetic: 0, explosion: 0, split: 0 };

describe('progression rules', () => {
  it('maps enemy kinds to XP and levels to exact costs', () => {
    expect((['basic', 'shooter', 'armored', 'splitter', 'fragment'] as const).map(xpForEnemy))
      .toEqual([1, 2, 3, 1, 1]);
    expect([0, 1, 2, 3, 4].map(xpRequiredForLevel)).toEqual([12, 17, 22, 27, 32]);
  });

  it('returns three unique deterministic first choices with a combat effect', () => {
    const first = selectAbilityOptions(empty, 0, 1234);
    expect(first).toHaveLength(3);
    expect(new Set(first)).toHaveLength(3);
    expect(first.some((id) => id === 'explosion' || id === 'split')).toBe(true);
    expect(selectAbilityOptions(empty, 0, 1234)).toEqual(first);
  });

  it('excludes rank-five abilities and returns only remaining options', () => {
    expect(selectAbilityOptions(
      { firepower: 5, kinetic: 5, explosion: 4, split: 5 },
      19,
      9,
    )).toEqual(['explosion']);
  });
});
