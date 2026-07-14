import { describe, expect, it } from 'vitest';
import { createReinforcementFormation } from './formationRules';

describe('reinforcement formations', () => {
  it.each([
    [0, 8],
    [1, 10],
    [2, 12],
  ] as const)('creates phase %i with %i enemies', (phase, size) => {
    const formation = createReinforcementFormation(phase, 0);
    expect(formation).toHaveLength(size);
    expect(formation.every((enemy) => enemy.speed === 18)).toBe(true);
    expect(formation.every((enemy) => enemy.y <= 14)).toBe(true);
    expect(formation.every((enemy) => enemy.x >= 36 && enemy.x <= 414)).toBe(true);
  });

  it('raises special-enemy pressure by phase', () => {
    const specialCount = (phase: 0 | 1 | 2) => createReinforcementFormation(phase, 0)
      .filter((enemy) => enemy.kind !== 'basic').length;
    expect(specialCount(0)).toBeLessThan(specialCount(1));
    expect(specialCount(1)).toBeLessThanOrEqual(specialCount(2));
  });

  it('is deterministic and changes layout by sequence', () => {
    expect(createReinforcementFormation(1, 3)).toEqual(createReinforcementFormation(1, 3));
    expect(createReinforcementFormation(1, 3)).not.toEqual(createReinforcementFormation(1, 4));
  });

  it('rejects invalid sequences', () => {
    expect(() => createReinforcementFormation(0, -1)).toThrow(
      'sequence must be a non-negative integer',
    );
  });
});
