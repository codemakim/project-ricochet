import { beforeEach, describe, expect, it, vi } from 'vitest';

const createFormationSpy = vi.hoisted(() => vi.fn());

vi.mock('./formationRules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./formationRules')>();
  createFormationSpy.mockImplementation(actual.createReinforcementFormation);
  return { ...actual, createReinforcementFormation: createFormationSpy };
});

import { EncounterDirector } from './EncounterDirector';
import { createReinforcementFormation } from './formationRules';

describe('EncounterDirector', () => {
  const clearTop = { activeEnemies: 20, topmostEnemyY: 120 };

  beforeEach(() => {
    createFormationSpy.mockClear();
  });

  it('does not generate while interval or top clearance is blocked', () => {
    const director = new EncounterDirector(1234);

    expect(director.update(7_999, clearTop)).toBeNull();
    expect(director.update(1, { activeEnemies: 0, topmostEnemyY: 97 })).toBeNull();
    expect(director.update(1_000, { activeEnemies: 0, topmostEnemyY: 97 })).toBeNull();

    expect(createFormationSpy).not.toHaveBeenCalled();
  });

  it('generates once while capacity is blocked and admits the cached formation', () => {
    const director = new EncounterDirector(1234);
    const capacityBlocked = { activeEnemies: 24, topmostEnemyY: 120 };

    expect(director.update(8_000, capacityBlocked)).toBeNull();
    expect(director.update(16, capacityBlocked)).toBeNull();
    expect(director.update(16, capacityBlocked)).toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);

    expect(director.update(16, clearTop)).not.toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(1);
    expect(director.getSnapshot().spawnSequence).toBe(1);
  });

  it('regenerates a capacity-blocked pending formation when phase changes', () => {
    const director = new EncounterDirector(1234);

    expect(director.update(8_000, { activeEnemies: 32, topmostEnemyY: 120 })).toBeNull();
    expect(director.update(52_000, { activeEnemies: 40, topmostEnemyY: 120 })).toBeNull();
    expect(createFormationSpy).toHaveBeenNthCalledWith(1, 0, 0, 1234);
    expect(createFormationSpy).toHaveBeenNthCalledWith(2, 1, 0, 1234);

    expect(director.update(0, clearTop)).not.toBeNull();
    expect(createFormationSpy).toHaveBeenCalledTimes(2);
    expect(director.getSnapshot()).toMatchObject({ phase: 1, spawnSequence: 1 });
  });

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
