import { describe, expect, it } from 'vitest';
import {
  createInitialFormation,
  createReinforcementFormation,
  generateFormation,
  type FormationStyle,
} from './formationRules';

const ORGANIC = ['cluster', 'pockets', 'bands', 'scatter'] as const;

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
      expect(enemies.every(({ speed }) => speed === 18)).toBe(true);
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
      expect(createReinforcementFormation(1, sequence, 321))
        .toEqual(createReinforcementFormation(1, sequence, 321));
    }
  });

  it('changes initial or first-bag public layouts for different run seeds', () => {
    const publicLayouts = (runSeed: number) => [
      createInitialFormation(runSeed),
      ...Array.from({ length: 9 }, (_, sequence) =>
        createReinforcementFormation(1, sequence, runSeed)),
    ].map(({ style, enemies }) => ({
      style,
      coordinates: enemies.map(({ x, y }) => [x, y]),
    }));
    expect(publicLayouts(100)).not.toEqual(publicLayouts(101));
  });

  it('creates non-grid 20-enemy initial formations', () => {
    for (let seed = 0; seed < 16; seed += 1) {
      const result = createInitialFormation(seed);
      expect(result.enemies).toHaveLength(20);
      expect(result.style).not.toBe('grid');
      expect(result.enemies.filter(({ kind }) => kind === 'armored')).toHaveLength(3);
      expect(result.enemies.filter(({ kind }) => kind === 'shooter')).toHaveLength(3);
    }
  });

  it.each([[0, 9, 11], [1, 11, 13], [2, 13, 15]] as const)(
    'keeps phase %i within %i..%i', (phase, minimum, maximum) => {
      for (let sequence = 0; sequence < 27; sequence += 1) {
        const size = createReinforcementFormation(phase, sequence, 99).enemies.length;
        expect(size).toBeGreaterThanOrEqual(minimum);
        expect(size).toBeLessThanOrEqual(maximum);
      }
    },
  );

  it('uses a 2/2/2/2/1 bag and never repeats adjacent styles', () => {
    const styles = Array.from({ length: 27 }, (_, sequence) =>
      createReinforcementFormation((sequence % 3) as 0 | 1 | 2, sequence, 808).style);
    for (let start = 0; start < styles.length; start += 9) {
      const counts = styles.slice(start, start + 9).reduce<Record<FormationStyle, number>>(
        (result, style) => ({ ...result, [style]: result[style] + 1 }),
        { cluster: 0, pockets: 0, bands: 0, scatter: 0, grid: 0 },
      );
      expect(counts).toEqual({ cluster: 2, pockets: 2, bands: 2, scatter: 2, grid: 1 });
    }
    expect(styles.every((style, index) => index === 0 || style !== styles[index - 1])).toBe(true);
  });

  it('does not lower special-enemy pressure by phase', () => {
    for (let sequence = 0; sequence < 27; sequence += 1) {
      const specialCount = (phase: 0 | 1 | 2) =>
        createReinforcementFormation(phase, sequence, 55).enemies
          .filter(({ kind }) => kind !== 'basic').length;
      expect(specialCount(1)).toBeGreaterThanOrEqual(specialCount(0));
      expect(specialCount(2)).toBeGreaterThanOrEqual(specialCount(1));
    }
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
      expect(() => createReinforcementFormation(0, 0, seed))
        .toThrowError(new RangeError('runSeed must be an unsigned 32-bit integer'));
    }
    for (const sequence of [-1, 1.5]) {
      expect(() => createReinforcementFormation(0, sequence, 1))
        .toThrowError(new RangeError('sequence must be a non-negative integer'));
    }
  });
});
