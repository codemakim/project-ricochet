import { describe, expect, it } from 'vitest';
import { pointerRole, stickVector } from './pointerRoles';

describe('dual-stick pointer roles', () => {
  it('assigns left touches to movement and right touches to aim', () => {
    expect(pointerRole(100)).toBe('move');
    expect(pointerRole(350)).toBe('aim');
  });

  it('normalizes stick displacement outside its radius', () => {
    expect(stickVector({ x: 0, y: 0 }, { x: 100, y: 0 }, 48)).toEqual({ x: 1, y: 0 });
    expect(stickVector({ x: 0, y: 0 }, { x: 12, y: -24 }, 48)).toEqual({ x: 0.25, y: -0.5 });
  });
});
