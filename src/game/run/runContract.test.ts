import { describe, expect, it } from 'vitest';
import { createEmptyAbilityRanks } from '../progression/progressionRules';
import { createRunConfig, createRunResult } from './runContract';

describe('run contract', () => {
  it('copies a three-core loadout and builds a terminal result', () => {
    const config = createRunConfig(['echo', 'conduction', 'echo'], 7, 'run-1');
    const ranks = createEmptyAbilityRanks();
    const result = createRunResult(config, true, 180_000, ['sentinel', 'hive', 'siege'], ranks);

    expect(config.identity).toEqual({
      runId: 'run-1',
      battlefieldId: 'default',
      threatId: 'normal',
      seed: 7,
    });
    expect(result).toMatchObject({ success: true, loadout: ['echo', 'conduction', 'echo'] });
    expect(result.loadout).not.toBe(config.loadout);
    expect(result.buildRanks).not.toBe(ranks);
  });

  it('rejects invalid terminal results', () => {
    const config = createRunConfig(['echo', 'echo', 'echo'], 1, 'run-2');
    expect(() => createRunResult(config, true, 10, ['sentinel'], createEmptyAbilityRanks()))
      .toThrow('successful run must defeat siege');
  });
});
