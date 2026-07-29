import type { OrbCoreId } from '../orbs/orbCoreRules';
import {
  ABILITY_IDS,
  ABILITY_MAX_RANKS,
  type AbilityId,
  type AbilityRanks,
} from './progressionRules';

export const BOSS_REWARD_IDS = [
  'auxiliary-link',
  'cross-cut',
  'gas-ignition',
  'recursive-split',
  'inertia-retention',
  'complete-cycle',
  'direct-link',
  'superconducting-circuit',
  'resonance-rupture',
] as const;

export const LEGACY_FIRST_BOSS_REWARD_IDS = [
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
export type BossRewardTier = 'first' | 'second';
type NewBossRewardId = typeof BOSS_REWARD_IDS[number];
type LegacyBossRewardId =
  | typeof LEGACY_FIRST_BOSS_REWARD_IDS[number]
  | typeof SECOND_BOSS_REWARD_IDS[number];
export type BossRewardId = NewBossRewardId | LegacyBossRewardId;
export type BossRewardChoice =
  | { kind: 'relic'; id: NewBossRewardId }
  | { kind: 'ability-rank'; id: AbilityId };

export interface BossRewardContext {
  ownedRewards: ReadonlySet<BossRewardId>;
  ranks: Readonly<AbilityRanks>;
  coreTypes: readonly OrbCoreId[];
}

const TRIGGER_ABILITIES: readonly AbilityId[] = [
  'explosion',
  'horizontal-cutter',
  'vertical-cutter',
  'destruction-reaction',
  'micro-missile',
  'high-speed-impact',
];

function eligible(id: NewBossRewardId, context: BossRewardContext): boolean {
  const rank = (ability: AbilityId) => context.ranks[ability] > 0;
  const core = (type: OrbCoreId) => context.coreTypes.includes(type);
  switch (id) {
    case 'auxiliary-link':
    case 'recursive-split':
      return rank('split');
    case 'cross-cut':
      return rank('horizontal-cutter') || rank('vertical-cutter');
    case 'gas-ignition':
      return rank('explosion') && core('corrosion');
    case 'inertia-retention':
      return core('inertia');
    case 'complete-cycle':
      return rank('reload-overcharge');
    case 'direct-link':
      return rank('reload-overcharge') && TRIGGER_ABILITIES.some(rank);
    case 'superconducting-circuit':
      return core('conduction');
    case 'resonance-rupture':
      return core('echo');
  }
}

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

export function selectBossRewardOptions(
  context: BossRewardContext,
  seed: number,
): BossRewardChoice[] {
  const relics: BossRewardChoice[] = BOSS_REWARD_IDS
    .filter((id) => !context.ownedRewards.has(id) && eligible(id, context))
    .map((id) => ({ kind: 'relic', id }));
  const abilityRanks: BossRewardChoice[] = ABILITY_IDS
    .filter((id) => context.ranks[id] > 0 && context.ranks[id] < ABILITY_MAX_RANKS[id])
    .map((id) => ({ kind: 'ability-rank', id }));
  const newAbilities: BossRewardChoice[] = ABILITY_IDS
    .filter((id) => context.ranks[id] === 0)
    .map((id) => ({ kind: 'ability-rank', id }));
  const choices = seededShuffle(relics, seed)
    .concat(seededShuffle(abilityRanks, seed ^ 0x9e3779b9))
    .concat(seededShuffle(newAbilities, seed ^ 0x85ebca6b))
    .slice(0, 3);
  if (choices.length !== 3) {
    throw new RangeError(
      `boss reward selection requires exactly 3 distinct choices; received ${choices.length}`,
    );
  }
  return choices;
}

/** @deprecated Removed after CombatScene migrates to tagged choices. */
export function selectLegacyBossRewardOptions(
  tier: BossRewardTier,
  owned: ReadonlySet<BossRewardId>,
  ranks: Readonly<Partial<AbilityRanks>>,
  seed: number,
): LegacyBossRewardId[] {
  const first = LEGACY_FIRST_BOSS_REWARD_IDS.filter((id) =>
    !owned.has(id)
    && (id !== 'chain-warhead' || ((ranks.split ?? 0) > 0 && (ranks.explosion ?? 0) > 0)));
  const second = SECOND_BOSS_REWARD_IDS.filter((id) => !owned.has(id));
  const pool = tier === 'first' ? first : second;
  return seededShuffle(pool, seed).slice(0, 3);
}
