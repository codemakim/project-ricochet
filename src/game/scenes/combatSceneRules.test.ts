import { describe, expect, it } from 'vitest';
import { shouldFinalizeBossReward } from './combatSceneRules';

describe('shouldFinalizeBossReward', () => {
  it('defers a pending boss reward until every level-up choice is resolved', () => {
    expect(shouldFinalizeBossReward(true, false, true)).toBe(false);
    expect(shouldFinalizeBossReward(true, false, false)).toBe(true);
  });

  it('never finalizes without a live pending boss defeat', () => {
    expect(shouldFinalizeBossReward(false, false, false)).toBe(false);
    expect(shouldFinalizeBossReward(true, true, false)).toBe(false);
  });
});
