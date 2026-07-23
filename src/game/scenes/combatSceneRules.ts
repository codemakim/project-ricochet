import type { BossKind } from '../config/gameTuning';
import { GAME_TUNING } from '../config/gameTuning';
import type { EncounterTransition } from '../encounters/encounterProgressionRules';
import type { BuildState } from '../progression/BuildState';
import { BossBuild } from '../progression/BossBuild';
import type { BossRewardId, BossRewardTier } from '../progression/bossRewardRules';
import type {
  BossEncounterSnapshot,
  BossTargetId,
} from '../bosses/bossEncounter';
import type { CombatEffectScheduler } from '../combat/CombatEffectScheduler';
import type { EnemyAreaDamageEffect } from '../enemies/EnemyManager';
import type { Vector } from '../math/vector';

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

export interface PlannedAreaEffect {
  kind: 'siege' | 'explosion';
  radius: number;
  damage: number;
}

export interface DirectHitEffectPlan {
  immediateAreas: PlannedAreaEffect[];
  aftershock: { radius: number; damage: number } | null;
  spawnChildren: boolean;
  chargedSplitCount: number;
}

export function planDirectHitEffects(
  event: { source: 'permanent' | 'temporary'; charged: boolean },
  build: Pick<BuildState, 'explosion' | 'splitCount'>,
  bossBuild: Pick<
    BossBuild,
    | 'recordPermanentDirectHit'
    | 'temporaryExplosionEnabled'
    | 'aftershock'
    | 'chainSplitEnabled'
  >,
): DirectHitEffectPlan {
  const immediateAreas: PlannedAreaEffect[] = [];
  if (event.source === 'permanent' && bossBuild.recordPermanentDirectHit()) {
    const { radius, damage } = GAME_TUNING.relics.secondBoss.siegeResonance;
    immediateAreas.push({
      kind: 'siege',
      radius,
      damage,
    });
  }
  const explosion = build.explosion();
  const explosionEnabled = event.source === 'permanent'
    || bossBuild.temporaryExplosionEnabled();
  if (explosion && explosionEnabled) {
    immediateAreas.push({ kind: 'explosion', ...explosion });
  }
  const aftershock = event.source === 'permanent' && explosion
    ? bossBuild.aftershock()
    : null;
  return {
    immediateAreas,
    aftershock: aftershock && explosion
      ? {
        radius: explosion.radius * aftershock.radiusScale,
        damage: explosion.damage * aftershock.damageScale,
      }
      : null,
    spawnChildren: event.source === 'temporary' && bossBuild.chainSplitEnabled(),
    chargedSplitCount: event.source === 'permanent' && event.charged
      ? build.splitCount()
      : 0,
  };
}

interface AreaEffectSettlement {
  applyEnemyBatch(effects: readonly EnemyAreaDamageEffect[]): unknown;
  applyBossArea(
    position: Vector,
    radius: number,
    damage: number,
    excludedTargetId?: BossTargetId,
  ): unknown;
}

export function settlePlannedAreaEffects(
  position: Vector,
  effects: readonly Pick<PlannedAreaEffect, 'radius' | 'damage'>[],
  excludedEnemyId: number,
  excludedBossTargetId: BossTargetId | undefined,
  settlement: AreaEffectSettlement,
): void {
  settlement.applyEnemyBatch(effects.map(({ radius, damage }) => ({
    center: { ...position },
    radius,
    damage,
    excludedEnemyId,
  })));
  for (const { radius, damage } of effects) {
    settlement.applyBossArea(
      position,
      radius,
      damage,
      excludedBossTargetId,
    );
  }
}

export function schedulePlannedAftershock(
  plan: Pick<DirectHitEffectPlan, 'aftershock'>,
  scheduler: Pick<CombatEffectScheduler, 'scheduleAftershock'>,
  gameplayElapsedMs: number,
  position: Vector,
): void {
  if (!plan.aftershock) return;
  scheduler.scheduleAftershock(
    gameplayElapsedMs,
    position,
    plan.aftershock.radius,
    plan.aftershock.damage,
  );
}

export function bossOrbModifiers(
  bossBuild: Pick<BossBuild, 'chargedDamageBonus' | 'chargedKillPierces'>,
): { chargedDamageBonus: number; chargedKillPierces: boolean } {
  return {
    chargedDamageBonus: bossBuild.chargedDamageBonus(),
    chargedKillPierces: bossBuild.chargedKillPierces(),
  };
}

export function rewardAddsPermanentOrb(id: BossRewardId): boolean {
  return id === 'expanded-magazine' || id === 'auxiliary-orbit';
}

export type CombatLifecycleReason =
  | 'defeat'
  | 'rewardOpened'
  | 'rewardCompleted'
  | 'restart'
  | 'shutdown';

interface CombatLifecycleBoss {
  clearHostileActions(): void;
  destroy(): void;
}

export interface CombatLifecycleState<TBoss extends CombatLifecycleBoss = CombatLifecycleBoss> {
  activeBoss?: TBoss;
  activeBossKind?: BossKind;
  bossRewardTier: BossRewardTier | null;
  bossRewardChoices: readonly BossRewardId[];
  bossDefeatPending: boolean;
  bossBuild: BossBuild;
}

export interface CombatLifecycleDependencies {
  scheduler: Pick<CombatEffectScheduler, 'clear'>;
  clearEnemyHostileActions(): void;
  clearWarning(): void;
  clearTemporaryOrbs(): void;
  hideRewardOverlay(): void;
}

export function finalizeCombatLifecycle<TBoss extends CombatLifecycleBoss>(
  reason: CombatLifecycleReason,
  state: CombatLifecycleState<TBoss>,
  dependencies: CombatLifecycleDependencies,
): CombatLifecycleState<TBoss> {
  dependencies.clearEnemyHostileActions();
  dependencies.clearWarning();
  dependencies.scheduler.clear();
  state.activeBoss?.clearHostileActions();
  dependencies.clearTemporaryOrbs();
  if (reason !== 'rewardOpened') dependencies.hideRewardOverlay();
  state.bossBuild.resetTransientState();
  state.activeBoss?.destroy();
  const preservesRun = reason === 'rewardOpened' || reason === 'rewardCompleted';
  return {
    activeBoss: undefined,
    activeBossKind: undefined,
    bossRewardTier: reason === 'rewardOpened' ? state.bossRewardTier : null,
    bossRewardChoices: reason === 'rewardOpened' ? [...state.bossRewardChoices] : [],
    bossDefeatPending: false,
    bossBuild: preservesRun ? state.bossBuild : new BossBuild(),
  };
}

export function inactiveBossSnapshot(kind: BossKind | null): BossEncounterSnapshot {
  return {
    kind: kind ?? 'sentinel',
    active: false,
    phase: null,
    position: null,
    parts: null,
    bullets: 0,
    warnings: 0,
    projectiles: [],
  };
}
