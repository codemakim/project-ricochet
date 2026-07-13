import { describe, expect, it } from 'vitest';
import { traceFirstBounce } from './trajectory';

describe('first-bounce trajectory', () => {
  it('hits the top wall then draws one reflected segment', () => {
    const [origin, hit, end] = traceFirstBounce({ x: 225, y: 600 }, { x: 1, y: -3 }, 8, 90);

    expect(origin).toEqual({ x: 225, y: 600 });
    expect(hit.y).toBe(8);
    expect(end.y).toBeGreaterThan(hit.y);
    expect(Math.hypot(end.x - hit.x, end.y - hit.y)).toBeCloseTo(90);
  });

  it('uses the side wall when it is reached first', () => {
    const [, hit] = traceFirstBounce({ x: 225, y: 600 }, { x: 1, y: 0 }, 8, 90);

    expect(hit).toEqual({ x: 442, y: 600 });
  });

  it('rejects a negative inset', () => {
    expect(() => traceFirstBounce({ x: 225, y: 600 }, { x: 1, y: 0 }, -1, 90)).toThrow(RangeError);
  });

  it.each([0, -1])('rejects reflection length %s', (reflectionLength) => {
    expect(() => traceFirstBounce({ x: 225, y: 600 }, { x: 1, y: 0 }, 8, reflectionLength)).toThrow(
      RangeError,
    );
  });
});
