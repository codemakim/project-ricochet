import { GAME_TUNING } from '../config/gameTuning';
import {
  ORB_CORE_IDS,
  type OrbCoreId,
} from '../orbs/orbCoreRules';
import {
  availableFusionIds,
  orbMaximumLevel,
  type FusionOrbId,
  type OrbTypeId,
} from '../orbs/orbFusionRules';
import {
  eligibleAbilityIds,
  selectAbilityOptions,
  type AbilityEligibilityContext,
  type AbilityId,
  type AbilityRanks,
} from './progressionRules';

export type RunRewardChoice =
  | { kind: 'ability'; id: AbilityId }
  | { kind: 'orb-add'; coreType: OrbCoreId }
  | { kind: 'orb-upgrade'; coreType: OrbTypeId }
  | { kind: 'orb-fusion'; fusionType: FusionOrbId };

export interface RunRewardContext {
  readonly orbs: readonly { coreType: OrbTypeId; level: number }[];
  readonly abilityRanks: Readonly<AbilityRanks>;
  readonly abilityEligibility: AbilityEligibilityContext;
}

export function selectRunRewardOptions(
  context: RunRewardContext,
  choiceLevel: number,
  seed: number,
): RunRewardChoice[] {
  const tuning = GAME_TUNING.rewardFlow.mixedCards;
  const abilityChoices = selectAbilityOptions(
    context.abilityRanks,
    choiceLevel,
    seed,
    context.abilityEligibility,
  );
  const abilityCards = (count: number): RunRewardChoice[] => (
    abilityChoices.slice(0, count).map((id) => ({ kind: 'ability', id }))
  );

  if (context.orbs.length < GAME_TUNING.build.basicGrowth.maximumOrbs) {
    const row = context.orbs.length <= tuning.early.maximumOrbs
      ? tuning.early
      : tuning.growing;
    return [
      ...rotate(ORB_CORE_IDS, choiceLevel, seed).slice(0, row.orbCards)
        .map((coreType) => ({ kind: 'orb-add', coreType }) as const),
      ...abilityCards(row.abilityCards),
    ].slice(0, tuning.maximumCards);
  }

  const fusionTypes = rotate(availableFusionIds(
    context.orbs.map((orb, id) => ({ id, ...orb })),
  ), choiceLevel, seed);
  const upgradeTypes = rotate(
    [...new Set(context.orbs
      .filter(({ coreType, level }) => level < orbMaximumLevel(coreType))
      .map(({ coreType }) => coreType))],
    choiceLevel,
    seed,
  );
  if (upgradeTypes.length === 0 && fusionTypes.length === 0) {
    return abilityCards(tuning.maximumCards);
  }

  const fusions = fusionTypes.slice(0, tuning.full.fusionCards)
    .map((fusionType) => ({ kind: 'orb-fusion', fusionType }) as const);
  const abilities = abilityCards(tuning.full.minimumAbilityCards);
  const upgradeSlots = Math.max(0, tuning.maximumCards - fusions.length - abilities.length);

  return [
    ...fusions,
    ...upgradeTypes.slice(0, Math.min(tuning.full.orbUpgradeCards, upgradeSlots))
      .map((coreType) => ({ kind: 'orb-upgrade', coreType }) as const),
    ...abilities,
  ].slice(0, tuning.maximumCards);
}

export function runRewardChoiceKey(choice: RunRewardChoice): string {
  if (choice.kind === 'ability') return `ability:${choice.id}`;
  if (choice.kind === 'orb-fusion') return `orb-fusion:${choice.fusionType}`;
  return `${choice.kind}:${choice.coreType}`;
}

export function hasEligibleRunReward(context: RunRewardContext): boolean {
  if (eligibleAbilityIds(
    context.abilityRanks,
    context.abilityEligibility,
  ).length > 0) return true;
  if (context.orbs.length < GAME_TUNING.build.basicGrowth.maximumOrbs) return true;
  if (availableFusionIds(context.orbs.map((orb, id) => ({ id, ...orb }))).length > 0) {
    return true;
  }
  return context.orbs.some(({ coreType, level }) => (
    level < orbMaximumLevel(coreType)
  ));
}

function rotate<T>(values: readonly T[], level: number, seed: number): T[] {
  if (values.length === 0) return [];
  const start = ((seed >>> 0) + Math.max(0, Math.trunc(level))) % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}
