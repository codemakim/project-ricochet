import { describe, expect, it } from 'vitest';
import { fragmentSpecsAt, populationCostForEnemy } from './splitterRules';

describe('splitter rules', () => {
  it('spawns fragments symmetrically around a centered splitter', () => {
    expect(fragmentSpecsAt({ x: 225, y: 180 }, 8)).toEqual([
      { kind: 'fragment', hp: 1, x: 213, y: 180, column: -1, speed: 8 },
      { kind: 'fragment', hp: 1, x: 237, y: 180, column: -1, speed: 8 },
    ]);
  });

  it('keeps fragments inside the left and right edges', () => {
    expect(fragmentSpecsAt({ x: 0, y: 180 }, 8).every(({ x }) => x >= 11)).toBe(true);
    expect(fragmentSpecsAt({ x: 450, y: 180 }, 8).every(({ x }) => x <= 439)).toBe(true);
  });

  it('counts splitters as two population and fragments as one', () => {
    expect(populationCostForEnemy('splitter')).toBe(2);
    expect(populationCostForEnemy('fragment')).toBe(1);
  });
});
