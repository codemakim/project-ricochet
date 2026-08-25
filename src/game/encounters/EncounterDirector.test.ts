import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDevelopmentBalanceSettings } from '../dev/developmentBalanceSettings';
import { GAME_HEIGHT } from '../constants';
import { GAME_TUNING } from '../config/gameTuning';

const createFormationSpy = vi.hoisted(() => vi.fn());

vi.mock('./formationRules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./formationRules')>();
  createFormationSpy.mockImplementation(actual.createReinforcementFormation);
  return { ...actual, createReinforcementFormation: createFormationSpy };
});

import { EncounterDirector } from './EncounterDirector';
import { createReinforcementFormation, type FormationRecipe } from './formationRules';
import { FORMATION_PROFILES, STAGES } from './stageDefinitions';

describe('EncounterDirector', () => {
  const clearTop = { activePopulation: 1, topmostEnemyY: 120 };

  beforeEach(() => {
    createFormationSpy.mockClear();
  });

  it('keeps formation generation gated and caches a blocked stage recipe', () => {
    const director = new EncounterDirector(1234);
    const blocked = {
      activePopulation: STAGES[0].phases[0].activeCap,
      topmostEnemyY: 120,
    };

    const interval = STAGES[0].phases[0].spawnIntervalMs;
    expect(director.update(interval - 1, { activePopulation: 1, topmostEnemyY: 120 }).formation)
      .toBeNull();
    expect(director.update(1, { activePopulation: 1, topmostEnemyY: 49 }).formation).toBeNull();
    expect(createFormationSpy).not.toHaveBeenCalled();

    expect(director.update(0, blocked).formation).toBeNull();
    expect(director.update(16, blocked).formation).toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
    expect(createFormationSpy).toHaveBeenCalledWith(recipeAt(0, 0), 0, 1234);

    expect(director.update(0, clearTop).formation).not.toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
    expect(director.getSnapshot()).toMatchObject({
      phase: 0,
      spawnSequence: 1,
      expectedOrbCount: 3,
    });
  });

  it('refills an empty battlefield within the configured emergency delay', () => {
    const director = new EncounterDirector(1234);
    const empty = { activePopulation: 0, topmostEnemyY: Number.POSITIVE_INFINITY };

    expect(director.update(799, empty).formation).toBeNull();
    const formation = director.update(1, empty).formation;
    expect(formation).not.toBeNull();
    expect(Math.max(...formation!.map((enemy) => (
      enemy.rapidIngressTargetY!
        + (enemy.height ?? 1) * GAME_TUNING.encounter.grid.cellHeight / 2
    )))).toBeCloseTo(GAME_HEIGHT * GAME_TUNING.encounter.emergencyIngress.targetDepthRatio);
  });

  it('scales reinforcement timing for one run', () => {
    const balance = {
      ...createDefaultDevelopmentBalanceSettings(7),
      reinforcementIntervalMultiplier: 0.5,
    };
    const director = new EncounterDirector(1234, balance);
    const interval = STAGES[0].phases[0].spawnIntervalMs * 0.5;

    expect(director.update(interval, clearTop).formation)
      .not.toBeNull();
  });

  it('scales the empty battlefield refill delay', () => {
    const balance = {
      ...createDefaultDevelopmentBalanceSettings(7),
      reinforcementIntervalMultiplier: 0.5,
    };
    const director = new EncounterDirector(7, balance);
    const empty = { activePopulation: 0, topmostEnemyY: Number.POSITIVE_INFINITY };

    expect(director.update(399, empty).formation).toBeNull();
    expect(director.update(1, empty).formation).not.toBeNull();
  });

  it('rebuilds a pending formation from the next stage-local phase', () => {
    const director = new EncounterDirector(1234);
    const blocked = {
      activePopulation: STAGES[0].phases[1].activeCap,
      topmostEnemyY: 120,
    };

    director.update(STAGES[0].phases[0].spawnIntervalMs, blocked);
    recordBasicKills(director, STAGES[0].phases[1].startsAtScore);
    director.update(0, blocked);

    expect(createFormationSpy).toHaveBeenNthCalledWith(1, recipeAt(0, 0), 0, 1234);
    expect(createFormationSpy).toHaveBeenNthCalledWith(2, recipeAt(0, 1), 0, 1234);
    expect(director.getSnapshot().phase).toBe(1);
  });

  it('uses the stronger stage-one recipe from kill score', () => {
    const director = new EncounterDirector(1234);
    recordBasicKills(director, STAGES[0].phases[1].startsAtScore);

    director.update(5_000, { activePopulation: 1, topmostEnemyY: 120 });

    expect(createFormationSpy).toHaveBeenCalledWith(recipeAt(0, 1), 0, 1234);
    expect(director.getSnapshot().phase).toBe(1);
  });

  it('uses each phase reinforcement release line', () => {
    const director = new EncounterDirector(7);
    const upperEnemies = { activePopulation: 1, topmostEnemyY: 25 };

    expect(director.update(8_000, upperEnemies).formation).toBeNull();

    recordBasicKills(director, STAGES[0].phases[1].startsAtScore);
    const pressure = director.update(0, upperEnemies);
    expect(director.getSnapshot().phase).toBe(1);
    expect(pressure.formation).not.toBeNull();
  });

  it('releases the seeded stage recipe and records global metadata', () => {
    const director = new EncounterDirector(1234);
    const formation = director.update(STAGES[0].phases[0].spawnIntervalMs, clearTop).formation;
    const expected = createReinforcementFormation(recipeAt(0, 0), 0, 1234);

    expect(formation).toEqual(expected.enemies);
    expect(director.getSnapshot()).toMatchObject({
      elapsedMs: STAGES[0].phases[0].spawnIntervalMs,
      runSeed: 1234,
      lastFormationId: expected.id,
      spawnSequence: 1,
      elapsedSinceSpawnMs: 0,
      stageId: 'default-1',
      stageNumber: 1,
      stageIndex: 0,
    });
  });

  it('uses the active stage boss score without a time gate', () => {
    const director = new EncounterDirector(1234);
    recordBasicKills(director, STAGES[0].boss.scoreTarget - 1);

    expect(director.update(999_999, clearTop).transition).toBeNull();
    director.recordEnemyKill('basic');
    expect(director.update(0, clearTop).transition).toEqual({
      type: 'bossWarningStarted',
      bossKind: STAGES[0].boss.kind,
    });
    expect(director.getSnapshot()).toMatchObject({
      state: 'bossWarning',
      stageElapsedMs: 999_999,
      bossScore: STAGES[0].boss.scoreTarget,
    });
  });

  it('starts the active stage boss after its warning', () => {
    const director = new EncounterDirector(1234);
    recordBasicKills(director, STAGES[0].boss.scoreTarget);

    expect(director.update(0, clearTop).transition).toEqual({
      type: 'bossWarningStarted',
      bossKind: 'sentinel',
    });
    expect(director.update(STAGES[0].boss.warningMs, clearTop).transition).toEqual({
      type: 'bossStarted',
      bossKind: 'sentinel',
    });
  });

  it('discards a blocked pending chunk when boss warning starts', () => {
    const director = new EncounterDirector(1234);
    const blocked = {
      activePopulation: STAGES[0].phases[0].activeCap,
      topmostEnemyY: 120,
    };
    director.update(STAGES[0].phases[0].spawnIntervalMs, blocked);
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
    recordBasicKills(director, STAGES[0].boss.scoreTarget);

    expect(director.update(0, blocked).transition?.type).toBe('bossWarningStarted');
    expect(director.update(STAGES[0].boss.warningMs, clearTop).transition?.type)
      .toBe('bossStarted');
    expect(director.update(60_000, clearTop).formation).toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
  });

  it('advances the first reward to stage 2 with reset stage clocks', () => {
    const director = new EncounterDirector(1234);
    expect(finishActiveBoss(director)).toEqual({ type: 'rewardRequired' });
    const elapsedMs = director.getSnapshot().elapsedMs;

    expect(director.resumeAfterBossReward()).toEqual({
      type: 'stageStarted',
      stageId: 'default-2',
      stageNumber: 2,
    });
    expect(director.getSnapshot()).toMatchObject({
      state: 'running',
      stageIndex: 1,
      stageId: 'default-2',
      stageNumber: 2,
      stageElapsedMs: 0,
      elapsedSinceSpawnMs: 0,
      elapsedMs,
      bossScore: 0,
      phase: 0,
      bossesDefeated: 1,
    });
  });

  it('uses the second stage boss gates after advancing', () => {
    const director = startStageTwo();
    for (let index = 0; index < 55; index += 1) director.recordEnemyKill('armored');

    expect(director.update(0, clearTop).transition).toEqual({
      type: 'bossWarningStarted',
      bossKind: 'hive',
    });
  });

  it('advances the second reward to stage 3', () => {
    const director = startStageTwo();
    expect(finishActiveBoss(director)).toEqual({ type: 'rewardRequired' });

    expect(director.resumeAfterBossReward()).toEqual({
      type: 'stageStarted',
      stageId: 'default-3',
      stageNumber: 3,
    });
  });

  it('completes directly when the third boss is defeated', () => {
    const director = startStageThree();

    expect(finishActiveBoss(director)).toEqual({ type: 'runCompleted' });
    expect(director.getSnapshot()).toMatchObject({
      state: 'runComplete',
      stageIndex: 2,
      stageId: 'default-3',
      stageNumber: 3,
      bossesDefeated: 3,
    });
    expect(director.update(999_999, clearTop)).toEqual({
      formation: null,
      transition: null,
    });
  });

  it('uses population costs for incoming stage formations', () => {
    const director = startStageTwo();
    const phase = STAGES[1].phases[0];
    const generated = createReinforcementFormation(recipeAt(1, 0), 0, 1234);

    createFormationSpy.mockClear();
    expect(director.update(phase.spawnIntervalMs, {
      activePopulation: phase.activeCap - generated.populationCost + 1,
      topmostEnemyY: 120,
    }).formation).toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid updates and illegal boss lifecycle transitions', () => {
    const director = new EncounterDirector(1234);

    expect(() => director.update(-1, clearTop)).toThrow('deltaMs must be finite and non-negative');
    expect(() => director.markBossDefeated())
      .toThrow('cannot mark boss defeated while encounter state is running');
    expect(() => director.resumeAfterBossReward())
      .toThrow('cannot resume after boss reward while encounter state is running');
  });

  function finishActiveBoss(director: EncounterDirector) {
    const stage = STAGES[director.getSnapshot().stageIndex]!;
    recordBasicKills(director, stage.boss.scoreTarget);
    director.update(0, clearTop);
    director.update(stage.boss.warningMs, clearTop);
    return director.markBossDefeated();
  }

  function startStageTwo(): EncounterDirector {
    const director = new EncounterDirector(1234);
    finishActiveBoss(director);
    director.resumeAfterBossReward();
    createFormationSpy.mockClear();
    return director;
  }

  function startStageThree(): EncounterDirector {
    const director = startStageTwo();
    finishActiveBoss(director);
    director.resumeAfterBossReward();
    return director;
  }
});

function recordBasicKills(director: EncounterDirector, count: number): void {
  for (let index = 0; index < count; index += 1) director.recordEnemyKill('basic');
}

function recipeAt(stageIndex: number, phaseIndex: number): FormationRecipe {
  const stage = STAGES[stageIndex]!;
  const phase = stage.phases[phaseIndex]!;
  return {
    stageNumber: stage.number,
    battlefield: stage.battlefield,
    profile: FORMATION_PROFILES.find(({ id }) => id === phase.formationProfileId)!,
    enemyWeightMultipliers: phase.enemyWeightMultipliers,
    maxPerFormationOverrides: phase.maxPerFormationOverrides,
    powerBand: {
      ...stage.powerBand,
      normalHpMultiplier: stage.powerBand.normalHpMultiplier
        * (phase.normalHpMultiplier ?? 1),
      eliteHpMultiplier: stage.powerBand.eliteHpMultiplier
        * (phase.eliteHpMultiplier ?? 1),
    },
    descentSpeedMultiplier: stage.descentSpeedMultiplier
      * (phase.descentSpeedMultiplier ?? 1),
  };
}
