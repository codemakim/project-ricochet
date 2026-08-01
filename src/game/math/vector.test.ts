import { describe, expect, it } from 'vitest';
import { distanceToSegment, segmentIntersection } from './vector';

describe('segment math', () => {
  it('measures a point against the finite segment rather than its infinite line', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    expect(distanceToSegment({ x: 15, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(Math.sqrt(41));
  });

  it('returns the crossing point and rejects parallel segments', () => {
    expect(segmentIntersection(
      { x: 0, y: 0 }, { x: 10, y: 10 },
      { x: 0, y: 10 }, { x: 10, y: 0 },
    )).toEqual({ x: 5, y: 5 });
    expect(segmentIntersection(
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 0, y: 2 }, { x: 10, y: 2 },
    )).toBeNull();
  });
});
