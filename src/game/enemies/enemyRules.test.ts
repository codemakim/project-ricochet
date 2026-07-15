import { describe, expect, it } from 'vitest';
import { canFire } from './enemyRules';

describe('prototype enemies', () => {
  it('caps shooters at two and bullets at twelve', () => {
    expect(canFire(0, 0)).toBe(true);
    expect(canFire(1, 11)).toBe(true);
    expect(canFire(2, 0)).toBe(false);
    expect(canFire(0, 12)).toBe(false);
  });
});
