import { describe, expect, it } from 'vitest';
import { capSpeed, consumeCharge, grantCharges, paddleBounce } from './ballRules';

describe('ball rules', () => {
  it('aims a center paddle hit upward', () => {
    expect(paddleBounce(0, 400)).toEqual({ x: 0, y: -400 });
  });

  it('uses paddle offset to aim without becoming horizontal', () => {
    const velocity = paddleBounce(1, 400);
    expect(velocity.x).toBeGreaterThan(0);
    expect(velocity.y).toBeLessThanOrEqual(-100);
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(400, 5);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid bounce speed %s', (speed) => {
    expect(() => paddleBounce(0, speed)).toThrow(RangeError);
  });

  it('grants one extra charge for a center hit', () => {
    expect(grantCharges(0)).toBe(4);
    expect(grantCharges(0.5)).toBe(3);
  });

  it('consumes one charge and applies charged damage', () => {
    expect(consumeCharge(3)).toEqual({ remaining: 2, damageMultiplier: 1.5 });
    expect(consumeCharge(0)).toEqual({ remaining: 0, damageMultiplier: 1 });
  });

  it('caps excessive speed at 820 pixels per second', () => {
    const velocity = capSpeed({ x: 900, y: -900 });
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(820, 5);
  });
});
