import { describe, expect, it } from 'vitest';
import {
  ABILITY_MAX_RANKS,
  canAcquireNewAbility,
  eligibleAbilityIds,
  prerequisitesMet,
  MAX_BUILD_LEVEL,
  selectAbilityOptions,
  xpForEnemy,
  xpRequiredForLevel,
  createEmptyAbilityRanks,
  type AbilityRanks,
} from './progressionRules';

const empty: AbilityRanks = createEmptyAbilityRanks();

describe('progression rules', () => {
  it('defines the approved rank caps and resulting maximum build level', () => {
    expect(ABILITY_MAX_RANKS).toEqual({
      firepower: 5,
      kinetic: 3,
      explosion: 1,
      split: 1,
      'near-amplification': 3,
      'precision-hit': 3,
      'kinetic-conversion': 3,
      'wall-acceleration': 3,
      'horizontal-cutter': 1,
      'vertical-cutter': 1,
      'destruction-reaction': 1,
      'micro-missile': 1,
      'recovery-shockwave': 2,
      'additional-core': 3,
      'core-expansion': 2,
      'recovery-field': 3,
      'mobility-motor': 2,
      'armor-reinforcement': 3,
      'reload-overcharge': 3,
      'consecutive-impact': 3,
      'kill-overclock': 3,
      'collision-acceleration': 2,
      'tracking-magnet': 2,
      'high-speed-impact': 1,
    });
    expect(MAX_BUILD_LEVEL).toBe(55);
  });

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

  it('excludes abilities at their individual rank caps', () => {
    expect(eligibleAbilityIds(
      { ...empty, firepower: 5, kinetic: 3, explosion: 0, split: 1 },
    )).toContain('explosion');
  });

  it('blocks new ability kinds at the run cap but keeps owned upgrades eligible', () => {
    expect(canAcquireNewAbility(11)).toBe(true);
    expect(canAcquireNewAbility(12)).toBe(false);
    expect(canAcquireNewAbility(13)).toBe(false);

    const cappedKinds = {
      ...empty,
      firepower: 1,
      kinetic: 1,
      explosion: 1,
      split: 1,
      'near-amplification': 1,
      'precision-hit': 1,
      'kinetic-conversion': 1,
      'wall-acceleration': 1,
      'horizontal-cutter': 1,
      'vertical-cutter': 1,
      'destruction-reaction': 1,
      'recovery-shockwave': 1,
    };
    expect(selectAbilityOptions(cappedKinds, 12, 44)).not.toContain('micro-missile');
    expect(selectAbilityOptions(cappedKinds, 12, 44)).toContain('firepower');
  });

  it('requires every related ability before an option becomes eligible', () => {
    expect(prerequisitesMet(['split'], empty)).toBe(false);
    expect(prerequisitesMet(['split'], { ...empty, split: 1 })).toBe(true);
  });
});
