import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import {
  createInitialFormation,
  createReinforcementFormation,
  generateFormation,
  type FormationRecipe,
  type FormationStyle,
} from './formationRules';
import { populationCostForEnemy } from '../enemies/splitterRules';
import { ENEMY_CATALOG, FORMATION_PROFILES, STAGES } from './stageDefinitions';

const ORGANIC = ['cluster', 'pockets', 'bands', 'scatter'] as const;

function recipe(stageIndex = 0, phaseIndex = 0): FormationRecipe {
  const stage = STAGES[stageIndex]!;
  const stagePhase = stage.phases[phaseIndex]!;
  return {
    stageNumber: stage.number,
    battlefield: stage.battlefield,
    profile: FORMATION_PROFILES.find(({ id }) => id === stagePhase.formationProfileId)!,
    enemyWeightMultipliers: stagePhase.enemyWeightMultipliers,
    maxPerFormationOverrides: stagePhase.maxPerFormationOverrides,
    hpMultiplier: stage.hpMultiplier,
    descentSpeedMultiplier: stage.descentSpeedMultiplier,
  };
}

function hasAdjacentPair(enemies: ReturnType<typeof generateFormation>): boolean {
  return enemies.some((enemy, index) => enemies.slice(index + 1).some((other) =>
    (enemy.y === other.y && Math.abs(enemy.column - other.column) === 1)
      || (enemy.column === other.column && Math.abs(enemy.y - other.y) === 42),
  ));
}

function hasWideGap(enemies: ReturnType<typeof generateFormation>): boolean {
  const rows = new Map<number, number[]>();
  for (const enemy of enemies) {
    rows.set(enemy.y, [...(rows.get(enemy.y) ?? []), enemy.column]);
  }
  return [...rows.values()].some((columns) => {
    const sorted = columns.sort((left, right) => left - right);
    return sorted.some((column, index) => index > 0 && column - sorted[index - 1]! >= 3);
  });
}

function diagonalComponentSizes(enemies: ReturnType<typeof generateFormation>): number[] {
  const remaining = new Set(enemies.map((_, index) => index));
  const sizes: number[] = [];
  while (remaining.size > 0) {
    const start = remaining.values().next().value as number;
    const queue = [start];
    remaining.delete(start);
    let size = 0;
    while (queue.length > 0) {
      const index = queue.pop()!;
      size += 1;
      const enemy = enemies[index]!;
      for (const otherIndex of [...remaining]) {
        const other = enemies[otherIndex]!;
        const rowDistance = Math.abs(enemy.y - other.y) / 42;
        const columnDistance = Math.abs(enemy.column - other.column);
        if (rowDistance <= 1 && columnDistance <= 1) {
          remaining.delete(otherIndex);
          queue.push(otherIndex);
        }
      }
    }
    sizes.push(size);
  }
  return sizes;
}

describe('procedural formation generation', () => {
  it.each(ORGANIC)('%s generates exact, unique, safe counts', (style) => {
    for (const count of [9, 15, 20]) {
      const enemies = generateFormation(style, count, 1234, count === 20 ? 80 : -28);
      expect(enemies).toHaveLength(count);
      expect(new Set(enemies.map(({ x, y }) => `${x}:${y}`)).size).toBe(count);
      expect(enemies.every(({ x }) => x >= 36 && x <= 414)).toBe(true);
      expect(enemies.every(({ speed }) => speed === GAME_TUNING.enemies.descentSpeed)).toBe(true);
    }
  });

  it.each(ORGANIC)('%s preserves both local groups and wide gaps', (style) => {
    for (const seed of [0, 1, 17, 1234]) {
      const enemies = generateFormation(style, 15, seed, -28);
      expect(hasAdjacentPair(enemies)).toBe(true);
      expect(hasWideGap(enemies)).toBe(true);
    }
  });

  it('is deterministic but varies generated coordinates by seed', () => {
    expect(generateFormation('cluster', 20, 7, 80))
      .toEqual(generateFormation('cluster', 20, 7, 80));
    const layouts = new Set(Array.from({ length: 8 }, (_, seed) =>
      JSON.stringify(generateFormation('cluster', 20, seed, 80).map(({ x, y }) => [x, y]))));
    expect(layouts.size).toBeGreaterThan(4);
  });

  it('grows cluster members coherently from no more than three groups', () => {
    for (const seed of Array.from({ length: 4_096 }, (_, index) => index)) {
      for (const count of [9, 15, 20]) {
        const components = diagonalComponentSizes(generateFormation('cluster', count, seed, -28));
        expect(components.length, `seed ${seed}, count ${count}: ${components}`)
          .toBeLessThanOrEqual(3);
        expect(components.every((size) => size > 1), `seed ${seed}, count ${count}: ${components}`)
          .toBe(true);
      }
    }
  });

  it('reproduces public results for the same run seed and sequence', () => {
    expect(createInitialFormation(321)).toEqual(createInitialFormation(321));
    for (let sequence = 0; sequence < 9; sequence += 1) {
      expect(createReinforcementFormation(recipe(0, 1), sequence, 321))
        .toEqual(createReinforcementFormation(recipe(0, 1), sequence, 321));
    }
  });

  it('changes initial or first-bag public layouts for different run seeds', () => {
    const publicLayouts = (runSeed: number) => [
      createInitialFormation(runSeed),
      ...Array.from({ length: 9 }, (_, sequence) =>
        createReinforcementFormation(recipe(0, 1), sequence, runSeed)),
    ].map(({ style, enemies }) => ({
      style,
      coordinates: enemies.map(({ x, y }) => [x, y]),
    }));
    expect(publicLayouts(100)).not.toEqual(publicLayouts(101));
  });

  it('creates the tuned non-grid initial formation', () => {
    expect(Object.hasOwn(GAME_TUNING.encounter, 'initialFormation')).toBe(false);
    for (let seed = 0; seed < 16; seed += 1) {
      const result = createInitialFormation(seed);
      expect(result.enemies).toHaveLength(26);
      expect(result.style).not.toBe('grid');
      expect(result.enemies.filter(({ kind }) => kind === 'armored'))
        .toHaveLength(3);
      expect(result.enemies.filter(({ kind }) => kind === 'shooter'))
        .toHaveLength(3);
      expect(result.enemies.every(({ speed }) => speed === GAME_TUNING.enemies.descentSpeed)).toBe(true);
      expect(result.enemies.every(({ kind, hp }) => hp === GAME_TUNING.enemies.hp[kind])).toBe(true);
      expect(result.populationCost).toBe(
        result.enemies.reduce((sum, enemy) => sum + populationCostForEnemy(enemy.kind), 0),
      );
    }
  });

  it('keeps formation size within its selected profile range', () => {
    for (const selectedRecipe of [recipe(0, 0), recipe(0, 1), recipe(0, 2), recipe(1, 1)]) {
      const counts = Array.from({ length: 64 }, (_, sequence) =>
        createReinforcementFormation(selectedRecipe, sequence, 808).enemies.length);
      expect(Math.min(...counts)).toBe(selectedRecipe.profile.minimum);
      expect(Math.max(...counts)).toBe(selectedRecipe.profile.maximum);
    }
  });

  it('uses weighted styles without immediate repeats when another style exists', () => {
    const selectedRecipe = { ...recipe(), profile: {
      ...recipe().profile,
      styleWeights: { cluster: 5, pockets: 3, bands: 2 },
    } };
    const styles = Array.from({ length: 30 }, (_, sequence) =>
      createReinforcementFormation(selectedRecipe, sequence, 808).style);
    expect(styles.every((style, index) => index === 0 || style !== styles[index - 1])).toBe(true);
    for (let start = 0; start < styles.length; start += 10) {
      const counts = styles.slice(start, start + 10).reduce<Partial<Record<FormationStyle, number>>>(
        (result, style) => ({ ...result, [style]: (result[style] ?? 0) + 1 }),
        {},
      );
      expect(counts).toEqual({ cluster: 5, pockets: 3, bands: 2 });
    }
    expect(styles).toEqual(Array.from({ length: 30 }, (_, sequence) =>
      createReinforcementFormation(selectedRecipe, sequence, 808).style));
  });

  it('filters catalog kinds by stage and battlefield', () => {
    const result = createReinforcementFormation({
      ...recipe(),
      enemyWeightMultipliers: { basic: 1, armored: 0, shooter: 0, splitter: 100 },
    }, 0, 808);
    expect(result.enemies.every(({ kind }) => ENEMY_CATALOG.some((entry) =>
      entry.kind === kind && entry.minStage <= 1 && entry.battlefields.includes('default')))).toBe(true);
    expect(result.enemies.some(({ kind }) => kind === 'splitter' || kind === 'fragment')).toBe(false);
  });

  it('merges catalog caps with phase overrides, with phase caps winning', () => {
    const result = Array.from({ length: 64 }, (_, sequence) =>
      createReinforcementFormation({
        ...recipe(),
        enemyWeightMultipliers: { basic: 1, armored: 100, shooter: 0, splitter: 0 },
        maxPerFormationOverrides: { armored: 1, shooter: 0, splitter: 0 },
      }, sequence, 808));
    expect(result.every(({ enemies }) => enemies.filter(({ kind }) => kind === 'armored').length <= 1)).toBe(true);
  });

  it('applies recipe HP and descent speed multipliers', () => {
    const result = createReinforcementFormation({ ...recipe(), hpMultiplier: 2, descentSpeedMultiplier: 1.5 }, 0, 808);
    expect(result.enemies.every(({ kind, hp }) => hp === GAME_TUNING.enemies.hp[kind] * 2)).toBe(true);
    expect(result.enemies.every(({ speed }) => speed === GAME_TUNING.enemies.descentSpeed * 1.5)).toBe(true);
  });

  it('rejects invalid counts, seeds, and sequences with clear RangeErrors', () => {
    for (const count of [0, -1, 1.5]) {
      expect(() => generateFormation('cluster', count, 1, 80))
        .toThrowError(new RangeError('count must be a positive integer'));
    }
    for (const seed of [-1, 1.5, 0x1_0000_0000]) {
      expect(() => generateFormation('cluster', 9, seed, 80))
        .toThrowError(new RangeError('seed must be an unsigned 32-bit integer'));
      expect(() => createInitialFormation(seed))
        .toThrowError(new RangeError('runSeed must be an unsigned 32-bit integer'));
      expect(() => createReinforcementFormation(recipe(), 0, seed))
        .toThrowError(new RangeError('runSeed must be an unsigned 32-bit integer'));
    }
    for (const sequence of [-1, 1.5]) {
      expect(() => createReinforcementFormation(recipe(), sequence, 1))
        .toThrowError(new RangeError('sequence must be a non-negative integer'));
    }
  });
});
