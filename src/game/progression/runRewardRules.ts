import type { OrbSnapshot } from '../orbs/OrbManager';
import { GAME_TUNING } from '../config/gameTuning';
import {
  ORB_CORE_DEFINITIONS,
  ORB_CORE_IDS,
  type OrbCoreId,
} from '../orbs/orbCoreRules';
import {
  selectAbilityOptions,
  type AbilityEligibilityContext,
  type AbilityId,
  type AbilityRanks,
} from './progressionRules';

export type RunRewardChoice =
  | { kind: 'ability'; id: AbilityId }
  | { kind: 'orb-add'; coreType: OrbCoreId }
  | { kind: 'orb-upgrade'; coreType: OrbCoreId };

export interface RunRewardContext {
  readonly orbs: readonly Pick<OrbSnapshot, 'coreType' | 'level'>[];
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

  const upgradeTypes = rotate(
    ORB_CORE_IDS.filter((coreType) => context.orbs.some((orb) => (
      orb.coreType === coreType
      && orb.level < ORB_CORE_DEFINITIONS[coreType].maximumLevel
    ))),
    choiceLevel,
    seed,
  );
  if (upgradeTypes.length === 0) return abilityCards(tuning.maximumCards);

  return [
    ...upgradeTypes.slice(0, tuning.full.orbUpgradeCards)
      .map((coreType) => ({ kind: 'orb-upgrade', coreType }) as const),
    ...abilityCards(tuning.full.minimumAbilityCards),
  ].slice(0, tuning.maximumCards);
}

export function runRewardChoiceKey(choice: RunRewardChoice): string {
  return choice.kind === 'ability'
    ? `ability:${choice.id}`
    : `${choice.kind}:${choice.coreType}`;
}

function rotate<T>(values: readonly T[], level: number, seed: number): T[] {
  if (values.length === 0) return [];
  const start = ((seed >>> 0) + Math.max(0, Math.trunc(level))) % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}
