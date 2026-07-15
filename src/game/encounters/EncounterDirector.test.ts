import { describe, expect, it } from 'vitest';
import { EncounterDirector } from './EncounterDirector';
import { createReinforcementFormation } from './formationRules';

describe('EncounterDirector', () => {
  const clearTop = { activeEnemies: 20, topmostEnemyY: 120 };

  it('releases one seeded phase-0 formation and records its metadata', () => {
    const director = new EncounterDirector(1234);
    expect(director.update(7_999, clearTop)).toBeNull();
    const formation = director.update(1, clearTop);
    expect(formation?.length).toBeGreaterThanOrEqual(9);
    expect(formation?.length).toBeLessThanOrEqual(11);
    const expected = createReinforcementFormation(0, 0, 1234);
    expect(formation).toEqual(expected.enemies);
    expect(director.getSnapshot()).toMatchObject({
      runSeed: 1234,
      lastFormationId: expected.id,
      spawnSequence: 1,
      elapsedSinceSpawnMs: 0,
    });
  });

  it('keeps a blocked spawn pending and releases it without another interval', () => {
    const director = new EncounterDirector(1234);
    expect(director.update(8_000, { activeEnemies: 24, topmostEnemyY: 120 })).toBeNull();
    expect(director.getSnapshot()).toMatchObject({
      spawnSequence: 0,
      lastFormationId: null,
    });
    const formation = director.update(16, clearTop);
    expect(formation?.length).toBeGreaterThanOrEqual(9);
    expect(formation?.length).toBeLessThanOrEqual(11);
  });

  it('never emits catch-up formations in one update', () => {
    const director = new EncounterDirector(1234);
    expect(director.update(24_000, clearTop)).not.toBeNull();
    expect(director.getSnapshot().spawnSequence).toBe(1);
    expect(director.update(0, clearTop)).toBeNull();
  });

  it('waits for top clearance even when time and capacity pass', () => {
    const director = new EncounterDirector(1234);
    expect(director.update(8_000, { activeEnemies: 0, topmostEnemyY: 97 })).toBeNull();
    expect(director.update(0, { activeEnemies: 0, topmostEnemyY: 98 })).not.toBeNull();
  });

  it('emits different consecutive admitted formations', () => {
    const director = new EncounterDirector(1234);
    const first = director.update(8_000, clearTop);
    const firstId = director.getSnapshot().lastFormationId;
    const second = director.update(8_000, clearTop);
    const secondId = director.getSnapshot().lastFormationId;

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second).not.toEqual(first);
    expect(secondId).not.toBe(firstId);
  });
});
