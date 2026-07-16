import type { AbilityRanks } from './progressionRules';

export const BOSS_REWARD_IDS = [
  'expanded-magazine',
  'recovery-capacitor',
  'opening-amplifier',
  'chain-warhead',
] as const;

export type BossRewardId = typeof BOSS_REWARD_IDS[number];

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

export function selectBossRewardOptions(
  owned: ReadonlySet<BossRewardId>,
  ranks: Readonly<AbilityRanks>,
  seed: number,
): BossRewardId[] {
  const eligible = BOSS_REWARD_IDS.filter((id) =>
    !owned.has(id)
    && (id !== 'chain-warhead' || (ranks.split >= 1 && ranks.explosion >= 1)),
  );
  const shuffled = [...eligible];
  let state = seed >>> 0;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = nextSeed(state);
    const swap = state % (index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
  }

  return shuffled.slice(0, 3);
}
