import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import type { FormationEnemySpec } from '../enemies/enemyRules';
import {
  createInitialFormation,
  createReinforcementFormation,
  type FormationRecipe,
} from './formationRules';
import { FORMATION_PROFILES, STAGES } from './stageDefinitions';

function recipe(stageIndex = 0, phaseIndex = 0): FormationRecipe {
  const stage = STAGES[stageIndex]!;
  const stagePhase = stage.phases[phaseIndex]!;
  return {
    stageNumber: stage.number,
    battlefield: stage.battlefield,
    profile: FORMATION_PROFILES.find(({ id }) => id === stagePhase.formationProfileId)!,
    enemyWeightMultipliers: stagePhase.enemyWeightMultipliers,
    maxPerFormationOverrides: stagePhase.maxPerFormationOverrides,
    powerBand: stage.powerBand,
    descentSpeedMultiplier: stage.descentSpeedMultiplier,
  };
}

function occupiedCells(enemies: readonly FormationEnemySpec[]): string[] {
  return enemies.flatMap((enemy) => Array.from(
    { length: enemy.width * enemy.height },
    (_, index) => {
      const row = enemy.row + Math.floor(index / enemy.width);
      const column = enemy.column + index % enemy.width;
      return `${row}:${column}`;
    },
  ));
}

describe('multi-cell formation generation', () => {
  it('is deterministic and emits non-overlapping footprints within five rows', () => {
    const first = createReinforcementFormation(recipe(1, 1), 0, 91);
    const repeated = createReinforcementFormation(recipe(1, 1), 0, 91);
    const cells = occupiedCells(first.enemies);

    expect(first).toEqual(repeated);
    expect(new Set(cells).size).toBe(cells.length);
    expect(first.enemies.every(({ column, row, width, height }) => (
      column >= 0
      && row >= 0
      && column + width <= 8
      && row + height <= 5
    ))).toBe(true);
    expect(first.enemies.some(({ width, height }) => width > 1 || height > 1)).toBe(true);
    expect(first.populationCost).toBe(cells.length);
  });

  it('uses the catalog footprint for every enemy kind', () => {
    const results = Array.from({ length: 64 }, (_, sequence) =>
      createReinforcementFormation(recipe(1, 1), sequence, 808).enemies).flat();
    const footprintByKind = new Map(results.map(({ kind, width, height }) => (
      [kind, `${width}×${height}`]
    )));

    expect(footprintByKind.get('basic')).toBe('1×1');
    expect(footprintByKind.get('shooter')).toBe('1×1');
    expect(footprintByKind.get('splitter')).toBe('2×1');
    expect(footprintByKind.get('armored')).toBe('2×2');
  });

  it('keeps chunk occupied cells within the selected profile range', () => {
    const selected = recipe(0, 1);
    const cellCounts = Array.from({ length: 64 }, (_, sequence) => {
      const enemies = createReinforcementFormation(selected, sequence, 808).enemies;
      return occupiedCells(enemies).length;
    });

    expect(Math.min(...cellCounts)).toBeGreaterThanOrEqual(selected.profile.cellMinimum);
    expect(Math.max(...cellCounts)).toBeLessThanOrEqual(selected.profile.cellMaximum + 3);
  });

  it('supports an exact fixed template', () => {
    const fixedRecipe = {
      ...recipe(1, 1),
      profile: {
        ...recipe(1, 1).profile,
        styleWeights: {},
        proceduralWeight: 0,
        templateWeights: { 'split-gate': 1 },
      },
    };
    const result = createReinforcementFormation(fixedRecipe, 0, 33);

    expect(result.enemies.map(({ kind, column, row, width, height }) => ({
      kind, column, row, width, height,
    }))).toEqual([
      { kind: 'basic', column: 0, row: 0, width: 1, height: 1 },
      { kind: 'splitter', column: 3, row: 0, width: 2, height: 1 },
      { kind: 'basic', column: 7, row: 0, width: 1, height: 1 },
      { kind: 'shooter', column: 1, row: 2, width: 1, height: 1 },
      { kind: 'shooter', column: 6, row: 2, width: 1, height: 1 },
    ]);
  });

  it('mutates a mixed template reproducibly without changing its large anchor', () => {
    const mixedRecipe = {
      ...recipe(0, 0),
      profile: {
        ...recipe(0, 0).profile,
        styleWeights: {},
        proceduralWeight: 0,
        templateWeights: { 'side-fort': 1 },
      },
    };
    const layouts = Array.from({ length: 8 }, (_, seed) =>
      createReinforcementFormation(mixedRecipe, 0, seed).enemies);

    expect(layouts[0]).toEqual(createReinforcementFormation(mixedRecipe, 0, 0).enemies);
    expect(new Set(layouts.map((layout) => JSON.stringify(layout))).size).toBeGreaterThan(2);
    expect(layouts.every((enemies) =>
      enemies.some(({ column, row, width, height }) => (
        (column === 0 || column === 6) && row === 0 && width === 2 && height === 2
      )))).toBe(true);
  });

  it('keeps the initial chunk dense but non-grid and world-aligned', () => {
    const result = createInitialFormation(321);

    expect(result.style).not.toBe('grid');
    expect(occupiedCells(result.enemies).length).toBeGreaterThanOrEqual(14);
    expect(result.enemies.every(({ speed }) =>
      speed === GAME_TUNING.enemies.descentSpeed)).toBe(true);
    expect(result.enemies.every(({ x, y }) =>
      Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it('applies stage filters, caps, HP, and descent multipliers', () => {
    const result = createReinforcementFormation({
      ...recipe(),
      enemyWeightMultipliers: { basic: 1, armored: 100, shooter: 0, splitter: 0 },
      maxPerFormationOverrides: { armored: 1, shooter: 0, splitter: 0 },
      powerBand: {
        expectedOrbCount: 2,
        normalHpMultiplier: 2,
        eliteHpMultiplier: 3,
        largeEnemyRatio: 0.12,
      },
      descentSpeedMultiplier: 1.5,
    }, 0, 808);

    expect(result.enemies.filter(({ kind }) => kind === 'armored')).toHaveLength(1);
    expect(result.enemies.every(({ kind, hp, width, height }) =>
      hp === GAME_TUNING.enemies.hp[kind] * (width * height >= 4 ? 3 : 2))).toBe(true);
    expect(result.enemies.every(({ speed }) =>
      speed === GAME_TUNING.enemies.descentSpeed * 1.5)).toBe(true);
  });

  it('spawns every reinforcement above the viewport', () => {
    const result = createReinforcementFormation(recipe(), 0, 808);

    expect(result.enemies.every(({ y, height }) => (
      y + height * GAME_TUNING.encounter.grid.cellHeight / 2 <= 0
    ))).toBe(true);
  });

  it('rejects invalid run seeds and sequences', () => {
    expect(() => createInitialFormation(-1))
      .toThrowError(new RangeError('runSeed must be an unsigned 32-bit integer'));
    expect(() => createReinforcementFormation(recipe(), -1, 1))
      .toThrowError(new RangeError('sequence must be a non-negative integer'));
  });
});
