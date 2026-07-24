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
});
