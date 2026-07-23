import type { BossKind } from '../config/gameTuning';
import type { EncounterTransition } from '../encounters/encounterProgressionRules';
import type { BossRewardTier } from '../progression/bossRewardRules';

export function shouldFinalizeBossReward(
  bossDefeatPending: boolean,
  defeated: boolean,
  levelUpPaused: boolean,
): boolean {
  return bossDefeatPending && !defeated && !levelUpPaused;
}

export function bossKindAfterTransition(
  current: BossKind | null,
  transition: EncounterTransition,
): BossKind {
  if (
    transition.type === 'bossStarted'
    && current !== null
    && transition.bossKind !== current
  ) {
    throw new Error(
      `boss start kind ${transition.bossKind} does not match pending ${current}`,
    );
  }
  return transition.bossKind;
}

export function rewardTierForBoss(kind: BossKind): BossRewardTier {
  return kind === 'sentinel' ? 'first' : 'second';
}

export function createBossForKind<T>(
  kind: BossKind,
  factories: Record<BossKind, () => T>,
): T {
  return factories[kind]();
}

export function sectionAfterBossReward(tier: BossRewardTier): number {
  return tier === 'first' ? 1 : 2;
}
