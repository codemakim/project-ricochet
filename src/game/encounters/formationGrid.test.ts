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

  it('rejects footprints outside five columns or the chunk rows', () => {
    expect(FORMATION_COLUMNS).toBe(5);
    expect(() => validateFootprint(
      { column: 4, row: 0, width: 2, height: 1 },
      3,
    )).toThrow('formation footprint is outside the grid');
  });

  it('converts adjacent occupied cells to touching world rectangles', () => {
    expect(footprintWorldRect(
      { column: 1, row: 2, width: 2, height: 1 },
      80,
    )).toEqual({ x: 183, y: 260, width: 168, height: 72 });

    const left = footprintWorldRect({ column: 0, row: 0, width: 1, height: 1 }, 0);
    const right = footprintWorldRect({ column: 1, row: 0, width: 1, height: 1 }, 0);
    expect(left.x + left.width / 2).toBe(right.x - right.width / 2);
  });

  it('reserves paired straight, turning, and pocket passages', () => {
    expect([...reservedPassageCells(3, 0, 0)].sort()).toEqual(['0:1', '1:1', '2:1']);
    expect([...reservedPassageCells(3, 2, 0)].sort()).toEqual(['0:3', '1:2', '1:3', '2:2']);
    expect([...reservedPassageCells(3, 4, 0)].sort())
      .toEqual(['0:2', '0:3', '1:2', '1:3', '2:2']);
    expect(reservedPassageCells(3, 0, 3)).toEqual(reservedPassageCells(3, 1, 3));
  });
});
