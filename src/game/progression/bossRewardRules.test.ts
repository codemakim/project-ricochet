import { describe, expect, it } from 'vitest';
import { createEmptyAbilityRanks } from './progressionRules';
import {
  BOSS_REWARD_IDS,
  selectBossRewardOptions,
  type BossRewardContext,
  type BossRewardId,
} from './bossRewardRules';

function context(
  ranks: Partial<ReturnType<typeof createEmptyAbilityRanks>> = {},
  coreTypes: BossRewardContext['coreTypes'] = ['echo'],
  ownedRewards: BossRewardId[] = [],
): BossRewardContext {
  return {
    ranks: { ...createEmptyAbilityRanks(), ...ranks },
    coreTypes,
    ownedRewards: new Set(ownedRewards),
  };
}

describe('bossRewardRules', () => {
  it('defines the nine approved build-relevant relics', () => {
    expect(BOSS_REWARD_IDS).toEqual([
      'auxiliary-link',
      'cross-cut',
      'gas-ignition',
      'recursive-split',
      'inertia-retention',
      'complete-cycle',
      'direct-link',
      'superconducting-circuit',
      'resonance-rupture',
    ]);
  });

  it('admits relics only when their build prerequisites are present', () => {
    const choices = Array.from({ length: 64 }, (_, seed) => selectBossRewardOptions(
      context({
        split: 1,
        explosion: 1,
        'horizontal-cutter': 1,
        'reload-overcharge': 1,
      }, ['echo', 'corrosion', 'conduction', 'inertia']),
      seed,
    )).flat();
    const relics = choices.flatMap((choice) => choice.kind === 'relic' ? [choice.id] : []);

    expect(new Set(relics)).toEqual(new Set(BOSS_REWARD_IDS));
    expect(selectBossRewardOptions(context({
      firepower: 1,
      kinetic: 1,
      explosion: 1,
      'armor-reinforcement': 1,
    }, []), 4))
      .toEqual(expect.not.arrayContaining([
        expect.objectContaining({ kind: 'relic' }),
      ]));
  });

  it('excludes owned relics and is deterministic', () => {
    const build = context(
      { split: 1, explosion: 1, 'reload-overcharge': 1 },
      ['echo', 'inertia'],
      ['recursive-split'],
    );
    const first = selectBossRewardOptions(build, 9876);

    expect(first).toHaveLength(3);
    expect(new Set(first.map((choice) => `${choice.kind}:${choice.id}`)).size).toBe(3);
    expect(first).not.toContainEqual({ kind: 'relic', id: 'recursive-split' });
    expect(selectBossRewardOptions(build, 9876)).toEqual(first);
  });

  it('fills an undersized relic pool with owned non-max ability ranks', () => {
    const choices = selectBossRewardOptions(context({
      firepower: 1,
      kinetic: 1,
      'armor-reinforcement': 1,
    }, []), 17);

    expect(choices).toHaveLength(3);
    expect(choices.every((choice) => choice.kind === 'ability-rank')).toBe(true);
    expect(new Set(choices.map(({ id }) => id))).toEqual(new Set([
      'firepower',
      'kinetic',
      'armor-reinforcement',
    ]));
  });

  it('still presents three level-up cards for an early low-build boss kill', () => {
    const choices = selectBossRewardOptions(context({ firepower: 1 }, []), 1);
    expect(choices).toHaveLength(3);
    expect(choices[0]).toEqual({ kind: 'ability-rank', id: 'firepower' });
    expect(new Set(choices.map(({ id }) => id)).size).toBe(3);
  });
});
