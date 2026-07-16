import { describe, expect, it } from 'vitest';
import { BOSS_REWARD_IDS, selectBossRewardOptions } from './bossRewardRules';

const noRanks = { firepower: 0, kinetic: 0, explosion: 0, split: 0 } as const;

describe('bossRewardRules', () => {
  it('defines exactly four reward ids', () => {
    expect(BOSS_REWARD_IDS).toEqual([
      'expanded-magazine',
      'recovery-capacitor',
      'opening-amplifier',
      'chain-warhead',
    ]);
  });

  it('selects the three unique universal rewards when chain warhead is ineligible', () => {
    const options = selectBossRewardOptions(new Set(), noRanks, 17);

    expect(options).toHaveLength(3);
    expect(new Set(options).size).toBe(3);
    expect(options).toEqual(expect.arrayContaining([
      'expanded-magazine',
      'recovery-capacitor',
      'opening-amplifier',
    ]));
  });

  it('requires both split and explosion rank 1 for chain warhead', () => {
    for (const ranks of [
      { ...noRanks, split: 1 },
      { ...noRanks, explosion: 1 },
    ]) {
      expect(selectBossRewardOptions(new Set(), ranks, 4)).not.toContain('chain-warhead');
    }

    const eligible = Array.from({ length: 32 }, (_, seed) =>
      selectBossRewardOptions(new Set(), { ...noRanks, split: 1, explosion: 1 }, seed),
    ).flat();
    expect(eligible).toContain('chain-warhead');
  });

  it('excludes owned rewards and is deterministic for the same seed', () => {
    const owned = new Set<typeof BOSS_REWARD_IDS[number]>(['expanded-magazine']);
    const ranks = { ...noRanks, split: 1, explosion: 1 };

    const first = selectBossRewardOptions(owned, ranks, 9876);
    expect(first).toHaveLength(3);
    expect(first).not.toContain('expanded-magazine');
    expect(selectBossRewardOptions(owned, ranks, 9876)).toEqual(first);
  });
});
