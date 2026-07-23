import { describe, expect, it } from 'vitest';
import {
  bossKindAfterTransition,
  createBossForKind,
  rewardTierForBoss,
  sectionAfterBossReward,
  shouldFinalizeBossReward,
} from './combatSceneRules';

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

describe('boss scene selection', () => {
  it('retains the warned boss kind through the matching start transition', () => {
    const warned = bossKindAfterTransition(null, {
      type: 'bossWarningStarted',
      bossKind: 'hive',
    });

    expect(warned).toBe('hive');
    expect(bossKindAfterTransition(warned, {
      type: 'bossStarted',
      bossKind: 'hive',
    })).toBe('hive');
  });

  it('rejects a start transition for a different pending boss manager', () => {
    expect(() => bossKindAfterTransition('sentinel', {
      type: 'bossStarted',
      bossKind: 'hive',
    })).toThrow('boss start kind hive does not match pending sentinel');
  });

  it('constructs only the manager selected by the pending boss kind', () => {
    const calls: string[] = [];
    const factories = {
      sentinel: () => {
        calls.push('sentinel');
        return 'sentinel-manager';
      },
      hive: () => {
        calls.push('hive');
        return 'hive-manager';
      },
    };

    expect(createBossForKind('hive', factories)).toBe('hive-manager');
    expect(calls).toEqual(['hive']);
  });

  it('selects the reward tier and resumed section from the defeated boss kind', () => {
    expect(rewardTierForBoss('sentinel')).toBe('first');
    expect(rewardTierForBoss('hive')).toBe('second');
    expect(sectionAfterBossReward('first')).toBe(1);
    expect(sectionAfterBossReward('second')).toBe(2);
  });
});
