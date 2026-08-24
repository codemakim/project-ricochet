import { describe, expect, it } from 'vitest';
import {
  ENEMY_CATALOG,
  FORMATION_PROFILES,
  FORMATION_TEMPLATES,
  STAGES,
  validateStageContent,
} from './stageDefinitions';
import { FORMATION_COLUMNS } from './formationGrid';

describe('stage content', () => {
  it('defines three ordered boss stages without increasing descent speed', () => {
    expect(STAGES.map(({ id, number, boss }) => [id, number, boss.kind])).toEqual([
      ['default-1', 1, 'sentinel'],
      ['default-2', 2, 'hive'],
      ['default-3', 3, 'siege'],
    ]);
    expect(STAGES.every(({ descentSpeedMultiplier }) =>
      descentSpeedMultiplier === 1)).toBe(true);
    expect(STAGES.map(({ powerBand }) => powerBand)).toEqual([
      {
        expectedOrbCount: 3,
        normalHpMultiplier: 1.3,
        eliteHpMultiplier: 1.5,
        largeEnemyRatio: 0.12,
      },
      {
        expectedOrbCount: 6,
        normalHpMultiplier: 1.9,
        eliteHpMultiplier: 2.2,
        largeEnemyRatio: 0.22,
      },
      {
        expectedOrbCount: 6,
        normalHpMultiplier: 2.4,
        eliteHpMultiplier: 2.8,
        largeEnemyRatio: 0.32,
      },
    ]);
    expect(STAGES.map(({ phases }) => phases.map((phase) => ({
      activeCap: phase.activeCap,
      spawnIntervalMs: phase.spawnIntervalMs,
      reinforcementReleaseY: phase.reinforcementReleaseY,
      shooterWeight: phase.enemyWeightMultipliers?.shooter,
      shooterMaximum: phase.maxPerFormationOverrides?.shooter,
    })))).toEqual([
      [
        { activeCap: 12, spawnIntervalMs: 5_000, reinforcementReleaseY: 50, shooterWeight: 1, shooterMaximum: 1 },
        { activeCap: 18, spawnIntervalMs: 5_500, reinforcementReleaseY: 0, shooterWeight: 3, shooterMaximum: 2 },
        { activeCap: 22, spawnIntervalMs: 5_000, reinforcementReleaseY: 0, shooterWeight: 4, shooterMaximum: 3 },
      ],
      [
        { activeCap: 22, spawnIntervalMs: 5_000, reinforcementReleaseY: 0, shooterWeight: 4, shooterMaximum: 3 },
        { activeCap: 26, spawnIntervalMs: 4_500, reinforcementReleaseY: 0, shooterWeight: 5, shooterMaximum: 4 },
      ],
      [
        { activeCap: 24, spawnIntervalMs: 5_500, reinforcementReleaseY: 50, shooterWeight: 3, shooterMaximum: 3 },
        { activeCap: 28, spawnIntervalMs: 5_000, reinforcementReleaseY: 50, shooterWeight: 4, shooterMaximum: 4 },
        { activeCap: 30, spawnIntervalMs: 4_500, reinforcementReleaseY: 50, shooterWeight: 5, shooterMaximum: 5 },
      ],
    ]);
  });

  it('defines approved enemy footprints and reusable chunk profiles', () => {
    expect(Object.fromEntries(ENEMY_CATALOG.map(({ kind, width, height }) => (
      [kind, `${width}×${height}`]
    )))).toEqual({
      basic: '1×1',
      armored: '2×2',
      shooter: '1×1',
      splitter: '2×1',
    });
    expect(FORMATION_PROFILES.every((profile) => (
      profile.rowMinimum >= 2
      && profile.rowMaximum <= 5
      && profile.cellMinimum <= profile.cellMaximum
    ))).toBe(true);
    expect(FORMATION_PROFILES.map(({ cellMinimum, cellMaximum }) => (
      [cellMinimum, cellMaximum]
    ))).toEqual([[5, 8], [7, 11], [9, 14], [11, 17]]);
    expect(FORMATION_TEMPLATES.map(({ id }) => id)).toEqual([
      'staggered-lanes',
      'side-fort',
      'split-gate',
      'broken-wall',
    ]);
    for (const template of FORMATION_TEMPLATES) {
      const occupied = template.slots.reduce((cells, slot) => {
        for (let row = slot.row; row < slot.row + slot.height; row += 1) {
          for (let column = slot.column; column < slot.column + slot.width; column += 1) {
            cells.add(`${row}:${column}`);
          }
        }
        return cells;
      }, new Set<string>());
      expect(Math.max(...template.slots.map((slot) => slot.column + slot.width)))
        .toBeLessThanOrEqual(FORMATION_COLUMNS);
      expect(occupied.size).toBeLessThan(template.rows * FORMATION_COLUMNS);
    }
    expect(() => validateStageContent()).not.toThrow();
  });

  it('rejects a template footprint outside the configured columns', () => {
    const invalid = {
      id: 'invalid',
      mode: 'fixed',
      rows: 2,
      minStage: 1,
      weight: 1,
      slots: [{ kind: 'basic', column: FORMATION_COLUMNS, row: 0, width: 1, height: 1 }],
    } as const;

    expect(() => validateStageContent(
      STAGES,
      ENEMY_CATALOG,
      FORMATION_PROFILES,
      [...FORMATION_TEMPLATES, invalid],
    )).toThrow('formation footprint is outside the grid');
  });

  it('rejects overlapping template slots', () => {
    const invalid = {
      id: 'overlap',
      mode: 'mixed',
      rows: 3,
      minStage: 1,
      weight: 1,
      slots: [
        { column: 1, row: 0, width: 2, height: 2 },
        { column: 2, row: 1, width: 1, height: 1 },
      ],
    } as const;

    expect(() => validateStageContent(
      STAGES,
      ENEMY_CATALOG,
      FORMATION_PROFILES,
      [...FORMATION_TEMPLATES, invalid],
    )).toThrow('formation footprints overlap');
  });

  it('rejects profiles outside two-to-five rows', () => {
    const invalid = { ...FORMATION_PROFILES[0]!, rowMaximum: 6 };

    expect(() => validateStageContent(
      STAGES,
      ENEMY_CATALOG,
      [invalid, ...FORMATION_PROFILES.slice(1)],
    )).toThrow('opening rows must stay between two and five');
  });

  it('requires phase capacity to fit its occupied-cell profile', () => {
    const stage = {
      ...STAGES[0]!,
      phases: [{ ...STAGES[0]!.phases[0]!, activeCap: 1 }, ...STAGES[0]!.phases.slice(1)],
    };

    expect(() => validateStageContent([stage, STAGES[1]!, STAGES[2]!]))
      .toThrow('default-1 phase cap must fit its profile');
  });

  it('rejects a non-finite phase reinforcement release line', () => {
    const stage = {
      ...STAGES[0]!,
      phases: [
        { ...STAGES[0]!.phases[0]!, reinforcementReleaseY: Number.NaN },
        ...STAGES[0]!.phases.slice(1),
      ],
    };

    expect(() => validateStageContent([stage, STAGES[1]!, STAGES[2]!]))
      .toThrow('default-1.reinforcementReleaseY must be finite and non-negative');
  });

  it('rejects profiles whose minimum cells cannot fit around a passage', () => {
    const invalid = { ...FORMATION_PROFILES[0]!, cellMinimum: 14, cellMaximum: 14 };

    expect(() => validateStageContent(
      STAGES,
      ENEMY_CATALOG,
      [invalid, ...FORMATION_PROFILES.slice(1)],
    )).toThrow('opening cannot fit its passage and minimum cells');
  });
});
