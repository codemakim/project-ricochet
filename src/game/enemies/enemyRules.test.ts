import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { canFire } from './enemyRules';

describe('prototype enemies', () => {
  it('caps shooters at two and bullets at the central hostile cap', () => {
    expect(canFire(0, 0)).toBe(true);
    expect(canFire(1, GAME_TUNING.projectiles.hostileCap - 1)).toBe(true);
    expect(canFire(2, 0)).toBe(false);
    expect(canFire(0, GAME_TUNING.projectiles.hostileCap)).toBe(false);
  });

  it('accepts a caller-supplied hostile cap instead of assuming twelve', () => {
    expect(canFire(0, 6, 7)).toBe(true);
    expect(canFire(0, 7, 7)).toBe(false);
  });
});
