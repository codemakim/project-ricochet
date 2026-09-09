import { describe, expect, it } from 'vitest';
import {
  FORMATION_COLUMNS,
  footprintWorldRect,
  occupyFootprint,
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

  it('rejects footprints outside six columns or the chunk rows', () => {
    expect(FORMATION_COLUMNS).toBe(6);
    expect(() => validateFootprint(
      { column: 5, row: 0, width: 2, height: 1 },
      3,
    )).toThrow('formation footprint is outside the grid');
  });

  it('converts adjacent occupied cells to touching world rectangles', () => {
    expect(footprintWorldRect(
      { column: 1, row: 2, width: 2, height: 1 },
      80,
    )).toEqual({ x: 155, y: 230, width: 140, height: 60 });

    const left = footprintWorldRect({ column: 0, row: 0, width: 1, height: 1 }, 0);
    const right = footprintWorldRect({ column: 1, row: 0, width: 1, height: 1 }, 0);
    expect(left.x + left.width / 2).toBe(right.x - right.width / 2);
  });
});
