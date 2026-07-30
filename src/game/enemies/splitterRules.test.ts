import { describe, expect, it } from 'vitest';
import { fragmentSpecsFor, populationCostForEnemy } from './splitterRules';

describe('splitter rules', () => {
  it('spawns fragments symmetrically around a centered splitter', () => {
    expect(fragmentSpecsFor({
      x: 225, y: 180, column: 3, row: 2, speed: 8,
    })).toEqual([
      {
        kind: 'fragment', side: 'left', hp: 2, x: 199, y: 180,
        column: 3, row: 2, width: 1, height: 1, speed: 8,
      },
      {
        kind: 'fragment', side: 'right', hp: 2, x: 251, y: 180,
        column: 4, row: 2, width: 1, height: 1, speed: 8,
      },
    ]);
  });

  it('keeps fragments inside the left and right edges', () => {
    expect(fragmentSpecsFor({
      x: 0, y: 180, column: 0, row: 2, speed: 8,
    }).every(({ x }) => x >= 24)).toBe(true);
    expect(fragmentSpecsFor({
      x: 450, y: 180, column: 6, row: 2, speed: 8,
    }).every(({ x }) => x <= 426)).toBe(true);
  });

  it('counts splitters as two population and fragments as one', () => {
    expect(populationCostForEnemy('splitter')).toBe(2);
    expect(populationCostForEnemy('fragment')).toBe(1);
  });
});
