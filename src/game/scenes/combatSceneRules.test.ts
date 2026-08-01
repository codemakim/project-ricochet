import { describe, expect, it, vi } from 'vitest';
import { BuildState } from '../progression/BuildState';
import { BossBuild } from '../progression/BossBuild';
import {
  bossKindAfterTransition,
  createBossForKind,
  finalizeCombatLifecycle,
  inactiveBossSnapshot,
  pendingRunRewardKind,
  planDirectHitEffects,
  planOrbCoreEffects,
  rewardTierForBoss,
  settlePlannedAreaEffects,
  shouldFinalizeBossReward,
} from './combatSceneRules';

describe('combat scene rules', () => {
  it('opens only pending level-up rewards after the resume gap', () => {
    expect(pendingRunRewardKind(1, true)).toBe('levelUp');
    expect(pendingRunRewardKind(1, false)).toBeNull();
    expect(pendingRunRewardKind(0, true)).toBeNull();
  });

  it('finalizes a pending boss reward only after level-up pauses end', () => {
    expect(shouldFinalizeBossReward(true, false, true)).toBe(false);
    expect(shouldFinalizeBossReward(true, false, false)).toBe(true);
    expect(shouldFinalizeBossReward(false, false, false)).toBe(false);
    expect(shouldFinalizeBossReward(true, true, false)).toBe(false);
  });

  it('plans core effects only from matching permanent direct hits', () => {
    expect(planOrbCoreEffects({
      source: 'permanent',
      coreType: 'corrosion',
      conductionTriggered: false,
    }, true)).toEqual({ spawnCorrosion: true, dischargeConduction: false });
    expect(planOrbCoreEffects({
      source: 'permanent',
      coreType: 'conduction',
      conductionTriggered: true,
    }, false)).toEqual({ spawnCorrosion: false, dischargeConduction: true });
    expect(planOrbCoreEffects({
      source: 'temporary',
      coreType: 'conduction',
      conductionTriggered: true,
    }, true)).toEqual({ spawnCorrosion: false, dischargeConduction: false });
  });

  it('plans approved explosion and split decisions without legacy effects', () => {
    const build = new BuildState({ explosion: 1, split: 1 });

    expect(planDirectHitEffects(
      { source: 'permanent', charged: true },
      build,
      { explosion: true, split: true },
    )).toEqual({
      immediateAreas: [{ kind: 'explosion', radius: 48, damage: 0.45 }],
      spawnChildren: false,
      splitCount: 2,
    });
    expect(planDirectHitEffects(
      { source: 'temporary', charged: false },
      build,
      { explosion: true, split: true },
    )).toEqual({
      immediateAreas: [{ kind: 'explosion', radius: 48, damage: 0.45 }],
      spawnChildren: true,
      splitCount: 0,
    });
  });

  it('adds one level-five center blast to the merged explosion', () => {
    const build = new BuildState();
    expect(planDirectHitEffects(
      { source: 'permanent', charged: true },
      build,
      { explosion: true, split: false },
      {
        explosion: {
          chance: 0.4,
          cooldownMs: 120,
          radius: 58,
          damage: 0.75,
          maximumFailures: 4,
          centerBlast: { radius: 24, damage: 1.5 },
        },
        split: null,
      },
    ).immediateAreas).toEqual([
      { kind: 'explosion', radius: 58, damage: 0.75 },
      { kind: 'explosion', radius: 24, damage: 1.5 },
    ]);
  });

  it('batches enemies and applies each area to the boss with exclusions', () => {
    const applyEnemyBatch = vi.fn();
    const applyBossArea = vi.fn();
    const effects = [
      { kind: 'explosion' as const, radius: 80, damage: 2 },
      { kind: 'explosion' as const, radius: 48, damage: 0.5 },
    ];

    settlePlannedAreaEffects(
      { x: 225, y: 180 },
      effects,
      7,
      'leftReflector',
      { applyEnemyBatch, applyBossArea },
    );

    expect(applyEnemyBatch).toHaveBeenCalledWith([
      { center: { x: 225, y: 180 }, radius: 80, damage: 2, excludedEnemyId: 7 },
      { center: { x: 225, y: 180 }, radius: 48, damage: 0.5, excludedEnemyId: 7 },
    ]);
    expect(applyBossArea.mock.calls).toEqual([
      [{ x: 225, y: 180 }, 80, 2, 'leftReflector'],
      [{ x: 225, y: 180 }, 48, 0.5, 'leftReflector'],
    ]);
  });
});

describe('combat lifecycle', () => {
  function boundary() {
    const bossBuild = new BossBuild();
    bossBuild.acquire('auxiliary-link');
    bossBuild.acquire('cross-cut');
    const activeBoss = { clearHostileActions: vi.fn(), destroy: vi.fn() };
    const dependencies = {
      clearEnemyHostileActions: vi.fn(),
      clearWarning: vi.fn(),
      clearTemporaryOrbs: vi.fn(),
      hideRewardOverlay: vi.fn(),
    };
    return {
      state: {
        activeBoss,
        activeBossKind: 'hive' as const,
        bossRewardTier: 'second' as const,
        bossRewardChoices: ['auxiliary-link'] as const,
        bossDefeatPending: true,
        bossBuild,
      },
      dependencies,
      activeBoss,
      bossBuild,
    };
  }

  it('preserves the run build while completing or opening rewards', () => {
    const completed = boundary();
    const next = finalizeCombatLifecycle(
      'rewardCompleted',
      completed.state,
      completed.dependencies,
    );
    expect(next.bossBuild).toBe(completed.bossBuild);
    expect(next.bossBuild.snapshot()).toEqual(['auxiliary-link', 'cross-cut']);
    expect(next.bossRewardChoices).toEqual([]);
    expect(completed.activeBoss.destroy).toHaveBeenCalledOnce();

    const opened = boundary();
    const reward = finalizeCombatLifecycle('rewardOpened', opened.state, opened.dependencies);
    expect(reward.bossRewardTier).toBe('second');
    expect(reward.bossRewardChoices).toEqual(['auxiliary-link']);
    expect(opened.dependencies.hideRewardOverlay).not.toHaveBeenCalled();
  });

  it.each(['defeat', 'restart', 'shutdown'] as const)(
    'discards the run build on terminal %s',
    (reason) => {
      const current = boundary();
      const next = finalizeCombatLifecycle(reason, current.state, current.dependencies);
      expect(next.bossBuild).not.toBe(current.bossBuild);
      expect(next.bossBuild.snapshot()).toEqual([]);
      expect(current.dependencies.clearEnemyHostileActions).toHaveBeenCalledOnce();
      expect(current.dependencies.clearWarning).toHaveBeenCalledOnce();
      expect(current.dependencies.clearTemporaryOrbs).toHaveBeenCalledOnce();
      expect(current.dependencies.hideRewardOverlay).toHaveBeenCalledOnce();
    },
  );
});

describe('boss scene selection', () => {
  it('retains the warned boss kind and rejects a mismatched start', () => {
    const warned = bossKindAfterTransition(null, {
      type: 'bossWarningStarted',
      bossKind: 'hive',
    });
    expect(warned).toBe('hive');
    expect(bossKindAfterTransition(warned, {
      type: 'bossStarted',
      bossKind: 'hive',
    })).toBe('hive');
    expect(() => bossKindAfterTransition('sentinel', {
      type: 'bossStarted',
      bossKind: 'hive',
    })).toThrow('boss start kind hive does not match pending sentinel');
  });

  it('constructs the selected manager and maps reward tiers', () => {
    const calls: string[] = [];
    const factories = {
      sentinel: () => calls.push('sentinel'),
      hive: () => calls.push('hive'),
      siege: () => calls.push('siege'),
    };
    createBossForKind('hive', factories);
    expect(calls).toEqual(['hive']);
    expect(rewardTierForBoss('sentinel')).toBe('first');
    expect(rewardTierForBoss('hive')).toBe('second');
    expect(inactiveBossSnapshot('hive')).toMatchObject({
      kind: 'hive',
      active: false,
      phase: null,
    });
  });
});
