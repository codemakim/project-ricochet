import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  const clearTop = { activePopulation: 0, topmostEnemyY: 120 };

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
    expect(director.update(interval - 1, clearTop).formation).toBeNull();
    expect(director.update(1, { activePopulation: 0, topmostEnemyY: 49 }).formation).toBeNull();
    expect(createFormationSpy).not.toHaveBeenCalled();

    expect(director.update(0, blocked).formation).toBeNull();
    expect(director.update(16, blocked).formation).toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
    expect(createFormationSpy).toHaveBeenCalledWith(recipeAt(0, 0), 0, 1234);

    expect(director.update(0, clearTop).formation).not.toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
    expect(director.getSnapshot()).toMatchObject({ phase: 0, spawnSequence: 1 });
  });

  it('rebuilds a pending formation from the next stage-local phase', () => {
    const director = new EncounterDirector(1234);
    const blocked = {
      activePopulation: STAGES[0].phases[1].activeCap,
      topmostEnemyY: 120,
    };

    director.update(STAGES[0].phases[0].spawnIntervalMs, blocked);
    director.update(
      60_000 - STAGES[0].phases[0].spawnIntervalMs,
      blocked,
    );

    expect(createFormationSpy).toHaveBeenNthCalledWith(1, recipeAt(0, 0), 0, 1234);
    expect(createFormationSpy).toHaveBeenNthCalledWith(2, recipeAt(0, 1), 0, 1234);
    expect(director.getSnapshot().phase).toBe(1);
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

  it('uses the active stage boss score and exact time gates', () => {
    const director = new EncounterDirector(1234);
    for (let index = 0; index < STAGES[0].boss.scoreTarget; index += 1) {
      director.recordEnemyKill('basic');
    }

    expect(director.update(STAGES[0].boss.minimumMs - 1, clearTop).transition).toBeNull();
    expect(director.update(1, clearTop).transition).toEqual({
      type: 'bossWarningStarted',
      bossKind: STAGES[0].boss.kind,
    });
    expect(director.getSnapshot()).toMatchObject({
      state: 'bossWarning',
      stageElapsedMs: STAGES[0].boss.minimumMs,
      bossScore: STAGES[0].boss.scoreTarget,
    });
  });

  it('starts the active stage boss after its warning', () => {
    const director = new EncounterDirector(1234);

    expect(director.update(STAGES[0].boss.hardMaximumMs, clearTop).transition).toEqual({
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
    for (let index = 0; index < STAGES[0].boss.scoreTarget; index += 1) {
      director.recordEnemyKill('basic');
    }

    expect(director.update(
      STAGES[0].boss.minimumMs - STAGES[0].phases[0].spawnIntervalMs,
      blocked,
    ).transition?.type).toBe('bossWarningStarted');
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

    expect(director.update(STAGES[1].boss.minimumMs - 1, clearTop).transition).toBeNull();
    expect(director.update(1, clearTop).transition).toEqual({
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
    expect(director.update(999_999, clearTop)).toEqual({ formation: null, transition: null });
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
    director.update(stage.boss.hardMaximumMs, clearTop);
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

function recipeAt(stageIndex: number, phaseIndex: number): FormationRecipe {
  const stage = STAGES[stageIndex]!;
  const phase = stage.phases[phaseIndex]!;
  return {
    stageNumber: stage.number,
    battlefield: stage.battlefield,
    profile: FORMATION_PROFILES.find(({ id }) => id === phase.formationProfileId)!,
    enemyWeightMultipliers: phase.enemyWeightMultipliers,
    maxPerFormationOverrides: phase.maxPerFormationOverrides,
    hpMultiplier: stage.hpMultiplier,
    descentSpeedMultiplier: stage.descentSpeedMultiplier,
  };
}
