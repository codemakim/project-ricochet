import { describe, expect, it } from 'vitest';
import {
  ENEMY_CATALOG,
  FORMATION_PROFILES,
  STAGES,
  validateStageContent,
} from './stageDefinitions';

describe('stage content', () => {
  it('defines the two existing boss sections as ordered stages', () => {
    expect(STAGES).toHaveLength(2);
    expect(STAGES.map(({ id, number, boss }) => [id, number, boss.kind]))
      .toEqual([['default-1', 1, 'sentinel'], ['default-2', 2, 'hive']]);
    expect(STAGES[0]!.phases.map(({ startsAtMs }) => startsAtMs)).toEqual([0, 60_000, 120_000]);
    expect(STAGES[1]!.phases.map(({ startsAtMs }) => startsAtMs)).toEqual([0, 60_000]);
    expect(STAGES[0]!.boss).toEqual({
      kind: 'sentinel', minimumMs: 120_000, scoreTarget: 70, hardMaximumMs: 210_000, warningMs: 2_000,
    });
    expect(STAGES[1]!.boss).toEqual({
      kind: 'hive', minimumMs: 150_000, scoreTarget: 110, hardMaximumMs: 210_000, warningMs: 2_000,
    });
    expect(STAGES.every(({ descentSpeedMultiplier }) => descentSpeedMultiplier === 1)).toBe(true);
  });

  it('uses valid profiles, legal pools, positive weights, and caps', () => {
    expect(FORMATION_PROFILES).not.toHaveLength(0);
    expect(ENEMY_CATALOG.map(({ kind }) => kind)).not.toContain('fragment');
    expect(() => validateStageContent()).not.toThrow();
    for (const stage of STAGES) {
      for (const phase of stage.phases) {
        expect(FORMATION_PROFILES.some(({ id }) => id === phase.formationProfileId)).toBe(true);
        expect(phase.activeCap).toBeGreaterThanOrEqual(
          FORMATION_PROFILES.find(({ id }) => id === phase.formationProfileId)!.maximum,
        );
      }
    }
    expect(ENEMY_CATALOG.every(({ weight, maxPerFormation }) =>
      weight > 0 && (maxPerFormation === undefined || maxPerFormation >= 0))).toBe(true);
  });

  it('rejects style weights that cannot be arranged without repeats', () => {
    const impossible = {
      id: 'impossible',
      styleWeights: { cluster: 2, pockets: 1 },
      minimum: 1,
      maximum: 1,
      allowedTags: [],
    };
    expect(() => validateStageContent(STAGES, ENEMY_CATALOG, [...FORMATION_PROFILES, impossible]))
      .toThrowError(new RangeError('impossible style weights cannot avoid repeats'));
  });

  it('rejects fractional style weights', () => {
    const fractional = {
      id: 'fractional',
      styleWeights: { cluster: 1.5, pockets: 1 },
      minimum: 1,
      maximum: 1,
      allowedTags: [],
    };
    expect(() => validateStageContent(STAGES, ENEMY_CATALOG, [...FORMATION_PROFILES, fractional]))
      .toThrowError(new RangeError('fractional.cluster must be an integer'));
  });

  it('rejects a filtered pool whose merged caps cannot fill a formation', () => {
    const capped = {
      ...FORMATION_PROFILES[0]!,
      allowedTags: ['armored'] as const,
      minimum: 3,
      maximum: 3,
    };
    expect(() => validateStageContent(STAGES, ENEMY_CATALOG, [capped, ...FORMATION_PROFILES.slice(1)]))
      .toThrowError(new RangeError('default-1 phase cannot fill its profile'));
  });

  it('rejects a phase whose worst eligible population exceeds its active cap', () => {
    const stage = {
      ...STAGES[1]!,
      phases: [STAGES[1]!.phases[0]!, { ...STAGES[1]!.phases[1]!, activeCap: 26 }],
    };
    expect(() => validateStageContent([STAGES[0]!, stage]))
      .toThrowError(new RangeError('default-2 phase cap must fit worst population'));
  });

  it('merges stage, profile, and phase tag filters when validating the pool', () => {
    const taggedProfile = { ...FORMATION_PROFILES[0]!, allowedTags: ['armored'] as const };
    const stage = {
      ...STAGES[0]!,
      allowedTags: ['standard'] as const,
      phases: [{ ...STAGES[0]!.phases[0]!, allowedTags: ['shooter'] as const }, ...STAGES[0]!.phases.slice(1)],
    };
    expect(() => validateStageContent([stage, STAGES[1]!], ENEMY_CATALOG,
      [taggedProfile, ...FORMATION_PROFILES.slice(1)]))
      .toThrowError(new RangeError('default-1 phase needs an eligible enemy'));
  });
});
