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

    expect(director.update(7_999, clearTop).formation).toBeNull();
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

    director.update(8_000, blocked);
    director.update(52_000, blocked);

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
      elapsedMs: 8_000,
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

  it('advances the first reward to stage 2 with reset stage clocks', () => {
    const director = new EncounterDirector(1234);
    finishActiveBoss(director);
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

  it('returns run completion after the final boss reward', () => {
    const director = startStageTwo();
    finishActiveBoss(director);

    expect(director.resumeAfterBossReward()).toEqual({ type: 'runCompleted' });
    expect(director.getSnapshot()).toMatchObject({
      state: 'runComplete',
      stageIndex: 1,
      stageId: 'default-2',
      stageNumber: 2,
      bossesDefeated: 2,
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

  function finishActiveBoss(director: EncounterDirector): void {
    const stage = STAGES[director.getSnapshot().stageIndex]!;
    director.update(stage.boss.hardMaximumMs, clearTop);
    director.update(stage.boss.warningMs, clearTop);
    director.markBossDefeated();
  }

  function startStageTwo(): EncounterDirector {
    const director = new EncounterDirector(1234);
    finishActiveBoss(director);
    director.resumeAfterBossReward();
    createFormationSpy.mockClear();
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
