import { describe, expect, it } from 'vitest';
import { canReleaseFormation, formationDepleted } from './encounterRules';

describe('encounter rules', () => {
  it('depletes a formation at the exact surviving-population boundary', () => {
    expect(formationDepleted(10, 3)).toBe(true);
    expect(formationDepleted(10, 4)).toBe(false);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid initial population %s',
    (initial) => {
      expect(() => formationDepleted(initial, 0))
        .toThrow('initial population must be finite and positive');
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid remaining population %s',
    (remaining) => {
      expect(() => formationDepleted(10, remaining))
        .toThrow('remaining population must be finite and non-negative');
    },
  );

  it('releases only when active and incoming population fit the cap', () => {
    expect(canReleaseFormation(18, 4, 22)).toBe(true);
    expect(canReleaseFormation(19, 4, 22)).toBe(false);
  });
});
