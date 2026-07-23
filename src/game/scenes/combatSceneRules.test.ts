import { describe, expect, it, vi } from 'vitest';
import { CombatEffectScheduler } from '../combat/CombatEffectScheduler';
import { BuildState } from '../progression/BuildState';
import { BossBuild } from '../progression/BossBuild';
import {
  bossKindAfterTransition,
  bossOrbModifiers,
  createBossForKind,
  finalizeCombatLifecycle,
  inactiveBossSnapshot,
  planDirectHitEffects,
  rewardAddsPermanentOrb,
  rewardTierForBoss,
  sectionAfterBossReward,
  schedulePlannedAftershock,
  settlePlannedAreaEffects,
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

describe('combat relic runtime decisions', () => {
  it('plans every direct-hit relic effect without making child or aftershock effects recursive', () => {
    const build = new BuildState({ explosion: 1, split: 1 });
    const bossBuild = new BossBuild();
    for (const reward of [
      'recovery-salvo',
      'siege-resonance',
      'hyperpressure-core',
      'inertial-penetration',
      'aftershock-explosion',
      'chain-split',
    ] as const) bossBuild.acquire(reward);
    for (let hit = 0; hit < 10; hit += 1) {
      expect(planDirectHitEffects({
        source: 'permanent',
        charged: false,
      }, build, bossBuild).immediateAreas.map(({ kind }) => kind))
        .toEqual(['explosion']);
    }

    const permanent = planDirectHitEffects({
      source: 'permanent',
      charged: true,
    }, build, bossBuild);
    expect(permanent).toMatchObject({
      immediateAreas: [
        { kind: 'siege', radius: 80, damage: 2 },
        { kind: 'explosion', radius: 48, damage: 0.5 },
      ],
      aftershock: { damage: 0.25 },
      spawnChildren: false,
      chargedSplitCount: 1,
    });
    expect(permanent.aftershock?.radius).toBeCloseTo(38.4);
    const scheduler = new CombatEffectScheduler();
    schedulePlannedAftershock(
      permanent,
      scheduler,
      1_000,
      { x: 225, y: 180 },
    );
    expect(scheduler.getSnapshot()).toEqual([
      expect.objectContaining({
        dueAt: 1_350,
        position: { x: 225, y: 180 },
        damage: 0.25,
      }),
    ]);
    expect(bossOrbModifiers(bossBuild)).toEqual({
      chargedDamageBonus: 0.75,
      chargedKillPierces: true,
    });
    expect(bossBuild.recoverySalvoCount('proximity')).toBe(2);
    expect(rewardAddsPermanentOrb('auxiliary-orbit')).toBe(true);

    const rootTemporary = planDirectHitEffects({
      source: 'temporary',
      charged: false,
    }, build, bossBuild);
    expect(rootTemporary).toMatchObject({
      immediateAreas: [],
      aftershock: null,
      spawnChildren: true,
      chargedSplitCount: 0,
    });
  });

  it('batches enemies once while applying each area to the boss once with exclusions', () => {
    const applyEnemyBatch = vi.fn();
    const applyBossArea = vi.fn();
    const effects = [
      { kind: 'siege', radius: 80, damage: 2 },
      { kind: 'explosion', radius: 48, damage: 0.5 },
    ] as const;

    settlePlannedAreaEffects(
      { x: 225, y: 180 },
      effects,
      7,
      'leftReflector',
      { applyEnemyBatch, applyBossArea },
    );

    expect(applyEnemyBatch).toHaveBeenCalledOnce();
    expect(applyEnemyBatch).toHaveBeenCalledWith([
      {
        center: { x: 225, y: 180 },
        radius: 80,
        damage: 2,
        excludedEnemyId: 7,
      },
      {
        center: { x: 225, y: 180 },
        radius: 48,
        damage: 0.5,
        excludedEnemyId: 7,
      },
    ]);
    expect(applyBossArea.mock.calls).toEqual([
      [{ x: 225, y: 180 }, 80, 2, 'leftReflector'],
      [{ x: 225, y: 180 }, 48, 0.5, 'leftReflector'],
    ]);
  });
});

describe('combat scene lifecycle finalization', () => {
  function lifecycleBoundary() {
    const scheduler = new CombatEffectScheduler();
    scheduler.scheduleAftershock(0, { x: 10, y: 20 }, 30, 1);
    const bossBuild = new BossBuild();
    bossBuild.acquire('auxiliary-orbit');
    bossBuild.acquire('siege-resonance');
    for (let hit = 0; hit < 10; hit += 1) bossBuild.recordPermanentDirectHit();
    const activeBoss = {
      clearHostileActions: vi.fn(),
      destroy: vi.fn(),
    };
    const dependencies = {
      scheduler,
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
        bossRewardChoices: ['auxiliary-orbit'] as const,
        bossDefeatPending: true,
        bossBuild,
      },
      dependencies,
      activeBoss,
      scheduler,
      bossBuild,
    };
  }

  it('completes a normal boss reward with clean transient state and permanent rewards preserved', () => {
    const boundary = lifecycleBoundary();

    const next = finalizeCombatLifecycle(
      'rewardCompleted',
      boundary.state,
      boundary.dependencies,
    );

    expect(next).toEqual({
      activeBoss: undefined,
      activeBossKind: undefined,
      bossRewardTier: null,
      bossRewardChoices: [],
      bossDefeatPending: false,
      bossBuild: boundary.bossBuild,
    });
    expect(next.bossBuild.snapshot()).toEqual([
      'auxiliary-orbit',
      'siege-resonance',
    ]);
    expect(next.bossBuild.recordPermanentDirectHit()).toBe(false);
    expect(boundary.scheduler.getSnapshot()).toEqual([]);
    expect(boundary.activeBoss.clearHostileActions).toHaveBeenCalledOnce();
    expect(boundary.activeBoss.destroy).toHaveBeenCalledOnce();
    expect(boundary.dependencies.clearEnemyHostileActions).toHaveBeenCalledOnce();
    expect(boundary.dependencies.clearWarning).toHaveBeenCalledOnce();
    expect(boundary.dependencies.clearTemporaryOrbs).toHaveBeenCalledOnce();
    expect(boundary.dependencies.hideRewardOverlay).toHaveBeenCalledOnce();
  });

  it('opens a boss reward after destroying combat objects while retaining its tier and choices', () => {
    const boundary = lifecycleBoundary();

    const next = finalizeCombatLifecycle(
      'rewardOpened',
      boundary.state,
      boundary.dependencies,
    );

    expect(next).toEqual({
      activeBoss: undefined,
      activeBossKind: undefined,
      bossRewardTier: 'second',
      bossRewardChoices: ['auxiliary-orbit'],
      bossDefeatPending: false,
      bossBuild: boundary.bossBuild,
    });
    expect(boundary.dependencies.hideRewardOverlay).not.toHaveBeenCalled();
  });

  it.each(['defeat', 'restart', 'shutdown'] as const)(
    'discards the build and clears exact scene state on terminal %s',
    (reason) => {
      const boundary = lifecycleBoundary();

      const next = finalizeCombatLifecycle(
        reason,
        boundary.state,
        boundary.dependencies,
      );

      expect(next).toEqual({
        activeBoss: undefined,
        activeBossKind: undefined,
        bossRewardTier: null,
        bossRewardChoices: [],
        bossDefeatPending: false,
        bossBuild: expect.any(BossBuild),
      });
      expect(next.bossBuild).not.toBe(boundary.bossBuild);
      expect(next.bossBuild.snapshot()).toEqual([]);
      expect(boundary.bossBuild.recordPermanentDirectHit()).toBe(false);
      expect(boundary.scheduler.getSnapshot()).toEqual([]);
      expect(boundary.activeBoss.clearHostileActions).toHaveBeenCalledOnce();
      expect(boundary.activeBoss.destroy).toHaveBeenCalledOnce();
      expect(boundary.dependencies.clearEnemyHostileActions).toHaveBeenCalledOnce();
      expect(boundary.dependencies.clearWarning).toHaveBeenCalledOnce();
      expect(boundary.dependencies.clearTemporaryOrbs).toHaveBeenCalledOnce();
      expect(boundary.dependencies.hideRewardOverlay).toHaveBeenCalledOnce();
    },
  );

  it('reports the pending hive kind while its manager is not active during warning', () => {
    expect(inactiveBossSnapshot('hive')).toMatchObject({
      kind: 'hive',
      active: false,
      phase: null,
    });
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
