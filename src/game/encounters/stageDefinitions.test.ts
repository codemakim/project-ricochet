import { describe, expect, it } from 'vitest';
import {
  ENEMY_CATALOG,
  FORMATION_PROFILES,
  FORMATION_TEMPLATES,
  STAGES,
  validateStageContent,
} from './stageDefinitions';

describe('stage content', () => {
  it('defines three ordered boss stages without increasing descent speed', () => {
    expect(STAGES.map(({ id, number, boss }) => [id, number, boss.kind])).toEqual([
      ['default-1', 1, 'sentinel'],
      ['default-2', 2, 'hive'],
      ['default-3', 3, 'siege'],
    ]);
    expect(STAGES.every(({ descentSpeedMultiplier }) =>
      descentSpeedMultiplier === 1)).toBe(true);
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
    expect(FORMATION_TEMPLATES.map(({ id }) => id)).toEqual([
      'staggered-lanes',
      'side-fort',
      'split-gate',
      'broken-wall',
    ]);
    expect(() => validateStageContent()).not.toThrow();
  });

  it('rejects a template footprint outside eight columns', () => {
    const invalid = {
      id: 'invalid',
      mode: 'fixed',
      rows: 2,
      minStage: 1,
      weight: 1,
      slots: [{ kind: 'basic', column: 7, row: 0, width: 2, height: 1 }],
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
});
