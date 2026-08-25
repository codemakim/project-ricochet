import { describe, expect, it } from 'vitest';
import type { StageDefinition } from './stageDefinitions';
import { STAGES } from './stageDefinitions';
import { canSpawnReinforcement, phaseAt } from './encounterRules';

describe('encounter rules', () => {
  it('selects arbitrary stage-local phases at exact boundaries', () => {
    const stage: StageDefinition = {
      ...STAGES[0],
      phases: [
        { ...STAGES[0].phases[0], startsAtScore: 0 },
        { ...STAGES[0].phases[0], startsAtScore: 10 },
        { ...STAGES[0].phases[0], startsAtScore: 20 },
        { ...STAGES[0].phases[0], startsAtScore: 30 },
      ],
    };

    for (const [score, index] of [
      [0, 0], [9, 0], [10, 1], [19, 1], [20, 2], [29, 2], [30, 3], [999, 3],
    ] as const) {
      expect(phaseAt(stage, score)).toEqual({
        index,
        definition: stage.phases[index],
      });
    }
  });

  it('pulls stage-one pressure forward at its kill-score boundary', () => {
    expect(phaseAt(STAGES[0], 24).index).toBe(0);
    expect(phaseAt(STAGES[0], 25).index).toBe(1);
  });

  it('requires interval, top clearance, and capacity together', () => {
    const ready = {
      elapsedSinceSpawnMs: 8_000,
      spawnIntervalMs: 8_000,
      emptyRespawnMs: 800,
      topmostEnemyY: 120,
      requiredTopmostY: 98,
      activeEnemies: 21,
      incomingEnemies: 11,
      activeCap: 32,
    };

    expect(canSpawnReinforcement(ready)).toBe(true);
    expect(canSpawnReinforcement({ ...ready, elapsedSinceSpawnMs: 7_999 })).toBe(false);
    expect(canSpawnReinforcement({ ...ready, topmostEnemyY: 97 })).toBe(false);
    expect(canSpawnReinforcement({ ...ready, activeEnemies: 22 })).toBe(false);
    expect(canSpawnReinforcement({ ...ready, topmostEnemyY: Number.POSITIVE_INFINITY })).toBe(true);
  });

  it('releases an empty battlefield after the emergency delay', () => {
    const empty = {
      elapsedSinceSpawnMs: 799,
      spawnIntervalMs: 5_000,
      emptyRespawnMs: 800,
      topmostEnemyY: Number.POSITIVE_INFINITY,
      requiredTopmostY: 50,
      activeEnemies: 0,
      incomingEnemies: 9,
      activeCap: 12,
    };

    expect(canSpawnReinforcement(empty)).toBe(false);
    expect(canSpawnReinforcement({ ...empty, elapsedSinceSpawnMs: 800 })).toBe(true);
  });
});
