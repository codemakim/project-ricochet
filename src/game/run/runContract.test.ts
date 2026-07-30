import { describe, expect, it } from 'vitest';
import { createEmptyAbilityRanks } from '../progression/progressionRules';
import { createRunConfig, createRunResult } from './runContract';

describe('run contract', () => {
  it('copies a one-core loadout and builds a terminal result', () => {
    const config = createRunConfig(['echo'], 7, 'run-1', ['echo', 'inertia']);
    const ranks = createEmptyAbilityRanks();
    const result = createRunResult(config, true, 180_000, ['sentinel', 'hive', 'siege'], ranks);

    expect(config.identity).toEqual({
      runId: 'run-1',
      battlefieldId: 'default',
      threatId: 'normal',
      seed: 7,
    });
    expect(config.unlockedCoreTypes).toEqual(['echo', 'inertia']);
    expect(result).toMatchObject({ success: true, loadout: ['echo'] });
    expect(result.loadout).not.toBe(config.loadout);
    expect(result.buildRanks).not.toBe(ranks);
  });

  it('rejects loadouts that do not contain exactly one core', () => {
    expect(() => createRunConfig([], 7, 'run-empty'))
      .toThrow('run loadout must contain exactly one core');
    expect(() => createRunConfig(['echo', 'inertia'], 7, 'run-many'))
      .toThrow('run loadout must contain exactly one core');
  });

  it('rejects a starting core outside the unlocked choices', () => {
    expect(() => createRunConfig(['inertia'], 7, 'run-locked', ['echo']))
      .toThrow('starting core must be unlocked');
  });

  it('rejects invalid terminal results', () => {
    const config = createRunConfig(['echo'], 1, 'run-2');
    expect(() => createRunResult(config, true, 10, ['sentinel'], createEmptyAbilityRanks()))
      .toThrow('successful run must defeat siege');
  });
});
