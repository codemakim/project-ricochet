import { describe, expect, it } from 'vitest';
import { createEmptyAbilityRanks } from '../progression/progressionRules';
import { createRunConfig, createRunResult } from './runContract';

describe('run contract', () => {
  it('copies a one-core loadout and builds a terminal result', () => {
    const config = createRunConfig(
      ['echo'],
      7,
      'run-1',
      ['echo'],
      ['echo', 'conduction'],
      ['photon-orbit'],
    );
    const ranks = createEmptyAbilityRanks();
    const result = createRunResult(
      config,
      true,
      180_000,
      ['sentinel', 'hive', 'siege'],
      ranks,
      ['echo', 'conduction', 'split'],
      ['photon-orbit', 'resonant-swarm'],
    );

    expect(config.identity).toEqual({
      runId: 'run-1',
      battlefieldId: 'default',
      threatId: 'normal',
      seed: 7,
    });
    expect(config.unlockedCoreTypes).toEqual(['echo']);
    expect(config.discoveredCoreTypes).toEqual(['echo', 'conduction']);
    expect(config.discoveredFusionTypes).toEqual(['photon-orbit']);
    expect(result).toMatchObject({ success: true, loadout: ['echo'] });
    expect(result.discoveredCoreTypes).toEqual(['echo', 'conduction', 'split']);
    expect(result.discoveredFusionTypes).toEqual(['photon-orbit', 'resonant-swarm']);
    expect(result.loadout).not.toBe(config.loadout);
    expect(result.discoveredCoreTypes).not.toBe(config.discoveredCoreTypes);
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

  it('rejects unknown discoveries and unlocked cores missing from discovery', () => {
    expect(() => createRunConfig(
      ['echo'], 1, 'bad-core', ['echo'], ['echo', 'bad' as never], [],
    )).toThrow('discovered core list contains an unknown core');
    expect(() => createRunConfig(
      ['echo'], 1, 'bad-fusion', ['echo'], ['echo'], ['bad' as never],
    )).toThrow('discovered fusion list contains an unknown fusion');
    expect(() => createRunConfig(
      ['echo'], 1, 'missing', ['echo', 'inertia'], ['echo'], [],
    )).toThrow('unlocked cores must be discovered');
  });

  it('rejects invalid terminal results', () => {
    const config = createRunConfig(['echo'], 1, 'run-2');
    expect(() => createRunResult(config, true, 10, ['sentinel'], createEmptyAbilityRanks()))
      .toThrow('successful run must defeat siege');
  });
});
