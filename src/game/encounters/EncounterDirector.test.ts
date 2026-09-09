import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { GAME_HEIGHT } from '../constants';
import { createDefaultDevelopmentBalanceSettings } from '../dev/developmentBalanceSettings';
import type { EnemySpec } from '../enemies/enemyRules';
import { EncounterDirector, type EncounterEnemyState } from './EncounterDirector';
import { STAGES } from './stageDefinitions';

const empty: EncounterEnemyState = {
  activePopulation: 0,
  topmostEnemyTop: Number.POSITIVE_INFINITY,
  formationPopulations: {},
};

function population(formation: readonly EnemySpec[]): number {
  return formation.reduce(
    (total, enemy) => total + (enemy.width ?? 1) * (enemy.height ?? 1),
    0,
  );
}

function formationId(formation: readonly EnemySpec[]): string {
  return formation[0]!.formationId!;
}

function surviving(
  id: string,
  remaining: number,
  activePopulation = remaining,
  topmostEnemyTop = 300,
): EncounterEnemyState {
  return {
    activePopulation,
    topmostEnemyTop,
    formationPopulations: { [id]: remaining },
  };
}

function releasedFormation(director: EncounterDirector): EnemySpec[] {
  const formation = director.update(0, empty).formation;
  expect(formation).not.toBeNull();
  return formation!;
}

function releaseRemainingStageFormations(director: EncounterDirector): string[] {
  const ids = [formationId(releasedFormation(director))];
  while (director.getSnapshot().formationIndex < 9) {
    const currentId = director.getSnapshot().lastFormationId!;
    const update = director.update(0, surviving(currentId, 0, 1));
    expect(update.formation).not.toBeNull();
    ids.push(formationId(update.formation!));
  }
  return ids;
}

function startAndDefeatBoss(director: EncounterDirector) {
  releaseRemainingStageFormations(director);
  expect(director.update(0, surviving(director.getSnapshot().lastFormationId!, 0, 1)).transition)
    .toBeNull();
  const boss = STAGES[director.getSnapshot().stageIndex]!.boss;
  expect(director.update(0, empty).transition).toEqual({
    type: 'bossWarningStarted', bossKind: boss.kind,
  });
  expect(director.update(boss.warningMs, empty).transition).toEqual({
    type: 'bossStarted', bossKind: boss.kind,
  });
  return director.markBossDefeated();
}

describe('EncounterDirector', () => {
  it('immediately emits the first seeded opening formation at its paragraph depth', () => {
    const director = new EncounterDirector(1234);
    const formation = releasedFormation(director);
    const cellHeight = GAME_TUNING.encounter.grid.cellHeight;

    expect(formation.every((enemy) => enemy.rapidIngressTargetY !== undefined)).toBe(true);
    expect(Math.max(...formation.map((enemy) => (
      enemy.rapidIngressTargetY! + (enemy.height ?? 1) * cellHeight / 2
    )))).toBeCloseTo(GAME_HEIGHT * STAGES[0].paragraphs[0].targetDepthRatio);
    expect(director.getSnapshot()).toMatchObject({
      paragraphId: 'opening', paragraphIndex: 0, formationIndex: 0, spawnSequence: 1,
    });
  });

  it('waits above 35% and releases immediately at or below it when the cap fits', () => {
    const director = new EncounterDirector(7);
    const first = releasedFormation(director);
    const id = formationId(first);
    const initial = population(first);

    expect(director.update(999_999, surviving(id, Math.floor(initial * 0.35) + 1)).formation)
      .toBeNull();
    expect(director.update(0, surviving(id, 1)).formation).not.toBeNull();
  });

  it('blocks a depleted formation until the candidate paragraph cap fits', () => {
    const director = new EncounterDirector(7);
    const id = formationId(releasedFormation(director));
    const cap = STAGES[0].paragraphs[0].activeCap;

    expect(director.update(0, surviving(id, 0, cap)).formation).toBeNull();
    expect(director.update(0, surviving(id, 0, 1)).formation).not.toBeNull();
  });

  it('waits 350ms before refilling an empty battlefield', () => {
    const director = new EncounterDirector(7);
    releasedFormation(director);

    expect(director.update(349, empty).formation).toBeNull();
    expect(director.update(1, empty).formation).not.toBeNull();
  });

  it('scales the empty refill delay for development balance runs', () => {
    const balance = {
      ...createDefaultDevelopmentBalanceSettings(7),
      reinforcementIntervalMultiplier: 0.5,
    };
    const director = new EncounterDirector(7, balance);
    releasedFormation(director);

    expect(director.update(174, empty).formation).toBeNull();
    expect(director.update(1, empty).formation).not.toBeNull();
  });

  it('places a non-empty release below both paragraph depth and older enemies', () => {
    const director = new EncounterDirector(7);
    const id = formationId(releasedFormation(director));
    const formation = director.update(0, surviving(id, 0, 1, 250)).formation!;
    const cellHeight = GAME_TUNING.encounter.grid.cellHeight;

    expect(Math.max(...formation.map((enemy) => (
      enemy.rapidIngressTargetY! + (enemy.height ?? 1) * cellHeight / 2
    )))).toBeCloseTo(250 - cellHeight);
  });

  it('releases all ten formations once across opening, pressure, and climax', () => {
    const director = new EncounterDirector(42);
    const ids = releaseRemainingStageFormations(director);

    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    expect(director.getSnapshot()).toMatchObject({
      paragraphId: 'climax', paragraphIndex: 2, formationIndex: 9,
    });
  });

  it('waits for regular survivors after formation ten before warning and boss start', () => {
    const director = new EncounterDirector(42);
    releaseRemainingStageFormations(director);
    const id = director.getSnapshot().lastFormationId!;

    expect(director.update(10_000, surviving(id, 0, 1)).transition).toBeNull();
    expect(director.update(0, empty).transition).toEqual({
      type: 'bossWarningStarted', bossKind: 'sentinel',
    });
    expect(director.update(STAGES[0].boss.warningMs, empty).transition).toEqual({
      type: 'bossStarted', bossKind: 'sentinel',
    });
  });

  it('advances rewards through stage two and completes after the third boss', () => {
    const director = new EncounterDirector(42);

    expect(startAndDefeatBoss(director)).toEqual({ type: 'rewardRequired' });
    expect(director.resumeAfterBossReward()).toEqual({
      type: 'stageStarted', stageId: 'default-2', stageNumber: 2,
    });
    expect(releasedFormation(director)[0]!.formationId).toMatch(/^s2-/);
    while (director.getSnapshot().formationIndex < 9) {
      director.update(0, surviving(director.getSnapshot().lastFormationId!, 0, 1));
    }
    expect(director.update(0, empty).transition?.type).toBe('bossWarningStarted');
    expect(director.update(STAGES[1].boss.warningMs, empty).transition?.type).toBe('bossStarted');
    expect(director.markBossDefeated()).toEqual({ type: 'rewardRequired' });
    expect(director.resumeAfterBossReward()).toEqual({
      type: 'stageStarted', stageId: 'default-3', stageNumber: 3,
    });
    expect(startAndDefeatBoss(director)).toEqual({ type: 'runCompleted' });
    expect(director.getSnapshot().state).toBe('runComplete');
  });

  it('reports scripted progress without legacy score or phase fields', () => {
    const director = new EncounterDirector(7);
    const first = releasedFormation(director);
    const id = formationId(first);
    director.update(1, surviving(id, population(first), 1));
    const snapshot = director.getSnapshot();

    expect(snapshot).toMatchObject({
      paragraphId: 'opening', paragraphIndex: 0, formationIndex: 0,
      lastFormationId: id, lastFormationRemainingRatio: 1,
      emptyElapsedMs: 0, activePopulation: 1,
      activeCap: STAGES[0].paragraphs[0].activeCap,
    });
    expect(snapshot).not.toHaveProperty('phase');
  });

  it('rejects invalid clocks and lifecycle calls', () => {
    const director = new EncounterDirector(7);
    expect(() => director.update(-1, empty)).toThrow('deltaMs must be finite and non-negative');
    expect(() => director.markBossDefeated()).toThrow('cannot mark boss defeated');
    expect(() => director.resumeAfterBossReward()).toThrow('cannot resume after boss reward');
  });
});
