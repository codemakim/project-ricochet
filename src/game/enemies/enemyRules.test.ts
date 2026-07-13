import { describe, expect, it } from 'vitest';
import { canFire, createPrototypeFormation } from './enemyRules';

describe('prototype enemies', () => {
  it('creates the fixed 20-enemy staggered formation', () => {
    const formation = createPrototypeFormation();

    expect(formation).toHaveLength(20);
    expect(formation.filter((enemy) => enemy.kind === 'basic')).toHaveLength(14);
    expect(formation.filter((enemy) => enemy.kind === 'armored')).toHaveLength(3);
    expect(formation.filter((enemy) => enemy.kind === 'shooter')).toHaveLength(3);
    expect([...new Set(formation.map((enemy) => enemy.y))].sort((a, b) => a - b)).toEqual([
      80, 122, 164, 206, 248,
    ]);
    expect(formation.every((enemy) => enemy.x >= 36 && enemy.x <= 414)).toBe(true);
    expect(formation.every((enemy) => enemy.speed === 26)).toBe(true);
    expect(
      formation.every(
        (enemy) => enemy.hp === (enemy.kind === 'armored' ? 3 : 1),
      ),
    ).toBe(true);
  });

  it('leaves a different column gap in every row', () => {
    const formation = createPrototypeFormation();
    const columns = new Set(formation.map((enemy) => enemy.column));
    const rowSignatures = [80, 122, 164, 206, 248].map((y) => {
      const occupied = new Set(
        formation.filter((enemy) => enemy.y === y).map((enemy) => enemy.column),
      );

      expect(occupied.size).toBeLessThan(columns.size);
      return [...columns].filter((column) => !occupied.has(column)).sort((a, b) => a - b).join(',');
    });

    expect(columns.size).toBeGreaterThan(5);
    expect(new Set(rowSignatures)).toHaveLength(5);
  });

  it('caps shooters at two and bullets at twelve', () => {
    expect(canFire(0, 0)).toBe(true);
    expect(canFire(1, 11)).toBe(true);
    expect(canFire(2, 0)).toBe(false);
    expect(canFire(0, 12)).toBe(false);
  });
});
