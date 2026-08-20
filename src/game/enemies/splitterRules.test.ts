import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { fragmentSpecsFor, populationCostForEnemy } from './splitterRules';

describe('splitter rules', () => {
  it('spawns fragments symmetrically around a centered splitter', () => {
    expect(fragmentSpecsFor({
      x: 225, y: 180, column: 3, row: 2, speed: 8,
    })).toEqual([
      {
        kind: 'fragment', side: 'left', hp: 2, x: 309, y: 180,
        column: 3, row: 2, width: 1, height: 1, speed: 8,
      },
      {
        kind: 'fragment', side: 'right', hp: 2, x: 393, y: 180,
        column: 4, row: 2, width: 1, height: 1, speed: 8,
      },
    ]);
  });

  it('keeps fragments inside the left and right edges', () => {
    expect(fragmentSpecsFor({
      x: 0, y: 180, column: 0, row: 2, speed: 8,
    }).map(({ x }) => x)).toEqual([57, 141]);
    const right = fragmentSpecsFor({
      x: 450, y: 180, column: 6, row: 2, speed: 8,
    });
    expect(right.map(({ x }) => x)).toEqual([309, 393]);
    expect(right.map(({ column }) => column)).toEqual([3, 4]);
  });

  it('places rowless fragments side by side inside the five-column arena', () => {
    const fragments = fragmentSpecsFor({
      x: 225, y: 180, column: -1, row: -1, speed: 8,
    });

    expect(fragments.map(({ x }) => x)).toEqual([183, 267]);
    expect(fragments[1]!.x - fragments[0]!.x)
      .toBe(GAME_TUNING.encounter.grid.cellWidth);
    expect(fragmentSpecsFor({
      x: 0, y: 180, column: -1, row: -1, speed: 8,
    }).map(({ x }) => x)).toEqual([42, 126]);
    expect(fragmentSpecsFor({
      x: 450, y: 180, column: -1, row: -1, speed: 8,
    }).map(({ x }) => x)).toEqual([324, 408]);
  });

  it('counts splitters as two population and fragments as one', () => {
    expect(populationCostForEnemy('splitter')).toBe(2);
    expect(populationCostForEnemy('fragment')).toBe(1);
  });
});
