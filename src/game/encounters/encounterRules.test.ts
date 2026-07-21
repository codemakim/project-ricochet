import { describe, expect, it } from 'vitest';
import { GAME_TUNING } from '../config/gameTuning';
import { canSpawnReinforcement, threatConfigAt, threatPhaseForSection } from './encounterRules';

describe('encounter rules', () => {
  it.each([[0, 0], [59_999, 0], [60_000, 1], [120_000, 2], [180_000, 2]] as const)(
    'maps %ims to its tuned threat config', (elapsedMs, phase) => {
      const tuning = GAME_TUNING.encounter.phases[phase];
      expect(threatConfigAt(elapsedMs)).toEqual({
        phase,
        activeCap: tuning.activeCap,
        spawnIntervalMs: tuning.spawnIntervalMs,
      });
    },
  );

  it.each([
    [0, 0, 0],
    [0, 59_999, 0],
    [0, 60_000, 1],
    [0, 119_999, 1],
    [0, 120_000, 2],
    [1, 0, 1],
    [1, 59_999, 1],
    [1, 60_000, 2],
  ] as const)('maps section %i at %ims to phase %i', (section, elapsedMs, phase) => {
    expect(threatPhaseForSection(section, elapsedMs)).toBe(phase);
  });

  it('requires interval, top clearance, and capacity together', () => {
    const ready = {
      elapsedSinceSpawnMs: 8_000,
      spawnIntervalMs: 8_000,
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
});
