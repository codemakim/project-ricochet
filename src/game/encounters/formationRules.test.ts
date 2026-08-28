import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import type { FormationEnemySpec } from '../enemies/enemyRules';
import { FORMATION_COLUMNS } from './formationGrid';
import {
  createAuthoredFormation,
  resolveStageFormationOrder,
} from './formationRules';
import { ENEMY_CATALOG, STAGES } from './stageDefinitions';

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

describe('authored formation rules', () => {
  it('keeps seeded order deterministic and inside paragraph boundaries', () => {
    const first = resolveStageFormationOrder(STAGES[0], 91);
    expect(resolveStageFormationOrder(STAGES[0], 91)).toEqual(first);
    expect(first).toHaveLength(10);
    expect(new Set(first.map(({ id }) => id)).size).toBe(10);
    expect(first.slice(0, 3).every(({ paragraphId }) => paragraphId === 'opening')).toBe(true);
    expect(first.slice(3, 7).every(({ paragraphId }) => paragraphId === 'pressure')).toBe(true);
    expect(first.slice(7).every(({ paragraphId }) => paragraphId === 'climax')).toBe(true);
    expect(first.at(-1)?.id).toBe('s1-climax-final');
    const variants = new Set(Array.from({ length: 16 }, (_, seed) => (
      JSON.stringify(resolveStageFormationOrder(STAGES[0], seed).map(({ id }) => id))
    )));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('emits catalog footprints, identity, world positions, speed, and paragraph HP', () => {
    const stage = STAGES[1];
    const paragraph = stage.paragraphs[1];
    const formationId = paragraph.formationIds[0]!;
    const result = createAuthoredFormation(stage, paragraph, formationId);
    const cells = occupiedCells(result.enemies);
    const catalogByKind = new Map(ENEMY_CATALOG.map((entry) => [entry.kind, entry]));

    expect(result.id).toBe(formationId);
    expect(new Set(cells).size).toBe(cells.length);
    expect(result.populationCost).toBe(cells.length);
    expect(result.enemies.every((enemy) => (
      enemy.column >= 0
      && enemy.row >= 0
      && enemy.column + enemy.width <= FORMATION_COLUMNS
      && Number.isFinite(enemy.x)
      && Number.isFinite(enemy.y)
      && enemy.y + enemy.height * GAME_TUNING.encounter.grid.cellHeight / 2 <= 0
    ))).toBe(true);
    expect(result.enemies.every((enemy) => {
      const catalog = catalogByKind.get(
        enemy.kind as (typeof ENEMY_CATALOG)[number]['kind'],
      )!;
      return enemy.width === catalog.width && enemy.height === catalog.height;
    })).toBe(true);
    expect(result.enemies.every((enemy) => (
      (enemy as FormationEnemySpec & { formationId: string }).formationId === formationId
      && enemy.speed === GAME_TUNING.enemies.descentSpeed
    ))).toBe(true);
    expect(result.enemies.every((enemy) => enemy.hp === GAME_TUNING.enemies.hp[enemy.kind] * (
      enemy.width * enemy.height >= 4
        ? stage.powerBand.eliteHpMultiplier * paragraph.eliteHpMultiplier
        : stage.powerBand.normalHpMultiplier * paragraph.normalHpMultiplier
    ))).toBe(true);
  });

  it('rejects unknown formations and invalid seeds', () => {
    expect(() => createAuthoredFormation(STAGES[0], STAGES[0].paragraphs[0], 'missing'))
      .toThrow('missing');
    expect(() => resolveStageFormationOrder(STAGES[0], -1))
      .toThrow('runSeed must be an unsigned 32-bit integer');
  });
});
