import { describe, expect, it } from 'vitest';
import {
  FORMATION_COLUMNS,
  footprintWorldRect,
  occupyFootprint,
  reservedPassageCells,
  validateFootprint,
} from './formationGrid';

describe('formation grid', () => {
  it('occupies every cell in a multi-cell rectangle and rejects overlap', () => {
    const occupied = new Set<string>();
    occupyFootprint(occupied, { column: 2, row: 1, width: 2, height: 2 }, 4);

    expect([...occupied].sort()).toEqual(['1:2', '1:3', '2:2', '2:3']);
    expect(() => occupyFootprint(
      occupied,
      { column: 3, row: 2, width: 1, height: 1 },
      4,
    )).toThrow('formation footprints overlap');
  });

  it('rejects footprints outside eight columns or the chunk rows', () => {
    expect(FORMATION_COLUMNS).toBe(8);
    expect(() => validateFootprint(
      { column: 7, row: 0, width: 2, height: 1 },
      3,
    )).toThrow('formation footprint is outside the grid');
  });

  it('converts adjacent cells to one gap-aware world rectangle', () => {
    expect(footprintWorldRect(
      { column: 1, row: 2, width: 2, height: 1 },
      80,
    )).toEqual({ x: 121, y: 200, width: 100, height: 44 });
  });

  it('reserves paired straight, turning, and pocket passages', () => {
    expect([...reservedPassageCells(3, 0, 0)].sort()).toEqual(['0:1', '1:1', '2:1']);
    expect([...reservedPassageCells(3, 2, 0)].sort()).toEqual(['0:4', '1:3', '1:4', '2:3']);
    expect([...reservedPassageCells(3, 4, 0)].sort())
      .toEqual(['0:5', '0:6', '1:5', '1:6', '2:6']);
    expect(reservedPassageCells(3, 0, 3)).toEqual(reservedPassageCells(3, 1, 3));
  });
});
