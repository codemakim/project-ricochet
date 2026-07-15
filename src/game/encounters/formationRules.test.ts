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
