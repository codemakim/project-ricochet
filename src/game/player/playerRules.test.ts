import { describe, expect, it } from 'vitest';
import { movePlayer, resolveAim } from './playerRules';

describe('player rules', () => {
  it('moves diagonally without exceeding cardinal speed', () => {
    const next = movePlayer({ x: 225, y: 600 }, { x: 1, y: -1 }, 500);
    expect(next.x).toBeCloseTo(225 + 210 / Math.sqrt(2));
    expect(next.y).toBeCloseTo(600 - 210 / Math.sqrt(2));
  });

  it('clamps the player below the spawn exclusion zone', () => {
    expect(movePlayer({ x: 20, y: 100 }, { x: -1, y: -1 }, 1000)).toEqual({ x: 18, y: 98 });
  });

  it('keeps the last aim when the new vector is zero', () => {
    expect(resolveAim({ x: 0, y: -1 }, { x: 0, y: 0 })).toEqual({ x: 0, y: -1 });
    expect(resolveAim({ x: 0, y: -1 }, { x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
  });
});
