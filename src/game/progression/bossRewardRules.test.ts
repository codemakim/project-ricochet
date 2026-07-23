import { describe, expect, it } from 'vitest';
import {
  BOSS_REWARD_IDS,
  SECOND_BOSS_REWARD_IDS,
  selectBossRewardOptions,
  type BossRewardId,
} from './bossRewardRules';

const noRanks = { firepower: 0, kinetic: 0, explosion: 0, split: 0 } as const;
const secondEvolutionIds = new Set<BossRewardId>(SECOND_BOSS_REWARD_IDS.slice(3));

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
    const options = selectBossRewardOptions('first', new Set(), noRanks, 17);

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
      expect(selectBossRewardOptions('first', new Set(), ranks, 4)).not.toContain('chain-warhead');
    }

    const eligible = Array.from({ length: 32 }, (_, seed) =>
      selectBossRewardOptions('first', new Set(), { ...noRanks, split: 1, explosion: 1 }, seed),
    ).flat();
    expect(eligible).toContain('chain-warhead');
  });

  it('excludes owned rewards and is deterministic for the same seed', () => {
    const owned = new Set<typeof BOSS_REWARD_IDS[number]>(['expanded-magazine']);
    const ranks = { ...noRanks, split: 1, explosion: 1 };

    const first = selectBossRewardOptions('first', owned, ranks, 9876);
    expect(first).toHaveLength(3);
    expect(first).not.toContain('expanded-magazine');
    expect(selectBossRewardOptions('first', owned, ranks, 9876)).toEqual(first);
  });

  it('rejects an eligible pool smaller than three after ownership and chain filtering', () => {
    const owned = new Set<typeof BOSS_REWARD_IDS[number]>([
      'expanded-magazine',
      'recovery-capacitor',
    ]);

    expect(() => selectBossRewardOptions('first', owned, noRanks, 9)).toThrow(
      new RangeError('at least 3 eligible boss rewards are required; received 1'),
    );
  });

  it('defines the seven second-tier reward ids', () => {
    expect(SECOND_BOSS_REWARD_IDS).toEqual([
      'auxiliary-orbit',
      'recovery-salvo',
      'siege-resonance',
      'hyperpressure-core',
      'inertial-penetration',
      'aftershock-explosion',
      'chain-split',
    ]);
  });

  it('selects the three universal second-tier rewards when no evolution is eligible', () => {
    const options = selectBossRewardOptions('second', new Set(), noRanks, 91);

    expect(options).toHaveLength(3);
    expect(new Set(options).size).toBe(3);
    expect(options).toEqual(expect.arrayContaining([
      'auxiliary-orbit',
      'recovery-salvo',
      'siege-resonance',
    ]));
  });

  it('is deterministic, excludes owned rewards, and guarantees an eligible evolution', () => {
    const ranks = { firepower: 1, kinetic: 2, explosion: 0, split: 0 };
    const owned = new Set<BossRewardId>(['auxiliary-orbit']);
    const first = selectBossRewardOptions('second', owned, ranks, 314159);

    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
    expect(first).not.toContain('auxiliary-orbit');
    expect(first.some((id) =>
      id === 'hyperpressure-core' || id === 'inertial-penetration',
    )).toBe(true);
    expect(first).not.toContain('aftershock-explosion');
    expect(first).not.toContain('chain-split');
    expect(selectBossRewardOptions('second', owned, ranks, 314159)).toEqual(first);
  });

  it.each([
    ['firepower', 'hyperpressure-core'],
    ['kinetic', 'inertial-penetration'],
    ['explosion', 'aftershock-explosion'],
    ['split', 'chain-split'],
  ] as const)('only admits the %s evolution when its rank is positive', (rank, reward) => {
    const ranks = { ...noRanks, [rank]: 1 };
    for (let seed = 0; seed < 20; seed += 1) {
      const options = selectBossRewardOptions('second', new Set(), ranks, seed);
      expect(options).toContain(reward);
      expect(options.filter((id) => secondEvolutionIds.has(id))).toEqual([reward]);
    }
  });

  it('excludes an owned eligible evolution from the second-tier pool', () => {
    const options = selectBossRewardOptions(
      'second',
      new Set<BossRewardId>(['chain-split']),
      { firepower: 1, kinetic: 1, explosion: 1, split: 1 },
      812,
    );

    expect(options).not.toContain('chain-split');
    expect(options.some((id) => secondEvolutionIds.has(id))).toBe(true);
  });

  it('throws a descriptive invariant when ownership leaves fewer than three second rewards', () => {
    const owned = new Set<BossRewardId>([
      'auxiliary-orbit',
      'recovery-salvo',
      'hyperpressure-core',
      'inertial-penetration',
      'aftershock-explosion',
      'chain-split',
    ]);

    expect(() => selectBossRewardOptions(
      'second',
      owned,
      { ...noRanks, firepower: 1 },
      1,
    )).toThrow('second boss reward selection requires exactly 3 distinct eligible rewards');
  });
});
