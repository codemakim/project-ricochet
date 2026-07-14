import { describe, expect, it } from 'vitest';
import { EncounterDirector } from './EncounterDirector';

describe('EncounterDirector', () => {
  const clearTop = { activeEnemies: 20, topmostEnemyY: 120 };

  it('releases one pending formation when all gates open', () => {
    const director = new EncounterDirector();
    expect(director.update(7_999, clearTop)).toBeNull();
    const formation = director.update(1, clearTop);
    expect(formation).toHaveLength(8);
    expect(director.getSnapshot()).toMatchObject({ spawnSequence: 1, elapsedSinceSpawnMs: 0 });
  });

  it('keeps a blocked spawn pending and releases it without another interval', () => {
    const director = new EncounterDirector();
    expect(director.update(8_000, { activeEnemies: 21, topmostEnemyY: 120 })).toBeNull();
    expect(director.update(16, clearTop)).toHaveLength(8);
  });

  it('never emits catch-up formations in one update', () => {
    const director = new EncounterDirector();
    expect(director.update(24_000, clearTop)).toHaveLength(8);
    expect(director.getSnapshot().spawnSequence).toBe(1);
    expect(director.update(0, clearTop)).toBeNull();
  });

  it('waits for top clearance even when time and capacity pass', () => {
    const director = new EncounterDirector();
    expect(director.update(8_000, { activeEnemies: 0, topmostEnemyY: 97 })).toBeNull();
    expect(director.update(0, { activeEnemies: 0, topmostEnemyY: 98 })).toHaveLength(8);
  });
});
