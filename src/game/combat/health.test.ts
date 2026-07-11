import { describe, expect, it } from 'vitest';
import { applyDamage, breachDamage, createHealth } from './health';

describe('paddle health', () => {
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

  it('makes a breach hurt more than a normal bullet', () => {
    expect(breachDamage('basic')).toBe(2);
    expect(breachDamage('armored')).toBe(4);
  });
});
