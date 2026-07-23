import type { AbilityId, AbilityRanks } from './progressionRules';

export const BOSS_REWARD_IDS = [
  'expanded-magazine',
  'recovery-capacitor',
  'opening-amplifier',
  'chain-warhead',
] as const;

export const SECOND_BOSS_REWARD_IDS = [
  'auxiliary-orbit',
  'recovery-salvo',
  'siege-resonance',
  'hyperpressure-core',
  'inertial-penetration',
  'aftershock-explosion',
  'chain-split',
] as const;

const SECOND_UNIVERSAL_REWARD_IDS = SECOND_BOSS_REWARD_IDS.slice(0, 3);
const SECOND_EVOLUTION_BY_ABILITY = {
  firepower: 'hyperpressure-core',
  kinetic: 'inertial-penetration',
  explosion: 'aftershock-explosion',
  split: 'chain-split',
} as const satisfies Record<AbilityId, SecondBossRewardId>;

export type FirstBossRewardId = typeof BOSS_REWARD_IDS[number];
export type SecondBossRewardId = typeof SECOND_BOSS_REWARD_IDS[number];
export type BossRewardTier = 'first' | 'second';
export type BossRewardId = FirstBossRewardId | SecondBossRewardId;

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function seededShuffle<T>(values: readonly T[], seed: number): T[] {
  const shuffled = [...values];
  let state = seed >>> 0;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = nextSeed(state);
    const swap = state % (index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
  }
  return shuffled;
}

function selectFirstBossRewardOptions(
  owned: ReadonlySet<BossRewardId>,
  ranks: Readonly<AbilityRanks>,
  seed: number,
): BossRewardId[] {
  const eligible = BOSS_REWARD_IDS.filter((id) =>
    !owned.has(id)
    && (id !== 'chain-warhead' || (ranks.split >= 1 && ranks.explosion >= 1)),
  );
  if (eligible.length < 3) {
    throw new RangeError(`at least 3 eligible boss rewards are required; received ${eligible.length}`);
  }
  return seededShuffle(eligible, seed).slice(0, 3);
}

function selectSecondBossRewardOptions(
  owned: ReadonlySet<BossRewardId>,
  ranks: Readonly<AbilityRanks>,
  seed: number,
): BossRewardId[] {
  const universals = SECOND_UNIVERSAL_REWARD_IDS.filter((id) => !owned.has(id));
  const evolutions = Object.entries(SECOND_EVOLUTION_BY_ABILITY)
    .filter(([ability, id]) => ranks[ability as AbilityId] >= 1 && !owned.has(id))
    .map(([, id]) => id);

  const guaranteed = seededShuffle(evolutions, seed)[0];
  const pool = guaranteed
    ? [...universals, ...evolutions.filter((id) => id !== guaranteed)]
    : universals;
  const options = [
    ...(guaranteed ? [guaranteed] : []),
    ...seededShuffle(pool, seed ^ 0x9e3779b9).slice(0, guaranteed ? 2 : 3),
  ];

  if (options.length !== 3 || new Set(options).size !== 3) {
    throw new RangeError(
      `second boss reward selection requires exactly 3 distinct eligible rewards; received ${options.length}`,
    );
  }
  return options;
}

export function selectBossRewardOptions(
  tier: BossRewardTier,
  owned: ReadonlySet<BossRewardId>,
  ranks: Readonly<AbilityRanks>,
  seed: number,
): BossRewardId[];
/** @deprecated Use the tiered overload. */
export function selectBossRewardOptions(
  owned: ReadonlySet<BossRewardId>,
  ranks: Readonly<AbilityRanks>,
  seed: number,
): BossRewardId[];
export function selectBossRewardOptions(
  tierOrOwned: BossRewardTier | ReadonlySet<BossRewardId>,
  ownedOrRanks: ReadonlySet<BossRewardId> | Readonly<AbilityRanks>,
  ranksOrSeed: Readonly<AbilityRanks> | number,
  maybeSeed?: number,
): BossRewardId[] {
  const legacy = typeof tierOrOwned !== 'string';
  const tier = legacy ? 'first' : tierOrOwned;
  const owned = (legacy ? tierOrOwned : ownedOrRanks) as ReadonlySet<BossRewardId>;
  const ranks = (legacy ? ownedOrRanks : ranksOrSeed) as Readonly<AbilityRanks>;
  const seed = (legacy ? ranksOrSeed : maybeSeed) as number;
  return tier === 'first'
    ? selectFirstBossRewardOptions(owned, ranks, seed)
    : selectSecondBossRewardOptions(owned, ranks, seed);
}
