import { describe, expect, it } from 'vitest';
import { progressionHudState } from './progressionHud';

describe('progressionHudState', () => {
  it('shows exact XP and proportional fill before max rank', () => {
    expect(progressionHudState(2, 8, 12)).toEqual({
      label: 'LV 2  XP 8/12',
      fillRatio: 2 / 3,
    });
  });

  it('shows explicit MAX text and a full bar at max rank', () => {
    expect(progressionHudState(20, 0, null)).toEqual({
      label: 'LV 20  XP MAX',
      fillRatio: 1,
    });
  });
});
