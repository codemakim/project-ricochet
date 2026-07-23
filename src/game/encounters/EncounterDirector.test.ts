import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';

const createFormationSpy = vi.hoisted(() => vi.fn());

vi.mock('./formationRules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./formationRules')>();
  createFormationSpy.mockImplementation(actual.createReinforcementFormation);
  return { ...actual, createReinforcementFormation: createFormationSpy };
});

import { EncounterDirector } from './EncounterDirector';
import { createReinforcementFormation } from './formationRules';

describe('EncounterDirector', () => {
  const clearTop = { activePopulation: 20, topmostEnemyY: 120 };
  const phase0CapacityBlocked = {
    activePopulation: GAME_TUNING.encounter.phases[0].activeCap
      - GAME_TUNING.encounter.phases[0].formation.minimum + 1,
    topmostEnemyY: 120,
  };

  beforeEach(() => {
    createFormationSpy.mockClear();
  });

  it('does not generate while interval or top clearance is blocked', () => {
    const director = new EncounterDirector(1234);

    expect(director.update(7_999, clearTop)).toEqual({ formation: null, transition: null });
    expect(director.update(1, { activePopulation: 0, topmostEnemyY: 49 })).toEqual({ formation: null, transition: null });
    expect(director.update(1_000, { activePopulation: 0, topmostEnemyY: 49 })).toEqual({ formation: null, transition: null });

    expect(createFormationSpy).not.toHaveBeenCalled();
  });

  it('generates once while capacity is blocked and admits the cached formation', () => {
    const director = new EncounterDirector(1234);
    const capacityBlocked = phase0CapacityBlocked;

    expect(director.update(8_000, capacityBlocked).formation).toBeNull();
    expect(director.update(16, capacityBlocked).formation).toBeNull();
    expect(director.update(16, capacityBlocked).formation).toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);

    expect(director.update(16, clearTop).formation).not.toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
    expect(director.getSnapshot().spawnSequence).toBe(1);
  });

  it('regenerates a capacity-blocked pending formation when phase changes', () => {
    const director = new EncounterDirector(1234);

    const activePopulation = GAME_TUNING.encounter.phases[1].activeCap
      - GAME_TUNING.encounter.phases[1].formation.minimum + 1;
    expect(director.update(8_000, { activePopulation, topmostEnemyY: 120 }).formation).toBeNull();
    expect(director.update(52_000, { activePopulation, topmostEnemyY: 120 }).formation).toBeNull();
    expect(createFormationSpy).toHaveBeenNthCalledWith(1, 0, 0, 1234);
    expect(createFormationSpy).toHaveBeenNthCalledWith(2, 1, 0, 1234);

    expect(director.update(0, clearTop).formation).not.toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(2);
    expect(director.getSnapshot()).toMatchObject({ phase: 1, spawnSequence: 1 });
  });

  it('releases one seeded phase-0 formation and records its metadata', () => {
    const director = new EncounterDirector(1234);
    expect(director.update(7_999, clearTop).formation).toBeNull();
    const formation = director.update(1, clearTop).formation;
    expect(formation?.length).toBeGreaterThanOrEqual(GAME_TUNING.encounter.phases[0].formation.minimum);
    expect(formation?.length).toBeLessThanOrEqual(GAME_TUNING.encounter.phases[0].formation.maximum);
    const expected = createReinforcementFormation(0, 0, 1234);
    expect(formation).toEqual(expected.enemies);
    expect(director.getSnapshot()).toMatchObject({
      runSeed: 1234,
      lastFormationId: expected.id,
      spawnSequence: 1,
      elapsedSinceSpawnMs: 0,
    });
  });

  it('keeps a blocked spawn pending and releases it without another interval', () => {
    const director = new EncounterDirector(1234);
    expect(director.update(8_000, phase0CapacityBlocked).formation).toBeNull();
    expect(director.getSnapshot()).toMatchObject({
      spawnSequence: 0,
      lastFormationId: null,
    });
    const formation = director.update(16, clearTop).formation;
    expect(formation?.length).toBeGreaterThanOrEqual(GAME_TUNING.encounter.phases[0].formation.minimum);
    expect(formation?.length).toBeLessThanOrEqual(GAME_TUNING.encounter.phases[0].formation.maximum);
  });

  it('never emits catch-up formations in one update', () => {
    const director = new EncounterDirector(1234);
    expect(director.update(24_000, clearTop).formation).not.toBeNull();
    expect(director.getSnapshot().spawnSequence).toBe(1);
    expect(director.update(0, clearTop).formation).toBeNull();
  });

  it('waits for top clearance even when time and capacity pass', () => {
    const director = new EncounterDirector(1234);
    director.update(8_000, { activePopulation: 20, topmostEnemyY: 49 });
    expect(director.getSnapshot().spawnSequence).toBe(0);
    const released = director.update(0, { activePopulation: 20, topmostEnemyY: 50 });
    expect(released.formation).not.toBeNull();
    expect(director.getSnapshot().spawnSequence).toBe(1);
  });

  it('emits different consecutive admitted formations', () => {
    const director = new EncounterDirector(1234);
    const first = director.update(8_000, clearTop).formation;
    const firstId = director.getSnapshot().lastFormationId;
    const second = director.update(8_000, clearTop).formation;
    const secondId = director.getSnapshot().lastFormationId;

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second).not.toEqual(first);
    expect(secondId).not.toBe(firstId);
  });

  it('does not start the warning from score before the minimum time', () => {
    const director = new EncounterDirector(1234);
    for (let index = 0; index < 35; index += 1) director.recordEnemyKill('armored');

    expect(director.update(119_999, clearTop).transition).toBeNull();
    expect(director.getSnapshot()).toMatchObject({ state: 'running', bossScore: 70 });
  });

  it('starts the warning at 120 seconds with 70 points', () => {
    const director = new EncounterDirector(1234);
    for (let index = 0; index < 70; index += 1) director.recordEnemyKill('basic');

    expect(director.update(120_000, clearTop)).toEqual({
      formation: null,
      transition: { type: 'bossWarningStarted', bossKind: 'sentinel' },
    });
    expect(director.getSnapshot()).toMatchObject({
      state: 'bossWarning',
      sectionElapsedMs: 120_000,
      pendingBossKind: 'sentinel',
    });
  });

  it('starts the warning at 210 seconds without score', () => {
    const director = new EncounterDirector(1234);

    expect(director.update(210_000, clearTop).transition).toEqual({
      type: 'bossWarningStarted',
      bossKind: 'sentinel',
    });
    expect(director.getSnapshot().state).toBe('bossWarning');
  });

  it('discards a cached formation on warning and emits no warning formations', () => {
    const director = new EncounterDirector(1234);
    const capacityBlocked = phase0CapacityBlocked;
    expect(director.update(8_000, capacityBlocked).formation).toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 70; index += 1) director.recordEnemyKill('basic');

    expect(director.update(112_000, capacityBlocked).transition).toEqual({
      type: 'bossWarningStarted',
      bossKind: 'sentinel',
    });
    expect(director.update(1_999, clearTop)).toEqual({ formation: null, transition: null });
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
  });

  it('starts the boss after 2000ms and consumes at most one transition per update', () => {
    const director = new EncounterDirector(1234);

    expect(director.update(212_000, clearTop).transition).toEqual({
      type: 'bossWarningStarted',
      bossKind: 'sentinel',
    });
    expect(director.getSnapshot()).toMatchObject({ state: 'bossWarning', warningElapsedMs: 0 });
    expect(director.update(2_000, clearTop).transition).toEqual({
      type: 'bossStarted',
      bossKind: 'sentinel',
    });
    expect(director.getSnapshot()).toMatchObject({ state: 'boss', warningElapsedMs: 2_000 });
  });

  it('resumes section 1 after boss defeat and reward with reset clocks', () => {
    const director = new EncounterDirector(1234);
    director.update(210_000, clearTop);
    director.update(2_000, clearTop);

    director.markBossDefeated();
    expect(director.getSnapshot()).toMatchObject({ state: 'bossRewardPaused', bossesDefeated: 1 });
    director.resumeAfterBossReward();
    expect(director.getSnapshot()).toMatchObject({
      state: 'running',
      section: 1,
      sectionElapsedMs: 0,
      elapsedSinceSpawnMs: 0,
      bossScore: 0,
      warningElapsedMs: 0,
      phase: 2,
      bossesDefeated: 1,
    });
  });

  it('keeps elapsed time monotonic while resetting section elapsed time', () => {
    const director = new EncounterDirector(1234);
    director.update(210_000, clearTop);
    director.update(2_000, clearTop);
    director.markBossDefeated();
    director.resumeAfterBossReward();

    expect(director.getSnapshot()).toMatchObject({ elapsedMs: 212_000, sectionElapsedMs: 0 });
    director.update(1_000, clearTop);
    expect(director.getSnapshot()).toMatchObject({ elapsedMs: 213_000, sectionElapsedMs: 1_000 });
  });

  it('pauses the section clock during the first reward then starts section 1 cleanly', () => {
    const director = new EncounterDirector(1234);
    director.update(210_000, clearTop);
    director.update(2_000, clearTop);
    director.markBossDefeated();
    director.update(60_000, clearTop);
    expect(director.getSnapshot()).toMatchObject({
      elapsedMs: 272_000,
      section: 0,
      sectionElapsedMs: 210_000,
      state: 'bossRewardPaused',
    });
    director.resumeAfterBossReward();
    expect(director.getSnapshot()).toMatchObject({
      section: 1,
      sectionElapsedMs: 0,
      elapsedSinceSpawnMs: 0,
      bossScore: 0,
      phase: 2,
    });
  });

  it('starts the hive warning at its score/time threshold and preserves enemies', () => {
    const director = startSectionOne();
    for (let index = 0; index < 55; index += 1) director.recordEnemyKill('armored');

    expect(director.update(149_999, clearTop).transition).toBeNull();
    createFormationSpy.mockClear();
    expect(director.update(1, clearTop)).toEqual({
      formation: null,
      transition: { type: 'bossWarningStarted', bossKind: 'hive' },
    });
    expect(director.getSnapshot()).toMatchObject({
      state: 'bossWarning',
      pendingBossKind: 'hive',
      bossScore: 110,
    });
    expect(director.update(1_999, { activePopulation: 84, topmostEnemyY: 120 }))
      .toEqual({ formation: null, transition: null });
    expect(createFormationSpy).not.toHaveBeenCalled();
    expect(director.update(1, { activePopulation: 84, topmostEnemyY: 120 })).toEqual({
      formation: null,
      transition: { type: 'bossStarted', bossKind: 'hive' },
    });
  });

  it('forces the hive warning at 210 seconds without score', () => {
    const director = startSectionOne();

    expect(director.update(210_000, clearTop).transition).toEqual({
      type: 'bossWarningStarted',
      bossKind: 'hive',
    });
  });

  it('scores splitter parents but not fragments in section 1', () => {
    const director = startSectionOne();
    director.recordEnemyKill('splitter');
    director.recordEnemyKill('fragment');

    expect(director.getSnapshot().bossScore).toBe(2);
  });

  it('resumes section 2 at phase 3 after the second reward and schedules no third boss', () => {
    const director = startSectionOne();
    director.update(210_000, clearTop);
    director.update(2_000, clearTop);
    director.markBossDefeated();
    expect(director.getSnapshot()).toMatchObject({ bossesDefeated: 2, pendingBossKind: 'hive' });
    director.resumeAfterBossReward();

    expect(director.getSnapshot()).toMatchObject({
      state: 'running',
      section: 2,
      sectionElapsedMs: 0,
      phase: 3,
      bossesDefeated: 2,
      pendingBossKind: null,
    });
    expect(director.update(210_000, clearTop).transition).toBeNull();
  });

  it('returns at most one transition for a large update', () => {
    const director = startSectionOne();

    expect(director.update(500_000, clearTop).transition).toEqual({
      type: 'bossWarningStarted',
      bossKind: 'hive',
    });
    expect(director.getSnapshot()).toMatchObject({ state: 'bossWarning', warningElapsedMs: 0 });
  });

  it('uses population costs for both active and incoming capacity', () => {
    const director = startSectionOne();
    const phase2 = GAME_TUNING.encounter.phases[2];
    const generated = createReinforcementFormation(2, 0, 1234);
    const activePopulation = phase2.activeCap - generated.populationCost + 1;
    createFormationSpy.mockClear();

    expect(director.update(phase2.spawnIntervalMs, {
      activePopulation,
      topmostEnemyY: 120,
    }).formation).toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
  });

  function startSectionOne(): EncounterDirector {
    const director = new EncounterDirector(1234);
    director.update(210_000, clearTop);
    director.update(2_000, clearTop);
    director.markBossDefeated();
    director.resumeAfterBossReward();
    createFormationSpy.mockClear();
    return director;
  }

  it('rejects illegal boss lifecycle transitions', () => {
    const director = new EncounterDirector(1234);

    expect(() => director.markBossDefeated()).toThrow('cannot mark boss defeated while encounter state is running');
    expect(() => director.resumeAfterBossReward()).toThrow('cannot resume after boss reward while encounter state is running');
  });
});
