import { describe, expect, it } from 'vitest';
import { canSpawnReinforcement, threatConfigAt } from './encounterRules';

describe('encounter rules', () => {
  it.each([
    [0, { phase: 0, activeCap: 22, spawnIntervalMs: 8_000 }],
    [59_999, { phase: 0, activeCap: 22, spawnIntervalMs: 8_000 }],
    [60_000, { phase: 1, activeCap: 26, spawnIntervalMs: 7_000 }],
    [120_000, { phase: 2, activeCap: 30, spawnIntervalMs: 6_000 }],
    [180_000, { phase: 2, activeCap: 30, spawnIntervalMs: 6_000 }],
  ] as const)('maps %ims to its threat config', (elapsedMs, expected) => {
    expect(threatConfigAt(elapsedMs)).toEqual(expected);
  });

  it('requires interval, top clearance, and capacity together', () => {
    const ready = {
      elapsedSinceSpawnMs: 8_000,
      spawnIntervalMs: 8_000,
      topmostEnemyY: 120,
      requiredTopmostY: 98,
      activeEnemies: 16,
      incomingEnemies: 6,
      activeCap: 22,
    };

    expect(canSpawnReinforcement(ready)).toBe(true);
    expect(canSpawnReinforcement({ ...ready, elapsedSinceSpawnMs: 7_999 })).toBe(false);
    expect(canSpawnReinforcement({ ...ready, topmostEnemyY: 97 })).toBe(false);
    expect(canSpawnReinforcement({ ...ready, activeEnemies: 17 })).toBe(false);
    expect(canSpawnReinforcement({ ...ready, topmostEnemyY: Number.POSITIVE_INFINITY })).toBe(true);
  });
});
