import { describe, expect, it } from 'vitest';
import { applyDamage, breachDamage, canTakeDamage, createHealth } from './health';

describe('player health', () => {
  it('starts at ten health with no shield', () => {
    expect(createHealth()).toEqual({ current: 10, maximum: 10, shield: 0, defeated: false });
  });

  it('spends shield before health', () => {
    expect(applyDamage({ current: 10, maximum: 10, shield: 2, defeated: false }, 3))
      .toEqual({ current: 9, maximum: 10, shield: 0, defeated: false });
  });

  it('marks zero health as defeated', () => {
    expect(applyDamage(createHealth(), 10).defeated).toBe(true);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid damage %s', (amount) => {
    expect(() => applyDamage(createHealth(), amount)).toThrow(RangeError);
  });

  it('makes a breach hurt more than a normal bullet', () => {
    expect(breachDamage('basic')).toBe(2);
    expect(breachDamage('armored')).toBe(4);
    expect(breachDamage('shooter')).toBe(2);
  });

  it('allows damage exactly when invulnerability expires', () => {
    expect(canTakeDamage(1599, 1600)).toBe(false);
    expect(canTakeDamage(1600, 1600)).toBe(true);
  });
});
